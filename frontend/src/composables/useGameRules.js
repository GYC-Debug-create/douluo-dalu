/**
 * 游戏规则计算 composable
 * 包含属性计算、等级提升、阶段名称等核心公式
 * 从 game.js 的 calcBaseStats / previewStats / finalStats / getMaxSpiritPower 迁移
 */
import { computed } from 'vue'
import { getActivePinia } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { TITLES } from '@/data/game-data'
import { experienceNeededForLevel, rankTitleForLevel, RING_LEVELS, phaseForLevel } from '@/engine/rules'
import { relationshipBonuses } from '@/engine/relationship-rules'

const TIER_NAMES = { low: '低级武魂', mid: '中级武魂', high: '高级武魂', top: '顶级武魂', god: '神级武魂' }
const TIER_COLORS = { low: '#94a3b8', mid: '#22c55e', high: '#3b82f6', top: '#a855f7', god: '#fbbf24' }

const FORMATIONS = [
  { id: 'none', name: '无阵法', attack: 0, defense: 0, speed: 0, spirit: 0 },
  { id: 'attack', name: '冲锋阵', attack: 0.15, defense: -0.10, speed: 0, spirit: 0 },
  { id: 'defense', name: '铁桶阵', attack: -0.05, defense: 0.20, speed: 0, spirit: 0 },
  { id: 'speed', name: '疾风阵', attack: 0, defense: 0, speed: 0.25, spirit: 0 },
  { id: 'spirit', name: '聚灵阵', attack: 0, defense: 0, speed: 0, spirit: 0.30 }
]

function runtimeFlag(key, fallback) {
  const event = useEventStore()
  return event._dynamicFlags && event._dynamicFlags[key] !== undefined
    ? event._dynamicFlags[key]
    : fallback
}

function activeFormation() {
  const id = runtimeFlag('_activeFormation', 'none')
  return FORMATIONS.find(formation => formation.id === id) || FORMATIONS[0]
}

function activeTitle() {
  const id = runtimeFlag('_activeTitle', 'novice')
  return TITLES.find(title => title.id === id) || TITLES.find(title => title.id === 'novice') || null
}

function titleBonus() {
  return activeTitle()?.bonus || {}
}

function npcRelationBonuses() {
  const game = useGameStore()
  return relationshipBonuses(game._npcRelations || {})
}

function phaseName(level) {
  const phase = phaseForLevel(level)
  return { academy: '初级学院', adventure: '进阶学院', master: '历练期', god: '封神期' }[phase] || '初级学院'
}

function levelCapForRings(ringCount) {
  if (ringCount >= 9) return Infinity
  return RING_LEVELS[ringCount] || 10
}

function expNeeded(level) {
  return experienceNeededForLevel(level)
}

/**
 * 基础属性计算（与 game.js calcBaseStats 完全一致）
 */
function calcBaseStats(spiritBase, originBonus, level, weapon) {
  const lv = Math.max(1, Math.floor(Number(level) || 1))
  const factor = 1 + lv * 0.05
  const weaponAtk = weapon ? Number(weapon.attack) || 0 : 0
  const bonus = originBonus || { attack: 0, defense: 0, hp: 0, speed: 0 }
  const sb = spiritBase || { attack: 0, defense: 0, hp: 0, speed: 0 }
  return {
    attack: Math.round((Number(sb.attack) || 0) * factor + (bonus.attack || 0) + weaponAtk),
    defense: Math.round((Number(sb.defense) || 0) * factor + (bonus.defense || 0)),
    hp: Math.round((Number(sb.hp) || 0) * factor + (bonus.hp || 0) + 60),
    speed: Math.round((Number(sb.speed) || 0) * factor + (bonus.speed || 0))
  }
}

/**
 * 预览属性（觉醒界面用，与 finalStats 基础部分一致）
 */
function previewStats(spirit, origin, level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1))
  return calcBaseStats(
    { attack: spirit.attack || 0, defense: spirit.defense || 0, hp: spirit.hp || 0, speed: spirit.speed || 0 },
    origin.stats || { attack: 0, defense: 0, hp: 0, speed: 0 },
    lv,
    origin.weapon || null
  )
}

// 阶段四C:finalStats 记忆化(基于 Pinia 的 computed)。
// 战斗血条/蓝条等热路径每次生命/魂力跳动都会读 finalStats——若每次全链重算
// (魂环/魂骨/称号/NPC 多重循环),开销随存档规模线性放大。computed 只在其
// 真实依赖(等级/加成/魂环/魂骨/称号/阵法/NPC 关系)变化时才重算,HP/魂力
// 跳动直接命中缓存。overrides 路径(结算草稿复算)不走缓存。
let statsMemo = null // { pinia, ref }——按 Pinia 实例隔离,测试间互不污染

/**
 * 最终属性计算（含魂环、魂骨、技能树、称号加成）
 * 含兼容存档的阵法/称号和当前伙伴好感度；加成顺序见 computeFinalStats。
 *
 * overrides（可选，供引擎结算层在"草稿状态"下复算，不影响语义）：
 *  - level        按该等级计算基础成长
 *  - bonus        用该永久加成对象替换 player.bonus
 *  - spiritBase   用该武魂基础属性替换 player.spiritBase（进化结算用）
 */
function finalStats(overrides = {}) {
  if (overrides && Object.keys(overrides).length) return computeFinalStats(overrides)
  const pinia = getActivePinia()
  if (!pinia) return computeFinalStats({})
  if (!statsMemo || statsMemo.pinia !== pinia) {
    statsMemo = { pinia, ref: computed(() => computeFinalStats({})) }
  }
  return statsMemo.ref.value
}

/**
 * 最终属性计算（含魂环、魂骨、技能树、称号加成）——原实现，供记忆化包装调用
 *
 * overrides（可选，供引擎结算层在"草稿状态"下复算，不影响语义）：
 *  - level        按该等级计算基础成长
 *  - bonus        用该永久加成对象替换 player.bonus
 *  - spiritBase   用该武魂基础属性替换 player.spiritBase（进化结算用）
 */
function computeFinalStats(overrides = {}) {
  const player = usePlayerStore()
  const lv = overrides.level !== undefined ? overrides.level : player.level
  const bonusSource = overrides.bonus !== undefined ? overrides.bonus : player.bonus
  const spiritBaseSource = overrides.spiritBase !== undefined ? overrides.spiritBase : player.spiritBase

  let ringAtk = 0, ringDef = 0, ringHp = 0
  ;(player.rings || []).forEach(r => {
    const bonus = r.bonus || {}
    ringAtk += Number(bonus.attack) || 0
    ringDef += Number(bonus.defense) || 0
    ringHp += Number(bonus.hp) || 0
  })

  const crafted = player._craftedBones || []
  const craftedAtk = crafted.reduce((sum, bone) => sum + (Number(bone.attack) || 0), 0)
  const craftedDef = crafted.reduce((sum, bone) => sum + (Number(bone.defense) || 0), 0)
  const craftedHp = crafted.reduce((sum, bone) => sum + (Number(bone.hp) || 0), 0)
  const craftedSpd = crafted.reduce((sum, bone) => sum + (Number(bone.speed) || 0), 0)

  const base = calcBaseStats(spiritBaseSource, player.originBonus, lv, player.weapon)

  const skillBonus = player._skillBonuses || {}
  const equippedTitleBonus = titleBonus()
  const formation = activeFormation()
  const npcBonus = npcRelationBonuses()

  let attack = base.attack + (bonusSource?.attack || 0) + ringAtk + craftedAtk + (Number(equippedTitleBonus.attack) || 0)
  let defense = base.defense + (bonusSource?.defense || 0) + ringDef + craftedDef + (Number(equippedTitleBonus.defense) || 0)
  let maxHp = base.hp + (bonusSource?.hp || 0) + ringHp + craftedHp + (Number(equippedTitleBonus.hp) || 0)
  let speed = base.speed + (bonusSource?.speed || 0) + craftedSpd + (Number(equippedTitleBonus.speed) || 0)

  attack = Math.round(attack * (1 + (Number(skillBonus.attackMult) || 0) + formation.attack))
  defense = Math.round(defense * (1 + (Number(skillBonus.defenseMult) || 0) + formation.defense))
  maxHp = Math.round(maxHp * (1 + (Number(skillBonus.hpMult) || 0)))
  speed = Math.round(speed * (1 + (Number(skillBonus.speedMult) || 0) + formation.speed))

  attack += npcBonus.attack
  defense += npcBonus.defense
  maxHp += npcBonus.hp
  speed += npcBonus.speed

  return {
    attack: Math.max(1, attack),
    defense: Math.max(0, defense),
    maxHp: Math.max(1, maxHp),
    speed: Math.max(1, speed),
    npcBonus,
    titleBonus: equippedTitleBonus,
    formation
  }
}

/**
 * 最大魂力计算
 * overrides（可选）：spiritPowerMax —— 结算草稿下按指定上限复算。
 */
function getMaxSpiritPower(overrides = {}) {
  const player = usePlayerStore()
  const powerMax = overrides.spiritPowerMax !== undefined ? overrides.spiritPowerMax : player.spiritPowerMax
  const skillMultiplier = Number(player._skillBonuses?.mpMult) || 0
  const formationMultiplier = Number(activeFormation().spirit) || 0
  const titlePower = Math.max(0, Number(titleBonus().spiritPowerGain) || 0)
  return Math.max(1, Math.round((Number(powerMax) || 1) * (1 + skillMultiplier + formationMultiplier) + titlePower))
}

/**
 * 随机选取数组元素
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 武魂品质抽取
 */
function rollSpiritTier(boost) {
  const r = Math.random() * 100
  let tier
  if (r < 40) tier = 'low'
  else if (r < 75) tier = 'mid'
  else if (r < 93) tier = 'high'
  else if (r < 99) tier = 'top'
  else tier = 'god'
  if (boost && tier !== 'god' && Math.random() < 0.10) {
    tier = { low: 'mid', mid: 'high', high: 'top', top: 'god' }[tier]
  }
  return tier
}

export function useGameRules() {
  return {
    TIER_NAMES,
    TIER_COLORS,
    RING_LEVELS,
    FORMATIONS,
    phaseForLevel,
    rankTitleForLevel,
    phaseName,
    levelCapForRings,
    expNeeded,
    calcBaseStats,
    previewStats,
    finalStats,
    getMaxSpiritPower,
    activeFormation,
    activeTitle,
    titleBonus,
    npcRelationBonuses,
    pick,
    rollSpiritTier
  }
}
