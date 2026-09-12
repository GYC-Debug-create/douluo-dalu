/**
 * 道具效果统一结算（单一来源，纯函数）
 *
 * 历史上战斗内 useItem 与非战斗 useInventoryItem 是同一套道具效果的两份实现，
 * 细节已漂移（战斗版满魂力仍消耗道具等）。这里把"数学与规则"收口为一处：
 *  - resolveConsumable(item, state, mode) 计算效果与拦截；
 *  - 两端调用方只负责把 effect 应用到各自的运行时（战斗状态/玩家存档）并组织文案。
 *
 * mode 语义差异（设计如此，非漂移）：
 *  - 'battle'    增益 → 即时战斗状态；净化类可用；结束后 combo 清零由调用方处理
 *  - 'inventory' 增益 → 存 _temp*Buff 下场战斗生效；净化类拒绝使用
 */

'use strict';

export const USABLE_ITEM_TYPES = ['heal', 'healFull', 'mp', 'buffAtk', 'buffDef', 'buffSpd', 'cure', 'cureAll']

const BUFF_STATUS = {
  buffAtk: { statusId: 'rage', label: '狂暴', tempField: '_tempAtkBuff', label2: '攻击增益' },
  buffDef: { statusId: 'shield', label: '护盾', tempField: '_tempDefBuff', label2: '防御增益' },
  buffSpd: { statusId: 'haste', label: '疾风', tempField: '_tempSpdBuff', label2: '速度增益' }
}

/**
 * @param {object} item 背包道具 { type, value, name }
 * @param {object} state { hp, maxHp, spiritPower, maxSpiritPower, statuses? }
 *   statuses 仅 battle 模式需要（净化类过滤当前状态列表）
 * @param {'battle'|'inventory'} mode
 * @returns {{ ok: true, effect: object, message: string } | { ok: false, reason: string, message: string }}
 */
export function resolveConsumable(item, state = {}, mode) {
  const value = Number(item?.value || 0)
  switch (item?.type) {
    case 'heal':
    case 'healFull': {
      const target = item.type === 'healFull'
        ? state.maxHp
        : Math.min(state.maxHp, (state.hp || 0) + value)
      const healed = target - (state.hp || 0)
      if (healed <= 0) {
        return { ok: false, reason: 'hp-full', message: mode === 'battle' ? '当前生命已满，无需恢复。' : '当前生命已满' }
      }
      return { ok: true, effect: { heal: healed }, message: `恢复 ${healed} 点生命` }
    }
    case 'mp': {
      const target = Math.min(state.maxSpiritPower, (state.spiritPower || 0) + value)
      const gained = target - (state.spiritPower || 0)
      // 统一守卫（修复漂移：旧战斗版满魂力仍消耗道具）：无可回复量不消耗
      if (gained <= 0) {
        return { ok: false, reason: 'mp-full', message: mode === 'battle' ? '当前魂力已满，无需恢复。' : '当前魂力已满' }
      }
      return { ok: true, effect: { mp: gained }, message: `恢复 ${gained} 点魂力` }
    }
    case 'buffAtk':
    case 'buffDef':
    case 'buffSpd': {
      const def = BUFF_STATUS[item.type]
      if (mode === 'battle') {
        return {
          ok: true,
          effect: { status: { id: def.statusId, turns: 3, power: value || 0.2 } },
          message: item.type === 'buffSpd' ? '获得 3 回合疾风，闪避率提升' : `获得 3 回合${def.label}`
        }
      }
      return {
        ok: true,
        effect: { tempField: def.tempField, value: value || 0.2 },
        message: `下场战斗获得3回合${def.label2}`
      }
    }
    case 'cure': {
      if (mode !== 'battle') {
        return { ok: false, reason: 'battle-only', message: '净化类道具只能在战斗中使用' }
      }
      const removeId = String(value || 'poison')
      const statuses = Array.isArray(state.statuses) ? state.statuses : []
      const filtered = statuses.filter(s => s.id !== removeId)
      if (filtered.length === statuses.length) {
        return { ok: false, reason: 'nothing-to-cure', message: '当前没有中毒，无需使用解毒丹。' }
      }
      return { ok: true, effect: { statuses: filtered }, message: '解除了中毒' }
    }
    case 'cureAll': {
      if (mode !== 'battle') {
        return { ok: false, reason: 'battle-only', message: '净化类道具只能在战斗中使用' }
      }
      const statuses = Array.isArray(state.statuses) ? state.statuses : []
      const harmful = new Set(['burn', 'poison', 'freeze', 'stun', 'weak', 'armorBreak'])
      const filtered = statuses.filter(s => !harmful.has(s.id))
      if (filtered.length === statuses.length) {
        return { ok: false, reason: 'nothing-to-cure', message: '当前没有负面状态，无需使用净化符。' }
      }
      return { ok: true, effect: { statuses: filtered }, message: '清除了所有负面状态' }
    }
    default:
      return {
        ok: false,
        reason: 'not-usable',
        message: mode === 'battle' ? `「${item?.name}」不能在战斗中使用。` : '该物品当前不能直接使用'
      }
  }
}
