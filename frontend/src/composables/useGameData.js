/**
 * 游戏数据加载 composable
 * 从 /data/ 目录加载武魂、魂兽、魂环等 JSON 数据
 */
import { ref, readonly } from 'vue'
import { EVENTS } from '@/data/game-data'
import { adaptEvent } from '@/engine/event-rules'

const DATA = ref({
  spirits: [],
  beasts: [],
  rings: [],
  spiritSkills: {},
  beastVariants: {},
  mapData: [],
  npcData: [],
  boneData: [],
  locationData: [],
  spiritEvents: {},
  spiritEventMap: []
})

const loaded = ref(false)
const loading = ref(false)
const loadErrors = ref([])
let loadPromise = null

async function loadJSON(url, fallback) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    console.warn(`[useGameData] 加载失败: ${url}`, e)
    loadErrors.value.push(url.replace('/data/', ''))
    return fallback
  }
}

async function performLoad() {
  loading.value = true
  loadErrors.value = []

  const [
    spiritCodex, beasts, rings, spiritSkills,
    beastVariants, mapData, npcData, boneData, locationData,
    spiritEvents, spiritEventMap
  ] = await Promise.all([
    loadJSON('/data/spirit-codex.json', { spirits: [] }),
    loadJSON('/data/beast-codex.json', { beasts: [] }),
    loadJSON('/data/ring-codex.json', { rings: [] }),
    loadJSON('/data/spirit-skills.json', { spirits: {} }),
    loadJSON('/data/beast-variants.json', {}),
    loadJSON('/data/map-data.json', { locations: [] }),
    loadJSON('/data/npc-codex.json', { npcs: [] }),
    loadJSON('/data/bone-codex.json', { bones: [] }),
    loadJSON('/data/location-codex.json', { locations: [] }),
    loadJSON('/data/spirit-events.json', { spirit_events: {} }),
    loadJSON('/data/spirit-event-map.json', { mappings: [] })
  ])

  DATA.value = {
    spirits: Array.isArray(spiritCodex.spirits) ? spiritCodex.spirits : [],
    beasts: Array.isArray(beasts.beasts) ? beasts.beasts : [],
    rings: Array.isArray(rings.rings) ? rings.rings : [],
    spiritSkills: spiritSkills.spirits || {},
    beastVariants: beastVariants || {},
    mapData: Array.isArray(mapData.locations) ? mapData.locations : [],
    npcData: Array.isArray(npcData.npcs) ? npcData.npcs : (Array.isArray(npcData) ? npcData : []),
    boneData: Array.isArray(boneData.bones) ? boneData.bones : [],
    locationData: Array.isArray(locationData.locations) ? locationData.locations : [],
    spiritEvents: spiritEvents.spirit_events || {},
    spiritEventMap: spiritEventMap.mappings || []
  }

  // 使用稳定映射注入武魂专属事件，禁止依赖数组下标配对。
  const keyToSpiritId = new Map(DATA.value.spiritEventMap.map(entry => [entry.eventKey, entry.spiritId]))
  const existingIds = new Set(EVENTS.map(event => event.id))
  for (const [eventKey, sourceEvents] of Object.entries(DATA.value.spiritEvents)) {
    const spiritId = keyToSpiritId.get(eventKey)
    const spirit = DATA.value.spirits.find(item => item.id === spiritId)
    if (!spirit) continue
    spirit.eventKey = eventKey
    for (const source of sourceEvents) {
      if (!source.id || existingIds.has(source.id)) continue
      const minLevel = Number(source.minLevel) || 1
      const event = adaptEvent({
        ...source,
        name: source.name || source.title || '武魂专属事件',
        location: source.location || '斗罗大陆',
        text: Array.isArray(source.text) ? source.text : [String(source.text || '')],
        choices: Array.isArray(source.choices) ? source.choices.map(choice => ({ ...choice })) : [],
        phase: minLevel <= 6 ? 'academy' : minLevel <= 18 ? 'adventure' : minLevel <= 40 ? 'master' : 'god',
        spiritId,
        spiritType: spirit.type || '',
        spiritSubtype: spirit.subtype || '',
        spiritTier: spirit.tier || '',
        spiritEventKey: eventKey,
        unique: source.unique !== false
      }, { spiritMeta: spirit })
      EVENTS.push(event)
      existingIds.add(event.id)
    }
  }

  // 核心成长数据齐全才视为完成；一次网络闪断后，下一次导航仍会重试。
  loaded.value = DATA.value.spirits.length > 0 && DATA.value.beasts.length > 0 && DATA.value.rings.length > 0
  return loaded.value
}

function loadAll() {
  if (loaded.value) return Promise.resolve(true)
  // 快速切换路由时必须等待同一个请求，不能因 loading=true 提前拿到空数组。
  if (loadPromise) return loadPromise
  loadPromise = performLoad().finally(() => {
    loading.value = false
    loadPromise = null
  })
  return loadPromise
}

export function useGameData() {
  return {
    data: readonly(DATA),
    loaded: readonly(loaded),
    loading: readonly(loading),
    loadErrors: readonly(loadErrors),
    loadAll
  }
}
