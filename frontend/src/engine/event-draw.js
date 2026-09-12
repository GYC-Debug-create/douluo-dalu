/**
 * 事件抽取纯逻辑层（单一来源）
 *
 * 从 useEventEngine.js 下沉：随机工具、近期冷却轮换、特质加权、洗牌袋抽取。
 * 全部为纯函数，不 import 任何 store——候选池与历史状态由调用方传入，
 * 便于脱离 Pinia 直测，也保证抽取顺序与拆分前逐位一致（快照测试护栏）。
 */

'use strict';

import { buildDrawQueue } from './event-rules'

export function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// 出身标签映射（事件 tags 与出身的亲和加权用）
export const ORIGIN_TAGS = {
  star_forest: ['wild', 'survive', 'nature', 'hunt'],
  spirit_city: ['social', 'sect', 'noble', 'trade'],
  border_town: ['fight', 'guard', 'military', 'weapon'],
  sea_island: ['sea', 'water', 'nature', 'speed']
}

/**
 * 事件与玩家画像的亲和加权（原 useEventEngine.eventMatchBonus 的纯函数版）。
 * @param {object} ev 事件（可带 tags）
 * @param {object} profile { personality, destiny, origin, spiritType }
 *   personality/destiny 缺失时返回 0，与旧实现一致。
 */
export function eventMatchBonus(ev, profile) {
  let bonus = 0
  const pt = profile?.personality
  const dy = profile?.destiny
  if (!pt || !dy) return 0
  if (ev.tags && pt.traits) {
    for (const tag of ev.tags) {
      if (pt.traits.includes(tag)) bonus += 2
      if (pt.subtype === tag) bonus += 3
      if (profile.spiritType === tag) bonus += 2
    }
  }
  if (ev.tags && dy.tags) {
    for (const tag of ev.tags) {
      if (dy.tags.includes(tag)) bonus += 3
    }
  }
  const originTags = ORIGIN_TAGS[profile.origin] || []
  if (ev.tags && originTags.length) {
    for (const tag of ev.tags) {
      if (originTags.includes(tag)) bonus += 3
    }
  }
  return bonus
}

// 优先轮换未经历事件，并完全避开近期事件；只有候选池确实无法轮换时才回退。
// 回退时也只保留近期出现次数最少、最久未出现的候选，避免直接退回整个原池造成连刷。
export function cooldownSafeEventPool(pool, recentEvents, completedEvents) {
  const source = Array.isArray(pool) ? pool.filter(Boolean) : []
  if (source.length === 0) return []
  const recent = Array.isArray(recentEvents) ? recentEvents.filter(Boolean) : []

  if (Array.isArray(completedEvents)) {
    const completed = new Set(completedEvents)
    const unseen = source.filter(event => !completed.has(event.id))
    if (unseen.length > 0) return unseen
  }

  const recentSet = new Set(recent)
  const cooled = source.filter(event => !recentSet.has(event.id))
  if (cooled.length > 0) return cooled
  if (source.length === 1) return source

  const counts = new Map()
  for (const id of recent) {
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  const minimumCount = Math.min(...source.map(event => counts.get(event.id) || 0))
  const leastRepeated = source.filter(event => (counts.get(event.id) || 0) === minimumCount)
  const oldestLastIndex = Math.min(...leastRepeated.map(event => recent.lastIndexOf(event.id)))
  return leastRepeated.filter(event => recent.lastIndexOf(event.id) === oldestLastIndex)
}

/**
 * 洗牌袋无放回抽取（经济规格 v2）——纯函数版。
 * 候选按权重洗成队列后逐个弹出，耗尽才重洗；队列随存档持久化，
 * 地点或阶段变化时键控失效重建。近期记录由调用方前置排除（recentCooldown）。
 *
 * @param {Array} candidates 候选事件（非空）
 * @param {{queue?: Array, key?: string}} bag 持久化的洗牌袋状态
 * @param {string} nextKey 本次抽取的键（地点|阶段）
 * @param {(ev: object) => number} weightOf 返回事件最终权重（含亲和加成）
 * @returns {{ id: string, queue: string[], key: string } | null}
 */
export function drawFromBagPure(candidates, bag, nextKey, weightOf) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const storedQueue = Array.isArray(bag?.queue) ? bag.queue : []
  let queue = bag?.key === nextKey ? storedQueue.slice() : []
  const validIds = new Set(candidates.map(e => e.id))
  while (queue.length > 0 && !validIds.has(queue[0])) queue.shift()
  if (queue.length === 0) {
    const weights = {}
    for (const e of candidates) weights[e.id] = Math.max(1, weightOf(e))
    queue = buildDrawQueue(candidates.map(e => e.id), weights)
  }
  let pickedId = null
  while (queue.length > 0) {
    const id = queue.shift()
    if (validIds.has(id)) { pickedId = id; break }
  }
  if (!pickedId) pickedId = candidates[0].id
  return { id: pickedId, queue, key: nextKey }
}
