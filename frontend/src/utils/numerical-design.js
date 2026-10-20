import { experienceNeededForLevel, lateGameExpMultiplier, OVERFLOW_LEVEL_LIMIT } from '@/engine/rules'
import { ENCOUNTER_PRESETS, scaleEnemyToPlayer } from '@/engine/battle-core'
import { encounterDifficulty } from '@/engine/battle-contract'
import { ringAbsorbChance } from '@/engine/settlement'
import { DAILY_REWARDS, EVENTS, SHOP_ITEMS } from '@/data/game-data'

export const DIFFICULTY_NAMES = Object.freeze({ easy: '普通遭遇', normal: '常规猎环 / 主线', hard: '越级挑战', boss: '最终决战' })

export function growthCurve() {
  let cumulative = 0
  let baselineCumulative = 0
  return Array.from({ length: 99 }, (_, index) => {
    const level = index + 1
    const baseline = Math.round(40 * Math.pow(level, 1.15))
    const required = experienceNeededForLevel(level)
    cumulative += required
    baselineCumulative += baseline
    return { level, required, baseline, cumulative, baselineCumulative, multiplier: lateGameExpMultiplier(level) }
  })
}

export function encounterPreview(attack = 100, difficulty = 'normal', role = 'balanced') {
  const stats = { attack: Math.max(1, Math.min(500, Number(attack) || 100)), defense: 60, maxHp: 1000, speed: 30 }
  const key = Object.hasOwn(ENCOUNTER_PRESETS, difficulty) ? difficulty : 'normal'
  const enemy = scaleEnemyToPlayer({ name: '模型参照敌人', battleRole: role }, stats, key, () => 0.5, [])
  return { stats, enemy, preset: ENCOUNTER_PRESETS[key] }
}

export function firstRingOptions() {
  const event = EVENTS.find(entry => entry.id === 'ring_hunt_10')
  return (event?.choices || []).map(choice => ({
    name: choice.text,
    year: choice.ringYear,
    difficulty: encounterDifficulty({ event, choice, ringOrdinal: 1 }),
    absorbChance: ringAbsorbChance(choice.ringYear),
    experience: Number(choice.result.exp) || 0,
    extra: choice.result.attack ? `攻击 +${choice.result.attack}` : choice.result.speed ? `速度 +${choice.result.speed}` : `恢复生命 ${choice.result.heal || 0}`
  }))
}

export function economySnapshot() {
  return {
    weeklyGold: DAILY_REWARDS.reduce((sum, row) => sum + (Number(row.reward.gold) || 0), 0),
    weeklyExp: DAILY_REWARDS.reduce((sum, row) => sum + (Number(row.reward.exp) || 0), 0),
    supplies: SHOP_ITEMS.filter(item => ['heal', 'healFull', 'mp'].includes(item.type)).map(item => ({ ...item, efficiency: item.type === 'healFull' ? null : item.value / item.price }))
  }
}

// 导出值来自同一套规则；计算表不读取、创建或修改玩家存档。
export function numericalDesignCsv() {
  const rows = [['系统', '条目', '指标', '数值', '单位', '口径']]
  for (const point of growthCurve()) {
    rows.push(['成长', `Lv.${point.level}→${point.level + 1}`, '升级经验', point.required, '经验', '当前公式，未计奖励加成'])
    rows.push(['成长', `Lv.${point.level}→${point.level + 1}`, '无减免参照经验', point.baseline, '经验', '40×等级^1.15，逐级四舍五入'])
  }
  for (const [key, preset] of Object.entries(ENCOUNTER_PRESETS)) {
    rows.push(['战斗', DIFFICULTY_NAMES[key], '目标回合参数', preset.rounds, '次出手', '设计参数，不是实战统计'])
    rows.push(['战斗', DIFFICULTY_NAMES[key], '生命损耗参数', preset.loss, '比例', '敌人生成参数，不是胜率'])
  }
  for (const option of firstRingOptions()) {
    rows.push(['第一魂环', option.name, '基础经验', option.experience, '经验', '未计加成、等级门槛与溢出结算'])
    rows.push(['第一魂环', option.name, '战胜后的吸收概率', option.absorbChance, '概率', '不含战斗胜率'])
  }
  for (const item of SHOP_ITEMS) rows.push(['商店', item.name, '售价', item.price, '金币', `解锁等级${item.reqLevel || 1}`])
  for (const day of DAILY_REWARDS) rows.push(['签到', `第${day.day}天`, '金币', day.reward.gold || 0, '金币', '配置奖励，不是玩家实际收入'])
  rows.push(['成长', '魂环门槛', '经验暂存上限系数', OVERFLOW_LEVEL_LIMIT, '级', '以上限等级的单级经验为基数'])
  return rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
}
