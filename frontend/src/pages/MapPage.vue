<template>
  <div class="map-page">
    <header class="map-topbar">
      <button class="btn btn-back" type="button" @click="goBack">← 返回游戏</button>
      <div class="map-title-wrap">
        <span class="map-title-kicker">山河有界 · 行路有踪</span>
        <span class="map-title">斗罗大陆 · 万象地图</span>
      </div>
      <router-link to="/codex" class="nav-link">万象图鉴 →</router-link>
    </header>

    <Transition name="bridge-notice">
      <div v-if="notice" class="map-notice" :class="notice.type" role="status">
        {{ notice.message }}
      </div>
    </Transition>

    <div v-if="loading" class="map-loading">正在展开大陆舆图……</div>
    <div v-else-if="loadError" class="map-loading error">
      <strong>地图资料加载失败</strong>
      <span>{{ loadError }}</span>
      <button class="btn" type="button" @click="loadLocations">重新加载</button>
    </div>
    <WorldMap
      v-else
      :map-state="mapState"
      :focus-id="focusId"
      :busy="traveling"
      @travel="handleTravel"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorldMap from '@/components/map/WorldMap.vue'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { deserializeSave, loadFromLocal, saveToLocal } from '@/stores/serializer'
import { buildMapState, loadMapLocations, performMapTravel } from '@/utils/mapBridge'

const router = useRouter()
const route = useRoute()
const player = usePlayerStore()
const eventStore = useEventStore()
const game = useGameStore()
const ui = useUiStore()
const locations = ref([])
const loading = ref(true)
const loadError = ref('')
const notice = ref(null)
const traveling = ref(false)
let noticeTimer = null

const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
const mapDataUrl = `${baseUrl}data/map-data.json`
const focusId = computed(() => typeof route.query.focus === 'string' ? route.query.focus.trim() : '')
const mapState = computed(() => buildMapState(locations.value, player, game, eventStore))

function cloneState(state) {
  return JSON.parse(JSON.stringify(state))
}

function restoreStore(store, snapshot) {
  store.$reset()
  store.$patch(snapshot)
}

function showNotice(message, type = 'info', duration = 3500) {
  notice.value = { message, type }
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = null
    noticeTimer = null
  }, duration)
}

async function loadLocations() {
  loading.value = true
  loadError.value = ''
  try {
    locations.value = await loadMapLocations(mapDataUrl)
  } catch (error) {
    console.error('[MapPage] 地图数据加载失败', error)
    loadError.value = error instanceof Error ? error.message : '未知错误'
  } finally {
    loading.value = false
  }
}

function handleTravel(payload) {
  if (traveling.value) return
  const locationId = payload?.locationId
  let beforeTravel
  try {
    beforeTravel = {
      player: cloneState(player.$state),
      game: cloneState(game.$state),
      event: cloneState(eventStore.$state)
    }
  } catch (error) {
    console.error('[MapPage] 无法创建旅行事务快照', error)
    showNotice('无法准备旅行状态，请刷新后重试', 'error', 5000)
    return
  }

  traveling.value = true
  let result
  try {
    result = performMapTravel({
      locations: locations.value,
      locationId,
      fast: payload?.fast === true,
      player,
      game,
      eventStore
    })
  } catch (error) {
    restoreStore(player, beforeTravel.player)
    restoreStore(game, beforeTravel.game)
    restoreStore(eventStore, beforeTravel.event)
    traveling.value = false
    console.error('[MapPage] 旅行结算失败', error)
    showNotice('旅行结算失败，请重试', 'error', 5000)
    return
  }

  if (!result.ok) {
    traveling.value = false
    showNotice(result.message, 'warning')
    return
  }

  try {
    sessionStorage.setItem('dldl_pending_travel', JSON.stringify({
      playerId: player.playerId,
      targetId: result.target.id,
      targetName: result.target.name,
      fromName: result.current?.name || '旅途',
      cost: result.cost,
      travelDays: result.travelDays,
      encounterRate: result.encounterRate,
      encounter: Math.random() < result.encounterRate,
      destinationPlan: result.destinationPlan,
      revealed: result.revealed.map(location => location.name)
    }))
    saveToLocal()
  } catch (error) {
    restoreStore(player, beforeTravel.player)
    restoreStore(game, beforeTravel.game)
    restoreStore(eventStore, beforeTravel.event)
    try { sessionStorage.removeItem('dldl_pending_travel') } catch { /* ignore */ }
    traveling.value = false
    console.error('[MapPage] 旅行状态保存失败', error)
    showNotice('旅行状态保存失败，请重试', 'error', 5000)
    return
  }

  ui.notify(`已抵达「${result.target.name}」，旅费 ${result.cost} 金币（路程约 ${result.travelDays} 天）。`, 'success', 5000)
  for (const hidden of result.revealed) {
    ui.notify(`发现隐藏地点：${hidden.name}`, 'gold', 5000)
  }
  router.push('/game')
}

onMounted(async () => {
  if (!player.playerId) {
    const localSave = loadFromLocal()
    if (localSave) deserializeSave(localSave)
  }
  await loadLocations()
})

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
})

function goBack() {
  router.push('/game')
}
</script>

<style scoped>
.map-page { display: flex; flex-direction: column; width: 100%; height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; background: #0b0804; }
.map-topbar { display: grid; grid-template-columns: minmax(130px, 1fr) auto minmax(130px, 1fr); align-items: center; gap: 16px; min-height: 58px; padding: 7px 18px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(34,26,14,.98), rgba(22,16,8,.96)); box-shadow: 0 8px 24px rgba(0,0,0,.32); }
.map-title-wrap { display: grid; justify-items: center; }
.map-title-kicker { color: var(--ink-faint); font-size: 9px; letter-spacing: 4px; }
.map-title { color: var(--gold); font-family: var(--font-display); font-size: 20px; letter-spacing: 5px; }
.nav-link { justify-self: end; color: var(--ink-dim); font-size: 13px; letter-spacing: 1px; }
.btn { min-height: 38px; padding: 7px 16px; border: 1px solid var(--line); border-radius: 3px; background: linear-gradient(180deg, #33291a, #241c0e); color: var(--ink); font-size: 13px; letter-spacing: 1px; }
.btn-back { justify-self: start; }
.btn:hover { border-color: var(--gold); color: var(--gold-hi); }
.map-notice { position: fixed; z-index: 100; top: 68px; left: 50%; max-width: min(88vw,560px); padding: 9px 16px; border: 1px solid var(--info); border-radius: 4px; background: rgba(27,24,16,.97); color: var(--ink); transform: translateX(-50%); box-shadow: 0 8px 28px rgba(0,0,0,.4); }
.map-notice.warning { border-color: var(--gold); color: var(--gold-hi); }
.map-notice.error { border-color: var(--danger); color: #ffb0a5; }
.map-loading { display: grid; place-content: center; justify-items: center; flex: 1; gap: 12px; color: var(--gold); letter-spacing: 2px; }
.map-loading.error span { color: var(--ink-dim); letter-spacing: 0; }
.bridge-notice-enter-active,.bridge-notice-leave-active { transition: opacity .2s ease,transform .2s ease; }
.bridge-notice-enter-from,.bridge-notice-leave-to { opacity: 0; transform: translate(-50%,-8px); }
@media (max-width: 700px) {
  .map-topbar { grid-template-columns: auto 1fr auto; min-height: 50px; padding: 5px 7px; gap: 6px; }
  .map-title-kicker { display: none; }
  .map-title { font-size: 15px; letter-spacing: 2px; }
  .btn { min-height: 44px; padding: 7px 9px; font-size: 11px; }
  .nav-link { font-size: 10px; }
}
</style>
