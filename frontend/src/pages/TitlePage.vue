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
    <p class="title-premise">成为史莱克第八怪，走进属于你的名场面。</p>
    <div class="title-highlights" aria-label="玩法亮点">
      <span>随机武魂</span><span>魂环抉择</span><span>分支冒险</span>
    </div>
    <div class="title-rule"></div>
    <div class="title-menu">
      <button class="btn btn-gold btn-big" @click="startNew">✦ 新的旅程</button>
      <button class="btn btn-big" @click="openSaveList">继续冒险</button>
      <button class="btn btn-big" @click="goCodex">万象图鉴</button>
    </div>

    <RouterLink class="design-entry" to="/design">
      <span>全生命周期数值分析</span><small>流程图 · 数据可视化 · 设计与修复</small><span aria-hidden="true">↗</span>
    </RouterLink>
    <p class="guest-note">无需登录即可开始 · 试玩进度保存在当前浏览器</p>

    <!-- 账号登录（内测期不开放注册，账号由管理员分配） -->
    <div class="login-bar">
      <template v-if="isLoggedIn">
        <span class="login-hello">👤 {{ authUser }}</span>
        <button class="btn login-btn" @click="togglePasswordForm">修改密码</button>
        <button class="btn login-btn" @click="doLogout">退出登录</button>
        <div v-if="showPasswordForm" class="password-form">
          <input
            v-model="oldPassword"
            class="login-input"
            type="password"
            placeholder="当前密码"
            maxlength="128"
            autocomplete="current-password"
          />
          <input
            v-model="newPassword"
            class="login-input"
            type="password"
            placeholder="新密码（至少 6 位）"
            maxlength="128"
            autocomplete="new-password"
          />
          <input
            v-model="newPasswordConfirm"
            class="login-input"
            type="password"
            placeholder="再输入一次新密码"
            maxlength="128"
            autocomplete="new-password"
          />
          <button class="btn login-btn" :disabled="passwordBusy" @click="submitPasswordChange">确认修改</button>
          <button class="btn login-btn" :disabled="passwordBusy" @click="showPasswordForm = false">取消</button>
        </div>
      </template>
      <template v-else>
        <input
          v-model="loginUsername"
          class="login-input"
          type="text"
          placeholder="账号（2-20 位）"
          aria-label="账号"
          maxlength="20"
          autocomplete="username"
          @keyup.enter="doLogin"
        />
        <input
          v-model="loginPassword"
          class="login-input"
          type="password"
          placeholder="密码"
          aria-label="密码"
          maxlength="128"
          autocomplete="current-password"
          @keyup.enter="doLogin"
        />
        <button class="btn login-btn" :disabled="authBusy" @click="doLogin">登录</button>
      </template>
      <span v-if="authMessage" class="login-message">{{ authMessage }}</span>
    </div>

    <div class="title-tip">觉醒你的武魂，让伙伴记住你的选择。</div>
    <div class="title-meta">出身可重选 · 觉醒可无限次 · 登录后可同步云端存档</div>

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

// ---- 账号登录 / 注册 ----
const loginUsername = ref('')
const loginPassword = ref('')
const authBusy = ref(false)
const authMessage = ref('')
const isLoggedIn = computed(() => api.isAuthenticated())
const authUser = computed(() => api.username())

// ---- 修改密码 ----
const showPasswordForm = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')
const passwordBusy = ref(false)

function togglePasswordForm() {
  showPasswordForm.value = !showPasswordForm.value
  oldPassword.value = ''
  newPassword.value = ''
  newPasswordConfirm.value = ''
  authMessage.value = ''
}

async function submitPasswordChange() {
  if (passwordBusy.value) return
  if (!oldPassword.value || !newPassword.value) {
    authMessage.value = '请填写当前密码和新密码'
    return
  }
  if (newPassword.value.length < 6) {
    authMessage.value = '新密码至少 6 位'
    return
  }
  if (newPassword.value !== newPasswordConfirm.value) {
    authMessage.value = '两次输入的新密码不一致'
    return
  }
  passwordBusy.value = true
  authMessage.value = ''
  try {
    await api.changePassword(oldPassword.value, newPassword.value)
    showPasswordForm.value = false
    authMessage.value = '密码修改成功，请牢记新密码'
  } catch (error) {
    authMessage.value = error.message || '修改失败'
  } finally {
    passwordBusy.value = false
  }
}

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

  // 检查云端存档（需已登录；未登录时静默跳过）
  if (api.isAuthenticated()) {
    await refreshCloudSaves()
  }
})

async function refreshCloudSaves() {
  try {
    const result = await api.listSaves()
    cloudSaves.value = result.list || []
    hasCloudSave.value = cloudSaves.value.length > 0
  } catch (error) {
    // 未登录（401）或后端未启动时静默降级
    cloudSaves.value = []
    hasCloudSave.value = false
  }
}

async function doLogin() {
  if (authBusy.value) return
  const name = loginUsername.value.trim()
  if (!name || !loginPassword.value) {
    authMessage.value = '请输入账号和密码'
    return
  }
  authBusy.value = true
  authMessage.value = ''
  try {
    await api.login(name, loginPassword.value)
    loginPassword.value = ''
    await refreshCloudSaves()
  } catch (error) {
    authMessage.value = error.message || '登录失败'
  } finally {
    authBusy.value = false
  }
}


function doLogout() {
  api.logout()
  cloudSaves.value = []
  hasCloudSave.value = false
  authMessage.value = ''
}

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

  // 重新拉取最新云端存档列表（未登录时只展示本地）
  await refreshCloudSaves()

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

  // 云端存档：需先登录账号，再读取（只允许读本人名下存档）
  if (!api.isAuthenticated()) {
    authMessage.value = '请先登录账号，再读取云端存档'
    return
  }

  try {
    const result = await loadFromCloud(api, save.playerId)
    if (result.success) {
      router.push('/game')
      return
    }
    if (result.needLogin) {
      authMessage.value = result.error || '请先登录账号'
      return
    }
    // 云端加载失败，如果有本地存档则回退
    if (hasLocalSave.value) {
      router.push('/game')
      return
    }
  } catch {
    // 加载失败，回退本地
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

/* ============ 账号登录栏 ============ */
.login-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
  width: min(420px, 85vw);
}
.login-hello {
  color: var(--gold-hi);
  font-size: 15px;
  letter-spacing: 2px;
}
.login-input {
  flex: 1;
  min-width: 120px;
  max-width: 160px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 14px;
  letter-spacing: 1px;
  transition: border-color 0.2s;
}
.login-input:focus {
  outline: none;
  border-color: var(--gold);
}
.login-input::placeholder {
  color: var(--ink-dim);
}
.login-btn {
  padding: 8px 18px;
  font-size: 14px;
  letter-spacing: 2px;
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  color: var(--ink);
}
.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.login-message {
  width: 100%;
  text-align: center;
  color: #ffb86b;
  font-size: 12.5px;
  letter-spacing: 1px;
  min-height: 16px;
}
.password-form {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.title-tip {
  margin-top: 20px;
  font-size: 14px;
  color: var(--ink-dim);
  letter-spacing: 2px;
}
.title-meta {
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--ink-dim);
  letter-spacing: 1px;
}

.title-premise { margin-top: 10px; padding-inline: 12px; color: var(--ink); font-size: 15px; line-height: 1.7; }
.title-highlights { display: flex; gap: 18px; margin-top: 12px; color: var(--ink-dim); font-size: 12px; letter-spacing: 2px; }
.title-highlights span + span { border-left: 1px solid var(--line-strong); padding-left: 18px; }
.design-entry { display: grid; grid-template-columns: 1fr auto; gap: 4px 14px; align-items: center; width: min(340px, 85vw); margin-top: 14px; padding: 12px 16px; border: 1px solid var(--line-strong); border-radius: 4px; background: rgba(201, 168, 76, 0.07); text-align: left; color: var(--gold-hi); }
.design-entry small { grid-column: 1; color: var(--ink-dim); font-size: 12px; }
.design-entry > span:last-child { grid-column: 2; grid-row: 1 / 3; font-size: 23px; }
.design-entry:hover { border-color: var(--gold-hi); background: rgba(201, 168, 76, 0.13); }
.design-entry:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 4px; }
.guest-note { margin-top: 10px; padding-inline: 8px; font-size: 12px; line-height: 1.6; color: var(--ink); }
@media (max-height: 850px) {
  .title-screen { padding-block: 16px; }
  .title-screen .game-logo { font-size: clamp(40px, 9vh, 70px); }
  .title-screen .game-slogan { margin: 8px 0 0; font-size: 20px; }
  .title-screen .title-rule { margin: 12px auto 2px; }
  .title-screen .title-menu { gap: 9px; margin-top: 10px; }
  .title-screen .title-menu .btn-big { padding: 11px 20px; font-size: 18px; }
  .title-screen .title-tip { margin-top: 12px; }
  .title-screen .title-highlights { margin-top: 8px; }
}
@media (max-height: 670px) {
  .title-screen .title-highlights, .title-screen .title-tip, .title-screen .title-meta { display: none; }
  .title-screen .title-premise { font-size: 13px; }
  .title-screen .design-entry { padding-block: 8px; }
}
@media (max-height: 520px) {
  .title-screen { justify-content: flex-start; overflow-y: auto; }
  .title-screen > :not(.title-rune) { flex-shrink: 0; }
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
