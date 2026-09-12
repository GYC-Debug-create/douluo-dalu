/**
 * engine/settlement.js 纯函数直测
 *
 * 结算逻辑从 useEventEngine 下沉后的独立回归：奖励结算/升级核心/魂环构造/结局判定。
 * view 为纯草稿对象、ctx 为注入桩，验证与拆分前一致的关键数值语义。
 */
import { describe, expect, it } from 'vitest'
import {
  applyResultRewards,
  settleLevelProgress,
  buildRingReward,
  ringYearValueFor,
  ringAbsorbChance,
  pickEnding
} from '@/engine/settlement'

// 简单结算上下文：无特质加成、等级→最大生命线性、称号/NPC 加成为 0。
function makeCtx(overrides = {}) {
  return {
    getSpiritBonus: () => 1,
    maxHpFor: (level) => 100 + (level - 1) * 10,
    maxSpiritPowerFor: (spiritPowerMax) => spiritPowerMax,
    expNeeded: level => 100,
    titleGold: 0,
    titlePowerGain: 0,
    fateMul: 1,
    expMul: 1,
    pick: arr => arr[0],
    spirits: [],
    ...overrides
  }
}

function makeView(overrides = {}) {
  return {
    bonus: { attack: 0, defense: 0, hp: 0, speed: 0 },
    hp: 80,
    spiritPower: 30,
    spiritPowerMax: 60,
    gold: 100,
    fatePoints: 0,
    inventory: [],
    level: 1,
    exp: 0,
    overflowExp: 0,
    spirit: { id: 's1', name: '铁铲', tier: 'mid' },
    spiritBase: { attack: 5, defense: 5, hp: 50, speed: 5 },
    ringCount: 0,
    totalGoldEarned: 0,
    ...overrides
  }
}

describe('settleLevelProgress 升级核心', () => {
  it('跨两级时回满生命，跨一级时回复一半缺口', () => {
    const ctx = makeCtx()
    const two = settleLevelProgress({ level: 1, exp: 250, overflowExp: 0, ringCount: 9, hp: 10, bonus: {}, spiritBase: {}, spiritPowerMax: 60 }, ctx)
    expect(two.levels).toEqual([2, 3])
    expect(two.hp).toBe(two.level && 120) // 满血 = maxHpFor(3) = 120
    expect(two.spiritPower).toBe(60)

    const one = settleLevelProgress({ level: 1, exp: 100, overflowExp: 0, ringCount: 9, hp: 10, bonus: {}, spiritBase: {}, spiritPowerMax: 60 }, ctx)
    expect(one.levels).toEqual([2])
    expect(one.hp).toBe(10 + Math.round((110 - 10) * 0.5))
  })

  it('无魂环时卡 10 级并给出 pendingRingLv 门槛', () => {
    const ctx = makeCtx({ expNeeded: () => 50 })
    const out = settleLevelProgress({ level: 8, exp: 200, overflowExp: 0, ringCount: 0, hp: 10, bonus: {}, spiritBase: {}, spiritPowerMax: 60 }, ctx)
    expect(out.level).toBe(10)
    expect(out.overflowExp).toBeGreaterThan(0)
    expect(out.pendingRingLv).toBe(10)
  })

  it('魂环已满 9 环时不再设置门槛', () => {
    const ctx = makeCtx({ expNeeded: () => 50 })
    const out = settleLevelProgress({ level: 95, exp: 0, overflowExp: 500, ringCount: 9, hp: 10, bonus: {}, spiritBase: {}, spiritPowerMax: 60 }, ctx)
    expect(out.pendingRingLv).toBeNull()
  })
})

describe('applyResultRewards 奖励结算', () => {
  it('永久属性结算并标注武魂共鸣', () => {
    const view = makeView()
    const ctx = makeCtx({ getSpiritBonus: field => (field === 'attack' ? 1.5 : 1) })
    const { summary } = applyResultRewards(view, { attack: 2, defense: 1, speed: -1 }, ctx)
    expect(view.bonus.attack).toBe(3)
    expect(view.bonus.defense).toBe(1)
    expect(view.bonus.speed).toBe(-1)
    expect(summary.list.some(t => t.includes('攻击+3（武魂共鸣）'))).toBe(true)
  })

  it('旧 hp 字段语义：正数治疗、负数伤害', () => {
    const view = makeView({ hp: 50 })
    applyResultRewards(view, { hp: 30 }, makeCtx())
    expect(view.hp).toBe(80)
    applyResultRewards(view, { hp: -7 }, makeCtx())
    expect(view.hp).toBe(73)
  })

  it('治疗不超过最大生命；伤害最低保留 1 点', () => {
    const view = makeView({ hp: 95 })
    applyResultRewards(view, { heal: 100 }, makeCtx())
    expect(view.hp).toBe(100) // maxHpFor(1) = 100
    applyResultRewards(view, { damage: 500 }, makeCtx())
    expect(view.hp).toBe(1)
  })

  it('金币按称号加成放大并计入累计；负金币不产生累计', () => {
    const view = makeView({ gold: 10 })
    const ctx = makeCtx({ titleGold: 0.5 })
    const { summary } = applyResultRewards(view, { gold: 100 }, ctx)
    expect(view.gold).toBe(160)
    expect(summary.gold).toBe(150)
    expect(view.totalGoldEarned).toBe(150)
    applyResultRewards(view, { gold: -30 }, makeCtx())
    expect(view.gold).toBe(130)
    expect(view.totalGoldEarned).toBe(150)
  })

  it('spiritPowerGain 翻倍进上限，当前魂力同步增加等量', () => {
    const view = makeView({ spiritPower: 10, spiritPowerMax: 60 })
    applyResultRewards(view, { spiritPowerGain: 5 }, makeCtx())
    expect(view.spiritPowerMax).toBe(70)
    expect(view.spiritPower).toBe(20) // 原语义：+gain（不回满）
  })

  it('item 添加/消耗与效果字段；库存不足时标记未消耗', () => {
    const view = makeView({ inventory: [{ name: '钥匙', type: 'special', value: 1, count: 2 }] })
    const { summary } = applyResultRewards(view, {
      item: { name: '钥匙', type: 'special', value: 1, count: -1 },
      item2: { name: '秘药', type: 'special', value: 2, count: 3, effect: { attack: 1, spiritPowerGain: 2, fate: 1 } }
    }, makeCtx())
    expect(view.inventory.find(i => i.name === '钥匙')?.count).toBe(1)
    expect(view.inventory.find(i => i.name === '秘药')?.count).toBe(3)
    expect(view.bonus.attack).toBe(3) // 效果字段 × 数量：1×3
    expect(view.spiritPowerMax).toBe(66) // 60 + 2×3
    expect(view.fatePoints).toBe(3) // 1×3
    expect(summary.items).toEqual([{ name: '钥匙', count: -1 }, { name: '秘药', count: 3 }])
    const second = applyResultRewards(view, { item: { name: '不存在', value: 9, count: -2 } }, makeCtx())
    expect(second.summary.list.some(t => t.includes('未消耗「不存在」（库存不足）'))).toBe(true)
  })

  it('healFull 完全恢复生命与魂力', () => {
    const view = makeView({ hp: 5, spiritPower: 0 })
    const { summary } = applyResultRewards(view, { healFull: true }, makeCtx())
    expect(view.hp).toBe(100)
    expect(view.spiritPower).toBe(60)
    expect(summary.list).toContain('完全恢复')
  })

  it('经验触发升级并回传通知数据；门槛暂存经验在升级时释放', () => {
    const view = makeView({ level: 1, exp: 0, overflowExp: 0, hp: 10, ringCount: 9 })
    const ctx = makeCtx()
    const { summary, levelUp, ringUnlock } = applyResultRewards(view, { exp: 250 }, ctx)
    expect(summary.exp).toBe(250)
    expect(summary.levelAfter).toBe(3)
    expect(summary.levels).toEqual([2, 3])
    expect(levelUp).toEqual({ level: 3, levels: [2, 3] })
    expect(view.hp).toBe(120) // 跨两级回满
    expect(ringUnlock).not.toBeNull()
  })

  it('满级时经验转化为金币', () => {
    const view = makeView({ level: 100, gold: 0 })
    const { summary } = applyResultRewards(view, { exp: 500 }, makeCtx())
    expect(view.gold).toBe(500)
    expect(summary.gold).toBe(500)
    expect(summary.list.some(t => t.includes('满级经验转化为金币'))).toBe(true)
    expect(summary.levelAfter).toBe(100)
  })

  it('命运值按 NPC 倍率放大', () => {
    const view = makeView()
    applyResultRewards(view, { fate: 2 }, makeCtx({ fateMul: 1.5 }))
    expect(view.fatePoints).toBe(3)
  })
})

describe('魂环与结局', () => {
  it('ringYearValueFor 选项显式年限优先，否则按定义 id 查表', () => {
    expect(ringYearValueFor({ ringYear: 4321 }, 'yellow_ring')).toBe(4321)
    expect(ringYearValueFor({}, 'million_gold_ring')).toBe(1000000)
    expect(ringYearValueFor({}, 'unknown')).toBe(0)
  })

  it('ringAbsorbChance 按年限递减，未知年限视为必定成功', () => {
    expect(ringAbsorbChance(10)).toBe(1)
    expect(ringAbsorbChance(100)).toBe(0.85)
    expect(ringAbsorbChance(1000000)).toBe(0.2)
    expect(ringAbsorbChance(999)).toBe(1)
  })

  it('buildRingReward 装配魂环与魂技，消耗随既有环数递增', () => {
    const definition = { id: 'yellow_ring', name: '百年魂环', tier: 'yellow', color: '#fff', statBonus: { attack: 2, defense: 1, hp: 5 } }
    const { ring, skill } = buildRingReward({
      definition, ordinal: 3, ringCountBefore: 2, playerLevel: 20,
      choice: {}, source: '百年'
    })
    expect(ring.ringId).toBe('yellow_ring')
    expect(ring.skillId).toBe('ring:yellow_ring:3')
    expect(ring.bonus).toEqual({ attack: 2, defense: 1, hp: 5 })
    expect(skill.cost).toBe(15 + 2 * 5)
    expect(skill.damage).toBe(Math.round(20 + 20 * 2.2 + 2 * 0.8))
    expect(skill.ring).toBe(3)
  })

  it('pickEnding 特殊结局优先，普通按命运值从高到低', () => {
    const ENDINGS = [
      { id: 'a', title: 'A', minFate: 10 },
      { id: 'b', title: 'B', minFate: 30, req: () => true },
      { id: 'c', title: 'C', minFate: 50 }
    ]
    expect(pickEnding(ENDINGS, 35, {})?.id).toBe('b')
    expect(pickEnding(ENDINGS, 20, {})?.id).toBe('a')
    expect(pickEnding(ENDINGS, 0, {})?.id).toBe('c') // 兜底为最后一项
  })
})
