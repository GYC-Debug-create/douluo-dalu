/**
 * 事件结算纯逻辑层（单一来源）
 *
 * 从 useEventEngine.js 下沉三块计算逻辑，全部不 import 任何 store：
 *  1. applyResultRewards —— 事件奖励结算：输入"可变草稿状态视图 + 奖励 result + 规则上下文"，
 *     就地修改草稿并返回结算摘要与待通知项；由调用方（composable）把草稿差异应用回 store。
 *     逐分支镜像拆分前的实现，保证数值/顺序/文案完全一致（快照测试护栏）。
 *  2. settleLevelProgress —— 经验→升级→回血/魂力回复→魂环位门槛的公共核心，
 *     composable 的 checkLevelUp 与奖励结算的 exp 分支共用，避免双实现漂移。
 *  3. buildRingReward —— 魂环与魂技对象的构造（含吸收年限/成功率查表）。
 *  4. pickEnding —— 结局判定。
 *
 * ctx 注入约定（让本层可在无 Pinia 环境下直测）：
 *  - getSpiritBonus(field)   武魂特质加成倍率（traits 数组由调用方绑定）
 *  - maxHpFor(level, bonus, spiritBase)   在指定等级/加成草稿下的最终最大生命
 *  - maxSpiritPowerFor(spiritPowerMax)    在指定魂力上限草稿下的最终魂力上限
 *  - expNeeded(level)        升级所需经验
 *  - titleGold / titlePowerGain / fateMul / expMul   结算期内的称号与 NPC 加成标量
 *  - pick(arr)               随机选取（注入以便测试固定种子）
 *  - spirits                 武魂全量数据（进化池）
 */

'use strict';

import { normalizeLegacyHealthResult, advanceExperience, calculateRingBacklash, RING_LEVELS } from './rules'
import { playerFacingBeastName } from '@/utils/ring-names'

/**
 * 经验结算公共核心（镜像原 useEventEngine.checkLevelUp 的计算部分）。
 * @param {object} state { level, exp, overflowExp, ringCount, hp, bonus, spiritBase, spiritPowerMax }
 * @param {object} ctx
 * @returns {{ previousLevel, level, exp, overflowExp, levels, capped, hp, spiritPower, pendingRingLv }}
 *   hp/spiritPower 仅在发生升级时返回新值（否则为 null，调用方不要写回）。
 */
export function settleLevelProgress(state, ctx) {
  const previousLevel = state.level
  const result = advanceExperience(
    { level: state.level, exp: 0, overflowExp: state.overflowExp, ringCount: state.ringCount },
    state.exp,
    ctx.expNeeded
  )
  let hp = null
  let spiritPower = null
  const levelsGained = result.levels?.length || 0
  if (levelsGained > 0) {
    // 与原实现一致：回血按"升级后"的最终属性计算（等级会影响基础属性系数）。
    const maxHp = ctx.maxHpFor(result.level, state.bonus, state.spiritBase)
    const healRatio = levelsGained >= 2 ? 1 : 0.5
    hp = Math.min(maxHp, state.hp + Math.max(0, Math.round((maxHp - state.hp) * healRatio)))
    spiritPower = ctx.maxSpiritPowerFor(state.spiritPowerMax)
  }
  const gateLevel = RING_LEVELS[state.ringCount]
  const pendingRingLv = state.ringCount < 9 && result.level >= gateLevel ? gateLevel : null
  return {
    previousLevel,
    level: result.level,
    exp: result.exp,
    overflowExp: result.overflowExp,
    levels: result.levels || [],
    capped: result.capped,
    hp,
    spiritPower,
    pendingRingLv
  }
}

/**
 * 事件奖励结算（镜像原 applyResultRewards，逐分支一致）。
 * @param {object} view 可变草稿：{ bonus:{attack,defense,hp,speed}, hp, spiritPower, spiritPowerMax,
 *   gold, fatePoints, inventory, level, exp, overflowExp, spirit, spiritBase, ringCount, totalGoldEarned }
 * @param {object} result 事件奖励字段
 * @param {object} ctx 见文件头约定
 * @returns {{ summary, levelUp, ringUnlock, evolved }}
 */
export function applyResultRewards(view, result, ctx) {
  const r = normalizeLegacyHealthResult(result || {})
  const gains = []
  const summary = {
    list: gains,
    exp: 0,
    gold: 0,
    fate: 0,
    items: [],
    levelBefore: view.level,
    levelAfter: view.level,
    levels: [],
    overflowExp: view.overflowExp || 0
  }
  let levelUp = null
  let ringUnlock = null
  let evolved = false

  const addPermanent = (field, label) => {
    const raw = Number(r[field]) || 0
    if (!raw) return
    const multiplier = raw > 0 ? ctx.getSpiritBonus(field) : 1
    const value = Math.round(raw * multiplier)
    view.bonus[field] = (Number(view.bonus?.[field]) || 0) + value
    gains.push(`${label}${value >= 0 ? '+' : ''}${value}${multiplier > 1 ? '（武魂共鸣）' : ''}`)
  }
  addPermanent('attack', '攻击')
  addPermanent('defense', '防御')
  addPermanent('speed', '速度')

  if (r.maxHp) {
    const multiplier = Number(r.maxHp) > 0 ? ctx.getSpiritBonus('maxHp') : 1
    const value = Math.max(0, Math.round((Number(r.maxHp) || 0) * multiplier))
    if (value > 0) {
      view.bonus.hp = (Number(view.bonus?.hp) || 0) + value
      view.hp = Math.min(view.hp + value, ctx.maxHpFor(view.level, view.bonus, view.spiritBase))
      gains.push(`最大生命+${value}${multiplier > 1 ? '（武魂共鸣）' : ''}`)
    }
  }

  if (typeof r.heal === 'number' && r.heal > 0) {
    const multiplier = ctx.getSpiritBonus('heal')
    const value = Math.round(r.heal * multiplier)
    const before = view.hp
    view.hp = Math.max(1, Math.min(ctx.maxHpFor(view.level, view.bonus, view.spiritBase), view.hp + value))
    gains.push(`生命恢复+${Math.max(0, view.hp - before)}${multiplier > 1 ? '（武魂共鸣）' : ''}`)
  }
  if (r.damage) {
    const value = Math.max(0, Math.round(Number(r.damage) || 0))
    if (value > 0) {
      view.hp = Math.max(1, view.hp - value)
      gains.push(`生命-${value}`)
    }
  }

  if (r.gold) {
    const raw = Math.round(Number(r.gold) || 0)
    const titleGold = raw > 0 ? Math.max(0, Number(ctx.titleGold) || 0) : 0
    const multiplier = raw > 0 ? ctx.getSpiritBonus('gold') : 1
    const requested = raw > 0 ? Math.round(raw * multiplier * (1 + titleGold)) : raw
    const before = view.gold
    view.gold = Math.max(0, view.gold + requested)
    const actual = view.gold - before
    if (actual > 0) view.totalGoldEarned = (Number(view.totalGoldEarned) || 0) + actual
    summary.gold += actual
    gains.push(`金币${actual >= 0 ? '+' : ''}${actual}`)
  }

  if (r.spiritPowerGain) {
    const raw = Number(r.spiritPowerGain) || 0
    const titlePower = raw > 0 ? Math.max(0, Number(ctx.titlePowerGain) || 0) : 0
    const multiplier = raw > 0 ? ctx.getSpiritBonus('spiritPowerGain') : 1
    const value = Math.round(raw * multiplier + titlePower)
    if (value > 0) {
      const gain = value * 2
      view.spiritPowerMax = (Number(view.spiritPowerMax) || 0) + gain
      view.spiritPower = Math.min(ctx.maxSpiritPowerFor(view.spiritPowerMax), view.spiritPower + gain)
      gains.push(`魂力上限+${gain}`)
    } else if (value < 0) {
      const loss = Math.abs(value * 2)
      view.spiritPower = Math.max(0, view.spiritPower - loss)
      gains.push(`魂力-${loss}`)
    }
  }
  if (r.mp) {
    const value = Number(r.mp) || 0
    const before = view.spiritPower
    view.spiritPower = Math.max(0, Math.min(ctx.maxSpiritPowerFor(view.spiritPowerMax), view.spiritPower + value))
    const actual = view.spiritPower - before
    gains.push(`魂力${actual >= 0 ? '+' : ''}${actual}`)
  }

  if (r.fate) {
    const raw = Number(r.fate) || 0
    const npcMultiplier = raw > 0 ? (Number(ctx.fateMul) || 1) : 1
    const multiplier = raw > 0 ? ctx.getSpiritBonus('fate') * npcMultiplier : 1
    const value = Math.round(raw * multiplier)
    view.fatePoints = (Number(view.fatePoints) || 0) + value
    summary.fate += value
    gains.push(`命运值${value >= 0 ? '+' : ''}${value}`)
  }

  const recordItemChange = item => {
    if (!item?.name) return
    const count = Number.isFinite(Number(item.count)) && Number(item.count) !== 0 ? Number(item.count) : 1
    const existing = view.inventory.find(entry => entry.name === item.name && entry.value === item.value)
    if (count < 0) {
      const consumed = Math.min(existing ? Math.max(0, Number(existing.count) || 0) : 0, Math.abs(count))
      if (existing) existing.count -= consumed
      view.inventory = view.inventory.filter(entry => Number(entry.count) > 0)
      gains.push(consumed > 0 ? `消耗「${item.name}」×${consumed}` : `未消耗「${item.name}」（库存不足）`)
      summary.items.push({ name: item.name, count: -consumed })
      return
    }
    if (existing) existing.count = (Number(existing.count) || 0) + count
    else view.inventory.push({ ...item, type: item.type || 'special', count })
    if (item.effect && typeof item.effect === 'object') {
      for (const field of ['attack', 'defense', 'hp', 'speed']) {
        if (item.effect[field]) view.bonus[field] = (Number(view.bonus?.[field]) || 0) + Number(item.effect[field]) * count
      }
      if (item.effect.spiritPowerGain) {
        const gain = Number(item.effect.spiritPowerGain) * count
        view.spiritPowerMax += gain
        view.spiritPower = Math.min(ctx.maxSpiritPowerFor(view.spiritPowerMax), view.spiritPower + gain)
      }
      if (item.effect.fate) view.fatePoints += Number(item.effect.fate) * count
    }
    gains.push(`获得「${item.name}」×${count}`)
    summary.items.push({ name: item.name, count })
  }
  recordItemChange(r.item)
  recordItemChange(r.item2)

  if (r.heal === true || r.healFull) {
    view.hp = ctx.maxHpFor(view.level, view.bonus, view.spiritBase)
    view.spiritPower = ctx.maxSpiritPowerFor(view.spiritPowerMax)
    gains.push('完全恢复')
  }

  if (r.evolve) {
    const order = ['low', 'mid', 'high', 'top', 'god']
    const currentIndex = order.indexOf(view.spirit?.tier)
    const nextTier = currentIndex >= 0 ? order[currentIndex + 1] : null
    const pool = nextTier ? (ctx.spirits || []).filter(spirit => spirit.tier === nextTier) : []
    const evolvedSpirit = pool.length ? ctx.pick(pool) : null
    if (evolvedSpirit) {
      view.spirit = {
        id: evolvedSpirit.id,
        eventKey: evolvedSpirit.eventKey,
        name: evolvedSpirit.name,
        tier: evolvedSpirit.tier,
        type: evolvedSpirit.type,
        subtype: evolvedSpirit.subtype,
        image: evolvedSpirit.image,
        desc: evolvedSpirit.desc,
        icon: evolvedSpirit.icon
      }
      view.spiritBase = {
        attack: evolvedSpirit.attack,
        defense: evolvedSpirit.defense,
        hp: evolvedSpirit.hp,
        speed: evolvedSpirit.speed
      }
      evolved = true
      gains.push(`✦ 武魂进化为「${evolvedSpirit.name}」！`)
    }
  }

  if (r.exp) {
    const raw = Number(r.exp) || 0
    if (raw > 0) {
      const value = Math.max(1, Math.round(raw * ctx.getSpiritBonus('exp') * (Number(ctx.expMul) || 1)))
      if (view.level >= 100) {
        const before = view.gold
        view.gold = Math.max(0, view.gold + value)
        const actual = view.gold - before
        if (actual > 0) view.totalGoldEarned = (Number(view.totalGoldEarned) || 0) + actual
        summary.gold += actual
        gains.push(`满级经验转化为金币+${value}`)
      } else {
        view.exp = Math.max(0, view.exp + value)
        const outcome = settleLevelProgress({
          level: view.level,
          exp: view.exp,
          overflowExp: view.overflowExp,
          ringCount: view.ringCount,
          hp: view.hp,
          bonus: view.bonus,
          spiritBase: view.spiritBase,
          spiritPowerMax: view.spiritPowerMax
        }, ctx)
        view.level = outcome.level
        view.exp = outcome.exp
        view.overflowExp = outcome.overflowExp
        if (outcome.hp !== null) view.hp = outcome.hp
        if (outcome.spiritPower !== null) view.spiritPower = outcome.spiritPower
        summary.exp += value
        summary.levelAfter = outcome.level
        summary.levels = outcome.levels || []
        summary.overflowExp = outcome.overflowExp || 0
        if (outcome.levels.length > 0) levelUp = { level: outcome.level, levels: outcome.levels }
        // 原实现里 checkLevelUp 每次都会重算魂环位门槛；exp 分支同样生效。
        ringUnlock = { pendingRingLv: outcome.pendingRingLv, previousLevel: outcome.previousLevel }
        gains.push(`经验+${value}${summary.levels.length ? `（Lv.${summary.levels.join(' → ')}）` : ''}`)
      }
    }
  }

  return { summary, levelUp, ringUnlock, evolved }
}

// 魂环年限查表：选项显式标注 ringYear 优先，否则按魂环定义 id 推断。
export function ringYearValueFor(choice, definitionId) {
  return Number(choice?.ringYear) > 0
    ? Number(choice.ringYear)
    : ({ white_ring: 10, yellow_ring: 100, purple_ring: 1000, black_ring: 10000, red_ring: 100000, million_gold_ring: 1000000 })[definitionId] || 0
}

// T9 判例5：年限越高反噬风险越大（失败=受伤+事件不完成，可休整后重猎）。
export function ringAbsorbChance(yearValue) {
  return ({ 10: 1, 100: 0.85, 1000: 0.7, 10000: 0.55, 100000: 0.35, 1000000: 0.2 })[yearValue] ?? 1
}

/**
 * 构造魂环与对应魂技对象（镜像原 grantRingForEvent 的对象装配）。
 * @param {object} input { definition, ordinal, ringCountBefore, playerLevel, choice, source }
 */
export function buildRingReward({ definition, ordinal, ringCountBefore, playerLevel, choice, source }) {
  const skillName = `${source.replace(/^(十年|百年|千年|万年|十万年)/, '')}魂技`
  const skillDef = {
    damage: Math.round(20 + playerLevel * 2.2 + (Number(definition.statBonus?.attack) || 0) * 0.8),
    cost: 15 + ringCountBefore * 5,
    cooldown: 3
  }
  const ring = {
    ringId: definition.id,
    skillId: `ring:${definition.id}:${ordinal}`,
    name: definition.name,
    tier: definition.tier,
    yearLabel: definition.name,
    color: definition.color || '#c9a84c',
    year: Number(choice?.ringYear) > 0 ? Math.round(Number(choice.ringYear)) : null,
    skill: skillName,
    skillType: '攻击',
    skillDesc: `凝聚第${ordinal}魂环之力发动攻击。`,
    skillAnim: 'burst',
    beastId: choice?.beastId || playerFacingBeastName(choice?.result?.battle, '') || null,
    source,
    bonus: {
      attack: Number(definition.statBonus?.attack) || 0,
      defense: Number(definition.statBonus?.defense) || 0,
      hp: Number(definition.statBonus?.hp) || 0
    },
    skillDef
  }
  const skill = {
    skillId: ring.skillId,
    name: ring.skill,
    type: ring.skillType,
    desc: ring.skillDesc,
    anim: ring.skillAnim,
    damage: skillDef.damage,
    cost: skillDef.cost,
    cooldown: skillDef.cooldown,
    ring: ordinal,
    source: ring.source,
    beastId: ring.beastId
  }
  return { ring, skill }
}

// 反噬结算（T9 判例5 的伤害计算部分，保留在纯层便于直测）。
export function settleRingBacklash(maxHp, currentHp, absorbChance) {
  return calculateRingBacklash(maxHp, currentHp, Math.round((1 - absorbChance) * 100))
}

/**
 * 结局判定（镜像原 chooseEnding）：特殊结局按 req(G) 判定，普通结局按命运值从高到低。
 * @param {Array} ENDINGS
 * @param {number} fatePoints
 * @param {object} G 供 req(G) 读取的运行时快照
 */
export function pickEnding(ENDINGS, fatePoints, G) {
  const special = ENDINGS.find(ending => {
    if (!ending.req || fatePoints < ending.minFate) return false
    try { return Boolean(ending.req(G)) } catch { return false }
  })
  if (special) return special
  const regular = ENDINGS
    .filter(ending => !ending.req)
    .slice()
    .sort((a, b) => b.minFate - a.minFate)
  return regular.find(ending => fatePoints >= ending.minFate) || ENDINGS[ENDINGS.length - 1]
}
