/**
 * 武魂特质系统（单一来源，纯逻辑层）
 *
 * SPIRIT_TRAITS / TRAIT_BONUS / 人格推导曾在 useEventEngine.js、stores/serializer.js、
 * public/game.js 三处手抄，历史上已发生过漏同步。这里收敛为唯一实现：
 * 全部为纯函数，不 import 任何 store；需要玩家状态的调用方自行传入 traits 数组。
 * 旧轨 public/game.js 的同名表由阶段三的 sync-legacy-data 构建脚本对齐。
 */

'use strict';

// 武魂特质映射：subtype → 特质数组
export const SPIRIT_TRAITS = {
  '生活器物': ['实用', '生存', '灵巧'],
  '武器': ['战斗', '锋利', '刚猛'],
  '强攻系': ['力量', '破坏', '狂暴'],
  '防御系': ['坚韧', '守护', '沉稳'],
  '敏攻系': ['敏捷', '隐匿', '灵动'],
  '控制系': ['精神', '束缚', '智慧'],
  '辅助系': ['治愈', '祝福', '奉献'],
  '植物系': ['生长', '自然', '生命'],
  '神器': ['神圣', '审判', '威严'],
  '神兽': ['远古', '威严', '不朽'],
  '特殊': ['神秘', '命运', '独特']
}

// 武魂特质 → 事件奖励加成
// 狂暴只影响攻击，不再反转生命恢复；旧存档/旧事件的 hp 仍按当前生命变化处理。
export const TRAIT_BONUS = {
  '战斗': { exp: 1.3, attack: 1.5 },
  '力量': { attack: 1.5, exp: 1.2 },
  '破坏': { attack: 2, exp: 1.2 },
  '狂暴': { attack: 1.5 },
  '坚韧': { defense: 1.5, maxHp: 1.3 },
  '守护': { defense: 1.5, fate: 1 },
  '沉稳': { defense: 1.5, exp: 1.1 },
  '敏捷': { speed: 1.5, exp: 1.2 },
  '隐匿': { speed: 1.5, gold: 1.2 },
  '灵动': { speed: 1.5, fate: 1 },
  '精神': { spiritPowerGain: 1.5, exp: 1.2 },
  '智慧': { exp: 1.5, spiritPowerGain: 1.2 },
  '束缚': { defense: 1.2, attack: 1.2 },
  '治愈': { heal: 1.5, maxHp: 1.1, fate: 1 },
  '祝福': { fate: 1.5, heal: 1.2 },
  '奉献': { fate: 1.5, gold: 1.3 },
  '生长': { maxHp: 1.3, defense: 1.2 },
  '自然': { heal: 1.3, spiritPowerGain: 1.2 },
  '生命': { maxHp: 1.2, heal: 1.5, fate: 1 },
  '神圣': { fate: 1.5, attack: 1.3 },
  '审判': { attack: 1.5, fate: 1 },
  '威严': { exp: 1.3, attack: 1.2 },
  '远古': { exp: 1.3, defense: 1.2 },
  '不朽': { maxHp: 1.5, defense: 1.3 },
  '实用': { gold: 1.5, exp: 1.1 },
  '生存': { maxHp: 1.3, defense: 1.2 },
  '灵巧': { speed: 1.3, gold: 1.2 },
  '锋利': { attack: 1.5, speed: 1.1 },
  '刚猛': { attack: 1.3, defense: 1.1 },
  '神秘': { fate: 1.5, exp: 1.3 },
  '命运': { fate: 2, exp: 1.2 },
  '独特': { exp: 1.3, fate: 1 }
}

/**
 * 由武魂推导人格（特质 + 亚型），供角色创建与存档迁移共用。
 * @param {{subtype?: string, type?: string, tier?: string}} spirit
 */
export function getSpiritPersonality(spirit) {
  const sp = spirit || {}
  const traits = SPIRIT_TRAITS[sp.subtype] || SPIRIT_TRAITS[sp.type === '器武魂' ? '武器' : '强攻系'] || ['独特']
  const extra = []
  if (sp.tier === 'god') extra.push('神圣')
  if (sp.tier === 'top') extra.push('威严')
  return { traits: [...traits, ...extra], subtype: sp.subtype || sp.type }
}

/**
 * 单个特质对某字段的加成倍率；无匹配时恒为 1。
 * @param {string} trait
 * @param {string} field
 */
export function getTraitMultiplier(trait, field) {
  const bonus = TRAIT_BONUS[trait]
  if (!bonus) return 1
  return bonus[field] || 1
}

/**
 * 按玩家当前特质数组计算某字段的整体加成倍率（连乘，封顶 2.5）。
 * 不读任何全局状态：personality 缺失/traits 为空时恒为 1，与旧实现一致。
 * @param {string[]} traits
 * @param {string} field
 */
export function getSpiritBonus(traits, field) {
  let mult = 1
  for (const t of Array.isArray(traits) ? traits : []) {
    const value = getTraitMultiplier(t, field)
    mult *= Number.isFinite(value) && value > 0 ? value : 1
  }
  return Math.min(mult, 2.5)
}
