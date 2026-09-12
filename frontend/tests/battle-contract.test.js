/**
 * 战斗 ↔ 事件契约测试（阶段一 1.3）
 *
 * 契约（engine/battle-contract.js）：
 *  - 战斗系统只接收请求单并发布标准化结果，不理解事件语义；
 *  - 战败/逃跑后的剧情挂起（猎环目标/主线里程碑）由事件层负责。
 * 这里用"真实引擎 + 真实战斗"的集成链路验证职责迁移后行为不变。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ORIGINS } from '@/data/game-data'
import { useEventEngine } from '@/composables/useEventEngine'
import { createEventBattleRequest } from '@/engine/battle-contract'
import { initNewCharacter } from '@/stores/serializer'
import { useEventStore } from '@/stores/event'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

const spirit = {
  id: 'contract_spirit', eventKey: 'contract', name: '契约武魂', tier: 'mid',
  type: '强攻系', subtype: '火', attack: 20, defense: 12, hp: 80, speed: 20,
  image: '', desc: '契约测试', icon: '⚔️'
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  initNewCharacter({ name: '契约验收', origin: ORIGINS[0], spirit, innatePower: 70 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('createEventBattleRequest 请求单', () => {
  it('透传敌人引用与猎环元数据', () => {
    const request = createEventBattleRequest({
      event: { id: 'ring_hunt_10', name: '第一魂环', ring: 'ten' },
      result: { battle: 'wind_rabbit_ten', exp: 100 }
    })
    expect(request.enemyRef).toBe('wind_rabbit_ten')
    expect(request.rewardResult).toEqual({ battle: 'wind_rabbit_ten', exp: 100 })
    expect(request.huntingMeta).toEqual({ ringHunt: true, eventName: '第一魂环' })
    expect(request.allowFlee).toBe(true)
  })

  it('finalBoss 由事件层判定，请求单只负责禁用逃跑', () => {
    const request = createEventBattleRequest({
      event: { id: 'final_evil', name: '最终决战' },
      result: { battle: 'bibi_dong' },
      finalBoss: true
    })
    expect(request.finalBoss).toBe(true)
    expect(request.allowFlee).toBe(false)
  })
})

describe('事件层接管战败/逃跑的剧情处理', () => {
  it('主线事件战败后由事件层挂起里程碑', async () => {
    const eventStore = useEventStore()
    eventStore._eventCount = 4
    const engine = useEventEngine()
    const ev = {
      id: 'story_battle_test', name: '主线试炼', _mainStory: true,
      choices: [{
        text: '迎战',
        result: { battle: { id: 'overwhelming_enemy', name: '强敌', isNpc: true, hp: 1000, maxHp: 1000, attack: 99999, defense: 10, speed: 999 } }
      }]
    }

    engine.applyChoice(ev, ev.choices[0], 0)
    await vi.advanceTimersByTimeAsync(1200)

    expect(eventStore._storyMilestoneDeferredUntil).toBe(6)
    expect(eventStore.doneEvents).not.toContain('story_battle_test')
  })

  it('魂环事件战败后由事件层挂起猎环目标', async () => {
    const eventStore = useEventStore()
    eventStore._eventCount = 7
    const engine = useEventEngine()
    const ev = {
      id: 'ring_battle_test', name: '猎环试炼', ring: 'ten',
      choices: [{
        text: '迎战',
        result: { battle: { id: 'overwhelming_beast', name: '强敌魂兽', isNpc: false, hp: 1000, maxHp: 1000, attack: 99999, defense: 10, speed: 999 } }
      }]
    }

    engine.applyChoice(ev, ev.choices[0], 0)
    await vi.advanceTimersByTimeAsync(1200)

    expect(eventStore._ringHuntDeferredUntil).toBe(9)
    expect(eventStore.doneEvents).not.toContain('ring_battle_test')
  })
})
