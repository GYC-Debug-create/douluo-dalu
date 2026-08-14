/**
 * 事件索引（M2 性能重构）
 *
 * 为事件抽取构建可复用的预计算索引，避免每次 nextEvent 全量遍历 600+ 事件：
 * - adapted:   按当前武魂缓存的 adaptEvent 结果（spiritMeta 只与武魂相关）
 * - byPhase:   阶段桶（academy/adventure/master/god/any）——事件 phase 与
 *              phaseForLevel(level) 不相容时必不可能被抽取
 * - byLocation: 地点桶——精确复刻 useEventEngine.eventMatchesCurrentLocation 的
 *              classify 分支与字符串包含分支；查询时仅需取当前地点桶
 * - global:    全局事件（无地点 / 全局地点文本 / classify 为 global）
 *
 * 超集保证：对任意 (phase, location)，被原逻辑判定合格的候选 ⊆
 * byPhase[phase] ∪ byPhase[any] ∪ global ∪ byLocation[location]。
 * 因此把桶的并集交给 isEventEligible 全量过滤，结果与原实现逐位一致。
 *
 * 纯模块：不依赖 Pinia，可在引擎、测试与审计脚本中复用。
 */
import { classifyEventLocation, GLOBAL_LOCATION_PREFIX } from './rules.js'
import { adaptEvent } from './event-rules.js'

export function buildEventIndex({ events = [], mapLocations = [], spiritMeta = {} }) {
  const adapted = new Map()
  const byPhase = new Map() // 'academy' | 'adventure' | 'master' | 'god' | 'any' -> Set<eventId>
  const byLocation = new Map() // locationId -> Set<eventId>（classify 命中 + 字符串包含命中）
  const global = new Set()
  const locationIds = mapLocations.map(loc => String(loc?.id || '')).filter(Boolean)

  for (const source of events) {
    const event = adaptEvent(source, { spiritMeta })
    const id = event?.id
    if (!id) continue
    adapted.set(id, event)

    // 阶段桶：无 phase 或 'any' 的事件对所有阶段都候选
    const phase = event.phase === undefined || event.phase === 'any' ? 'any' : String(event.phase)
    let phaseBucket = byPhase.get(phase)
    if (!phaseBucket) { phaseBucket = new Set(); byPhase.set(phase, phaseBucket) }
    phaseBucket.add(id)

    const locationText = typeof event.location === 'string' ? event.location : ''
    if (!locationText || GLOBAL_LOCATION_PREFIX.test(locationText)) {
      global.add(id)
      continue
    }
    const info = classifyEventLocation(locationText, mapLocations)
    if (info.scope === 'global') {
      global.add(id)
      continue
    }
    if (info.scope === 'mapped' && info.id) {
      let bucket = byLocation.get(info.id)
      if (!bucket) { bucket = new Set(); byLocation.set(info.id, bucket) }
      bucket.add(id)
    }
    // 字符串包含分支：复刻 eventMatchesCurrentLocation 中
    // ev.location.includes(currentLoc) / currentLoc.includes(ev.location)，
    // 对每个已知地点 id 判定（currentLoc 恒为 map id，故逐 id 预计算即精确覆盖）。
    for (const locId of locationIds) {
      if (locationText.includes(locId) || locId.includes(locationText)) {
        let bucket = byLocation.get(locId)
        if (!bucket) { bucket = new Set(); byLocation.set(locId, bucket) }
        bucket.add(id)
      }
    }
  }
  return { adapted, byPhase, byLocation, global }
}

let memo = null

/**
 * 共享索引：events（引用+长度）/ mapLocations（引用）/ 武魂（id）任一变化时重建。
 * 武魂专属事件在数据加载完成后才 push 进 EVENTS，长度键保证加载后的重建。
 */
export function getEventIndex({ events = [], mapLocations = [], spiritMeta = {} }) {
  const spiritId = String(spiritMeta?.id || '')
  const eventsLen = Array.isArray(events) ? events.length : 0
  if (memo && memo.events === events && memo.eventsLen === eventsLen &&
      memo.mapLocations === mapLocations && memo.spiritId === spiritId) {
    return memo.index
  }
  const index = buildEventIndex({ events, mapLocations, spiritMeta })
  memo = { events, eventsLen, mapLocations, spiritId, index }
  return index
}
