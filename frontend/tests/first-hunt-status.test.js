import { describe, expect, it } from 'vitest'
import { EVENTS } from '@/data/game-data'
import { migrateSave } from '@/engine/save'
import { buildFirstHuntStatus, prepareFirstHuntEvent } from '@/utils/ring-hunt'

const firstHunt = EVENTS.find(event => event.id === 'first_hunt')

describe('BUG-DIALOG-015 实战训练文案复用真实等级与魂环状态', () => {
  it.each([
    [5, 5],
    [9, 1]
  ])('Lv.%i 无魂环时显示距离 Lv.10 还差 %i 级', (level, remaining) => {
    const status = buildFirstHuntStatus({ level, ringCount: 0 })
    expect(status.state).toBe('training')
    expect(status.intro).toContain(`当前 Lv.${level}`)
    expect(status.intro).toContain(`还差 ${remaining} 级`)
    expect(status.result).toContain(`还差 ${remaining} 级`)
  })

  it.each([10, 12])('Lv.%i 无魂环时明确资格已解锁但训练本身不授环', level => {
    const prepared = prepareFirstHuntEvent(firstHunt, { level, rings: [] })
    expect(prepared.trainingStatus).toBe('eligible')
    expect(prepared.text.join(' ')).toContain(`当前 Lv.${level}`)
    expect(prepared.text.join(' ')).toContain('第一魂环猎取资格已经解锁')
    expect(prepared.choices[1].result.text).toContain('第一魂环目标已解锁')
    expect(prepared.choices[1].result.text).not.toContain('当前等级未达到 Lv.10')
  })

  it('Lv.12 已有第一魂环时明确为补做训练且不重复授环', () => {
    const prepared = prepareFirstHuntEvent(firstHunt, { level: 12, rings: [{ name: '十年魂环' }] })
    expect(prepared.trainingStatus).toBe('ring-owned')
    expect(prepared.text.join(' ')).toContain('已经拥有第1魂环')
    expect(prepared.choices[1].result.text).toContain('不会重复授环')
    expect(prepared.choices[1].result.text).toContain('第2魂环将在 Lv.20 解锁')
  })

  it('准备动态文案不修改静态事件源', () => {
    const before = JSON.stringify(firstHunt)
    prepareFirstHuntEvent(firstHunt, { level: 12, rings: [] })
    expect(JSON.stringify(firstHunt)).toBe(before)
    expect(before).not.toContain('当前等级未达到 Lv.10')
  })

  it('旧档读取时按等级和魂环数恢复唯一正确的猎环目标', () => {
    const make = (level, rings = []) => migrateSave({
      name: `Lv${level}旧档`, spirit: { name: '铁锤' }, level, rings,
      skills: rings.map((ring, index) => ({ name: ring.skill || `第${index + 1}魂技` })),
      pendingRingLv: null
    })
    expect(make(9).pendingRingLv).toBeNull()
    expect(make(10).pendingRingLv).toBe(10)
    expect(make(12).pendingRingLv).toBe(10)
    expect(make(12, [{ name: '十年魂环', skill: '灵鹿魂技' }]).pendingRingLv).toBeNull()
    expect(make(20, [{ name: '十年魂环', skill: '灵鹿魂技' }]).pendingRingLv).toBe(20)
  })
})
