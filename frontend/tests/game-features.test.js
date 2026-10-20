import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const battleHarness = vi.hoisted(() => ({ enemy: null, options: null, active: false }))
const gameDataHarness = vi.hoisted(() => ({
  data: {
    value: {
      npcData: [{ id: 'mentor', name: '导师', image: '', desc: '测试导师' }]
    }
  }
}))

vi.mock('@/composables/useGameData', () => ({
  useGameData() {
    return gameDataHarness
  }
}))

vi.mock('@/composables/useBattleSystem', () => ({
  useBattleSystem() {
    return {
      isActive: () => battleHarness.active,
      start(enemy, options) {
        battleHarness.enemy = enemy
        battleHarness.options = options
        battleHarness.active = true
      }
    }
  }
}))

import { ORIGINS } from '@/data/game-data'
import { useGameFeatures } from '@/composables/useGameFeatures'
import { initNewCharacter, flushSaveIfDirty } from '@/stores/serializer'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

const spirit = {
  id: 'social_spirit', eventKey: 'social', name: '社交武魂', tier: 'mid',
  type: '辅助系', subtype: '光', attack: 12, defense: 10, hp: 50, speed: 12,
  image: '', desc: '人物互动测试', icon: '✨'
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  battleHarness.enemy = null
  battleHarness.options = null
  battleHarness.active = false
  initNewCharacter({ name: '人物验收', origin: ORIGINS[0], spirit, innatePower: 50 })
})

describe('人物正式切磋', () => {
  it('禁止在100级或魂环等级上限购买经验丹，余额与经验库不变', () => {
    const features = useGameFeatures()
    const player = usePlayerStore()
    player.gold = 1000
    player.level = 100
    player.exp = 12
    features.buyItem('exp_pill')
    expect(player.gold).toBe(1000)
    expect(player.exp).toBe(12)

    player.level = 90
    player.rings = Array.from({ length: 8 }, (_, id) => ({ id }))
    player.overflowExp = 3000
    features.buyItem('exp_pill')
    expect(player.gold).toBe(1000)
    expect(player.overflowExp).toBe(3000)
    expect(features.canBuyItem(features.SHOP_ITEMS.find(item => item.id === 'exp_pill')).ok).toBe(false)
  })

  it('从人物面板进入正式战斗，并在胜利后结算经验、关系、冷却与成就', () => {
    const features = useGameFeatures()
    const player = usePlayerStore()
    const game = useGameStore()
    const event = useEventStore()
    const onVictory = vi.fn()
    game.meetNpc('mentor')
    const expBefore = player.exp

    expect(features.NPC_INTERACTIONS.some(interaction => interaction.id === 'spar' && interaction.type === 'battle')).toBe(true)
    expect(features.startNpcSpar('mentor', { onVictory })).toBe(true)
    expect(battleHarness.enemy).toEqual(expect.objectContaining({ id: 'npc_spar_mentor', isNpc: true }))
    expect(battleHarness.options.allowFlee).toBe(false)
    expect(battleHarness.options.countKill).toBe(false)

    battleHarness.options.onVictory()

    expect(player.exp).toBeGreaterThan(expBefore)
    expect(game._npcRelations.mentor).toBeGreaterThanOrEqual(15)
    expect(game._npcCooldowns.mentor_spar).toBe(game._gameTime)
    expect(event._dynamicFlags._npcSparDone).toBe(true)
    expect(player._achievementList).toContain('npc_spar')
    expect(onVictory).toHaveBeenCalledOnce()
    flushSaveIfDirty() // 节流模式下先落盘再断言
    expect(localStorage.getItem('dldl_text_rpg_save')).toBeTruthy()
  })
})
