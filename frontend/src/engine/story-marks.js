/**
 * 世界账本（剧情记号）与连贯性规则 —— 纯逻辑，不依赖 Pinia / 浏览器。
 *
 * 三件事：
 * 1. 记号：玩家在名场面里的选择会留下记号（如 xiaowu_saved），后面的剧情据此"认账"。
 *    认识原著人物也记成记号：`met:唐三`。
 * 2. 认识规则：支线事件里出现了还没在主线正式认识的原著人物 → 不触发。
 *    这样"自由探索里见过、主线却不认识"的穿帮从源头上不会发生。
 * 3. 时间线关键词：提到史莱克 / 诺丁 / 八怪等，要求对应的剧情节点已经发生。
 *
 * 事件数据的写法：
 *   event.variants = [{ marks?, notMarks?, text, at?: 'before'|'after' }]   正文按记号追加段落
 *   event.requiresMarks / event.forbidsMarks                             支线按记号开关
 *   event.introduces = ['唐三', '小舞']                                  主线完成后记为"已认识"
 *   choice.marks = ['x']                                                 选择后写入记号
 *   choice.showIf = { marks?, anyMarks?, notMarks? }                     选项按记号显示
 *   choice.replyVariants = [{ marks?, notMarks?, text }]                 结果文字按记号追加
 *   choice.pathWeight = 3                                                该选择计入结局倾向的次数
 *   choice.result.defeatOutcome = { marks, text }                        战斗失利时改走另一条剧情而不是重打
 *   event.closing = '...'                                                不论怎么选都会接在结果后面的收尾段落
 */

// 原著人物：names 中任一出现在支线文字里，即视为"提到了这个人"。
// 顺序即主线中正式认识的大致顺序；introducedBy 仅作文档与校验用。
export const CANON_CHARACTERS = Object.freeze([
  { id: '唐三', names: ['唐三'], introducedBy: 'p02_nuoding' },
  { id: '小舞', names: ['小舞'], introducedBy: 'p02_nuoding' },
  { id: '王圣', names: ['王圣'], introducedBy: 'p02_nuoding' },
  { id: '玉小刚', names: ['玉小刚', '大师'], introducedBy: 'p03_master' },
  { id: '弗兰德', names: ['弗兰德'], introducedBy: 'p04_shrek_exam' },
  { id: '赵无极', names: ['赵无极'], introducedBy: 'p04_shrek_exam' },
  { id: '戴沐白', names: ['戴沐白'], introducedBy: 'p04_shrek_exam' },
  { id: '奥斯卡', names: ['奥斯卡'], introducedBy: 'p04_shrek_exam' },
  { id: '马红俊', names: ['马红俊', '胖子'], introducedBy: 'p05_eight_monsters' },
  { id: '宁荣荣', names: ['宁荣荣', '荣荣'], introducedBy: 'p05_eight_monsters' },
  { id: '朱竹清', names: ['朱竹清', '竹清'], introducedBy: 'p05_eight_monsters' },
  { id: '泰坦巨猿', names: ['泰坦巨猿'], introducedBy: 'p06_titan' },
  { id: '天青牛蟒', names: ['天青牛蟒'], introducedBy: 'p06_titan' },
  { id: '独孤博', names: ['独孤博', '毒斗罗'], introducedBy: 'p07_dugubo' },
  { id: '玉天恒', names: ['玉天恒'], introducedBy: 'p08_huangdou' },
  { id: '独孤雁', names: ['独孤雁'], introducedBy: 'p08_huangdou' },
  { id: '叶泠泠', names: ['叶泠泠'], introducedBy: 'p08_huangdou' },
  { id: '雪清河', names: ['雪清河'], introducedBy: 'p08_huangdou' },
  { id: '宁风致', names: ['宁风致'], introducedBy: 'p09_prelim' },
  { id: '剑斗罗尘心', names: ['尘心', '剑斗罗'], introducedBy: 'p09_prelim' },
  { id: '骨斗罗古榕', names: ['古榕', '骨斗罗'], introducedBy: 'p09_prelim' },
  { id: '胡列娜', names: ['胡列娜'], introducedBy: 'p10_final' },
  { id: '邪月', names: ['邪月'], introducedBy: 'p10_final' },
  { id: '比比东', names: ['比比东'], introducedBy: 'p10_final' },
  { id: '唐昊', names: ['唐昊'], introducedBy: 'p10_final' },
  { id: '唐啸', names: ['唐啸'], introducedBy: 'p12_haotian' }
])

// 时间线关键词：文字里出现这些说法，说明故事已经走到了某一步。
export const TIMELINE_KEYWORDS = Object.freeze([
  { pattern: /诺丁/, mark: 'arrived_nuoding', label: '到达诺丁学院' },
  { pattern: /史莱克/, mark: 'joined_shrek', label: '加入史莱克学院' },
  { pattern: /[七八]怪/, mark: 'eight_monsters', label: '史莱克八怪成团' },
  { pattern: /精英大赛|魂师大赛/, mark: 'tournament_begun', label: '精英大赛开幕' }
])

export const metMark = name => `met:${name}`

function toSet(value) {
  if (value instanceof Set) return value
  return new Set(Array.isArray(value) ? value : [])
}

function asList(value) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

/** 记号条件：marks 全部具备、anyMarks 至少一个、notMarks 一个都没有。 */
export function marksMatch(condition, marks) {
  if (!condition) return true
  const have = toSet(marks)
  const any = asList(condition.anyMarks)
  return asList(condition.marks).every(mark => have.has(mark)) &&
    (any.length === 0 || any.some(mark => have.has(mark))) &&
    !asList(condition.notMarks).some(mark => have.has(mark))
}

function eventPlainText(event) {
  const parts = [event?.name, event?.location, ...asList(event?.text)]
  for (const variant of event?.variants || []) parts.push(variant?.text)
  for (const choice of event?.choices || []) {
    parts.push(choice?.text, choice?.reply, choice?.result?.text, choice?.requirementHint)
  }
  return parts.filter(value => typeof value === 'string').join(' ')
}

// 事件对象（适配结果）是稳定的，扫描结果按对象缓存，避免每次抽事件都重新跑正则。
const SCAN_CACHE = new WeakMap()

function scan(event) {
  if (event && typeof event === 'object' && SCAN_CACHE.has(event)) return SCAN_CACHE.get(event)
  const text = eventPlainText(event)
  const result = {
    canon: CANON_CHARACTERS.filter(character => character.names.some(name => text.includes(name))).map(c => c.id),
    timeline: TIMELINE_KEYWORDS.filter(rule => rule.pattern.test(text)).map(rule => rule.mark)
  }
  if (event && typeof event === 'object') SCAN_CACHE.set(event, result)
  return result
}

/** 文字中提到的原著人物 id 列表。 */
export function mentionedCanonCharacters(event) {
  return scan(event).canon
}

/** 文字中隐含的时间线前提（记号列表）。 */
export function impliedTimelineMarks(event) {
  return scan(event).timeline
}

/**
 * 支线事件的连贯性闸门。主线、猎环、序章由剧情自己保证顺序，不经过本闸门。
 * 返回 { ok, missing }，missing 便于测试与审计脚本说明原因。
 */
export function storyGate(event, marks) {
  const have = toSet(marks)
  const missing = []
  for (const id of mentionedCanonCharacters(event)) {
    if (!have.has(metMark(id))) missing.push(metMark(id))
  }
  for (const mark of impliedTimelineMarks(event)) {
    if (!have.has(mark)) missing.push(mark)
  }
  for (const mark of asList(event?.requiresMarks)) {
    if (!have.has(mark)) missing.push(mark)
  }
  const forbidden = asList(event?.forbidsMarks).filter(mark => have.has(mark))
  return { ok: missing.length === 0 && forbidden.length === 0, missing, forbidden }
}

/**
 * 按记号展开事件：正文追加符合条件的段落，选项按 showIf 过滤，选项结果按 replyVariants 追加。
 * 不修改原对象。没有任何记号相关字段的事件原样返回。
 */
export function resolveStoryVariants(event, marks) {
  if (!event) return event
  const hasVariants = Array.isArray(event.variants) && event.variants.length > 0
  const hasChoiceRules = (event.choices || []).some(choice => choice?.showIf || choice?.replyVariants)
  if (!hasVariants && !hasChoiceRules) return event
  const have = toSet(marks)
  const base = asList(event.text)
  const before = []
  const after = []
  for (const variant of event.variants || []) {
    if (!variant?.text || !marksMatch(variant, have)) continue
    ;(variant.at === 'before' ? before : after).push(variant.text)
  }
  const choices = (event.choices || [])
    .filter(choice => marksMatch(choice?.showIf, have))
    .map(choice => {
      if (!Array.isArray(choice?.replyVariants)) return choice
      const extra = choice.replyVariants.filter(v => v?.text && marksMatch(v, have)).map(v => v.text)
      if (!extra.length) return choice
      const baseText = choice.reply || choice.result?.text || ''
      const merged = [baseText, ...extra].filter(Boolean).join('')
      return choice.reply
        ? { ...choice, reply: merged }
        : { ...choice, result: { ...(choice.result || {}), text: merged } }
    })
  return { ...event, text: [...before, ...base, ...after], choices }
}

/** 一个选择应当写入的所有记号（选项自带 + 事件完成时的"已认识"）。 */
export function marksFromChoice(event, choice) {
  return [
    ...asList(choice?.marks),
    ...asList(event?.completeMarks),
    ...asList(event?.introduces).map(metMark)
  ]
}

/**
 * 结局尾声：按记号挑出要显示的段落。at: 'before' 的段落放在结局正文之前
 * （决战收尾、小舞醒来这类紧接着战斗发生的事），其余放在正文之后。
 */
export function resolveEndingEpilogue(variants, marks) {
  const have = toSet(marks)
  const picked = (variants || []).filter(v => v?.text && marksMatch(v, have))
  return {
    before: picked.filter(v => v.at === 'before').map(v => v.text),
    after: picked.filter(v => v.at !== 'before').map(v => v.text)
  }
}
