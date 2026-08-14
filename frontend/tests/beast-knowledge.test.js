import { describe, expect, it } from 'vitest'
import { EVENTS } from '@/data/game-data'
import { prepareFirstRingEvent } from '@/utils/ring-hunt'
import {
  HUNTING_HISTORY_LIMIT,
  beastKnowledgeSummary,
  huntingJournalRows,
  knowledgeRank,
  normalizeHuntingKnowledge,
  recordBeastOutcome
} from '@/utils/beast-knowledge'
import serializerSource from '@/stores/serializer.js?raw'
import battleSource from '@/composables/useBattleSystem.js?raw'
import statusSource from '@/components/StatusPanel.vue?raw'

const rabbit = { id: '野兔', beastId: '野兔', name: '百年野兔', tier: 'hundred', isBeast: true, isNpc: false }

describe('BUG-DIALOG-013 玩家可见的猎魂历练、了解度与简记', () => {
  it('从真实魂兽胜利生成一次简记、20 点了解度和20点猎魂历练', () => {
    const result = recordBeastOutcome(null, rabbit, 'victory', { ringHunt: true, eventName: '第一魂环', time: 1000 })
    expect(result.gain).toBe(20)
    expect(result.knowledge.experience).toBe(20)
    expect(result.entry).toMatchObject({ id: '野兔', name: '野兔', knowledge: 20, encounters: 1, victories: 1, highestTier: 'hundred' })
    expect(result.knowledge.history[0]).toMatchObject({ beastId: '野兔', outcome: 'victory', ringHunt: true, time: 1000 })
  })

  it('战败与脱离也留下经验，但增量低于胜利并在100封顶', () => {
    let current = null
    current = recordBeastOutcome(current, rabbit, 'defeat', { time: 1 }).knowledge
    current = recordBeastOutcome(current, rabbit, 'escape', { time: 2 }).knowledge
    for (let i = 0; i < 8; i += 1) current = recordBeastOutcome(current, rabbit, 'victory', { time: 3 + i }).knowledge
    expect(current.experience).toBe(175)
    expect(current.beasts['野兔']).toMatchObject({ knowledge: 100, encounters: 10, victories: 8, defeats: 1, escapes: 1 })
    expect(current.history).toHaveLength(10)
    expect(knowledgeRank(100)).toBe('精通')
  })

  it('NPC、训练木偶和未标记为魂兽的Boss不写入魂兽简记', () => {
    for (const enemy of [
      { id: 'rival', name: '学院对手', isNpc: true },
      { id: 'dummy', name: '训练木偶', isBeast: false },
      { id: 'abyss', name: '深渊之主', isBeast: false }
    ]) {
      const result = recordBeastOutcome(null, enemy, 'victory', { time: 1 })
      expect(result.gain).toBe(0)
      expect(result.knowledge.beasts).toEqual({})
    }
  })

  it('损坏旧值安全归一化，历史最多保留12条', () => {
    const source = { experience: -1, beasts: { 野兔: { knowledge: 999, encounters: -4, victories: 2 } }, history: [] }
    for (let i = 0; i < 20; i += 1) source.history.push({ beastId: '野兔', name: '野兔', outcome: 'victory', time: i })
    const normalized = normalizeHuntingKnowledge(source)
    expect(normalized.experience).toBe(0)
    expect(normalized.beasts['野兔'].knowledge).toBe(100)
    expect(normalized.beasts['野兔'].encounters).toBe(0)
    expect(normalized.history).toHaveLength(HUNTING_HISTORY_LIMIT)
  })

  it('第一魂环候选显示该角色已有记录，未知魂兽诚实显示无记录', () => {
    const known = recordBeastOutcome(null, rabbit, 'victory', { time: 1000 }).knowledge
    const event = EVENTS.find(item => item.id === 'ring_hunt_10')
    const prepared = prepareFirstRingEvent(event, { innatePower: 90, hp: 100 }, { maxHp: 100 }, known)
    expect(prepared.choices[0].strategy.knowledge).toBe('尚无实战记录')
    expect(prepared.choices[1].strategy.knowledge).toBe('初识 20/100 · 1战1胜')
    expect(beastKnowledgeSummary(known, '野兔').rank).toBe('初识')
  })

  it('侧边简记按最近遭遇排序并显示实际胜负摘要', () => {
    let current = recordBeastOutcome(null, rabbit, 'victory', { time: 10 }).knowledge
    current = recordBeastOutcome(current, { id: '毒蛛', name: '百年毒蛛', tier: 'hundred', isBeast: true }, 'defeat', { time: 20 }).knowledge
    expect(huntingJournalRows(current).map(entry => entry.id)).toEqual(['毒蛛', '野兔'])
    expect(huntingJournalRows(current)[0]).toMatchObject({ rank: '初识', outcomeLabel: '战败' })
  })

  it('战斗结算、存档和侧边UI接入同一 huntingKnowledge 字段', () => {
    expect(battleSource).toContain("combat.recordHuntingOutcome(battleState.enemy, 'victory'")
    expect(battleSource).toContain("combat.recordHuntingOutcome(battleState.enemy, 'defeat'")
    expect(battleSource).toContain("combat.recordHuntingOutcome(battleState.enemy, 'escape'")
    expect(serializerSource).toContain("'huntingKnowledge'")
    expect(statusSource).toContain('data-testid="hunter-journal"')
    expect(statusSource).toContain('最近记录')
  })
})
