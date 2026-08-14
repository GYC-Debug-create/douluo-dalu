import { buildRingObjective, ringDestination } from './ring-hunt.js'
import {
  explorationProgress,
  isLocationExplorationInProgress,
  LOCATION_EXPLORATION_STATUSES,
  normalizeLocationExplorationState,
  normalizeLocationExplorationsByLocation
} from './location-exploration.js'
import { appendDiaryEntry } from '../engine/save.js'

const FRAME_ROUTES = Object.freeze({
  game: '/game',
  map: '/map',
  codex: '/codex'
})

const LOCATION_ALIASES = Object.freeze({
  slk_academy: 'shrek_academy',
  '史莱克学院': 'shrek_academy',
  '星斗大森林': 'star_duo_outer',
  '星斗大森林外围': 'star_duo_outer',
  '星斗大森林·外围': 'star_duo_outer',
  '星斗大森林深处': 'star_duo_deep',
  '星斗大森林·深处': 'star_duo_deep',
  '武魂城': 'wuhun_city',
  '武魂殿': 'spirit_hall',
  '天斗城': 'tian_dou_city',
  '东海港口': 'east_sea_port',
  '东海港': 'east_sea_port',
  '落日森林': 'sunset_forest',
  '海神岛': 'sea_god_island',
  '冰封森林': 'ice_forest',
  '杀戮之都': 'slaughter_city',
  '远古遗迹': 'ancient_ruins',
  '深渊裂缝': 'abyss_rift',
  '龙之谷': 'dragon_valley',
  '灵药谷': 'medicine_valley',
  '暗影沼泽': 'shadow_swamp',
  '元素峡谷': 'element_valley',
  '死亡沙漠': 'desert_death',
  '邪魔森林': 'evil_forest',
  '钢铁之城': 'steel_city',
  '天空之城': 'sky_city',
  '圣魂村': 'holy_soul_village',
  '昊天宗': 'haotian_sect',
  '七宝琉璃宗': 'seven_treasure_glaze',
  '力之一族领地': 'strength_clan',
  '敏之一族领地': 'speed_clan',
  '御之一族领地': 'defense_clan',
  '破之一族领地': 'breaking_clan'
})

const HIDDEN_LOCATIONS = Object.freeze([
  {
    id: 'secret_cave',
    name: '隐秘洞窟',
    desc: '在星斗大森林深处发现的一个隐秘洞窟，传说其中藏有上古遗宝',
    clue: '传闻星斗大森林外围有一处被藤蔓掩盖的洞窟，实力与足迹缺一不可。',
    requirements: [
      { type: 'level', target: 15 },
      { type: 'visited', id: 'star_duo_outer', label: '探索星斗大森林外围' }
    ],
    canReveal: ({ level, visited }) => level >= 15 && visited.has('star_duo_outer')
  },
  {
    id: 'ancient_altar',
    name: '远古祭坛',
    desc: '远古遗迹中隐藏的祭坛，似乎与神界有着某种联系',
    clue: '远古遗迹中流传着祭坛的传说，强者或许能在断壁间找到一条密道。',
    requirements: [
      { type: 'level', target: 25 },
      { type: 'visited', id: 'ancient_ruins', label: '探索远古遗迹' }
    ],
    canReveal: ({ level, visited }) => level >= 25 && visited.has('ancient_ruins')
  },
  {
    id: 'dragon_nest',
    name: '龙巢遗迹',
    desc: '龙之谷最深处的龙巢，据说沉睡着上古龙族的宝藏',
    clue: '龙之谷的猎人偶尔谈起谷底残迹，只有足够强大的魂师才能抵达。',
    requirements: [
      { type: 'level', target: 35 },
      { type: 'visited', id: 'dragon_valley', label: '探索龙之谷' }
    ],
    canReveal: ({ level, visited }) => level >= 35 && visited.has('dragon_valley')
  },
  {
    id: 'abyss_rift',
    name: '深渊裂缝',
    desc: '大地上裂开的一道深渊裂缝，从中涌出令人不安的气息',
    clue: '不安的气息正在大陆边缘扩散，唯有顶尖魂师能在威胁平息前靠近。',
    requirements: [
      { type: 'level', target: 45 },
      { type: 'threat-active', label: '最终威胁仍未平息' }
    ],
    canReveal: ({ level, dynamicFlags }) => level >= 45 && dynamicFlags._bossKilled !== true
  },
  {
    id: 'fairy_pool',
    name: '仙灵之池',
    desc: '只有与足够多的人建立羁绊后才能发现的仙灵之池',
    clue: '山民说，清晨的雾中藏着一汪灵池，它只向拥有足够羁绊的旅人显现。',
    requirements: [
      { type: 'level', target: 20 },
      { type: 'relations', target: 3 }
    ],
    canReveal: ({ level, npcRelations }) => level >= 20 && Object.keys(npcRelations).length >= 3
  },
  {
    id: 'star_fall',
    name: '陨星之地',
    desc: '在暴风雨中发现的陨星坠落之地，蕴含星辰之力',
    clue: '暴风雨之夜有人看见流星坠向远方，亲历过风暴的强者或能追到落点。',
    requirements: [
      { type: 'level', target: 30 },
      { type: 'storm', label: '经历一次暴风雨旅行奇遇' }
    ],
    canReveal: ({ level, dynamicFlags }) => level >= 30 && dynamicFlags._stormAdventure === true
  }
])

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizedText(value) {
  return String(value || '').replace(/[·・\s]/g, '')
}

function soulRankName(level) {
  if (level < 10) return '魂士'
  if (level < 20) return '魂师'
  if (level < 30) return '大魂师'
  if (level < 40) return '魂尊'
  if (level < 50) return '魂宗'
  if (level < 60) return '魂王'
  if (level < 70) return '魂帝'
  if (level < 80) return '魂圣'
  if (level < 90) return '魂斗罗'
  if (level < 100) return '封号斗罗'
  return '神级魂师'
}

function phaseName(level) {
  const book = level <= 6 ? '学院篇' : level <= 18 ? '实战篇' : level <= 40 ? '进阶篇' : '神途篇'
  return `${book} · ${soulRankName(level)}`
}

function addDiaryEntry(eventStore, player, text, type = 'event') {
  if (!Array.isArray(eventStore._diary)) eventStore._diary = []
  appendDiaryEntry(eventStore._diary, {
    turn: Number(eventStore._eventCount) || 0,
    level: Number(player.level) || 1,
    phase: phaseName(Number(player.level) || 1),
    text,
    type,
    time: Date.now()
  })
}

function normalizeHiddenLocation(entry) {
  if (typeof entry === 'string') return { id: entry, name: entry, desc: '' }
  if (!isRecord(entry) || typeof entry.id !== 'string') return null
  return {
    id: entry.id,
    name: typeof entry.name === 'string' ? entry.name : entry.id,
    desc: typeof entry.desc === 'string' ? entry.desc : ''
  }
}

function revealHiddenLocations({ player, game, eventStore, visited }) {
  const discovered = Array.isArray(game._discoveredHidden)
    ? game._discoveredHidden.map(normalizeHiddenLocation).filter(Boolean)
    : []
  const knownIds = new Set(discovered.map(location => location.id))
  const dynamicFlags = isRecord(eventStore._dynamicFlags) ? eventStore._dynamicFlags : {}
  const context = {
    level: Number(player.level) || 1,
    visited,
    npcRelations: isRecord(game._npcRelations) ? game._npcRelations : {},
    dynamicFlags
  }
  const revealed = []

  for (const hidden of HIDDEN_LOCATIONS) {
    if (knownIds.has(hidden.id) || !hidden.canReveal(context)) continue
    const location = { id: hidden.id, name: hidden.name, desc: hidden.desc }
    discovered.push(location)
    knownIds.add(hidden.id)
    revealed.push(location)
    addDiaryEntry(eventStore, player, `发现了隐藏地点「${hidden.name}」——${hidden.desc}。`, 'discovery')
  }

  game._discoveredHidden = discovered
  return revealed
}

function hiddenClueContext(locations, player, game, eventStore) {
  return {
    level: Math.max(1, Number(player?.level) || 1),
    visited: visitedMapIds(locations, game || {}),
    npcRelations: isRecord(game?._npcRelations) ? game._npcRelations : {},
    dynamicFlags: isRecord(eventStore?._dynamicFlags) ? eventStore._dynamicFlags : {}
  }
}

function hiddenRequirementProgress(requirement, context) {
  if (requirement.type === 'level') {
    const current = Math.min(context.level, requirement.target)
    return {
      label: `魂力等级 Lv.${context.level} / Lv.${requirement.target}`,
      current,
      target: requirement.target,
      done: context.level >= requirement.target,
      nextStep: `继续历练至 Lv.${requirement.target}`
    }
  }
  if (requirement.type === 'visited') {
    const done = context.visited.has(requirement.id)
    return { label: requirement.label, current: done ? 1 : 0, target: 1, done, nextStep: `前往${requirement.label.replace(/^探索/, '')}探索` }
  }
  if (requirement.type === 'relations') {
    const relationCount = Object.keys(context.npcRelations).length
    return {
      label: `人物羁绊 ${Math.min(relationCount, requirement.target)} / ${requirement.target}`,
      current: Math.min(relationCount, requirement.target),
      target: requirement.target,
      done: relationCount >= requirement.target,
      nextStep: `与至少 ${requirement.target} 位人物建立羁绊`
    }
  }
  if (requirement.type === 'storm') {
    const done = context.dynamicFlags._stormAdventure === true
    return { label: requirement.label, current: done ? 1 : 0, target: 1, done, nextStep: '在暴风雨天气中继续旅行探索' }
  }
  if (requirement.type === 'threat-active') {
    const done = context.dynamicFlags._bossKilled !== true
    return { label: requirement.label, current: done ? 1 : 0, target: 1, done, nextStep: '这则传闻已随最终威胁消散' }
  }
  return { label: '追查未知线索', current: 0, target: 1, done: false, nextStep: '继续旅行并留意沿途见闻' }
}

export function buildHiddenLocationClues(locations, player, game, eventStore = {}) {
  const context = hiddenClueContext(locations, player, game, eventStore)
  const discoveredIds = new Set((Array.isArray(game?._discoveredHidden) ? game._discoveredHidden : [])
    .map(normalizeHiddenLocation)
    .filter(Boolean)
    .map(location => location.id))

  return HIDDEN_LOCATIONS.map(hidden => {
    const progress = hidden.requirements.map(requirement => hiddenRequirementProgress(requirement, context))
    const discovered = discoveredIds.has(hidden.id)
    const ready = hidden.canReveal(context)
    const completed = progress.filter(item => item.done).length
    const firstMissing = progress.find(item => !item.done)
    return {
      id: hidden.id,
      name: hidden.name,
      clue: hidden.clue,
      discovered,
      status: discovered ? 'discovered' : ready ? 'ready' : completed > 0 ? 'near' : 'locked',
      statusLabel: discovered ? '已发现' : ready ? '线索齐备' : completed > 0 ? '追查中' : '线索不足',
      progress,
      nextStep: discovered
        ? '秘境已经标记在地图上'
        : firstMissing?.nextStep || '条件已具备，进行一次地图旅行以追查传闻'
    }
  })
}

export function isTrustedFrameMessage(event, frameElement) {
  if (!event || !isRecord(event.data)) return false
  if (!frameElement || !frameElement.contentWindow) return false
  if (event.origin !== window.location.origin) return false
  return event.source === frameElement.contentWindow
}

export function routeForFrameView(view, allowedViews) {
  if (typeof view !== 'string' || !allowedViews.includes(view)) return null
  return FRAME_ROUTES[view] || null
}

export async function loadMapLocations(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.locations)) {
    throw new Error('地图数据结构无效')
  }

  const locations = payload.locations
    .filter(location => isRecord(location) && typeof location.id === 'string' && location.id)
    .map(location => ({
      ...location,
      name: typeof location.name === 'string' ? location.name : location.id,
      unlockedLevel: Math.max(1, Number(location.unlockedLevel) || 1),
      travelTime: Math.max(0, Number(location.travelTime) || 0),
      mapX: Math.min(96, Math.max(4, Number(location.mapX) || 50)),
      mapY: Math.min(94, Math.max(6, Number(location.mapY) || 50)),
      landmarkType: typeof location.landmarkType === 'string' && location.landmarkType
        ? location.landmarkType
        : 'site',
      labelPosition: ['above', 'below', 'left', 'right'].includes(location.labelPosition)
        ? location.labelPosition
        : 'below',
      connectedTo: Array.isArray(location.connectedTo)
        ? location.connectedTo.filter(id => typeof id === 'string')
        : []
    }))

  if (!locations.length) throw new Error('地图没有可用地点')
  return locations
}

export function resolveMapLocation(locations, value) {
  if (!Array.isArray(locations) || value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  const alias = LOCATION_ALIASES[raw]
  const canonical = alias || raw
  const exact = locations.find(location => location.id === canonical || location.name === raw)
  if (exact) return exact

  const normalizedRaw = normalizedText(raw)
  return locations.find(location => {
    const normalizedName = normalizedText(location.name)
    return normalizedName && (normalizedRaw.includes(normalizedName) || normalizedName.includes(normalizedRaw))
  }) || null
}

export function visitedMapIds(locations, game) {
  const ids = new Set()
  for (const value of Array.isArray(game._visitedLocations) ? game._visitedLocations : []) {
    const location = resolveMapLocation(locations, value)
    if (location) ids.add(location.id)
  }
  const current = resolveMapLocation(locations, game._currentLocation)
  if (current) ids.add(current.id)
  return ids
}

/**
 * 按地图 connectedTo 计算无权最短路线。连接关系按无向边处理，兼容旧数据中
 * 偶尔只维护一侧的情况；返回 canonical id，便于地图和任务状态直接复用。
 */
export function findShortestRoute(locations, startValue, targetValue) {
  if (!Array.isArray(locations) || !locations.length) return []
  const start = resolveMapLocation(locations, startValue)
  const target = resolveMapLocation(locations, targetValue)
  if (!start || !target) return []
  if (start.id === target.id) return [start.id]

  const byId = new Map(locations.map(location => [location.id, location]))
  const neighbors = location => {
    const ids = new Set(Array.isArray(location?.connectedTo) ? location.connectedTo : [])
    for (const candidate of locations) {
      if (Array.isArray(candidate.connectedTo) && candidate.connectedTo.includes(location.id)) ids.add(candidate.id)
    }
    return [...ids].filter(id => byId.has(id))
  }
  const queue = [start.id]
  const previous = new Map([[start.id, null]])
  while (queue.length) {
    const currentId = queue.shift()
    for (const neighborId of neighbors(byId.get(currentId))) {
      if (previous.has(neighborId)) continue
      previous.set(neighborId, currentId)
      if (neighborId === target.id) {
        const path = []
        let cursor = neighborId
        while (cursor) {
          path.unshift(cursor)
          cursor = previous.get(cursor)
        }
        return path
      }
      queue.push(neighborId)
    }
  }
  return []
}

export function travelCost(location, fast = false) {
  if (!location) return 0
  const base = Math.max(5, Math.round((Number(location.travelTime) || 15) / 3))
  return fast ? base * 2 : base
}

export function travelDays(location, fast = false) {
  const base = Math.max(1, Math.round((Number(location?.travelTime) || 15) / 3))
  return fast ? Math.max(1, Math.ceil(base / 2)) : base
}

function firstMatchingActivity(activities, patterns) {
  return activities.find(activity => patterns.some(pattern => pattern.test(activity))) || null
}

/**
 * 为地图详情与抵达反馈生成同一份目的地行动计划。
 * 这里只解释已有地点数据和角色状态，不修改事件池、掉落或世界规则。
 */
export function buildDestinationPlan(location, player = {}, game = {}, eventStore = {}, visited = false) {
  const activities = Array.isArray(location?.events)
    ? location.events.filter(item => typeof item === 'string' && item.trim()).slice(0, 8)
    : []
  const contacts = Array.isArray(location?.npcs)
    ? location.npcs.filter(item => typeof item === 'string' && item.trim()).slice(0, 8)
    : []
  const spiritName = String(player?.spirit?.name || player?.spiritName || '当前武魂')
  const spiritType = String(player?.spirit?.type || player?.spiritType || '')
  const combatSpirit = /强攻|敏攻|防御|武器|兽武魂|神器|神兽/.test(spiritType)
  const supportSpirit = /辅助|控制|植物|生活|治愈/.test(spiritType)
  const preferred = combatSpirit
    ? firstMatchingActivity(activities, [/狩猎|魂兽|竞技|考核|BOSS|战|任务/])
    : supportSpirit
      ? firstMatchingActivity(activities, [/采集|药草|修炼|教学|社交|探索|奇遇/])
      : null
  const activity = preferred || activities[0] || '调查当地线索'
  const ringLevel = Math.max(0, Number(eventStore?.pendingRingLv) || 0)
  const supportsRingHunt = activities.some(item => /狩猎|魂兽/.test(item))
  const ringTarget = ringDestination(ringLevel)
  const objective = ringLevel >= 80 && ringTarget?.id === location?.id
    ? `第${Math.round(ringLevel / 10)}魂环目标：抵达后执行正式猎环（魂环线索）`
    : ringLevel > 0 && supportsRingHunt
      ? `追踪 Lv.${ringLevel} 魂环线索`
      : visited
        ? `重访并深入「${activity}」`
        : `初探并尝试「${activity}」`

  const met = new Set(Array.isArray(game?._metNpcs) ? game._metNpcs.map(String) : [])
  const relations = isRecord(game?._npcRelations) ? Object.keys(game._npcRelations) : []
  const knownContact = contacts.find(name => met.has(name) || relations.some(key => key === name || key.includes(name)))
  const contact = knownContact
    ? `拜访已结识的「${knownContact}」`
    : contacts[0]
      ? `打听「${contacts[0]}」的消息`
      : '从当地见闻中寻找新线索'

  const level = Math.max(1, Number(player?.level) || 1)
  const unlockedLevel = Math.max(1, Number(location?.unlockedLevel) || 1)
  const margin = level - unlockedLevel
  const risk = margin <= 1 ? '挑战较高' : margin <= 8 ? '实力相当' : '从容探索'

  return {
    primary: objective,
    activity,
    activities,
    npcs: contacts,
    contact,
    fit: `${spiritName} · ${preferred ? `适合「${activity}」` : '暂无特殊适配'}`,
    risk,
    visit: visited ? '重访' : '初次探索'
  }
}

export function buildMapState(locations, player, game, eventStore = {}) {
  const visited = visitedMapIds(locations, game)
  const current = resolveMapLocation(locations, game._currentLocation)
  const explorationsByLocation = normalizeLocationExplorationsByLocation(
    eventStore?.locationExplorationsByLocation,
    eventStore?.locationExploration
  )
  const ringObjective = buildRingObjective({
    pendingRingLv: eventStore?.pendingRingLv,
    ringCount: Array.isArray(player?.rings) ? player.rings.length : 0,
    playerLevel: player?.level,
    currentLocation: current?.id || game?._currentLocation || '',
    eventCount: eventStore?._eventCount,
    deferredUntil: eventStore?._ringHuntDeferredUntil
  })
  const objectiveTarget = ringObjective?.destination
    ? resolveMapLocation(locations, ringObjective.destination.id)
    : null
  const routeIds = objectiveTarget && current
    ? findShortestRoute(locations, current.id, objectiveTarget.id)
    : []
  const nextHopId = routeIds.length > 1 ? routeIds[1] : null
  const objective = ringObjective && objectiveTarget
    ? {
        ...ringObjective,
        objectiveType: 'ring_hunt',
        objectiveLevel: ringObjective.requiredLevel,
        objectiveLocationId: objectiveTarget.id,
        objectiveLocationName: objectiveTarget.name,
        routeIds,
        nextHopId,
        remainingStops: routeIds.length > 1 ? routeIds.slice(1) : []
      }
    : null
  return {
    type: 'map-state',
    currentId: current ? current.id : '',
    visitedIds: [...visited],
    level: Number(player.level) || 1,
    gold: Math.max(0, Number(player.gold) || 0),
    objective,
    objectiveType: objective?.objectiveType || null,
    objectiveLevel: objective?.objectiveLevel || null,
    objectiveLocationId: objective?.objectiveLocationId || null,
    objectiveLocationName: objective?.objectiveLocationName || null,
    routeIds,
    nextHopId,
    remainingStops: objective?.remainingStops || [],
    locations: locations.map(location => {
      const wasVisited = visited.has(location.id)
      const routeIndex = routeIds.indexOf(location.id)
      const onObjectiveRoute = routeIndex >= 0
      const isObjectiveTarget = Boolean(objective && objective.objectiveLocationId === location.id)
      const exploration = explorationsByLocation[location.id] || null
      const explorationState = normalizeLocationExplorationState(exploration)
      const explorationSummary = explorationProgress(explorationState)
      return {
        id: location.id,
        name: location.name,
        description: location.description || '',
        region: location.region || '',
        activities: Array.isArray(location.events) ? location.events.slice(0, 8) : [],
        npcs: Array.isArray(location.npcs) ? location.npcs.slice(0, 8) : [],
        specialConditions: Array.isArray(location.specialConditions) ? location.specialConditions.slice(0, 4) : [],
        connectedTo: Array.isArray(location.connectedTo) ? location.connectedTo.slice() : [],
        mapX: Math.min(96, Math.max(4, Number(location.mapX) || 50)),
        mapY: Math.min(94, Math.max(6, Number(location.mapY) || 50)),
        landmarkType: location.landmarkType || 'site',
        labelPosition: location.labelPosition || 'below',
        unlockedLevel: location.unlockedLevel,
        visited: wasVisited,
        current: Boolean(current && current.id === location.id),
        adjacent: Boolean(current && (
          current.connectedTo.includes(location.id) || location.connectedTo.includes(current.id)
        )),
        normalCost: travelCost(location, false),
        fastCost: travelCost(location, true),
        normalDays: travelDays(location, false),
        fastDays: travelDays(location, true),
        normalEncounterPercent: 32,
        fastEncounterPercent: 8,
        known: Boolean((current && current.id === location.id) || wasVisited || onObjectiveRoute || isObjectiveTarget || (
          current && (current.connectedTo.includes(location.id) || location.connectedTo.includes(current.id))
        )),
        objective: isObjectiveTarget,
        recommended: Boolean(objective && (onObjectiveRoute || location.id === objective.nextHopId)),
        routeIndex,
        nextHop: Boolean(objective && location.id === objective.nextHopId),
        destinationPlan: buildDestinationPlan(location, player, game, eventStore, wasVisited),
        explorationStatus: explorationState?.status || 'none',
        explorationActive: Boolean(explorationState && explorationState.status === LOCATION_EXPLORATION_STATUSES.active),
        explorationInProgress: isLocationExplorationInProgress(explorationState),
        explorationModeLabel: explorationState?.modeLabel || '',
        explorationCompletedStages: explorationSummary.completed,
        explorationStageCount: explorationSummary.total
      }
    }),
    discoveredHidden: (Array.isArray(game._discoveredHidden) ? game._discoveredHidden : [])
      .map(normalizeHiddenLocation)
      .filter(Boolean),
    hiddenClues: buildHiddenLocationClues(locations, player, game, eventStore)
  }
}

export function performMapTravel({ locations, locationId, fast, player, game, eventStore }) {
  if (!player || !player.name || !player.spirit) {
    return { ok: false, message: '请先创建或读取角色后再旅行' }
  }
  if (typeof locationId !== 'string' || !locationId || locationId.length > 100) {
    return { ok: false, message: '无法定位该地点' }
  }

  const target = resolveMapLocation(locations, locationId)
  const current = resolveMapLocation(locations, game._currentLocation) || resolveMapLocation(locations, 'shrek_academy')
  if (!target) return { ok: false, message: '无法定位该地点' }

  const level = Number(player.level) || 1
  if (target.unlockedLevel && level < target.unlockedLevel) {
    return { ok: false, message: `需要达到 Lv.${target.unlockedLevel} 才能前往` }
  }
  if (current && target.id === current.id) {
    return { ok: false, message: '你已经在这里了' }
  }

  const visited = visitedMapIds(locations, game)
  const isVisited = visited.has(target.id)
  const connected = !current || current.connectedTo.includes(target.id) || target.connectedTo.includes(current.id)
  if (!isVisited && !connected) {
    return { ok: false, message: '只能先探索与当前位置相邻的地点' }
  }

  const useFast = fast === true && isVisited
  const cost = travelCost(target, useFast)
  const gold = Math.max(0, Number(player.gold) || 0)
  if (gold < cost) {
    return { ok: false, message: `旅行需要 ${cost} 金币，当前金币不足` }
  }

  // 离开当前地点时只暂停该地点的进行中队列。其它地点的队列继续保留，
  // 抵达新地点后仍可正常开启当地行动，不再由单一全局状态锁死入口。
  const explorationsByLocation = normalizeLocationExplorationsByLocation(
    eventStore?.locationExplorationsByLocation,
    eventStore?.locationExploration
  )
  const currentExploration = current ? explorationsByLocation[current.id] : null
  if (currentExploration &&
      isLocationExplorationInProgress(currentExploration) &&
      currentExploration.status === LOCATION_EXPLORATION_STATUSES.active) {
    currentExploration.status = LOCATION_EXPLORATION_STATUSES.suspended
    currentExploration.active = false
    currentExploration.suspendedAtLocationId = current?.id || ''
    currentExploration.lastUpdatedAtEventCount = Math.max(0, Number(eventStore?._eventCount) || 0)
  }
  eventStore.locationExplorationsByLocation = explorationsByLocation
  if (currentExploration && isLocationExplorationInProgress(currentExploration)) {
    eventStore.locationExploration = explorationsByLocation[currentExploration.locationId]
  }

  player.gold = gold - cost
  if (typeof game.setLocation === 'function') game.setLocation(target.id)
  else {
    if (!Array.isArray(game._visitedLocations)) game._visitedLocations = []
    if (!game._visitedLocations.includes(target.id)) game._visitedLocations.push(target.id)
    game._currentLocation = target.id
  }

  eventStore._eventCount = (Number(eventStore._eventCount) || 0) + 1
  if (typeof game.advanceTime === 'function') game.advanceTime()
  else game._gameTime = (Number(game._gameTime) || 0) + 1

  if (Math.random() < 0.3) game._weather = Math.floor(Math.random() * 6)
  if (!isRecord(eventStore._dynamicFlags)) eventStore._dynamicFlags = {}
  if ((Number(game._weather) || 0) % 6 === 3) eventStore._dynamicFlags._stormAdventure = true
  if ((Number(game._gameTime) || 0) % 4 === 3 && eventStore._dynamicFlags._nightTraining === undefined) {
    eventStore._dynamicFlags._nightTraining = false
  }

  if (isRecord(eventStore._dynCooldowns)) {
    for (const id of Object.keys(eventStore._dynCooldowns)) {
      const cooldown = Number(eventStore._dynCooldowns[id]) || 0
      if (cooldown > 0) eventStore._dynCooldowns[id] = cooldown - 1
    }
  }

  const updatedVisited = visitedMapIds(locations, game)
  addDiaryEntry(
    eventStore,
    player,
    `从「${current ? current.name : '旅途'}」前往「${target.name}」，花费${cost}金币。`,
    'discovery'
  )
  const revealed = revealHiddenLocations({ player, game, eventStore, visited: updatedVisited })

  return {
    ok: true,
    target,
    current,
    cost,
    useFast,
    travelDays: travelDays(target, useFast),
    encounterRate: useFast ? 0.08 : 0.32,
    destinationPlan: buildDestinationPlan(target, player, game, eventStore, isVisited),
    revealed
  }
}
