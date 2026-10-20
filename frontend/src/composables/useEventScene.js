/**
 * 事件场景展示层
 *
 * 从 useEventEngine.js 拆出：场景状态 refs 与"把什么呈现给玩家"的四个入口
 * （事件 / 继续页 / 结局 / 旅行引导）。数据准备管线在此组装，store 之外的
 * 纯变换（asset 解析、猎环元数据）仍来自 utils/engine 纯模块。
 */
import { ref } from 'vue'
import { adaptEvent } from '@/engine/event-rules'
import { pickEnding, endingHonors } from '@/engine/settlement'
import { fillEventTemplates, fillTemplate, GLOBAL_LOCATION_PREFIX } from '@/engine/rules'
import { buildRingHuntMeta, prepareFirstHuntEvent, prepareFirstRingEvent } from '@/utils/ring-hunt'
import { resolveEventAsset } from '@/utils/asset-resolver'
import { resolveStoryVariants, resolveEndingEpilogue } from '@/engine/story-marks'
import { ENDING_EPILOGUES } from '@/data/main-story'

// "任意""斗罗大陆各地""你的住处"这类是数据里的泛指地点，不该原样显示给玩家。
const GENERIC_LOCATION = /^(?:任意|未知|旅途|自己选的地方|你的(?:宗门|神殿|府邸|住处|修炼室)|史莱克学院\/自己宗门)$/

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

  function templateValues(extra = {}) {
    return {
      name: player.name,
      spirit: player.spirit?.name,
      origin: player.originName,
      ...extra
    }
  }

  function displayLocationFor(location) {
    const raw = String(location || '').trim()
    if (!raw || GENERIC_LOCATION.test(raw) || GLOBAL_LOCATION_PREFIX.test(raw)) {
      return deps.currentLocationLabel ? deps.currentLocationLabel() : ''
    }
    return raw
  }

  function storyMarks() {
    return Array.isArray(eventStore._storyMarks) ? eventStore._storyMarks : []
  }

  function showEvent(ev, options = {}) {
    // 先按世界账本展开（记号决定追加哪些段落、显示哪些选项），再做模板与配图处理。
    const normalized = resolveStoryVariants(adaptEvent(ev, { spiritMeta: player.spirit || {} }), storyMarks())
    const trainingPrepared = prepareFirstHuntEvent(normalized, player)
    const prepared = fillEventTemplates(
      resolveEventAsset(prepareFirstRingEvent(trainingPrepared, player, finalStats(), combatStore.huntingKnowledge)),
      templateValues()
    )
    prepared._displayLocation = displayLocationFor(prepared.location)
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

  // rewards：奖励明细数组（每项一条，如"经验+120"），由场景区渲染成独立的小标签。
  function showContinue(ev, text, rewards = [], extraTemplate = {}) {
    currentEvent.value = ev
    sceneState.value = 'continue'
    resultText.value = fillTemplate(text || '', templateValues(extraTemplate))
    resultRewards.value = (Array.isArray(rewards) ? rewards : []).filter(Boolean)
  }

  function showTravelGuide(kind, title, targetId) {
    const targetName = locationName(targetId)
    const label = kind === 'ring' ? '猎环前置' : '主线行程'
    showContinue({
      id: `${kind}_travel_${targetId}`,
      name: `${label} · ${title}`,
      _travelGuideType: kind,
      targetId
    }, `下一个目标在「${targetName}」。打开地图，一站一站走过去就能到。想先在这里多历练一会儿，就点"继续前行"，过几次行动我会再提醒你。`)
  }

  function showEnding() {
    const G = createGProxy()
    const ending = pickEnding(deps.ENDINGS, player.fatePoints, G)
    if (!ending) return
    player.finished = true
    // 旅程回顾：结局不是突然出现的一段话，而是对这一路的总结。
    const visited = Array.isArray(G._visitedLocations) ? G._visitedLocations.length : 0
    const friends = Array.isArray(G._metNpcs) ? G._metNpcs.length : 0
    const stories = Array.isArray(eventStore.doneEvents) ? eventStore.doneEvents.length : 0
    const recap = `回望这一路：你从${player.originName || '家乡'}出发，走过了 ${visited} 个地方，结识了 ${friends} 位伙伴，经历了 ${stories} 段故事，拿到了 ${player.rings?.length || 0} 个魂环。`
    const honors = endingHonors(deps.ENDINGS, G)
    const epilogue = resolveEndingEpilogue(ENDING_EPILOGUES, storyMarks())
    currentEvent.value = {
      id: 'ending',
      name: `【结局】${ending.title}`,
      text: [
        // 决战收尾（按记号）→ 结局正文 → 尾声：交代每个朋友后来怎么样了
        ...epilogue.before.map(line => fillTemplate(line, templateValues())),
        ...(ending.text || []).map(line => fillTemplate(line, templateValues())),
        ...epilogue.after.map(line => fillTemplate(line, templateValues())),
        recap,
        ...(honors.length ? [`这一路你还获得了这些荣誉：${honors.join('、')}。`] : [])
      ],
      ending
    }
    resultText.value = ''
    resultRewards.value = []
    sceneState.value = 'ending'
    if (typeof eventStore.logJourney === 'function' && !(eventStore._journeyLog || []).some(item => item?.k === 'ending')) {
      eventStore.logJourney({ k: 'ending', id: ending.id, title: ending.title, lv: player.level })
    }
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
