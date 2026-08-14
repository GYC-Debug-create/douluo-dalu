import { describe, expect, it } from 'vitest'
import {
  buildDestinationPlan,
  buildMapState,
  performMapTravel,
  travelDays
} from '@/utils/mapBridge'

const shrek = {
  id: 'shrek_academy', name: '史莱克学院', unlockedLevel: 1, travelTime: 15,
  connectedTo: ['star_duo_outer'], events: ['修炼', '教学'], npcs: ['玉小刚']
}
const forest = {
  id: 'star_duo_outer', name: '星斗大森林外围', unlockedLevel: 3, travelTime: 30,
  connectedTo: ['shrek_academy'], events: ['狩猎', '采集药草', '遭遇魂兽'], npcs: ['流浪魂师']
}

function stores({ visited = ['shrek_academy'], level = 10, met = [] } = {}) {
  const player = { name: '测试魂师', playerId: 'p-007', level, gold: 500, spirit: { name: '昊天锤', type: '强攻系' } }
  const game = {
    _currentLocation: 'shrek_academy', _visitedLocations: [...visited], _metNpcs: met,
    _npcRelations: {}, _discoveredHidden: [], _gameTime: 0, _weather: 0,
    setLocation(id) { if (!this._visitedLocations.includes(id)) this._visitedLocations.push(id); this._currentLocation = id },
    advanceTime() { this._gameTime += 1 }
  }
  const eventStore = { _eventCount: 0, pendingRingLv: 10, _dynamicFlags: {}, _diary: [], _dynCooldowns: {} }
  return { player, game, eventStore }
}

describe('BUG-DIALOG-007 地图旅行具有可预期的目的地价值', () => {
  it('快速旅行真实缩短显示路程且不低于一天', () => {
    expect(travelDays(forest, false)).toBe(10)
    expect(travelDays(forest, true)).toBe(5)
    expect(travelDays({ travelTime: 1 }, true)).toBe(1)
  })

  it('行动计划结合魂环目标、武魂类型、访问历史与人物关系', () => {
    const { player, game, eventStore } = stores({ visited: ['shrek_academy', 'star_duo_outer'], met: ['流浪魂师'] })
    const plan = buildDestinationPlan(forest, player, game, eventStore, true)
    expect(plan.primary).toBe('追踪 Lv.10 魂环线索')
    expect(plan.fit).toContain('昊天锤')
    expect(plan.fit).toContain('狩猎')
    expect(plan.contact).toBe('拜访已结识的「流浪魂师」')
    expect(plan.visit).toBe('重访')
  })

  it('地图状态同时提供普通与快速路线差异和抵达计划', () => {
    const { player, game, eventStore } = stores({ visited: ['shrek_academy', 'star_duo_outer'] })
    const state = buildMapState([shrek, forest], player, game, eventStore)
    const target = state.locations.find(item => item.id === forest.id)
    expect(target.normalDays).toBe(10)
    expect(target.fastDays).toBe(5)
    expect(target.normalEncounterPercent).toBe(32)
    expect(target.fastEncounterPercent).toBe(8)
    expect(target.destinationPlan.primary).toContain('魂环线索')
  })

  it('旅行事务把同一行动计划带到抵达结果且不改动原有扣费规则', () => {
    const { player, game, eventStore } = stores()
    const result = performMapTravel({
      locations: [shrek, forest], locationId: forest.id, fast: false,
      player, game, eventStore
    })
    expect(result.ok).toBe(true)
    expect(result.travelDays).toBe(10)
    expect(result.encounterRate).toBe(0.32)
    expect(result.destinationPlan.primary).toBe('追踪 Lv.10 魂环线索')
    expect(player.gold).toBe(490)
    expect(game._currentLocation).toBe(forest.id)
  })

  it('首次到访与没有 NPC 数据时仍给出可理解的降级计划', () => {
    const plan = buildDestinationPlan(
      { id: 'blank', name: '未知山谷', unlockedLevel: 20, events: [], npcs: [] },
      { level: 20, spirit: { name: '蓝银草', type: '控制系' } },
      {}, {}, false
    )
    expect(plan.primary).toContain('初探')
    expect(plan.contact).toContain('当地见闻')
    expect(plan.risk).toBe('挑战较高')
  })
})
