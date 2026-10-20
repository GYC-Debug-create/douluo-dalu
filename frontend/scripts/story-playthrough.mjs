/**
 * 主线代玩导出：把四条代表路线（覆盖三个大分叉的全部出口）从觉醒走到结局，
 * 输出成孩子会读到的完整故事，供人/AI 按六项标准通读。
 *
 * 用法（在 frontend 目录）：npx vite-node scripts/story-playthrough.mjs [输出目录]
 * 不给输出目录时打印到终端。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import '@/data/events-expanded'
import { REPRESENTATIVE_ROUTES, playRoute, renderPlaythrough, sideEventDensity } from '@/utils/story-playthrough'
import { MAIN_STORY_MILESTONES } from '@/engine/event-rules'

const outDir = process.argv[2]
const plays = REPRESENTATIVE_ROUTES.map(route => playRoute(route))

// 支线密度：每个故事阶段能抽到多少支线（按路线一的记号推进）
const first = plays[0]
const density = MAIN_STORY_MILESTONES.map(item => {
  const index = first.steps.findIndex(step => step.id === item.id)
  const marks = first.steps.slice(0, index).flatMap(step => step.marksAdded)
  return { id: item.id, name: item.name, level: item.minLevel, ...sideEventDensity({ level: item.minLevel, marks }) }
})
const densityText = ['## 支线密度（主线每段开始时，能抽到 / 被连贯性规则挡下的支线数）', '', '| 主线段落 | 等级 | 能抽到 | 被挡下 |', '|---|---|---|---|',
  ...density.map(row => `| ${row.name} | ${row.level} | ${row.eligible} | ${row.gated} |`)].join('\n')

if (outDir) {
  mkdirSync(outDir, { recursive: true })
  plays.forEach((play, index) => writeFileSync(join(outDir, `路线${index + 1}.md`), `# ${play.route.label}\n\n${renderPlaythrough(play)}`, 'utf8'))
  writeFileSync(join(outDir, '支线密度.md'), densityText, 'utf8')
  console.log(`已导出 ${plays.length} 条路线到 ${outDir}`)
  plays.forEach(play => console.log(`- ${play.route.label} → 结局「${play.ending?.title}」`))
} else {
  for (const play of plays) console.log(renderPlaythrough(play), '\n')
  console.log(densityText)
}
