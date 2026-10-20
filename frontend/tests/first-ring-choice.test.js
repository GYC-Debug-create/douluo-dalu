import { describe, expect, it } from 'vitest'
import { EVENTS } from '@/data/game-data'
import {
  beastTierForEncounter,
  prepareFirstRingEvent,
  ringDefinitionIdForChoice
} from '@/utils/ring-hunt'

const firstRingEvent = () => EVENTS.find(event => event.id === 'ring_hunt_10')

describe('BUG-DIALOG-011 第一魂环提供真实年限风险收益选择', () => {
  it('三条路线包含一个十年白环和两个百年黄环', () => {
    const event = firstRingEvent()
    expect(event.name).toBe('第一魂环·年限抉择')
    expect(event.choices.map(choice => choice.ringTier)).toEqual(['ten', 'hundred', 'hundred'])
    expect(event.choices.map(choice => choice.ringYear)).toEqual([10, 100, 100])
    expect(event.choices.every(choice => choice.strategy?.risk && choice.strategy?.reward && choice.strategy?.fit)).toBe(true)
  })

  it('每个选项独立决定最终魂环定义，不再被事件级 ten 覆盖', () => {
    const event = firstRingEvent()
    expect(ringDefinitionIdForChoice(event, event.choices[0], 0)).toBe('white_ring')
    expect(ringDefinitionIdForChoice(event, event.choices[1], 1)).toBe('yellow_ring')
    expect(ringDefinitionIdForChoice(event, event.choices[2], 2)).toBe('yellow_ring')
  })

  it('战斗键显式选择十年或百年敌人，不依赖玩家等级猜测', () => {
    expect(beastTierForEncounter('spirit_deer_ten', 10)).toBe('ten')
    expect(beastTierForEncounter('wind_rabbit_hundred', 10)).toBe('hundred')
    expect(beastTierForEncounter('poison_spider_hundred', 10)).toBe('hundred')
    expect(beastTierForEncounter('普通魂兽', 30)).toBe('thousand')
  })

  it('满状态高先天魂力会得到百年根基匹配评估', () => {
    const prepared = prepareFirstRingEvent(firstRingEvent(), { innatePower: 90, hp: 200 }, { maxHp: 200 })
    expect(prepared.choices[0].strategy.assessment).toBe('稳妥推荐')
    expect(prepared.choices[1].strategy.assessment).toBe('当前根基匹配')
    expect(prepared.choices[2].strategy.assessment).toBe('当前根基匹配')
    expect(prepared.text.at(-1)).toContain('觉醒资质 90/100')
    expect(prepared.text.at(-1)).toContain('生命状态 100%')
  })

  it('普通根基或受伤状态只警告风险但不伪造锁定条件', () => {
    const ordinary = prepareFirstRingEvent(firstRingEvent(), { innatePower: 50, hp: 100 }, { maxHp: 100 })
    expect(ordinary.choices.slice(1).map(choice => choice.strategy.assessment)).toEqual([
      '越级挑战，失败风险较高', '越级挑战，失败风险较高'
    ])
    expect(ordinary.choices.every(choice => !choice.req && !choice.cond)).toBe(true)

    const injured = prepareFirstRingEvent(firstRingEvent(), { innatePower: 100, hp: 40 }, { maxHp: 100 })
    expect(injured.choices.every(choice => choice.strategy.assessment === '当前状态不佳，建议谨慎')).toBe(true)
  })

  it('特殊第六与第九魂环的既有分支映射不受影响', () => {
    expect(ringDefinitionIdForChoice({ id: 'ring_hunt_60' }, {}, 0)).toBe('god_given_ring')
    expect(ringDefinitionIdForChoice({ id: 'ring_hunt_60' }, {}, 1)).toBe(null)
    expect(ringDefinitionIdForChoice({ id: 'ring_hunt_90' }, {}, 0)).toBe('million_gold_ring')
    expect(ringDefinitionIdForChoice({ id: 'ring_hunt_90' }, {}, 1)).toBe('god_given_ring')
  })
})
