/**
 * 存档序列化/反序列化工具
 * 负责 Pinia store <-> 存档对象（G 格式）的双向转换
 * 确保存档格式与旧版 game.js 完全兼容
 * Phase 7：集成云端 API（Token 鉴权 + 乐观锁 + 历史版本）
 */
import { usePlayerStore } from './player'
import { useCombatStore } from './combat'
import { useEventStore } from './event'
import { useGameStore } from './game'
import { migrateSave, isValidSave, recoverFromStorage } from '@/engine/save'
import { getSpiritPersonality } from '@/engine/traits'
import { useGameRules } from '@/composables/useGameRules'

// 继续使用旧版正式键，保证 Vue、旧地图/图鉴和既有玩家存档读取同一份数据。
export const LOCAL_SAVE_KEY = 'dldl_text_rpg_save'
const TEMP_VUE_SAVE_KEY = 'dldl_save'
export const HISTORY_ROTATION_INTERVAL_MS = 5 * 60 * 1000
const HISTORY_META_SUFFIX = '_hist_meta'
const historyRotationAt = new WeakMap()

function historyTimesFor(storage) {
  let times = historyRotationAt.get(storage)
  if (!times) {
    times = new Map()
    historyRotationAt.set(storage, times)
  }
  return times
}

function isQuotaExceeded(error) {
  return Boolean(error && (
    error.name === 'QuotaExceededError' ||
    error.code === 22 ||
    error.code === 1014 ||
    /quota/i.test(String(error.message || ''))
  ))
}

function removeStorageKey(storage, key) {
  try { storage.removeItem(key) } catch { /* 清理失败不应遮盖主档错误 */ }
}

function readHistoryRotationAt(storage, key) {
  const times = historyTimesFor(storage)
  if (times.has(key)) return times.get(key)
  let value = 0
  try {
    const raw = storage.getItem(`${key}${HISTORY_META_SUFFIX}`)
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) value = parsed
  } catch { /* 部分隐私模式只允许主键写入，按首次轮转处理 */ }
  times.set(key, value)
  return value
}

function setMainWithQuotaRecovery(storage, key, serialized) {
  try {
    storage.setItem(key, serialized)
    return
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error
  }

  // 主档优先：从最旧到最新逐步释放历史副本，每释放一份就重试主档。
  for (let index = 5; index >= 1; index--) {
    removeStorageKey(storage, `${key}_hist${index}`)
    try {
      storage.setItem(key, serialized)
      return
    } catch (error) {
      if (!isQuotaExceeded(error)) throw error
    }
  }

  // 只有历史链仍不足以腾出空间时，才放弃 backup。
  removeStorageKey(storage, `${key}_backup`)
  try {
    storage.setItem(key, serialized)
  } catch (error) {
    throw error
  }
}

function tryWriteAuxiliary(storage, key, value) {
  try {
    storage.setItem(key, value)
    return true
  } catch (error) {
    if (!isQuotaExceeded(error)) return false
    // 辅助副本失败不能回滚已经成功写入的主档；尽量清理最旧历史后再试一次。
    for (let index = 5; index >= 1; index--) {
      removeStorageKey(storage, `${key}_hist${index}`)
      try {
        storage.setItem(key, value)
        return true
      } catch (retryError) {
        if (!isQuotaExceeded(retryError)) return false
      }
    }
    return false
  }
}

function rotateHistory(storage, key, previousBackup) {
  if (!previousBackup) return false
  try {
    for (let index = 5; index >= 2; index--) {
      const older = storage.getItem(`${key}_hist${index - 1}`)
      if (older === null) removeStorageKey(storage, `${key}_hist${index}`)
      else storage.setItem(`${key}_hist${index}`, older)
    }
    storage.setItem(`${key}_hist1`, previousBackup)
    return true
  } catch {
    // 历史轮转是可丢弃的辅助操作，绝不影响已经成功写入的主档。
    return false
  }
}

// SPIRIT_TRAITS 与 getSpiritPersonality 已收敛至 engine/traits.js（单一来源）。

const DESTINY_PATHS = [
  { id: 'lone_wolf', name: '独行之路', desc: '独自修炼，不依赖宗门，靠自己的双手开辟未来', tags: ['wild', 'hunt', 'survive'] },
  { id: 'sect_master', name: '宗门之路', desc: '广结善缘，开宗立派，以宗门之力问鼎巅峰', tags: ['social', 'sect', 'teach', 'trade'] },
  { id: 'adventurer', name: '冒险之路', desc: '走遍大陆每个角落，探寻秘境与上古遗迹', tags: ['explore', 'ruin', 'secret', 'mystery'] },
  { id: 'hero', name: '英雄之路', desc: '行侠仗义，斩妖除魔，守护天下苍生', tags: ['justice', 'fight', 'evil', 'protect'] },
  { id: 'fate_weaver', name: '命运之路', desc: '命运的安排总是出人意料，你永远不知道明天会发生什么', tags: ['fate', 'random', 'lucky', 'unlucky'] }
]

/**
 * 将所有 store 的 state 序列化为存档对象（G 格式）
 * @returns {Object} 存档对象，格式与旧版 G 一致
 */
export function serializeSave() {
  const player = usePlayerStore()
  const combat = useCombatStore()
  const event = useEventStore()
  const game = useGameStore()

  const eventState = { ...event.$state }
  const dynamicFlags = eventState._dynamicFlags && typeof eventState._dynamicFlags === 'object'
    ? eventState._dynamicFlags
    : {}
  delete eventState._dynamicFlags

  // 旧事件动态 G._* 字段继续保持顶层结构，兼容旧版脚本与存档。
  const save = {
    ...dynamicFlags,
    ...player.$state,
    ...combat.$state,
    ...eventState,
    ...game.$state
  }

  // 添加存档元数据
  save.lastSave = new Date().toISOString()

  return save
}

/**
 * 从存档对象反序列化到各个 store
 * @param {Object} data - 存档对象（G 格式）
 * @returns {boolean} 是否成功
 */
export function deserializeSave(data) {
  if (!isValidSave(data)) return false

  // 先通过 migrateSave 确保存档格式是最新的
  const migrated = migrateSave(data)
  if (!migrated) return false

  const player = usePlayerStore()
  const combat = useCombatStore()
  const event = useEventStore()
  const game = useGameStore()

  // 防止“读取角色 B”或“新游戏”时残留角色 A 的运行时状态。
  player.$reset()
  combat.$reset()
  event.$reset()
  game.$reset()

  // Player store 字段
  const playerFields = [
    'playerId', 'name', 'origin', 'originName', 'spirit', 'spiritBase',
    'innatePower', 'level', 'exp', 'overflowExp', 'hp', 'spiritPower',
    'spiritPowerMax', 'spiritPowerGain', 'gold', 'fatePoints', 'rings',
    'skills', 'inventory', 'weapon', 'bonus', 'originBonus', '_personality',
    '_destiny', '_bones', '_forgeBones', '_craftedBones', '_skillTree',
    '_titles', '_achievementList', '_bossKills', '_skillBonuses',
    '_tempAtkBuff', '_tempDefBuff', '_tempSpdBuff', 'finished', 'createdAt'
  ]

  // Combat store 字段
  const combatFields = [
    'battleStats', '_battleActive', '_formationsUsed', '_usedElements',
    '_maxCombo', '_maxComboFinisher', '_reactionCount', '_reactionTriggered', '_fusionUsed',
    'huntingKnowledge'
  ]

  // Event store 字段
  const eventFields = [
    'choices', 'doneEvents', 'completedEvents', '_recentEvents', '_eventCount',
    '_drawQueue', '_drawQueueKey',
    '_storyPath', '_storyDecisions', '_dynCooldowns', '_introPendingEvent',
    '_pendingChain',
    '_mainStoryVersion', '_storyMilestoneDeferredUntil', '_prologueDone',
    '_spiritAwakeningStoryDone', '_earlyLifeDone', '_registeredAtHall',
    '_enrollmentComplete', '_firstClassDone', '_tutorialPostponed',
    '_academyRecommendation', '_ringHuntDeferredUntil', 'pendingRingLv',
    '_ringHuntLevel', '_ringOrdinal', '_ringTargetId', '_ringTargetName',
    '_lastRingHuntLevel', '_lastRingOrdinal', '_lastRingTargetId', '_lastRingTargetName', '_diary',
    'locationExplorationsByLocation', 'locationExploration'
  ]

  // Game store 字段
  const gameFields = [
    'gameMode', '_currentLocation', '_visitedLocations', '_discoveredHidden',
    '_metNpcs', '_npcRelations', '_npcCooldowns', '_dailySign', '_towerFloor',
    '_gameTime', '_weather', '_totalGoldEarned', '_progressionRulesVersion',
    '_saveVersion', '_locationProgress', '_saveIntegrityWarnings', '_legacyRingOverflow',
    '_orphanedSkills', '_forgeBonesMigrated', '_simpleMode'
  ]

  // 逐字段赋值到各个 store
  playerFields.forEach(key => {
    if (migrated[key] !== undefined) {
      player[key] = migrated[key]
    }
  })

  combatFields.forEach(key => {
    if (migrated[key] !== undefined) {
      combat[key] = migrated[key]
    }
  })

  eventFields.forEach(key => {
    if (migrated[key] !== undefined) {
      event[key] = migrated[key]
    }
  })

  gameFields.forEach(key => {
    if (migrated[key] !== undefined) {
      game[key] = migrated[key]
    }
  })

  const knownFields = new Set([...playerFields, ...combatFields, ...eventFields, ...gameFields])
  const dynamicFlags = migrated._dynamicFlags && typeof migrated._dynamicFlags === 'object'
    ? { ...migrated._dynamicFlags }
    : {}
  for (const [key, value] of Object.entries(migrated)) {
    if (key.startsWith('_') && !knownFields.has(key) && key !== '_saveTime' && key !== '_dynamicFlags') {
      dynamicFlags[key] = value
    }
  }
  event._dynamicFlags = dynamicFlags

  return true
}

/**
 * 创建新角色时初始化所有 store
 * @param {Object} charData - 角色创建数据 { name, origin, spirit, innatePower }
 */
export function initialLevelFromInnatePower(value) {
  const power = Math.max(0, Math.min(100, Number(value) || 0))
  return Math.max(1, Math.min(10, Math.floor(power / 10)))
}

export function initNewCharacter(charData) {
  const player = usePlayerStore()
  const combat = useCombatStore()
  const event = useEventStore()
  const game = useGameStore()

  player.$reset()
  combat.$reset()
  event.$reset()
  game.$reset()

  const o = charData.origin
  const sp = charData.spirit
  const innatePower = charData.innatePower || (sp.tier === 'god' ? 100 : sp.tier === 'top' ? 90 : sp.tier === 'high' ? 75 : sp.tier === 'mid' ? 50 : 20)
  const initialLevel = initialLevelFromInnatePower(innatePower)

  // Player store
  player.playerId = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  player.name = charData.name
  player.origin = o.id
  player.originName = o.fullName
  player.spirit = { id: sp.id, eventKey: sp.eventKey, name: sp.name, tier: sp.tier, type: sp.type, subtype: sp.subtype, image: sp.image, desc: sp.desc, icon: sp.icon }
  player.spiritBase = { attack: sp.attack, defense: sp.defense, hp: sp.hp, speed: sp.speed }
  player.innatePower = innatePower
  player.level = initialLevel
  player.exp = 0
  player.bonus = { attack: 0, defense: 0, hp: 0, speed: 0 }
  player.originBonus = o.stats
  player.weapon = o.weapon || null
  player.spiritPowerMax = 60 + Math.floor(innatePower * 1.2) + o.spiritPower * 3
  player.spiritPower = player.spiritPowerMax
  player.rings = []
  player.skills = []
  player.inventory = [
    { name: '回魂丹', type: 'heal', value: 60, count: 2 },
    { name: '聚魂丹', type: 'mp', value: 40, count: 1 }
  ]
  player.gold = 100
  player.fatePoints = 0
  player._personality = charData.personality || getSpiritPersonality(sp)
  player._destiny = charData.destiny || DESTINY_PATHS[Math.floor(Math.random() * DESTINY_PATHS.length)]
  player.finished = false
  player.createdAt = Date.now()

  // 先天满魂力从 Lv.10 起步，只解锁第一魂环猎取资格；绝不自动发放魂环或魂技。
  event.pendingRingLv = initialLevel >= 10 ? 10 : null
  event._ringHuntDeferredUntil = 0

  // 如果出身有武器，加入背包
  if (o.weapon) {
    player.weapon = o.weapon
    const existing = player.inventory.find(item => item.name === o.weapon.name)
    if (!existing) {
      player.inventory.push({
        name: o.weapon.name,
        type: 'weapon',
        value: o.weapon.attack || 0,
        count: 1,
        desc: o.weapon.attack ? `攻击+${o.weapon.attack}` : '初始武器'
      })
    }
  }

  // Event store
  event.choices = {}
  event.doneEvents = []
  event.completedEvents = []
  event._recentEvents = []
  event._drawQueue = []
  event._drawQueueKey = ''
  event._prologueDone = false
  event._spiritAwakeningStoryDone = false
  event._earlyLifeDone = false
  event._registeredAtHall = false
  event._enrollmentComplete = false
  event._introPendingEvent = null
  event._tutorialPostponed = false
  event._firstClassDone = false
  event._academyRecommendation = null
  event._mainStoryVersion = 1
  event.locationExplorationsByLocation = {}
  event.locationExploration = null

  // Game store
  game.gameMode = 'text-rpg'
  game._currentLocation = ({ star_forest: 'holy_soul_village', spirit_city: 'wuhun_city', border_town: 'tian_dou_city', sea_island: 'tian_dou_city' }[o.id] || 'shrek_academy')
  game._visitedLocations = []
  game._forgeBonesMigrated = true
  game._progressionRulesVersion = 2
  game._saveVersion = 10

  // 与旧版 createPlayer 一致：角色创建后以最终属性满血进入游戏。
  player.hp = useGameRules().finalStats().maxHp

  return true
}

/**
 * 获取当前存档的摘要信息（用于存档列表）
 * @returns {Object} { playerId, name, level, spirit, gameMode, lastSave }
 */
export function getSaveSummary() {
  const player = usePlayerStore()
  const game = useGameStore()

  return {
    playerId: player.playerId,
    name: player.name,
    level: player.level,
    spirit: player.spirit ? player.spirit.name : '未知',
    gameMode: game.gameMode,
    lastSave: new Date().toISOString()
  }
}

// ============ Phase 7：云端存档 API ============

/**
 * 保存到本地 localStorage
 * @returns {Object} 存档对象
 */
export function saveToLocal(options = {}) {
  const save = migrateSave(serializeSave())
  if (!save) throw new Error('存档核心字段不完整')
  save._saveTime = Date.now()
  try {
    const serialized = JSON.stringify(save)
    const currentRaw = localStorage.getItem(LOCAL_SAVE_KEY)
    const changed = currentRaw !== null && currentRaw !== serialized
    const now = Date.now()
    const forceHistory = options?.forceHistory === true
    const rotationDue = changed && (
      forceHistory || now - readHistoryRotationAt(localStorage, LOCAL_SAVE_KEY) >= HISTORY_ROTATION_INTERVAL_MS
    )

    // 主档每次关键保存都立即写入；历史/backup 均在其后尽力维护。
    setMainWithQuotaRecovery(localStorage, LOCAL_SAVE_KEY, serialized)

    if (changed) {
      try {
        const previousBackup = localStorage.getItem(`${LOCAL_SAVE_KEY}_backup`)
        if (rotationDue) {
          // 先记录轮转尝试时间，避免容量异常时每分钟重复搬运历史链。
          historyTimesFor(localStorage).set(LOCAL_SAVE_KEY, now)
          rotateHistory(localStorage, LOCAL_SAVE_KEY, previousBackup)
          tryWriteAuxiliary(localStorage, `${LOCAL_SAVE_KEY}${HISTORY_META_SUFFIX}`, String(now))
        }
        tryWriteAuxiliary(localStorage, `${LOCAL_SAVE_KEY}_backup`, currentRaw)
      } catch (historyError) {
        console.warn('本地历史副本维护失败，已保留最新主档', historyError)
      }
    }
  } catch (e) {
    console.warn('本地存档失败', e)
    throw new Error(`本地存档失败：${e?.message || '浏览器存储不可用'}`)
  }
  return save
}

/**
 * 从本地 localStorage 加载
 * @returns {Object|null} 存档对象
 */
export function loadFromLocal() {
  try {
    const recovered = recoverFromStorage(localStorage, LOCAL_SAVE_KEY)
    if (recovered.data) return recovered.data

    // 迁移开发中的 Vue 临时键，成功后立即写回正式旧版键。
    const temporaryRaw = localStorage.getItem(TEMP_VUE_SAVE_KEY)
    if (!temporaryRaw) return null
    const migrated = migrateSave(JSON.parse(temporaryRaw))
    if (!migrated) return null
    localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return null
  }
}

/**
 * 保存到云端（账号登录 + 乐观锁）
 * 同时写入本地作为备份
 * @param {Object} api - useApi() 返回的 API 工具
 * @returns {Promise<{success: boolean, conflict?: boolean, needLogin?: boolean, version?: number, error?: string}>}
 */
export async function saveToCloud(api, options = {}) {
  let save
  try {
    save = saveToLocal(options)
  } catch (error) {
    return { success: false, localFailed: true, error: error.message }
  }

  // 未登录时只保留本地进度，绝不调用云端
  if (!api.isAuthenticated()) {
    return { success: false, needLogin: true, error: '尚未登录账号，进度已保存到本地' }
  }

  try {
    const result = await api.saveData(save)
    return result
  } catch (e) {
    // Token 已失效（401 后 api 内部自动登出）：需要账号密码才能重新登录，
    // 不再静默自动认证，明确提示玩家登录。
    if (!api.isAuthenticated()) {
      return { success: false, needLogin: true, error: '登录已过期，请重新登录（进度已保存到本地）' }
    }
    return { success: false, error: e.message }
  }
}

/**
 * 从云端加载存档（需已登录且存档属于当前账号）
 * @param {Object} api - useApi() 返回的 API 工具
 * @param {string} playerId - 玩家 ID
 * @returns {Promise<{success: boolean, data?: Object, needLogin?: boolean, error?: string}>}
 */
export async function loadFromCloud(api, playerId) {
  try {
    const result = await api.loadData(playerId)
    if (result.success && result.data) {
      const deserialized = deserializeSave(result.data)
      if (deserialized) {
        // 显式选择云档后同步到本地，同时保留现有本地档的备份/历史链。
        try {
          saveToLocal()
        } catch (error) {
          return { success: false, error: `云端已读取，但本地备份失败：${error.message}` }
        }
        return { success: true, data: result.data }
      }
      return { success: false, error: '存档反序列化失败' }
    }
    return { success: false, error: '无云端存档' }
  } catch (e) {
    if (!api.isAuthenticated()) {
      return { success: false, needLogin: true, error: e.message || '请先登录账号' }
    }
    return { success: false, error: e.message }
  }
}

/**
 * 获取云端存档列表
 * @param {Object} api - useApi() 返回的 API 工具
 * @returns {Promise<Array>} 存档列表
 */
export async function listCloudSaves(api) {
  try {
    const result = await api.listSaves()
    return result.list || []
  } catch {
    return []
  }
}

/**
 * 获取云端历史版本
 * @param {Object} api - useApi() 返回的 API 工具
 * @param {string} playerId - 玩家 ID
 * @returns {Promise<Array>} 历史版本列表
 */
export async function getCloudHistory(api, playerId) {
  try {
    const result = await api.getHistory(playerId)
    return result.versions || []
  } catch {
    return []
  }
}

/**
 * 恢复云端历史版本
 * @param {Object} api - useApi() 返回的 API 工具
 * @param {string} playerId - 玩家 ID
 * @param {number} version - 版本号
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function restoreCloudVersion(api, playerId, version) {
  try {
    const result = await api.restoreVersion(playerId, version)
    if (result.success) {
      // 重新加载恢复后的数据
      const loadResult = await loadFromCloud(api, playerId)
      return loadResult
    }
    return { success: false, error: '恢复失败' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
