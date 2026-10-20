import { describe, expect, it } from 'vitest'
import { fillTemplate, fillEventTemplates, seasonForGameTime, experienceNeededForLevel, lateGameExpMultiplier } from '@/engine/rules'
import { MAIN_STORY_MILESTONES, nextMainStoryMilestone, isEventEligible, adaptEvent } from '@/engine/event-rules'
import { encounterDifficulty } from '@/engine/battle-contract'
import { scaleEnemyToPlayer, ENCOUNTER_PRESETS } from '@/engine/battle-core'
import { dominantTendency, pickEnding, endingHonors } from '@/engine/settlement'
import { buildChildGuide } from '@/utils/child-mode'
import { EVENTS, ENDINGS } from '@/data/game-data'
import '@/data/events-expanded'

describe('儿童版：剧情占位符', () => {
  it('替换 {name}/{spirit}/{ringLabel}，缺值时用中性兜底词，永不露出花括号', () => {
    expect(fillTemplate('{name}的{spirit}获得了{ringLabel}', { name: '林远', spirit: '水壶', ringLabel: '百年魂环' }))
      .toBe('林远的水壶获得了百年魂环')
    expect(fillTemplate('{name}的{spirit}获得了{ringLabel}', {})).toBe('你的武魂获得了新的魂环')
  })

  it('玩家名先转义再替换，不能注入标签', () => {
    expect(fillTemplate('欢迎{name}', { name: '<b>x</b>' })).toBe('欢迎&lt;b&gt;x&lt;/b&gt;')
  })

  it('整个事件的正文、选项、结果都会替换，且不修改原数据', () => {
    const source = { name: '{name}的事', text: ['你好{name}'], choices: [{ text: '用{spirit}', result: { text: '{spirit}亮了' } }] }
    const before = JSON.stringify(source)
    const filled = fillEventTemplates(source, { name: '小风', spirit: '蓝银草' })
    expect(filled.text[0]).toBe('你好小风')
    expect(filled.choices[0].text).toBe('用蓝银草')
    expect(filled.choices[0].result.text).toBe('蓝银草亮了')
    expect(JSON.stringify(source)).toBe(before)
  })

  it('数据里所有带占位符的文本都能被替换干净', () => {
    for (const event of EVENTS) {
      const filled = JSON.stringify(fillEventTemplates(event, { name: 'A', spirit: 'B', ringLabel: 'C', origin: 'D' }))
      expect(filled, event.id).not.toMatch(/\{(name|spirit|ringLabel|origin)\}/)
    }
  })
})

describe('儿童版：主线', () => {
  it('主线是一条直线，每段都依赖上一段，大约每 5~10 级一段', () => {
    expect(MAIN_STORY_MILESTONES.length).toBeGreaterThanOrEqual(15)
    MAIN_STORY_MILESTONES.forEach((item, index) => {
      if (index > 0) {
        expect(item.requires).toEqual([MAIN_STORY_MILESTONES[index - 1].id])
        expect(item.minLevel - MAIN_STORY_MILESTONES[index - 1].minLevel).toBeLessThanOrEqual(10)
      }
      expect(EVENTS.some(event => event.id === item.id), item.id).toBe(true)
    })
  })

  it('主线只会往前走：取最后一个已完成节点之后的下一段', () => {
    const done = ['p02_nuoding', 'p03_master', 'p04_shrek_exam', 'p05_eight_monsters']
    expect(nextMainStoryMilestone({ mainStoryVersion: 2, doneEvents: done }).id).toBe('p06_titan')
  })

  it('新存档从第一段开始逐段推进', () => {
    expect(nextMainStoryMilestone({ mainStoryVersion: 2, doneEvents: [] }).id).toBe('p02_nuoding')
    expect(nextMainStoryMilestone({ mainStoryVersion: 2, doneEvents: ['p02_nuoding', 'p03_master'] }).id).toBe('p04_shrek_exam')
  })

  it('新主线节点不会混进随机事件池', () => {
    for (const item of MAIN_STORY_MILESTONES) {
      const event = adaptEvent(EVENTS.find(e => e.id === item.id))
      expect(isEventEligible(event, { level: 100, ringCount: 9, doneEvents: [], locationMatches: true }), item.id).toBe(false)
    }
  })

  it('引导条在等级够、人在目标地点时给出"开始主线"按钮', () => {
    const guide = buildChildGuide({
      player: { level: 11 },
      eventStore: { _mainStoryVersion: 2, doneEvents: ['p02_nuoding', 'p03_master'] },
      gameStore: { _currentLocation: 'shrek_academy' },
      sceneState: 'location'
    })
    expect(guide.action).toBe('story')
  })
})

describe('儿童版：战斗难度', () => {
  const fs = { attack: 100, defense: 60, maxHp: 1000, speed: 30 }

  it('难度档位：最终决战 boss、越级猎环 hard、稳妥猎环/主线 normal、其它 easy', () => {
    expect(encounterDifficulty({ event: { id: 'final_evil' } })).toBe('boss')
    expect(encounterDifficulty({ event: { ring: 'ten' }, choice: { ringYear: 100 }, ringOrdinal: 1 })).toBe('hard')
    expect(encounterDifficulty({ event: { ring: 'ten' }, choice: { ringYear: 10 }, ringOrdinal: 1 })).toBe('normal')
    expect(encounterDifficulty({ event: { _mainStory: true } })).toBe('normal')
    expect(encounterDifficulty({ event: { id: 'x' } })).toBe('easy')
  })

  it('敌人按玩家强度换算，难度越高越强，身份字段保持不变', () => {
    const base = { id: '烈焰虎', name: '百年烈焰虎', element: 'fire', isBoss: false, battleRole: 'balanced' }
    const fixed = () => 0.5
    const easy = scaleEnemyToPlayer(base, fs, 'easy', fixed)
    const hard = scaleEnemyToPlayer(base, fs, 'hard', fixed)
    expect(hard.hp).toBeGreaterThan(easy.hp)
    expect(hard.attack).toBeGreaterThan(easy.attack)
    expect(hard.name).toBe('百年烈焰虎')
    expect(hard.element).toBe('fire')
    expect(Object.keys(ENCOUNTER_PRESETS)).toEqual(['easy', 'normal', 'hard', 'boss'])
  })

  it('魂技伤害会计入玩家输出（避免高攻击武魂反而更难打）', () => {
    const base = { name: 'x', battleRole: 'balanced' }
    const noSkill = scaleEnemyToPlayer(base, fs, 'normal', () => 0.5, [])
    const withSkill = scaleEnemyToPlayer(base, fs, 'normal', () => 0.5, [{ damage: 200 }])
    expect(withSkill.hp).toBeGreaterThan(noSkill.hp)
  })
})

describe('儿童版：结局', () => {
  it('结局由选择倾向决定', () => {
    expect(dominantTendency(['brave', 'brave', 'guardian'])).toBe('brave')
    expect(dominantTendency(['scholar', 'prudent', 'merciful'])).toBe('wise')
    expect(dominantTendency(['rebel'])).toBe('free')
    expect(dominantTendency([])).toBe('guardian')
    expect(pickEnding(ENDINGS, 999, { _storyPath: ['wise', 'wise'] }).id).toBe('path_wise')
    expect(pickEnding(ENDINGS, 999, { _storyPath: ['free', 'free', 'brave'] }).id).toBe('path_free')
  })

  it('不同倾向得到不同结局，命运值多少不影响', () => {
    const ids = ['guardian', 'brave', 'wise', 'free'].map(tag => pickEnding(ENDINGS, 9999, { _storyPath: [tag] }).id)
    expect(new Set(ids).size).toBe(4)
  })

  it('旧的系统结局变成荣誉，黑暗向的不展示', () => {
    const honors = endingHonors(ENDINGS, { _towerFloor: 20, fatePoints: -5, _storyPath: ['dark'], battleStats: { kills: 0 } })
    expect(honors).toContain('二十层之主')
    expect(honors).not.toContain('武魂殿的爪牙')
  })

  it('结局文本不再把玩家写成海神（唐三才是海神）', () => {
    for (const ending of ENDINGS.filter(e => e.tendency)) {
      expect(ending.text.join('')).toContain('唐三')
      expect(ending.text.join('')).not.toMatch(/你成为了?海神|万人敬仰的海神/)
    }
  })
})

describe('儿童版：时间与节奏', () => {
  it('季节每 32 次行动换一次，不再每次行动换一季', () => {
    expect(seasonForGameTime(0)).toBe('spring')
    expect(seasonForGameTime(31)).toBe('spring')
    expect(seasonForGameTime(32)).toBe('summer')
    expect(seasonForGameTime(128)).toBe('spring')
  })

  it('40 级以前经验需求不变，后期逐步打折', () => {
    expect(lateGameExpMultiplier(40)).toBe(1)
    expect(lateGameExpMultiplier(80)).toBeCloseTo(0.55)
    expect(experienceNeededForLevel(80)).toBeLessThan(Math.round(40 * Math.pow(80, 1.15)))
  })
})

describe('儿童版：内容', () => {
  it('普通事件文本里没有饮酒、赌博与尸体描写', () => {
    const banned = /喝酒|醉酒|大醉|宿醉|酒馆|酒楼|赌场|赌注|尸体|斩杀/
    const offenders = EVENTS
      .filter(event => !String(event.id).startsWith('god_'))
      .filter(event => banned.test(JSON.stringify([event.name, event.text, (event.choices || []).map(c => [c.text, c.result?.text])])))
      .map(event => event.id)
    expect(offenders).toEqual([])
  })
})
