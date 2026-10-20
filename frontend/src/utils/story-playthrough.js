/**
 * 主线代玩（纯函数）：按一条"路线"（每个名场面选哪一项、哪一战失利）把主线从觉醒走到结局，
 * 产出孩子会读到的完整文字。用于：
 *   1. 自动测试（tests/story-coherence.test.js）检查每条路线都讲得通；
 *   2. 导出"故事"给人/AI 通读（frontend/scripts/story-playthrough.mjs）。
 *
 * 只模拟主线、序章与猎环开场的文字和记号，不模拟数值成长。
 */
import { EVENTS, ENDINGS } from '@/data/game-data'
import { MAIN_STORY_EVENTS, ENDING_EPILOGUES } from '@/data/main-story'
import { buildPrologueEvent } from '@/data/story-intro'
import { MAIN_STORY_MILESTONES, adaptEvent, isEventEligible } from '@/engine/event-rules'
import { resolveStoryVariants, marksFromChoice, resolveEndingEpilogue, storyGate } from '@/engine/story-marks'
import { fillEventTemplates, fillTemplate, plainText, phaseForLevel } from '@/engine/rules'
import { endingTendency, pickEnding } from '@/engine/settlement'
import { INTRO_ORIGINS } from '@/data/story-intro'

const ALL_EVENTS = () => {
  const map = new Map(EVENTS.map(event => [event.id, event]))
  for (const event of MAIN_STORY_EVENTS) if (!map.has(event.id)) map.set(event.id, event)
  return map
}

// 第一魂环的开场跟在"大师的考验"之后（Lv.10），用来检查猎环文字也认账。
const RING_AFTER = Object.freeze({ p03_master: 'ring_hunt_10' })

/**
 * 预设的四条代表路线：合起来覆盖三个大分叉的全部出口。
 */
export const REPRESENTATIVE_ROUTES = Object.freeze([
  {
    id: 'route_guard_brave', label: '路线一：挡在小舞前面并打赢 · 陪唐三闯九考 · 正面击败',
    origin: 'star_forest', player: { name: '小林', spirit: '火龙' }, pick: 0,
    picks: { p11_xiaowu: 'stand_guard', p14_sea_god: 'with_tangsan', final_evil: 'defeat' }
  },
  {
    id: 'route_lost_guardian', label: '路线二：挡在小舞前面但输了 · 留岛守护 · 唤醒比比东',
    origin: 'border_town', player: { name: '阿辰', spirit: '蓝电狼' }, pick: 1,
    picks: { p11_xiaowu: 'stand_guard', p14_sea_god: 'guard_friends', final_evil: 'awaken' },
    defeats: ['p11_xiaowu']
  },
  {
    id: 'route_titan_free', label: '路线三：向巨猿行礼、跟它逃走 · 寻找自己的传承 · 正面击败',
    origin: 'spirit_city', player: { name: '星星', spirit: '凤凰' }, pick: 2,
    picks: { p06_titan: 'bow', p11_xiaowu: 'run_with_titan', p14_sea_god: 'own_path', final_evil: 'defeat' }
  },
  {
    id: 'route_trust_wise', label: '路线四：相信小舞的决定 · 向海神请教 · 唤醒比比东',
    origin: 'sea_island', player: { name: '小海', spirit: '海螺' }, pick: 0,
    picks: { p11_xiaowu: 'trust_her', p14_sea_god: 'ask_sea_god', final_evil: 'awaken' }
  }
])

function pickChoice(event, route) {
  const visible = event.choices || []
  const wanted = route.picks?.[event.id]
  if (wanted) {
    const found = visible.find(choice => choice.id === wanted)
    if (!found) throw new Error(`路线 ${route.id}：${event.id} 没有可选的「${wanted}」（可能被记号条件隐藏了）`)
    return found
  }
  const index = Math.min(visible.length - 1, Math.max(0, Number(route.pick) || 0))
  return visible[index]
}

function textOf(event) {
  return (Array.isArray(event.text) ? event.text : [event.text]).filter(Boolean)
}

/**
 * 统计某个故事阶段（等级、记号、所在地）里能抽到的支线数量，以及被连贯性闸门挡下的数量。
 */
export function sideEventDensity({ level, marks, events = EVENTS }) {
  let eligible = 0
  let gated = 0
  for (const source of events) {
    const event = adaptEvent(source)
    if (event.mainStoryOnly || event.ringOnly || event.retired) continue
    const base = { level, phase: phaseForLevel(level), ringCount: Math.floor(level / 10), doneEvents: [], locationMatches: true, isMainStory: false }
    if (!isEventEligible(event, base)) continue
    if (storyGate(event, marks).ok) eligible++
    else gated++
  }
  return { eligible, gated }
}

/**
 * 按路线代玩一遍主线。返回 { route, steps, marks, path, ending, epilogue, lines }。
 * steps 每项：{ id, name, level, location, text[], choice, result, marksAdded[] }
 */
export function playRoute(route) {
  const events = ALL_EVENTS()
  const values = { name: route.player?.name || '小林', spirit: route.player?.spirit || '武魂', origin: INTRO_ORIGINS[route.origin]?.place || '家乡' }
  const marks = []
  const path = []
  const steps = []
  const defeats = new Set(route.defeats || [])

  const play = (rawEvent, { level, isMain }) => {
    const adapted = isMain === false ? rawEvent : adaptEvent(rawEvent)
    const resolved = resolveStoryVariants(adapted, marks)
    const shown = fillEventTemplates(resolved, values)
    const choice = pickChoice(shown, route)
    let added
    let result
    const defeat = defeats.has(rawEvent.id) && choice.result?.defeatOutcome
    if (defeat) {
      added = [...choice.result.defeatOutcome.marks, ...marksFromChoice(rawEvent, { marks: [] })]
      result = fillTemplate(choice.result.defeatOutcome.text, values)
    } else {
      added = marksFromChoice(rawEvent, choice)
      result = choice.reply || choice.result?.text || ''
    }
    if (rawEvent.closing) result = [result, fillTemplate(rawEvent.closing, values)].filter(Boolean).join('\n')
    for (const mark of added) if (!marks.includes(mark)) marks.push(mark)
    if (choice.path) for (let i = 0; i < Math.max(1, Number(choice.pathWeight) || 1); i++) path.push(choice.path)
    steps.push({
      id: rawEvent.id, name: shown.name, level, location: shown.location,
      text: textOf(shown).map(plainText), choice: plainText(choice.text || ''),
      result: plainText(result), defeat: Boolean(defeat), marksAdded: added
    })
  }

  // 序章：武魂觉醒（圣魂村出身会和唐三同一天觉醒）
  const prologue = buildPrologueEvent({ origin: route.origin, originName: values.origin, name: values.name, spirit: { name: values.spirit }, innatePower: 6, _personality: { traits: ['勇敢'] } })
  play(prologue, { level: 1, isMain: false })

  for (const milestone of MAIN_STORY_MILESTONES) {
    const event = events.get(milestone.id)
    if (!event) throw new Error(`缺少主线事件 ${milestone.id}`)
    play(event, { level: milestone.minLevel, isMain: true })
    const ringId = RING_AFTER[milestone.id]
    if (ringId && events.get(ringId)) play(events.get(ringId), { level: 10, isMain: true })
  }

  const G = { _storyMarks: marks, _storyPath: path }
  const tendency = endingTendency(G)
  const ending = pickEnding(ENDINGS, 0, G)
  const epilogue = resolveEndingEpilogue(ENDING_EPILOGUES, marks)
  const endingText = [...epilogue.before, ...(ending?.text || []), ...epilogue.after].map(line => plainText(fillTemplate(line, values)))
  return { route, steps, marks, path, tendency, ending, endingText }
}

/** 把一次代玩写成可通读的 Markdown 故事。 */
export function renderPlaythrough(play) {
  const lines = [`## ${play.route.label}`, '', `出身：${INTRO_ORIGINS[play.route.origin]?.place || play.route.origin}；名字：${play.route.player?.name}；武魂：${play.route.player?.spirit}`, '']
  for (const step of play.steps) {
    lines.push(`### Lv.${step.level} ${step.name}（${step.location || ''}）`, '')
    for (const paragraph of step.text) lines.push(paragraph, '')
    lines.push(`> **选择**：${step.choice}${step.defeat ? '（这一战输了）' : ''}`, '')
    for (const paragraph of step.result.split('\n')) lines.push(paragraph, '')
    if (step.marksAdded.length) lines.push(`<sub>记号：${step.marksAdded.join('、')}</sub>`, '')
  }
  lines.push(`### 结局：${play.ending?.title || '（无）'}`, '')
  for (const paragraph of play.endingText) lines.push(paragraph, '')
  return lines.join('\n')
}
