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

import { DYNAMIC_EVENTS, ORIGINS } from '@/data/game-data'
import { useEventEngine } from '@/composables/useEventEngine'
import { useGameRules } from '@/composables/useGameRules'
import { initNewCharacter } from '@/stores/serializer'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

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
  initNewCharacter({ name: '回归测试', origin: ORIGINS[0], spirit, innatePower: 50 })
})

function reachFreePlay(engine, eventStore, player) {
  eventStore._prologueDone = true
  eventStore._earlyLifeDone = true
  eventStore._enrollmentComplete = true
  eventStore._firstClassDone = true
  eventStore.doneEvents.push('first_hunt', 'reach_lv10')
  player.level = 5
}

describe('BUG-001 旅行/探索推进不再触发 finalStats 未定义', () => {
  it('数据模块 dyn_low_hp 的条件与效果通过 G.finalStats 获取最大生命', () => {
    const ev = DYNAMIC_EVENTS.find(e => e.id === 'dyn_low_hp')
    expect(ev).toBeDefined()

    const low = { hp: 10, finalStats: { maxHp: 100 } }
    const full = { hp: 200, finalStats: { maxHp: 100 } }
    expect(ev.condition(low)).toBe(true)
    expect(ev.condition(full)).toBe(false)

    const g1 = { hp: 5, level: 5, fatePoints: 0, finalStats: { maxHp: 100 } }
    const msg1 = ev.choices[0].effect(g1)
    expect(g1.hp).toBe(50)
    expect(g1.fatePoints).toBe(1)
    expect(g1._dynSurvived).toBe(true)
    expect(msg1).toContain('50%')

    const g2 = { hp: 5, level: 5, finalStats: { maxHp: 100 } }
    ev.choices[1].effect(g2)
    expect(g2.hp).toBe(30)
  })

  it('低血量点击探索可触发濒死顿悟，选择后能继续前行', () => {
    const engine = useEventEngine()
    const eventStore = useEventStore()
    const player = usePlayerStore()
    reachFreePlay(engine, eventStore, player)
    player.hp = 1
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      expect(() => engine.explore()).not.toThrow()
      expect(engine.currentEvent.value?.id).toBe('dyn_low_hp')
      expect(engine.sceneState.value).toBe('event')

      const maxHp = useGameRules().finalStats().maxHp
      engine.applyChoice(engine.currentEvent.value, engine.currentEvent.value.choices[0], 0)
      expect(player.hp).toBe(Math.round(maxHp * 0.5))
      expect(player.fatePoints).toBe(1)
      expect(eventStore.doneEvents).toContain('dyn_low_hp')

      expect(() => engine.continueAction()).not.toThrow()
      expect(['event', 'continue']).toContain(engine.sceneState.value)
    } finally {
      random.mockRestore()
    }
  })

  it('旅行遭遇战斗结算后点击继续前行不再抛出异常', () => {
    const engine = useEventEngine()
    const eventStore = useEventStore()
    const player = usePlayerStore()
    reachFreePlay(engine, eventStore, player)
    player.hp = 1
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      expect(engine.triggerTravelEncounter({
        targetName: '天斗城', fromName: '史莱克学院', travelDays: 2, cost: 5
      })).toBe(true)
      expect(engine.currentEvent.value?.id).toBe('travel_encounter_ambush_beast')

      engine.applyChoice(engine.currentEvent.value, engine.currentEvent.value.choices[0], 0)
      expect(battleHarness.active.value).toBe(true)
      battleHarness.active.value = false
      battleHarness.callback({ type: 'victory', text: '战斗胜利', gains: [] })

      expect(engine.sceneState.value).toBe('continue')
      expect(() => engine.continueAction()).not.toThrow()
      expect(['event', 'continue']).toContain(engine.sceneState.value)
      expect(eventStore.doneEvents).not.toContain('travel_encounter_ambush_beast')
    } finally {
      random.mockRestore()
    }
  })
})

describe('dyn_night/dyn_lucky/dyn_combo_master 效果不再引用未定义的 addGold/gainExp/getMaxSpiritPower', () => {
  const find = id => DYNAMIC_EVENTS.find(e => e.id === id)

  it('dyn_lucky 收下金币直接累加 G.gold', () => {
    const ev = find('dyn_lucky')
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const g = { gold: 100, level: 5 }
      expect(() => ev.choices[0].effect(g)).not.toThrow()
      expect(g.gold).toBe(100 + 100)
      expect(g._dynLucky).toBe(true)
    } finally {
      random.mockRestore()
    }
  })

  it('dyn_lucky 寻找失主直接累加 G.gold 并增加命运值', () => {
    const ev = find('dyn_lucky')
    const g = { gold: 100, fatePoints: 0, level: 10 }
    expect(ev.choices[1].req(g)).toBe(true)
    expect(() => ev.choices[1].effect(g)).not.toThrow()
    expect(g.gold).toBe(150)
    expect(g.fatePoints).toBe(2)
  })

  it('dyn_night 盘膝修炼直接累加 G.exp', () => {
    const ev = find('dyn_night')
    const g = { exp: 10, level: 5, _nightTraining: false }
    expect(() => ev.choices[0].effect(g)).not.toThrow()
    expect(g.exp).toBe(10 + 30 + 5 * 5)
    expect(g._nightTraining).toBe(true)
  })

  it('dyn_combo_master 请教老者以 G.maxSpiritPower 为恢复上限', () => {
    const ev = find('dyn_combo_master')
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.6)
    try {
      const g = { level: 5, spiritPower: 0, maxSpiritPower: 100 }
      expect(() => ev.choices[0].effect(g)).not.toThrow()
      expect(g.spiritPower).toBe(20)
    } finally {
      random.mockRestore()
    }
  })
})

describe('BUG-003 原地休息生命不超过最大生命', () => {
  it('heal 以 finalStats().maxHp 为上限，满血不越界且能校正已越界生命', () => {
    const player = usePlayerStore()
    const maxHp = useGameRules().finalStats().maxHp

    player.hp = maxHp
    player.heal(50)
    expect(player.hp).toBe(maxHp)

    const lowStart = Math.max(1, maxHp - 100)
    player.hp = lowStart
    player.heal(50)
    expect(player.hp).toBe(Math.min(maxHp, lowStart + 50))

    player.hp = 10
    player.heal(500)
    expect(player.hp).toBe(maxHp)

    player.hp = maxHp + 50
    player.heal(0)
    expect(player.hp).toBe(maxHp)
  })

  it('满血休息恢复 0 点生命且提示文本使用真实恢复量', () => {
    const engine = useEventEngine()
    const player = usePlayerStore()
    const ui = useUiStore()
    const maxHp = useGameRules().finalStats().maxHp
    player.hp = maxHp

    engine.rest()

    expect(player.hp).toBe(maxHp)
    expect(ui.notifications.at(-1)?.message).toContain('恢复 0 点生命')
  })

  it('非满血休息只恢复实际缺口，提示文本使用真实恢复量', () => {
    const engine = useEventEngine()
    const player = usePlayerStore()
    const ui = useUiStore()
    const maxHp = useGameRules().finalStats().maxHp
    const hpBefore = Math.max(1, maxHp - 100)
    player.hp = hpBefore

    engine.rest()

    // 儿童版休息恢复 40% 最大生命（原 50 点），仍不超过实际缺口
    const expectedHp = Math.min(maxHp, hpBefore + Math.round(maxHp * 0.4))
    expect(player.hp).toBe(expectedHp)
    expect(ui.notifications.at(-1)?.message).toContain(`恢复 ${expectedHp - hpBefore} 点生命`)
  })

  it('已被推高到最大生命以上的存档在休息时被校正回最大生命', () => {
    const engine = useEventEngine()
    const player = usePlayerStore()
    const maxHp = useGameRules().finalStats().maxHp
    player.hp = maxHp + 50

    engine.rest()

    expect(player.hp).toBe(maxHp)
  })
})
