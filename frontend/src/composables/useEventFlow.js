/**
 * 事件流编排层
 *
 * 从 useEventEngine.js 拆出"剧情如何推进"：
 * nextEvent 决策链 / 选项结算 / 继续前行 / 战斗收尾 / 旅行遭遇 / 事件完成记录。
 * 纯逻辑在 engine/*，场景呈现由 useEventScene 提供，本层只串联。
 */
import { computed } from 'vue'
import { normalizeLegacyHealthResult, classifyEventLocation } from '@/engine/rules'
import { createEventBattleRequest } from '@/engine/battle-contract'
import { adaptEvent, isEventEligible, nextMainStoryMilestone as nextMainStoryMilestonePure } from '@/engine/event-rules'
import { buildPrologueEvent, buildEarlyLifeEvents } from '@/data/story-intro'
import { buildTravelArrivalSummary } from '@/utils/travel-arrival'
import { TRAVEL_ENCOUNTERS, pickTravelEncounter, buildTravelEncounterEvent } from '@/utils/travel-encounters'
import { buildRingCompletionMessage, buildRingHuntMeta, ringDestination } from '@/utils/ring-hunt'
import { isLocationExplorationEvent, isLocationExplorationInProgress } from '@/utils/location-exploration'

/**
 * @param {object} deps {
 *   player, eventStore, gameStore, ui, data, EVENTS,
 *   battleSystem, levelCapForRings,
 *   scene, candidates, growth, exploration,
 *   currentMapLocation, locationName, locationCodex, saveGame
 * }
 */
export function useEventFlow(deps) {
  const {
    player, eventStore, gameStore, ui, data, EVENTS,
    battleSystem, levelCapForRings,
    scene, candidates, growth, exploration,
    currentMapLocation, locationName, locationCodex, saveGame
  } = deps

  const canHunt = computed(() => {
    const cap = levelCapForRings(player.rings?.length || 0)
    return player.level >= cap && player.rings?.length < 9
  })

  // ==================== 主线里程碑 ====================

  function nextMainStoryMilestone() {
    return nextMainStoryMilestonePure({
      mainStoryVersion: eventStore._mainStoryVersion,
      doneEvents: eventStore.doneEvents
    })
  }

  // ==================== 核心: nextEvent ====================

  function nextEvent() {
    if (battleSystem.isActive()) return
    if (player.finished) {
      scene.showEnding()
      return
    }

    // 满级且完成最终决战后进入结局；最终决战本身不能被等级条件绕过。
    if (player.level >= 100 && eventStore.doneEvents.includes('final_evil')) {
      scene.showEnding()
      return
    }

    // 当前地点有未完成队列时恢复地点行动界面；其它地点的暂停队列不影响当前地点。
    if (isLocationExplorationInProgress(exploration.explorationState())) {
      exploration.showLocationAction()
      return
    }

    // 0. 新角色序章与早年经历。旧存档迁移后已完成的节点不会重播。
    if (!eventStore._prologueDone) {
      scene.showEvent(buildPrologueEvent(player))
      return
    }
    if (!eventStore._earlyLifeDone) {
      const intro = buildEarlyLifeEvents(player).find(item => !eventStore.doneEvents.includes(item.id))
      if (intro) {
        scene.showEvent(intro)
        return
      }
      eventStore._earlyLifeDone = true
      if (eventStore._enrollmentComplete && !eventStore._firstClassDone) {
        eventStore._introPendingEvent = 'first_class'
      }
      saveGame()
    }

    // 1. 第一堂课
    if (eventStore._enrollmentComplete && !eventStore._firstClassDone) {
      const firstClass = EVENTS.find(e => e.id === 'first_class')
      if (firstClass) {
        scene.showEvent(firstClass)
        return
      }
    }

    // 2. 魂环猎杀
    if (eventStore.pendingRingLv && (eventStore._ringHuntDeferredUntil || 0) <= (eventStore._eventCount || 0)) {
      const ringEventId = 'ring_hunt_' + eventStore.pendingRingLv
      const ev = EVENTS.find(e => e.id === ringEventId)
      if (ev) {
        const targetId = ringDestination(eventStore.pendingRingLv)?.id
        if (targetId && gameStore._currentLocation !== targetId) {
          scene.showTravelGuide('ring', ev.name, targetId)
          return
        }
        // 纯引擎测试和极早期旧档可能还没有加载地图 JSON；保持正式猎环
        // 入口可用，避免地点行动界面在缺少地图资料时递归回 nextEvent。
        if (!currentMapLocation(targetId || gameStore._currentLocation)) {
          scene.showEvent(ev, { isRingHunt: true })
          return
        }
        const ringMeta = buildRingHuntMeta({
          pendingRingLv: eventStore.pendingRingLv,
          ringCount: player.rings?.length || 0,
          targetId,
          targetName: locationName(targetId)
        })
        exploration.showLocationAction(`你已抵达「${ringMeta.ringTargetName}」。这是当前地点行动的首要任务，点击“执行第${ringMeta.ringOrdinal}魂环猎取”即可进入正式猎环流程。`)
        return
      }
    }

    // 3. 主线里程碑
    const milestone = nextMainStoryMilestone()
    if (milestone && player.level >= milestone.minLevel && (eventStore._storyMilestoneDeferredUntil || 0) <= (eventStore._eventCount || 0)) {
      const source = EVENTS.find(e => e.id === milestone.id)
      if (source) {
        if (milestone.targetId && gameStore._currentLocation !== milestone.targetId) {
          scene.showTravelGuide('story', milestone.name, milestone.targetId)
          return
        }
        scene.showEvent(source, { isMainStory: true })
        return
      }
    }

    // 4. 连锁事件（待触发的）
    if (eventStore._pendingChain && deps.CHAINED_EVENTS[eventStore._pendingChain]) {
      const pending = adaptEvent(deps.CHAINED_EVENTS[eventStore._pendingChain], { spiritMeta: player.spirit || {} })
      if (isEventEligible(pending, candidates.eventContext({ source: 'chained', locationMatches: true }))) {
        eventStore._pendingChain = null
        scene.showEvent(scene.normalizeEvent(pending, true))
        return
      }
    }

    // 5. 动态事件 (35% 概率)
    const dynamicContext = candidates.eventContext()
    const dynamic = candidates.checkDynamicEvents(dynamicContext)
    if (dynamic && Math.random() < 0.35) {
      if (dynamic.cooldown) {
        if (!eventStore._dynCooldowns) eventStore._dynCooldowns = {}
        eventStore._dynCooldowns[dynamic.id] = dynamic.cooldown
      }
      const ev = scene.normalizeEvent(dynamic, true)
      scene.showEvent(ev)
      return
    }

    // 6. 随机连锁事件 (25% 概率)
    const chained = candidates.checkChainedEvents()
    if (chained && Math.random() < 0.25) {
      const ev = scene.normalizeEvent(chained, true)
      scene.showEvent(ev)
      return
    }

    // 7. 普通事件池
    const pool = candidates.availableEvents()
    if (pool.length === 0) {
      // 没有可用事件，休整
      growth.completeWorldAction()
      const fs = deps.finalStats()
      player.hp = Math.min(player.hp + 50, fs.maxHp)
      player.spiritPower = Math.min(player.spiritPower + 30, deps.getMaxSpiritPower())
      const reward = growth.applyResultRewards({ exp: 25 })
      growth.addDiaryEntry('在当前地区休整一日，恢复状态并继续修炼。', 'event')
      scene.showContinue(null, `当前地区暂时没有与你阶段相符的新事件。你休整一日，精气神与魂力都得到恢复，并继续积累了修炼经验。${reward.list.length ? `<br><span class="hl-gold">${reward.list.join('　')}</span>` : ''}`)
      saveGame()
      return
    }

    // 洗牌袋加权抽取（同批候选耗尽前不重复，见 drawFromBag）
    const candidates2 = candidates.recentCooldown(pool)
    const ev = candidates.drawFromBag(candidates2)
    scene.showEvent(ev)
  }

  // ==================== 事件完成记录 ====================

  function recordEventDiscoveries(ev) {
    if (!ev) return
    const location = classifyEventLocation(ev.location, data.value.mapData)
    if (location.scope === 'mapped' && location.id) gameStore.setLocation(location.id)
    for (const npcId of Array.isArray(ev.npcIds) ? ev.npcIds : []) gameStore.meetNpc(npcId)
    const text = `${ev.name || ''} ${ev.location || ''} ${(Array.isArray(ev.text) ? ev.text : [ev.text || '']).join(' ')}`
    for (const npc of data.value.npcData || []) {
      if (npc?.id && npc?.name && text.includes(npc.name)) gameStore.meetNpc(npc.id)
    }
  }

  function markEventCompleted(ev) {
    if (!ev?.id || ev.ring || ev._ephemeral) return
    eventStore.markEventDone(ev.id)
    if (ev._locationSourceEventId && !eventStore._recentEvents.includes(ev._locationSourceEventId)) {
      eventStore._recentEvents.push(ev._locationSourceEventId)
      if (eventStore._recentEvents.length > 15) eventStore._recentEvents.shift()
    }
    recordEventDiscoveries(ev)
  }

  // ==================== 旅行遭遇 ====================

  /**
   * 将一次已确认发生的地图旅行遭遇转换为 Vue 事件。
   * 旅行在 MapPage 已扣费并推进时间，因此事件结算必须跳过第二次 world action。
   */
  function triggerTravelEncounter(arrival = {}) {
    const available = TRAVEL_ENCOUNTERS.filter(encounter => player.level >= encounter.minLevel)
    if (!available.length) return false
    const encounter = pickTravelEncounter(available)

    const targetName = arrival.targetName || scene.currentLocationName.value || '新的地域'
    const fromName = arrival.fromName || '旅途'
    const plan = arrival.destinationPlan && typeof arrival.destinationPlan === 'object'
      ? arrival.destinationPlan
      : null
    const lead = buildTravelArrivalSummary({ ...arrival, targetName, fromName, destinationPlan: plan })
    const ev = buildTravelEncounterEvent({
      encounter,
      playerLevel: player.level,
      arrival: { ...arrival, targetId: arrival.targetId || gameStore._currentLocation },
      targetName,
      fromName,
      lead
    })

    scene.showEvent(ev)
    ui.notify('旅途中触发了随机遭遇', 'warning', 3000)
    return true
  }

  // ==================== 选择处理 ====================

  function applyChoice(ev, choice, idx) {
    if (!ev || !choice) return

    // 扣除金币花费
    if (choice.cost?.gold) {
      player.addGold(-choice.cost.gold)
    }

    // 临时旅行遭遇不应污染主线抉择与结局倾向。
    if (!ev._ephemeral) {
      eventStore.recordChoice(ev.id, String.fromCharCode(65 + idx))
      if (choice.id) {
        eventStore._storyDecisions[ev.id] = choice.id
      }
      if (choice.path) {
        eventStore._storyPath.push(choice.path)
      }
    }
    if (choice.after === 'registered') eventStore._registeredAtHall = true
    if (choice.after === 'recommended') eventStore._academyRecommendation = choice.id || null
    if (choice.after === 'enrolled') {
      eventStore._enrollmentComplete = true
      eventStore._introPendingEvent = 'first_class'
      gameStore.setLocation('shrek_academy')
    }

    // 第一堂课特殊处理
    if (ev.id === 'first_class') {
      eventStore._firstClassDone = true
      eventStore._introPendingEvent = null
    }

    // 记录最近事件
    if (!eventStore._recentEvents) eventStore._recentEvents = []
    eventStore._recentEvents.push(ev.id)
    if (eventStore._recentEvents.length > 15) eventStore._recentEvents.shift()

    // 处理连锁跳转
    if (choice.next) {
      eventStore._pendingChain = choice.next
    }

    // 执行 effect 函数
    let effectText = ''
    if (typeof choice.effect === 'function') {
      try {
        const G = candidates.createGProxy()
        effectText = choice.effect(G) || ''
      } catch (e) {
        console.error('事件效果执行失败:', e)
        effectText = '这次尝试没有产生预期效果。'
      }
    }

    // 应用结果奖励
    const r = normalizeLegacyHealthResult(choice.result || {})
    const resolvedResult = effectText || choice.reply
      ? { ...r, text: effectText || choice.reply }
      : r

    // 战斗检查
    if (resolvedResult.battle) {
      // 按契约（engine/battle-contract.js）发起战斗：战斗系统不理解事件语义，
      // 胜利奖励与战败/逃跑后的剧情挂起都在本回调（事件层）完成。
      scene.sceneState.value = 'battle'
      battleSystem.startEventBattle(createEventBattleRequest({
        event: ev,
        result: resolvedResult,
        finalBoss: ev.id === 'final_evil'
      }), (result) => {
        if (result.type === 'victory') {
          const rewardResult = { ...resolvedResult }
          delete rewardResult.battle
          if (ev.ring) {
            const overflowBefore = Number(player.overflowExp) || 0
            const ring = growth.grantRingForEvent(ev, choice, idx)
            if (ring) {
              const released = Math.max(0, overflowBefore - (Number(player.overflowExp) || 0))
              const reward = growth.applyResultRewards(rewardResult)
              result.gains = [
                ...(result.gains || []),
                `获得${ring.name}`,
                ...(released > 0 ? [`释放暂存经验+${released}`] : []),
                ...reward.list
              ]
            }
          } else {
            markEventCompleted(ev)
            exploration.completeLocationStage(ev)
            if (ev.id === 'final_evil') eventStore._dynamicFlags._bossKilled = true
            const reward = growth.applyResultRewards(rewardResult)
            result.gains = [...(result.gains || []), ...reward.list]
          }
        } else {
          // 战败/逃跑：按事件语义挂起目标（原实现由战斗系统直写，现收口到事件层）
          if (ev.ring) {
            eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
          }
          if (ev._mainStory) {
            eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 2
          }
        }
        handleBattleEnd(result)
      })
      return
    }

    markEventCompleted(ev)
    exploration.completeLocationStage(ev)
    const overflowBefore = Number(player.overflowExp) || 0
    const ring = ev.ring ? growth.grantRingForEvent(ev, choice, idx) : null
    if (ev.ring && !ring) {
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
    }
    const reward = growth.applyResultRewards(resolvedResult)
    if (ring) {
      const released = Math.max(0, overflowBefore - (Number(player.overflowExp) || 0))
      if (released > 0) reward.list.unshift(`释放暂存经验+${released}`)
      reward.list.unshift(`获得${ring.name}`)
    }
    if (!ev._worldActionAlreadyCounted) growth.completeWorldAction()

    // 添加日记
    const diaryText = effectText || (resolvedResult.text || '')
    const cleanText = String(diaryText).replace(/\{name\}|\{spirit\}/g, '').replace(/<[^>]*>/g, '')
    growth.addDiaryEntry(`经历事件「${ev.name}」：${cleanText}`, 'event')

    // 显示继续页面
    const displayText = resolvedResult.text || effectText || '你完成了一次经历。'
    const rewardSummary = reward.list.length > 0
      ? `<br><span class="hl-gold">${reward.list.join('　')}</span>`
      : ''
    scene.showContinue(ev, displayText + rewardSummary)

    saveGame()
  }

  // ==================== 行动入口 ====================

  function rest() {
    const fs = deps.finalStats()
    const healed = Math.max(0, Math.min(50, fs.maxHp - player.hp))
    player.heal(healed)
    player.spiritPower = Math.min(player.spiritPower + 20, deps.getMaxSpiritPower())
    ui.notify(`休息片刻，恢复 ${healed} 点生命与 20 点魂力`, 'success')
    growth.completeWorldAction()
    growth.addDiaryEntry('原地休息，恢复了一些生命与魂力。', 'event')
    saveGame()
  }

  function explore() {
    nextEvent()
  }

  function continueAction() {
    if (player.finished) {
      scene.showEnding()
      return
    }
    if (scene.currentEvent.value?._travelArrival) {
      const arrival = scene.currentEvent.value._travelArrival
      exploration.enterLocation(arrival.arrivalSummary || `抵达目标：${arrival.targetName || scene.currentLocationName.value}。先查看地点行动，再决定是否继续深入。`)
      return
    }
    if (isLocationExplorationEvent(scene.currentEvent.value)) {
      const state = exploration.explorationState(scene.currentEvent.value._locationId || gameStore._currentLocation)
      if (!state) {
        exploration.showLocationAction()
        return
      }
      if (state.stage >= state.queuedEventIds.length) exploration.finishLocationExploration()
      else if (state.status === 'active' && state.locationId === gameStore._currentLocation) exploration.showLocationExplorationStage()
      else exploration.showLocationAction()
      return
    }
    if (scene.currentEvent.value?._ringHunt && !eventStore.pendingRingLv) {
      exploration.showLocationAction(buildRingCompletionMessage({
        ringLevel: scene.currentEvent.value._ringHuntLevel || eventStore._lastRingHuntLevel,
        ringOrdinal: scene.currentEvent.value._ringOrdinal || eventStore._lastRingOrdinal,
        ringTargetName: scene.currentEvent.value._ringTargetName || eventStore._lastRingTargetName
      }))
      return
    }
    const guideType = scene.currentEvent.value?._travelGuideType
    if (guideType === 'ring') {
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
    } else if (guideType === 'story') {
      eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 2
    }
    if (guideType) saveGame()
    nextEvent()
  }

  function deferAction() {
    eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 3
    ui.notify('暂缓当前事件，稍后再来', 'info')
    nextEvent()
  }

  // ==================== 战斗结束处理 ====================

  function handleBattleEnd(result) {
    // result: { type: 'victory'|'defeat'|'escape', text, gains, exp, gold }
    if (!scene.currentEvent.value?._worldActionAlreadyCounted) growth.completeWorldAction()
    growth.addDiaryEntry(`经历战斗：${result.text}`, 'event')
    growth.checkLevelUp()

    const gainsSummary = result.gains && result.gains.length > 0
      ? `<br><span class="hl-gold">${result.gains.join('　')}</span>`
      : ''
    scene.showContinue(scene.currentEvent.value, result.text + gainsSummary)
    saveGame()
  }

  return {
    canHunt,
    nextEvent,
    applyChoice,
    triggerTravelEncounter,
    rest,
    explore,
    continueAction,
    deferAction,
    handleBattleEnd,
    recordEventDiscoveries,
    markEventCompleted,
    nextMainStoryMilestone
  }
}
