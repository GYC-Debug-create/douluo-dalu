<template>
  <div class="game-layout" :class="{ 'status-expanded': mobileStatusExpanded }">
    <!-- 左：状态面板 -->
    <StatusPanel
      id="mobile-player-status"
      :ring-action-locked="engine.battleActive.value"
      @open-map="onOpenMap"
      @resume-ring-hunt="engine.resumeRingHunt"
      @defer-ring-hunt="engine.deferRingHunt"
    />

    <button
      type="button"
      class="mobile-status-toggle"
      :aria-expanded="mobileStatusExpanded"
      aria-controls="mobile-player-status"
      @click="mobileStatusExpanded = !mobileStatusExpanded"
    >
      {{ mobileStatusExpanded ? '收起角色详情' : '展开角色详情' }}
    </button>

    <!-- 中：叙事 / 战斗 -->
    <div class="main-area">
      <TopBar @action="onTopAction" />

      <!-- 通知浮层：最多同时显示三条，其余由 UI store 排队 -->
      <div class="notification-rail" aria-label="游戏通知" aria-live="polite">
        <TransitionGroup name="toast">
          <div
            v-for="notif in ui.notifications"
            :key="notif.id"
            class="toast-item"
            :class="notif.type"
            role="status"
          >
            <span class="toast-message">{{ notif.message }}</span>
            <button type="button" class="toast-close" :aria-label="`关闭通知：${notif.message}`" @click="ui.dismissNotification(notif.id)">×</button>
          </div>
        </TransitionGroup>
        <div v-if="ui.notificationQueue.length" class="toast-queued" role="status">
          另有 {{ ui.notificationQueue.length }} 条通知排队中
        </div>
      </div>

      <!-- 场景区域 -->
      <SceneArea
        :scene-state="engine.sceneState.value"
        :current-event="engine.currentEvent.value"
        :result-text="engine.resultText.value"
        :player-name="player.name"
        :spirit-name="player.spirit?.name || '武魂'"
        :player-level="player.level"
        :can-hunt="engine.canHunt.value"
        :location-name="currentLocationName"
        :check-cond="engine.checkCond"
        @explore="engine.explore"
        @rest="engine.rest"
        @hunt="engine.hunt"
        @choose="onChoose"
        @continue="engine.continueAction"
         @open-map="onOpenMap"
         @start-exploration="engine.startLocationExploration"
         @resume-exploration="engine.resumeLocationExploration"
         @return-exploration="onReturnExploration"
         @abandon-exploration="onRequestAbandonExploration"
       />
    </div>

    <!-- 通用弹窗 -->
    <ModalDialog v-model="showModal" :title="modalTitle" :closable="true">
      <div v-html="modalContent"></div>
      <template #footer>
        <button class="btn" @click="showModal = false">关闭</button>
      </template>
    </ModalDialog>

    <ModalDialog v-model="showAbandonExplorationDialog" title="确认放弃地点探索" :closable="true">
      <div class="abandon-exploration-dialog" data-testid="abandon-exploration-dialog">
        <p>你即将放弃<strong>「{{ abandonExplorationInfo.locationName }}」</strong>的{{ abandonExplorationInfo.modeLabel }}。</p>
        <div class="abandon-progress-line">
          当前进度：{{ abandonExplorationInfo.completed }}/{{ abandonExplorationInfo.total }} 阶段
        </div>
        <ul>
          <li>本轮已经完成的阶段进度将被清除。</li>
          <li>本轮探索度、线索、声望、人物关系及最终奖励均不会结算。</li>
          <li>已完成的历史探索记录不会受到影响。</li>
        </ul>
      </div>
      <template #footer>
        <button class="btn" @click="cancelAbandonExploration">保留进度</button>
        <button class="btn btn-danger" data-testid="confirm-abandon-exploration" @click="confirmAbandonExploration">确认放弃</button>
      </template>
    </ModalDialog>

    <GameFeatureModal
      v-model="showFeatureModal"
      :feature="activeFeature"
      @challenge-tower="onChallengeTower"
      @npc-spar="onNpcSpar"
    />

    <!-- 云端乐观锁冲突：必须由玩家明确选择，禁止静默覆盖任一侧 -->
    <ModalDialog v-model="showConflictDialog" title="存档版本冲突" :closable="false">
      <p>云端存档在本次游玩期间已被更新。当前本地进度已经安全保留，请选择如何处理：</p>
      <template #footer>
        <button class="btn" @click="keepLocalOnly">暂时只保留本地</button>
        <button class="btn" @click="useCloudVersion">读取云端版本</button>
        <button class="btn btn-gold" @click="overwriteCloudVersion">用当前本地覆盖云端</button>
      </template>
    </ModalDialog>

    <!-- 存档确认弹窗 -->
    <ModalDialog v-model="showSaveDialog" title="存档" :closable="true">
      <div class="save-dialog-content">
        <p>是否保存当前进度？</p>
        <div class="save-info">
          <span>角色：{{ player.name }}</span>
          <span>等级：Lv.{{ player.level }}</span>
          <span>武魂：{{ player.spirit?.name }}</span>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="showSaveDialog = false">取消</button>
        <button class="btn btn-gold" @click="doSave">保存</button>
      </template>
    </ModalDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { deserializeSave, loadFromLocal, loadFromCloud, saveToCloud, saveToLocal } from '@/stores/serializer'
import { useApi } from '@/composables/useApi'
import { useEventEngine } from '@/composables/useEventEngine'
import { useBattleSystem } from '@/composables/useBattleSystem'
import { useGameData } from '@/composables/useGameData'
import StatusPanel from '@/components/StatusPanel.vue'
import TopBar from '@/components/TopBar.vue'
import SceneArea from '@/components/SceneArea.vue'
import ModalDialog from '@/components/ModalDialog.vue'
import {
  clearCloudConflict,
  createCloudConflictState,
  getCloudConflictVersion,
  keepCloudConflictLocal,
  recordCloudConflict as recordCloudConflictState,
  refreshCloudConflict,
  reopenCloudConflict
} from '@/utils/cloud-conflict'
import GameFeatureModal from '@/components/GameFeatureModal.vue'
import { useGameFeatures } from '@/composables/useGameFeatures'
import { richText } from '@/engine/rules'
import { travelArrivalSummaryText } from '@/utils/travel-arrival'

let expandedEventsPromise = null
function ensureExpandedEvents() {
  if (!expandedEventsPromise) expandedEventsPromise = import('@/data/events-expanded.js')
  return expandedEventsPromise
}

const router = useRouter()
const player = usePlayerStore()
const eventStore = useEventStore()
const gameStore = useGameStore()
const ui = useUiStore()
const api = useApi()
const { loadAll } = useGameData()

const showModal = ref(false)
const modalTitle = ref('')
const modalContent = ref('')
const showSaveDialog = ref(false)
const showFeatureModal = ref(false)
const activeFeature = ref('')
const mobileStatusExpanded = ref(false)
const cloudConflict = createCloudConflictState()
const showConflictDialog = cloudConflict.showDialog
// 待处理的云端版本冲突（自动保存发现 409 后记录）。
// 存在时后续自动保存只写本地，不再每分钟向云端发送必然失败的 409。
const pendingCloudConflict = cloudConflict.pending
const showAbandonExplorationDialog = ref(false)
const pendingAbandonExplorationId = ref('')
let autoSaveTimer = null

// 事件引擎
const engine = useEventEngine()
const features = useGameFeatures()
const battle = useBattleSystem()

// 当前地点名称
const currentLocationName = computed(() => {
  const loc = gameStore._currentLocation
  if (!loc) return ''
  const locationMap = {
    'holy_soul_village': '圣魂村',
    'shrek_academy': '史莱克学院',
    'star_duo_outer': '星斗大森林·外围',
    'star_duo_deep': '星斗大森林·深处',
    'wuhun_city': '武魂城',
    'spirit_hall': '武魂殿',
    'tian_dou_city': '天斗城',
    'east_sea_port': '东海港口',
    'sunset_forest': '落日森林',
    'sea_god_island': '海神岛',
    'ice_forest': '冰封森林',
    'slaughter_city': '杀戮之都',
    'ancient_ruins': '远古遗迹',
    'abyss_rift': '深渊裂缝',
    'dragon_valley': '龙之谷',
    'medicine_valley': '灵药谷',
    'shadow_swamp': '暗影沼泽',
    'element_valley': '元素峡谷',
    'desert_death': '死亡沙漠',
    'evil_forest': '邪魔森林',
    'steel_city': '钢铁之城',
    'sky_city': '天空之城',
    'haotian_sect': '昊天宗',
    'seven_treasure_glaze': '七宝琉璃宗'
  }
  return locationMap[loc] || loc
})

function destinationPlanText(arrival) {
  return `<br>${travelArrivalSummaryText(arrival)}`
}

function resumeCurrentGame() {
  let arrival = null
  try {
    const raw = sessionStorage.getItem('dldl_pending_travel')
    if (raw) arrival = JSON.parse(raw)
    sessionStorage.removeItem('dldl_pending_travel')
  } catch {
    sessionStorage.removeItem('dldl_pending_travel')
  }

  if (arrival && arrival.playerId === player.playerId && arrival.targetId === gameStore._currentLocation) {
    // “是否遇险”已在 MapPage 离开前抽取并写入 session，刷新不能重新掷骰。
    if (arrival.encounter === true && engine.triggerTravelEncounter(arrival)) return

    const hiddenText = Array.isArray(arrival.revealed) && arrival.revealed.length
      ? `<br>途中发现：${arrival.revealed.join('、')}`
      : ''
    const arrivalText = `${destinationPlanText(arrival)}<br>你沿途整理见闻，在新的地域安顿下来。${hiddenText}`
    engine.enterLocation(richText(arrivalText))
    return
  }
  engine.nextEvent()
}

onMounted(async () => {
  // 只有真正进入游戏事件引擎时才加载扩展事件包，避免首屏入口携带 274KB 数据。
  await Promise.all([loadAll(), ensureExpandedEvents()])

  // 标题页显式选择云档时已经完成反序列化；创建角色也已经初始化 store。
  // 从地图/图鉴返回时 Pinia 仍保留最新状态，禁止再次请求云端覆盖刚发生的旅行或事件。
  if (player.name && player.spirit) {
    resumeCurrentGame()
    return
  }

  // 本地入口只读取本地存档。云端读取必须由标题页的明确选档动作触发。
  const localData = loadFromLocal()
  if (!localData || !deserializeSave(localData)) {
    ui.notify(localData ? '存档读取失败，请重新创建角色' : '未找到可用存档', 'error', 5000)
    setTimeout(() => router.push('/'), 1200)
    return
  }
  resumeCurrentGame()
})

onBeforeRouteLeave((to, from, next) => {
  // 战斗进行中不允许离开（地图/图鉴/主页/浏览器后退统一拦截），
  // 避免模块级 battleState 残留导致重新进入后事件引擎被 isActive() 永久锁定。
  if (battle.isActive()) {
    ui.notify('战斗进行中，请先完成战斗或撤退', 'warning', 4000)
    next(false)
    return
  }
  next()
})

function recordCloudConflict(result) {
  return recordCloudConflictState(cloudConflict, result)
}

async function backgroundSave() {
  if (!player.playerId) return
  // 已有待处理的云端冲突：只保存本地，绝不重复发送必然失败的 409，
  // 也绝不静默覆盖云端，等待玩家在冲突对话框中显式选择。
  if (pendingCloudConflict.value) {
    try {
      saveToLocal()
    } catch (error) {
      console.warn('本地存档失败', error)
    }
    return
  }
  if (player.finished) {
    try { saveToLocal() } catch (error) { console.warn('本地存档失败', error) }
    return
  }
  try {
    const result = await saveToCloud(api)
    if (!result.success && result.conflict) {
      // 本地已在 saveToCloud 内成功保存；记录冲突并只提示一次。
      recordCloudConflict(result)
      return
    }
    if (!result.success) {
      console.warn('后台云存档失败，已保留本地：', result.error)
    }
  } catch (error) {
    console.warn('后台存档失败', error)
  }
}

function handleVisibilitySave() {
  if (document.visibilityState === 'hidden') void backgroundSave()
}

onMounted(() => {
  autoSaveTimer = setInterval(() => void backgroundSave(), 60000)
  document.addEventListener('visibilitychange', handleVisibilitySave)
  window.addEventListener('pagehide', handleVisibilitySave)
})

onBeforeUnmount(() => {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  document.removeEventListener('visibilitychange', handleVisibilitySave)
  window.removeEventListener('pagehide', handleVisibilitySave)
  // 兜底：若战斗仍处于进行中（HMR、异常导航或未来代码绕过路由守卫），
  // 强制复位模块级战斗状态，避免重新进入后事件引擎被锁定。
  battle.resetBattle()
})

// 事件选择处理
function onChoose({ choice, idx }) {
  const ev = engine.currentEvent.value
  if (!ev) return
  engine.applyChoice(ev, choice, idx)
}

// 打开地图
function onOpenMap() {
  router.push('/map')
}

function onReturnExploration(locationId) {
  if (typeof locationId !== 'string' || !locationId) {
    router.push('/map')
    return
  }
  router.push({ path: '/map', query: { focus: locationId } })
}

const abandonExplorationInfo = computed(() => {
  const locationId = pendingAbandonExplorationId.value
  const elsewhere = engine.currentEvent.value?.explorationsElsewhere || []
  const exploration = elsewhere.find(item => item.locationId === locationId)
  return {
    locationName: exploration?.locationName || '未完成地点',
    modeLabel: exploration?.modeLabel || '地点行动',
    completed: exploration?.progress?.completed || 0,
    total: exploration?.progress?.total || 4
  }
})

function onRequestAbandonExploration(locationId) {
  if (typeof locationId !== 'string' || !locationId) return
  pendingAbandonExplorationId.value = locationId
  showAbandonExplorationDialog.value = true
}

function cancelAbandonExploration() {
  showAbandonExplorationDialog.value = false
  pendingAbandonExplorationId.value = ''
}

function confirmAbandonExploration() {
  const locationId = pendingAbandonExplorationId.value
  showAbandonExplorationDialog.value = false
  pendingAbandonExplorationId.value = ''
  if (locationId) engine.abandonLocationExploration(locationId)
}

// 顶部按钮操作
function onTopAction(action) {
  switch (action) {
    case 'save':
      showSaveDialog.value = true
      break
    case 'map':
      router.push('/map')
      break
    case 'travel':
      router.push('/map')
      break
    case 'codex':
      router.push('/codex')
      break
    case 'home':
      router.push('/')
      break
    case 'help':
      modalTitle.value = '操作说明'
      modalContent.value = `
        <h3>基本操作</h3>
        <p>1. 点击「探索四周」可以触发事件，事件完成后点击「继续前行」继续推进剧情</p>
        <p>2. 点击「原地休息」可以恢复少量生命与魂力</p>
        <p>3. 达到等级要求后可以「猎杀魂兽」获取魂环</p>
        <p>4. 事件选项可能有条件限制，灰色表示不满足</p>
        <p>5. 记得定期存档！</p>
      `
      showModal.value = true
      break
    case 'bag': case 'shop': case 'quests': case 'signin': case 'skilltree':
    case 'bone': case 'forge': case 'train': case 'tower': case 'formation':
    case 'achievement': case 'title': case 'npc': case 'relation':
      if (action === 'achievement') features.checkAchievements()
      activeFeature.value = action
      showFeatureModal.value = true
      break
    default:
      ui.notify(`${action} 功能正在开发中…`, 'info')
  }
}

function onChallengeTower(floorNumber) {
  showFeatureModal.value = false
  const started = features.startTower(floorNumber, {
    onVictory: floor => engine.showContinue(null, `挑战塔第${floor.floor}层「${floor.name}」通关！奖励与魂骨碎片已收入存档。`),
    onDefeat: floor => engine.showContinue(null, `挑战塔第${floor.floor}层挑战失败。恢复后可再次挑战。`)
  })
  if (started) engine.sceneState.value = 'battle'
  else ui.notify('当前不能挑战该塔层', 'warning')
}

function onNpcSpar(npcId) {
  showFeatureModal.value = false
  const started = features.startNpcSpar(npcId, {
    onVictory: ({ npc, expGain, affinityGain }) => engine.showContinue(
      null,
      `你在点到为止的切磋中战胜「${npc.name}」，获得${expGain}经验，好感度+${affinityGain}。`
    ),
    onDefeat: ({ npc, affinityGain }) => engine.showContinue(
      null,
      `你在切磋中败给了「${npc.name}」，但对方认可你的勇气，好感度+${affinityGain}。`
    )
  })
  if (started) engine.sceneState.value = 'battle'
}

async function doSave() {
  showSaveDialog.value = false
  ui.notify('正在保存…', 'info', 2000)

  if (pendingCloudConflict.value) {
    try {
      saveToLocal({ forceHistory: true })
      reopenCloudConflict(cloudConflict)
      ui.notify('当前仍处于冲突处理状态，已只保存到本地', 'warning', 4000)
    } catch (error) {
      ui.notify(`本地存档失败：${error.message}`, 'error', 5000)
    }
    return
  }

  let result
  try {
    result = await saveToCloud(api, { forceHistory: true })
  } catch (error) {
    ui.notify(`存档失败：${error.message}`, 'error', 5000)
    return
  }

  if (result.success) {
    ui.notify(`存档成功（云端版本 ${result.version}）`, 'success')
  } else if (!result.success && result.conflict) {
    recordCloudConflict(result)
  } else {
    ui.notify(
      result.localFailed ? `本地存档失败：${result.error || '浏览器存储不可用'}` : `云端不可用，已保存到本地：${result.error || '稍后可重试'}`,
      result.localFailed ? 'error' : 'warning',
      5000
    )
  }
}

function keepLocalOnly() {
  keepCloudConflictLocal(cloudConflict)
  // 保留 pendingCloudConflict：后续自动保存只写本地，后台绝不静默覆盖云端。
  ui.notify('当前进度继续保留在本地，未覆盖云端', 'warning', 4000)
}

async function useCloudVersion() {
  showConflictDialog.value = false
  const result = await loadFromCloud(api, player.playerId)
  if (!result.success) {
    ui.notify(`云端读取失败：${result.error || '未知错误'}`, 'error', 5000)
    reopenCloudConflict(cloudConflict)
    return
  }
  // 冲突已按玩家选择解决：清除冲突状态并恢复自动云同步。
  clearCloudConflict(cloudConflict)
  ui.notify('已按你的选择读取云端版本', 'success')
  engine.nextEvent()
}

async function overwriteCloudVersion() {
  showConflictDialog.value = false
  try {
    const local = saveToLocal({ forceHistory: true })
    const result = await api.saveData(local, getCloudConflictVersion(cloudConflict))
    if (!result.success) {
      if (result.conflict) refreshCloudConflict(cloudConflict, result)
      else reopenCloudConflict(cloudConflict)
      throw new Error(result.error || '云端再次发生版本冲突')
    }
    // 冲突已按玩家选择解决：清除冲突状态并恢复自动云同步。
    clearCloudConflict(cloudConflict)
    ui.notify(`已按你的选择用本地进度覆盖云端（版本 ${result.version}）`, 'success', 5000)
  } catch (error) {
    ui.notify(`覆盖云端失败：${error.message}`, 'error', 5000)
    reopenCloudConflict(cloudConflict)
  }
}
</script>

<style scoped>
.abandon-exploration-dialog p {
  margin-bottom: 14px;
}
.abandon-exploration-dialog strong {
  color: var(--gold-hi);
}
.abandon-progress-line {
  margin-bottom: 12px;
  padding: 9px 12px;
  border-left: 3px solid var(--gold);
  background: rgba(201, 168, 76, 0.08);
  color: var(--gold-hi);
}
.abandon-exploration-dialog ul {
  padding-left: 1.25rem;
  color: var(--ink-dim);
}
.btn-danger {
  border-color: rgba(208, 106, 90, 0.72) !important;
  color: #efb0a7 !important;
  background: linear-gradient(180deg, rgba(92, 43, 34, 0.95), rgba(54, 27, 22, 0.98)) !important;
}
.game-layout {
  display: grid;
  grid-template-columns: 290px 1fr;
  gap: 0;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
.main-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.notification-rail {
  position: fixed;
  top: 70px;
  right: 20px;
  z-index: 80;
  width: min(420px, calc(100vw - 40px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}
.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 4px;
  font-size: 14px;
  letter-spacing: 1px;
  pointer-events: auto;
  transition: all 0.3s;
  background: rgba(36, 28, 14, 0.95);
  border: 1px solid var(--line);
  color: var(--ink);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42);
}
.toast-message { flex: 1; min-width: 0; line-height: 1.55; overflow-wrap: anywhere; }
.toast-close {
  flex: none; width: 24px; height: 24px; margin: -3px -8px -3px 0;
  border: 0; border-radius: 50%; background: transparent; color: currentColor;
  font: 18px/1 inherit; cursor: pointer; opacity: .72;
}
.toast-close:hover, .toast-close:focus-visible { opacity: 1; background: rgba(255,255,255,.08); }
.toast-queued {
  align-self: flex-end; padding: 5px 10px; border: 1px solid var(--line); border-radius: 12px;
  background: rgba(20, 16, 10, .92); color: var(--ink-dim); font-size: 11px; pointer-events: auto;
}
.toast-item.success {
  border-color: var(--ok);
  color: #b9e7c0;
}
.toast-item.danger, .toast-item.error {
  border-color: var(--danger);
  color: #ffb0a5;
}
.toast-item.info {
  border-color: var(--info);
  color: #a9d4f0;
}
.toast-item.gold {
  border-color: var(--gold);
  color: var(--gold-hi);
}

.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@media (max-width: 600px) {
  .notification-rail { top: 58px; right: 10px; width: calc(100vw - 20px); }
  .toast-item { padding: 9px 12px; font-size: 12px; }
}

.save-dialog-content p {
  margin-bottom: 12px;
}
.save-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: rgba(20, 16, 10, 0.5);
  border-radius: 4px;
  border: 1px solid var(--line);
  font-size: 14px;
  color: var(--ink-dim);
}
.save-info span {
  color: var(--ink);
}

.btn {
  display: inline-block;
  min-height: 40px;
  padding: 8px 20px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: linear-gradient(180deg, #33291a, #241c0e);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.25s;
}
.btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-hi);
  transform: translateY(-1px);
}
.btn-gold {
  border-color: var(--gold);
  color: var(--gold-hi);
}

@media (max-width: 768px) {
  .game-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto minmax(0, 1fr);
  }
  :deep(.status-panel) {
    position: relative;
    top: auto;
    height: auto;
    min-height: 0;
    max-height: none;
    padding: max(8px, env(safe-area-inset-top)) 12px 8px;
    gap: 8px;
    overflow: hidden;
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
  .game-layout:not(.status-expanded) :deep(.status-panel > :nth-child(n + 3)) {
    display: none;
  }
  .game-layout.status-expanded :deep(.status-panel) {
    max-height: 42dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .mobile-status-toggle {
    display: block;
    min-height: 44px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: #171106;
    color: var(--gold-hi);
    font-family: var(--font-body);
    font-size: 13px;
    letter-spacing: 2px;
  }
  .main-area {
    min-height: 0;
  }
}

@media (min-width: 769px) {
  .mobile-status-toggle { display: none; }
}
</style>
