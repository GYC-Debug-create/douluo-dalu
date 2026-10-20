/**
 * 战斗 ↔ 事件结算契约（单一来源）
 *
 * 战斗系统只认本契约：它不知道"事件/魂环/主线"是什么，只接收一张战斗请求单
 * （createEventBattleRequest 的产物），并发布标准化的战斗结果。
 * 事件层（useEventFlow.applyChoice）持有事件语义，负责把结果翻译回剧情：
 *   - victory → 事件完成 + 完整奖励结算（engine/settlement.js）
 *   - defeat/escape → 按事件语义挂起猎环目标或主线里程碑
 *
 * 战斗结果契约：onEnd 回调收到的对象固定为
 *   { type: 'victory'|'defeat'|'escape', text, gains: string[], exp, gold, enemy, rounds }
 * 其中 enemy/rounds 为标准化读取字段，事件层不得依赖战斗内部状态。
 */

'use strict';

// 每个魂环序号的"常规年限"。选项年限高于常规就是越级挑战（hard）。
const EXPECTED_RING_YEAR = Object.freeze([10, 100, 1000, 1000, 10000, 10000, 10000, 10000, 100000])
const TIER_YEARS = Object.freeze({ ten: 10, hundred: 100, thousand: 1000, ten_thousand: 10000, choice: 100000, hundred_thousand: 100000 })

/**
 * 根据事件与选项判断这场战斗的难度档位（纯函数）。
 *  - 最终决战：boss
 *  - 猎环：选的年限高于本环常规年限、或选项带额外门槛 → hard；否则 normal
 *  - 主线：normal
 *  - 其它普通事件与旅途遭遇：easy
 */
export function encounterDifficulty({ event = null, choice = null, ringOrdinal = 1 } = {}) {
  // 剧情可以为某个选择单独指定难度（例如主线大分叉里拼尽全力的一战）。
  if (['easy', 'normal', 'hard', 'boss'].includes(choice?.result?.difficulty)) return choice.result.difficulty
  if (event?.id === 'final_evil') return 'boss'
  if (event?.ring) {
    const expected = EXPECTED_RING_YEAR[Math.max(0, Math.min(8, (Number(ringOrdinal) || 1) - 1))]
    const year = Number(choice?.ringYear) || TIER_YEARS[choice?.ringTier] || TIER_YEARS[event.ring] || expected
    if (year > expected || choice?.cond) return 'hard'
    return 'normal'
  }
  if (event?._mainStory || event?.mainStoryOnly) return 'normal'
  return 'easy'
}

/**
 * 由事件层构造战斗请求单。
 * @param {object} input { event, result, finalBoss }
 *   event      触发战斗的事件对象（仅用于提取展示/统计元数据，战斗不做语义解释）
 *   result     事件的 result（含 battle 敌人引用与胜利后应收到的奖励字段）
 *   finalBoss  最终决战标记：禁用逃跑（由事件层判定，战斗不再识别事件 id）
 */
export function createEventBattleRequest({ event = null, result = {}, finalBoss = false, difficulty = 'easy' }) {
  return {
    // 敌人引用（key 或预构建敌人对象），由战斗系统 buildEnemy 解析
    enemyRef: result.battle,
    // 遭遇难度（engine/battle-core.js ENCOUNTER_PRESETS），决定敌人按玩家强度换算的力度
    difficulty: finalBoss ? 'boss' : difficulty,
    // 胜利后应由事件层结算的完整奖励字段（deferResult 契约：战斗不代发奖励）
    rewardResult: result,
    finalBoss,
    allowFlee: !finalBoss,
    // 猎魂历练统计与战败/逃跑文案所需的最小元数据
    huntingMeta: {
      ringHunt: Boolean(event?.ring),
      eventName: event?.name || ''
    }
  }
}
