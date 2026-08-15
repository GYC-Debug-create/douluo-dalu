<template>
  <div class="codex-page">
    <div class="map-topbar">
      <button class="btn btn-back" @click="goBack">← 返回游戏</button>
      <span class="map-title">斗罗大陆 · 万象图鉴</span>
      <router-link to="/map" class="nav-link">万象地图 →</router-link>
    </div>
    <iframe ref="codexFrame" :src="codexUrl" class="map-iframe" title="万象图鉴"></iframe>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useGameStore } from '@/stores/game'
import { useCombatStore } from '@/stores/combat'
import { isTrustedFrameMessage, routeForFrameView } from '@/utils/mapBridge'

const router = useRouter()
const codexFrame = ref(null)
const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
const codexUrl = computed(() => {
  return `${baseUrl}codex.html`
})

function sendPlayerSummary() {
  // T16 判例25：图鉴与存档联动——向 iframe 传递玩家进度摘要，
  // codex.html 据此标记"已见/已收集"并按等级点亮获取条件。
  const frame = codexFrame.value
  if (!frame?.contentWindow) return
  const player = usePlayerStore()
  const game = useGameStore()
  const combat = useCombatStore()
  frame.contentWindow.postMessage({
    type: 'player-summary',
    level: player.level || 1,
    spiritName: player.spirit?.name || '',
    metNpcs: game._metNpcs || [],
    rings: (player.rings || []).map(ring => ring.ringId || ring.tier),
    knownBeasts: Object.keys(combat.huntingKnowledge?.beasts || {}),
    bones: player._bones || []
  }, window.location.origin)
}

function onFrameMessage(event) {
  if (!isTrustedFrameMessage(event, codexFrame.value)) return
  if (event.data.type === 'ready') {
    sendPlayerSummary()
    return
  }
  if (event.data.type !== 'navigate') return
  const route = routeForFrameView(event.data.view, ['game', 'map'])
  if (route) router.push(route)
}

onMounted(() => {
  window.addEventListener('message', onFrameMessage)
  // iframe 可能先于监听就绪，延迟补发一次摘要
  setTimeout(sendPlayerSummary, 800)
})
onBeforeUnmount(() => window.removeEventListener('message', onFrameMessage))

function goBack() {
  router.push('/game')
}
</script>

<style scoped>
.codex-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
.map-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(30, 24, 14, 0.9);
  backdrop-filter: blur(8px);
}
.map-title {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold);
  letter-spacing: 3px;
  flex: 1;
  text-align: center;
}
.nav-link {
  color: var(--ink-dim);
  font-size: 14px;
  letter-spacing: 1px;
  transition: color 0.2s;
}
.nav-link:hover {
  color: var(--gold-hi);
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
.btn:hover {
  border-color: var(--gold);
  color: var(--gold-hi);
}
.map-iframe {
  flex: 1;
  width: 100%;
  border: none;
  min-height: 0;
  background: var(--bg-deep);
}
</style>
