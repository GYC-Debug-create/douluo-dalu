import { adaptEvent, isEventEligible } from '@/engine/event-rules'
import { getEventIndex } from '@/engine/event-index'
import { classifyEventLocation, phaseForLevel, experienceNeededForLevel } from '@/engine/rules'
import { resolveAssetPath } from '@/utils/asset-resolver'

/**
 * 地点行动的三种玩法。每种玩法都有自己的阶段、叙事重点、奖励类型和进度字段；
 * 缺少专属事件时，仍由同一套数据驱动模板补足阶段。
 */
export const LOCATION_EXPLORATION_MODES = Object.freeze({
  local_exploration: {
    id: 'local_exploration',
    label: '当地探索',
    description: '调查环境、追踪线索并确认区域危险。',
    progressKey: 'exploration',
    rewardKey: 'exploration',
    stages: [
      { id: 'environment_survey', label: '环境调查', focus: '地形调查', patterns: /地形|环境|潮汐|风向|地脉|调查|线索/ },
      { id: 'clue_tracking', label: '线索追踪', focus: '线索追踪', patterns: /追踪|足迹|痕迹|传闻|踪迹|遗迹|发现/ },
      { id: 'landmark_discovery', label: '特殊地貌发现', focus: '特殊地貌', patterns: /地貌|秘境|湖|海|森林|山谷|遗迹|宝藏/ },
      { id: 'local_hazard', label: '区域危险确认', focus: '危险确认', patterns: /危险|风暴|冲突|考验|战斗|魂兽|遭遇|守卫/ }
    ]
  },
  local_commission: {
    id: 'local_commission',
    label: '当地委托',
    description: '接受当地人的委托，完成目标并留下可追踪的交付记录。',
    progressKey: 'commissions',
    rewardKey: 'commission',
    stages: [
      { id: 'commission_offer', label: '确认委托', focus: '委托确认', patterns: /委托|请求|港口|补给|任务|需求|商会/ },
      { id: 'commission_route', label: '执行路线', focus: '任务路线', patterns: /路线|护送|采集|航行|运送|寻找|取回/ },
      { id: 'commission_conflict', label: '处理阻碍', focus: '委托阻碍', patterns: /冲突|盗|风暴|魂兽|守卫|追兵|争执|危险/ },
      { id: 'commission_handover', label: '返回交付', focus: '委托交付', patterns: /交付|回报|验收|账册|许可|报酬|交接/ }
    ]
  },
  local_contact: {
    id: 'local_contact',
    label: '人物拜访',
    description: '寻找当地人物，通过对话、协作和选择建立关系或获得情报。',
    progressKey: 'contacts',
    rewardKey: 'contact',
    stages: [
      { id: 'contact_find', label: '寻找人物', focus: '人物寻找', patterns: /船长|执事|向导|居民|守护者|导师|人物|寻找/ },
      { id: 'contact_dialogue', label: '对话交换', focus: '对话交换', patterns: /对话|拜访|交谈|询问|消息|情报|传承|讲述/ },
      { id: 'contact_choice', label: '人物选择', focus: '关系选择', patterns: /选择|协助|承诺|拒绝|合作|信任|试探/ },
      { id: 'contact_trust', label: '建立信任', focus: '关系确认', patterns: /信任|关系|盟友|线索|回信|后续|约定/ }
    ]
  }
})

// 保留旧调用方的默认四阶段导出。
export const LOCATION_EXPLORATION_STAGES = Object.freeze(LOCATION_EXPLORATION_MODES.local_exploration.stages)

export const LOCATION_EXPLORATION_STATUSES = Object.freeze({
  active: 'active',
  suspended: 'suspended',
  completed: 'completed',
  abandoned: 'abandoned'
})

export function locationExplorationMode(value) {
  return LOCATION_EXPLORATION_MODES[value] || LOCATION_EXPLORATION_MODES.local_exploration
}

export function explorationStageCount(value) {
  return locationExplorationMode(value).stages.length
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function list(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : []
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : [])]
}

function safeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(Number(value) || fallback))
}

export function normalizeLocationExplorationState(value) {
  if (!isRecord(value) || typeof value.locationId !== 'string' || !value.locationId) return null
  const queuedEventIds = uniqueStrings(value.queuedEventIds)
  const completedEventIds = uniqueStrings(value.completedEventIds)
  const objectiveType = locationExplorationMode(value.objectiveType).id
  const stageCount = explorationStageCount(objectiveType)
  const stage = Math.min(stageCount, safeInteger(value.stage))
  const rawStatus = typeof value.status === 'string' && Object.values(LOCATION_EXPLORATION_STATUSES).includes(value.status)
    ? value.status
    : value.active === true
      ? LOCATION_EXPLORATION_STATUSES.active
      : stage >= stageCount
        ? LOCATION_EXPLORATION_STATUSES.completed
        : LOCATION_EXPLORATION_STATUSES.suspended
  const status = stage >= stageCount && rawStatus === LOCATION_EXPLORATION_STATUSES.active
    ? LOCATION_EXPLORATION_STATUSES.completed
    : rawStatus
  const sourceEventIds = Array.isArray(value.sourceEventIds)
    ? value.sourceEventIds.map(item => typeof item === 'string' && item ? item : null).slice(0, queuedEventIds.length)
    : queuedEventIds.map(id => id.startsWith('location_') ? null : id)
  while (sourceEventIds.length < queuedEventIds.length) sourceEventIds.push(null)
  return {
    locationId: value.locationId,
    status,
    active: status === LOCATION_EXPLORATION_STATUSES.active && stage < stageCount,
    stage,
    queuedEventIds,
    sourceEventIds,
    completedEventIds,
    startedAtEventCount: safeInteger(value.startedAtEventCount),
    objectiveType,
    modeLabel: locationExplorationMode(objectiveType).label,
    completedAtEventCount: safeInteger(value.completedAtEventCount),
    abandonedAtEventCount: safeInteger(value.abandonedAtEventCount),
    suspendedAtLocationId: typeof value.suspendedAtLocationId === 'string' ? value.suspendedAtLocationId : '',
    lastUpdatedAtEventCount: safeInteger(value.lastUpdatedAtEventCount),
    lastSummary: typeof value.lastSummary === 'string' ? value.lastSummary : ''
  }
}

export function isLocationExplorationInProgress(value) {
  const state = normalizeLocationExplorationState(value)
  return Boolean(state && state.stage < state.queuedEventIds.length && (
    state.status === LOCATION_EXPLORATION_STATUSES.active ||
    state.status === LOCATION_EXPLORATION_STATUSES.suspended
  ))
}

/**
 * 将地点探索状态按地点归档。新存档使用该对象作为唯一事实来源；legacy
 * locationExploration 只作为旧版脚本和旧存档的兼容镜像保留。
 */
export function normalizeLocationExplorationsByLocation(value, legacyState = null) {
  const normalized = {}
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, candidate]) => {
      const state = normalizeLocationExplorationState(candidate)
      if (state) normalized[state.locationId || key] = state
    })
  }
  const legacy = normalizeLocationExplorationState(legacyState)
  if (legacy && !normalized[legacy.locationId]) normalized[legacy.locationId] = legacy
  return normalized
}

export function explorationProgress(value) {
  const state = normalizeLocationExplorationState(value)
  if (!state) return { completed: 0, total: 0, percent: 0 }
  const total = Math.max(state.queuedEventIds.length, explorationStageCount(state.objectiveType))
  const completed = Math.min(total, Math.max(state.completedEventIds.length, state.stage))
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0
  }
}

export function legacyLocationExplorationFromMap(value, preferredLocationId = '') {
  const states = Object.values(normalizeLocationExplorationsByLocation(value))
  if (!states.length) return null
  const preferred = states.find(state => state.locationId === preferredLocationId)
  if (preferred) return preferred
  const rank = {
    [LOCATION_EXPLORATION_STATUSES.active]: 0,
    [LOCATION_EXPLORATION_STATUSES.suspended]: 1,
    [LOCATION_EXPLORATION_STATUSES.completed]: 2,
    [LOCATION_EXPLORATION_STATUSES.abandoned]: 3
  }
  return [...states].sort((a, b) => {
    const statusDelta = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
    if (statusDelta) return statusDelta
    return (b.lastUpdatedAtEventCount || b.startedAtEventCount || 0) - (a.lastUpdatedAtEventCount || a.startedAtEventCount || 0)
  })[0]
}

function eventSearchText(event) {
  return [event?.id, event?.name, event?.location,
    ...(Array.isArray(event?.text) ? event.text : [event?.text]),
    ...(Array.isArray(event?.choices) ? event.choices.flatMap(choice => [choice?.text, choice?.result?.text]) : [])]
    .filter(Boolean)
    .join(' ')
}

function eventMatchesLocation(event, location, mapLocations) {
  if (!event?.location || !location?.id) return false
  const info = classifyEventLocation(event.location, mapLocations)
  return info.scope === 'mapped' && info.id === location.id
}

function phaseCompatible(event, level) {
  if (!event?.phase || event.phase === 'any') return true
  return event.phase === phaseForLevel(level)
}

function actionTypesFor(event) {
  if (Array.isArray(event?.locationActionTypes)) return event.locationActionTypes
  if (typeof event?.locationActionType === 'string' && event.locationActionType) return [event.locationActionType]
  return []
}

export function eligibleLocationEvents({
  events = [],
  location,
  mapLocations = [],
  player = {},
  eventStore = {},
  game = {},
  objectiveType = 'local_exploration'
} = {}) {
  const mode = locationExplorationMode(objectiveType)
  const level = Math.max(1, Number(player.level) || 1)
  const ringCount = Array.isArray(player.rings) ? player.rings.length : Number(player.ringCount) || 0
  // M2 性能：与随机事件池共用同一预构建索引，只遍历当前地点的候选桶。
  // eventMatchesLocation 只认 classify 命中本地点的事件，故桶 = byLocation[location.id]
  // 恰为其超集，后续过滤链与原实现逐位一致。
  const index = getEventIndex({ events, mapLocations, spiritMeta: player.spirit || {} })
  const source = []
  if (location?.id && index.byLocation.has(location.id)) {
    for (const id of index.byLocation.get(location.id)) {
      const event = index.adapted.get(id)
      if (event) source.push(event)
    }
  }
  return source
    .map(event => adaptEvent(event, { spiritMeta: player.spirit || {} }))
    .filter(event => event?.id && Array.isArray(event.choices) && event.choices.length)
    .filter(event => !event.ring && !event.ringOnly && !event.mainStoryOnly && !event._mainStory && !event.isMainStory)
    .filter(event => event.scope !== 'main' && event.source !== 'main-story')
    .filter(event => !event.choices.some(choice => choice?.result?.ring || choice?.result?.ringTier))
    .filter(event => {
      const types = actionTypesFor(event)
      return types.length === 0 || types.includes(mode.id)
    })
    .filter(event => eventMatchesLocation(event, location, mapLocations))
    .filter(event => phaseCompatible(event, level))
    .filter(event => isEventEligible(event, {
      level,
      phase: phaseForLevel(level),
      ringCount,
      spirit: player.spirit || {},
      doneEvents: eventStore.doneEvents || eventStore.completedEvents || [],
      recentEvents: eventStore._recentEvents || [],
      ascended: eventStore._dynamicFlags?._ascended === true,
      locationMatches: true,
      isMainStory: false,
      isRingHunt: false,
      storyMarks: Array.isArray(eventStore._storyMarks) ? eventStore._storyMarks : []
    }))
    .filter(event => !event.requiredEventIds?.some(id => !(eventStore.doneEvents || []).includes(id)))
    .filter(event => !(event.requiresAscension && eventStore._dynamicFlags?._ascended !== true))
    .filter(event => event.gameMode === undefined || event.gameMode === game.gameMode || event.gameMode === 'text-rpg')
    .filter(event => !(Array.isArray(eventStore._recentEvents) && eventStore._recentEvents.includes(event.id)))
    // 已经重温过一次的事件不再进入地点探索（一局最多两次），没有新事件时由模板事件补位
    .filter(event => !((Number(eventStore._eventRepeatCounts?.[event.id]) || 0) >= 1))
}

function rotationPool(events, recentEvents = [], completedEvents = []) {
  const source = [...new Map((Array.isArray(events) ? events : []).filter(Boolean).map(event => [event.id, event])).values()]
  if (!source.length) return []
  const completed = new Set(Array.isArray(completedEvents) ? completedEvents : [])
  const recent = Array.isArray(recentEvents) ? recentEvents : []
  const recentSet = new Set(recent)
  const unseen = source.filter(event => !completed.has(event.id) && !recentSet.has(event.id))
  if (unseen.length) return unseen
  const cooled = source.filter(event => !recentSet.has(event.id))
  // 当地的事件都刚经历过：返回空池，由模板事件补位，而不是马上重复刚看过的故事。
  return cooled
}

function stageCandidate(events, stage, usedIds) {
  const matching = events.filter(event => !usedIds.has(event.id) && stage.patterns.test(eventSearchText(event)))
  return matching[0] || events.find(event => !usedIds.has(event.id)) || null
}

function cycleKey(value) {
  const raw = String(value ?? '0').replace(/[^a-zA-Z0-9_-]/g, '_')
  return raw || '0'
}

export function buildLocationExplorationQueue({
  location,
  mapLocations = [],
  events = [],
  player = {},
  game = {},
  eventStore = {},
  objectiveType = 'local_exploration',
  cycle = eventStore?._eventCount || 0
} = {}) {
  if (!location?.id) return null
  const mode = locationExplorationMode(objectiveType)
  const eligible = eligibleLocationEvents({ events, location, mapLocations, player, eventStore, game, objectiveType: mode.id })
  const pool = rotationPool(eligible, eventStore._recentEvents, eventStore.doneEvents || eventStore.completedEvents)
  const used = new Set()
  const sourceEventIds = []
  const queuedEventIds = mode.stages.map((stage, index) => {
    const candidate = stageCandidate(pool, stage, used)
    if (candidate) used.add(candidate.id)
    sourceEventIds.push(candidate?.id || null)
    return `location_${location.id}_${mode.id}_${cycleKey(cycle)}_${stage.id}_${index + 1}`
  })
  return {
    locationId: location.id,
    status: LOCATION_EXPLORATION_STATUSES.active,
    active: true,
    stage: 0,
    queuedEventIds,
    sourceEventIds,
    completedEventIds: [],
    startedAtEventCount: safeInteger(eventStore._eventCount),
    objectiveType: mode.id,
    modeLabel: mode.label,
    completedAtEventCount: 0,
    abandonedAtEventCount: 0,
    suspendedAtLocationId: '',
    lastUpdatedAtEventCount: safeInteger(eventStore._eventCount),
    lastSummary: ''
  }
}

function activityAt(location, index) {
  const activities = list(location?.events)
  return activities[index % Math.max(1, activities.length)] || '调查当地线索'
}

function npcAt(location, index) {
  const npcs = list(location?.npcs)
  return npcs[index % Math.max(1, npcs.length)] || '当地向导'
}

// 没有专属事件时的模板事件。奖励按当前等级折算（约 10%~12% 一级），
// 文字按"小魂师亲身经历"来写，不出现"Lv.85 的某某让你判断出"这类程序拼接感。
function stageExp(level, ratio) {
  return Math.max(10, Math.round(experienceNeededForLevel(level) * ratio))
}

function modeChoices(mode, stage, location, player, activity, npc) {
  const level = Math.max(1, Number(player?.level) || 1)
  const name = location?.name || location?.id || '当地'
  if (mode.id === 'local_commission') {
    return [
      { text: `接下委托，去做「${activity}」`, result: { gold: 18 + level * 2, exp: stageExp(level, 0.1), text: `你按照${npc}说的路线，认认真真完成了「${activity}」。回来交差时，${npc}笑着说："交给你果然放心！"` } },
      { text: '先问清楚要注意什么', result: { gold: 8 + level, exp: stageExp(level, 0.12), text: `你把每个细节都问得清清楚楚，还记在了小本子上。${npc}夸你做事稳当，这一趟走得格外顺利。` } }
    ]
  }
  if (mode.id === 'local_contact') {
    return [
      { text: `向${npc}打个招呼，聊聊这里的事`, result: { fate: 1, exp: stageExp(level, 0.1), text: `${npc}很健谈，给你讲了好多${name}的趣事，还告诉你哪里最值得去看看。` } },
      { text: `主动帮${npc}一个忙`, result: { exp: stageExp(level, 0.12), fate: 1, text: `你用武魂帮${npc}解决了一个小麻烦。对方连声道谢，你们一下子熟络了起来。` } }
    ]
  }
  return [
    { text: `仔细看看${name}的${stage.focus}`, result: { exp: stageExp(level, 0.12), text: `你蹲下来仔细观察，发现了几处别人没注意到的痕迹，把它们一一记了下来。` } },
    { text: `跟着「${activity}」的方向走一走`, result: { exp: stageExp(level, 0.1), gold: 5 + level, text: `你沿着「${activity}」的方向慢慢走，一路上看到了不少新鲜事，还捡到了一点零碎的魂币。` } }
  ]
}

function fallbackText(mode, stage, name, geography, activity, npc, danger, spirit) {
  if (mode.id === 'local_commission') {
    return [
      `${npc}找到你，有一件事想拜托你：${stage.focus}。`,
      `${geography}`,
      `出发前，${npc}特别叮嘱你：${danger}`
    ]
  }
  if (mode.id === 'local_contact') {
    return [
      `你在${name}四处打听，终于找到了${npc}。`,
      `${npc}在这里生活了很多年，对${name}的一草一木都很熟悉。`,
      `你的${spirit}轻轻亮了一下，好像也对这次见面很期待。`
    ]
  }
  return [
    `你来到${name}，准备好好看看这里：先从${stage.focus}开始。`,
    `${geography}`,
    `听说${npc}最近在忙「${activity}」。你握紧拳头，给自己打了打气：${danger}`
  ]
}

/**
 * 生成地点行动事件。sourceEvent 只作为现有事件库的叙事种子，队列 ID、阶段
 * 和奖励仍由当前行动模式决定，因此三种按钮不会共享同一条队列。
 */
export function buildLocationExplorationEvent({
  location,
  stageIndex = 0,
  player = {},
  codex = null,
  eventId,
  objectiveType = 'local_exploration',
  sourceEvent = null
} = {}) {
  if (!location?.id) return null
  const mode = locationExplorationMode(objectiveType)
  const stage = mode.stages[Math.max(0, Math.min(mode.stages.length - 1, stageIndex))]
  const name = location.name || location.id
  const source = sourceEvent ? adaptEvent(sourceEvent, { spiritMeta: player.spirit || {} }) : null
  const activity = activityAt(location, stageIndex)
  const npc = npcAt(location, stageIndex)
  const geography = codex?.geography || location.description || '这里的地貌仍有许多未解之处。'
  const danger = list(location.specialConditions)[0] || '当地天气与魂兽活动会改变探索风险。'
  const spirit = player?.spirit?.name || player?.spiritName || '当前武魂'
  const level = Math.max(1, Number(player?.level) || 1)
  const sourceText = source
    ? [
      `${mode.label} · 第${mode.stages.indexOf(stage) + 1}步：${stage.label}`,
      ...(Array.isArray(source.text) ? source.text : [source.text]).filter(Boolean)
    ]
    : fallbackText(mode, stage, name, geography, activity, npc, danger, spirit)
  const choices = source?.choices?.length
    ? source.choices.map(choice => ({ ...choice, next: undefined }))
    : modeChoices(mode, stage, location, player, activity, npc)
  return {
    id: eventId || `location_${location.id}_${mode.id}_${stage.id}`,
    name: source ? `${name} · ${mode.label} · ${source.name}` : `${name} · ${mode.label} · ${stage.label}`,
    location: name,
    image: resolveAssetPath(source?.image || 'assets/scenes/forest_outer.jpg'),
    _locationId: location.id,
    _locationExploration: true,
    _templateEvent: !source,
    _locationSourceEventId: source?.id || null,
    objectiveType: mode.id,
    modeLabel: mode.label,
    modeDescription: mode.description,
    stageId: stage.id,
    stageLabel: stage.label,
    stageIndex,
    phase: phaseForLevel(level),
    minLevel: Math.max(1, Number(location.unlockedLevel) || 1),
    unique: true,
    weight: 1,
    text: sourceText,
    choices
  }
}

export function isLocationExplorationEvent(event) {
  return Boolean(event?._locationExploration && event._locationId)
}

export function explorationLocationFromState(state, locations = []) {
  const normalized = normalizeLocationExplorationState(state)
  if (!normalized) return null
  return locations.find(location => location?.id === normalized.locationId) || null
}
