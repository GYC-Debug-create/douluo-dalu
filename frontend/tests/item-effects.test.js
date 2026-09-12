/**
 * engine/item-effects.js 统一道具结算直测（阶段四B）
 *
 * 战斗内 useItem 与非战斗 useInventoryItem 共用同一份效果数学，
 * 本文件锁定两端共用的规则与两端的语义差异（buff/净化）。
 */
import { describe, expect, it } from 'vitest'
import { resolveConsumable, USABLE_ITEM_TYPES } from '@/engine/item-effects'

const state = { hp: 50, maxHp: 100, spiritPower: 10, maxSpiritPower: 60 }

describe('resolveConsumable 共用数学', () => {
  it('heal 按缺口回血，两端口径一致', () => {
    for (const mode of ['battle', 'inventory']) {
      const out = resolveConsumable({ type: 'heal', value: 30 }, state, mode)
      expect(out.ok).toBe(true)
      expect(out.effect.heal).toBe(30)
      expect(out.message).toBe('恢复 30 点生命')
    }
  })

  it('healFull 回满', () => {
    const out = resolveConsumable({ type: 'healFull' }, state, 'battle')
    expect(out.effect.heal).toBe(50)
  })

  it('满血拦截不消耗道具（两端口径统一）', () => {
    for (const mode of ['battle', 'inventory']) {
      const out = resolveConsumable({ type: 'heal', value: 30 }, { ...state, hp: 100 }, mode)
      expect(out.ok).toBe(false)
      expect(out.reason).toBe('hp-full')
    }
  })

  it('满魂力拦截不消耗（修复漂移：旧战斗版满魂力仍消耗）', () => {
    for (const mode of ['battle', 'inventory']) {
      const out = resolveConsumable({ type: 'mp', value: 20 }, { ...state, spiritPower: 60 }, mode)
      expect(out.ok).toBe(false)
      expect(out.reason).toBe('mp-full')
    }
  })
})

describe('mode 语义差异（设计如此）', () => {
  it('battle 增益 → 即时战斗状态', () => {
    const out = resolveConsumable({ type: 'buffAtk', value: 0.2 }, state, 'battle')
    expect(out.effect.status).toEqual({ id: 'rage', turns: 3, power: 0.2 })
  })

  it('inventory 增益 → 存 temp 字段待下场战斗', () => {
    const out = resolveConsumable({ type: 'buffDef', value: 0.2 }, state, 'inventory')
    expect(out.effect).toEqual({ tempField: '_tempDefBuff', value: 0.2 })
  })

  it('净化类只能在战斗中使用', () => {
    const statuses = [{ id: 'poison', turns: 2 }, { id: 'regen', turns: 1 }]
    const rejected = resolveConsumable({ type: 'cure' }, { ...state, statuses }, 'inventory')
    expect(rejected.ok).toBe(false)
    expect(rejected.reason).toBe('battle-only')

    const cured = resolveConsumable({ type: 'cure' }, { ...state, statuses }, 'battle')
    expect(cured.ok).toBe(true)
    expect(cured.effect.statuses).toEqual([{ id: 'regen', turns: 1 }])

    const nothing = resolveConsumable({ type: 'cureAll' }, { ...state, statuses: [{ id: 'regen', turns: 1 }] }, 'battle')
    expect(nothing.ok).toBe(false)
    expect(nothing.reason).toBe('nothing-to-cure')
  })

  it('未知类型两端都拒绝', () => {
    expect(resolveConsumable({ type: 'task' }, state, 'battle').ok).toBe(false)
    expect(resolveConsumable({ type: 'task' }, state, 'inventory').ok).toBe(false)
  })

  it('USABLE_ITEM_TYPES 覆盖全部可用品类', () => {
    expect(USABLE_ITEM_TYPES).toEqual(['heal', 'healFull', 'mp', 'buffAtk', 'buffDef', 'buffSpd', 'cure', 'cureAll'])
  })
})
