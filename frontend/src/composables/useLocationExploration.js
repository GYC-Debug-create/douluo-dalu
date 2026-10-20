/**
 * 地点探索编排层
 *
 * 从 useEventEngine.js 拆出：地点行动界面、探索队列的推进/暂停/放弃/完成。
 * 纯状态机部分（队列构建、阶段事件装配、进度计算）在 utils/location-exploration.js；
 * 本文件只做 store 读写与 UI 编排，通过 deps 注入与事件引擎解耦（避免循环依赖）。
 */
import {
  buildLocationExplorationEvent,
  buildLocationExplorationQueue,
  explorationProgress,
  isLocationExplorationInProgress,
  LOCATION_EXPLORATION_STATUSES,
  locationExplorationMode,
  isLocationExplorationEvent,
  normalizeLocationExplorationState,
  normalizeLocationExplorationsByLocation
} from '@/utils/location-exploration'
import { buildRingHuntMeta, ringDestination } from '@/utils/ring-hunt'
import { experienceNeededForLevel } from '@/engine/rules'

export { isLocationExplorationEvent }

/**
 * @param {object} deps {
 *   player, eventStore, gameStore, ui, data, EVENTS,
 *   battleGuard: () => boolean,
 *   showEvent, applyResultRewards, saveGame, commands,
 *   scene: { currentEvent, sceneState, resultText, resultRewards, currentLocationName },
 *   currentMapLocation, locationName, locationCodex
 * }
 */
export function createLocationExplorationSystem(deps) {
  const {
    player, eventStore, gameStore, ui, data, EVENTS,
    battleGuard, showEvent, applyResultRewards, saveGame, commands,
    scene, currentMapLocation, locationName, locationCodex
  } = deps
  const { currentEvent, sceneState, resultText, resultRewards, currentLocationName: locNameRef } = scene

  function explorationStates() {
    const normalized = normalizeLocationExplorationsByLocation(
      eventStore.locationExplorationsByLocation,
      eventStore.locationExploration
    )
    if (!eventStore.locationExplorationsByLocation || typeof eventStore.locationExplorationsByLocation !== 'object') {
      eventStore.locationExplorationsByLocation = normalized
    }
    return normalized
  }

  function explorationState(locationId = gameStore._currentLocation) {
    const map = explorationStates()
    const state = normalizeLocationExplorationState(locationId ? map[locationId] : null)
    if (state) return state
    const legacy = normalizeLocationExplorationState(eventStore.locationExploration)
    return legacy && (!locationId || legacy.locationId === locationId) ? legacy : null
  }

  function setExplorationState(state) {
    const normalized = normalizeLocationExplorationState(state)
    if (!normalized) return null
    const map = explorationStates()
    eventStore.locationExplorationsByLocation = {
      ...map,
      [normalized.locationId]: normalized
    }
    // 旧版浏览器流程和旧脚本读取的字段保留为“最近操作的地点”镜像。
    eventStore.locationExploration = normalized
    return normalized
  }

  function inProgressExplorations(excludeLocationId = '') {
    return Object.values(explorationStates())
      .map(normalizeLocationExplorationState)
      .filter(state => state && state.locationId !== excludeLocationId && isLocationExplorationInProgress(state))
  }

  function explorationEventFor(state, index = state?.stage || 0) {
    if (!state || !state.queuedEventIds?.[index]) return null
    const location = currentMapLocation(state.locationId)
      || data.value.mapData.find(item => item.id === state.locationId)
    if (!location) return null
    const eventId = state.queuedEventIds[index]
    const sourceId = state.sourceEventIds?.[index]
      || (eventId.startsWith('location_') ? null : eventId)
    const source = sourceId ? EVENTS.find(event => event.id === sourceId) : null
    const mode = locationExplorationMode(state.objectiveType)
    const stageIndex = Math.max(0, Math.min(mode.stages.length - 1, Number(state.stage) || index))
    const event = buildLocationExplorationEvent({
      location,
      stageIndex,
      player,
      codex: locationCodex(location),
      eventId,
      objectiveType: state.objectiveType,
      sourceEvent: source
    })
    if (!event) return null
    return {
      ...event,
      _locationExploration: true,
      _locationId: location.id,
      _explorationEventId: eventId,
      _explorationStageIndex: index,
      // 地点链不跳入其它链，也不让普通事件的 next 污染主线队列。
      choices: (event.choices || []).map(choice => {
        const copy = { ...choice }
        delete copy.next
        return copy
      })
    }
  }

  function showLocationAction(message = '', { arrivalSummary = false, rewards = [] } = {}) {
    const location = currentMapLocation()
    if (!location) {
      commands.nextEvent()
      return
    }
    // 主线入口：等级已够且就在目标地点时，地点行动界面直接给出"开始主线"按钮；
    // 等级够但不在目标地点，则提示去哪里。修复"一直在地点里探索，主线永远不出现"。
    let story = { milestone: null, due: false, atTarget: false, targetName: '' }
    try { story = commands.mainStoryStatus() } catch { /* 纯工具测试未注册主线命令时安全降级 */ }
    locNameRef.value = location.name
    const state = explorationState(location.id)
    const activeMode = locationExplorationMode(state?.objectiveType || 'local_exploration')
    const elsewhere = inProgressExplorations(location.id).map(item => {
      const progress = explorationProgress(item)
      return {
        ...item,
        progress,
        locationName: locationName(item.locationId),
        statusLabel: item.status === LOCATION_EXPLORATION_STATUSES.active ? '进行中' : '已暂停'
      }
    })
    const ringMeta = buildRingHuntMeta({
      pendingRingLv: eventStore.pendingRingLv,
      ringCount: player.rings?.length || 0,
      targetId: eventStore._ringTargetId || '',
      targetName: eventStore._ringTargetName || ''
    })
    const target = ringMeta.ringTargetId ? ringDestination(ringMeta.ringLevel) : null
    const ringReady = Boolean(eventStore.pendingRingLv && target?.id === location.id)
    const activeHere = Boolean(state && state.status === LOCATION_EXPLORATION_STATUSES.active && isLocationExplorationInProgress(state))
    const suspendedHere = Boolean(state && state.status === LOCATION_EXPLORATION_STATUSES.suspended && isLocationExplorationInProgress(state))
    const activeElsewhere = elsewhere.length > 0
    currentEvent.value = {
      id: `location_action_${location.id}`,
      name: `${location.name} · 地点行动`,
      location: location.name,
      locationAction: true,
      locationId: location.id,
      arrivalSummary: arrivalSummary && message ? message : '',
      activities: Array.isArray(location.events) ? location.events.slice(0, 8) : [],
      npcs: Array.isArray(location.npcs) ? location.npcs.slice(0, 8) : [],
      description: location.description || '',
      specialConditions: Array.isArray(location.specialConditions) ? location.specialConditions.slice(0, 4) : [],
      ringReady,
      ringOrdinal: ringMeta.ringOrdinal,
      ringLevel: ringMeta.ringLevel || 0,
      ringTargetId: ringMeta.ringTargetId,
      ringTargetName: ringMeta.ringTargetName,
      ringLabel: ringReady ? `执行第${ringMeta.ringOrdinal}魂环猎取` : '',
      // 猎环优先：魂环门槛卡着时先猎环，猎完再进主线。
      storyReady: Boolean(!ringReady && story.milestone && story.due && story.atTarget),
      storyElsewhere: Boolean(story.milestone && story.due && !story.atTarget),
      storyName: story.milestone?.name || '',
      storyTargetName: story.targetName || '',
      completionRewards: Array.isArray(rewards) ? rewards.filter(Boolean) : [],
      completionText: !arrivalSummary && message ? message : '',
      exploration: state,
      explorationObjectiveType: activeMode.id,
      explorationModeLabel: activeMode.label,
      explorationModeDescription: activeMode.description,
      activeHere,
      suspendedHere,
      activeElsewhere,
      explorationsElsewhere: elsewhere,
      explorationLocationName: elsewhere[0]?.locationName || location.name,
      stage: state && isLocationExplorationInProgress(state) ? state.stage : 0,
      stageCount: activeMode.stages.length
    }
    sceneState.value = 'location'
    resultText.value = message || (activeHere
      ? `你正在「${location.name}」深入调查。地点探索已完成 ${state.completedEventIds.length}/${state.queuedEventIds.length} 个阶段，下一步会从上次进度继续。`
      : suspendedHere
        ? `你在「${location.name}」的${state.modeLabel}已暂停，进度保留为 ${state.completedEventIds.length}/${state.queuedEventIds.length} 个阶段。点击“继续深入”即可恢复。`
        : activeElsewhere
          ? `「${elsewhere[0].locationName}」仍有未完成的地点行动。当前「${location.name}」不会被锁定，你可以继续当地行动，也可以先处理暂停的探索。`
        : `你已抵达「${location.name}」。这里有独立的当地行动、人物和委托；完成一轮探索后会回到此界面。`)
    resultRewards.value = []
  }

  function enterLocation(message = '') {
    if (battleGuard()) return
    showLocationAction(message, { arrivalSummary: Boolean(message) })
  }

  function startLocationExploration(objectiveType = 'local_exploration') {
    if (battleGuard()) return false
    const location = currentMapLocation()
    if (!location) {
      ui.notify('当前地点资料尚未加载', 'warning')
      return false
    }
    const current = explorationState(location.id)
    const requestedMode = locationExplorationMode(objectiveType)
    if (isLocationExplorationInProgress(current)) {
      const currentMode = locationExplorationMode(current.objectiveType)
      ui.notify(
        current.status === LOCATION_EXPLORATION_STATUSES.suspended
          ? `「${location.name}」的${currentMode.label}已暂停，请点击“继续深入”恢复`
          : `当前正在进行「${currentMode.label}」，请先完成这轮行动`,
        'warning',
        4000
      )
      showLocationAction()
      return false
    }
    const state = buildLocationExplorationQueue({
      location,
      mapLocations: data.value.mapData,
      events: EVENTS,
      player,
      game: gameStore,
      eventStore,
      objectiveType: requestedMode.id,
      cycle: `${eventStore._eventCount || 0}_${gameStore._locationProgress?.[location.id]?.rounds || 0}`
    })
    if (!state) return false
    state.objectiveType = locationExplorationMode(state.objectiveType || requestedMode.id).id
    state.status = LOCATION_EXPLORATION_STATUSES.active
    state.active = true
    setExplorationState(state)
    showLocationExplorationStage()
    saveGame()
    return true
  }

  function resumeLocationExploration() {
    if (battleGuard()) return false
    const state = explorationState()
    if (!isLocationExplorationInProgress(state)) {
      showLocationAction()
      return false
    }
    if (state.locationId !== gameStore._currentLocation) {
      showLocationAction(`请返回「${locationName(state.locationId)}」继续这轮地点探索。`)
      return false
    }
    state.status = LOCATION_EXPLORATION_STATUSES.active
    state.active = true
    state.suspendedAtLocationId = ''
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    setExplorationState(state)
    showLocationExplorationStage()
    saveGame()
    return true
  }

  function showLocationExplorationStage() {
    const state = explorationState()
    if (!isLocationExplorationInProgress(state) || state.status !== LOCATION_EXPLORATION_STATUSES.active) {
      showLocationAction()
      return
    }
    if (state.locationId !== gameStore._currentLocation) {
      showLocationAction(`请返回「${locationName(state.locationId)}」继续这轮地点探索。`)
      return
    }
    if (state.stage >= state.queuedEventIds.length) {
      finishLocationExploration()
      return
    }
    const event = explorationEventFor(state)
    if (!event) {
      ui.notify('地点探索事件数据缺失，本轮已安全暂停', 'error', 5000)
      showLocationAction()
      return
    }
    showEvent(event, { locationExploration: true })
  }

  function completeLocationStage(event) {
    if (!isLocationExplorationEvent(event)) return
    const state = explorationState(event._locationId)
    if (!isLocationExplorationInProgress(state) || state.locationId !== event._locationId) return
    const eventId = event._explorationEventId || event.id
    if (!state.completedEventIds.includes(eventId)) state.completedEventIds.push(eventId)
    const stageIndex = Math.max(0, Number(event._explorationStageIndex) || state.stage)
    state.stage = Math.max(state.stage, stageIndex + 1)
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    setExplorationState(state)
  }

  function finishLocationExploration() {
    const state = explorationState()
    const location = state ? currentMapLocation(state.locationId) : currentMapLocation()
    if (!state || !location) {
      showLocationAction()
      return
    }
    const mode = locationExplorationMode(state.objectiveType)
    const level = Math.max(1, Number(player.level) || 1)
    // 完成一整轮（4 小步）的奖励按当前等级折算，后期也有实际意义。
    const levelExp = experienceNeededForLevel(level)
    const rewardInput = mode.rewardKey === 'commission'
      ? { gold: 60 + level * 4, exp: Math.round(levelExp * 0.1) }
      : mode.rewardKey === 'contact'
        ? { fate: 1, exp: Math.round(levelExp * 0.12) }
        : { exp: Math.round(levelExp * 0.2) }
    const reward = applyResultRewards(rewardInput)
    const prior = gameStore._locationProgress?.[location.id] || {}
    const rounds = Math.max(0, Number(prior.rounds) || 0) + 1
    const progress = Math.min(100, Math.max(0, Number(prior.exploration) || 0) + 20)
    const modeProgress = {
      exploration: progress,
      clues: Math.max(0, Number(prior.clues) || 0) + (mode.id === 'local_exploration' ? 1 : 0),
      reputation: Math.max(0, Number(prior.reputation) || 0) + (mode.id === 'local_commission' ? 2 : 0),
      commissions: Math.max(0, Number(prior.commissions) || 0) + (mode.id === 'local_commission' ? 1 : 0),
      contacts: Math.max(0, Number(prior.contacts) || 0) + (mode.id === 'local_contact' ? 1 : 0),
      relationships: Math.max(0, Number(prior.relationships) || 0) + (mode.id === 'local_contact' ? 1 : 0),
      information: Math.max(0, Number(prior.information) || 0) + (mode.id === 'local_contact' ? 1 : 0)
    }
    if (mode.id === 'local_contact') {
      const npc = Array.isArray(location.npcs) ? location.npcs[0] : null
      if (npc) {
        gameStore.meetNpc(npc)
        gameStore.setNpcRelation(npc, Math.max(1, Number(gameStore._npcRelations?.[npc]) || 0) + 1)
      }
    }
    gameStore._locationProgress = {
      ...(gameStore._locationProgress || {}),
      [location.id]: {
        rounds,
        ...modeProgress,
        lastObjectiveType: mode.id,
        lastCompletedAtEventCount: eventStore._eventCount || 0
      }
    }
    const progressText = mode.id === 'local_commission'
      ? `委托记录 ${modeProgress.commissions} 次，地域声望 ${modeProgress.reputation}`
      : mode.id === 'local_contact'
        ? `人物关系 ${modeProgress.relationships}，新情报 ${modeProgress.information} 条`
        : `探索度 ${modeProgress.exploration}%，新增线索 ${modeProgress.clues} 条`
    const summary = `你完成了「${location.name}」的${mode.label}，${progressText}。`
    state.status = LOCATION_EXPLORATION_STATUSES.completed
    state.active = false
    state.stage = state.queuedEventIds.length
    state.completedAtEventCount = eventStore._eventCount || 0
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    state.suspendedAtLocationId = ''
    state.lastSummary = summary.replace(/<[^>]*>/g, '')
    setExplorationState(state)
    appendDiarySafe(`完成「${location.name}」第${rounds}轮地点探索，探索度提升至${progress}%。`, 'discovery')
    saveGame()
    showLocationAction(summary, { rewards: reward.list })
  }

  function abandonLocationExploration(locationId = '') {
    if (battleGuard()) return false
    const targetId = locationId || inProgressExplorations().at(0)?.locationId || ''
    const state = explorationState(targetId)
    if (!isLocationExplorationInProgress(state)) {
      ui.notify('没有可放弃的未完成地点探索', 'info')
      return false
    }
    const name = locationName(state.locationId)
    state.status = LOCATION_EXPLORATION_STATUSES.abandoned
    state.active = false
    state.abandonedAtEventCount = eventStore._eventCount || 0
    state.lastUpdatedAtEventCount = eventStore._eventCount || 0
    state.suspendedAtLocationId = ''
    state.lastSummary = `已放弃「${name}」的${state.modeLabel}，未领取本轮完成奖励。`
    setExplorationState(state)
    appendDiarySafe(state.lastSummary, 'event')
    saveGame()
    ui.notify(state.lastSummary, 'info', 4500)
    showLocationAction()
    return true
  }

  // 日记写入通过 deps.addDiaryEntry 注入，避免与本文件形成对引擎的额外依赖面。
  function appendDiarySafe(text, type) {
    deps.addDiaryEntry?.(text, type)
  }

  return {
    explorationStates,
    explorationState,
    setExplorationState,
    inProgressExplorations,
    explorationEventFor,
    showLocationAction,
    enterLocation,
    startLocationExploration,
    resumeLocationExploration,
    showLocationExplorationStage,
    completeLocationStage,
    finishLocationExploration,
    abandonLocationExploration
  }
}
