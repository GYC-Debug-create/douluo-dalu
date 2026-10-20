/**
 * 事件流编排层
 *
 * 从 useEventEngine.js 拆出"剧情如何推进"：
 * nextEvent 决策链 / 选项结算 / 继续前行 / 战斗收尾 / 旅行遭遇 / 事件完成记录。
 * 纯逻辑在 engine/*，场景呈现由 useEventScene 提供，本层只串联。
 */
import { computed } from 'vue'
import { normalizeLegacyHealthResult, fillTemplate, plainText } from '@/engine/rules'
import { createEventBattleRequest, encounterDifficulty } from '@/engine/battle-contract'
import { adaptEvent, isEventEligible, nextMainStoryMilestone as nextMainStoryMilestonePure, MAIN_STORY_EVENT_IDS } from '@/engine/event-rules'
import { buildPrologueEvent, buildEarlyLifeEvents } from '@/data/story-intro'
import { buildTravelArrivalSummary } from '@/utils/travel-arrival'
import { TRAVEL_ENCOUNTERS, pickTravelEncounter, buildTravelEncounterEvent } from '@/utils/travel-encounters'
import { buildRingCompletionMessage, buildRingHuntMeta, ringDestination } from '@/utils/ring-hunt'
import { isLocationExplorationEvent, isLocationExplorationInProgress } from '@/utils/location-exploration'
import { marksFromChoice } from '@/engine/story-marks'

// 最近经历过的事件在 30 次行动内不会再次出现。
const RECENT_EVENT_WINDOW = 30

// 剧情里对人物的常用称呼（例如"大师"就是玉小刚），用于识别"和谁一起经历了这件事"。
const NPC_TEXT_ALIASES = Object.freeze({
  玉小刚: ['大师'],
  弗兰德: ['弗兰德院长'],
  剑斗罗尘心: ['尘心', '剑斗罗'],
  骨斗罗古榕: ['古榕', '骨斗罗']
})

// 当地没有新事件时的安静修炼：轮换几种说法，避免同一句话反复出现。
const QUIET_TRAINING_LINES = Object.freeze([
  { title: '安静的修炼', text: '这里暂时风平浪静。你找了块安静的地方盘膝打坐，魂力在体内一圈圈运转，比昨天又顺畅了一些。', diary: '静心打坐，魂力更顺畅了。' },
  { title: '复习魂技', text: '没有新的委托上门，你干脆把每个魂技都练了十遍。动作越来越熟练，出手也更快了。', diary: '反复练习魂技，出手更熟练了。' },
  { title: '写修炼笔记', text: '你把最近的战斗一场场回想，在本子上写下得失。大师说过：会总结的魂师，进步最快。', diary: '整理修炼笔记，想通了几处破绽。' },
  { title: '晨跑与体能', text: '天刚亮你就出门晨跑，绕着附近跑了好几圈。汗水湿透了衣服，身体却越来越轻快。', diary: '坚持晨跑，体能变好了。' }
])

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

  // 主线目标快照：供地点行动界面、引导条和左栏显示"下一段故事"。
  // due=等级已够；atTarget=就在目标地点（或该节点不限地点）。
  function mainStoryStatus() {
    const milestone = nextMainStoryMilestone()
    if (!milestone) return { milestone: null, due: false, atTarget: false, targetId: '', targetName: '' }
    const source = EVENTS.find(e => e.id === milestone.id)
    const targetId = milestone.targetId || ''
    return {
      milestone,
      due: Boolean(source) && player.level >= milestone.minLevel,
      atTarget: !targetId || gameStore._currentLocation === targetId,
      targetId,
      targetName: targetId ? locationName(targetId) : ''
    }
  }

  // 玩家主动点"开始主线"：在目标地点就直接进入剧情，不在就给出前往指引。
  function startMainStory() {
    if (battleSystem.isActive()) return false
    const status = mainStoryStatus()
    if (!status.milestone) {
      ui.notify('主线故事已经全部完成', 'info')
      return false
    }
    if (!status.due) {
      ui.notify(`下一段主线「${status.milestone.name}」需要 Lv.${status.milestone.minLevel}`, 'info')
      return false
    }
    if (!status.atTarget) {
      scene.showTravelGuide('story', status.milestone.name, status.targetId)
      return false
    }
    eventStore._storyMilestoneDeferredUntil = 0
    scene.showEvent(EVENTS.find(e => e.id === status.milestone.id), { isMainStory: true })
    return true
  }

  // ==================== 核心: nextEvent ====================

  function nextEvent() {
    if (battleSystem.isActive()) return
    if (player.finished) {
      scene.showEnding()
      return
    }

    // 打赢最终决战后就进入结局（儿童版不再要求战后继续刷到 100 级）。
    if (eventStore.doneEvents.includes('final_evil')) {
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
      // 当地暂时没有新故事：安排一次有实际收获的修炼，经验按当前等级折算（约 15% 一级），
      // 保证任何等级都不会因为内容空档而卡死。
      growth.completeWorldAction()
      const fs = deps.finalStats()
      player.hp = Math.min(player.hp + Math.round(fs.maxHp * 0.3), fs.maxHp)
      player.spiritPower = Math.min(player.spiritPower + 30, deps.getMaxSpiritPower())
      const exp = Math.max(25, Math.round((deps.expNeeded ? deps.expNeeded(player.level) : 200) * 0.15))
      const reward = growth.applyResultRewards({ exp })
      const line = QUIET_TRAINING_LINES[(eventStore._eventCount || 0) % QUIET_TRAINING_LINES.length]
      growth.addDiaryEntry(`在${scene.currentLocationName.value || locationName(gameStore._currentLocation) || '当地'}${line.diary}`, 'event')
      scene.showContinue({ id: 'quiet_training', name: line.title }, line.text, reward.list)
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
    // 玩家的位置只由地图旅行改变：事件里写了别的地名（例如出身描述"星斗大森林外围旁的小村庄"、
    // 动态事件、连锁事件），都不能把玩家"传送"过去，也不能把那里标记为"已去过"。
    // 一起经历过事件的人物：结识并增加好感（以前好感只能靠菜单送礼刷）。
    const met = new Set([...(Array.isArray(ev.npcIds) ? ev.npcIds : []), ...(Array.isArray(ev.introduces) ? ev.introduces : [])])
    const text = `${ev.name || ''} ${ev.location || ''} ${(Array.isArray(ev.text) ? ev.text : [ev.text || '']).join(' ')}`
    for (const npc of data.value.npcData || []) {
      if (!npc?.id || !npc?.name) continue
      const names = [npc.name, ...(NPC_TEXT_ALIASES[npc.id] || [])]
      if (names.some(name => text.includes(name))) met.add(npc.id)
    }
    const storyBond = ev._mainStory || MAIN_STORY_EVENT_IDS.includes(ev.id)
    const knownNpcIds = new Set((data.value.npcData || []).map(npc => npc?.id).filter(Boolean))
    for (const npcId of met) {
      // 只登记图鉴里有的人物（泰坦巨猿这类魂兽朋友记在世界账本里，不进伙伴列表）
      if (knownNpcIds.size && !knownNpcIds.has(npcId)) continue
      gameStore.meetNpc(npcId)
      const gain = storyBond ? 12 : 4
      gameStore.setNpcRelation(npcId, (Number(gameStore._npcRelations?.[npcId]) || 0) + gain)
    }
  }

  function markEventCompleted(ev) {
    if (!ev?.id || ev.ring || ev._ephemeral) return
    const repeatId = ev._locationSourceEventId || ev.id
    if (eventStore.doneEvents.includes(repeatId)) {
      if (!eventStore._eventRepeatCounts || typeof eventStore._eventRepeatCounts !== 'object') eventStore._eventRepeatCounts = {}
      eventStore._eventRepeatCounts[repeatId] = (Number(eventStore._eventRepeatCounts[repeatId]) || 0) + 1
    }
    eventStore.markEventDone(ev.id)
    if (ev._locationSourceEventId) {
      if (!eventStore.doneEvents.includes(ev._locationSourceEventId)) eventStore.markEventDone(ev._locationSourceEventId)
      if (!eventStore._recentEvents.includes(ev._locationSourceEventId)) {
        eventStore._recentEvents.push(ev._locationSourceEventId)
        if (eventStore._recentEvents.length > RECENT_EVENT_WINDOW) eventStore._recentEvents.shift()
      }
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

  // ==================== 世界账本与旅程记录 ====================

  // 名场面完成时写入记号（选项记号 + 收尾记号 + 已认识的人物），并处理入学等身份变化。
  function commitStoryOutcome(ev, choice, overrideMarks = null) {
    if (!ev || ev._ephemeral) return []
    const marks = overrideMarks
      ? [...overrideMarks, ...marksFromChoice(ev, { marks: [] })]
      : marksFromChoice(ev, choice)
    if (marks.length) eventStore.addStoryMarks(marks)
    // 史莱克入学考核通过：正式成为史莱克学员（旧版"第一堂课"流程随之关闭）
    if (ev.id === 'p04_shrek_exam') {
      eventStore._enrollmentComplete = true
      eventStore._firstClassDone = true
      eventStore._introPendingEvent = null
    }
    return marks
  }

  function journeyPlace() {
    return locationName(gameStore._currentLocation) || gameStore._currentLocation || ''
  }

  function logJourney(entry) {
    eventStore.logJourney({ lv: player.level, loc: journeyPlace(), ...entry })
  }

  // ==================== 选择处理 ====================

  function applyChoice(ev, choice, idx) {
    if (!ev || !choice) return
    // 天赐淬炼是一次性替代奖励，不能借仍然挂起的猎环入口反复领取。
    const refinesGift = ev.id === 'ring_hunt_60' && idx === 1
    if (refinesGift && (eventStore._dynamicFlags._refinedGiftAt60 || eventStore.choices[ev.id] === 'B')) {
      ui.notify('已完成天赐淬炼，请选择吸收魂环以继续突破', 'warning')
      return
    }

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
        // 大分叉的选择在结局倾向里分量更重（pathWeight 次）
        const times = Math.max(1, Math.min(5, Number(choice.pathWeight) || 1))
        for (let i = 0; i < times; i++) eventStore._storyPath.push(choice.path)
      }
    }
    if (choice.after === 'registered') eventStore._registeredAtHall = true
    if (choice.after === 'recommended') eventStore._academyRecommendation = choice.id || null
    if (choice.after === 'nuoding') {
      // 拿着推荐信去诺丁学院：故事的第一站
      gameStore.setLocation('nuoding_city')
    }
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
    if (eventStore._recentEvents.length > RECENT_EVENT_WINDOW) eventStore._recentEvents.shift()

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
    // 复制一份再改：result 可能直接引用事件数据，不能被收尾段落等改写污染
    const resolvedResult = effectText || choice.reply
      ? { ...r, text: effectText || choice.reply }
      : { ...r }
    // 名场面的收尾段落：不论怎么选都会接在结果后面
    if (ev.closing) resolvedResult.text = [resolvedResult.text, ev.closing].filter(Boolean).join('\n\n')
    logJourney({
      k: ev._mainStory ? 'story' : ev.ring ? 'ring' : 'event',
      id: ev._locationSourceEventId || ev.id,
      title: plainText(fillTemplate(ev.name || '', { name: player.name, spirit: player.spirit?.name })),
      pick: plainText(fillTemplate(choice.text || '', { name: player.name, spirit: player.spirit?.name })),
      ...(Array.isArray(choice.marks) && choice.marks.length ? { marks: choice.marks } : {})
    })

    // 战斗检查
    if (resolvedResult.battle) {
      // 按契约（engine/battle-contract.js）发起战斗：战斗系统不理解事件语义，
      // 胜利奖励与战败/逃跑后的剧情挂起都在本回调（事件层）完成。
      scene.sceneState.value = 'battle'
      battleSystem.startEventBattle(createEventBattleRequest({
        event: ev,
        result: resolvedResult,
        finalBoss: ev.id === 'final_evil',
        difficulty: encounterDifficulty({ event: ev, choice, ringOrdinal: (player.rings?.length || 0) + 1 })
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
              result.ringLabel = ring.name
              result.gains = [
                ...(result.gains || []),
                `获得${ring.name}`,
                ...(released > 0 ? [`释放暂存经验+${released}`] : []),
                ...reward.list
              ]
            } else {
              // 吸收失败：胜利文案描述的是"魂环融入体内"，必须换成失败说明，避免文字与结果相反。
              result.text = '你打赢了魂兽，可在吸收魂环时，狂暴的魂力在经脉里横冲直撞，你只能先放弃这一次。休整一下，过两次行动后再来挑战。'
            }
          } else {
            markEventCompleted(ev)
            commitStoryOutcome(ev, choice)
            exploration.completeLocationStage(ev)
            if (ev.id === 'final_evil') eventStore._dynamicFlags._bossKilled = true
            const reward = growth.applyResultRewards(rewardResult)
            result.gains = [...(result.gains || []), ...reward.list]
          }
        } else if (result.type === 'defeat' && resolvedResult.defeatOutcome && !ev.ring) {
          // 剧情分叉：这一战输了不用重打，故事改走另一条路（结局仍然是好的）。
          const outcome = resolvedResult.defeatOutcome
          markEventCompleted(ev)
          commitStoryOutcome(ev, choice, Array.isArray(outcome.marks) ? outcome.marks : [])
          exploration.completeLocationStage(ev)
          const rewardResult = { ...resolvedResult }
          delete rewardResult.battle
          delete rewardResult.defeatOutcome
          delete rewardResult.text
          const reward = growth.applyResultRewards(rewardResult)
          result.text = [outcome.text, ev.closing].filter(Boolean).join('\n\n')
          result.gains = reward.list
          logJourney({ k: 'branch', id: ev.id, title: ev.name, pick: '战斗失利，故事改走另一条路', marks: outcome.marks || [] })
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
    commitStoryOutcome(ev, choice)
    exploration.completeLocationStage(ev)
    const overflowBefore = Number(player.overflowExp) || 0
    const ring = ev.ring ? growth.grantRingForEvent(ev, choice, idx) : null
    if (ev.ring && !ring) {
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
    }
    // 与战斗猎环保持一致：吸收失败只结算反噬，不能领取成功选项的经验/永久属性。
    const reward = ev.ring && !ring && !refinesGift
      ? { list: [] }
      : growth.applyResultRewards(resolvedResult)
    if (refinesGift) eventStore._dynamicFlags._refinedGiftAt60 = true
    if (ring) {
      const released = Math.max(0, overflowBefore - (Number(player.overflowExp) || 0))
      if (released > 0) reward.list.unshift(`释放暂存经验+${released}`)
      reward.list.unshift(`获得${ring.name}`)
    }
    if (!ev._worldActionAlreadyCounted) growth.completeWorldAction()

    const templateExtra = ring ? { ringLabel: ring.name } : {}
    if (ev.ring && !ring && !refinesGift) {
      resolvedResult.text = '魂兽被你制服了，可吸收魂环时，狂暴的魂力在经脉里横冲直撞，你只能先放弃这一次。休整一下，过两次行动后再来挑战。'
    }

    // 添加日记：占位符替换成真实名字，再去掉标签，日记界面按纯文本展示。
    const diaryText = effectText || (resolvedResult.text || '')
    const cleanText = plainText(fillTemplate(diaryText, { name: player.name, spirit: player.spirit?.name, origin: player.originName, ...templateExtra }))
    growth.addDiaryEntry(`经历事件「${plainText(fillTemplate(ev.name, { name: player.name, spirit: player.spirit?.name }))}」：${cleanText}`, 'event')

    // 显示继续页面：正文与奖励分开传，奖励由场景区渲染成一条条小标签。
    const displayText = resolvedResult.text || effectText || '你完成了一次经历。'
    scene.showContinue(ev, displayText, reward.list, templateExtra)

    saveGame()
  }

  // ==================== 行动入口 ====================

  // 休息：花一次行动恢复 40% 生命和 30% 魂力（原来只恢复 50 点，后期几乎没用）。
  function rest() {
    if (battleSystem.isActive()) return
    const fs = deps.finalStats()
    const maxMp = deps.getMaxSpiritPower()
    const healed = Math.max(0, Math.min(Math.round(fs.maxHp * 0.4), fs.maxHp - player.hp))
    const mpBefore = player.spiritPower
    player.heal(healed)
    player.spiritPower = Math.min(maxMp, player.spiritPower + Math.round(maxMp * 0.3))
    ui.notify(`休息了一会儿，恢复 ${healed} 点生命、${player.spiritPower - mpBefore} 点魂力`, 'success')
    growth.completeWorldAction()
    growth.addDiaryEntry('停下来休息，恢复了生命与魂力。', 'event')
    saveGame()
    if (scene.sceneState.value === 'location') exploration.showLocationAction()
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
    // 玩家选择"先历练"时推迟 6 次行动再提醒；目标始终显示在引导条和左栏，不会丢。
    const guideType = scene.currentEvent.value?._travelGuideType
    if (guideType === 'ring') {
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 6
    } else if (guideType === 'story') {
      eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 6
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
    logJourney({ k: 'battle', id: scene.currentEvent.value?.id || '', title: scene.currentEvent.value?.name || '', result: result.type })
    if (!scene.currentEvent.value?._worldActionAlreadyCounted) growth.completeWorldAction()
    const templateExtra = result.ringLabel ? { ringLabel: result.ringLabel } : {}
    growth.addDiaryEntry(`经历战斗：${plainText(fillTemplate(result.text, { name: player.name, spirit: player.spirit?.name, ...templateExtra }))}`, 'event')
    growth.checkLevelUp()

    scene.showContinue(scene.currentEvent.value, result.text, result.gains || [], templateExtra)
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
    nextMainStoryMilestone,
    mainStoryStatus,
    startMainStory
  }
}
