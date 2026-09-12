/**
 * 地图旅行遭遇（纯内容 + 纯装配，不 import store）
 *
 * 从 useEventEngine.js 移出。抽取结果在 MapPage 离开前就写入 sessionStorage，
 * 这里仅决定遭遇内容，避免玩家通过刷新反复重掷"是否遇险"。
 * 随机调用顺序与拆分前保持一致（先掷遭遇、再按类型掷敌人/宝物）。
 */

'use strict';

import { rand, pick } from '@/engine/event-draw'

export const TRAVEL_ENCOUNTERS = [
  { id: 'ambush_beast', weight: 30, minLevel: 1, type: 'battle', text: '一只野生魂兽突然从草丛中窜出，拦住了你的去路！' },
  { id: 'wandering_merchant', weight: 15, minLevel: 1, type: 'merchant', text: '一位行商路过，他打量了你一番：“魂师大人，要看看我的商品吗？”' },
  { id: 'lost_traveler', weight: 12, minLevel: 1, type: 'event', text: '你遇到一位迷路的旅人，他看起来十分焦急。' },
  { id: 'spirit_fragment', weight: 10, minLevel: 5, type: 'reward', text: '你在路边发现了一块散发着微光的灵力碎片！' },
  { id: 'ancient_cache', weight: 8, minLevel: 10, type: 'reward', text: '你发现了一个古老的藏宝箱！' },
  { id: 'rival_soul_master', weight: 15, minLevel: 8, type: 'battle', text: '一位同级别的魂师拦住了你：“来切磋一番如何？”' },
  { id: 'rare_beast', weight: 5, minLevel: 15, type: 'battle', text: '你感受到了一股强大的气息——一只罕见的精英魂兽出现了！' }
]

/** 按权重轮盘抽取一次遭遇（消耗一次随机数，与拆分前一致）。 */
export function pickTravelEncounter(available, randFn = Math.random) {
  const totalWeight = available.reduce((sum, encounter) => sum + encounter.weight, 0)
  let roll = randFn() * totalWeight
  let encounter = available[available.length - 1]
  for (const candidate of available) {
    roll -= candidate.weight
    if (roll <= 0) {
      encounter = candidate
      break
    }
  }
  return encounter
}

/** 旅行战斗敌人数值（消耗随机数的位置与拆分前一致）。 */
export function buildTravelEnemy(encounter, playerLevel, randFn = Math.random) {
  if (encounter.id === 'ambush_beast') {
    const level = Math.max(1, playerLevel + rand(-2, 2))
    return {
      id: 'travel_wild_beast', beastId: '野生魂兽', name: '野生魂兽', icon: '🐺', isBeast: true, isNpc: false,
      maxHp: 30 + level * 12, hp: 30 + level * 12,
      attack: 8 + level * 3, defense: 4 + level * 2, speed: 6 + level * 2,
      exp: 20 + level * 5, gold: 10 + level * 3
    }
  }
  if (encounter.id === 'rival_soul_master') {
    const level = Math.max(1, playerLevel)
    return {
      id: 'travel_soul_master', name: '魂师挑战者', icon: '⚔️', isNpc: true,
      maxHp: Math.round(40 + level * 15), hp: Math.round(40 + level * 15),
      attack: Math.round(10 + level * 3.5), defense: Math.round(5 + level * 2.5), speed: Math.round(8 + level * 2),
      exp: 30 + level * 8, gold: 20 + level * 5
    }
  }
  const level = Math.max(1, playerLevel + 3)
  return {
    id: 'travel_rare_beast', beastId: '精英魂兽', name: '精英魂兽', icon: '👹', isBeast: true, isNpc: false, isBoss: true, special: '精英',
    maxHp: Math.round(60 + level * 20), hp: Math.round(60 + level * 20),
    attack: Math.round(15 + level * 4), defense: Math.round(8 + level * 3), speed: Math.round(10 + level * 2),
    exp: 50 + level * 12, gold: 50 + level * 8
  }
}

/**
 * 将一次已确认发生的旅行遭遇装配为 Vue 事件对象。
 * @param {object} input { encounter, playerLevel, arrival, targetName, fromName, lead }
 */
export function buildTravelEncounterEvent({ encounter, playerLevel, arrival, targetName, fromName, lead }) {
  const ev = {
    id: `travel_encounter_${encounter.id}`,
    name: `旅途遭遇 · ${targetName}`,
    location: targetName,
    text: [lead, encounter.text],
    _ephemeral: true,
    _worldActionAlreadyCounted: true,
    _travelArrival: {
      targetId: arrival.targetId,
      targetName,
      destinationPlan: arrival.destinationPlan && typeof arrival.destinationPlan === 'object' ? arrival.destinationPlan : null,
      arrivalSummary: lead
    },
    choices: []
  }

  if (encounter.type === 'battle') {
    const enemy = buildTravelEnemy(encounter, playerLevel)
    ev.choices = [{
      text: encounter.id === 'rival_soul_master' ? '接受切磋' : '迎战',
      result: {
        battle: enemy,
        exp: enemy.exp,
        gold: enemy.gold,
        text: `你战胜了「${enemy.name}」，清理好战场后继续赶路。`
      }
    }]
  } else if (encounter.id === 'spirit_fragment') {
    ev.choices = [{ text: '吸收灵力碎片', result: { mp: 20, text: '碎片化作温暖的魂光，融入你的经脉。' } }]
  } else if (encounter.id === 'ancient_cache') {
    const gold = 100 + playerLevel * 10
    ev.choices = [{ text: '打开藏宝箱', result: { gold, text: `古老的锁扣应声而开，你找到了${gold}金币。` } }]
  } else if (encounter.type === 'merchant') {
    const mysteryRewards = [
      { gold: 320, text: '宝箱里藏着一袋旧时代金币。' },
      { maxHp: 5, text: '宝箱中的生命晶石融入体内，永久强化了体魄。' },
      { item: { name: '稀有魂力药剂', type: 'mp', value: 60, count: 1 }, text: '宝箱中是一瓶保存完好的稀有魂力药剂。' }
    ]
    const mystery = pick(mysteryRewards)
    ev.choices = [
      { text: '购买初级恢复丹（50金币）', cond: { gold: 50 }, cost: { gold: 50 }, result: { item: { name: '初级恢复丹', type: 'heal', value: 30, count: 1 }, text: '你买下了一枚初级恢复丹。' } },
      { text: '购买魂力药水（80金币）', cond: { gold: 80 }, cost: { gold: 80 }, result: { item: { name: '魂力药水', type: 'mp', value: 20, count: 1 }, text: '你买下了一瓶魂力药水。' } },
      { text: '购买神秘宝箱（200金币）', cond: { gold: 200 }, cost: { gold: 200 }, result: mystery },
      { text: '谢绝行商，继续赶路', result: { text: '你谢过行商，重新踏上旅途。' } }
    ]
  } else {
    ev.choices = [
      { text: '为旅人指明道路', result: { gold: 20, text: '旅人感谢你的帮助，赠予你20金币。' } },
      { text: '谨慎离开', result: { text: '你没有停留太久，确认四周安全后继续赶路。' } }
    ]
  }
  return ev
}
