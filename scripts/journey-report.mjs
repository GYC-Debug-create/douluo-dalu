#!/usr/bin/env node
/**
 * 旅程复盘报告：把存档里的旅程记录（_journeyLog）整理成一篇按时间排列的"故事流水"，
 * 供人或 AI 阅读，检查剧情是否连贯、孩子在哪里停留最久、哪里点得飞快（可能没读）。
 *
 * 用法：
 *   node scripts/journey-report.mjs                 列出 data/ 下所有云存档的概况
 *   node scripts/journey-report.mjs <玩家名或存档文件>  输出该存档的完整复盘（Markdown）
 *
 * 只读：不会修改任何存档。存档含个人数据，报告请勿外传。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = resolve(process.env.DATA_DIR || join(root, 'data'))

const KIND_LABEL = {
  story: '主线', event: '事件', ring: '猎环', battle: '战斗', travel: '旅行',
  glimpse: '远眺', branch: '分叉', ending: '结局'
}
const BATTLE_RESULT = { victory: '胜利', defeat: '失利', escape: '撤退' }

function loadSaves() {
  if (!existsSync(DATA_DIR)) return []
  return readdirSync(DATA_DIR)
    .filter(file => /^player_.*\.json$/.test(file))
    .map(file => {
      try {
        const raw = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))
        return { file, save: raw.data && typeof raw.data === 'object' ? raw.data : raw }
      } catch { return null }
    })
    .filter(Boolean)
}

function seconds(ms) {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`
  return `${Math.round(ms / 60000)}分钟`
}

function summary({ file, save }) {
  const log = Array.isArray(save._journeyLog) ? save._journeyLog : []
  return `- ${save.name || '(未命名)'} · Lv.${save.level || 1} · 记录 ${log.length} 条 · ${file}`
}

function report({ file, save }) {
  const log = Array.isArray(save._journeyLog) ? save._journeyLog : []
  const marks = Array.isArray(save._storyMarks) ? save._storyMarks : []
  const lines = []
  lines.push(`# 旅程复盘：${save.name || '(未命名)'}`)
  lines.push('')
  lines.push(`- 存档：${file}`)
  lines.push(`- 当前等级：Lv.${save.level || 1}；武魂：${save.spirit?.name || '未知'}；出身：${save.originName || save.origin || '未知'}`)
  lines.push(`- 旅程记录：${log.length} 条`)
  const met = marks.filter(m => m.startsWith('met:')).map(m => m.slice(4))
  const glimpsed = marks.filter(m => m.startsWith('glimpsed:')).map(m => m.slice(9))
  const story = marks.filter(m => !/^(met|glimpsed|arrived):/.test(m))
  lines.push(`- 认识的原著人物：${met.join('、') || '（还没有）'}`)
  lines.push(`- 世界账本记号：${story.join('、') || '（还没有）'}`)
  if (glimpsed.length) lines.push(`- 远远望见过：${glimpsed.join('、')}`)
  lines.push('')

  // 停留时间：本条与下一条的时间差（孩子读这一段+做选择花了多久）
  const flagsFast = []
  const flagsSlow = []
  lines.push('## 流水')
  lines.push('')
  lines.push('| # | 等级 | 地点 | 类型 | 内容 | 选择/结果 | 停留 |')
  lines.push('|---|---|---|---|---|---|---|')
  log.forEach((item, index) => {
    const next = log[index + 1]
    const dwell = next && item.t && next.t ? next.t - item.t : NaN
    const kind = KIND_LABEL[item.k] || item.k || ''
    const pick = item.k === 'battle'
      ? (BATTLE_RESULT[item.result] || item.result || '')
      : [item.pick, item.marks?.length ? `〔记号：${item.marks.join('、')}〕` : ''].filter(Boolean).join(' ')
    lines.push(`| ${index + 1} | ${item.lv ?? ''} | ${item.loc || item.from || ''} | ${kind} | ${item.title || item.id || ''} | ${pick.replace(/\|/g, '｜')} | ${seconds(dwell)} |`)
    if ((item.k === 'story' || item.k === 'event') && dwell < 3000) flagsFast.push(`${index + 1}. ${item.title}（${seconds(dwell)}）`)
    if (dwell > 10 * 60000) flagsSlow.push(`${index + 1}. ${item.title}（${seconds(dwell)}）`)
  })
  lines.push('')
  lines.push('## 值得留意')
  lines.push('')
  lines.push(`- 3 秒内就做了选择（可能没读文字）：${flagsFast.length} 处`)
  flagsFast.slice(0, 30).forEach(text => lines.push(`  - ${text}`))
  lines.push(`- 停留超过 10 分钟（可能卡住或离开了）：${flagsSlow.length} 处`)
  flagsSlow.slice(0, 30).forEach(text => lines.push(`  - ${text}`))
  const defeats = log.filter(item => item.k === 'battle' && item.result === 'defeat').length
  lines.push(`- 战斗失利：${defeats} 次`)
  return lines.join('\n')
}

const target = process.argv[2]
const saves = loadSaves()
if (!target) {
  if (!saves.length) {
    console.log(`在 ${DATA_DIR} 下没有找到云存档。登录账号后玩游戏，进度会自动同步到这里。`)
  } else {
    console.log(`共 ${saves.length} 个云存档：`)
    saves.forEach(entry => console.log(summary(entry)))
    console.log('\n输出某个存档的完整复盘：node scripts/journey-report.mjs <玩家名或文件名>')
  }
} else {
  let entry = saves.find(item => item.file === target || item.save.name === target || item.save.playerId === target)
  if (!entry && existsSync(target)) {
    const raw = JSON.parse(readFileSync(target, 'utf8'))
    entry = { file: target, save: raw.data && typeof raw.data === 'object' ? raw.data : raw }
  }
  if (!entry) {
    console.error(`没有找到「${target}」的存档。不带参数运行可以列出所有存档。`)
    process.exit(1)
  }
  console.log(report(entry))
}
