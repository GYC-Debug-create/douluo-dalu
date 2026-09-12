import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ORIGINS } from '@/data/game-data'
import { useBattleSystem } from '@/composables/useBattleSystem'
import { createEventBattleRequest } from '@/engine/battle-contract'
import { initNewCharacter } from '@/stores/serializer'
import { useCombatStore } from '@/stores/combat'
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
  id: 'battle_spirit', eventKey: 'battle', name: '战斗武魂', tier: 'mid',
  type: '强攻系', subtype: '火', attack: 20, defense: 12, hp: 80, speed: 20,
  image: '', desc: '战斗回归测试', icon: '⚔️'
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  initNewCharacter({ name: '战斗验收', origin: ORIGINS[0], spirit, innatePower: 70 })
  // 本文件验证完整模式的手动战斗闭环；简单模式的默认行为单独用例覆盖。
  useGameStore()._simpleMode = false
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('Vue 正式战斗状态闭环', () => {
  it('持久记录连击终结、元素反应、已用元素和武魂融合', async () => {
    const player = usePlayerStore()
    const combat = useCombatStore()
    const battle = useBattleSystem()
    player.skills = [
      { name: '烈焰斩', type: '攻击', element: 'fire', damage: 5, cost: 1, cooldown: 1 },
      { name: '潮汐击', type: '攻击', element: 'water', damage: 5, cost: 1, cooldown: 1 }
    ]
    player.rings = [{}, {}, {}]
    player.spiritPowerMax = 500
    player.spiritPower = 500

    battle.start({
      id: 'telemetry_target', name: '遥测木偶', isNpc: true,
      hp: 100000, maxHp: 100000, attack: 1, defense: 0, speed: 1
    }, { allowFlee: false, countKill: false })

    battle.performSkill(0)
    await vi.advanceTimersByTimeAsync(600)
    battle.performSkill(1)
    await vi.advanceTimersByTimeAsync(600)
    for (let i = 0; i < 3; i++) {
      battle.performAttack()
      await vi.advanceTimersByTimeAsync(600)
    }
    battle.performFusion()

    expect(combat._usedElements).toEqual(expect.arrayContaining(['fire', 'water']))
    expect(combat._reactionTriggered).toBe(true)
    expect(combat._reactionCount).toBeGreaterThanOrEqual(1)
    expect(combat._maxCombo).toBeGreaterThanOrEqual(5)
    expect(combat._maxComboFinisher).toBeGreaterThanOrEqual(5)
    expect(combat._fusionUsed).toBe(true)
  })

  it('主线战斗失败会设置里程碑冷却并清理战斗状态', async () => {
    const eventStore = useEventStore()
    const combat = useCombatStore()
    const battle = useBattleSystem()
    const ended = vi.fn()

    // 阶段一 1.3 契约化：战斗只接收请求单并发布标准化结果，
    // 战败后的主线挂起职责移到事件层（见 battle-contract.test.js）。
    battle.startEventBattle(
      createEventBattleRequest({
        event: { id: 'main_battle', name: '主线强敌', _mainStory: true },
        result: {
          battle: {
            id: 'overwhelming_enemy', name: '强敌', isNpc: true,
            hp: 1000, maxHp: 1000, attack: 99999, defense: 10, speed: 999
          }
        },
        finalBoss: false
      }),
      ended
    )
    await vi.advanceTimersByTimeAsync(1200)

    expect(ended).toHaveBeenCalledWith(expect.objectContaining({
      type: 'defeat',
      enemy: expect.objectContaining({ id: 'overwhelming_enemy' }),
      rounds: expect.any(Number)
    }))
    expect(battle.isActive()).toBe(false)
    expect(combat._battleActive).toBe(false)
  })
})

describe('自动战斗闭环（BUG-006）', () => {
  function startDummy() {
    const player = usePlayerStore()
    const battle = useBattleSystem()
    player.skills = []
    player.rings = []
    player.spiritPower = 100
    battle.start({
      id: 'auto_dummy', name: '自动木偶', isNpc: true,
      hp: 500, maxHp: 500, attack: 1, defense: 0, speed: 1
    }, { allowFlee: false, countKill: false })
    return battle
  }

  it('点击自动后状态立即切换且有日志反馈', () => {
    const battle = startDummy()
    expect(battle.autoMode.value).toBe(false)
    battle.toggleAuto()
    expect(battle.autoMode.value).toBe(true)
    expect(battle.logs.value.some(l => /自动战斗/.test(l.text))).toBe(true)
  })

  it('自动模式下等待一个回合后双方状态合理变化', async () => {
    const player = usePlayerStore()
    const battle = startDummy()
    const enemyHpBefore = battle.enemy.value.hp
    const playerHpBefore = player.hp
    battle.toggleAuto()
    await vi.advanceTimersByTimeAsync(1600)

    expect(battle.round.value).toBeGreaterThan(1)
    expect(battle.enemy.value.hp).toBeLessThan(enemyHpBefore)
    expect(player.hp).toBeLessThanOrEqual(playerHpBefore)
    expect(battle.logs.value.some(l => /发动普通攻击/.test(l.text))).toBe(true)
  })

  it('再次点击自动后停止自动推进', async () => {
    const battle = startDummy()
    battle.toggleAuto()
    await vi.advanceTimersByTimeAsync(1600)
    expect(battle.autoMode.value).toBe(true)
    const roundAfter = battle.round.value
    const enemyHpAfter = battle.enemy.value.hp
    battle.toggleAuto()
    expect(battle.autoMode.value).toBe(false)
    const logCount = battle.logs.value.length

    await vi.advanceTimersByTimeAsync(3000)

    expect(battle.round.value).toBe(roundAfter)
    expect(battle.enemy.value.hp).toBe(enemyHpAfter)
    expect(battle.logs.value.length).toBe(logCount)
  })

  it('战斗结束后没有幽灵定时器', async () => {
    const battle = useBattleSystem()
    battle.start({
      id: 'one_hp', name: '残血木偶', isNpc: true,
      hp: 1, maxHp: 1, attack: 1, defense: 0, speed: 1
    }, { allowFlee: false, countKill: false })
    battle.toggleAuto()

    await vi.advanceTimersByTimeAsync(3000)

    expect(battle.isActive()).toBe(false)
    expect(battle.enemy.value.hp).toBe(0)
    expect(battle.round.value).toBe(1)

    // 等待足够时间（含结算通知的 3s 定时器），确认没有任何残留定时器继续推进状态
    await vi.advanceTimersByTimeAsync(10000)

    expect(vi.getTimerCount()).toBe(0)
    expect(battle.enemy.value.hp).toBe(0)
    expect(battle.round.value).toBe(1)
    expect(battle.isActive()).toBe(false)
  })

  it('简单模式（低龄化默认）下战斗默认自动开启，无需手动点击', async () => {
    const gameStore = useGameStore()
    gameStore._simpleMode = true
    const player = usePlayerStore()
    player.skills = []
    player.rings = []
    player.spiritPower = 100
    const battle = useBattleSystem()
    battle.start({
      id: 'auto_dummy', name: '自动木偶', isNpc: true,
      hp: 500, maxHp: 500, attack: 1, defense: 0, speed: 1
    }, { allowFlee: false, countKill: false })

    expect(battle.autoMode.value).toBe(true)

    await vi.advanceTimersByTimeAsync(1600)
    expect(battle.round.value).toBeGreaterThan(1)
    expect(battle.enemy.value.hp).toBeLessThan(500)
  })

  it('1×/2×/3× 速度切换可用且影响自动行动节奏', async () => {
    const battle = startDummy()
    expect(battle.speedLabel.value).toBe('1×')
    battle.cycleSpeed()
    expect(battle.speedLabel.value).toBe('2×')
    battle.cycleSpeed()
    expect(battle.speedLabel.value).toBe('3×')
    battle.cycleSpeed()
    expect(battle.speedLabel.value).toBe('1×')

    battle.toggleAuto()
    await vi.advanceTimersByTimeAsync(600)
    expect(battle.logs.value.some(l => /发动普通攻击/.test(l.text))).toBe(false)
    await vi.advanceTimersByTimeAsync(500)
    expect(battle.logs.value.some(l => /发动普通攻击/.test(l.text))).toBe(true)

    battle.toggleAuto()
    await vi.advanceTimersByTimeAsync(2000)
    battle.cycleSpeed()
    battle.cycleSpeed()
    const logsBefore = battle.logs.value.length
    battle.toggleAuto()
    await vi.advanceTimersByTimeAsync(400)
    expect(battle.logs.value.length).toBeGreaterThan(logsBefore)
    expect(battle.logs.value.some(l => /发动普通攻击/.test(l.text))).toBe(true)
  })

  it('魂力充足时自动优先释放魂技', async () => {
    const player = usePlayerStore()
    const battle = useBattleSystem()
    player.spiritPower = 100
    player.skills = [
      { name: '烈焰斩', type: '攻击', element: 'fire', damage: 5, cost: 10, cooldown: 1 }
    ]
    battle.start({
      id: 'skill_dummy', name: '魂技木偶', isNpc: true,
      hp: 500, maxHp: 500, attack: 1, defense: 0, speed: 1
    }, { allowFlee: false, countKill: false })
    battle.toggleAuto()

    await vi.advanceTimersByTimeAsync(1600)

    expect(battle.logs.value.some(l => /烈焰斩/.test(l.text))).toBe(true)
    expect(player.spiritPower).toBeLessThan(100)
  })

  it('无魂力可用时自动回退到普通攻击', async () => {
    const player = usePlayerStore()
    const battle = useBattleSystem()
    player.spiritPower = 0
    player.skills = [
      { name: '究极魂技', type: '攻击', element: 'fire', damage: 999, cost: 500, cooldown: 1 }
    ]
    battle.start({
      id: 'fallback_dummy', name: '回退木偶', isNpc: true,
      hp: 500, maxHp: 500, attack: 1, defense: 0, speed: 1
    }, { allowFlee: false, countKill: false })
    battle.toggleAuto()

    await vi.advanceTimersByTimeAsync(1600)

    expect(battle.logs.value.some(l => /发动普通攻击/.test(l.text))).toBe(true)
    expect(battle.logs.value.some(l => /究极魂技/.test(l.text))).toBe(false)
  })
})

describe('resetBattle：页面卸载兜底复位（BUG-战斗切页锁定）', () => {
  function startEnemy(overrides = {}) {
    return {
      id: 'reset_target', name: '复位木偶', isNpc: true,
      hp: 500, maxHp: 500, attack: 1, defense: 0, speed: 1,
      ...overrides
    }
  }

  it('普通战斗进行中 resetBattle 后所有 active 标记与计时器全部清理，且不触发 onEnd', () => {
    const combat = useCombatStore()
    const battle = useBattleSystem()
    const ended = vi.fn()

    battle.startEventBattle(
      { id: 'reset_event', name: '复位事件' },
      { battle: startEnemy() },
      ended
    )
    expect(battle.isActive()).toBe(true)
    expect(battle.active.value).toBe(true)
    expect(combat._battleActive).toBe(true)

    battle.resetBattle()

    expect(battle.isActive()).toBe(false)
    expect(battle.active.value).toBe(false)
    expect(combat._battleActive).toBe(false)
    expect(ended).not.toHaveBeenCalled()
  })

  it('自动战斗开启时 resetBattle 清除自动计时器，时间推进不再产生行动', async () => {
    const battle = useBattleSystem()
    battle.start(startEnemy(), { allowFlee: false, countKill: false })
    battle.toggleAuto()
    await vi.advanceTimersByTimeAsync(1200)
    expect(battle.autoMode.value).toBe(true)

    battle.resetBattle()
    const logCount = battle.logs.value.length
    expect(battle.isActive()).toBe(false)

    await vi.advanceTimersByTimeAsync(5000)
    expect(battle.logs.value.length).toBe(logCount)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('训练战 resetBattle 同样清理且不回调 onVictory', () => {
    const battle = useBattleSystem()
    const onVictory = vi.fn()

    battle.startTraining(startEnemy(), onVictory)
    expect(battle.isActive()).toBe(true)

    battle.resetBattle()
    expect(battle.isActive()).toBe(false)
    expect(onVictory).not.toHaveBeenCalled()
  })

  it('Boss 战 resetBattle 后不再锁定事件引擎', () => {
    const battle = useBattleSystem()
    battle.start(startEnemy({ isBoss: true, allowFlee: false }), { allowFlee: false })
    expect(battle.isActive()).toBe(true)
    expect(battle.isBoss.value).toBe(true)

    battle.resetBattle()
    expect(battle.isActive()).toBe(false)
    expect(battle.enemy.value).toBe(null)
  })

  it('重复调用 resetBattle 幂等，无副作用', () => {
    const combat = useCombatStore()
    const battle = useBattleSystem()

    battle.resetBattle()
    battle.resetBattle()
    battle.resetBattle()

    expect(battle.isActive()).toBe(false)
    expect(battle.active.value).toBe(false)
    expect(combat._battleActive).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
