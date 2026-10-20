/**
 * 事件触发适配规则。
 *
 * 事件有四个来源：静态事件、扩展事件、JSON 武魂事件、动态/连锁事件。
 * 这里不依赖 Pinia 或浏览器，因此可以在引擎、数据注入和审计脚本中复用。
 */

import { phaseForLevel } from './rules.js'
import { storyGate } from './story-marks.js'

// 与 rules.js phaseForLevel 保持同一边界（正典身份期：初级学院 1~10、
// 进阶学院 11~40、历练 41~70、封神 71~100）。历史版本是 1-6/7-18/19-40/41-100，
// 已废弃——新增或校验事件时一律以 phaseForLevel 为准。
export const PHASE_RANGES = Object.freeze({
  academy: [1, 10],
  adventure: [11, 40],
  master: [41, 70],
  god: [71, 100]
})

// 主线里程碑链（单一来源）：斗罗大陆 1 的名场面，玩家以"史莱克第八怪"的身份参与。
// 结构是"珍珠串 + 三个大分叉"：每颗珍珠开头按原著走，选择留下记号（engine/story-marks.js），
// 大分叉在 p11（小舞的秘密）、p14（海神岛）、final_evil（最终决战）。
// guideLabel 是给引导条用的口语化说法；targetId 为必须抵达的地点。
export const MAIN_STORY_MILESTONES = Object.freeze([
  { id: 'p02_nuoding', name: '诺丁学院·初遇小舞', guideLabel: '去诺丁学院报到', minLevel: 2, targetId: 'nuoding_city' },
  { id: 'p03_master', name: '大师的考验', guideLabel: '去见诺丁学院的"大师"', minLevel: 5, targetId: 'nuoding_city' },
  { id: 'p04_shrek_exam', name: '史莱克入学考核', guideLabel: '参加史莱克学院的入学考核', minLevel: 11, targetId: 'shrek_academy' },
  { id: 'p05_eight_monsters', name: '史莱克八怪', guideLabel: '和新伙伴们组成小队', minLevel: 15, targetId: 'shrek_academy' },
  { id: 'p06_titan', name: '森林之王', guideLabel: '跟大师进星斗大森林历练', minLevel: 22, targetId: 'star_duo_outer' },
  { id: 'p07_dugubo', name: '冰火两仪眼', guideLabel: '陪唐三去落日森林找仙草', minLevel: 28, targetId: 'sunset_forest' },
  { id: 'p08_huangdou', name: '对决皇斗战队', guideLabel: '去天斗城打友谊赛', minLevel: 34, targetId: 'tian_dou_city' },
  { id: 'p09_prelim', name: '精英大赛·预选赛', guideLabel: '参加精英大赛预选赛', minLevel: 41, targetId: 'tian_dou_city' },
  { id: 'p10_final', name: '精英大赛·决赛', guideLabel: '去武魂城打决赛', minLevel: 47, targetId: 'wuhun_city' },
  { id: 'p11_xiaowu', name: '小舞的秘密', guideLabel: '去星斗大森林深处找小舞', minLevel: 53, targetId: 'star_duo_deep' },
  { id: 'p12_haotian', name: '昊天宗', guideLabel: '陪唐三回昊天宗', minLevel: 60, targetId: 'haotian_sect' },
  { id: 'p13_trial_city', name: '试炼之城', guideLabel: '陪唐三闯试炼之城', minLevel: 68, targetId: 'slaughter_city' },
  { id: 'p14_sea_god', name: '海神岛', guideLabel: '陪唐三去海神岛', minLevel: 76, targetId: 'sea_god_island' },
  { id: 'p15_eve', name: '决战前夜', guideLabel: '回史莱克和伙伴们相聚', minLevel: 86, targetId: 'shrek_academy' },
  { id: 'final_evil', name: '最终决战', guideLabel: '去武魂城打赢最后一战', minLevel: 92, targetId: 'wuhun_city' }
].map((item, index, list) => ({
  ...item,
  requires: index === 0 ? [] : [list[index - 1].id]
})))

// 旧版主线节点：内容已由上面的名场面取代。数据保留（旧存档的 doneEvents 仍可识别），
// 但永远不再进入任何事件池。
export const RETIRED_MAIN_STORY_IDS = Object.freeze([
  'first_class', 'first_hunt', 'reach_lv10', 'ms_new_friends', 'ms_first_team', 'ms_tournament_prep',
  'soul_master_prelim', 'spirit_hall_exam', 'ms_seven_treasure', 'soul_master_final', 'ms_graduation',
  'god_trial_sea', 'ms_spirit_herbs', 'ml_bibi_omen', 'ms_haotian', 'ml_bibi_hunt', 'ms_alliance',
  'ms_rescue', 'ms_eve'
])

// 与新主线冲突、无法改写成立的支线：
// 泰坦巨猿/天青牛蟒是小舞的守护者（p06 起成为朋友），不能再作为猎杀对象；
// "初次认识小舞"的偶遇与主线重复；
// 海神与修罗神位属于唐三，玩家是并肩的伙伴——"你也是神位传承者/百级成神"的事件与结局矛盾。
export const SEALED_EVENT_IDS = Object.freeze([
  'shapeshift_beast', 'titan_encounter', 'adv_more_06_titan',
  'angel_vs_sea', 'ma_daily_08', 'ma_big_16'
])

const RETIRED_SET = new Set([...RETIRED_MAIN_STORY_IDS, ...SEALED_EVENT_IDS])

export const MAIN_STORY_EVENT_IDS = Object.freeze(MAIN_STORY_MILESTONES.map(item => item.id))

export const MAIN_STORY_REQUIREMENTS = Object.freeze(Object.fromEntries(
  MAIN_STORY_MILESTONES.map(item => [item.id, item.requires])
))

/**
 * 下一个应触发的主线里程碑（纯函数）。
 * 故事是一条直线：取"已完成的最后一个节点"之后的第一个未完成节点。
 * 这样旧存档（已打过大赛决赛、却没有新增的中间节点）不会倒回去补 15 级的剧情。
 * 旧主线版本（_mainStoryVersion < 1）没有里程碑链，只关心终局是否完成。
 */
export function nextMainStoryMilestone({ mainStoryVersion, doneEvents }) {
  const done = new Set(Array.isArray(doneEvents) ? doneEvents : [])
  const fullStory = Number(mainStoryVersion) >= 1
  if (!fullStory) {
    const finalMilestone = MAIN_STORY_MILESTONES.find(item => item.id === 'final_evil')
    return finalMilestone && !done.has('final_evil') ? finalMilestone : null
  }
  let lastDone = -1
  MAIN_STORY_MILESTONES.forEach((item, index) => { if (done.has(item.id)) lastDone = index })
  return MAIN_STORY_MILESTONES.slice(lastDone + 1).find(item => !done.has(item.id)) || null
}

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
  // 主线节点：只由主线里程碑触发，等级门槛与里程碑表一致。
  ...Object.fromEntries(MAIN_STORY_MILESTONES.map(item => [item.id, {
    mainStoryOnly: true,
    minLevel: item.minLevel,
    phase: phaseForLevel(item.minLevel)
  }])),

  // 身份/能力门槛：等级与魂环数量同时满足，避免只靠 god phase 越级。
  ma_gold_03: { minLevel: 90, minRingCount: 8 },
  ma_more_04: { minLevel: 70, minRingCount: 7 },
  ma_extra_01: { minLevel: 90, minRingCount: 8 },
  ma_big_14: { minLevel: 90, minRingCount: 8 },
  ma_daily_08: { minLevel: 99, maxLevel: 99, minRingCount: 8 },
  angel_vs_sea: { minLevel: 90, minRingCount: 8 },
  ma_big_16: { minLevel: 99, minRingCount: 8 },
  mortal_world: { minLevel: 90, minRingCount: 8, requiredEventIds: ['p10_final'] },

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

// 中期延展：这些冒险事件不涉及学院身份、写的是城镇/遗迹/旅途/天气这类通用经历，
// 41~70 级的历练期同样合理。原来它们被锁在 11~40 级，导致 41 级后内容骤减。
// 规则：阶段放宽为 any，但不超过 70 级（封神期不再出现，避免"后期事件与前期同构"）。
export const MIDGAME_EXTENDED_IDS = Object.freeze(new Set([
  'treasure_map', 'arena_streak', 'wolf_king_den', 'herb_valley', 'hot_spring', 'bandit_king',
  'meet_partner', 'beast_riot', 'adv_gold_01', 'adv_gold_04', 'adv_gold_05', 'adv_stat_01',
  'adv_stat_02', 'adv_stat_03', 'adv_stat_04', 'adv_more_01', 'adv_more_02', 'adv_more_04',
  'adv_more_05', 'adv_extra_01', 'adv_extra_02', 'adv_extra_03', 'adv_extra_04', 'adv_extra_05',
  'adv_extra_06', 'adv_beast_16', 'adv_beast_17', 'adv_beast_18', 'adv_beast_19', 'adv_beast_20',
  'adv_town_16', 'adv_town_17', 'adv_town_19', 'adv_ruin_06', 'adv_ruin_07', 'adv_sp_11',
  'adv_sp_13', 'adv_sp_14', 'adv_more_01_beast', 'adv_more_07', 'adv_more_09', 'adv_more_10',
  'adv_more_12', 'adv_more_13', 'adv_more_14', 'adv_beast_06', 'adv_beast_07', 'adv_beast_10',
  'adv_beast_13', 'adv_town_01', 'adv_town_02', 'adv_town_05', 'adv_ruin_01', 'adv_ruin_02',
  'adv_ruin_03', 'adv_enc_01', 'adv_enc_02', 'adv_enc_03', 'dy_lone_02', 'dy_lone_03',
  'dy_sect_02', 'dy_adventure_02', 'dy_adventure_03', 'dy_hero_02', 'dy_fate_02', 'dy_fate_03',
  'gbl_adv_01', 'gbl_adv_02', 'gbl_adv_03',
]))

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
  const midgameExtended = MIDGAME_EXTENDED_IDS.has(source.id)
  const maximum = explicit.maxLevel !== undefined
    ? explicit.maxLevel
    : (postAscension || legacyGodSpirit ? 100 : (midgameExtended && source.maxLevel === undefined ? 70 : source.maxLevel))
  const rules = {
    ...(source.mainStoryOnly ? { mainStoryOnly: true } : {}),
    ...(storyOnly ? { mainStoryOnly: true } : {}),
    ...(explicit.mainStoryOnly ? { mainStoryOnly: true } : {}),
    ...(postAscension || legacyGodSpirit ? { requiresAscension: true, postAscension: true } : {}),
    ...(explicit.phase ? { phase: explicit.phase } : {}),
    ...(midgameExtended ? { phase: 'any' } : {}),
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
    ...(RETIRED_SET.has(source.id) ? { weight: 0, retired: true } : {}),
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
  // 剧情连贯性闸门（engine/story-marks.js）：只对支线生效；调用方传入 storyMarks 才启用，
  // 主线与猎环由剧情顺序自己保证。
  if (Array.isArray(ctx.storyMarks) && !ctx.isMainStory && !current.ringOnly && !storyGate(current, ctx.storyMarks).ok) return false
  return true
}

/**
 * 洗牌袋抽取队列（经济规格 v2：多周目不撞车）。
 * 候选按权重展开 → Fisher-Yates 洗牌 → 按首次出现顺序去重。
 * 引擎按序弹出即可保证：同批候选耗尽前零重复；权重越大越倾向早出场，
 * 整个周期的出场分布仍与加权随机同分布。
 */
export function buildDrawQueue(candidateIds, weights = {}, rand = Math.random) {
  const ids = Array.isArray(candidateIds) ? candidateIds.filter(Boolean) : []
  const expanded = []
  for (const id of ids) {
    const w = Math.max(1, Math.min(20, Math.round(Number(weights[id]) || 1)))
    for (let i = 0; i < w; i++) expanded.push(id)
  }
  for (let i = expanded.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    if (i !== j) { const tmp = expanded[i]; expanded[i] = expanded[j]; expanded[j] = tmp }
  }
  const seen = new Set()
  const queue = []
  for (const id of expanded) {
    if (!seen.has(id)) { seen.add(id); queue.push(id) }
  }
  return queue
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
