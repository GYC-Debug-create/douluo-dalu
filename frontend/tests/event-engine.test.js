import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const battleHarness = vi.hoisted(() => ({ callback: null, active: { value: false } }))

vi.mock('@/composables/useBattleSystem', () => ({
  useBattleSystem() {
    return {
      active: battleHarness.active,
      isActive: () => battleHarness.active.value,
      startEventBattle(_request, callback) {
        battleHarness.callback = callback
        battleHarness.active.value = true
      }
    }
  }
}))

import { ORIGINS } from '@/data/game-data'
import { cooldownSafeEventPool, useEventEngine } from '@/composables/useEventEngine'
import { useGameData } from '@/composables/useGameData'
import { initNewCharacter } from '@/stores/serializer'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { advanceExperience, experienceNeededForLevel } from '@/engine/rules'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

const spirit = {
  id: 'test_spirit', eventKey: 'test', name: '测试武魂', tier: 'mid',
  type: '器武魂', subtype: '武器', attack: 12, defense: 8, hp: 30, speed: 9,
  image: '', desc: '测试用武魂', icon: '⚔'
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  battleHarness.callback = null
  battleHarness.active.value = false
  initNewCharacter({ name: '战斗测试', origin: ORIGINS[0], spirit, innatePower: 50 })
})

describe('事件与成长闭环', () => {
  it('战斗事件在战败时不完成，胜利后才完成并发放事件奖励', () => {
    const engine = useEventEngine()
    const eventStore = useEventStore()
    const player = usePlayerStore()
    const event = { id: 'battle_gate', name: '战斗门槛', unique: true }
    const choice = { text: '迎战', result: { battle: 'academy_rival', exp: 50, item: { name: '胜利徽记', count: 2 } } }

    engine.applyChoice(event, choice, 0)
    expect(eventStore.doneEvents).not.toContain(event.id)
    battleHarness.active.value = false
    battleHarness.callback({ type: 'defeat', text: '战败', gains: [] })
    expect(eventStore.doneEvents).not.toContain(event.id)
    expect(player.inventory.some(item => item.name === '胜利徽记')).toBe(false)

    engine.applyChoice(event, choice, 0)
    battleHarness.active.value = false
    battleHarness.callback({ type: 'victory', text: '胜利', gains: [] })
    expect(eventStore.doneEvents).toContain(event.id)
    expect(player.inventory.find(item => item.name === '胜利徽记')?.count).toBe(2)
    expect(player.exp).toBeGreaterThan(0)
  })

  it('完整奖励器处理 mp、item2、数量、消耗和旧 hp 语义', () => {
    const engine = useEventEngine()
    const player = usePlayerStore()
    player.spiritPower = 5
    const hpBefore = player.hp
    player.inventory.push({ name: '钥匙', type: 'special', value: 1, count: 2 })

    engine.applyResultRewards({
      hp: -7,
      mp: 10,
      item: { name: '钥匙', type: 'special', value: 1, count: -1 },
      item2: { name: '秘药', type: 'special', value: 2, count: 3 }
    })

    expect(player.hp).toBe(hpBefore - 7)
    expect(player.spiritPower).toBe(15)
    expect(player.inventory.find(item => item.name === '钥匙')?.count).toBe(1)
    expect(player.inventory.find(item => item.name === '秘药')?.count).toBe(3)
  })

  it('获得魂环后立即释放门槛暂存经验并生成对应魂技', async () => {
    globalThis.fetch = vi.fn(async url => ({
      ok: true,
      async json() {
        if (String(url).includes('ring-codex')) {
          return { rings: [{
            id: 'white_ring', name: '十年魂环', tier: 'white', color: '#eee',
            statBonus: { attack: 1, defense: 1, hp: 5 }
          }] }
        }
        if (String(url).includes('spirit-codex')) return { spirits: [spirit] }
        return {}
      }
    }))
    await useGameData().loadAll()
    const engine = useEventEngine()
    const player = usePlayerStore()
    const eventStore = useEventStore()
    player.level = 10
    player.exp = 0
    player.overflowExp = 1000
    eventStore.pendingRingLv = 10
    const ringEvent = { id: 'ring_hunt_10', name: '第一魂环', ring: 'ten' }
    const choice = { text: '吸收十年灵鹿魂环', result: { text: '吸收成功' } }

    engine.applyChoice(ringEvent, choice, 0)

    expect(player.rings).toHaveLength(1)
    expect(player.skills).toHaveLength(1)
    expect(player.level).toBeGreaterThan(10)
    expect(player.overflowExp).toBeLessThan(1000)
    expect(eventStore.doneEvents).toContain('ring_hunt_10')
  })

  it('纯规则在无魂环时卡 10 级并保存溢出经验', () => {
    const result = advanceExperience({ level: 9, exp: 0, overflowExp: 0, ringCount: 0 }, 1000)
    expect(result.level).toBe(10)
    expect(result.capped).toBe(true)
    expect(result.overflowExp).toBeGreaterThan(0)
  })

  it('近期事件轮换不会把非空候选池筛空', () => {
    const pool = [{ id: 'only_event' }]
    expect(cooldownSafeEventPool(pool, ['only_event', 'only_event'])).toEqual(pool)

    const mixed = [{ id: 'repeated' }, { id: 'fresh' }]
    expect(cooldownSafeEventPool(mixed, ['repeated', 'repeated'])).toEqual([{ id: 'fresh' }])
  })

  it('随机事件优先走完未经历事件并避开全部近期事件', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    expect(cooldownSafeEventPool(pool, ['a'], ['a'])).toEqual([{ id: 'b' }, { id: 'c' }])
    expect(cooldownSafeEventPool(pool, ['a', 'b'], ['a', 'b', 'c'])).toEqual([{ id: 'c' }])
  })

  it('事件池全部命中近期记录时只回退到最少且最久未出现的事件', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    expect(cooldownSafeEventPool(pool, ['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([{ id: 'a' }])
    expect(cooldownSafeEventPool(pool, ['a', 'b', 'c', 'a'], ['a', 'b', 'c'])).toEqual([{ id: 'b' }])
  })

  it('幂经验曲线与 legacy 层一致：40*lv^1.15，1→100 累计 367228', () => {
    expect(experienceNeededForLevel(1)).toBe(40)
    expect(experienceNeededForLevel(10)).toBe(565)
    expect(experienceNeededForLevel(17)).toBe(1040)
    expect(experienceNeededForLevel(99)).toBe(7889)
    const total = Array.from({ length: 99 }, (_, index) => experienceNeededForLevel(index + 1))
      .reduce((sum, value) => sum + value, 0)
    expect(total).toBe(367228)
  })

  it('主线与猎环事件要求玩家真实抵达目标地点', () => {
    const engine = useEventEngine()
    const eventStore = useEventStore()
    const player = usePlayerStore()
    const game = useGameStore()
    eventStore._prologueDone = true
    eventStore._earlyLifeDone = true
    eventStore._enrollmentComplete = true
    eventStore._firstClassDone = true

    player.level = 5
    game._currentLocation = 'shrek_academy'
    engine.nextEvent()
    expect(engine.currentEvent.value?.targetId).toBe('star_duo_outer')
    expect(engine.currentEvent.value?.id).toContain('story_travel_')

    game.setLocation('star_duo_outer')
    engine.nextEvent()
    expect(engine.currentEvent.value?.id).toBe('first_hunt')
    expect(engine.currentEvent.value?._mainStory).toBe(true)

    eventStore.doneEvents.push('first_hunt')
    player.level = 10
    eventStore.pendingRingLv = 10
    game.setLocation('shrek_academy')
    engine.nextEvent()
    expect(engine.currentEvent.value?.targetId).toBe('star_duo_outer')
    expect(engine.currentEvent.value?.id).toContain('ring_travel_')

    game.setLocation('star_duo_outer')
    engine.nextEvent()
    expect(engine.currentEvent.value?.id).toBe('ring_hunt_10')
  })

  it('旅行遭遇会产生真实战斗奖励，且不重复推进旅行时间', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const engine = useEventEngine()
      const eventStore = useEventStore()
      const player = usePlayerStore()
      const game = useGameStore()
      eventStore._eventCount = 7
      game._gameTime = 4
      const expBefore = player.exp

      expect(engine.triggerTravelEncounter({
        targetName: '星斗大森林·外围',
        fromName: '史莱克学院',
        travelDays: 2,
        cost: 10
      })).toBe(true)
      expect(engine.currentEvent.value?.id).toBe('travel_encounter_ambush_beast')

      const encounter = engine.currentEvent.value
      engine.applyChoice(encounter, encounter.choices[0], 0)
      battleHarness.active.value = false
      battleHarness.callback({ type: 'victory', text: '战斗胜利', gains: [] })

      expect(player.exp).toBeGreaterThan(expBefore)
      expect(eventStore._eventCount).toBe(7)
      expect(game._gameTime).toBe(4)
      expect(eventStore.doneEvents).not.toContain(encounter.id)
    } finally {
      random.mockRestore()
    }
  })
})
