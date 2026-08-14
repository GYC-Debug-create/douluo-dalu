import { describe, expect, it } from 'vitest'
import { buildHiddenLocationClues, buildMapState } from '@/utils/mapBridge'
import { CHAINED_EVENTS, DYNAMIC_EVENTS } from '@/data/game-data'

const locations = [
  { id: 'shrek_academy', name: '史莱克学院', unlockedLevel: 1, travelTime: 15, connectedTo: ['star_duo_outer'] },
  { id: 'star_duo_outer', name: '星斗大森林外围', unlockedLevel: 3, travelTime: 30, connectedTo: ['shrek_academy'] },
  { id: 'ancient_ruins', name: '远古遗迹', unlockedLevel: 20, travelTime: 30, connectedTo: [] },
  { id: 'dragon_valley', name: '龙之谷', unlockedLevel: 30, travelTime: 30, connectedTo: [] }
]

function state({ level = 1, visited = ['shrek_academy'], relations = {}, flags = {}, discovered = [] } = {}) {
  return {
    player: { level, gold: 100, spirit: { name: '蓝银草', type: '控制系' } },
    game: {
      _currentLocation: 'shrek_academy',
      _visitedLocations: visited,
      _npcRelations: relations,
      _discoveredHidden: discovered
    },
    eventStore: { _dynamicFlags: flags }
  }
}

describe('BUG-DIALOG-009 隐藏条件以线索和下一步呈现', () => {
  it('固定返回六条玩家可读传闻，且不暴露内部状态键', () => {
    const data = state()
    const clues = buildHiddenLocationClues(locations, data.player, data.game, data.eventStore)
    expect(clues).toHaveLength(6)
    expect(clues.map(clue => clue.id)).toEqual([
      'secret_cave', 'ancient_altar', 'dragon_nest', 'abyss_rift', 'fairy_pool', 'star_fall'
    ])
    expect(JSON.stringify(clues)).not.toMatch(/_stormAdventure|_bossKilled|dynamicFlags|canReveal/)
    expect(clues.every(clue => clue.clue && clue.nextStep && clue.progress.length > 0)).toBe(true)
  })

  it('洞窟仍严格要求 Lv.15 与星斗外围足迹，条件齐备后只提示通过旅行追查', () => {
    const below = state({ level: 14, visited: ['shrek_academy', 'star_duo_outer'] })
    let clue = buildHiddenLocationClues(locations, below.player, below.game, below.eventStore)[0]
    expect(clue.status).toBe('near')
    expect(clue.nextStep).toBe('继续历练至 Lv.15')

    const ready = state({ level: 15, visited: ['shrek_academy', 'star_duo_outer'] })
    clue = buildHiddenLocationClues(locations, ready.player, ready.game, ready.eventStore)[0]
    expect(clue.status).toBe('ready')
    expect(clue.nextStep).toContain('进行一次地图旅行')
  })

  it('羁绊与暴风雨进度使用玩家语言并保持原始 3 人、Lv.20、Lv.30 门槛', () => {
    const data = state({
      level: 30,
      relations: { 唐三: 5, 小舞: 3 },
      flags: { _stormAdventure: true }
    })
    const clues = buildHiddenLocationClues(locations, data.player, data.game, data.eventStore)
    const pool = clues.find(clue => clue.id === 'fairy_pool')
    const star = clues.find(clue => clue.id === 'star_fall')
    expect(pool.nextStep).toBe('与至少 3 位人物建立羁绊')
    expect(pool.progress.map(item => item.label)).toContain('人物羁绊 2 / 3')
    expect(star.status).toBe('ready')
    expect(star.progress.map(item => item.label)).toContain('经历一次暴风雨旅行奇遇')
  })

  it('已发现秘境标记为完成且地图状态携带同一份线索账本', () => {
    const data = state({ discovered: [{ id: 'secret_cave', name: '隐秘洞窟', desc: '已发现' }] })
    const mapState = buildMapState(locations, data.player, data.game, data.eventStore)
    expect(mapState.hiddenClues).toHaveLength(6)
    expect(mapState.hiddenClues[0]).toMatchObject({ id: 'secret_cave', discovered: true, status: 'discovered' })
    expect(mapState.hiddenClues[0].nextStep).toBe('秘境已经标记在地图上')
  })

  it('所有真实函数型事件选项都提供明确条件文案', () => {
    const choices = [
      ...DYNAMIC_EVENTS.flatMap(event => event.choices || []),
      ...Object.values(CHAINED_EVENTS).flatMap(event => event.choices || [])
    ].filter(choice => typeof (choice.req || choice.cond) === 'function')
    expect(choices).toHaveLength(4)
    expect(choices.map(choice => choice.requirementHint)).toEqual([
      '等级达到 Lv.5', '持有 5000 金币', '等级达到 Lv.10', '等级达到 Lv.8'
    ])
  })
})
