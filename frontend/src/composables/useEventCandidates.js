/**
 * 事件候选与上下文层
 *
 * 从 useEventEngine.js 拆出"下一个事件从哪里来"：
 * 运行时上下文快照、触发条件判定、候选池收集、亲和加权、洗牌袋抽取、
 * 动态/连锁事件检查。计算委托 engine/event-draw.js 与 engine/event-rules.js。
 */
import { buildGProxy } from '@/stores/g-proxy'
import { classifyEventLocation, phaseForLevel, GLOBAL_LOCATION_PREFIX, seasonForGameTime } from '@/engine/rules'
import { getSpiritBonus as getTraitSpiritBonus } from '@/engine/traits'
import { cooldownSafeEventPool, eventMatchBonus as matchBonusFor, drawFromBagPure } from '@/engine/event-draw'
import { adaptEvent, isEventEligible } from '@/engine/event-rules'
import { getEventIndex } from '@/engine/event-index'

/**
 * @param {object} deps {
 *   player, eventStore, gameStore, combatStore, data,
 *   EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS,
 *   battleSystem, finalStats
 * }
 */
export function useEventCandidates(deps) {
  const {
    player, eventStore, gameStore, combatStore, data,
    EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS,
    battleSystem, finalStats
  } = deps

  // M2 性能：cond/effect/结局判定共享同一个 G 代理（原实现每次新建 Proxy）。
  // 实例级单例：每个引擎实例绑定其创建时的 Pinia，避免跨实例/测试污染。
  let sharedG = null
  function createGProxy() {
    if (!sharedG) sharedG = buildGProxy()
    return sharedG
  }

  function currentPhase() {
    return phaseForLevel(player.level)
  }

  function eventContext(overrides = {}) {
    const level = Number(player.level) || 1
    const gameTime = Number(gameStore._gameTime) || 0
    const timeOfDay = ['dawn', 'day', 'day', 'day', 'dusk', 'night', 'night', 'night'][gameTime % 8]
    // 季节：每 8 次行动是一天（时段循环），每 4 天换一个季节。
    // 原来每次行动就换一季，等于一天之内过完四季。
    const season = seasonForGameTime(gameTime)
    return {
      level,
      origin: player.origin || '',
      phase: currentPhase(),
      ringCount: player.rings?.length || 0,
      spirit: player.spirit || {},
      doneEvents: eventStore.doneEvents || [],
      recentEvents: eventStore._recentEvents || [],
      ascended: eventStore._dynamicFlags?._ascended === true,
      combo: Number(battleSystem.combo?.value) || Number(combatStore._maxCombo) || 0,
      timeOfDay,
      season,
      // 世界账本：支线按"认识了谁、故事走到哪一步"过滤（engine/story-marks.js）
      storyMarks: Array.isArray(eventStore._storyMarks) ? eventStore._storyMarks : [],
      ...overrides
    }
  }

  function checkCond(cond) {
    if (!cond) return true
    if (typeof cond === 'function') {
      try {
        const G = createGProxy()
        return Boolean(cond(G))
      } catch { return false }
    }
    const fs = finalStats()
    if (cond.attack && fs.attack < cond.attack) return false
    if (cond.defense && fs.defense < cond.defense) return false
    if (cond.speed && fs.speed < cond.speed) return false
    if (cond.level && player.level < cond.level) return false
    if (cond.gold && player.gold < cond.gold) return false
    if (cond.fate && player.fatePoints < cond.fate) return false
    if (cond.item) {
      const required = Math.max(1, Number(cond.itemCount) || 1)
      const it = player.inventory?.find(x => x.name === cond.item && Number(x.count) >= required)
      if (!it) return false
    }
    return true
  }

  function eventMatchesCurrentLocation(ev) {
    const currentLoc = player._currentLocation || gameStore._currentLocation || ''
    if (!ev.location) return true
    // 全局事件（正则单一来源 engine/rules.js，勿手抄）
    if (GLOBAL_LOCATION_PREFIX.test(ev.location)) return true
    // 简单匹配：事件地点包含当前地点名或反之
    if (currentLoc && ev.location.includes(currentLoc)) return true
    if (currentLoc && currentLoc.includes(ev.location)) return true
    // 通过 classifyEventLocation 判断
    const info = classifyEventLocation(ev.location, data.value.mapData)
    if (info.scope === 'global') return true
    // "学院·食堂""宿舍"这类没写明是哪所学院的校园事件，发生在玩家当前就读的学院：
    // 入学史莱克之前是诺丁学院，之后是史莱克学院。
    if (info.scope === 'mapped' && info.id === 'shrek_academy' && !String(ev.location).includes('史莱克')) {
      const joinedShrek = Array.isArray(eventStore._storyMarks) && eventStore._storyMarks.includes('joined_shrek')
      return currentLoc === (joinedShrek ? 'shrek_academy' : 'nuoding_city')
    }
    return info.scope === 'mapped' && info.id === currentLoc
  }

  function availableEvents() {
    // M2 性能：基于预构建索引取候选（phase 桶 ∪ any 桶 ∪ 全局 ∪ 当前地点桶），
    // 再交给 isEventEligible 全量判定——结果与原全量遍历逐位一致（桶是超集）。
    const index = getEventIndex({
      events: EVENTS,
      mapLocations: data.value.mapData,
      spiritMeta: player.spirit || {}
    })
    const phase = currentPhase()
    const currentLoc = player._currentLocation || gameStore._currentLocation || ''
    const candidates = new Set(index.global)
    for (const id of index.byPhase.get(phase) || []) candidates.add(id)
    for (const id of index.byPhase.get('any') || []) candidates.add(id)
    if (currentLoc && index.byLocation.has(currentLoc)) {
      for (const id of index.byLocation.get(currentLoc)) candidates.add(id)
    }
    const pool = []
    const repeats = eventStore._eventRepeatCounts || {}
    for (const id of candidates) {
      const event = index.adapted.get(id)
      if (!event) continue
      // 已经重温过一次的普通事件不再出现（一局最多两次）
      if ((Number(repeats[id]) || 0) >= 1) continue
      if (isEventEligible(event, eventContext({
        isMainStory: false,
        isRingHunt: false,
        locationMatches: eventMatchesCurrentLocation(event)
      }))) pool.push(event)
    }
    return pool
  }

  function eventMatchBonus(ev) {
    return matchBonusFor(ev, {
      personality: player._personality,
      destiny: player._destiny,
      origin: player.origin,
      spiritType: player.spirit?.type
    })
  }

  function recentCooldown(pool) {
    return cooldownSafeEventPool(pool, eventStore._recentEvents, eventStore.doneEvents)
  }

  // 洗牌袋无放回抽取（经济规格 v2）：候选按权重洗成队列后逐个弹出，耗尽才重洗。
  // 队列随存档持久化；地点或阶段变化时键控失效重建。近期记录仍由 recentCooldown 前置排除。
  function drawFromBag(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null
    if (!Array.isArray(eventStore._drawQueue)) eventStore._drawQueue = []
    const key = `${gameStore._currentLocation || ''}|${currentPhase()}`
    const drawn = drawFromBagPure(
      candidates,
      { queue: eventStore._drawQueue, key: eventStore._drawQueueKey },
      key,
      e => Math.max(1, (e.weight || 1) + eventMatchBonus(e))
    )
    if (!drawn) return null
    eventStore._drawQueue = drawn.queue
    eventStore._drawQueueKey = drawn.key
    return candidates.find(e => e.id === drawn.id) || null
  }

  function checkDynamicEvents(context = eventContext()) {
    const G = createGProxy()
    for (const ev of DYNAMIC_EVENTS) {
      if (ev.once && eventStore.doneEvents?.includes(ev.id)) continue
      if (ev.cooldown) {
        if (eventStore._dynCooldowns?.[ev.id] > 0) continue
      }
      const adapted = adaptEvent(ev, { spiritMeta: player.spirit || {} })
      if (!isEventEligible(adapted, eventContext({ ...context, source: 'dynamic' }))) continue
      if (ev.condition && ev.condition(G, context)) {
        return adapted
      }
    }
    return null
  }

  function checkChainedEvents() {
    for (const key in CHAINED_EVENTS) {
      const ev = adaptEvent(CHAINED_EVENTS[key], { spiritMeta: player.spirit || {} })
      if (!isEventEligible(ev, eventContext({ source: 'chained', locationMatches: true }))) continue
      const G = createGProxy()
      if (ev.requires && !ev.requires(G)) continue
      if (eventStore.doneEvents?.includes(ev.id)) continue
      if (eventStore._recentEvents?.includes(ev.id)) continue
      return ev
    }
    return null
  }

  return {
    createGProxy,
    currentPhase,
    eventContext,
    checkCond,
    eventMatchesCurrentLocation,
    availableEvents,
    recentCooldown,
    drawFromBag,
    checkDynamicEvents,
    checkChainedEvents
  }
}
