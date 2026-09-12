#!/usr/bin/env node
/**
 * 数据单源同步（阶段三 3.1）
 *
 * frontend/src/data/game-data.js 是剧情与静态数据的唯一来源；
 * 本脚本在构建时把它转译为旧轨（public/game.html 等）使用的全局变量格式，
 * 生成 public/game-data.js，杜绝两份 1900 行数据靠人肉同步。
 *
 * 转译规则：`export const X =` → 分节注释 + `const X =`（旧轨页面按同作用域
 * 全局常量消费）。生成后做结构指纹校验：在 vm 里执行产物并与 ESM 源逐常量
 * 深比较（函数按 ƒ(参数个数) 占位），任何不一致即构建失败。
 *
 * 兼容性：产物保留 `const EVENTS = [` 与 `// ==================== 结局库`
 * 标记，scripts/validate-data.js 依赖这两个标记定位数据。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const SOURCE = join(root, 'frontend', 'src', 'data', 'game-data.js')
const TARGET = join(root, 'public', 'game-data.js')

// 分节注释映射：与历史 public/game-data.js 的分节保持一致（validate-data.js
// 依赖"结局库"标记定位 EVENTS 数据段）。
const SECTION_HEADERS = {
  ORIGINS: '出身',
  SKILL_TREE: '技能树系统',
  ACHIEVEMENTS: '成就系统',
  TITLES: '称号系统',
  EVENTS: '事件库',
  ENDINGS: '结局库',
  STORY_BRANCHES: '剧情分支系统',
  CHALLENGE_TOWER: '挑战塔',
  DAILY_REWARDS: '每日签到',
  FORGE_RECIPES: '魂骨锻造',
  QUESTS: '支线任务',
  NPC_RELATION_LEVELS: 'NPC好感度系统',
  TUTORIAL_STEPS: '新手引导',
  SHOP_ITEMS: '商店系统',
  TRAINING_OPTIONS: '修炼系统',
  DYNAMIC_EVENTS: '动态事件系统',
  CHAINED_EVENTS: '连锁事件系统',
  TIME_PERIODS: '时间/天气系统'
}

const EXPORT_RE = /^export const ([A-Z_]+) =/gm

// Legacy 专属等价变换：first_hunt 的三条结果文本在旧轨是"静态富文本后缀"
// （旧轨 game.js 没有运行时注入）；Vue 端由 prepareFirstHuntEvent 动态生成
// 同类文案（源数据必须保持干净，见 first-hunt-status.test.js）。
// 生成器在此把静态后缀补回产物，等价还原旧轨行为。
const LEGACY_FIRST_HUNT_SUFFIX =
  "<br><br><span style=\"color:#7fc48c\">✦ 实战训练完成。当前等级未达到 Lv.10，暂不能吸收魂环。达到 Lv.10 后可正式猎取第一魂环。</span>"
const FIRST_HUNT_RESULT_ANCHORS = [
  "result: { text: '你大吼一声冲了出去，{spirit}的光芒照亮了林间！'",
  "result: { text: '你们摆开阵型，有人佯攻有人包抄。独眼狼左支右绌，最终被你们合力制服。团队的胜利！'",
  "result: { text: '你紧张地跟在队尾，关键时刻补上了最后一击！虽然有点不好意思，但大师说：\"懂得审时度势，也是本事。\"'"
]

function applyLegacyTransforms(text) {
  let injected = 0
  for (const anchor of FIRST_HUNT_RESULT_ANCHORS) {
    const index = text.indexOf(anchor)
    if (index < 0) continue
    const insertAt = index + anchor.length - 1 // 插在结束引号之前
    text = text.slice(0, insertAt) + LEGACY_FIRST_HUNT_SUFFIX + text.slice(insertAt)
    injected++
  }
  return { text, injected }
}

function transform(source) {
  const banner = [
    '/**',
    ' * 斗罗大陆·武魂觉醒 —— 剧情与静态数据（旧轨全局变量版）',
    ' * ⚠️ 本文件由 scripts/sync-legacy-data.mjs 在构建时自动生成，禁止手改；',
    ' *    唯一数据源：frontend/src/data/game-data.js（改动请改源文件后重新 build）。',
    ' * 约定：文本中 {name}=主角名 {spirit}=武魂名',
    ' * 选项: text/cond/cost/result{ text,exp,gold,hp,heal,damage,maxHp,mp,attack,defense,speed,fate,item,evolve,spiritPowerGain,battle,next }',
    ' * 兼容规则：hp 仅表示当前生命变化；新内容优先使用 heal、damage、maxHp 明确区分语义。',
    ' * 事件: id,name,location,phase,unique,weight,minLevel,ring,text[],choices[]',
    ' */',
    '',
    "'use strict';",
    ''
  ].join('\n')

  // 去掉源文件头部的 JSDoc 块（第 1-8 行），其余原样保留
  const body = source.replace(/^\/\*\*[\s\S]*?\*\//, '').replace(/^\s+/, '')

  let changed = 0
  let out = body.replace(EXPORT_RE, (match, name) => {
    changed++
    const header = SECTION_HEADERS[name]
      ? `// ==================== ${SECTION_HEADERS[name]} ====================\n`
      : ''
    return `${header}const ${name} =`
  })

  const { text: transformed, injected } = applyLegacyTransforms(out)
  if (injected !== FIRST_HUNT_RESULT_ANCHORS.length) {
    console.error(`✗ legacy 静态后缀注入 ${injected}/${FIRST_HUNT_RESULT_ANCHORS.length} 处——first_hunt 锚点文本可能已变化，请更新本脚本`)
    process.exit(1)
  }
  out = transformed
  out = banner + out

  return { out, changed }
}

// 结构指纹：函数不可 JSON 序列化，按"类型+参数个数"占位
function fingerprint(value) {
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'function') return `ƒ(${val.length})`
    return val
  })
}

// 递归剥离 legacy 注入的静态后缀，使产物可与干净的数据源对齐比较
function stripLegacySuffix(value) {
  if (typeof value === 'string') return value.split(LEGACY_FIRST_HUNT_SUFFIX).join('')
  if (Array.isArray(value)) return value.map(stripLegacySuffix)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) out[key] = stripLegacySuffix(val)
    return out
  }
  return value
}

async function verify(sourcePath, generated) {
  // Windows 下 ESM 动态 import 必须使用 file:// URL
  const source = await import(pathToFileURL(sourcePath).href + `?t=${Date.now()}`)
  const context = {}
  vm.createContext(context)
  vm.runInContext(`${generated}\nthis.__EXPORTS__ = { ${Object.keys(SECTION_HEADERS).concat(['WEATHER_TYPES']).join(', ')} };`, context, { timeout: 5000 })
  const built = context.__EXPORTS__
  const problems = []
  for (const name of Object.keys(built)) {
    const fromSource = source[name]
    if (fromSource === undefined) {
      problems.push(`${name}: 源文件中不存在`)
      continue
    }
    if (fingerprint(fromSource) !== fingerprint(stripLegacySuffix(built[name]))) {
      problems.push(`${name}: 产物与源数据不一致`)
    }
  }
  return problems
}

const source = readFileSync(SOURCE, 'utf8')
const { out, changed } = transform(source)

if (changed !== Object.keys(SECTION_HEADERS).length + 1) { // +1 = WEATHER_TYPES 无分节
  console.error(`✗ 转译到 ${changed} 个导出，预期 ${Object.keys(SECTION_HEADERS).length + 1} 个——源文件的 export 列表可能已变化，请更新本脚本的 SECTION_HEADERS`)
  process.exit(1)
}

const problems = await verify(SOURCE, out)
if (problems.length) {
  console.error('✗ 生成产物与数据源不一致：')
  for (const problem of problems) console.error('  - ' + problem)
  process.exit(1)
}

// 兼容性标记检查（validate-data.js 依赖）
for (const marker of ['const EVENTS = [', '// ==================== 结局库 ====================']) {
  if (!out.includes(marker)) {
    console.error(`✗ 产物缺少必需标记：${marker}`)
    process.exit(1)
  }
}

writeFileSync(TARGET, out, 'utf8')
console.log(`✓ 已生成 public/game-data.js（${out.split('\n').length} 行，${changed} 个常量，结构指纹校验通过）`)
