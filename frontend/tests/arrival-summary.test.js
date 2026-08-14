import { describe, expect, it } from 'vitest'
import { buildTravelArrivalSummary, travelArrivalSummaryText } from '@/utils/travel-arrival'
import sceneAreaSource from '@/components/SceneArea.vue?raw'
import gamePageSource from '@/pages/GamePage.vue?raw'

const baseArrival = {
  fromName: '天斗城',
  targetName: '东海港口',
  cost: 80,
  travelDays: 2,
  destinationPlan: {
    primary: '办理海路许可',
    contact: '港口船长',
    fit: '器武魂适合船上守备',
    risk: '潮汐与风暴风险较高'
  }
}

describe('抵达摘要', () => {
  it('无途中遭遇时仍显示完整行程与地点行动线索', () => {
    const summary = buildTravelArrivalSummary(baseArrival)
    expect(summary).toContain('出发地：天斗城')
    expect(summary).toContain('抵达目标：东海港口')
    expect(summary).toContain('旅费：80金币')
    expect(summary).toContain('旅行天数：约2天')
    expect(summary).toContain('抵达后的首要目标：办理海路许可')
    expect(summary).toContain('人物线索：港口船长')
    expect(summary).toContain('武魂适配：器武魂适合船上守备')
    expect(summary).toContain('区域评估：潮汐与风暴风险较高')
  })

  it('有途中遭遇时追加途中发现，但仍保留同一份目标摘要', () => {
    const text = travelArrivalSummaryText({ ...baseArrival, revealed: ['潮汐刻痕', '旧航线'] })
    expect(text).toContain('抵达目标：东海港口')
    expect(text).toContain('途中发现：潮汐刻痕、旧航线')
  })

  it('地点行动界面实际渲染摘要并保留地图/行动入口', () => {
    expect(sceneAreaSource).toContain('data-testid="arrival-summary"')
    expect(sceneAreaSource).toContain('返回万象地图')
    expect(gamePageSource).toContain('engine.enterLocation(richText(arrivalText))')
    expect(gamePageSource).toContain('triggerTravelEncounter(arrival)')
  })
})
