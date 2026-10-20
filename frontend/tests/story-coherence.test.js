/**
 * 剧情连贯性验收（对应产品六项标准）：时间、因果、地点、人物、主角感、认得出。
 * 机器能查的硬错误全部在这里拦下；读起来顺不顺，由 scripts/story-playthrough.mjs 导出的故事人工/AI 通读。
 */
import { describe, expect, it } from 'vitest'
import { EVENTS } from '@/data/game-data'
import '@/data/events-expanded'
import { MAIN_STORY_EVENTS, ENDING_EPILOGUES } from '@/data/main-story'
import { MAIN_STORY_MILESTONES, adaptEvent, isEventEligible, RETIRED_MAIN_STORY_IDS, SEALED_EVENT_IDS } from '@/engine/event-rules'
import {
  CANON_CHARACTERS, metMark, mentionedCanonCharacters, impliedTimelineMarks,
  storyGate, resolveStoryVariants, marksFromChoice
} from '@/engine/story-marks'
import { REPRESENTATIVE_ROUTES, playRoute } from '@/utils/story-playthrough'
import { GLIMPSES } from '@/data/glimpses'

const byId = id => EVENTS.find(event => event.id === id)
const milestoneEvents = () => MAIN_STORY_MILESTONES.map(item => byId(item.id))

// 主线里所有"会产生"的记号
function producedMarks() {
  const marks = new Set(['saw_tangsan_awaken'])
  for (const event of milestoneEvents()) {
    for (const mark of event.completeMarks || []) marks.add(mark)
    for (const name of event.introduces || []) marks.add(metMark(name))
    for (const choice of event.choices || []) {
      for (const mark of choice.marks || []) marks.add(mark)
      for (const mark of choice.result?.defeatOutcome?.marks || []) marks.add(mark)
    }
  }
  return marks
}

// 事件数据里所有"被引用"的记号
function referencedMarks(event) {
  const refs = []
  const take = cond => { if (cond) refs.push(...(cond.marks || []), ...(cond.anyMarks || []), ...(cond.notMarks || [])) }
  for (const variant of event?.variants || []) take(variant)
  for (const choice of event?.choices || []) {
    take(choice.showIf)
    for (const variant of choice.replyVariants || []) take(variant)
  }
  return refs
}

describe('名场面主线：结构', () => {
  it('15 段主线首尾相接，诺丁起步、最终决战收尾，等级递增', () => {
    expect(MAIN_STORY_MILESTONES[0].id).toBe('p02_nuoding')
    expect(MAIN_STORY_MILESTONES.at(-1).id).toBe('final_evil')
    MAIN_STORY_MILESTONES.forEach((item, index) => {
      expect(byId(item.id), item.id).toBeTruthy()
      if (index > 0) expect(item.minLevel).toBeGreaterThan(MAIN_STORY_MILESTONES[index - 1].minLevel)
    })
  })

  it('每段主线都有至少两个选择，而且每个选择都会留下记号（主角的决定会被记住）', () => {
    for (const event of milestoneEvents()) {
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(2)
      for (const choice of event.choices) {
        expect((choice.marks || []).length, `${event.id}/${choice.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('三个大分叉：小舞的秘密有"救下/睡着"两种结果，海神岛四条路，最终决战两种打法', () => {
    const a = byId('p11_xiaowu').choices
    const aMarks = new Set(a.flatMap(c => [...(c.marks || []), ...(c.result?.defeatOutcome?.marks || [])]))
    expect(aMarks.has('xiaowu_saved')).toBe(true)
    expect(aMarks.has('xiaowu_asleep')).toBe(true)
    expect(byId('p14_sea_god').choices.map(c => c.marks[0]).sort()).toEqual(['b_companion', 'b_guardian', 'b_own_path', 'b_wisdom'])
    expect(byId('final_evil').choices.map(c => c.marks[0]).sort()).toEqual(['c_awakened', 'c_defeated'])
  })

  it('旧主线节点与冲突支线全部退役，任何入口都抽不到', () => {
    for (const id of [...RETIRED_MAIN_STORY_IDS, ...SEALED_EVENT_IDS]) {
      const event = adaptEvent(byId(id))
      expect(event, id).toBeTruthy()
      expect(isEventEligible(event, { level: 99, ringCount: 9, isMainStory: true, locationMatches: true }), id).toBe(false)
      expect(isEventEligible(event, { level: 99, ringCount: 9, isMainStory: false, locationMatches: true }), id).toBe(false)
    }
  })
})

describe('名场面主线：人物与因果（世界账本）', () => {
  it('人物：每段主线提到的原著人物，都已在这一段或之前正式认识', () => {
    const met = new Set()
    for (const event of milestoneEvents()) {
      for (const name of event.introduces || []) met.add(name)
      const mentioned = mentionedCanonCharacters(event)
      const unknown = mentioned.filter(name => !met.has(name))
      expect(unknown, `${event.id} 提到了还没认识的人`).toEqual([])
    }
  })

  it('时间：每段主线隐含的故事进度（诺丁/史莱克/八怪/大赛）都已发生', () => {
    const happened = new Set()
    for (const event of milestoneEvents()) {
      for (const mark of event.completeMarks || []) happened.add(mark)
      const missing = impliedTimelineMarks(event).filter(mark => !happened.has(mark))
      expect(missing, `${event.id} 的文字超前于故事进度`).toEqual([])
    }
  })

  it('因果：剧情里引用的每个记号，都由更早的某个选择产生（不会引用不存在的往事）', () => {
    const produced = producedMarks()
    const order = new Map(MAIN_STORY_MILESTONES.map((item, index) => [item.id, index]))
    const producedAt = new Map()
    for (const event of milestoneEvents()) {
      const index = order.get(event.id)
      const marks = [
        ...(event.completeMarks || []), ...(event.introduces || []).map(metMark),
        ...event.choices.flatMap(c => [...(c.marks || []), ...(c.result?.defeatOutcome?.marks || [])])
      ]
      for (const mark of marks) if (!producedAt.has(mark)) producedAt.set(mark, index)
    }
    producedAt.set('saw_tangsan_awaken', -1)
    for (const event of [...milestoneEvents(), byId('ring_hunt_10')]) {
      // 第一魂环发生在"大师的考验"（第 2 段）之后
      const index = order.has(event.id) ? order.get(event.id) : 1.5
      for (const mark of referencedMarks(event)) {
        expect(produced.has(mark), `${event.id} 引用了不存在的记号 ${mark}`).toBe(true)
        expect(producedAt.get(mark), `${event.id} 引用的 ${mark} 要到后面才会产生`).toBeLessThan(index)
      }
    }
    for (const epilogue of ENDING_EPILOGUES) {
      for (const mark of [...(epilogue.marks || []), ...(epilogue.notMarks || [])]) {
        expect(produced.has(mark), `结局尾声引用了不存在的记号 ${mark}`).toBe(true)
      }
    }
  })

  it('支线闸门：没在主线认识唐三之前，提到唐三的支线不会出现；认识以后才会出现', () => {
    const spar = adaptEvent(byId('playground_spar'))
    expect(storyGate(spar, []).ok).toBe(false)
    expect(storyGate(spar, [metMark('唐三'), 'joined_shrek']).ok).toBe(true)
    const ctx = marks => ({ level: 20, ringCount: 2, locationMatches: true, storyMarks: marks })
    expect(isEventEligible(spar, ctx([]))).toBe(false)
    expect(isEventEligible(spar, ctx([metMark('唐三'), 'joined_shrek']))).toBe(true)
  })

  it('支线里写到史莱克的事件，要等正式考进史莱克以后才会出现', () => {
    const shrekEvents = EVENTS.map(e => adaptEvent(e)).filter(e => !e.mainStoryOnly && !e.ringOnly && impliedTimelineMarks(e).includes('joined_shrek'))
    expect(shrekEvents.length).toBeGreaterThan(20)
    for (const event of shrekEvents) expect(storyGate(event, []).missing, event.id).toContain('joined_shrek')
  })

  it('人物名单里的每个原著人物，都由某段主线正式介绍', () => {
    const introduced = new Set(milestoneEvents().flatMap(e => e.introduces || []))
    for (const character of CANON_CHARACTERS) {
      expect(introduced.has(character.id), character.id).toBe(true)
    }
  })
})

describe('名场面主线：四条代表路线从头走到尾', () => {
  const plays = REPRESENTATIVE_ROUTES.map(route => playRoute(route))

  it('每条路线都能走完，并且四条路线走向四种不同的结局', () => {
    for (const play of plays) {
      expect(play.steps.length, play.route.id).toBeGreaterThanOrEqual(MAIN_STORY_MILESTONES.length + 1)
      expect(play.ending?.tendency, play.route.id).toBeTruthy()
    }
    expect(new Set(plays.map(play => play.ending.id)).size).toBe(4)
  })

  it('小舞睡着的路线，结局里她一定会醒来；救下她的路线，不会出现"睡着"的文字', () => {
    for (const play of plays) {
      const ending = play.endingText.join('')
      if (play.marks.includes('xiaowu_asleep')) {
        expect(ending, play.route.id).toContain('小舞睁开了眼睛')
        expect(play.marks.includes('xiaowu_saved'), play.route.id).toBe(false)
      }
      if (play.marks.includes('xiaowu_saved')) {
        const later = play.steps.slice(play.steps.findIndex(s => s.id === 'p11_xiaowu') + 1)
        expect(later.some(step => step.text.join('').includes('睡着的小兔子') || step.text.join('').includes('香囊')), play.route.id).toBe(false)
      }
    }
  })

  it('孩子读到的文字里没有占位符、没有不合适的词', () => {
    const banned = /喝酒|醉酒|大醉|宿醉|酒馆|酒楼|赌场|赌注|尸体|斩杀|血腥|杀死|死掉/
    for (const play of plays) {
      const all = [...play.steps.flatMap(s => [...s.text, s.choice, s.result]), ...play.endingText].join('\n')
      expect(all, play.route.id).not.toMatch(/\{(name|spirit|ringLabel|origin)\}/)
      expect(all, play.route.id).not.toMatch(banned)
    }
  })

  it('圣魂村出身的孩子，在诺丁宿舍会认出觉醒那天的蓝银草男孩', () => {
    const play = plays.find(p => p.route.origin === 'star_forest')
    const nuoding = play.steps.find(step => step.id === 'p02_nuoding')
    expect(nuoding.text.join('')).toContain('蓝银草的男孩')
    const other = plays.find(p => p.route.origin !== 'star_forest')
    expect(other.steps.find(step => step.id === 'p02_nuoding').text.join('')).not.toContain('蓝银草的男孩')
  })
})

describe('远远看一眼', () => {
  it('每个有等级门槛的地点都有一段远眺描写，且不点名原著人物', () => {
    for (const [id, text] of Object.entries(GLIMPSES)) {
      expect(mentionedCanonCharacters({ text }), id).toEqual([])
    }
    expect(Object.keys(GLIMPSES).length).toBeGreaterThanOrEqual(25)
  })
})

describe('名场面主线：数据自洽', () => {
  it('主线事件全部登记进事件库，且 id 唯一', () => {
    for (const event of MAIN_STORY_EVENTS) expect(byId(event.id), event.id).toBe(event)
  })

  it('展开记号后，主线每段至少还有一个可选项', () => {
    for (const event of milestoneEvents()) {
      const shown = resolveStoryVariants(adaptEvent(event), [])
      expect(shown.choices.length, event.id).toBeGreaterThan(0)
      expect(marksFromChoice(event, shown.choices[0]).length, event.id).toBeGreaterThan(0)
    }
  })
})
