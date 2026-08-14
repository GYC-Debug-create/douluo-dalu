import { describe, expect, it } from 'vitest'
import { migrateSave } from '@/engine/save'
import {
  isInternalRingLabel,
  normalizeRingPresentation,
  playerFacingBeastName,
  ringSourceForChoice
} from '@/utils/ring-names'

describe('BUG-DIALOG-014 魂环和魂技不泄漏内部英文键', () => {
  it('已知战斗键映射为稳定中文魂兽名', () => {
    expect(playerFacingBeastName('spirit_deer_ten')).toBe('灵鹿')
    expect(playerFacingBeastName('wind_rabbit_hundred')).toBe('疾风兔')
    expect(playerFacingBeastName('poison_spider_hundred')).toBe('毒蛛')
  })

  it('新魂环优先使用显式 beastName，不从 battle 内部键生成文案', () => {
    const choice = { beastName: '疾风兔', result: { battle: 'wind_rabbit_hundred' } }
    expect(ringSourceForChoice(choice, '百年魂环')).toBe('疾风兔')
  })

  it('旧 ring 的来源、魂技和 beastId 一起迁移，且不改数值字段', () => {
    const ring = normalizeRingPresentation({
      ringId: 'white_ring', name: '十年魂环', source: 'spirit_deer_ten',
      skill: 'spirit_deer_ten魂技', beastId: 'spirit_deer_ten', year: 10,
      skillDef: { damage: 42, cost: 15, cooldown: 3 }
    })
    expect(ring).toMatchObject({ source: '灵鹿', skill: '灵鹿魂技', beastId: '灵鹿', year: 10 })
    expect(ring.skillDef).toEqual({ damage: 42, cost: 15, cooldown: 3 })
  })

  it('完整旧存档迁移后魂环卡与战斗魂技保持同名中文', () => {
    const migrated = migrateSave({
      name: '旧档魂师', spirit: { name: '铁锤' }, level: 12,
      rings: [{
        ringId: 'white_ring', name: '十年魂环', source: 'spirit_deer_ten',
        skill: 'spirit_deer_ten魂技', beastId: 'spirit_deer_ten', year: 10,
        skillDef: { damage: 42, cost: 15, cooldown: 3 }
      }],
      skills: [{ name: 'spirit_deer_ten魂技', source: 'spirit_deer_ten', damage: 42, cost: 15, cooldown: 3 }]
    })
    expect(migrated.rings[0]).toMatchObject({ source: '灵鹿', skill: '灵鹿魂技', beastId: '灵鹿' })
    expect(migrated.skills[0]).toMatchObject({ name: '灵鹿魂技', source: '灵鹿', damage: 42, cost: 15, cooldown: 3 })
  })

  it('已经是中文的自定义魂技不被覆盖', () => {
    const ring = normalizeRingPresentation({ source: '独眼狼', skill: '流光斩', name: '百年魂环' })
    expect(ring).toMatchObject({ source: '独眼狼', skill: '流光斩' })
  })

  it('未知内部键不直接显示给玩家，普通中文来源保持不变', () => {
    expect(isInternalRingLabel('future_beast_thousand魂技')).toBe(true)
    expect(playerFacingBeastName('future_beast_thousand')).toBe('未知魂兽')
    expect(playerFacingBeastName('天青牛蟒')).toBe('天青牛蟒')
  })
})
