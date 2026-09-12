/**
 * engine/event-draw.js 纯函数直测
 *
 * 抽取逻辑从 useEventEngine 下沉后的独立回归：轮换冷却、亲和加权、洗牌袋。
 * 行为契约与下沉前逐位一致（event-engine.test / 快照测试覆盖整链路，
 * 本文件保证纯层在脱离 Pinia 的环境下可独立验收）。
 */
import { describe, expect, it } from 'vitest'
import {
  cooldownSafeEventPool,
  drawFromBagPure,
  eventMatchBonus,
  ORIGIN_TAGS
} from '@/engine/event-draw'

const ev = (id, weight = 1, tags = undefined) => ({ id, weight, tags })

describe('cooldownSafeEventPool 轮换冷却', () => {
  it('优先返回未完成事件', () => {
    const pool = [ev('a'), ev('b'), ev('c')]
    expect(cooldownSafeEventPool(pool, [], ['a'])).toEqual([ev('b'), ev('c')])
  })

  it('全部完成时避开近期事件', () => {
    const pool = [ev('a'), ev('b'), ev('c')]
    expect(cooldownSafeEventPool(pool, ['a'], ['a', 'b', 'c'])).toEqual([ev('b'), ev('c')])
  })

  it('无法避开时只保留出现最少、最久未出现的候选', () => {
    const pool = [ev('a'), ev('b'), ev('c')]
    expect(cooldownSafeEventPool(pool, ['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([ev('a')])
    expect(cooldownSafeEventPool(pool, ['a', 'b', 'c', 'a'], ['a', 'b', 'c'])).toEqual([ev('b')])
  })

  it('单事件池不被筛空', () => {
    const pool = [ev('only')]
    expect(cooldownSafeEventPool(pool, ['only'], ['only'])).toEqual(pool)
  })
})

describe('eventMatchBonus 亲和加权', () => {
  const profile = {
    personality: { traits: ['战斗'], subtype: '武器' },
    destiny: { tags: ['hunt'] },
    origin: 'star_forest',
    spiritType: '兽武魂'
  }

  it('按 特质+2 / 亚型+3 / 武魂类型+2 / 命运+3 / 出身+3 累加', () => {
    // '战斗' 命中特质(+2)；'武器' 命中亚型(+3)；
    // 'hunt' 同时命中命运(+3)与星斗出身(+3)；'nature' 命中星斗出身(+3)
    const bonus = eventMatchBonus(ev('x', 1, ['战斗', '武器', 'hunt', 'nature']), profile)
    expect(bonus).toBe(2 + 3 + 3 + 3 + 3)
  })

  it('spiritType 只参与 tags 比对', () => {
    const bonus = eventMatchBonus(ev('x', 1, ['兽武魂']), profile)
    expect(bonus).toBe(2)
  })

  it('personality 或 destiny 缺失时返回 0', () => {
    expect(eventMatchBonus(ev('x', 1, ['战斗']), { ...profile, personality: null })).toBe(0)
    expect(eventMatchBonus(ev('x', 1, ['战斗']), { ...profile, destiny: undefined })).toBe(0)
  })

  it('出身标签表保持四出身齐全', () => {
    expect(Object.keys(ORIGIN_TAGS).sort()).toEqual(['border_town', 'sea_island', 'spirit_city', 'star_forest'])
  })
})

describe('drawFromBagPure 洗牌袋', () => {
  it('同批候选耗尽前不重复', () => {
    const candidates = [ev('a'), ev('b'), ev('c')]
    const bag = { queue: [], key: 'loc|academy' }
    const seen = []
    let result = null
    for (let i = 0; i < 3; i++) {
      result = drawFromBagPure(candidates, { queue: result?.queue ?? bag.queue, key: bag.key }, bag.key, e => e.weight)
      seen.push(result.id)
    }
    expect(new Set(seen).size).toBe(3)
    expect(seen).toHaveLength(3)
  })

  it('键变化时重建队列', () => {
    const candidates = [ev('a'), ev('b')]
    const first = drawFromBagPure(candidates, { queue: ['a'], key: 'old' }, 'new', e => e.weight)
    // 键失效 → 旧队列作废重建，两候选都可能被抽到且队列重新生成
    expect(['a', 'b']).toContain(first.id)
    expect(first.key).toBe('new')
  })

  it('队列中失效候选会被跳过', () => {
    const candidates = [ev('b')]
    const result = drawFromBagPure(candidates, { queue: ['ghost', 'b'], key: 'k' }, 'k', e => e.weight)
    expect(result.id).toBe('b')
  })

  it('候选耗尽且队列耗尽时回退到第一个候选', () => {
    const candidates = [ev('a')]
    const result = drawFromBagPure(candidates, { queue: [], key: 'k' }, 'k', e => e.weight)
    expect(result.id).toBe('a')
  })

  it('空候选池返回 null', () => {
    expect(drawFromBagPure([], { queue: [], key: 'k' }, 'k', e => e.weight)).toBeNull()
  })
})
