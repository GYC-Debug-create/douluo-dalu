// 游戏和分析页共用的伙伴数值，冷却单位为游戏时段。
export const NPC_INTERACTIONS = Object.freeze([
  { id:'talk',name:'闲谈',cost:0,affinity:3,cooldown:3 },
  { id:'gift_small',name:'赠送小礼',cost:100,affinity:8,cooldown:2 },
  { id:'gift_big',name:'赠送重礼',cost:500,affinity:20,cooldown:5 },
  { id:'spar',name:'切磋武艺',cost:0,affinity:15,cooldown:5,type:'battle' },
  { id:'help',name:'协助事务',cost:0,affinity:10,cooldown:4,reqLevel:10 },
  { id:'feast',name:'设宴款待',cost:1000,affinity:35,cooldown:10,reqLevel:15 }
])

export const NPC_RELATION_REWARDS = Object.freeze({
  20:{bonus:{}}, 50:{bonus:{expMul:1.05}},
  100:{bonus:{attack:3,defense:2}},
  200:{bonus:{attack:8,defense:5,hp:50}},
  350:{bonus:{attack:15,defense:10,hp:100,speed:5,fateMul:1.1}},
  500:{bonus:{}}
})

export function relationshipBonuses(relations={}) {
  const result={attack:0,defense:0,hp:0,speed:0,expMul:1,fateMul:1}
  for(const affinity of Object.values(relations)) {
    for(const [threshold,{bonus}] of Object.entries(NPC_RELATION_REWARDS)) {
      if(Number(affinity)<Number(threshold)) continue
      for(const key of ['attack','defense','hp','speed']) result[key]+=Number(bonus[key])||0
      for(const key of ['expMul','fateMul']) if(bonus[key]) result[key]*=Number(bonus[key])
    }
  }
  return result
}
