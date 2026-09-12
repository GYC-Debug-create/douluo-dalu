/**
 * 事件场景展示层
 *
 * 从 useEventEngine.js 拆出：场景状态 refs 与"把什么呈现给玩家"的四个入口
 * （事件 / 继续页 / 结局 / 旅行引导）。数据准备管线在此组装，store 之外的
 * 纯变换（asset 解析、猎环元数据）仍来自 utils/engine 纯模块。
 */
import { ref } from 'vue'
import { adaptEvent } from '@/engine/event-rules'
import { pickEnding } from '@/engine/settlement'
import { buildRingHuntMeta, prepareFirstHuntEvent, prepareFirstRingEvent } from '@/utils/ring-hunt'
import { resolveEventAsset } from '@/utils/asset-resolver'

/**
 * @param {object} deps { player, eventStore, combatStore, finalStats, createGProxy, locationName }
 */
export function useEventScene(deps) {
  const { player, eventStore, combatStore, finalStats, createGProxy, locationName } = deps

  // 场景状态: 'idle' | 'event' | 'continue' | 'location' | 'ringHunt' | 'battle'
  const sceneState = ref('idle')
  const currentEvent = ref(null)
  const resultText = ref('')
  const resultRewards = ref([])
  const currentLocationName = ref('')

  function showEvent(ev, options = {}) {
    const normalized = adaptEvent(ev, { spiritMeta: player.spirit || {} })
    const trainingPrepared = prepareFirstHuntEvent(normalized, player)
    const prepared = resolveEventAsset(prepareFirstRingEvent(trainingPrepared, player, finalStats(), combatStore.huntingKnowledge))
    const ringMeta = options.isRingHunt && prepared.ring
      ? buildRingHuntMeta({
        pendingRingLv: eventStore.pendingRingLv || prepared.minLevel,
        ringLevel: eventStore.pendingRingLv || prepared.minLevel,
        ringCount: player.rings?.length || 0,
        targetId: eventStore._ringTargetId || '',
        targetName: eventStore._ringTargetName || ''
      })
      : null
    if (ringMeta) {
      eventStore._ringHuntLevel = ringMeta.ringLevel
      eventStore._ringOrdinal = ringMeta.ringOrdinal
      eventStore._ringTargetId = ringMeta.ringTargetId
      eventStore._ringTargetName = ringMeta.ringTargetName
    }
    currentEvent.value = {
      ...prepared,
      ...(ringMeta || {}),
      ...(options.isMainStory ? { _mainStory: true } : {}),
      ...(options.isRingHunt ? { _ringHunt: true } : {})
    }
    sceneState.value = 'event'
    resultText.value = ''
    resultRewards.value = []
    if (ringMeta) deps.saveGame()
  }

  function showContinue(ev, text) {
    currentEvent.value = ev
    sceneState.value = 'continue'
    resultText.value = text || ''
    resultRewards.value = []
  }

  function showTravelGuide(kind, title, targetId) {
    const targetName = locationName(targetId)
    const label = kind === 'ring' ? '猎环前置' : '主线行程'
    showContinue({
      id: `${kind}_travel_${targetId}`,
      name: `${label} · ${title}`,
      _travelGuideType: kind,
      targetId
    }, `新的目标位于「${targetName}」，不在当前区域。剧情不会将你凭空传送过去；请打开万象地图，沿相邻地点前往目标。若想先历练，直接点击“继续前行”可暂缓两次行动。`)
  }

  function showEnding() {
    const ending = pickEnding(deps.ENDINGS, player.fatePoints, createGProxy())
    if (!ending) return
    player.finished = true
    currentEvent.value = {
      id: 'ending',
      name: `【结局】${ending.title}`,
      text: ending.text || [],
      ending
    }
    resultText.value = ''
    resultRewards.value = []
    sceneState.value = 'ending'
    deps.saveGame(true) // 结局是终态,立即落盘
  }

  function normalizeEvent(source, isChain) {
    const ev = { ...source }
    if (!Array.isArray(ev.text)) ev.text = [ev.text]
    if (!ev.choices) ev.choices = []
    if (isChain) {
      ev._chain = true
      ev.unique = true
    }
    return ev
  }

  return {
    sceneState,
    currentEvent,
    resultText,
    resultRewards,
    currentLocationName,
    showEvent,
    showContinue,
    showTravelGuide,
    showEnding,
    normalizeEvent
  }
}
