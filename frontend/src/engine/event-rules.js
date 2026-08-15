/**
 * 事件触发适配规则。
 *
 * 事件有四个来源：静态事件、扩展事件、JSON 武魂事件、动态/连锁事件。
 * 这里不依赖 Pinia 或浏览器，因此可以在引擎、数据注入和审计脚本中复用。
 */

import { phaseForLevel } from './rules.js'

export const PHASE_RANGES = Object.freeze({
  academy: [1, 6],
  adventure: [7, 18],
  master: [19, 40],
  god: [41, 100]
})

export const MAIN_STORY_EVENT_IDS = Object.freeze([
  'first_hunt',
  'reach_lv10',
  'soul_master_prelim',
  'spirit_hall_exam',
  'soul_master_final',
  'god_trial_sea',
  'final_evil'
])

export const MAIN_STORY_REQUIREMENTS = Object.freeze({
  first_hunt: [],
  reach_lv10: ['first_hunt'],
  soul_master_prelim: ['reach_lv10'],
  spirit_hall_exam: ['soul_master_prelim'],
  soul_master_final: ['soul_master_prelim'],
  god_trial_sea: ['soul_master_final'],
  final_evil: ['god_trial_sea']
})

// 当前结局流程在最终主线后结束，没有成神后的自由游玩状态。
// 这些事件保留给未来模式，但未设置真实 ascended 状态时永远不能进入随机池。
export const POST_ASCENSION_EVENT_IDS = Object.freeze([
  'god_stat_01', 'god_stat_02', 'god_gold_01',
  'god_more_01', 'god_more_02', 'god_more_03',
  'god_extra_01', 'god_extra_02', 'god_extra_03',
  'god_big_10', 'god_big_11', 'god_big_12', 'god_big_13', 'god_big_14', 'god_big_15',
  'god_daily_01', 'god_daily_02', 'god_daily_03', 'god_daily_04', 'god_daily_05', 'god_daily_06',
  'god_more_04', 'god_more_05', 'god_more_06', 'god_more_07',
  'god_more_01_envoy', 'god_more_02_evil', 'god_more_03_rift',
  'god_more_04', 'god_more_05', 'god_more_06', 'god_more_07'
])

const POST_ASCENSION_PREFIXES = ['god_stat_', 'god_gold_', 'god_extra_', 'god_big_', 'god_daily_']
const STORY_ONLY_EVENT_IDS = new Set()
const MAIN_STORY_SET = new Set(MAIN_STORY_EVENT_IDS)
const POST_ASCENSION_SET = new Set(POST_ASCENSION_EVENT_IDS)

const STATIC_SPIRIT_RULES = Object.freeze({
  sp_wp: { spiritTypes: ['器武魂'], spiritSubtypes: ['武器'] },
  sp_bs: { spiritTypes: ['兽武魂'] },
  sp_tl: { spiritSubtypes: ['生活器物'] },
  sp_pl: { spiritSubtypes: ['植物系'] },
  sp_gd: { spiritSubtypes: ['神器', '神兽'], spiritTiers: ['god'] },
  sp_df: { spiritSubtypes: ['防御系'] },
  sp_sp: { spiritSubtypes: ['敏攻系'] },
  sp_ct: { spiritSubtypes: ['控制系'] },
  sp_aux: { spiritSubtypes: ['辅助系'] }
})

const EXPLICIT_RULES = Object.freeze({
  first_hunt: { mainStoryOnly: true, minLevel: 5, phase: 'academy' },
  reach_lv10: { mainStoryOnly: true, minLevel: 10, phase: 'academy' },
  soul_master_prelim: { mainStoryOnly: true, minLevel: 30, phase: 'adventure' },
  spirit_hall_exam: { mainStoryOnly: true, minLevel: 30, phase: 'adventure' },
  soul_master_final: { mainStoryOnly: true, minLevel: 40, phase: 'adventure' },
  god_trial_sea: { mainStoryOnly: true, minLevel: 50, phase: 'master' },
  final_evil: { mainStoryOnly: true, minLevel: 95, phase: 'god' },

  // 身份/能力门槛：等级与魂环数量同时满足，避免只靠 god phase 越级。
  ma_gold_03: { minLevel: 90, minRingCount: 8 },
  ma_more_04: { minLevel: 70, minRingCount: 7 },
  ma_extra_01: { minLevel: 90, minRingCount: 8 },
  ma_big_14: { minLevel: 90, minRingCount: 8 },
  ma_daily_08: { minLevel: 99, maxLevel: 99, minRingCount: 8 },
  angel_vs_sea: { minLevel: 90, minRingCount: 8 },
  ma_big_16: { minLevel: 99, minRingCount: 8 },
  mortal_world: { minLevel: 90, minRingCount: 8, requiredEventIds: ['soul_master_final'] },

  // 普通随机池中的高危魂兽遭遇不得代替正式猎环流程。
  shapeshift_beast: { minLevel: 75, minRingCount: 6 },
  titan_encounter: { minLevel: 75, minRingCount: 6 },
  adv_more_03_bear: { minLevel: 75, minRingCount: 6 },
  adv_more_04_scorpion: { minLevel: 75, minRingCount: 6 },
  whale_king_sea: { minLevel: 80, minRingCount: 7 },
  ma_big_13: { minLevel: 75, minRingCount: 6 },
  adv_more_06_titan: { minLevel: 75, minRingCount: 6 },
  sp_bs_04: { minLevel: 30, phase: 'master' },
  sp_gd_02: { minLevel: 90, minRingCount: 8 },
  sp_gd_03: { minLevel: 90, minRingCount: 8 },

  // 连锁事件的第二节点必须与 Lv.8 所在的冒险篇一致。
  mentor_2: { phase: 'adventure', minLevel: 8 }
})

const CHOICE_MIN_LEVELS = Object.freeze({
  adv_more_06_titan: { 1: 85 },
  adv_town_03: { 2: 20 },
  sp_bs_04: { 0: 30 }
})

function prefixRule(eventId) {
  const key = String(eventId || '').split('_').slice(0, 2).join('_')
  return STATIC_SPIRIT_RULES[key] || null
}

function isPostAscensionId(eventId) {
  const id = String(eventId || '')
  return id.startsWith('god_') || POST_ASCENSION_SET.has(id) || POST_ASCENSION_PREFIXES.some(prefix => id.startsWith(prefix))
}

function mergeUnique(...values) {
  return [...new Set(values.flatMap(value => Array.isArray(value) ? value : value ? [value] : []))]
}

function contentText(event) {
  return [
    event?.name,
    event?.location,
    ...(Array.isArray(event?.text) ? event.text : [event?.text]),
    ...(event?.choices || []).flatMap(choice => [choice?.text, choice?.result?.text])
  ].filter(Boolean).join(' ')
}

function ringCountForEvent(eventId) {
  const match = String(eventId || '').match(/^ring_hunt_(10|20|30|40|50|60|70|80|90)$/)
  return match ? Number(match[1]) / 10 - 1 : null
}

function automaticRiskRule(event) {
  if (!event || event.ring) return {}
  const text = contentText(event)
  if (/十万年魂兽|十万年.*(?:魂环|献祭|猎杀)|百万年.*魂环/.test(text)) {
    return { minLevel: 75, minRingCount: 6 }
  }
  if (/万年魂兽|万年.*(?:魂环|猎杀)|暗金恐爪熊|冰帝蝎|泰坦巨猿王|深海魔鲸王/.test(text)) {
    return { minLevel: 50, minRingCount: 4 }
  }
  return {}
}

function normalizeChoices(event) {
  const requirements = CHOICE_MIN_LEVELS[event?.id]
  if (!requirements || !Array.isArray(event?.choices)) return event?.choices || []
  return event.choices.map((choice, index) => {
    const level = requirements[index]
    if (!level) return { ...choice }
    const existing = choice.cond
    const cond = typeof existing === 'function'
      ? (G => Number(G?.level) >= level && existing(G))
      : { ...(existing && typeof existing === 'object' ? existing : {}), level }
    return {
      ...choice,
      cond,
      requirementHint: choice.requirementHint || `等级达到 Lv.${level}`
    }
  })
}

// M2 性能：adaptEvent 结果缓存。已适配对象再次传入时直接返回原对象——
// 适配结果只依赖（事件静态数据 + spiritMeta），调用方（引擎/索引）按武魂复用同一
// 批次适配结果，可避免 isEventEligible 对同一事件重复执行正则与对象展开。
// 注意：不修改返回对象是契约（showEvent 管线全部为纯函数/展开新对象）。
const ADAPTED_EVENTS = new WeakSet()

/**
 * 返回事件的中央适配结果。它不会改变原始对象，适合在数据注入和展示前调用。
 */
export function adaptEvent(event, options = {}) {
  if (ADAPTED_EVENTS.has(event)) return event
  const source = event || {}
  const explicit = EXPLICIT_RULES[source.id] || {}
  const spirit = options.spiritMeta || {}
  const sourceSpiritRule = prefixRule(source.id)
  const jsonSpiritRule = source.spiritId ? {
    spiritTypes: spirit.type ? [spirit.type] : [],
    spiritSubtypes: spirit.subtype ? [spirit.subtype] : [],
    spiritTiers: spirit.tier ? [spirit.tier] : []
  } : {}
  const ringCount = ringCountForEvent(source.id)
  const automatic = automaticRiskRule(source)
  const postAscension = isPostAscensionId(source.id) && !MAIN_STORY_SET.has(source.id) && !STORY_ONLY_EVENT_IDS.has(source.id)
  const legacyGodSpirit = source.spiritTier === 'god' && /_legacy$/.test(String(source.id || ''))
  const weaponResonance = source.spiritSubtype === '武器' && /_resonance$/.test(String(source.id || ''))
  const storyOnly = MAIN_STORY_SET.has(source.id) || STORY_ONLY_EVENT_IDS.has(source.id)
  const minimum = Math.max(
    Number(source.minLevel) || 1,
    Number(explicit.minLevel) || 1,
    Number(automatic.minLevel) || 1,
    weaponResonance ? 10 : 1,
    postAscension || legacyGodSpirit ? 100 : 1
  )
  const maximum = explicit.maxLevel !== undefined
    ? explicit.maxLevel
    : (postAscension || legacyGodSpirit ? 100 : source.maxLevel)
  const rules = {
    ...(source.mainStoryOnly ? { mainStoryOnly: true } : {}),
    ...(storyOnly ? { mainStoryOnly: true } : {}),
    ...(explicit.mainStoryOnly ? { mainStoryOnly: true } : {}),
    ...(postAscension || legacyGodSpirit ? { requiresAscension: true, postAscension: true } : {}),
    ...(explicit.phase ? { phase: explicit.phase } : {}),
    ...(source.spiritId ? { phase: phaseForLevel(minimum) } : {}),
    ...(sourceSpiritRule || jsonSpiritRule.spiritTypes?.length ? {
      spiritTypes: mergeUnique(source.spiritTypes, sourceSpiritRule?.spiritTypes, jsonSpiritRule.spiritTypes)
    } : {}),
    ...(sourceSpiritRule || jsonSpiritRule.spiritSubtypes?.length ? {
      spiritSubtypes: mergeUnique(source.spiritSubtypes, sourceSpiritRule?.spiritSubtypes, jsonSpiritRule.spiritSubtypes)
    } : {}),
    ...(sourceSpiritRule || jsonSpiritRule.spiritTiers?.length ? {
      spiritTiers: mergeUnique(source.spiritTiers, sourceSpiritRule?.spiritTiers, jsonSpiritRule.spiritTiers)
    } : {}),
    ...(source.spiritId ? { requiredSpiritId: source.spiritId } : {}),
    ...(source.origin ? { requiredOrigin: source.origin } : {}),
    ...(ringCount !== null ? { ringOnly: true, requiredRingCount: ringCount } : {}),
    ...(explicit.minRingCount !== undefined || automatic.minRingCount !== undefined
      ? { minRingCount: Math.max(Number(explicit.minRingCount) || 0, Number(automatic.minRingCount) || 0) }
      : {}),
    ...(explicit.requiredEventIds || MAIN_STORY_REQUIREMENTS[source.id]
      ? { requiredEventIds: mergeUnique(MAIN_STORY_REQUIREMENTS[source.id], explicit.requiredEventIds) }
      : {})
  }
  const adapted = {
    ...source,
    ...rules,
    minLevel: minimum,
    ...(maximum !== undefined ? { maxLevel: maximum } : {}),
    ...(rules.phase === undefined && (postAscension || legacyGodSpirit) ? { phase: 'god' } : {}),
    choices: normalizeChoices(source)
  }
  ADAPTED_EVENTS.add(adapted)
  return adapted
}

function sameValue(actual, expected) {
  if (Array.isArray(expected)) return expected.length === 0 || expected.includes(actual)
  return expected === undefined || expected === actual
}

function includesAll(have, required) {
  const source = new Set(Array.isArray(have) ? have : [])
  return (required || []).every(value => source.has(value))
}

/**
 * 中央触发判定。ctx 只包含可序列化的运行时快照，便于单元测试。
 */
export function isEventEligible(event, ctx = {}) {
  const current = adaptEvent(event, { spiritMeta: ctx.spirit || {} })
  const level = Number(ctx.level) || 1
  const phase = ctx.phase || phaseForLevel(level)
  const done = Array.isArray(ctx.doneEvents) ? ctx.doneEvents : []
  const ringCount = Math.max(0, Number(ctx.ringCount) || 0)
  if (!current.id || !Array.isArray(current.choices) || current.choices.length === 0) return false
  if (current.weight === 0 || current.ringOnly && !ctx.isRingHunt) return false
  if (current.phase && current.phase !== 'any' && current.phase !== phase) return false
  if (current.minLevel && level < current.minLevel) return false
  if (current.maxLevel && level > current.maxLevel) return false
  if (current.mainStoryOnly && !ctx.isMainStory) return false
  if (current.requiresAscension && ctx.ascended !== true) return false
  if (current.requiredEventIds && !includesAll(done, current.requiredEventIds)) return false
  if (current.requiredRingCount !== undefined && ringCount !== current.requiredRingCount) return false
  if (current.minRingCount !== undefined && ringCount < current.minRingCount) return false
  if (current.maxRingCount !== undefined && ringCount > current.maxRingCount) return false
  if (current.requiredSpiritId && ctx.spirit?.id !== current.requiredSpiritId) return false
  if (current.requiredOrigin && ctx.origin !== current.requiredOrigin) return false
  if (!sameValue(ctx.spirit?.type, current.spiritTypes) || !sameValue(ctx.spirit?.subtype, current.spiritSubtypes) || !sameValue(ctx.spirit?.tier, current.spiritTiers)) return false
  if (current.unique && done.includes(current.id)) return false
  if (ctx.recentEvents?.includes(current.id) && ctx.excludeRecent) return false
  if (ctx.locationMatches === false) return false
  // 季节/时段门控（T17，V2-5）：事件标注 season/timeOfDay 时，当前时间不符即不触发，
  // 避免"夏天抽到初雪""深夜抽到中午的食堂"穿帮。
  if (current.season && ctx.season && current.season !== ctx.season) return false
  if (current.timeOfDay && ctx.timeOfDay && current.timeOfDay !== ctx.timeOfDay) return false
  return true
}

export function eventRuleSummary(event, options = {}) {
  const adapted = adaptEvent(event, options)
  return {
    originalMinLevel: Number(event?.minLevel) || 1,
    originalMaxLevel: event?.maxLevel === undefined ? 100 : Number(event.maxLevel),
    originalPhase: event?.phase || '动态条件',
    minLevel: adapted.minLevel,
    maxLevel: adapted.maxLevel === undefined ? 100 : Number(adapted.maxLevel),
    phase: adapted.phase || '动态条件',
    spiritId: adapted.requiredSpiritId || event?.spiritId || '',
    spiritTypes: adapted.spiritTypes || [],
    spiritSubtypes: adapted.spiritSubtypes || [],
    spiritTiers: adapted.spiritTiers || [],
    requiredEventIds: adapted.requiredEventIds || [],
    minRingCount: adapted.minRingCount,
    requiredRingCount: adapted.requiredRingCount,
    mainStoryOnly: adapted.mainStoryOnly === true,
    postAscension: adapted.requiresAscension === true,
    unique: adapted.unique === true,
    changed: JSON.stringify(adapted) !== JSON.stringify(event)
  }
}

export function choiceHasLevelRequirement(choice, level) {
  const cond = choice?.cond || choice?.req
  if (cond && typeof cond === 'object' && Number(cond.level) > 0) return Number(cond.level) <= Number(level)
  return true
}
