<template>
  <div class="title-screen">
    <!-- 灵力粒子流 -->
    <ParticleBackground />

    <!-- 浮动符文背景 -->
    <div class="title-rune" style="top:8%;left:10%;animation-delay:0s">魂</div>
    <div class="title-rune" style="top:15%;right:12%;animation-delay:-5s">力</div>
    <div class="title-rune" style="bottom:20%;left:15%;animation-delay:-10s">环</div>
    <div class="title-rune" style="bottom:12%;right:10%;animation-delay:-15s">骨</div>
    <div class="title-rune" style="top:40%;left:5%;animation-delay:-7s">师</div>
    <div class="title-rune" style="top:50%;right:6%;animation-delay:-12s">神</div>

    <div class="game-logo">
      <span class="logo-char">斗</span>
      <span class="logo-char">罗</span>
      <span class="logo-char">大</span>
      <span class="logo-char">陆</span>
    </div>
    <div class="game-slogan">武 魂 觉 醒</div>
    <div class="title-rule"></div>
    <div class="title-menu">
      <button class="btn btn-gold btn-big" @click="startNew">✦ 新的旅程</button>
      <button class="btn btn-big" @click="openSaveList">继续冒险</button>
      <button class="btn btn-big" @click="goCodex">万象图鉴</button>
    </div>
    <div class="title-tip">一场属于你的魂师传奇，即将展开……</div>
    <div class="title-meta">新手入门约 2 分钟 · 出身可重选 · 觉醒可无限次</div>

    <!-- 存档选择弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSaveList" class="save-overlay" @click.self="showSaveList = false">
          <div class="save-modal">
            <div class="save-modal-header">
              <span class="save-modal-title">选择存档</span>
              <button class="save-close" @click="showSaveList = false">✕</button>
            </div>
            <div class="save-modal-body">
              <!-- 加载中 -->
              <div v-if="loadingSaves" class="save-loading">
                <div class="save-loading-spinner"></div>
                <span>正在读取存档列表…</span>
              </div>

              <!-- 存档列表 -->
              <div v-else-if="allSaves.length > 0" class="save-list">
                <div
                  v-for="save in allSaves"
                  :key="save.key"
                  class="save-item"
                  :class="{ local: save.source === '本地' }"
                  @click="selectSave(save)"
                >
                  <div class="save-item-left">
                    <div class="save-item-icon">{{ save.spiritIcon || '✦' }}</div>
                    <div class="save-item-info">
                      <div class="save-item-name">{{ save.name }}</div>
                      <div class="save-item-detail">
                        <span>Lv.{{ save.level }}</span>
                        <span>{{ save.spiritName || '未知武魂' }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="save-item-right">
                    <span class="save-tag" :class="save.source === '云端' ? 'cloud' : 'local'">{{ save.source }}</span>
                    <span v-if="save.lastSave" class="save-time">{{ formatTime(save.lastSave) }}</span>
                  </div>
                </div>
              </div>

              <!-- 空列表 -->
              <div v-else class="save-empty">
                <div class="save-empty-icon">📜</div>
                <p>暂无存档记录</p>
                <button class="btn btn-gold" @click="startNew">开始新的旅程</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameData } from '@/composables/useGameData'
import { useApi } from '@/composables/useApi'
import { loadFromLocal, loadFromCloud } from '@/stores/serializer'
import { ORIGINS } from '@/data/game-data'
import { newJourneyDraft } from '@/utils/creation-pity'
import ParticleBackground from '@/components/ParticleBackground.vue'

const router = useRouter()
const { loadAll } = useGameData()
const api = useApi()

const hasLocalSave = ref(false)
const hasCloudSave = ref(false)
const showSaveList = ref(false)
const loadingSaves = ref(false)
const cloudSaves = ref([])
const localSave = ref(null)

const hasAnySave = computed(() => hasLocalSave.value || hasCloudSave.value)

const allSaves = computed(() => {
  const list = []

  // 本地存档
  if (localSave.value) {
    list.push({
      key: 'local',
      source: '本地',
      playerId: localSave.value.playerId || '',
      name: localSave.value.name || '未知',
      level: localSave.value.level || 1,
      spiritName: localSave.value.spirit?.name || (typeof localSave.value.spirit === 'string' ? localSave.value.spirit : ''),
      spiritIcon: localSave.value.spirit?.icon || '✦',
      lastSave: localSave.value.lastSave || null
    })
  }

  // 云端存档
  for (const cs of cloudSaves.value) {
    // 同一角色也保留两个显式入口，禁止把刚旅行/事件后的较新本地档
    // 悄悄替换成可能滞后的云端档。
    list.push({
      key: 'cloud_' + cs.playerId,
      source: '云端',
      playerId: cs.playerId,
      name: cs.name || '未知',
      level: cs.level || 1,
      spiritName: typeof cs.spirit === 'string' ? cs.spirit : (cs.spirit?.name || ''),
      spiritIcon: typeof cs.spirit === 'object' ? cs.spirit?.icon : '✦',
      lastSave: cs.lastSave || null
    })
  }

  return list
})

onMounted(async () => {
  await loadAll()

  // 检查本地存档
  localSave.value = loadFromLocal()
  if (localSave.value && localSave.value.name && localSave.value.spirit) {
    hasLocalSave.value = true
  }

  // 检查云端存档
  try {
    const result = await api.listSaves()
    cloudSaves.value = result.list || []
    hasCloudSave.value = cloudSaves.value.length > 0
  } catch {
    // 后端未启动时静默忽略
  }
})

function startNew() {
  // “新的旅程”视为明确开始新角色：建立全新创建草稿（四个出身保底全部清零），
  // 并删除旧全局保底键，不继承上一角色/上一存档的任何保底。
  try {
    newJourneyDraft(window.localStorage, ORIGINS.map(o => o.id))
  } catch {
    // 存储不可用时仍继续进入创建页，创建页会以内存草稿继续。
  }
  router.push('/create')
}

function goCodex() {
  router.push('/codex')
}

async function openSaveList() {
  showSaveList.value = true
  loadingSaves.value = true

  // 重新拉取最新云端存档列表
  try {
    const result = await api.listSaves()
    cloudSaves.value = result.list || []
    hasCloudSave.value = cloudSaves.value.length > 0
  } catch {
    // 忽略
  }

  // 重新检查本地
  localSave.value = loadFromLocal()
  if (localSave.value && localSave.value.name && localSave.value.spirit) {
    hasLocalSave.value = true
  }

  loadingSaves.value = false
}

async function selectSave(save) {
  showSaveList.value = false

  if (save.source === '本地') {
    // 本地存档直接进入游戏
    router.push('/game')
    return
  }

  // 云端存档：认证 -> 加载 -> 进入游戏
  try {
    await api.authenticate(save.playerId, save.name)
    const result = await loadFromCloud(api, save.playerId)
    if (result.success) {
      router.push('/game')
      return
    }
    // 云端加载失败，如果有本地存档则回退
    if (hasLocalSave.value) {
      router.push('/game')
      return
    }
  } catch {
    // 认证/加载失败，回退本地
    if (hasLocalSave.value) {
      router.push('/game')
      return
    }
  }

  // 全部失败，跳转创建
  router.push('/create')
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  try {
    const d = new Date(timeStr)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>

<style scoped>
.title-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  text-align: center;
  padding: 40px 20px;
  background:
    radial-gradient(ellipse at 50% 30%, rgba(201, 168, 76, 0.08), transparent 60%),
    radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.5));
}

@media (max-height: 760px) {
  .title-screen { padding-block: 14px; }
  .game-logo { font-size: clamp(42px, 10vh, 70px); }
  .game-slogan { margin: 8px 0 4px; font-size: clamp(15px, 3vh, 21px); }
  .title-rule { margin: 10px auto; }
  .title-menu { gap: 9px; margin-top: 8px; }
  .title-menu .btn { min-height: 40px; padding-block: 8px; }
  .title-menu .btn-big { padding-block: 10px; font-size: 17px; }
  .title-tip { margin-top: 14px; }
}

.title-rune {
  position: absolute;
  font-family: var(--font-display);
  font-size: 28px;
  color: rgba(201, 168, 76, 0.08);
  pointer-events: none;
  animation: runeFloat 8s ease-in-out infinite alternate;
}
@keyframes runeFloat {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.08; }
  50% { transform: translateY(-20px) rotate(5deg); opacity: 0.15; }
  100% { transform: translateY(10px) rotate(-3deg); opacity: 0.06; }
}

.game-logo {
  font-family: var(--font-display);
  font-size: clamp(52px, 10vw, 96px);
  color: var(--gold);
  letter-spacing: 10px;
  line-height: 1.15;
  text-shadow: 0 0 40px rgba(201, 168, 76, 0.35), 0 4px 8px rgba(0, 0, 0, 0.7);
  animation: logoGlow 3s ease-in-out infinite alternate;
}
.logo-char {
  transition: text-shadow 0.5s ease;
}
.title-screen:hover .logo-char {
  text-shadow: 0 0 26px rgba(201, 168, 76, 0.85), 0 0 52px rgba(201, 168, 76, 0.4);
}
@keyframes logoGlow {
  from { text-shadow: 0 0 30px rgba(201, 168, 76, 0.25), 0 4px 8px rgba(0, 0, 0, 0.7); }
  to { text-shadow: 0 0 55px rgba(201, 168, 76, 0.5), 0 4px 8px rgba(0, 0, 0, 0.7); }
}

.game-slogan {
  font-family: var(--font-display);
  font-size: clamp(18px, 3vw, 26px);
  color: var(--ink-dim);
  letter-spacing: 6px;
  margin: 18px 0 8px;
}

.title-rule {
  width: 160px;
  height: 2px;
  margin: 20px auto;
  position: relative;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
}
.title-rule::after {
  content: '❖';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--gold);
  font-size: 13px;
  background: var(--bg);
  padding: 0 10px;
}

.title-menu {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
  width: min(340px, 85vw);
}
.title-menu .btn {
  position: relative;
  transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
  display: inline-block;
  min-height: 48px;
  padding: 12px 30px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: linear-gradient(180deg, #33291a, #241c0e);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 17px;
  letter-spacing: 3px;
  cursor: pointer;
}
.title-menu .btn-big {
  font-size: 20px;
  padding: 16px 44px;
  letter-spacing: 4px;
}
.title-menu .btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(201, 168, 76, 0.22), 0 0 18px rgba(201, 168, 76, 0.12);
  border-color: var(--gold);
  color: var(--gold-hi);
}
.title-menu .btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}
.title-menu .btn-gold {
  border-color: var(--gold);
  color: var(--gold-hi);
}

.title-tip {
  margin-top: 36px;
  font-size: 14px;
  color: var(--ink-dim);
  letter-spacing: 2px;
}
.title-meta {
  margin-top: 8px;
  font-size: 11.5px;
  color: #6b5e42;
  letter-spacing: 1px;
}

/* ============ 存档选择弹窗 ============ */
.save-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.save-modal {
  width: min(520px, 92vw);
  max-height: 80vh;
  background: linear-gradient(180deg, #1e1810, #15110a);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(201, 168, 76, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.save-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(201, 168, 76, 0.04);
}
.save-modal-title {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold);
  letter-spacing: 3px;
}
.save-close {
  background: none;
  border: none;
  color: var(--ink-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.save-close:hover {
  color: var(--gold-hi);
  background: rgba(201, 168, 76, 0.1);
}

.save-modal-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px 20px;
}

.save-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 0;
  color: var(--ink-dim);
  font-size: 14px;
}
.save-loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--line);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.save-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.save-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(36, 28, 14, 0.5);
  cursor: pointer;
  transition: all 0.2s;
}
.save-item:hover {
  border-color: var(--gold);
  background: rgba(201, 168, 76, 0.08);
  transform: translateX(4px);
}
.save-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.save-item-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.3);
}
.save-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.save-item-name {
  font-size: 16px;
  color: var(--ink);
  font-weight: 500;
}
.save-item-detail {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: var(--ink-dim);
}
.save-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.save-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  letter-spacing: 1px;
}
.save-tag.cloud {
  background: rgba(100, 160, 255, 0.15);
  color: #88ccff;
  border: 1px solid rgba(100, 160, 255, 0.3);
}
.save-tag.local {
  background: rgba(201, 168, 76, 0.12);
  color: var(--gold-hi);
  border: 1px solid rgba(201, 168, 76, 0.3);
}
.save-time {
  font-size: 11px;
  color: #6b5e42;
}

.save-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 0;
  color: var(--ink-dim);
}
.save-empty-icon {
  font-size: 48px;
  opacity: 0.5;
}
.save-empty p {
  font-size: 15px;
}
.save-empty .btn {
  display: inline-block;
  min-height: 40px;
  padding: 8px 24px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  background: rgba(201, 168, 76, 0.08);
  color: var(--gold-hi);
  font-size: 15px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.25s;
}
.save-empty .btn:hover {
  background: rgba(201, 168, 76, 0.15);
  transform: translateY(-1px);
}

/* 弹窗过渡 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 480px) {
  .save-modal {
    width: 96vw;
    max-height: 85vh;
  }
  .save-item {
    padding: 10px 12px;
  }
  .save-item-icon {
    width: 36px;
    height: 36px;
    font-size: 22px;
  }
  .save-item-name {
    font-size: 14px;
  }
  .save-item-detail {
    font-size: 12px;
  }
}
</style>
