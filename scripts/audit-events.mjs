import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS } from '../frontend/src/data/game-data.js'
import '../frontend/src/data/events-expanded.js'
import { LOCATION_EVENTS } from '../frontend/src/data/location-events.js'
import {
  adaptEvent,
  eventRuleSummary,
  isEventEligible,
  MAIN_STORY_EVENT_IDS
} from '../frontend/src/engine/event-rules.js'
import { classifyEventLocation } from '../frontend/src/engine/rules.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_PATH = path.join(ROOT, 'docs/reports/事件触发合理性逐项审计.md')

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8'))
}

function normalizeJsonEvent(source, spirit, eventKey) {
  return {
    ...source,
    name: source.name || source.title || '武魂专属事件',
    location: source.location || '斗罗大陆',
    text: Array.isArray(source.text) ? source.text : [String(source.text || '')],
    choices: Array.isArray(source.choices) ? source.choices : [],
    phase: source.phase || (source.minLevel <= 6 ? 'academy' : source.minLevel <= 18 ? 'adventure' : source.minLevel <= 40 ? 'master' : 'god'),
    spiritId: spirit.id,
    spiritType: spirit.type,
    spiritSubtype: spirit.subtype,
    spiritTier: spirit.tier,
    spiritEventKey: eventKey,
    unique: source.unique !== false
  }
}

function collectRecords(spiritEvents, spiritMap, spirits) {
  const spiritById = new Map(spirits.map(spirit => [spirit.id, spirit]))
  const records = []

  for (const source of EVENTS) {
    records.push({
      kind: '静态/扩展',
      raw: source,
      event: adaptEvent(source, { spiritMeta: spiritById.get(source.spiritId) })
    })
  }

  for (const source of Object.values(DYNAMIC_EVENTS)) {
    const raw = { ...source, phase: source.phase || 'any' }
    records.push({ kind: '动态事件', raw, event: adaptEvent(raw) })
  }

  for (const source of Object.values(CHAINED_EVENTS)) {
    records.push({ kind: '连锁事件', raw: source, event: adaptEvent(source) })
  }

  for (const [eventKey, sourceEvents] of Object.entries(spiritEvents)) {
    const spiritId = spiritMap.get(eventKey)
    const spirit = spiritById.get(spiritId)
    if (!spirit) continue
    for (const source of sourceEvents) {
      const raw = normalizeJsonEvent(source, spirit, eventKey)
      records.push({ kind: 'JSON 武魂专属', raw, event: adaptEvent(raw, { spiritMeta: spirit }), spirit })
    }
  }

  return records
}

function textFor(event) {
  return [
    event?.name,
    event?.location,
    ...(Array.isArray(event?.text) ? event.text : [event?.text]),
    ...(event?.choices || []).flatMap(choice => [choice?.text, choice?.result?.text])
  ].filter(Boolean).join(' ')
}

function hasDirectRingGrant(event) {
  if (event?.ring) return false
  return (event?.choices || []).some(choice => {
    const text = `${choice?.text || ''} ${choice?.result?.text || ''}`
    const explicitlyNoRing = /(?:没有|未|无需|不再|拒绝|放弃)[^。！!]{0,12}(?:获得|获取|吸收)[^。！!]{0,8}魂环/.test(text)
    return !explicitlyNoRing && (/获得[^。！!]{0,12}魂环|获取魂环|吸收[^。！!]{0,12}魂环/.test(text) || Boolean(choice?.result?.ring))
  })
}

function formatList(values) {
  return values?.length ? values.join('、') : '—'
}

function reasonFor(record, summary, locationInfo) {
  const event = record.event
  const reasons = []
  if (summary.mainStoryOnly) reasons.push('主线专用，随机池排除')
  if (summary.postAscension) reasons.push('requiresAscension=true，成神后且 ascended 才可触发')
  if (summary.requiredEventIds.length) reasons.push(`前置：${summary.requiredEventIds.join('、')}`)
  if (summary.minRingCount !== undefined) reasons.push(`至少${summary.minRingCount}环`)
  if (summary.requiredRingCount !== undefined) reasons.push(`仅正式猎环第${summary.requiredRingCount + 1}环节点`)
  if (summary.spiritTypes.length || summary.spiritSubtypes.length || summary.spiritTiers.length) reasons.push(`武魂限制：${formatList(summary.spiritTypes)}${formatList(summary.spiritSubtypes)}${formatList(summary.spiritTiers)}`)
  if (event?.unique) reasons.push('唯一事件/完成后不重复')
  if (locationInfo.scope === 'global') reasons.push('全局地点')
  if (locationInfo.scope === 'unknown') reasons.push('地点未映射')
  if (!reasons.length && summary.changed) reasons.push('中央规则统一适配')
  if (!reasons.length) reasons.push('规则复核通过')
  return reasons.join('；')
}

function auditRecords(records, locations) {
  const ids = records.map(record => record.event.id)
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
  const unknownLocations = records.filter(record => classifyEventLocation(record.event.location, locations).scope === 'unknown')
  const invalidPhase = records.filter(record => record.kind !== '动态事件' && !['academy', 'adventure', 'master', 'god', 'any'].includes(record.event.phase))
  const mainStoryLeak = records.filter(record => MAIN_STORY_EVENT_IDS.includes(record.event.id) && record.event.mainStoryOnly !== true)
  const godRandomLeak = records.filter(record => record.event.id.startsWith('god_') && !MAIN_STORY_EVENT_IDS.includes(record.event.id) && record.event.requiresAscension !== true)
  const jsonRecords = records.filter(record => record.kind === 'JSON 武魂专属')
  const jsonSpiritRuleFailures = jsonRecords.filter(record => !record.event.requiredSpiritId || !record.event.spiritTypes?.length || !record.event.spiritSubtypes?.length || !record.event.spiritTiers?.length)
  const directRingGrants = records.filter(record => hasDirectRingGrant(record.event))
  const highRiskFailures = records.filter(record => {
    const text = textFor(record.event)
    if (record.event.ring) return false
    if (/十万年魂兽/.test(text)) return record.event.minLevel < 75 || (record.event.minRingCount || 0) < 6
    if (/万年魂兽|暗金恐爪熊|冰帝蝎|泰坦巨猿王|深海魔鲸王/.test(text)) return record.event.minLevel < 50 || (record.event.minRingCount || 0) < 4
    return false
  })
  const postAscensionEligibilityFailures = records.filter(record => record.event.requiresAscension && isEventEligible(record.event, {
    level: 99,
    phase: 'god',
    ascended: false,
    ringCount: 8,
    spirit: record.spirit,
    locationMatches: true,
    doneEvents: []
  }))
  const specialized = records.filter(record => record.raw.locationActionType)
  const eastSpecialized = specialized.filter(record => classifyEventLocation(record.event.location, locations).id === 'east_sea_port')
  const seaSpecialized = specialized.filter(record => classifyEventLocation(record.event.location, locations).id === 'sea_god_island')
  const specializedFailures = specialized.filter(record => {
    const event = record.event
    const locationId = classifyEventLocation(event.location, locations).id
    return !['east_sea_port', 'sea_god_island'].includes(locationId)
      || !['local_exploration', 'local_commission', 'local_contact'].includes(record.raw.locationActionType)
      || event.ring
      || event.ringOnly
      || event.mainStoryOnly
      || event.requiresAscension
      || !event.image
      || !Array.isArray(event.choices)
      || !event.choices.length
  })

  return {
    total: records.length,
    duplicates,
    unknownLocations,
    invalidPhase,
    mainStoryLeak,
    godRandomLeak,
    jsonSpiritRuleFailures,
    directRingGrants,
    highRiskFailures,
    postAscensionEligibilityFailures,
    specializedCount: specialized.length,
    eastSpecializedCount: eastSpecialized.length,
    seaSpecializedCount: seaSpecialized.length,
    specializedFailures
  }
}

function rowFor(record, locations) {
  const event = record.event
  const spirit = record.spirit
  const summary = eventRuleSummary(record.raw, { spiritMeta: spirit })
  const locationInfo = classifyEventLocation(event.location, locations)
  const status = summary.mainStoryOnly ? '主线专用' : summary.postAscension ? '成神后保留' : summary.changed ? '已修复' : '通过'
  const directRing = event.ring ? '正式猎环事件' : '普通事件不发正式魂环'
  const constraints = [
    `${summary.minLevel}-${summary.maxLevel}级`,
    summary.minRingCount === undefined ? '' : `至少${summary.minRingCount}环`,
    summary.requiredRingCount === undefined ? '' : `第${summary.requiredRingCount + 1}环`,
    summary.postAscension ? '成神后' : '',
    directRing
  ].filter(Boolean).join('；')
  return {
    kind: record.kind,
    id: event.id,
    name: event.name || event.title || '未命名',
    original: `${summary.originalMinLevel}-${summary.originalMaxLevel}级/${summary.originalPhase}`,
    effective: `${summary.minLevel}-${summary.maxLevel}级/${summary.phase}`,
    location: `${event.location || '斗罗大陆'}（${locationInfo.scope === 'global' ? '全局' : locationInfo.scope === 'mapped' ? locationInfo.id : '未映射'}）`,
    spirit: [summary.spiritId, ...summary.spiritTypes, ...summary.spiritSubtypes, ...summary.spiritTiers].filter(Boolean).join(' / ') || '—',
    prerequisites: formatList(summary.requiredEventIds),
    constraints,
    status,
    reason: reasonFor(record, summary, locationInfo)
  }
}

function escapeCell(value) {
  return String(value ?? '').replace(/[|\r\n]+/g, ' ').trim()
}

function buildReport(records, audit, locations) {
  const rows = records.map(record => rowFor(record, locations))
  const failureLines = [
    ['重复 ID', audit.duplicates],
    ['未映射地点', audit.unknownLocations.map(record => record.event.id)],
    ['非法篇章', audit.invalidPhase.map(record => record.event.id)],
    ['主线未隔离', audit.mainStoryLeak.map(record => record.event.id)],
    ['god_ 未成神后隔离', audit.godRandomLeak.map(record => record.event.id)],
    ['JSON 武魂约束缺失', audit.jsonSpiritRuleFailures.map(record => record.event.id)],
    ['普通事件直接发魂环', audit.directRingGrants.map(record => record.event.id)],
    ['高危事件门槛不足', audit.highRiskFailures.map(record => record.event.id)],
    ['成神后事件可被未成神者触发', audit.postAscensionEligibilityFailures.map(record => record.event.id)],
    ['地点专属事件规则', audit.specializedFailures.map(record => record.event.id)]
  ].filter(([, values]) => values.length)

  const lines = [
    '# 事件触发合理性逐项审计',
    '',
    `审计日期：${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())}；审计范围：静态/扩展事件、JSON 武魂专属事件、动态事件、连锁事件。`,
    '',
    `总计 **${audit.total}** 条：静态/扩展 ${records.filter(record => record.kind === '静态/扩展').length}，JSON 武魂专属 ${records.filter(record => record.kind === 'JSON 武魂专属').length}，动态 ${records.filter(record => record.kind === '动态事件').length}，连锁 ${records.filter(record => record.kind === '连锁事件').length}。`,
    '',
    '## 自动审计结论',
    '',
    `- 重复 ID：${audit.duplicates.length ? `失败（${audit.duplicates.join('、')}）` : '通过'}`,
    `- 地点映射或显式全局：${audit.unknownLocations.length ? `失败（${audit.unknownLocations.length} 条）` : '通过'}`,
    `- 主线事件随机池隔离：${audit.mainStoryLeak.length ? `失败（${audit.mainStoryLeak.map(record => record.event.id).join('、')}）` : '通过'}`,
    `- 非主线 god_* 成神后隔离：${audit.godRandomLeak.length ? `失败（${audit.godRandomLeak.map(record => record.event.id).join('、')}）` : '通过'}`,
    `- JSON 武魂 ID/类型/子类/品阶约束：${audit.jsonSpiritRuleFailures.length ? `失败（${audit.jsonSpiritRuleFailures.length} 条）` : '通过'}`,
    `- 普通事件直接发放正式魂环：${audit.directRingGrants.length ? `失败（${audit.directRingGrants.map(record => record.event.id).join('、')}）` : '通过'}`,
    `- 高危魂兽等级与魂环门槛：${audit.highRiskFailures.length ? `失败（${audit.highRiskFailures.map(record => record.event.id).join('、')}）` : '通过'}`,
    `- 未成神状态触发成神后事件：${audit.postAscensionEligibilityFailures.length ? `失败（${audit.postAscensionEligibilityFailures.map(record => record.event.id).join('、')}）` : '通过'}`,
    `- 东海港口/海神岛地点专属事件：${audit.eastSpecializedCount >= 8 && audit.seaSpecializedCount >= 8 && !audit.specializedFailures.length ? `通过（东海港口 ${audit.eastSpecializedCount} 条，海神岛 ${audit.seaSpecializedCount} 条）` : `失败（东海港口 ${audit.eastSpecializedCount} 条，海神岛 ${audit.seaSpecializedCount} 条）`}`,
    '',
    '失败项明细：',
    failureLines.length ? failureLines.map(([label, values]) => `- ${label}：${values.join('、')}`).join('\n') : '- 无',
    '',
    '## 逐项清单',
    '',
    '| 来源 | ID | 事件 | 原等级/篇章 | 修复后有效等级/篇章 | 地点 | 武魂限制 | 剧情前置 | 魂环/成神约束 | 结果 | 规则说明 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(row => `| ${Object.values(row).map(escapeCell).join(' | ')} |`),
    '',
    '## 复核命令',
    '',
    '- `npm run audit:events`：重新生成本报告并在断言失败时返回非零状态。',
    '- `npm test`：执行根目录数据/审计测试与前端 Vitest。',
    '- `npm run test:browser`：执行生产构建后的浏览器烟测。'
  ]
  return lines.join('\n') + '\n'
}

export async function runAudit({ write = false } = {}) {
  const codex = await readJson('public/data/spirit-codex.json')
  const spiritEvents = await readJson('public/data/spirit-events.json')
  const spiritMap = await readJson('public/data/spirit-event-map.json')
  const mapData = await readJson('public/data/map-data.json')
  const mapByKey = new Map((spiritMap.mappings || []).map(entry => [entry.eventKey, entry.spiritId]))
  const records = collectRecords(spiritEvents.spirit_events || {}, mapByKey, codex.spirits || [])
  const locations = mapData.locations || []
  const audit = auditRecords(records, locations)
  if (write) {
    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
    await fs.writeFile(REPORT_PATH, buildReport(records, audit, locations), 'utf8')
  }
  return { records, audit, reportPath: REPORT_PATH }
}

const result = await runAudit({ write: process.argv.includes('--write') })
const { audit } = result
console.log(`事件审计：${audit.total} 条；重复 ID ${audit.duplicates.length}；地点未映射 ${audit.unknownLocations.length}；主线泄漏 ${audit.mainStoryLeak.length}；god_ 泄漏 ${audit.godRandomLeak.length}；直接发魂环 ${audit.directRingGrants.length}`)
if (process.argv.includes('--write')) console.log(`报告已写入：${result.reportPath}`)
const expectedMinimum = 525 + LOCATION_EVENTS.length
const failures = [
  audit.total < expectedMinimum,
  audit.duplicates.length,
  audit.unknownLocations.length,
  audit.invalidPhase.length,
  audit.mainStoryLeak.length,
  audit.godRandomLeak.length,
  audit.jsonSpiritRuleFailures.length,
  audit.directRingGrants.length,
  audit.highRiskFailures.length,
  audit.postAscensionEligibilityFailures.length,
  audit.eastSpecializedCount < 8,
  audit.seaSpecializedCount < 8,
  audit.specializedFailures.length
].some(Boolean)
if (failures) process.exitCode = 1
