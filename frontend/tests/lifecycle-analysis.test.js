import { describe, expect, it } from 'vitest'
import { creationAnalysis, progressionAnalysis, contentAnalysis, mapAnalysis, buildAnalysis, ringAnalysis, economyAnalysis, exportLifecycleCsv } from '@/utils/lifecycle-analysis'
import { experienceNeededForLevel, phaseForLevel } from '@/engine/rules'
import { EVENTS, SKILL_TREE, CHALLENGE_TOWER, SHOP_ITEMS } from '@/data/game-data'

describe('完整可玩生命周期分析数据', () => {
  it('觉醒档位按当前随机函数精确分布，含推荐出身升档和50次保底口径', () => {
    const a = creationAnalysis()
    expect(a.tierWeights.base.map(x => x.probability)).toEqual([.4,.35,.18,.06,.01])
    expect(a.tierWeights.recommended.reduce((s,x)=>s+x.probability,0)).toBeCloseTo(1)
    expect(a.tierWeights.recommended.find(x=>x.tier==='god').probability).toBeCloseTo(.016)
    expect(a.pity.cap).toBe(50)
    expect(a.pity.pityGuaranteedAt50).toBe(true)
    expect(a.quality.reduce((s,x)=>s+x.count,0)).toBeGreaterThan(0)
  })

  it('成长曲线覆盖99次升级、九个魂环门槛、十五主线与四种倾向结局', () => {
    const a=progressionAnalysis()
    expect(a.levels).toHaveLength(99)
    expect(a.levels[0].required).toBe(experienceNeededForLevel(1))
    expect(a.levels[98].required).toBe(experienceNeededForLevel(99))
    expect(a.levels.map(x=>x.phase)).toEqual(Array.from({length:99},(_,i)=>phaseForLevel(i+1)))
    expect(a.gates).toHaveLength(9)
    expect(a.mainStory).toHaveLength(15)
    expect(a.endings.filter(x=>x.tendency)).toHaveLength(4)
  })

  it('事件密度只计引擎判为可达的事件，并标注文本推演边界', () => {
    const a=contentAnalysis(30)
    expect(a.phase).toBe('adventure')
    expect(a.locationDensity.length).toBeGreaterThan(0)
    expect(a.rewardDistribution.experience.choiceCount).toBeGreaterThan(0)
    expect(a.method).toContain('按引擎规则处理')
    expect(a.explanation).toContain('静态文本/门槛推演')
  })

  it('地图分析覆盖每个实际地点并引用旅行纯函数可算出的费用和天数', () => {
    const a=mapAnalysis()
    expect(a.locations.length).toBeGreaterThan(0)
    expect(a.locations.every(x=>x.normalDays>=1&&x.fastDays>=1&&x.fastCost===x.normalCost*2)).toBe(true)
    expect(a.locations.every(x=>Array.isArray(x.connectedTo))).toBe(true)
  })

  it('build分析完整覆盖技能节点、挑战塔层、成就和关系互动', () => {
    const a=buildAnalysis()
    expect(a.skills.length).toBe(Object.values(SKILL_TREE).reduce((s,b)=>s+b.nodes.length,0))
    expect(a.tower.length).toBe(CHALLENGE_TOWER.floors.length)
    expect(a.achievements.length).toBeGreaterThan(30)
    expect(a.achievements.every(row=>row.reward.gold===50&&row.reward.exp===20)).toBe(true)
    expect(a.interactions).toHaveLength(6)
    expect(a.relationTiers.at(-1).min).toBe(500)
  })

  it('九环逐项包含真实选项、年限、战斗档位、胜后吸收率和结果', () => {
    const a=ringAnalysis()
    const source=EVENTS.filter(e=>/^ring_hunt_/.test(e.id))
    expect(a.rings).toHaveLength(9)
    expect(a.rings.map(x=>x.choices.length)).toEqual(source.map(x=>x.choices.length))
    expect(a.rings.flatMap(x=>x.choices).filter(x=>x.grantsRing).every(x=>x.difficulty&&x.absorbChance>0&&x.result)).toBe(true)
    const refinement=a.rings.find(x=>x.requiredLevel===60).choices[1]
    expect(refinement.grantsRing).toBe(false)
    expect(refinement.absorbChance).toBeNull()
    expect(a.rings.flatMap(x=>x.choices).some(x=>x.year===null)).toBe(true) // Source omits some ringYear values; preserve the gap instead of inventing years.
  })

  it('经济分析逐项覆盖商店和签到配置，导出含八域完整CSV字段头', () => {
    const a=economyAnalysis(), csv=exportLifecycleCsv()
    expect(a.shop).toHaveLength(SHOP_ITEMS.length)
    expect(a.dailyRewards).toHaveLength(7)
    expect(csv.startsWith('"系统","条目","指标","值","单位","证据与来源"')).toBe(true)
    for(const name of ['creation','progression','content','map','build','rings','economy']) expect(csv).toContain(name)
    expect(csv.length).toBeGreaterThan(10000)
  })
})
