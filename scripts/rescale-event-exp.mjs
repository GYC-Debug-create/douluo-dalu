#!/usr/bin/env node
/**
 * 存量事件经验重标定脚本（经济规格 v2）
 *
 * 背景：成长曲线统一为 expNeed(lv)=round(40*lv^1.15)（1→100 累计 367,228）。
 * 事件奖励按阶段档位均值重标（满选项口径）：
 *   academy≈1000 / adventure≈2000 / master≈4000 / god≈8000
 * 单局校准：各阶段事件数 ≈ 阶段经验需求/档位均值 ≈ 27/27/22/25，合计约 101 个
 * 满选项事件走完 1→100。
 *
 * 缩放规则：
 *   refLv      = clamp(minLevel ?? defaultLv[phase], 阶段上下界)
 *   newMax     = round10( TARGETS[phase] * expNeed(refLv) / meanExpNeed(phase) )
 *   choice新值 = round10( newMax * oldChoice / oldMax )，old>0 时下限 10；0 保持 0
 *   只修改 choices[].result.exp 直接字段；battle/item 等嵌套对象内的 exp 不动；
 *   任务奖励、挑战塔、商店等非事件数据一律不动。
 *
 * 双层应用：frontend 数据为 canonical，public 两文件按 id+result 序号套用同一
 * 绝对值（历史漂移的 6 个事件借此归一）。
 *
 * 用法：node scripts/rescale-event-exp.mjs [--apply]
 *   默认 dry-run 只打印摘要；--apply 写入文件并输出 manifest。
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
const TOTAL_NEED_1_100 = 367228

const TARGETS = { academy: 1000, adventure: 2000, master: 4000, god: 8000 }
const BOUNDS = { academy: [1, 10], adventure: [11, 40], master: [41, 70], god: [71, 100] }
const FALLBACK_LV = { academy: 5, adventure: 15, master: 50, god: 80 }

const expNeed = (lv) => Math.round(40 * Math.pow(Math.max(1, Math.floor(lv)), 1.15))
const round10 = (v) => Math.round(v / 10) * 10

const fileUrl = (p) => pathToFileURL(p).href

// ---------- 1. 加载 canonical 池（frontend 合并后 EVENTS，含扩展包与地点事件） ----------
const gdMod = await import(fileUrl(path.join(ROOT, 'frontend/src/data/game-data.js')))
await import(fileUrl(path.join(ROOT, 'frontend/src/data/events-expanded.js'))) // 副作用：push 扩展+地点事件进同一数组
const POOL = gdMod.EVENTS

function phaseOf(e) {
  if (e.phase && TARGETS[e.phase]) return e.phase
  const lv = e.minLevel || 0
  if (lv <= 10) return 'academy'
  if (lv <= 40) return 'adventure'
  if (lv <= 70) return 'master'
  return 'god'
}

const clampLv = (lv, phase) => {
  const [lo, hi] = BOUNDS[phase]
  return Math.min(hi, Math.max(lo, Math.floor(lv)))
}

// ---------- 2. 计算目标值 ----------
const events = []
for (const e of POOL) {
  if (!e || !e.id || !Array.isArray(e.choices) || e.choices.length === 0) continue
  const oldChoices = e.choices.map(c => (c.result && Number.isFinite(+c.result.exp)) ? +c.result.exp : null)
  const maxOld = Math.max(0, ...oldChoices.filter(v => v != null))
  if (!(maxOld > 0)) continue
  const phase = phaseOf(e)
  const knownLv = Number.isFinite(+e.minLevel) ? +e.minLevel : null
  events.push({ id: e.id, phase, minLevel: knownLv, oldChoices, maxOld })
}

// defaultLv：各阶段已知 minLevel 的中位数
const defaults = {}
for (const phase of Object.keys(TARGETS)) {
  const lvs = events.filter(ev => ev.phase === phase && ev.minLevel != null).map(ev => ev.minLevel).sort((a, b) => a - b)
  defaults[phase] = lvs.length ? lvs[Math.floor(lvs.length / 2)] : FALLBACK_LV[phase]
}

for (const ev of events) {
  const refLv = clampLv(ev.minLevel ?? defaults[ev.phase], ev.phase)
  ev.refLevel = refLv
  ev.weight = expNeed(refLv)
}

const meanW = {}
for (const phase of Object.keys(TARGETS)) {
  const list = events.filter(ev => ev.phase === phase)
  meanW[phase] = list.length ? list.reduce((s, ev) => s + ev.weight, 0) / list.length : 1
}

for (const ev of events) {
  const targetMax = round10(TARGETS[ev.phase] * ev.weight / meanW[ev.phase])
  ev.targetMax = targetMax
  ev.newChoices = ev.oldChoices.map(old => {
    if (old == null || old <= 0) return old // 缺失或 0 保持原样
    return Math.max(10, round10(targetMax * old / ev.maxOld))
  })
}

// ---------- 3. 摘要 ----------
const pct = (v) => (v * 100).toFixed(1) + '%'
console.log('=== 重标定摘要（dry-run' + (APPLY ? '关闭：将写入' : '：不写盘') + '）===')
console.log('defaultLv:', JSON.stringify(defaults))
const poolOld = events.reduce((s, ev) => s + ev.maxOld, 0)
const poolNew = events.reduce((s, ev) => s + Math.max(...ev.newChoices), 0)
const byPhaseOld = {}, byPhaseNew = {}
for (const ev of events) {
  byPhaseOld[ev.phase] = byPhaseOld[ev.phase] || { n: 0, sum: 0 }
  byPhaseNew[ev.phase] = byPhaseNew[ev.phase] || { n: 0, sum: 0 }
  byPhaseOld[ev.phase].n++; byPhaseOld[ev.phase].sum += ev.maxOld
  byPhaseNew[ev.phase].n++; byPhaseNew[ev.phase].sum += Math.max(...ev.newChoices)
}
for (const phase of Object.keys(TARGETS)) {
  const o = byPhaseOld[phase] || { n: 0, sum: 0 }; const n = byPhaseNew[phase] || { n: 0, sum: 0 }
  console.log(`  ${phase.padEnd(9)} n=${String(n.n).padStart(4)}  avg ${o.n ? (o.sum / o.n).toFixed(0) : '-'} → ${(n.sum / n.n).toFixed(0)}（目标 ${TARGETS[phase]}）`)
}
console.log(`池总量(满选项): ${poolOld} → ${poolNew}   占1→100总需: ${pct(poolOld / TOTAL_NEED_1_100)} → ${pct(poolNew / TOTAL_NEED_1_100)}`)

// 单局 pacing 校验（事件为唯一经验源）
let cum = 0; const cumAt = {}; for (let l = 1; l <= 99; l++) { cum += expNeed(l); cumAt[l + 1] = cum }
const bandAvg = {}
for (const phase of Object.keys(TARGETS)) {
  const list = byPhaseNew[phase]; bandAvg[phase] = list && list.n ? list.sum / list.n : TARGETS[phase]
}
const bands = [
  ['academy', cumAt[11]],
  ['adventure', cumAt[41] - cumAt[11]],
  ['master', cumAt[71] - cumAt[41]],
  ['god', cumAt[100] - cumAt[71]]
]
const runEvents = bands.reduce((s, [, need]) => s, 0)
let runTotal = 0
for (const [phase, need] of bands) runTotal += need / bandAvg[phase]
console.log(`单局预计消耗（满选项、事件为唯一来源）: ${runTotal.toFixed(0)} 个事件`)

if (!APPLY) {
  console.log('\n(dry-run 结束。确认无误后执行: node scripts/rescale-event-exp.mjs --apply)')
  process.exit(0)
}

// ---------- 4. 文本应用 ----------
const manifest = {}
for (const ev of events) manifest[ev.id] = { phase: ev.phase, refLevel: ev.refLevel, old: ev.oldChoices, new: ev.newChoices }

/** 字符串感知的花括号匹配：返回与 text[start]=='{' 匹配的 '}' 下标 */
function matchBrace(text, start) {
  let depth = 0, quote = null
  for (let p = start; p < text.length; p++) {
    const ch = text[p]
    if (quote) {
      if (ch === '\\') { p++; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return p }
  }
  return -1
}

/** 在 result 块内收集深度=1 的 exp 键位置 */
function directExpTokens(text, start, end) {
  const tokens = []
  let depth = 1, quote = null, p = start + 1
  while (p < end) {
    const ch = text[p]
    if (quote) {
      if (ch === '\\') { p += 2; continue }
      if (ch === quote) quote = null
      p++; continue
    }
    if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; p++; continue }
    if (ch === '{') { depth++; p++; continue }
    if (ch === '}') { depth--; p++; continue }
    if (depth === 1 && /\s/.test(ch) === false && text.startsWith('exp', p)) {
      const before = text[p - 1]
      const m = /^(exp)\s*:\s*(-?\d+)/.exec(text.slice(p))
      const isKeyStart = p === start + 1 || /[{,\s]/.test(before)
      if (m && isKeyStart) {
        tokens.push({ valueStart: p + m[0].indexOf(m[2]), valueLen: m[2].length, value: +m[2], keyEnd: p + m[0].length })
        p += m[0].length; continue
      }
    }
    p++
  }
  return tokens
}

const ID_RE = /\bid\s*:\s*(['"])([A-Za-z0-9_]+)\1/g
const RESULT_RE = /\bresult\s*:\s*\{/g

/**
 * 对单个文件做替换。resolve(eventId, ordinal, oldValue) 返回 newValue 或 null 跳过。
 */
function applyToFile(relPath, resolve) {
  const abs = path.join(ROOT, relPath)
  const text = fs.readFileSync(abs, 'utf8')
  const anchors = []
  let m
  ID_RE.lastIndex = 0
  while ((m = ID_RE.exec(text))) anchors.push({ pos: m.index, id: m[2] })

  const edits = []
  const ordinalByAnchorIdx = new Map()
  const stats = { replaced: 0, skippedNoMap: 0, skippedMismatch: 0 }

  RESULT_RE.lastIndex = 0
  while ((m = RESULT_RE.exec(text))) {
    const blockStart = m.index + m[0].length - 1
    const blockEnd = matchBrace(text, blockStart)
    if (blockEnd < 0) continue

    // 当前事件锚点 = 块之前最近的 id:
    let aIdx = -1
    for (let i = anchors.length - 1; i >= 0; i--) { if (anchors[i].pos < m.index) { aIdx = i; break } }
    if (aIdx < 0) continue
    const eventId = anchors[aIdx].id
    const ordinal = ordinalByAnchorIdx.get(aIdx) || 0
    ordinalByAnchorIdx.set(aIdx, ordinal + 1)

    const toks = directExpTokens(text, blockStart, blockEnd)
    const tok = toks.find(t => t.value > 0) || toks[0]
    if (!tok) continue
    const next = resolve(eventId, ordinal, tok.value, stats)
    if (next == null) continue
    edits.push({ start: tok.valueStart, len: tok.valueLen, value: String(next), eventId, ordinal, old: tok.value })
  }

  edits.sort((a, b) => b.start - a.start)
  let out = text
  for (const e of edits) out = out.slice(0, e.start) + e.value + out.slice(e.start + e.len)
  fs.writeFileSync(abs, out, 'utf8')
  return { file: relPath, edits: edits.length, stats }
}

const seen = new Set()
const results = []

// frontend 三件套：严格校验（旧值必须等于 canonical old）
for (const rel of ['frontend/src/data/game-data.js', 'frontend/src/data/events-expanded.js', 'frontend/src/data/location-events.js']) {
  results.push(applyToFile(rel, (id, ord, oldVal, st) => {
    const rec = manifest[id]
    if (!rec || rec.new[ord] == null) { st.skippedNoMap++; seen.add(id); return null }
    seen.add(id)
    if (rec.old[ord] !== oldVal) { st.skippedMismatch++; return null }
    st.replaced++
    return rec.new[ord]
  }))
}
// public 两件套：宽松模式——直接套用 canonical 绝对值（顺带归一 6 个历史漂移事件）
for (const rel of ['public/game-data.js', 'public/game-events-expanded.js']) {
  if (!fs.existsSync(path.join(ROOT, rel))) { console.log('(跳过不存在文件)', rel); continue }
  results.push(applyToFile(rel, (id, ord, oldVal, st) => {
    const rec = manifest[id]
    if (!rec || rec.new[ord] == null) { st.skippedNoMap++; return null }
    if (rec.old[ord] !== oldVal) console.log(`  [drift-normalize] ${rel} ${id}#${ord}: 文本=${oldVal} canonical=${rec.old[ord]} → ${rec.new[ord]}`)
    st.replaced++
    return rec.new[ord]
  }))
}

for (const r of results) console.log(`${r.file}: 替换 ${r.edits} 处` + (r.stats.skippedNoMap ? `，跳过(无映射) ${r.stats.skippedNoMap}` : '') + (r.stats.skippedMismatch ? `，跳过(旧值不符) ${r.stats.skippedMismatch}` : ''))

// 未被任何文件命中的映射（应只有极少数，如 CHAINED_EVENTS 同名键）
const orphans = Object.keys(manifest).filter(id => !seen.has(id))
if (orphans.length) console.log('未命中文件的事件(仅存在于运行时合并?):', orphans.slice(0, 20).join(','), orphans.length > 20 ? `...共${orphans.length}` : '')

// ---------- 5. manifest 落盘 ----------
fs.writeFileSync(path.join(ROOT, 'scripts/exp-rescale-manifest.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  curve: 'round(40*lv^1.15)',
  totalNeed1100: TOTAL_NEED_1_100,
  targets: TARGETS,
  defaults,
  poolBefore: poolOld,
  poolAfter: poolNew,
  events: manifest
}, null, 2), 'utf8')
console.log('manifest 已写入 scripts/exp-rescale-manifest.json')

// ---------- 6. 自检：重新导入并核对 ----------
const bust = '?v=' + Date.now()
const gd2 = await import(fileUrl(path.join(ROOT, 'frontend/src/data/game-data.js')) + bust)
await import(fileUrl(path.join(ROOT, 'frontend/src/data/events-expanded.js')) + bust)
let bad = 0
for (const e of gd2.EVENTS) {
  const rec = manifest[e.id]
  if (!rec) continue
  for (let k = 0; k < e.choices.length; k++) {
    const cur = e.choices[k]?.result?.exp
    const want = rec.new[k]
    if (want != null && cur !== want) { bad++; if (bad <= 5) console.error('MISMATCH', e.id, '#'+k, 'cur=', cur, 'want=', want) }
  }
}
console.log(bad === 0 ? `自检通过：frontend 合并池 ${gd2.EVENTS.length} 事件与 manifest 一致` : `自检失败：${bad} 处不一致`)
process.exit(bad === 0 ? 0 : 1)
