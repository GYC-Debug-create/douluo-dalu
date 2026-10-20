import { describe, expect, it } from 'vitest'
import { itemPurchaseAvailability } from '@/engine/economy-rules'
import { experienceNeededForLevel } from '@/engine/rules'

const pill = { id: 'exp_pill', type: 'exp', price: 300, reqLevel: 5 }

describe('经验丹购买经济规则', () => {
  it('封锁100级与魂环上限等级，允许上限前正常购买且只检查购买能力', () => {
    expect(itemPurchaseAvailability(pill, { level: 100, rings: Array(10), gold: 500 })).toEqual({ ok: false, reason: '已达100级，经验丹不可购买' })
    expect(itemPurchaseAvailability(pill, { level: 90, rings: Array(8), gold: 500 })).toEqual({ ok: false, reason: '当前魂环上限为90级，获得下一魂环后可购买' })
    expect(itemPurchaseAvailability(pill, { level: 99, rings: Array(9), gold: 500 })).toEqual({ ok: true, reason: '' })
    expect(itemPurchaseAvailability(pill, { level: 99, rings: Array(9), gold: 299 })).toEqual({ ok: false, reason: '金币不足' })
  })

  it('保留之前经验丹出售时的确定性收益样本供修复前后对照', () => {
    const lv100Exp = Math.max(400, Math.round(experienceNeededForLevel(100) * 0.5))
    expect(lv100Exp).toBe(2195)
    expect(lv100Exp - pill.price).toBe(1895)
    expect(itemPurchaseAvailability(pill, { level: 100, rings: Array(10), gold: 500 }).ok).toBe(false)
    expect(Math.round(experienceNeededForLevel(90) * 0.5)).toBe(1945)
  })
})
