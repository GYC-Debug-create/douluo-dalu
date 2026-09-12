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

/**
 * 由事件层构造战斗请求单。
 * @param {object} input { event, result, finalBoss }
 *   event      触发战斗的事件对象（仅用于提取展示/统计元数据，战斗不做语义解释）
 *   result     事件的 result（含 battle 敌人引用与胜利后应收到的奖励字段）
 *   finalBoss  最终决战标记：禁用逃跑（由事件层判定，战斗不再识别事件 id）
 */
export function createEventBattleRequest({ event = null, result = {}, finalBoss = false }) {
  return {
    // 敌人引用（key 或预构建敌人对象），由战斗系统 buildEnemy 解析
    enemyRef: result.battle,
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
