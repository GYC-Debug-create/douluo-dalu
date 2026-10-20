import { describe, expect, it } from 'vitest'
import { relationshipBonuses } from '@/engine/relationship-rules'
describe('伙伴关系累积的共享规则',()=>{
  it('阈值前后奖励只生效一次，500不虚增战斗奖励',()=>{
    expect(relationshipBonuses({a:49}).expMul).toBe(1)
    expect(relationshipBonuses({a:50}).expMul).toBe(1.05)
    expect(relationshipBonuses({a:350})).toEqual({attack:26,defense:17,hp:150,speed:5,expMul:1.05,fateMul:1.1})
    expect(relationshipBonuses({a:500})).toEqual(relationshipBonuses({a:350}))
  })
  it('不同伙伴属性相加而收益倍率相乘',()=>{
    const bonus=relationshipBonuses({a:350,b:100})
    expect(bonus.attack).toBe(29)
    expect(bonus.hp).toBe(150)
    expect(bonus.expMul).toBeCloseTo(1.1025)
    expect(bonus.fateMul).toBe(1.1)
  })
})
