/**
 * 成长结算编排层
 *
 * 从 useEventEngine.js 拆出"改变玩家成长状态"的全部动作：
 * 奖励结算 / 升级 / 魂环获取 / 猎环目标的挂起与恢复 / 冒险日记。
 * 计算部分委托 engine/settlement.js 纯层，这里只做 store 应用与 UI 通知。
 */
import { getSpiritBonus as getTraitSpiritBonus } from '@/engine/traits'
import { RING_LEVELS, phaseForLevel, rankTitleForLevel } from '@/engine/rules'
import {
  applyResultRewards as settleRewards,
  settleLevelProgress,
  ringYearValueFor,
  ringAbsorbChance,
  buildRingReward,
  settleRingBacklash
} from '@/engine/settlement'
import { appendDiaryEntry } from '@/engine/save'
import { ringSourceForChoice } from '@/utils/ring-names'
import { buildRingHuntMeta, ringDefinitionIdForChoice, ringDestination } from '@/utils/ring-hunt'
import { pick as pickRandom } from '@/engine/event-draw'

/**
 * @param {object} deps {
 *   player, eventStore, gameStore, ui, data, EVENTS, finalStats, getMaxSpiritPower, expNeeded,
 *   battleGuard: () => boolean,
 *   scene: { showEvent, showContinue, showTravelGuide, saveGame, currentEvent },
 *   hooks: { recordEventDiscoveries(ev) }   // 迟绑定：事件引擎的发现记录
 * }
 */
export function useGrowthSettlement(deps) {
  const {
    player, eventStore, gameStore, ui, data, EVENTS,
    finalStats, getMaxSpiritPower, expNeeded,
    battleGuard, scene, hooks
  } = deps

  // ==================== 结算上下文（注入 settlement 纯层） ====================

  const rulesCtx = {
    expNeeded,
    getSpiritBonus: field => getTraitSpiritBonus(player._personality?.traits || [], field),
    maxHpFor: (level, bonus, spiritBase) => finalStats({ level, bonus, spiritBase }).maxHp,
    maxSpiritPowerFor: spiritPowerMax => getMaxSpiritPower({ spiritPowerMax }),
    // 以下标量在结算期内不会变化，用 getter 惰性求值保持与"现场读 finalStats"一致。
    get titleGold() { return finalStats().titleBonus?.gold },
    get titlePowerGain() { return finalStats().titleBonus?.spiritPowerGain },
    get fateMul() { return finalStats().npcBonus?.fateMul || 1 },
    get expMul() { return finalStats().npcBonus?.expMul || 1 },
    pick: pickRandom,
    get spirits() { return data.value.spirits }
  }

  // ==================== 奖励结算 ====================

  function applyResultRewards(result) {
    // 草稿视图：先在纯层结算，再整体应用回 store（行为与拆分前的就地修改一致）。
    const view = {
      bonus: { ...(player.bonus || {}) },
      hp: player.hp,
      spiritPower: player.spiritPower,
      spiritPowerMax: player.spiritPowerMax,
      gold: player.gold,
      fatePoints: player.fatePoints,
      inventory: (player.inventory || []).map(item => ({ ...item })),
      level: player.level,
      exp: player.exp,
      overflowExp: player.overflowExp,
      spirit: player.spirit,
      spiritBase: player.spiritBase,
      ringCount: player.rings?.length || 0,
      totalGoldEarned: gameStore._totalGoldEarned
    }
    const { summary, levelUp, ringUnlock, evolved } = settleRewards(view, result, rulesCtx)

    player.bonus = view.bonus
    player.hp = view.hp
    player.spiritPower = view.spiritPower
    player.spiritPowerMax = view.spiritPowerMax
    player.gold = view.gold
    player.fatePoints = view.fatePoints
    player.inventory = view.inventory
    player.level = view.level
    player.exp = view.exp
    player.overflowExp = view.overflowExp
    if (evolved) {
      player.spirit = view.spirit
      player.spiritBase = view.spiritBase
      eventStore._dynamicFlags._evolved = true
    }
    gameStore._totalGoldEarned = view.totalGoldEarned

    // 通知顺序与拆分前一致：升级 →（写魂环位门槛）→ 魂环位解锁
    if (levelUp) ui.notify(`等级提升至 Lv.${levelUp.level}！`, 'success', 4000)
    if (ringUnlock) eventStore.pendingRingLv = ringUnlock.pendingRingLv
    if (ringUnlock && ringUnlock.pendingRingLv && ringUnlock.previousLevel < ringUnlock.pendingRingLv) {
      ui.notify(`魂环位已解锁！可以猎杀第${(player.rings?.length || 0) + 1}魂环`, 'gold', 5000)
    }
    return summary
  }

  function checkLevelUp() {
    const outcome = settleLevelProgress({
      level: player.level,
      exp: player.exp,
      overflowExp: player.overflowExp,
      ringCount: player.rings?.length || 0,
      hp: player.hp,
      bonus: player.bonus,
      spiritBase: player.spiritBase,
      spiritPowerMax: player.spiritPowerMax
    }, rulesCtx)
    player.level = outcome.level
    player.exp = outcome.exp
    player.overflowExp = outcome.overflowExp
    if (outcome.levels.length > 0) {
      player.hp = outcome.hp
      player.spiritPower = outcome.spiritPower
      ui.notify(`等级提升至 Lv.${player.level}！`, 'success', 4000)
    }
    eventStore.pendingRingLv = outcome.pendingRingLv
    if (outcome.pendingRingLv && outcome.previousLevel < outcome.pendingRingLv) {
      ui.notify(`魂环位已解锁！可以猎杀第${(player.rings?.length || 0) + 1}魂环`, 'gold', 5000)
    }
    return { level: outcome.level, exp: outcome.exp, overflowExp: outcome.overflowExp, levels: outcome.levels, capped: outcome.capped }
  }

  function grantRingForEvent(ev, choice, choiceIndex) {
    if (!ev?.ring || player.rings.length >= 9) return null
    const ringId = ringDefinitionIdForChoice(ev, choice, choiceIndex)
    if (!ringId) return null
    const definition = data.value.rings.find(item => item.id === ringId)
    if (!definition) {
      ui.notify('魂环数据未加载，无法完成吸收', 'error', 5000)
      return null
    }

    // T9 判例5：吸收反噬判定——年限越高反噬风险越大，失败=受伤+事件不完成。
    const yearValue = ringYearValueFor(choice, definition.id)
    const absorbChance = ringAbsorbChance(yearValue)
    if (yearValue > 0 && absorbChance < 1 && Math.random() > absorbChance) {
      const backlash = settleRingBacklash(finalStats().maxHp, player.hp, absorbChance)
      player.setHp(backlash.remainingHp)
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
      ui.notify(`魂环吸收失败！反噬造成 ${backlash.damage} 点伤害，需休整后再猎`, 'error', 5000)
      addDiaryEntry(`猎取第${player.rings.length + 1}魂环失败——吸收反噬，损失${backlash.damage}生命。`, 'event')
      return null
    }

    const source = ringSourceForChoice(choice, definition.name)
    const ordinal = player.rings.length + 1
    const ringMeta = buildRingHuntMeta({
      pendingRingLv: eventStore._ringHuntLevel || eventStore.pendingRingLv || ev.minLevel,
      ringLevel: ev._ringHuntLevel || eventStore._ringHuntLevel || eventStore.pendingRingLv || ev.minLevel,
      ringCount: ordinal - 1,
      targetId: ev._ringTargetId || eventStore._ringTargetId || '',
      targetName: ev._ringTargetName || eventStore._ringTargetName || ''
    })
    const { ring, skill } = buildRingReward({
      definition,
      ordinal,
      ringCountBefore: player.rings.length,
      playerLevel: player.level,
      choice,
      source
    })
    player.rings.push(ring)
    player.skills.push(skill)
    eventStore.markEventDone(ev.id)
    hooks.recordEventDiscoveries(ev)
    eventStore._lastRingHuntLevel = ringMeta.ringLevel
    eventStore._lastRingOrdinal = ringMeta.ringOrdinal
    eventStore._lastRingTargetId = ringMeta.ringTargetId
    eventStore._lastRingTargetName = ringMeta.ringTargetName
    eventStore.pendingRingLv = null
    eventStore._ringHuntDeferredUntil = 0
    eventStore._ringHuntLevel = null
    eventStore._ringOrdinal = null
    eventStore._ringTargetId = null
    eventStore._ringTargetName = ''
    // 新魂环会抬高等级上限，立刻释放此前因魂环门槛暂存的经验。
    checkLevelUp()
    addDiaryEntry(`获得第${ordinal}魂环「${ring.name}」，习得魂技「${ring.skill}」。`, 'discovery')
    ui.notify(`成功获得第${ordinal}魂环：${ring.name}`, 'gold', 5000)
    return ring
  }

  // ==================== 猎环动作 ====================

  function hunt() {
    // 检查是否有待猎杀的魂环
    if (eventStore.pendingRingLv) {
      const ringEventId = 'ring_hunt_' + eventStore.pendingRingLv
      const ev = EVENTS.find(e => e.id === ringEventId)
      if (ev) {
        const targetId = ringDestination(eventStore.pendingRingLv)?.id
        if (targetId && gameStore._currentLocation !== targetId) {
          scene.showTravelGuide('ring', ev.name, targetId)
          return
        }
        scene.showEvent(ev, { isRingHunt: true })
        return
      }
    }

    // 没有待猎杀的魂环,提示
    const ringCount = player.rings?.length || 0
    if (ringCount >= 9) {
      ui.notify('你已拥有全部九个魂环', 'info')
      return
    }
    const nextRingLevel = RING_LEVELS[ringCount]
    if (player.level < nextRingLevel) {
      ui.notify(`需要 Lv.${nextRingLevel} 才能猎杀第${ringCount + 1}魂环`, 'info')
      return
    }
    ui.notify('暂无可猎杀的魂兽', 'info')
  }

  function resumeRingHunt() {
    if (!eventStore.pendingRingLv) {
      ui.notify('当前没有待完成的猎环目标', 'info')
      return
    }
    if (battleGuard()) {
      ui.notify('请先完成当前战斗，再继续猎环目标', 'info')
      return
    }
    eventStore._ringHuntDeferredUntil = 0
    scene.saveGame()
    hunt()
  }

  function deferRingHunt() {
    if (!eventStore.pendingRingLv) return
    if (battleGuard()) {
      ui.notify('战斗中不能挂起猎环目标', 'info')
      return
    }
    const wasRingFlow = Boolean(scene.currentEvent.value?._ringHunt || scene.currentEvent.value?._travelGuideType === 'ring')
    eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 3
    scene.saveGame()
    ui.notify('猎环目标已挂在侧边，完成三次行动后会再次主动提醒', 'info', 5000)
    if (wasRingFlow) {
      scene.showContinue(
        { id: 'ring_hunt_deferred', name: '猎环目标已挂起' },
        '目标仍固定在左侧，不会丢失。你可以先完成其他历练，或随时点击“立即继续”返回猎环路线。'
      )
    }
  }

  // ==================== 世界推进与日记 ====================

  function completeWorldAction() {
    eventStore._eventCount = (eventStore._eventCount || 0) + 1
    gameStore.advanceTime()

    // 减少动态事件冷却
    if (eventStore._dynCooldowns) {
      for (const id in eventStore._dynCooldowns) {
        if (eventStore._dynCooldowns[id] > 0) {
          eventStore._dynCooldowns[id]--
        }
      }
    }
  }

  function addDiaryEntry(text, type) {
    const phase = phaseForLevel(player.level)
    const phaseName = { academy: '初级学院', adventure: '进阶学院', master: '历练期', god: '封神期' }[phase] || '初级学院'
    if (!Array.isArray(eventStore._diary)) eventStore._diary = []
    appendDiaryEntry(eventStore._diary, {
      turn: eventStore._eventCount || 0,
      level: player.level,
      phase: `${phaseName} · ${rankTitleForLevel(player.level)}`,
      text: text,
      type: type || 'event',
      time: Date.now()
    })
  }

  return {
    applyResultRewards,
    checkLevelUp,
    grantRingForEvent,
    hunt,
    resumeRingHunt,
    deferRingHunt,
    completeWorldAction,
    addDiaryEntry
  }
}
