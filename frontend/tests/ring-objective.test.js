import { describe, expect, it } from 'vitest'
import { buildRingCompletionMessage, buildRingHuntMeta, buildRingObjective, RING_DESTINATIONS, ringDestination } from '@/utils/ring-hunt'
import statusPanelSource from '@/components/StatusPanel.vue?raw'
import sceneAreaSource from '@/components/SceneArea.vue?raw'
import growthSettlementSource from '@/composables/useGrowthSettlement.js?raw'
import gamePageSource from '@/pages/GamePage.vue?raw'

describe('BUG-DIALOG-012 猎环目标持久挂在侧边并可恢复', () => {
  it('待出发目标显示魂环序号、等级与真实目的地', () => {
    expect(ringDestination(10)).toEqual({ id: 'star_duo_outer', name: '星斗大森林·外围' })
    expect(buildRingObjective({
      pendingRingLv: 10,
      ringCount: 0,
      playerLevel: 12,
      currentLocation: 'holy_soul_village'
    })).toMatchObject({
      title: '第1魂环', requiredLevel: 10, eligible: true, atDestination: false,
      status: '待出发 · 前往星斗大森林·外围'
    })
  })

  it('抵达目的地后明确显示可以继续猎环', () => {
    const objective = buildRingObjective({
      pendingRingLv: 20,
      ringCount: 1,
      playerLevel: 20,
      currentLocation: 'star_duo_outer'
    })
    expect(objective).toMatchObject({ title: '第2魂环', atDestination: true, status: '已抵达猎环区域 · 可以继续' })
  })

  it('挂起状态按事件计数展示剩余行动且不会清除目标', () => {
    const objective = buildRingObjective({
      pendingRingLv: 10,
      ringCount: 0,
      playerLevel: 10,
      currentLocation: 'star_duo_outer',
      eventCount: 7,
      deferredUntil: 10
    })
    expect(objective.deferredActions).toBe(3)
    expect(objective.status).toBe('已挂起 · 3 次行动后自动提醒')
    expect(objective.title).toBe('第1魂环')
  })

  it('完成魂环或不存在待办时不生成目标卡', () => {
    expect(buildRingObjective()).toBeNull()
    expect(buildRingObjective({ pendingRingLv: 90, ringCount: 9, playerLevel: 100 })).toBeNull()
  })

  it('第1至第9魂环都使用真实目标、序号与动态完成文案', () => {
    const levels = [10, 20, 30, 40, 50, 60, 70, 80, 90]
    levels.forEach((level, index) => {
      const destination = RING_DESTINATIONS[level]
      const meta = buildRingHuntMeta({ pendingRingLv: level, ringCount: index })
      expect(meta).toMatchObject({
        ringOrdinal: index + 1,
        ringLevel: level,
        ringTargetId: destination.id,
        ringTargetName: destination.name
      })
      const completion = buildRingCompletionMessage(meta)
      expect(completion).toContain(`第${index + 1}魂环猎取已完成`)
      expect(completion).toContain(destination.name)
    })
    expect(sceneAreaSource).toContain('currentEvent.ringTargetName')
    expect(sceneAreaSource).not.toContain('海神岛就是本次猎魂目标')
  })

  it('侧边卡提供查看地图、继续和暂缓操作，页面接回同一事件引擎', () => {
    expect(statusPanelSource).toContain('data-testid="ring-objective"')
    expect(statusPanelSource).toContain("emit('open-map')")
    expect(statusPanelSource).toContain("emit('resume-ring-hunt')")
    expect(statusPanelSource).toContain("emit('defer-ring-hunt')")
    expect(gamePageSource).toContain('@resume-ring-hunt="engine.resumeRingHunt"')
    expect(gamePageSource).toContain('@defer-ring-hunt="engine.deferRingHunt"')
  })

  it('暂缓与继续都保存既有序列化字段，成功授环仍清除目标', () => {
    // 阶段一重构后，猎环动作迁入 useGrowthSettlement.js（行为不变，源码契约随迁）。
    expect(growthSettlementSource).toContain('function resumeRingHunt()')
    expect(growthSettlementSource).toContain('function deferRingHunt()')
    expect(growthSettlementSource).toContain('eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 3')
    expect(growthSettlementSource).toContain('eventStore.pendingRingLv = null')
    expect(growthSettlementSource).toContain('eventStore._ringHuntDeferredUntil = 0')
  })
})
