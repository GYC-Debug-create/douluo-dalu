/**
 * 事件引擎 composable
 * 从 game.js 移植核心事件推进逻辑: nextEvent / applyChoice / renderContinue
 * 实现事件 -> 结果 -> 继续前行 -> 下一事件 的完整流程
 */
import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useCombatStore } from '@/stores/combat'
import { useUiStore } from '@/stores/ui'
import { useGameRules } from '@/composables/useGameRules'
import { useGameData } from '@/composables/useGameData'
import { useBattleSystem } from '@/composables/useBattleSystem'
import {
  buildRingCompletionMessage,
  buildRingHuntMeta,
  prepareFirstHuntEvent,
  prepareFirstRingEvent,
  ringDefinitionIdForChoice,
  ringDestination
} from '@/utils/ring-hunt'
import { playerFacingBeastName, ringSourceForChoice } from '@/utils/ring-names'
import { resolveEventAsset } from '@/utils/asset-resolver'
import { buildTravelArrivalSummary } from '@/utils/travel-arrival'
import { EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS, ENDINGS } from '@/data/game-data'
import { advanceExperience, classifyEventLocation, normalizeLegacyHealthResult, rankTitleForLevel, RING_LEVELS, GLOBAL_LOCATION_PREFIX } from '@/engine/rules'
import {
  adaptEvent,
  isEventEligible,
  MAIN_STORY_REQUIREMENTS
} from '@/engine/event-rules'
import { getEventIndex } from '@/engine/event-index'
import { serializeSave, saveToLocal } from '@/stores/serializer'
import { appendDiaryEntry } from '@/engine/save'
import {
  buildLocationExplorationEvent,
  buildLocationExplorationQueue,
  explorationProgress,
  isLocationExplorationInProgress,
  LOCATION_EXPLORATION_STATUSES,
  locationExplorationMode,
  isLocationExplorationEvent,
  normalizeLocationExplorationState,
  normalizeLocationExplorationsByLocation
} from '@/utils/location-exploration'

// 主线里程碑 (从 game.js 移植)
const MAIN_STORY_MILESTONES = [
  { id: 'first_hunt', name: '第一次魂兽实战', minLevel: 5, targetId: 'star_duo_outer' },
  { id: 'reach_lv10', name: '修炼至 Lv.10', minLevel: 5, requires: ['first_hunt'] },
  { id: 'soul_master_prelim', name: '魂师大赛·预赛', minLevel: 20, targetId: 'tian_dou_city', requires: MAIN_STORY_REQUIREMENTS.soul_master_prelim },
  { id: 'spirit_hall_exam', name: '武魂殿考核', minLevel: 25, targetId: 'spirit_hall', requires: MAIN_STORY_REQUIREMENTS.spirit_hall_exam },
  { id: 'soul_master_final', name: '魂师大赛·决赛', minLevel: 36, targetId: 'tian_dou_city', requires: MAIN_STORY_REQUIREMENTS.soul_master_final },
  { id: 'god_trial_sea', name: '神位传承·海神九考', minLevel: 75, targetId: 'sea_god_island', requires: MAIN_STORY_REQUIREMENTS.god_trial_sea },
  { id: 'final_evil', name: '最终决战·深渊之主', minLevel: 95, targetId: 'abyss_rift', requires: MAIN_STORY_REQUIREMENTS.final_evil }
]

// 出身标签映射
const ORIGIN_TAGS = {
  star_forest: ['wild', 'survive', 'nature', 'hunt'],
  spirit_city: ['social', 'sect', 'noble', 'trade'],
  border_town: ['fight', 'guard', 'military', 'weapon'],
  sea_island: ['sea', 'water', 'nature', 'speed']
}

// 武魂特质映射
const SPIRIT_TRAITS = {
  '生活器物': ['实用', '生存', '灵巧'],
  '武器': ['战斗', '锋利', '刚猛'],
  '强攻系': ['力量', '破坏', '狂暴'],
  '防御系': ['坚韧', '守护', '沉稳'],
  '敏攻系': ['敏捷', '隐匿', '灵动'],
  '控制系': ['精神', '束缚', '智慧'],
  '辅助系': ['治愈', '祝福', '奉献'],
  '植物系': ['生长', '自然', '生命'],
  '神器': ['神圣', '审判', '威严'],
  '神兽': ['远古', '威严', '不朽'],
  '特殊': ['神秘', '命运', '独特']
}

// 地图旅行遭遇。抽取结果在 MapPage 离开前就写入 sessionStorage，
// 这里仅决定遭遇内容，避免玩家通过刷新反复重掷“是否遇险”。
const TRAVEL_ENCOUNTERS = [
  { id: 'ambush_beast', weight: 30, minLevel: 1, type: 'battle', text: '一只野生魂兽突然从草丛中窜出，拦住了你的去路！' },
  { id: 'wandering_merchant', weight: 15, minLevel: 1, type: 'merchant', text: '一位行商路过，他打量了你一番：“魂师大人，要看看我的商品吗？”' },
  { id: 'lost_traveler', weight: 12, minLevel: 1, type: 'event', text: '你遇到一位迷路的旅人，他看起来十分焦急。' },
  { id: 'spirit_fragment', weight: 10, minLevel: 5, type: 'reward', text: '你在路边发现了一块散发着微光的灵力碎片！' },
  { id: 'ancient_cache', weight: 8, minLevel: 10, type: 'reward', text: '你发现了一个古老的藏宝箱！' },
  { id: 'rival_soul_master', weight: 15, minLevel: 8, type: 'battle', text: '一位同级别的魂师拦住了你：“来切磋一番如何？”' },
  { id: 'rare_beast', weight: 5, minLevel: 15, type: 'battle', text: '你感受到了一股强大的气息——一只罕见的精英魂兽出现了！' }
]

const INTRO_ORIGINS = {
  star_forest: {
    place: '圣魂村外', person: '村中老铁匠', image: 'assets/scenes/forest_outer.jpg',
    birth: '你出生在星斗大森林边缘的普通农户家庭，林风与铁锤声陪伴你长大。'
  },
  spirit_city: {
    place: '武魂城旧街', person: '家族藏书阁的守卷人', image: 'assets/scenes/wuhun_city.jpg',
    birth: '你出生在武魂城的魂师世家，礼法、典籍与家族期待环绕着你。'
  },
  border_town: {
    place: '边境城墙', person: '守城队长', image: 'assets/scenes/border_town.jpg',
    birth: '你出生在常受魂兽侵扰的边境小城，警钟和药草气味教会你珍惜安宁。'
  },
  sea_island: {
    place: '海边渔村', person: '识潮的老船长', image: 'assets/scenes/sea_god_island.jpg',
    birth: '你出生在海神岛周边的小渔村，潮汐与风暴磨出了你的耐性。'
  }
}

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// 优先轮换未经历事件，并完全避开近期事件；只有候选池确实无法轮换时才回退。
// 回退时也只保留近期出现次数最少、最久未出现的候选，避免直接退回整个原池造成连刷。
export function cooldownSafeEventPool(pool, recentEvents, completedEvents) {
  const source = Array.isArray(pool) ? pool.filter(Boolean) : []
  if (source.length === 0) return []
  const recent = Array.isArray(recentEvents) ? recentEvents.filter(Boolean) : []

  if (Array.isArray(completedEvents)) {
    const completed = new Set(completedEvents)
    const unseen = source.filter(event => !completed.has(event.id))
    if (unseen.length > 0) return unseen
  }

  const recentSet = new Set(recent)
  const cooled = source.filter(event => !recentSet.has(event.id))
  if (cooled.length > 0) return cooled
  if (source.length === 1) return source

  const counts = new Map()
  for (const id of recent) {
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  const minimumCount = Math.min(...source.map(event => counts.get(event.id) || 0))
  const leastRepeated = source.filter(event => (counts.get(event.id) || 0) === minimumCount)
  const oldestLastIndex = Math.min(...leastRepeated.map(event => recent.lastIndexOf(event.id)))
  return leastRepeated.filter(event => recent.lastIndexOf(event.id) === oldestLastIndex)
}

/**
 * 构建 G 代理对象 —— 让事件 effect 函数能直接修改 Pinia store
 * effect 函数签名是 (G) => string,其中 G 是原始游戏全局对象
 * 这里用 Proxy 桥接到各 Pinia store
 */
function buildGProxy() {
  const player = usePlayerStore()
  const event = useEventStore()
  const game = useGameStore()
  const combat = useCombatStore()
  const { finalStats, getMaxSpiritPower } = useGameRules()

  // 合并所有 store 的 state 到一个响应式代理
  const handler = {
    get(_target, key) {
      // 先查 player store
      if (key in player.$state) return player.$state[key]
      // 再查 event store
      if (key in event.$state) return event.$state[key]
      // 再查 game store
      if (key in game.$state) return game.$state[key]
      // 战斗统计等字段属于 combat store
      if (key in combat.$state) return combat.$state[key]
      if (key in event._dynamicFlags) return event._dynamicFlags[key]
      // 特殊方法
      if (key === 'finalStats') return finalStats()
      if (key === 'maxHp') return finalStats().maxHp
      if (key === 'maxSpiritPower') return getMaxSpiritPower()
      return undefined
    },
    set(_target, key, value) {
      if (key in player.$state) { player.$state[key] = value; return true }
      if (key in event.$state) { event.$state[key] = value; return true }
      if (key in game.$state) { game.$state[key] = value; return true }
      if (key in combat.$state) { combat.$state[key] = value; return true }
      // 旧事件会动态创建 G._* 标记，集中保存以便刷新后恢复。
      event._dynamicFlags[key] = value
      return true
    }
  }

  return new Proxy({}, handler)
}

/**
 * 事件引擎 composable
 */
export function useEventEngine() {
  const player = usePlayerStore()
  const eventStore = useEventStore()
  const gameStore = useGameStore()
  const combatStore = useCombatStore()
  const ui = useUiStore()
  const { finalStats, getMaxSpiritPower, expNeeded, phaseForLevel, levelCapForRings } = useGameRules()
  const { data } = useGameData()
  const battleSystem = useBattleSystem()

  // 场景状态: 'idle' | 'event' | 'continue' | 'location' | 'ringHunt' | 'battle'
  const sceneState = ref('idle')
  const currentEvent = ref(null)
  const resultText = ref('')
  const resultRewards = ref([])
  const currentLocationName = ref('')
  const battleActive = computed(() => battleSystem.active.value)

  const canHunt = computed(() => {
    const cap = levelCapForRings(player.rings?.length || 0)
    return player.level >= cap && player.rings?.length < 9
  })

  // M2 性能：cond/effect/结局判定共享同一个 G 代理（原实现每次新建 Proxy）。
  // 实例级单例：每个引擎实例绑定其创建时的 Pinia，避免跨实例/测试污染。
  let sharedG = null
  function createGProxy() {
    if (!sharedG) sharedG = buildGProxy()
    return sharedG
  }

  // ==================== 辅助函数 ====================

  function buildPrologueEvent() {
    const origin = INTRO_ORIGINS[player.origin] || INTRO_ORIGINS.star_forest
    const traits = (player._personality?.traits || ['独特']).slice(0, 3).join('、')
    return {
      id: 'vue_prologue',
      name: '序章 · 武魂觉醒',
      location: player.originName || origin.place,
      image: origin.image,
      unique: true,
      text: [
        origin.birth,
        '终于，你六岁了。武魂殿的魂师来到这里，为适龄的孩子主持觉醒仪式。',
        `六枚觉醒石依次点亮，你的武魂「${player.spirit?.name || '武魂'}」第一次显现在世间。`,
        `你从武魂的回应里理解了${traits}。武魂定义起点，却不能替你决定终点。`
      ],
      choices: [{
        id: 'begin',
        text: '记住自己的来处，踏上魂师之路',
        path: 'begin',
        result: { text: `你的名字是${player.name}，先天魂力${player.innatePower}级。斗罗大陆的篇章，就此展开……` },
        effect: () => {
          eventStore._prologueDone = true
          eventStore._spiritAwakeningStoryDone = true
        }
      }]
    }
  }

  function buildEarlyLifeEvents() {
    const origin = INTRO_ORIGINS[player.origin] || INTRO_ORIGINS.star_forest
    const spirit = player.spirit || { id: 'unknown', name: '武魂', type: '未知武魂' }
    const nodes = [
      {
        id: `early_family_${player.origin}`, name: '家的灯火', location: origin.place, image: origin.image,
        text: '入学前的最后一个清晨，家里还有许多事要做。你决定——',
        choices: [
          { id: 'help', text: '留下帮家人做完手头的活', path: 'loyal', result: { defense: 1 }, reply: '你学会了把力量用在照顾身边的人上。' },
          { id: 'train', text: '先完成今日的基础锻炼', path: 'pragmatic', result: { attack: 1 }, reply: '一遍遍扎实的动作，让你的根基更稳。' },
          { id: 'listen', text: '听家人再讲一次故乡往事', path: 'scholar', result: { fate: 1 }, reply: '那些往事成为你日后辨认归途的坐标。' }
        ]
      },
      {
        id: `early_person_${player.origin}`, name: '重要的人', location: origin.place, image: origin.image,
        text: `${origin.person}在路口等你，只问：“成为魂师以后，你最想守住什么？”`,
        choices: [
          { id: 'people', text: '守住重要的人', path: 'merciful', result: { defense: 1 }, reply: '对方点点头，把一句“莫忘本心”留给了你。' },
          { id: 'truth', text: '守住求知与判断', path: 'scholar', result: { spiritPowerGain: 1 }, reply: '一册写满批注的旧笔记被郑重交到你手中。' },
          { id: 'freedom', text: '守住选择自己道路的自由', path: 'rebel', result: { speed: 1 }, reply: '你第一次清楚说出了属于自己的答案。' }
        ]
      },
      {
        id: `early_spirit_${spirit.id}`, name: '第一次武魂感应', location: '入学前夜', image: spirit.image || 'assets/scenes/library_night.jpg',
        text: `夜深时，「${spirit.name}」在你的心海中轻轻回应，将一缕魂力递到你面前。`,
        choices: [
          { id: 'accept', text: '坦然接纳这份力量', path: 'ambitious', result: { attack: 1 }, reply: `你与「${spirit.name}」的气息第一次完整重合。` },
          { id: 'observe', text: '先观察魂力如何流转', path: 'tactician', result: { defense: 1 }, reply: '你记住了每一次明暗变化，对自己的武魂多了一分理解。' },
          { id: 'promise', text: '许诺绝不轻视任何武魂', path: 'saint', result: { fate: 1 }, reply: '那缕魂光温和地亮了一瞬，像是在回应你的承诺。' }
        ]
      },
      {
        id: `early_registration_${player.origin}`, name: '魂师登记与评定', location: `${origin.place} · 武魂殿分殿`, image: 'assets/scenes/temple.jpg',
        text: '觉醒后的手续不能只靠一纸天赋。你要登记武魂、测定魂力，并听取未来修炼方向的建议。',
        choices: [
          { id: 'register', text: '如实登记，接受完整评定', path: 'prudent', result: { spiritPowerGain: 2, fate: 1 }, reply: '执事将你的武魂与魂力等级记入档案。', after: 'registered' },
          { id: 'question', text: '追问不同武魂的修炼道路', path: 'scholar', result: { spiritPowerGain: 1, defense: 1 }, reply: '执事认真告诉你学院与宗门的区别。', after: 'registered' },
          { id: 'private', text: '只登记必要信息，保留家族底牌', path: 'prudent', result: { speed: 1, fate: -1 }, reply: '你谨慎地收起评定单。', after: 'registered' }
        ]
      },
      {
        id: `early_recommendation_${player.origin}`, name: '入学资格与推荐', location: origin.place, image: origin.image,
        text: '登记完成后，你要决定以什么方式争取进入更好的魂师学院。',
        choices: [
          { id: 'shrek_recommend', text: '接受史莱克学院的入学推荐', path: 'sect_master', result: { fate: 1, exp: 15 }, reply: '推荐信上盖下了印章。', after: 'recommended' },
          { id: 'local_then_shrek', text: '先在当地学院打基础，再申请转入', path: 'pragmatic', result: { defense: 1, exp: 25 }, reply: '你选择稳扎稳打。', after: 'recommended' },
          { id: 'self_recommend', text: '自荐参加史莱克的公开考核', path: 'rebel', result: { attack: 1, speed: 1 }, reply: '你在报名册上写下自己的名字。', after: 'recommended' }
        ]
      },
      {
        id: `early_enrollment_${player.origin}`, name: '报到与分班', location: '史莱克学院', image: 'assets/scenes/academy_classroom.jpg',
        text: '几日后，你抵达史莱克学院，完成登记、核验与入学考核。',
        choices: [
          { id: 'combat_class', text: '选择实战班，从训练场开始', path: 'ambitious', result: { attack: 1, hp: 10 }, reply: '你决定用一次次实战赢得认可。', after: 'enrolled' },
          { id: 'theory_class', text: '选择理论与战术班，先打牢基础', path: 'scholar', result: { defense: 1, spiritPowerGain: 1 }, reply: '你选择先理解知识，再把它变成判断。', after: 'enrolled' },
          { id: 'balanced_class', text: '选择综合班，边学边找方向', path: 'pragmatic', result: { speed: 1, fate: 1 }, reply: '你决定在学院生活中找到真正适合自己的道路。', after: 'enrolled' }
        ]
      }
    ]
    return nodes.map(node => ({ ...node, phase: 'academy', unique: true, choices: node.choices.map(choice => ({ ...choice })) }))
  }

  function currentPhase() {
    return phaseForLevel(player.level)
  }

  function eventContext(overrides = {}) {
    const level = Number(player.level) || 1
    const gameTime = Number(gameStore._gameTime) || 0
    const timeOfDay = ['dawn', 'day', 'day', 'day', 'dusk', 'night', 'night', 'night'][gameTime % 8]
    return {
      level,
      origin: player.origin || '',
      phase: currentPhase(),
      ringCount: player.rings?.length || 0,
      spirit: player.spirit || {},
      doneEvents: eventStore.doneEvents || [],
      recentEvents: eventStore._recentEvents || [],
      ascended: eventStore._dynamicFlags?._ascended === true,
      combo: Number(battleSystem.combo?.value) || Number(combatStore._maxCombo) || 0,
      timeOfDay,
      ...overrides
    }
  }

  function getSpiritPersonality(sp) {
    const traits = SPIRIT_TRAITS[sp.subtype] || SPIRIT_TRAITS[sp.type === '器武魂' ? '武器' : '强攻系'] || ['独特']
    const extra = []
    if (sp.tier === 'god') extra.push('神圣')
    if (sp.tier === 'top') extra.push('威严')
    return { traits: [...traits, ...extra], subtype: sp.subtype || sp.type }
  }

  function getTraitMultiplier(trait, field) {
    const TRAIT_BONUS = {
      '战斗': { exp: 1.3, attack: 1.5 },
      '力量': { attack: 1.5, exp: 1.2 },
      '破坏': { attack: 2, exp: 1.2 },
      '狂暴': { attack: 1.5 },
      '坚韧': { defense: 1.5, maxHp: 1.3 },
      '守护': { defense: 1.5, fate: 1 },
      '沉稳': { defense: 1.5, exp: 1.1 },
      '敏捷': { speed: 1.5, exp: 1.2 },
      '隐匿': { speed: 1.5, gold: 1.2 },
      '灵动': { speed: 1.5, fate: 1 },
      '精神': { spiritPowerGain: 1.5, exp: 1.2 },
      '智慧': { exp: 1.5, spiritPowerGain: 1.2 },
      '束缚': { defense: 1.2, attack: 1.2 },
      '治愈': { heal: 1.5, maxHp: 1.1, fate: 1 },
      '祝福': { fate: 1.5, heal: 1.2 },
      '奉献': { fate: 1.5, gold: 1.3 },
      '生长': { maxHp: 1.3, defense: 1.2 },
      '自然': { heal: 1.3, spiritPowerGain: 1.2 },
      '生命': { maxHp: 1.2, heal: 1.5, fate: 1 },
      '神圣': { fate: 1.5, attack: 1.3 },
      '审判': { attack: 1.5, fate: 1 },
      '威严': { exp: 1.3, attack: 1.2 },
      '远古': { exp: 1.3, defense: 1.2 },
      '不朽': { maxHp: 1.5, defense: 1.3 },
      '实用': { gold: 1.5, exp: 1.1 },
      '生存': { maxHp: 1.3, defense: 1.2 },
      '灵巧': { speed: 1.3, gold: 1.2 },
      '锋利': { attack: 1.5, speed: 1.1 },
      '刚猛': { attack: 1.3, defense: 1.1 },
      '神秘': { fate: 1.5, exp: 1.3 },
      '命运': { fate: 2, exp: 1.2 },
      '独特': { exp: 1.3, fate: 1 }
    }
    const bonus = TRAIT_BONUS[trait]
    if (!bonus) return 1
    return bonus[field] || 1
  }

  function getSpiritBonus(field) {
    if (!player._personality) return 1
    let mult = 1
    for (const t of player._personality.traits || []) {
      const value = getTraitMultiplier(t, field)
      mult *= Number.isFinite(value) && value > 0 ? value : 1
    }
    return Math.min(mult, 2.5)
  }

  function checkCond(cond) {
    if (!cond) return true
    if (typeof cond === 'function') {
      try {
        const G = createGProxy()
        return Boolean(cond(G))
      } catch { return false }
    }
    const fs = finalStats()
    if (cond.attack && fs.attack < cond.attack) return false
    if (cond.defense && fs.defense < cond.defense) return false
    if (cond.speed && fs.speed < cond.speed) return false
    if (cond.level && player.level < cond.level) return false
    if (cond.gold && player.gold < cond.gold) return false
    if (cond.fate && player.fatePoints < cond.fate) return false
    if (cond.item) {
      const required = Math.max(1, Number(cond.itemCount) || 1)
      const it = player.inventory?.find(x => x.name === cond.item && Number(x.count) >= required)
      if (!it) return false
    }
    return true
  }

  // ==================== 事件过滤与加权 ====================

  function eventMatchesCurrentLocation(ev) {
    const currentLoc = player._currentLocation || gameStore._currentLocation || ''
    if (!ev.location) return true
    // 全局事件（正则单一来源 engine/rules.js，勿手抄）
    if (GLOBAL_LOCATION_PREFIX.test(ev.location)) return true
    // 简单匹配：事件地点包含当前地点名或反之
    if (currentLoc && ev.location.includes(currentLoc)) return true
    if (currentLoc && currentLoc.includes(ev.location)) return true
    // 通过 classifyEventLocation 判断
    const info = classifyEventLocation(ev.location, data.value.mapData)
    if (info.scope === 'global') return true
    return info.scope === 'mapped' && info.id === currentLoc
  }

  function availableEvents() {
    // M2 性能：基于预构建索引取候选（phase 桶 ∪ any 桶 ∪ 全局 ∪ 当前地点桶），
    // 再交给 isEventEligible 全量判定——结果与原全量遍历逐位一致（桶是超集）。
    const index = getEventIndex({
      events: EVENTS,
      mapLocations: data.value.mapData,
      spiritMeta: player.spirit || {}
    })
    const phase = currentPhase()
    const currentLoc = player._currentLocation || gameStore._currentLocation || ''
    const candidates = new Set(index.global)
    for (const id of index.byPhase.get(phase) || []) candidates.add(id)
    for (const id of index.byPhase.get('any') || []) candidates.add(id)
    if (currentLoc && index.byLocation.has(currentLoc)) {
      for (const id of index.byLocation.get(currentLoc)) candidates.add(id)
    }
    const pool = []
    for (const id of candidates) {
      const event = index.adapted.get(id)
      if (!event) continue
      if (isEventEligible(event, eventContext({
        isMainStory: false,
        isRingHunt: false,
        locationMatches: eventMatchesCurrentLocation(event)
      }))) pool.push(event)
    }
    return pool
  }

  function eventMatchBonus(ev) {
    let bonus = 0
    const pt = player._personality
    const dy = player._destiny
    if (!pt || !dy) return 0
    if (ev.tags && pt.traits) {
      for (const tag of ev.tags) {
        if (pt.traits.includes(tag)) bonus += 2
        if (pt.subtype === tag) bonus += 3
        if (player.spirit?.type === tag) bonus += 2
      }
    }
    if (ev.tags && dy.tags) {
      for (const tag of ev.tags) {
        if (dy.tags.includes(tag)) bonus += 3
      }
    }
    const originTags = ORIGIN_TAGS[player.origin] || []
    if (ev.tags && originTags.length) {
      for (const tag of ev.tags) {
        if (originTags.includes(tag)) bonus += 3
      }
    }
    return bonus
  }

  function recentCooldown(pool) {
    return cooldownSafeEventPool(pool, eventStore._recentEvents, eventStore.doneEvents)
  }

  // ==================== 主线里程碑 ====================

  function nextMainStoryMilestone() {
    const fullStory = Number(eventStore._mainStoryVersion) >= 1
    if (!fullStory) {
      const finalMilestone = MAIN_STORY_MILESTONES.find(item => item.id === 'final_evil')
      return finalMilestone && !eventStore.doneEvents?.includes('final_evil') ? finalMilestone : null
    }
    return MAIN_STORY_MILESTONES.find(item => {
      if (eventStore.doneEvents?.includes(item.id)) return false
      return (item.requires || []).every(id => eventStore.doneEvents?.includes(id))
    }) || null
  }

  // ==================== 动态事件 ====================

  function checkDynamicEvents(context = eventContext()) {
    const G = createGProxy()
    for (const ev of DYNAMIC_EVENTS) {
      if (ev.once && eventStore.doneEvents?.includes(ev.id)) continue
      if (ev.cooldown) {
        if (eventStore._dynCooldowns?.[ev.id] > 0) continue
      }
      const adapted = adaptEvent(ev, { spiritMeta: player.spirit || {} })
      if (!isEventEligible(adapted, eventContext({ ...context, source: 'dynamic' }))) continue
      if (ev.condition && ev.condition(G, context)) {
        return adapted
      }
    }
    return null
  }

  // ==================== 连锁事件 ====================

  function checkChainedEvents() {
    for (const key in CHAINED_EVENTS) {
      const ev = adaptEvent(CHAINED_EVENTS[key], { spiritMeta: player.spirit || {} })
      if (!isEventEligible(ev, eventContext({ source: 'chained', locationMatches: true }))) continue
      const G = createGProxy()
      if (ev.requires && !ev.requires(G)) continue
      if (eventStore.doneEvents?.includes(ev.id)) continue
      if (eventStore._recentEvents?.includes(ev.id)) continue
      return ev
    }
    return null
  }

  // ==================== 奖励应用 ====================

  function applyResultRewards(result) {
    const r = normalizeLegacyHealthResult(result || {})
    const gains = []
    const summary = {
      list: gains,
      exp: 0,
      gold: 0,
      fate: 0,
      items: [],
      levelBefore: player.level,
      levelAfter: player.level,
      levels: [],
      overflowExp: player.overflowExp || 0
    }

    const addPermanent = (field, label) => {
      const raw = Number(r[field]) || 0
      if (!raw) return
      const multiplier = raw > 0 ? getSpiritBonus(field) : 1
      const value = Math.round(raw * multiplier)
      player.bonus[field] = (Number(player.bonus?.[field]) || 0) + value
      gains.push(`${label}${value >= 0 ? '+' : ''}${value}${multiplier > 1 ? '（武魂共鸣）' : ''}`)
    }
    addPermanent('attack', '攻击')
    addPermanent('defense', '防御')
    addPermanent('speed', '速度')

    if (r.maxHp) {
      const multiplier = Number(r.maxHp) > 0 ? getSpiritBonus('maxHp') : 1
      const value = Math.max(0, Math.round((Number(r.maxHp) || 0) * multiplier))
      if (value > 0) {
        player.bonus.hp = (Number(player.bonus?.hp) || 0) + value
        player.hp = Math.min(player.hp + value, finalStats().maxHp)
        gains.push(`最大生命+${value}${multiplier > 1 ? '（武魂共鸣）' : ''}`)
      }
    }

    if (typeof r.heal === 'number' && r.heal > 0) {
      const multiplier = getSpiritBonus('heal')
      const value = Math.round(r.heal * multiplier)
      const before = player.hp
      player.hp = Math.max(1, Math.min(finalStats().maxHp, player.hp + value))
      gains.push(`生命恢复+${Math.max(0, player.hp - before)}${multiplier > 1 ? '（武魂共鸣）' : ''}`)
    }
    if (r.damage) {
      const value = Math.max(0, Math.round(Number(r.damage) || 0))
      if (value > 0) {
        player.hp = Math.max(1, player.hp - value)
        gains.push(`生命-${value}`)
      }
    }

    if (r.gold) {
      const raw = Math.round(Number(r.gold) || 0)
      const titleGold = raw > 0 ? Math.max(0, Number(finalStats().titleBonus?.gold) || 0) : 0
      const multiplier = raw > 0 ? getSpiritBonus('gold') : 1
      const requested = raw > 0 ? Math.round(raw * multiplier * (1 + titleGold)) : raw
      const before = player.gold
      player.addGold(requested)
      const actual = player.gold - before
      if (actual > 0) gameStore._totalGoldEarned = (Number(gameStore._totalGoldEarned) || 0) + actual
      summary.gold += actual
      gains.push(`金币${actual >= 0 ? '+' : ''}${actual}`)
    }

    if (r.spiritPowerGain) {
      const raw = Number(r.spiritPowerGain) || 0
      const titlePower = raw > 0 ? Math.max(0, Number(finalStats().titleBonus?.spiritPowerGain) || 0) : 0
      const multiplier = raw > 0 ? getSpiritBonus('spiritPowerGain') : 1
      const value = Math.round(raw * multiplier + titlePower)
      if (value > 0) {
        const gain = value * 2
        player.spiritPowerMax = (Number(player.spiritPowerMax) || 0) + gain
        player.spiritPower = Math.min(getMaxSpiritPower(), player.spiritPower + gain)
        gains.push(`魂力上限+${gain}`)
      } else if (value < 0) {
        const loss = Math.abs(value * 2)
        player.spiritPower = Math.max(0, player.spiritPower - loss)
        gains.push(`魂力-${loss}`)
      }
    }
    if (r.mp) {
      const value = Number(r.mp) || 0
      const before = player.spiritPower
      player.spiritPower = Math.max(0, Math.min(getMaxSpiritPower(), player.spiritPower + value))
      const actual = player.spiritPower - before
      gains.push(`魂力${actual >= 0 ? '+' : ''}${actual}`)
    }

    if (r.fate) {
      const raw = Number(r.fate) || 0
      const npcMultiplier = raw > 0 ? (finalStats().npcBonus?.fateMul || 1) : 1
      const multiplier = raw > 0 ? getSpiritBonus('fate') * npcMultiplier : 1
      const value = Math.round(raw * multiplier)
      player.fatePoints = (Number(player.fatePoints) || 0) + value
      summary.fate += value
      gains.push(`命运值${value >= 0 ? '+' : ''}${value}`)
    }

    const recordItemChange = item => {
      if (!item?.name) return
      const count = Number.isFinite(Number(item.count)) && Number(item.count) !== 0 ? Number(item.count) : 1
      const existing = player.inventory.find(entry => entry.name === item.name && entry.value === item.value)
      if (count < 0) {
        const consumed = Math.min(existing ? Math.max(0, Number(existing.count) || 0) : 0, Math.abs(count))
        if (existing) existing.count -= consumed
        player.inventory = player.inventory.filter(entry => Number(entry.count) > 0)
        gains.push(consumed > 0 ? `消耗「${item.name}」×${consumed}` : `未消耗「${item.name}」（库存不足）`)
        summary.items.push({ name: item.name, count: -consumed })
        return
      }
      if (existing) existing.count = (Number(existing.count) || 0) + count
      else player.inventory.push({ ...item, type: item.type || 'special', count })
      if (item.effect && typeof item.effect === 'object') {
        for (const field of ['attack', 'defense', 'hp', 'speed']) {
          if (item.effect[field]) player.bonus[field] = (Number(player.bonus?.[field]) || 0) + Number(item.effect[field]) * count
        }
        if (item.effect.spiritPowerGain) {
          const gain = Number(item.effect.spiritPowerGain) * count
          player.spiritPowerMax += gain
          player.spiritPower = Math.min(getMaxSpiritPower(), player.spiritPower + gain)
        }
        if (item.effect.fate) player.fatePoints += Number(item.effect.fate) * count
      }
      gains.push(`获得「${item.name}」×${count}`)
      summary.items.push({ name: item.name, count })
    }
    recordItemChange(r.item)
    recordItemChange(r.item2)

    if (r.heal === true || r.healFull) {
      player.hp = finalStats().maxHp
      player.spiritPower = getMaxSpiritPower()
      gains.push('完全恢复')
    }

    if (r.evolve) {
      const order = ['low', 'mid', 'high', 'top', 'god']
      const currentIndex = order.indexOf(player.spirit?.tier)
      const nextTier = currentIndex >= 0 ? order[currentIndex + 1] : null
      const pool = nextTier ? data.value.spirits.filter(spirit => spirit.tier === nextTier) : []
      const evolved = pool.length ? pick(pool) : null
      if (evolved) {
        player.spirit = {
          id: evolved.id,
          eventKey: evolved.eventKey,
          name: evolved.name,
          tier: evolved.tier,
          type: evolved.type,
          subtype: evolved.subtype,
          image: evolved.image,
          desc: evolved.desc,
          icon: evolved.icon
        }
        player.spiritBase = {
          attack: evolved.attack,
          defense: evolved.defense,
          hp: evolved.hp,
          speed: evolved.speed
        }
        eventStore._dynamicFlags._evolved = true
        gains.push(`✦ 武魂进化为「${evolved.name}」！`)
      }
    }

    if (r.exp) {
      const raw = Number(r.exp) || 0
      if (raw > 0) {
        const fs = finalStats()
        const value = Math.max(1, Math.round(raw * getSpiritBonus('exp') * (fs.npcBonus?.expMul || 1)))
        if (player.level >= 100) {
          player.addGold(value)
          gameStore._totalGoldEarned = (Number(gameStore._totalGoldEarned) || 0) + value
          summary.gold += value
          gains.push(`满级经验转化为金币+${value}`)
        } else {
          player.addExp(value)
          const levelResult = checkLevelUp()
          summary.exp += value
          summary.levelAfter = levelResult.level
          summary.levels = levelResult.levels || []
          summary.overflowExp = levelResult.overflowExp || 0
          gains.push(`经验+${value}${summary.levels.length ? `（Lv.${summary.levels.join(' → ')}）` : ''}`)
        }
      }
    }

    return summary
  }

  function grantRingForEvent(ev, choice, choiceIndex) {
    if (!ev?.ring || player.rings.length >= 9) return null
    const ringId = ringDefinitionIdForChoice(ev, choice, choiceIndex)
    if (!ringId) return null
    const definition = data.value.rings.find(item => item.id === ringId)
    if (!definition) {
      ui.notify('魂环数据未加载，无法完成吸收', 'error', 5000)
      return null
    }

    const source = ringSourceForChoice(choice, definition.name)
    const ordinal = player.rings.length + 1
    const ringMeta = buildRingHuntMeta({
      pendingRingLv: eventStore._ringHuntLevel || eventStore.pendingRingLv || ev.minLevel,
      ringLevel: ev._ringHuntLevel || eventStore._ringHuntLevel || eventStore.pendingRingLv || ev.minLevel,
      ringCount: ordinal - 1,
      targetId: ev._ringTargetId || eventStore._ringTargetId || '',
      targetName: ev._ringTargetName || eventStore._ringTargetName || ''
    })
    const skillName = `${source.replace(/^(十年|百年|千年|万年|十万年)/, '')}魂技`
    const skillDef = {
      damage: Math.round(20 + player.level * 2.2 + (Number(definition.statBonus?.attack) || 0) * 0.8),
      cost: 15 + player.rings.length * 5,
      cooldown: 3
    }
    const ring = {
      ringId: definition.id,
      skillId: `ring:${definition.id}:${ordinal}`,
      name: definition.name,
      tier: definition.tier,
      yearLabel: definition.name,
      color: definition.color || '#c9a84c',
      year: Number(choice?.ringYear) > 0 ? Math.round(Number(choice.ringYear)) : null,
      skill: skillName,
      skillType: '攻击',
      skillDesc: `凝聚第${ordinal}魂环之力发动攻击。`,
      skillAnim: 'burst',
      beastId: choice?.beastId || playerFacingBeastName(choice?.result?.battle, '') || null,
      source,
      bonus: {
        attack: Number(definition.statBonus?.attack) || 0,
        defense: Number(definition.statBonus?.defense) || 0,
        hp: Number(definition.statBonus?.hp) || 0
      },
      skillDef
    }
    player.rings.push(ring)
    player.skills.push({
      skillId: ring.skillId,
      name: ring.skill,
      type: ring.skillType,
      desc: ring.skillDesc,
      anim: ring.skillAnim,
      damage: skillDef.damage,
      cost: skillDef.cost,
      cooldown: skillDef.cooldown,
      ring: ordinal,
      source: ring.source,
      beastId: ring.beastId
    })
    eventStore.markEventDone(ev.id)
    recordEventDiscoveries(ev)
    eventStore._lastRingHuntLevel = ringMeta.ringLevel
    eventStore._lastRingOrdinal = ringMeta.ringOrdinal
    eventStore._lastRingTargetId = ringMeta.ringTargetId
    eventStore._lastRingTargetName = ringMeta.ringTargetName
    eventStore.pendingRingLv = null
    eventStore._ringHuntDeferredUntil = 0
    eventStore._ringHuntLevel = null
    eventStore._ringOrdinal = null
    eventStore._ringTargetId = null
    eventStore._ringTargetName = ''
    // 新魂环会抬高等级上限，立刻释放此前因魂环门槛暂存的经验。
    checkLevelUp()
    addDiaryEntry(`获得第${ordinal}魂环「${ring.name}」，习得魂技「${ring.skill}」。`, 'discovery')
    ui.notify(`成功获得第${ordinal}魂环：${ring.name}`, 'gold', 5000)
    return ring
  }

  function checkLevelUp() {
    const previousLevel = player.level
    const result = advanceExperience({
      level: player.level,
      exp: 0,
      overflowExp: player.overflowExp,
      ringCount: player.rings?.length || 0
    }, player.exp, expNeeded)
    player.level = result.level
    player.exp = result.exp
    player.overflowExp = result.overflowExp

    const levelsGained = result.levels?.length || 0
    if (levelsGained > 0) {
      const fs = finalStats()
      const healRatio = levelsGained >= 2 ? 1 : 0.5
      player.hp = Math.min(fs.maxHp, player.hp + Math.max(0, Math.round((fs.maxHp - player.hp) * healRatio)))
      player.spiritPower = getMaxSpiritPower()
      ui.notify(`等级提升至 Lv.${player.level}！`, 'success', 4000)
    }

    const ringCount = player.rings?.length || 0
    const gateLevel = RING_LEVELS[ringCount]
    eventStore.pendingRingLv = ringCount < 9 && player.level >= gateLevel ? gateLevel : null
    if (eventStore.pendingRingLv && previousLevel < eventStore.pendingRingLv) {
      ui.notify(`魂环位已解锁！可以猎杀第${ringCount + 1}魂环`, 'gold', 5000)
    }
    return result
  }

  function completeWorldAction() {
    eventStore._eventCount = (eventStore._eventCount || 0) + 1
    gameStore.advanceTime()

    // 减少动态事件冷却
    if (eventStore._dynCooldowns) {
      for (const id in eventStore._dynCooldowns) {
        if (eventStore._dynCooldowns[id] > 0) {
          eventStore._dynCooldowns[id]--
        }
      }
    }
  }

  function addDiaryEntry(text, type) {
    const phase = phaseForLevel(player.level)
    const phaseName = { academy: '学院篇', adventure: '冒险篇', master: '宗师篇', god: '封神篇' }[phase] || '学院篇'
    if (!Array.isArray(eventStore._diary)) eventStore._diary = []
    appendDiaryEntry(eventStore._diary, {
      turn: eventStore._eventCount || 0,
      level: player.level,
      phase: `${phaseName} · ${rankTitleForLevel(player.level)}`,
      text: text,
      type: type || 'event',
      time: Date.now()
    })
  }

  function currentMapLocation(locationId = gameStore._currentLocation) {
    return data.value.mapData.find(location => location.id === locationId || location.name === locationId) || null
  }

  function locationCodex(location) {
    if (!location) return null
    return data.value.locationData.find(item => item.id === location.name || item.name === location.name) || null
  }

  function explorationStates() {
    const normalized = normalizeLocationExplorationsByLocation(
      eventStore.locationExplorationsByLocation,
      eventStore.locationExploration
    )
    if (!eventStore.locationExplorationsByLocation || typeof eventStore.locationExplorationsByLocation !== 'object') {
      eventStore.locationExplorationsByLocation = normalized
    }
    return normalized
  }

  function explorationState(locationId = gameStore._currentLocation) {
    const map = explorationStates()
    const state = normalizeLocationExplorationState(locationId ? map[locationId] : null)
    if (state) return state
    const legacy = normalizeLocationExplorationState(eventStore.locationExploration)
    return legacy && (!locationId || legacy.locationId === locationId) ? legacy : null
  }

  function setExplorationState(state) {
    const normalized = normalizeLocationExplorationState(state)
    if (!normalized) return null
    const map = explorationStates()
    eventStore.locationExplorationsByLocation = {
      ...map,
      [normalized.locationId]: normalized
    }
    // 旧版浏览器流程和旧脚本读取的字段保留为“最近操作的地点”镜像。
    eventStore.locationExploration = normalized
    return normalized
  }

  function inProgressExplorations(excludeLocationId = '') {
    return Object.values(explorationStates())
      .map(normalizeLocationExplorationState)
      .filter(state => state && state.locationId !== excludeLocationId && isLocationExplorationInProgress(state))
  }

  function explorationEventFor(state, index = state?.stage || 0) {
    if (!state || !state.queuedEventIds?.[index]) return null
    const location = currentMapLocation(state.locationId)
      || data.value.mapData.find(item => item.id === state.locationId)
    if (!location) return null
    const eventId = state.queuedEventIds[index]
    const sourceId = state.sourceEventIds?.[index]
      || (eventId.startsWith('location_') ? null : eventId)
    const source = sourceId ? EVENTS.find(event => event.id === sourceId) : null
    const mode = locationExplorationMode(state.objectiveType)
    const stageIndex = Math.max(0, Math.min(mode.stages.length - 1, Number(state.stage) || index))
    const event = buildLocationExplorationEvent({
      location,
      stageIndex,
      player,
      codex: locationCodex(location),
      eventId,
      objectiveType: state.objectiveType,
      sourceEvent: source
    })
    if (!event) return null
    return {
      ...event,
      _locationExploration: true,
      _locationId: location.id,
      _explorationEventId: eventId,
      _explorationStageIndex: index,
      // 地点链不跳入其它链，也不让普通事件的 next 污染主线队列。
      choices: (event.choices || []).map(choice => {
        const copy = { ...choice }
        delete copy.next
        return copy
      })
    }
  }

  function showLocationAction(message = '', { arrivalSummary = false } = {}) {
    const location = currentMapLocation()
    if (!location) {
      nextEvent()
      return
    }
    currentLocationName.value = location.name
    const state = explorationState(location.id)
    const activeMode = locationExplorationMode(state?.objectiveType || 'local_exploration')
    const elsewhere = inProgressExplorations(location.id).map(item => {
      const progress = explorationProgress(item)
      return {
        ...item,
        progress,
        locationName: locationName(item.locationId),
        statusLabel: item.status === LOCATION_EXPLORATION_STATUSES.active ? '进行中' : '已暂停'
      }
    })
    const ringMeta = buildRingHuntMeta({
      pendingRingLv: eventStore.pendingRingLv,
      ringCount: player.rings?.length || 0,
      targetId: eventStore._ringTargetId || '',
      targetName: eventStore._ringTargetName || ''
    })
    const target = ringMeta.ringTargetId ? ringDestination(ringMeta.ringLevel) : null
    const ringReady = Boolean(eventStore.pendingRingLv && target?.id === location.id)
    const activeHere = Boolean(state && state.status === LOCATION_EXPLORATION_STATUSES.active && isLocationExplorationInProgress(state))
    const suspendedHere = Boolean(state && state.status === LOCATION_EXPLORATION_STATUSES.suspended && isLocationExplorationInProgress(state))
    const activeElsewhere = elsewhere.length > 0
    currentEvent.value = {
      id: `location_action_${location.id}`,
      name: `${location.name} · 地点行动`,
      location: location.name,
      locationAction: true,
      locationId: location.id,
      arrivalSummary: arrivalSummary && message ? message : '',
      activities: Array.isArray(location.events) ? location.events.slice(0, 8) : [],
      npcs: Array.isArray(location.npcs) ? location.npcs.slice(0, 8) : [],
      description: location.description || '',
      specialConditions: Array.isArray(location.specialConditions) ? location.specialConditions.slice(0, 4) : [],
      ringReady,
      ringOrdinal: ringMeta.ringOrdinal,
      ringLevel: ringMeta.ringLevel || 0,
      ringTargetId: ringMeta.ringTargetId,
      ringTargetName: ringMeta.ringTargetName,
      ringLabel: ringReady ? `执行第${ringMeta.ringOrdinal}魂环猎取` : '',
      exploration: state,
      explorationObjectiveType: activeMode.id,
      explorationModeLabel: activeMode.label,
      explorationModeDescription: activeMode.description,
      activeHere,
      suspendedHere,
      activeElsewhere,
      explorationsElsewhere: elsewhere,
      explorationLocationName: elsewhere[0]?.locationName || location.name,
      stage: state && isLocationExplorationInProgress(state) ? state.stage : 0,
      stageCount: activeMode.stages.length
    }
    sceneState.value = 'location'
    resultText.value = message || (activeHere
      ? `你正在「${location.name}」深入调查。地点探索已完成 ${state.completedEventIds.length}/${state.queuedEventIds.length} 个阶段，下一步会从上次进度继续。`
      : suspendedHere
        ? `你在「${location.name}」的${state.modeLabel}已暂停，进度保留为 ${state.completedEventIds.length}/${state.queuedEventIds.length} 个阶段。点击“继续深入”即可恢复。`
        : activeElsewhere
          ? `「${elsewhere[0].locationName}」仍有未完成的地点行动。当前「${location.name}」不会被锁定，你可以继续当地行动，也可以先处理暂停的探索。`
        : `你已抵达「${location.name}」。这里有独立的当地行动、人物和委托；完成一轮探索后会回到此界面。`)
    resultRewards.value = []
  }

  function enterLocation(message = '') {
    if (battleSystem.isActive()) return
    showLocationAction(message, { arrivalSummary: Boolean(message) })
  }

  function startLocationExploration(objectiveType = 'local_exploration') {
    if (battleSystem.isActive()) return false
    const location = currentMapLocation()
    if (!location) {
      ui.notify('当前地点资料尚未加载', 'warning')
      return false
    }
    const current = explorationState(location.id)
    const requestedMode = locationExplorationMode(objectiveType)
    if (isLocationExplorationInProgress(current)) {
      const currentMode = locationExplorationMode(current.objectiveType)
      ui.notify(
        current.status === LOCATION_EXPLORATION_STATUSES.suspended
          ? `「${location.name}」的${currentMode.label}已暂停，请点击“继续深入”恢复`
          : `当前正在进行「${currentMode.label}」，请先完成这轮行动`,
        'warning',
        4000
      )
      showLocationAction()
      return false
    }
    const state = buildLocationExplorationQueue({
      location,
      mapLocations: data.value.mapData,
      events: EVENTS,
      player,
      game: gameStore,
      eventStore,
      objectiveType: requestedMode.id,
      cycle: `${eventStore._eventCount || 0}_${gameStore._locationProgress?.[location.id]?.rounds || 0}`
    })
    if (!state) return false
    state.objectiveType = locationExplorationMode(state.objectiveType || requestedMode.id).id
    state.status = LOCATION_EXPLORATION_STATUSES.active
    state.active = true
    setExplorationState(state)
    showLocationExplorationStage()
    saveGame()
    return true
  }

  function resumeLocationExploration() {
    if (battleSystem.isActive()) return false
    const state = explorationState()
    if (!isLocationExplorationInProgress(state)) {
      showLocationAction()
      return false
    }
    if (state.locationId !== gameStore._currentLocation) {
      showLocationAction(`请返回「${locationName(state.locationId)}」继续这轮地点探索。`)
      return false
    }
    state.status = LOCATION_EXPLORATION_STATUSES.active
    state.active = true
    state.suspendedAtLocationId = ''
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    setExplorationState(state)
    showLocationExplorationStage()
    saveGame()
    return true
  }

  function showLocationExplorationStage() {
    const state = explorationState()
    if (!isLocationExplorationInProgress(state) || state.status !== LOCATION_EXPLORATION_STATUSES.active) {
      showLocationAction()
      return
    }
    if (state.locationId !== gameStore._currentLocation) {
      showLocationAction(`请返回「${locationName(state.locationId)}」继续这轮地点探索。`)
      return
    }
    if (state.stage >= state.queuedEventIds.length) {
      finishLocationExploration()
      return
    }
    const event = explorationEventFor(state)
    if (!event) {
      ui.notify('地点探索事件数据缺失，本轮已安全暂停', 'error', 5000)
      showLocationAction()
      return
    }
    showEvent(event, { locationExploration: true })
  }

  function completeLocationStage(event) {
    if (!isLocationExplorationEvent(event)) return
    const state = explorationState(event._locationId)
    if (!isLocationExplorationInProgress(state) || state.locationId !== event._locationId) return
    const eventId = event._explorationEventId || event.id
    if (!state.completedEventIds.includes(eventId)) state.completedEventIds.push(eventId)
    const stageIndex = Math.max(0, Number(event._explorationStageIndex) || state.stage)
    state.stage = Math.max(state.stage, stageIndex + 1)
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    setExplorationState(state)
  }

  function finishLocationExploration() {
    const state = explorationState()
    const location = state ? currentMapLocation(state.locationId) : currentMapLocation()
    if (!state || !location) {
      showLocationAction()
      return
    }
    const mode = locationExplorationMode(state.objectiveType)
    const level = Math.max(1, Number(player.level) || 1)
    const rewardInput = mode.rewardKey === 'commission'
      ? { gold: 70 + Math.min(120, level * 2) }
      : mode.rewardKey === 'contact'
        ? { fate: 2, exp: 20 + Math.min(50, level) }
        : { exp: 35 + Math.min(60, level * 2) }
    const reward = applyResultRewards(rewardInput)
    const prior = gameStore._locationProgress?.[location.id] || {}
    const rounds = Math.max(0, Number(prior.rounds) || 0) + 1
    const progress = Math.min(100, Math.max(0, Number(prior.exploration) || 0) + 20)
    const modeProgress = {
      exploration: progress,
      clues: Math.max(0, Number(prior.clues) || 0) + (mode.id === 'local_exploration' ? 1 : 0),
      reputation: Math.max(0, Number(prior.reputation) || 0) + (mode.id === 'local_commission' ? 2 : 0),
      commissions: Math.max(0, Number(prior.commissions) || 0) + (mode.id === 'local_commission' ? 1 : 0),
      contacts: Math.max(0, Number(prior.contacts) || 0) + (mode.id === 'local_contact' ? 1 : 0),
      relationships: Math.max(0, Number(prior.relationships) || 0) + (mode.id === 'local_contact' ? 1 : 0),
      information: Math.max(0, Number(prior.information) || 0) + (mode.id === 'local_contact' ? 1 : 0)
    }
    if (mode.id === 'local_contact') {
      const npc = Array.isArray(location.npcs) ? location.npcs[0] : null
      if (npc) {
        gameStore.meetNpc(npc)
        gameStore.setNpcRelation(npc, Math.max(1, Number(gameStore._npcRelations?.[npc]) || 0) + 1)
      }
    }
    gameStore._locationProgress = {
      ...(gameStore._locationProgress || {}),
      [location.id]: {
        rounds,
        ...modeProgress,
        lastObjectiveType: mode.id,
        lastCompletedAtEventCount: eventStore._eventCount || 0
      }
    }
    const progressText = mode.id === 'local_commission'
      ? `委托记录 ${modeProgress.commissions} 次，地域声望 ${modeProgress.reputation}`
      : mode.id === 'local_contact'
        ? `人物关系 ${modeProgress.relationships}，新情报 ${modeProgress.information} 条`
        : `探索度 ${modeProgress.exploration}%，新增线索 ${modeProgress.clues} 条`
    const summary = `你完成了「${location.name}」的${mode.label}，${progressText}。${reward.list.length ? `<br><span class="hl-gold">${reward.list.join('　')}</span>` : ''}`
    state.status = LOCATION_EXPLORATION_STATUSES.completed
    state.active = false
    state.stage = state.queuedEventIds.length
    state.completedAtEventCount = eventStore._eventCount || 0
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    state.suspendedAtLocationId = ''
    state.lastSummary = summary.replace(/<[^>]*>/g, '')
    setExplorationState(state)
    addDiaryEntry(`完成「${location.name}」第${rounds}轮地点探索，探索度提升至${progress}%。`, 'discovery')
    saveGame()
    showLocationAction(summary)
  }

  function abandonLocationExploration(locationId = '') {
    if (battleSystem.isActive()) return false
    const targetId = locationId || inProgressExplorations().at(0)?.locationId || ''
    const state = explorationState(targetId)
    if (!isLocationExplorationInProgress(state)) {
      ui.notify('没有可放弃的未完成地点探索', 'info')
      return false
    }
    const name = locationName(state.locationId)
    state.status = LOCATION_EXPLORATION_STATUSES.abandoned
    state.active = false
    state.abandonedAtEventCount = eventStore._eventCount || 0
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    state.suspendedAtLocationId = ''
    state.lastSummary = `已放弃「${name}」的${state.modeLabel}，未领取本轮完成奖励。`
    setExplorationState(state)
    addDiaryEntry(state.lastSummary, 'event')
    saveGame()
    ui.notify(state.lastSummary, 'info', 4500)
    showLocationAction()
    return true
  }

  // ==================== 核心: nextEvent ====================

  function locationName(locationId) {
    return data.value.mapData.find(location => location.id === locationId)?.name || locationId
  }

  function showTravelGuide(kind, title, targetId) {
    const targetName = locationName(targetId)
    const label = kind === 'ring' ? '猎环前置' : '主线行程'
    showContinue({
      id: `${kind}_travel_${targetId}`,
      name: `${label} · ${title}`,
      _travelGuideType: kind,
      targetId
    }, `新的目标位于「${targetName}」，不在当前区域。剧情不会将你凭空传送过去；请打开万象地图，沿相邻地点前往目标。若想先历练，直接点击“继续前行”可暂缓两次行动。`)
  }

  function nextEvent() {
    if (battleSystem.isActive()) return
    if (player.finished) {
      showEnding()
      return
    }

    // 满级且完成最终决战后进入结局；最终决战本身不能被等级条件绕过。
    if (player.level >= 100 && eventStore.doneEvents.includes('final_evil')) {
      showEnding()
      return
    }

    // 当前地点有未完成队列时恢复地点行动界面；其它地点的暂停队列不影响当前地点。
    if (isLocationExplorationInProgress(explorationState())) {
      showLocationAction()
      return
    }

    // 0. 新角色序章与早年经历。旧存档迁移后已完成的节点不会重播。
    if (!eventStore._prologueDone) {
      showEvent(buildPrologueEvent())
      return
    }
    if (!eventStore._earlyLifeDone) {
      const intro = buildEarlyLifeEvents().find(item => !eventStore.doneEvents.includes(item.id))
      if (intro) {
        showEvent(intro)
        return
      }
      eventStore._earlyLifeDone = true
      if (eventStore._enrollmentComplete && !eventStore._firstClassDone) {
        eventStore._introPendingEvent = 'first_class'
      }
      saveGame()
    }

    // 1. 第一堂课
    if (eventStore._enrollmentComplete && !eventStore._firstClassDone) {
      const firstClass = EVENTS.find(e => e.id === 'first_class')
      if (firstClass) {
        showEvent(firstClass)
        return
      }
    }

    // 2. 魂环猎杀
    if (eventStore.pendingRingLv && (eventStore._ringHuntDeferredUntil || 0) <= (eventStore._eventCount || 0)) {
      const ringEventId = 'ring_hunt_' + eventStore.pendingRingLv
      const ev = EVENTS.find(e => e.id === ringEventId)
      if (ev) {
        const targetId = ringDestination(eventStore.pendingRingLv)?.id
        if (targetId && gameStore._currentLocation !== targetId) {
          showTravelGuide('ring', ev.name, targetId)
          return
        }
        // 纯引擎测试和极早期旧档可能还没有加载地图 JSON；保持正式猎环
        // 入口可用，避免地点行动界面在缺少地图资料时递归回 nextEvent。
        if (!currentMapLocation(targetId || gameStore._currentLocation)) {
          showEvent(ev, { isRingHunt: true })
          return
        }
        const ringMeta = buildRingHuntMeta({
          pendingRingLv: eventStore.pendingRingLv,
          ringCount: player.rings?.length || 0,
          targetId,
          targetName: locationName(targetId)
        })
        showLocationAction(`你已抵达「${ringMeta.ringTargetName}」。这是当前地点行动的首要任务，点击“执行第${ringMeta.ringOrdinal}魂环猎取”即可进入正式猎环流程。`)
        return
      }
    }

    // 3. 主线里程碑
    const milestone = nextMainStoryMilestone()
    if (milestone && player.level >= milestone.minLevel && (eventStore._storyMilestoneDeferredUntil || 0) <= (eventStore._eventCount || 0)) {
      const source = EVENTS.find(e => e.id === milestone.id)
      if (source) {
        if (milestone.targetId && gameStore._currentLocation !== milestone.targetId) {
          showTravelGuide('story', milestone.name, milestone.targetId)
          return
        }
        showEvent(source, { isMainStory: true })
        return
      }
    }

    // 4. 连锁事件（待触发的）
    if (eventStore._pendingChain && CHAINED_EVENTS[eventStore._pendingChain]) {
      const pending = adaptEvent(CHAINED_EVENTS[eventStore._pendingChain], { spiritMeta: player.spirit || {} })
      if (isEventEligible(pending, eventContext({ source: 'chained', locationMatches: true }))) {
        eventStore._pendingChain = null
        showEvent(normalizeEvent(pending, true))
        return
      }
    }

    // 5. 动态事件 (35% 概率)
    const dynamicContext = eventContext()
    const dynamic = checkDynamicEvents(dynamicContext)
    if (dynamic && Math.random() < 0.35) {
      if (dynamic.cooldown) {
        if (!eventStore._dynCooldowns) eventStore._dynCooldowns = {}
        eventStore._dynCooldowns[dynamic.id] = dynamic.cooldown
      }
      const ev = normalizeEvent(dynamic, true)
      showEvent(ev)
      return
    }

    // 6. 随机连锁事件 (25% 概率)
    const chained = checkChainedEvents()
    if (chained && Math.random() < 0.25) {
      const ev = normalizeEvent(chained, true)
      showEvent(ev)
      return
    }

    // 7. 普通事件池
    const pool = availableEvents()
    if (pool.length === 0) {
      // 没有可用事件，休整
      completeWorldAction()
      const fs = finalStats()
      player.hp = Math.min(player.hp + 50, fs.maxHp)
      player.spiritPower = Math.min(player.spiritPower + 30, getMaxSpiritPower())
      const reward = applyResultRewards({ exp: 25 })
      addDiaryEntry('在当前地区休整一日，恢复状态并继续修炼。', 'event')
      showContinue(null, `当前地区暂时没有与你阶段相符的新事件。你休整一日，精气神与魂力都得到恢复，并继续积累了修炼经验。${reward.list.length ? `<br><span class="hl-gold">${reward.list.join('　')}</span>` : ''}`)
      saveGame()
      return
    }

    // 加权随机选取
    const candidates = recentCooldown(pool)
    const weighted = []
    candidates.forEach(e => {
      const baseW = e.weight || 1
      const matchBonus = eventMatchBonus(e)
      const totalW = Math.max(1, baseW + matchBonus)
      for (let i = 0; i < totalW; i++) weighted.push(e)
    })
    const ev = pick(weighted)
    showEvent(ev)
  }

  function normalizeEvent(source, isChain) {
    const ev = { ...source }
    if (!Array.isArray(ev.text)) ev.text = [ev.text]
    if (!ev.choices) ev.choices = []
    if (isChain) {
      ev._chain = true
      ev.unique = true
    }
    return ev
  }

  // ==================== 场景展示 ====================

  function showEvent(ev, options = {}) {
    const normalized = adaptEvent(ev, { spiritMeta: player.spirit || {} })
    const trainingPrepared = prepareFirstHuntEvent(normalized, player)
    const prepared = resolveEventAsset(prepareFirstRingEvent(trainingPrepared, player, finalStats(), combatStore.huntingKnowledge))
    const ringMeta = options.isRingHunt && prepared.ring
      ? buildRingHuntMeta({
        pendingRingLv: eventStore.pendingRingLv || prepared.minLevel,
        ringLevel: eventStore.pendingRingLv || prepared.minLevel,
        ringCount: player.rings?.length || 0,
        targetId: eventStore._ringTargetId || '',
        targetName: eventStore._ringTargetName || ''
      })
      : null
    if (ringMeta) {
      eventStore._ringHuntLevel = ringMeta.ringLevel
      eventStore._ringOrdinal = ringMeta.ringOrdinal
      eventStore._ringTargetId = ringMeta.ringTargetId
      eventStore._ringTargetName = ringMeta.ringTargetName
    }
    currentEvent.value = {
      ...prepared,
      ...(ringMeta || {}),
      ...(options.isMainStory ? { _mainStory: true } : {}),
      ...(options.isRingHunt ? { _ringHunt: true } : {})
    }
    sceneState.value = 'event'
    resultText.value = ''
    resultRewards.value = []
    if (ringMeta) saveGame()
  }

  function showContinue(ev, text) {
    currentEvent.value = ev
    sceneState.value = 'continue'
    resultText.value = text || ''
    resultRewards.value = []
  }

  function buildTravelEnemy(encounter) {
    if (encounter.id === 'ambush_beast') {
      const level = Math.max(1, player.level + rand(-2, 2))
      return {
        id: 'travel_wild_beast', beastId: '野生魂兽', name: '野生魂兽', icon: '🐺', isBeast: true, isNpc: false,
        maxHp: 30 + level * 12, hp: 30 + level * 12,
        attack: 8 + level * 3, defense: 4 + level * 2, speed: 6 + level * 2,
        exp: 20 + level * 5, gold: 10 + level * 3
      }
    }
    if (encounter.id === 'rival_soul_master') {
      const level = Math.max(1, player.level)
      return {
        id: 'travel_soul_master', name: '魂师挑战者', icon: '⚔️', isNpc: true,
        maxHp: Math.round(40 + level * 15), hp: Math.round(40 + level * 15),
        attack: Math.round(10 + level * 3.5), defense: Math.round(5 + level * 2.5), speed: Math.round(8 + level * 2),
        exp: 30 + level * 8, gold: 20 + level * 5
      }
    }
    const level = Math.max(1, player.level + 3)
    return {
      id: 'travel_rare_beast', beastId: '精英魂兽', name: '精英魂兽', icon: '👹', isBeast: true, isNpc: false, isBoss: true, special: '精英',
      maxHp: Math.round(60 + level * 20), hp: Math.round(60 + level * 20),
      attack: Math.round(15 + level * 4), defense: Math.round(8 + level * 3), speed: Math.round(10 + level * 2),
      exp: 50 + level * 12, gold: 50 + level * 8
    }
  }

  /**
   * 将一次已确认发生的地图旅行遭遇转换为 Vue 事件。
   * 旅行在 MapPage 已扣费并推进时间，因此事件结算必须跳过第二次 world action。
   */
  function triggerTravelEncounter(arrival = {}) {
    const available = TRAVEL_ENCOUNTERS.filter(encounter => player.level >= encounter.minLevel)
    if (!available.length) return false

    const totalWeight = available.reduce((sum, encounter) => sum + encounter.weight, 0)
    let roll = Math.random() * totalWeight
    let encounter = available[available.length - 1]
    for (const candidate of available) {
      roll -= candidate.weight
      if (roll <= 0) {
        encounter = candidate
        break
      }
    }

    const targetName = arrival.targetName || currentLocationName.value || '新的地域'
    const fromName = arrival.fromName || '旅途'
    const plan = arrival.destinationPlan && typeof arrival.destinationPlan === 'object'
      ? arrival.destinationPlan
      : null
    const lead = buildTravelArrivalSummary({ ...arrival, targetName, fromName, destinationPlan: plan })
    const ev = {
      id: `travel_encounter_${encounter.id}`,
      name: `旅途遭遇 · ${targetName}`,
      location: targetName,
      text: [lead, encounter.text],
      _ephemeral: true,
      _worldActionAlreadyCounted: true,
      _travelArrival: {
        targetId: arrival.targetId || gameStore._currentLocation,
        targetName,
        destinationPlan: plan,
        arrivalSummary: buildTravelArrivalSummary({ ...arrival, targetName, fromName, destinationPlan: plan })
      },
      choices: []
    }

    if (encounter.type === 'battle') {
      const enemy = buildTravelEnemy(encounter)
      ev.choices = [{
        text: encounter.id === 'rival_soul_master' ? '接受切磋' : '迎战',
        result: {
          battle: enemy,
          exp: enemy.exp,
          gold: enemy.gold,
          text: `你战胜了「${enemy.name}」，清理好战场后继续赶路。`
        }
      }]
    } else if (encounter.id === 'spirit_fragment') {
      ev.choices = [{ text: '吸收灵力碎片', result: { mp: 20, text: '碎片化作温暖的魂光，融入你的经脉。' } }]
    } else if (encounter.id === 'ancient_cache') {
      const gold = 100 + player.level * 10
      ev.choices = [{ text: '打开藏宝箱', result: { gold, text: `古老的锁扣应声而开，你找到了${gold}金币。` } }]
    } else if (encounter.type === 'merchant') {
      const mysteryRewards = [
        { gold: 320, text: '宝箱里藏着一袋旧时代金币。' },
        { maxHp: 5, text: '宝箱中的生命晶石融入体内，永久强化了体魄。' },
        { item: { name: '稀有魂力药剂', type: 'mp', value: 60, count: 1 }, text: '宝箱中是一瓶保存完好的稀有魂力药剂。' }
      ]
      const mystery = pick(mysteryRewards)
      ev.choices = [
        { text: '购买初级恢复丹（50金币）', cond: { gold: 50 }, cost: { gold: 50 }, result: { item: { name: '初级恢复丹', type: 'heal', value: 30, count: 1 }, text: '你买下了一枚初级恢复丹。' } },
        { text: '购买魂力药水（80金币）', cond: { gold: 80 }, cost: { gold: 80 }, result: { item: { name: '魂力药水', type: 'mp', value: 20, count: 1 }, text: '你买下了一瓶魂力药水。' } },
        { text: '购买神秘宝箱（200金币）', cond: { gold: 200 }, cost: { gold: 200 }, result: mystery },
        { text: '谢绝行商，继续赶路', result: { text: '你谢过行商，重新踏上旅途。' } }
      ]
    } else {
      ev.choices = [
        { text: '为旅人指明道路', result: { gold: 20, text: '旅人感谢你的帮助，赠予你20金币。' } },
        { text: '谨慎离开', result: { text: '你没有停留太久，确认四周安全后继续赶路。' } }
      ]
    }

    showEvent(ev)
    ui.notify('旅途中触发了随机遭遇', 'warning', 3000)
    return true
  }

  function recordEventDiscoveries(ev) {
    if (!ev) return
    const location = classifyEventLocation(ev.location, data.value.mapData)
    if (location.scope === 'mapped' && location.id) gameStore.setLocation(location.id)
    for (const npcId of Array.isArray(ev.npcIds) ? ev.npcIds : []) gameStore.meetNpc(npcId)
    const text = `${ev.name || ''} ${ev.location || ''} ${(Array.isArray(ev.text) ? ev.text : [ev.text || '']).join(' ')}`
    for (const npc of data.value.npcData || []) {
      if (npc?.id && npc?.name && text.includes(npc.name)) gameStore.meetNpc(npc.id)
    }
  }

  function markEventCompleted(ev) {
    if (!ev?.id || ev.ring || ev._ephemeral) return
    eventStore.markEventDone(ev.id)
    if (ev._locationSourceEventId && !eventStore._recentEvents.includes(ev._locationSourceEventId)) {
      eventStore._recentEvents.push(ev._locationSourceEventId)
      if (eventStore._recentEvents.length > 15) eventStore._recentEvents.shift()
    }
    recordEventDiscoveries(ev)
  }

  function chooseEnding() {
    const G = createGProxy()
    const special = ENDINGS.find(ending => {
      if (!ending.req || player.fatePoints < ending.minFate) return false
      try { return Boolean(ending.req(G)) } catch { return false }
    })
    if (special) return special
    const regular = ENDINGS
      .filter(ending => !ending.req)
      .slice()
      .sort((a, b) => b.minFate - a.minFate)
    return regular.find(ending => player.fatePoints >= ending.minFate) || ENDINGS[ENDINGS.length - 1]
  }

  function showEnding() {
    const ending = chooseEnding()
    if (!ending) return
    player.finished = true
    currentEvent.value = {
      id: 'ending',
      name: `【结局】${ending.title}`,
      text: ending.text || [],
      ending
    }
    resultText.value = ''
    resultRewards.value = []
    sceneState.value = 'ending'
    saveGame()
  }

  // ==================== 选择处理 ====================

  function applyChoice(ev, choice, idx) {
    if (!ev || !choice) return

    // 扣除金币花费
    if (choice.cost?.gold) {
      player.addGold(-choice.cost.gold)
    }

    // 临时旅行遭遇不应污染主线抉择与结局倾向。
    if (!ev._ephemeral) {
      eventStore.recordChoice(ev.id, String.fromCharCode(65 + idx))
      if (choice.id) {
        eventStore._storyDecisions[ev.id] = choice.id
      }
      if (choice.path) {
        eventStore._storyPath.push(choice.path)
      }
    }
    if (choice.after === 'registered') eventStore._registeredAtHall = true
    if (choice.after === 'recommended') eventStore._academyRecommendation = choice.id || null
    if (choice.after === 'enrolled') {
      eventStore._enrollmentComplete = true
      eventStore._introPendingEvent = 'first_class'
      gameStore.setLocation('shrek_academy')
    }

    // 第一堂课特殊处理
    if (ev.id === 'first_class') {
      eventStore._firstClassDone = true
      eventStore._introPendingEvent = null
    }

    // 记录最近事件
    if (!eventStore._recentEvents) eventStore._recentEvents = []
    eventStore._recentEvents.push(ev.id)
    if (eventStore._recentEvents.length > 15) eventStore._recentEvents.shift()

    // 处理连锁跳转
    if (choice.next) {
      eventStore._pendingChain = choice.next
    }

    // 执行 effect 函数
    let effectText = ''
    if (typeof choice.effect === 'function') {
      try {
        const G = createGProxy()
        effectText = choice.effect(G) || ''
      } catch (e) {
        console.error('事件效果执行失败:', e)
        effectText = '这次尝试没有产生预期效果。'
      }
    }

    // 应用结果奖励
    const r = normalizeLegacyHealthResult(choice.result || {})
    const resolvedResult = effectText || choice.reply
      ? { ...r, text: effectText || choice.reply }
      : r

    // 战斗检查
    if (resolvedResult.battle) {
      // 启动正式战斗系统
      sceneState.value = 'battle'
      battleSystem.startEventBattle(ev, resolvedResult, (result) => {
        if (result.type === 'victory') {
          const rewardResult = { ...resolvedResult }
          delete rewardResult.battle
          if (ev.ring) {
            const overflowBefore = Number(player.overflowExp) || 0
            const ring = grantRingForEvent(ev, choice, idx)
            if (ring) {
              const released = Math.max(0, overflowBefore - (Number(player.overflowExp) || 0))
              const reward = applyResultRewards(rewardResult)
              result.gains = [
                ...(result.gains || []),
                `获得${ring.name}`,
                ...(released > 0 ? [`释放暂存经验+${released}`] : []),
                ...reward.list
              ]
            }
          } else {
            markEventCompleted(ev)
            completeLocationStage(ev)
            if (ev.id === 'final_evil') eventStore._dynamicFlags._bossKilled = true
            const reward = applyResultRewards(rewardResult)
            result.gains = [...(result.gains || []), ...reward.list]
          }
        } else if (ev.ring) {
          eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
        }
        handleBattleEnd(result)
      })
      return
    }

    markEventCompleted(ev)
    completeLocationStage(ev)
    const overflowBefore = Number(player.overflowExp) || 0
    const ring = ev.ring ? grantRingForEvent(ev, choice, idx) : null
    if (ev.ring && !ring) {
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
    }
    const reward = applyResultRewards(resolvedResult)
    if (ring) {
      const released = Math.max(0, overflowBefore - (Number(player.overflowExp) || 0))
      if (released > 0) reward.list.unshift(`释放暂存经验+${released}`)
      reward.list.unshift(`获得${ring.name}`)
    }
    if (!ev._worldActionAlreadyCounted) completeWorldAction()

    // 添加日记
    const diaryText = effectText || (resolvedResult.text || '')
    const cleanText = String(diaryText).replace(/\{name\}|\{spirit\}/g, '').replace(/<[^>]*>/g, '')
    addDiaryEntry(`经历事件「${ev.name}」：${cleanText}`, 'event')

    // 显示继续页面
    const displayText = resolvedResult.text || effectText || '你完成了一次经历。'
    const rewardSummary = reward.list.length > 0
      ? `<br><span class="hl-gold">${reward.list.join('　')}</span>`
      : ''
    showContinue(ev, displayText + rewardSummary)

    saveGame()
  }

  // ==================== 存档 ====================

  function saveGame() {
    try {
      saveToLocal()
    } catch (e) {
      console.warn('自动存档失败', e)
      ui.notify(`自动存档失败：${e.message}`, 'error', 5000)
    }
  }

  // ==================== 休息 ====================

  function rest() {
    const fs = finalStats()
    const healed = Math.max(0, Math.min(50, fs.maxHp - player.hp))
    player.heal(healed)
    player.spiritPower = Math.min(player.spiritPower + 20, getMaxSpiritPower())
    ui.notify(`休息片刻，恢复 ${healed} 点生命与 20 点魂力`, 'success')
    completeWorldAction()
    addDiaryEntry('原地休息，恢复了一些生命与魂力。', 'event')
    saveGame()
  }

  // ==================== 探索 ====================

  function explore() {
    nextEvent()
  }

  // ==================== 猎杀魂兽 ====================

  function hunt() {
    // 检查是否有待猎杀的魂环
    if (eventStore.pendingRingLv) {
      const ringEventId = 'ring_hunt_' + eventStore.pendingRingLv
      const ev = EVENTS.find(e => e.id === ringEventId)
      if (ev) {
        const targetId = ringDestination(eventStore.pendingRingLv)?.id
        if (targetId && gameStore._currentLocation !== targetId) {
          showTravelGuide('ring', ev.name, targetId)
          return
        }
        showEvent(ev, { isRingHunt: true })
        return
      }
    }

    // 没有待猎杀的魂环,提示
    const ringCount = player.rings?.length || 0
    if (ringCount >= 9) {
      ui.notify('你已拥有全部九个魂环', 'info')
      return
    }
    const nextRingLevel = RING_LEVELS[ringCount]
    if (player.level < nextRingLevel) {
      ui.notify(`需要 Lv.${nextRingLevel} 才能猎杀第${ringCount + 1}魂环`, 'info')
      return
    }
    ui.notify('暂无可猎杀的魂兽', 'info')
  }

  function resumeRingHunt() {
    if (!eventStore.pendingRingLv) {
      ui.notify('当前没有待完成的猎环目标', 'info')
      return
    }
    if (battleSystem.isActive()) {
      ui.notify('请先完成当前战斗，再继续猎环目标', 'info')
      return
    }
    eventStore._ringHuntDeferredUntil = 0
    saveGame()
    hunt()
  }

  function deferRingHunt() {
    if (!eventStore.pendingRingLv) return
    if (battleSystem.isActive()) {
      ui.notify('战斗中不能挂起猎环目标', 'info')
      return
    }
    const wasRingFlow = Boolean(currentEvent.value?._ringHunt || currentEvent.value?._travelGuideType === 'ring')
    eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 3
    saveGame()
    ui.notify('猎环目标已挂在侧边，完成三次行动后会再次主动提醒', 'info', 5000)
    if (wasRingFlow) {
      showContinue(
        { id: 'ring_hunt_deferred', name: '猎环目标已挂起' },
        '目标仍固定在左侧，不会丢失。你可以先完成其他历练，或随时点击“立即继续”返回猎环路线。'
      )
    }
  }

  // ==================== 继续前行 ====================

  function continueAction() {
    if (player.finished) {
      showEnding()
      return
    }
    if (currentEvent.value?._travelArrival) {
      const arrival = currentEvent.value._travelArrival
      enterLocation(arrival.arrivalSummary || `抵达目标：${arrival.targetName || currentLocationName.value}。先查看地点行动，再决定是否继续深入。`)
      return
    }
    if (isLocationExplorationEvent(currentEvent.value)) {
      const state = explorationState(currentEvent.value._locationId || gameStore._currentLocation)
      if (!state) {
        showLocationAction()
        return
      }
      if (state.stage >= state.queuedEventIds.length) finishLocationExploration()
      else if (state.status === LOCATION_EXPLORATION_STATUSES.active && state.locationId === gameStore._currentLocation) showLocationExplorationStage()
      else showLocationAction()
      return
    }
    if (currentEvent.value?._ringHunt && !eventStore.pendingRingLv) {
      showLocationAction(buildRingCompletionMessage({
        ringLevel: currentEvent.value._ringHuntLevel || eventStore._lastRingHuntLevel,
        ringOrdinal: currentEvent.value._ringOrdinal || eventStore._lastRingOrdinal,
        ringTargetName: currentEvent.value._ringTargetName || eventStore._lastRingTargetName
      }))
      return
    }
    const guideType = currentEvent.value?._travelGuideType
    if (guideType === 'ring') {
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
    } else if (guideType === 'story') {
      eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 2
    }
    if (guideType) saveGame()
    nextEvent()
  }

  // ==================== 暂缓 ====================

  function deferAction() {
    eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 3
    ui.notify('暂缓当前事件，稍后再来', 'info')
    nextEvent()
  }

  // ==================== 战斗结束处理 ====================

  function handleBattleEnd(result) {
    // result: { type: 'victory'|'defeat'|'escape', text, gains, exp, gold }
    if (!currentEvent.value?._worldActionAlreadyCounted) completeWorldAction()
    addDiaryEntry(`经历战斗：${result.text}`, 'event')
    checkLevelUp()

    const gainsSummary = result.gains && result.gains.length > 0
      ? `<br><span class="hl-gold">${result.gains.join('　')}</span>`
      : ''
    showContinue(currentEvent.value, result.text + gainsSummary)
    saveGame()
  }

  return {
    sceneState,
    currentEvent,
    resultText,
    resultRewards,
    currentLocationName,
    canHunt,
    battleActive,
    enterLocation,
    showLocationAction,
    startLocationExploration,
    resumeLocationExploration,
    abandonLocationExploration,
    nextEvent,
    applyChoice,
    showEvent,
    showContinue,
    triggerTravelEncounter,
    explore,
    rest,
    hunt,
    resumeRingHunt,
    deferRingHunt,
    continueAction,
    deferAction,
    handleBattleEnd,
    checkCond,
    availableEvents,
    checkDynamicEvents,
    checkChainedEvents,
    currentPhase,
    applyResultRewards,
    checkLevelUp,
    saveGame,
    showEnding
  }
}
