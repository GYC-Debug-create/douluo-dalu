import { describe, expect, it } from 'vitest'
import { growthCurve, encounterPreview, firstRingOptions, economySnapshot, numericalDesignCsv } from '@/utils/numerical-design'
import { advanceExperience, experienceNeededForLevel, OVERFLOW_LEVEL_LIMIT } from '@/engine/rules'
import { buildPrologueEvent } from '@/data/story-intro'

describe('数值设计说明的计算口径', () => {
  it('覆盖全部可升级等级，前期保持基线，后期减免不超过45%', () => {
    const curve = growthCurve()
    expect(curve).toHaveLength(99)
    expect(curve[0].required).toBe(40)
    expect(curve[9].required).toBe(565)
    expect(curve.filter(row => row.level <= 40).every(row => row.required === row.baseline)).toBe(true)
    expect(curve.every(row => row.required > 0 && row.required <= row.baseline)).toBe(true)
    expect(curve[79].multiplier).toBeCloseTo(0.55)
    expect(curve.at(-1).cumulative).toBe(curve.reduce((sum, row) => sum + row.required, 0))
  })

  it('门槛暂存和溢出确实按说明结算', () => {
    const result = advanceExperience({ level: 10, exp: 0, ringCount: 0, overflowExp: 0 }, 10000)
    expect(result.level).toBe(10)
    expect(result.overflowExp).toBe(Math.round(experienceNeededForLevel(10) * OVERFLOW_LEVEL_LIMIT))
    expect(result.wasted + result.overflowExp).toBe(10000)
  })

  it('固定条件的模型可复现，改变攻击只影响对应的适配属性', () => {
    const first = encounterPreview(100, 'normal')
    expect(first).toEqual(encounterPreview(100, 'normal'))
    const stronger = encounterPreview(200, 'normal')
    expect(stronger.enemy.maxHp).toBeGreaterThan(first.enemy.maxHp)
    expect(stronger.enemy.defense).toBeGreaterThan(first.enemy.defense)
    expect(stronger.enemy.attack).toBe(first.enemy.attack)
    expect(encounterPreview(100, 'hard').enemy.maxHp).toBeGreaterThan(first.enemy.maxHp)
  })

  it('吸收概率与战斗难度分开，并保留真实的第一环路线差异', () => {
    const options = firstRingOptions()
    expect(options.map(row => row.absorbChance)).toEqual([1, 0.85, 0.85])
    expect(options.map(row => row.difficulty)).toEqual(['normal', 'hard', 'hard'])
    expect(options.map(row => row.experience)).toEqual([1450, 2600, 3180])
  })

  it('签到只统计配置，满血药不被当作固定9999点收益', () => {
    const economy = economySnapshot()
    expect(economy.weeklyGold).toBe(2400)
    expect(economy.supplies.find(item => item.id === 'heal_full').efficiency).toBeNull()
    expect(economy.supplies.find(item => item.id === 'heal_small').efficiency).toBe(2)
  })

  it('下载表包含完整等级范围并标注概率与参数的边界', () => {
    const csv = numericalDesignCsv()
    expect(csv).toContain('Lv.99→100')
    expect(csv).toContain('不含战斗胜率')
    expect(csv).toContain('设计参数，不是实战统计')
    expect(csv).toContain('配置奖励，不是玩家实际收入')
  })

  it('序章将百分制资质与起始等级分开，避免出现82级的天赋描述', () => {
    const prologue = buildPrologueEvent({ name: '测试魂师', origin: 'star_forest', innatePower: 82 })
    expect(prologue.choices[0].result.text).toContain('觉醒资质82/100，起始魂力等级8级')
    expect(prologue.choices[0].result.text).not.toContain('82级')
  })
})
