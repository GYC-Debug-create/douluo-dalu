/**
 * 事件引擎 composable（组合根）
 *
 * 职责仅剩：装配各编排子系统并导出原有公开 API。逻辑分布：
 *  - 纯逻辑层  engine/event-draw.js（抽取）/ engine/settlement.js（结算）/
 *              engine/event-rules.js（规则与主线链）/ engine/traits.js（特质）
 *  - 内容层    data/story-intro.js（序章）/ utils/travel-encounters.js（旅行遭遇）
 *  - 编排层    useEventScene（场景呈现）/ useEventCandidates（候选与上下文）/
 *              useGrowthSettlement（成长结算）/ useEventFlow（事件流）/
 *              useLocationExploration（地点探索）
 * 命令注册表（engine/engine-commands.js）解耦 flow ↔ exploration/growth 的循环调用。
 */
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useCombatStore } from '@/stores/combat'
import { useUiStore } from '@/stores/ui'
import { useGameRules } from '@/composables/useGameRules'
import { useGameData } from '@/composables/useGameData'
import { useBattleSystem } from '@/composables/useBattleSystem'
import { useEventScene } from '@/composables/useEventScene'
import { useEventCandidates } from '@/composables/useEventCandidates'
import { useGrowthSettlement } from '@/composables/useGrowthSettlement'
import { useEventFlow } from '@/composables/useEventFlow'
import { createLocationExplorationSystem } from '@/composables/useLocationExploration'
import { EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS, ENDINGS } from '@/data/game-data'
import { createEngineCommands } from '@/engine/engine-commands'
import { saveToLocal, markSaveDirty } from '@/stores/serializer'

// 测试从本模块导入 cooldownSafeEventPool；实现已下沉到 engine/event-draw.js。
export { cooldownSafeEventPool } from '@/engine/event-draw'

/**
 * 事件引擎 composable
 */
export function useEventEngine() {
  const player = usePlayerStore()
  const eventStore = useEventStore()
  const gameStore = useGameStore()
  const combatStore = useCombatStore()
  const ui = useUiStore()
  const { finalStats, getMaxSpiritPower, expNeeded, levelCapForRings } = useGameRules()
  const { data } = useGameData()
  const battleSystem = useBattleSystem()

  const battleActive = computed(() => battleSystem.active.value)

  // ==================== 共享小工具 ====================

  function saveGame(immediate = false) {
    if (!immediate) {
      // 阶段四C:高频路径走脏标记+空闲落盘,结局/手动存档传 true 立即写
      markSaveDirty(error => {
        console.warn('自动存档失败', error)
        ui.notify(`进度未能写入本地：${error.message}`, 'error', 5000)
      })
      return
    }
    try {
      saveToLocal()
    } catch (e) {
      console.warn('自动存档失败', e)
      ui.notify(`自动存档失败：${e.message}`, 'error', 5000)
    }
  }

  function currentMapLocation(locationId = gameStore._currentLocation) {
    return data.value.mapData.find(location => location.id === locationId || location.name === locationId) || null
  }

  function locationCodex(location) {
    if (!location) return null
    return data.value.locationData.find(item => item.id === location.name || item.name === location.name) || null
  }

  function locationName(locationId) {
    return data.value.mapData.find(location => location.id === locationId)?.name || locationId
  }

  // ==================== 子系统装配 ====================

  // 命令注册表：exploration/growth 请求 flow 的动作,flow 装配完成后统一注册实现。
  const commands = createEngineCommands()

  const candidates = useEventCandidates({
    player, eventStore, gameStore, combatStore, data,
    EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS,
    battleSystem, finalStats
  })

  const scene = useEventScene({
    player, eventStore, combatStore, finalStats,
    createGProxy: candidates.createGProxy,
    locationName,
    saveGame,
    ENDINGS
  })

  const growth = useGrowthSettlement({
    player, eventStore, gameStore, ui, data, EVENTS,
    finalStats, getMaxSpiritPower, expNeeded,
    battleGuard: () => battleSystem.isActive(),
    scene: {
      showEvent: scene.showEvent,
      showContinue: scene.showContinue,
      showTravelGuide: scene.showTravelGuide,
      saveGame,
      currentEvent: scene.currentEvent
    },
    commands
  })

  const exploration = createLocationExplorationSystem({
    player, eventStore, gameStore, ui, data, EVENTS,
    battleGuard: () => battleSystem.isActive(),
    showEvent: scene.showEvent,
    applyResultRewards: growth.applyResultRewards,
    saveGame,
    addDiaryEntry: growth.addDiaryEntry,
    commands,
    scene: {
      currentEvent: scene.currentEvent,
      sceneState: scene.sceneState,
      resultText: scene.resultText,
      resultRewards: scene.resultRewards,
      currentLocationName: scene.currentLocationName
    },
    currentMapLocation,
    locationName,
    locationCodex
  })

  const flow = useEventFlow({
    player, eventStore, gameStore, ui, data, EVENTS, CHAINED_EVENTS,
    battleSystem, levelCapForRings, finalStats, getMaxSpiritPower,
    scene, candidates, growth, exploration,
    currentMapLocation, locationName, locationCodex, saveGame
  })
  commands.register('nextEvent', flow.nextEvent)
  commands.register('recordEventDiscoveries', flow.recordEventDiscoveries)

  return {
    sceneState: scene.sceneState,
    currentEvent: scene.currentEvent,
    resultText: scene.resultText,
    resultRewards: scene.resultRewards,
    currentLocationName: scene.currentLocationName,
    canHunt: flow.canHunt,
    battleActive,
    enterLocation: exploration.enterLocation,
    showLocationAction: exploration.showLocationAction,
    startLocationExploration: exploration.startLocationExploration,
    resumeLocationExploration: exploration.resumeLocationExploration,
    abandonLocationExploration: exploration.abandonLocationExploration,
    nextEvent: flow.nextEvent,
    applyChoice: flow.applyChoice,
    showEvent: scene.showEvent,
    showContinue: scene.showContinue,
    triggerTravelEncounter: flow.triggerTravelEncounter,
    explore: flow.explore,
    rest: flow.rest,
    hunt: growth.hunt,
    resumeRingHunt: growth.resumeRingHunt,
    deferRingHunt: growth.deferRingHunt,
    continueAction: flow.continueAction,
    deferAction: flow.deferAction,
    handleBattleEnd: flow.handleBattleEnd,
    checkCond: candidates.checkCond,
    availableEvents: candidates.availableEvents,
    checkDynamicEvents: candidates.checkDynamicEvents,
    checkChainedEvents: candidates.checkChainedEvents,
    currentPhase: candidates.currentPhase,
    applyResultRewards: growth.applyResultRewards,
    checkLevelUp: growth.checkLevelUp,
    saveGame,
    showEnding: scene.showEnding
  }
}
