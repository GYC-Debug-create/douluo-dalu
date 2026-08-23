/**
 * 洗牌袋抽取队列测试（经济规格 v2：多周目不撞车）
 */
import { describe, expect, it } from 'vitest'
import { buildDrawQueue } from '@/engine/event-rules'

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t ^ (t >>> 7) | 0)
    t = Math.imul(t, 2246822507)
    t = Math.imul(t ^ (t >>> 13), 3266489909)
    return ((t ^= t >>> 16) >>> 0) / 4294967296
  }
}

describe('buildDrawQueue 洗牌袋', () => {
  it('每个候选恰好出现一次（耗尽前零重复）', () => {
    const q = buildDrawQueue(['a', 'b', 'c', 'd', 'e'])
    expect(q).toHaveLength(5)
    expect([...q].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(new Set(q).size).toBe(5)
  })

  it('确定性：同一种子产出同一序列，不同种子通常不同', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `ev_${i}`)
    const weights = Object.fromEntries(ids.map(id => [id, 1]))
    const a = buildDrawQueue(ids, weights, mulberry32(42))
    const b = buildDrawQueue(ids, weights, mulberry32(42))
    expect(a).toEqual(b)
    let differ = false
    for (let s = 1; s < 20 && !differ; s++) {
      if (JSON.stringify(buildDrawQueue(ids, weights, mulberry32(s))) !== JSON.stringify(a)) differ = true
    }
    expect(differ).toBe(true)
  })

  it('权重影响出场早晚：高权重候选平均位置显著靠前', () => {
    const ids = ['heavy', ...Array.from({ length: 19 }, (_, i) => `light_${i}`)]
    const weights = { heavy: 20 }
    for (const id of ids.slice(1)) weights[id] = 1
    const trials = 400
    const pos = new Map(ids.map(id => [id, 0]))
    for (let t = 0; t < trials; t++) {
      const q = buildDrawQueue(ids, weights, mulberry32(1000 + t))
      q.forEach((id, idx) => pos.set(id, pos.get(id) + idx))
    }
    const heavyMean = pos.get('heavy') / trials
    const lightMean = ids.slice(1).reduce((s, id) => s + pos.get(id), 0) / (trials * 19)
    expect(heavyMean).toBeLessThan(lightMean * 0.7)
  })

  it('空与非法输入安全', () => {
    expect(buildDrawQueue([])).toEqual([])
    expect(buildDrawQueue(null)).toEqual([])
    expect(buildDrawQueue([null, '', undefined])).toEqual([])
    expect(buildDrawQueue(['only'])).toEqual(['only'])
  })

  it('非法/超界权重被钳制，不影响每候选一次的保证', () => {
    const q = buildDrawQueue(['x', 'y'], { x: -5, y: 999 })
    expect([...q].sort()).toEqual(['x', 'y'])
  })
})
