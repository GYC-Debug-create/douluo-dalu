/**
 * 引擎装配链路集成测试(组合根 + 命令注册表)
 *
 * 上一轮把 useEventEngine 拆成组合根 + 命令注册表 + 五编排层;本文件用
 * "真实引擎 + 真实 store"驱动一次非战斗的完整回合,防止后续重构弄断
 * 装配顺序或命令接线(battle-contract.test.js 已覆盖战斗侧链路)。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ORIGINS } from '@/data/game-data'
import { useEventEngine } from '@/composables/useEventEngine'
import { initNewCharacter, LOCAL_SAVE_KEY } from '@/stores/serializer'
import { isValidSave } from '@/engine/save'
import { usePlayerStore } from '@/stores/player'
import { useGameStore } from '@/stores/game'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

const spirit = {
  id: 'assembly_spirit', eventKey: 'assembly', name: '装配武魂', tier: 'mid',
  type: '强攻系', subtype: '火', attack: 20, defense: 12, hp: 80, speed: 20,
  image: '', desc: '装配测试', icon: '⚔️'
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  initNewCharacter({ name: '装配验收', origin: ORIGINS[0], spirit, innatePower: 70 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('组合根装配链路', () => {
  it('showEvent → applyChoice 全链路结算,存档可写且通过校验', () => {
    const engine = useEventEngine()
    const player = usePlayerStore()
    const expBefore = player.exp

    const ev = {
      id: 'assembly_test', name: '装配试炼', location: 'star_duo_outer', weight: 0,
      text: ['天色尚早,前路漫漫。'],
      choices: [{ text: '继续赶路', result: { text: '你有所收获。', exp: 30, gold: 10, heal: 5 } }]
    }

    engine.showEvent(ev)
    expect(engine.currentEvent.value?.id).toBe('assembly_test')

    engine.applyChoice(ev, ev.choices[0], 0)
    // 精确数值(乘数/等级结算)由 settlement-pure.test.js 锁定;这里只验证
    // 组合根把结果真正应用到了玩家状态。
    expect(player.exp).toBeGreaterThan(expBefore)
    expect(player.gold).toBeGreaterThanOrEqual(100 + 10)

    engine.saveGame(true) // 立即落盘(节流模式下显式 flush)
    const raw = JSON.parse(localStorage.getItem(LOCAL_SAVE_KEY))
    expect(isValidSave(raw)).toBe(true)
    expect(raw.name).toBe('装配验收')
  })

  it('命令注册表接通:无地点上下文时 showLocationAction 经 commands 触发下一事件', () => {
    const engine = useEventEngine()
    const gameStore = useGameStore()
    gameStore._currentLocation = ''

    // 探索层在无地点时必须经 commands.nextEvent() 请求事件流;若接线断裂,
    // 这里会因命令未注册抛错,或 currentEvent 保持为空。
    engine.showLocationAction('')
    expect(engine.currentEvent.value).toBeTruthy()
  })
})
