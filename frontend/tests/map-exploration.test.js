import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import mapPayload from '../../public/data/map-data.json'
import { EVENTS } from '@/data/game-data'
import { migrateSave } from '@/engine/save'
import { classifyEventLocation } from '@/engine/rules'
import {
  buildLocationExplorationEvent,
  buildLocationExplorationQueue,
  eligibleLocationEvents,
  isLocationExplorationInProgress,
  LOCATION_EXPLORATION_MODES,
  LOCATION_EXPLORATION_STAGES,
  normalizeLocationExplorationState,
  normalizeLocationExplorationsByLocation
} from '@/utils/location-exploration'
import {
  buildMapState,
  findShortestRoute,
  performMapTravel
} from '@/utils/mapBridge'

const locations = mapPayload.locations
const player = {
  name: '海神路线测试',
  playerId: 'map-test',
  level: 80,
  gold: 5000,
  rings: Array.from({ length: 7 }, (_, index) => ({ name: '测试魂环' + (index + 1) })),
  spirit: { id: 'sp_test', name: '昊天锤', type: '器武魂', subtype: '武器', tier: 'top' }
}

function gameAt(current, visited = [current]) {
  return {
    _currentLocation: current,
    _visitedLocations: [...visited],
    _metNpcs: [],
    _npcRelations: {},
    _discoveredHidden: []
  }
}

function ringState(pendingRingLv = 80) {
  return {
    pendingRingLv,
    _eventCount: 3,
    _ringHuntDeferredUntil: 0,
    _recentEvents: [],
    doneEvents: [],
    completedEvents: [],
    _dynamicFlags: {}
  }
}

describe('BUG-ORAL-010 海神岛猎魂目标与路线', () => {
  it('BUG-ORAL-014 生产地图使用 Vue 原生组件，坐标和地标类型来自地图数据', () => {
    expect(locations.every(location => Number.isFinite(location.mapX) && Number.isFinite(location.mapY))).toBe(true)
    expect(locations.every(location => typeof location.landmarkType === 'string' && location.landmarkType)).toBe(true)
    expect(new Set(locations.map(location => location.landmarkType)).size).toBeGreaterThanOrEqual(8)
    const source = fs.readFileSync(new URL('../src/pages/MapPage.vue', import.meta.url), 'utf8')
    expect(source).toContain("import WorldMap from '@/components/map/WorldMap.vue'")
    expect(source).not.toContain('<iframe')
    expect(source).not.toContain('postMessage')
  })

  it('Lv.80 目标解除迷雾、显示任务标记、完整路线和下一站', () => {
    const state = buildMapState(locations, player, gameAt('shrek_academy'), ringState())
    expect(state.objective).toMatchObject({
      objectiveType: 'ring_hunt',
      objectiveLevel: 80,
      objectiveLocationId: 'sea_god_island',
      objectiveLocationName: '海神岛',
      routeIds: ['shrek_academy', 'tian_dou_city', 'east_sea_port', 'sea_god_island'],
      nextHopId: 'tian_dou_city'
    })
    expect(state.remainingStops).toEqual(['tian_dou_city', 'east_sea_port', 'sea_god_island'])
    expect(state.locations.find(item => item.id === 'sea_god_island')).toMatchObject({
      known: true,
      objective: true,
      recommended: true
    })
    for (const id of state.objective.routeIds) {
      expect(state.locations.find(item => item.id === id)?.known).toBe(true)
    }
  })

  it('从多个大陆起点都能按图数据计算到海神岛的路线，并经过东海港口', () => {
    for (const start of ['shrek_academy', 'star_duo_outer', 'ancient_ruins', 'wuhun_city']) {
      const route = findShortestRoute(locations, start, 'sea_god_island')
      expect(route[0]).toBe(start)
      expect(route.at(-1)).toBe('sea_god_island')
      expect(route).toContain('east_sea_port')
    }
  })

  it('首次旅行只能走相邻节点，访问后才允许快速旅行', () => {
    const game = gameAt('shrek_academy')
    const eventStore = ringState()
    const blocked = performMapTravel({
      locations,
      locationId: 'sea_god_island',
      fast: false,
      player: { ...player },
      game,
      eventStore
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.message).toContain('相邻')

    const traveler = { ...player, gold: 5000 }
    const first = performMapTravel({
      locations,
      locationId: 'tian_dou_city',
      fast: true,
      player: traveler,
      game,
      eventStore
    })
    expect(first.ok).toBe(true)
    expect(first.useFast).toBe(false)

    const back = performMapTravel({
      locations,
      locationId: 'shrek_academy',
      fast: true,
      player: traveler,
      game,
      eventStore
    })
    expect(back.ok).toBe(true)
    expect(back.useFast).toBe(true)
  })
})

describe('BUG-ORAL-011 数据驱动地点探索链', () => {
  it('每个可旅行地点都能生成 4 阶段队列，且事件只属于当前地点', () => {
    for (const location of locations) {
      const state = buildLocationExplorationQueue({
        location,
        mapLocations: locations,
        events: EVENTS,
        player,
        game: gameAt(location.id),
        eventStore: ringState(),
        cycle: 'audit_' + location.id
      })
      expect(state.queuedEventIds).toHaveLength(LOCATION_EXPLORATION_STAGES.length)
      expect(new Set(state.queuedEventIds).size).toBe(LOCATION_EXPLORATION_STAGES.length)
      state.queuedEventIds.forEach((eventId, index) => {
        const sourceId = state.sourceEventIds[index]
        const source = sourceId ? EVENTS.find(event => event.id === sourceId) : null
        const event = source || buildLocationExplorationEvent({
          location,
          stageIndex: index,
          player,
          eventId,
          objectiveType: state.objectiveType,
          sourceEvent: source
        })
        expect(classifyEventLocation(event.location, locations)).toMatchObject({ scope: 'mapped', id: location.id })
        expect(event.ring).toBeUndefined()
        expect(event.ringOnly).not.toBe(true)
        expect(event.mainStoryOnly).not.toBe(true)
      })
    }
  })

  it('筛选时同时排除跨地区、主线、正式猎魂和近期事件', () => {
    const port = locations.find(location => location.id === 'east_sea_port')
    const candidates = eligibleLocationEvents({
      location: port,
      mapLocations: locations,
      player,
      game: gameAt(port.id),
      eventStore: {
        doneEvents: ['port_recent'],
        completedEvents: ['port_recent'],
        _recentEvents: ['port_recent'],
        _dynamicFlags: {}
      },
      events: [
        { id: 'port_recent', name: '港口旧事', location: '东海港口', phase: 'god', minLevel: 1, choices: [{ text: '记下', result: { text: '记下' } }] },
        { id: 'other_place', name: '天斗城事件', location: '天斗城', phase: 'god', minLevel: 1, choices: [{ text: '离开', result: { text: '离开' } }] },
        { id: 'main_port', name: '主线港口', location: '东海港口', phase: 'god', mainStoryOnly: true, choices: [{ text: '主线', result: { text: '主线' } }] },
        { id: 'ring_port', name: '正式猎环', location: '东海港口', phase: 'god', ring: 'choice', choices: [{ text: '猎环', result: { text: '猎环' } }] }
      ]
    })
    expect(candidates).toEqual([])
  })

  it('保存/恢复保留正在进行的阶段，旧存档缺字段仍可读取', () => {
    const active = {
      locationId: 'east_sea_port',
      active: true,
      stage: 2,
      queuedEventIds: ['a', 'b', 'c', 'd'],
      completedEventIds: ['a', 'b'],
      startedAtEventCount: 12,
      objectiveType: 'local_commission'
    }
    expect(normalizeLocationExplorationState(active)).toMatchObject(active)
    const old = migrateSave({
      name: '旧档',
      spirit: { id: 'old', name: '旧武魂', type: '器武魂' },
      level: 80,
      rings: Array.from({ length: 7 }, () => ({ name: '旧环' })),
      skills: []
    })
    expect(old.locationExploration).toBeNull()
    expect(old._locationProgress).toEqual({})

    const restored = migrateSave({
      ...old,
      locationExploration: active,
      _locationProgress: { east_sea_port: { rounds: 1, exploration: 20 } }
    })
    expect(restored.locationExploration).toMatchObject(active)
    expect(restored._locationProgress.east_sea_port.rounds).toBe(1)
  })

  it('探索轮换优先未经历且不立即重复，正式魂环不可能从模板奖励获得', () => {
    const port = locations.find(location => location.id === 'east_sea_port')
    const sources = [
      { id: 'port_a', name: '港口调查', location: '东海港口', phase: 'god', choices: [{ text: 'a', result: { exp: 1, text: 'a' } }] },
      { id: 'port_b', name: '港口委托', location: '东海港口', phase: 'god', choices: [{ text: 'b', result: { exp: 1, text: 'b' } }] }
    ]
    const state = buildLocationExplorationQueue({
      location: port,
      mapLocations: locations,
      events: sources,
      player,
      game: gameAt(port.id),
      eventStore: { ...ringState(), doneEvents: [], completedEvents: [], _recentEvents: ['port_a'] },
      cycle: 'rotation'
    })
    expect(state.sourceEventIds[0]).toBe('port_b')
    expect(state.sourceEventIds[1]).not.toBe('port_a')
    expect(state.queuedEventIds.every(id => id.startsWith('location_east_sea_port_local_exploration_'))).toBe(true)
    const template = buildLocationExplorationEvent({ location: port, stageIndex: 3, player, eventId: 'template' })
    expect(template.choices.every(choice => !choice.result.ring && !choice.result.ringTier)).toBe(true)
  })

  it('三种地点行动使用不同队列、阶段文案和持久化模式', () => {
    const port = locations.find(location => location.id === 'east_sea_port')
    const states = Object.keys(LOCATION_EXPLORATION_MODES).map(objectiveType => buildLocationExplorationQueue({
      location: port,
      mapLocations: locations,
      events: EVENTS,
      player,
      game: gameAt(port.id),
      eventStore: ringState(),
      objectiveType,
      cycle: 'mode_test'
    }))
    expect(states.map(state => state.objectiveType)).toEqual(Object.keys(LOCATION_EXPLORATION_MODES))
    expect(new Set(states.map(state => state.queuedEventIds.join('|')).values()).size).toBe(3)
    expect(new Set(states.map(state => state.modeLabel)).size).toBe(3)
    states.forEach(state => {
      const restored = normalizeLocationExplorationState(JSON.parse(JSON.stringify(state)))
      expect(restored.objectiveType).toBe(state.objectiveType)
      expect(restored.queuedEventIds).toEqual(state.queuedEventIds)
      expect(restored.stage).toBe(0)
    })
  })

  it('BUG-ORAL-012 按地点保留多个队列，旧状态可迁移为暂停状态', () => {
    const local = {
      locationId: 'shrek_academy',
      active: true,
      stage: 2,
      queuedEventIds: ['shrek-a', 'shrek-b', 'shrek-c', 'shrek-d'],
      completedEventIds: ['shrek-a', 'shrek-b'],
      objectiveType: 'local_exploration'
    }
    const commission = {
      locationId: 'tian_dou_city',
      status: 'suspended',
      stage: 1,
      queuedEventIds: ['tian-a', 'tian-b', 'tian-c', 'tian-d'],
      completedEventIds: ['tian-a'],
      objectiveType: 'local_commission'
    }
    const map = normalizeLocationExplorationsByLocation({
      shrek_academy: local,
      tian_dou_city: commission
    })
    expect(Object.keys(map)).toEqual(['shrek_academy', 'tian_dou_city'])
    expect(map.shrek_academy.status).toBe('active')
    expect(map.tian_dou_city.status).toBe('suspended')
    expect(isLocationExplorationInProgress(map.shrek_academy)).toBe(true)
    expect(normalizeLocationExplorationState({ ...local, active: false }).status).toBe('suspended')
  })

  it('BUG-ORAL-012 旅行离开当前地点只暂停当前队列，并在地图状态中标记进度', () => {
    const traveler = { ...player, gold: 5000 }
    const eventStore = {
      ...ringState(),
      locationExplorationsByLocation: {
        shrek_academy: {
          locationId: 'shrek_academy',
          status: 'active',
          active: true,
          stage: 2,
          queuedEventIds: ['a', 'b', 'c', 'd'],
          completedEventIds: ['a', 'b'],
          objectiveType: 'local_exploration'
        },
        tian_dou_city: {
          locationId: 'tian_dou_city',
          status: 'active',
          active: true,
          stage: 1,
          queuedEventIds: ['e', 'f', 'g', 'h'],
          completedEventIds: ['e'],
          objectiveType: 'local_commission'
        }
      },
      locationExploration: null
    }
    const game = gameAt('shrek_academy')
    const result = performMapTravel({
      locations,
      locationId: 'tian_dou_city',
      fast: false,
      player: traveler,
      game,
      eventStore
    })
    expect(result.ok).toBe(true)
    expect(eventStore.locationExplorationsByLocation.shrek_academy.status).toBe('suspended')
    expect(eventStore.locationExplorationsByLocation.tian_dou_city.status).toBe('active')
    const state = buildMapState(locations, player, game, eventStore)
    expect(state.locations.find(item => item.id === 'shrek_academy')).toMatchObject({
      explorationStatus: 'suspended',
      explorationInProgress: true,
      explorationCompletedStages: 2
    })
    expect(state.locations.find(item => item.id === 'tian_dou_city')).toMatchObject({
      explorationStatus: 'active',
      explorationInProgress: true,
      explorationCompletedStages: 1
    })
  })
})
