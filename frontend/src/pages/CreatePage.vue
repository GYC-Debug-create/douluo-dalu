<template>
  <div class="create-screen">
    <div class="create-box" :class="{ 'is-awaken-step': step === 3 }">
      <!-- 步骤指示器 -->
      <div class="step-dots">
        <div class="step-dot" :class="{ on: step >= 1 }"></div>
        <div class="step-dot" :class="{ on: step >= 2 }"></div>
        <div class="step-dot" :class="{ on: step >= 3 }"></div>
      </div>

      <!-- 第一步：名字 -->
      <Transition :name="transitionName" mode="out-in">
        <div v-if="step === 1" key="name" class="create-step">
          <div class="step-title">写下你的名字</div>
          <div class="step-sub">小魂师，你叫什么名字？（2 ~ 8 个字）</div>
          <div class="name-input-row">
            <input
              v-model="playerName"
              class="name-input"
              aria-label="魂师名字"
              autocomplete="off"
              maxlength="8"
              placeholder="例如：小风…"
              @keyup.enter="goStep2"
            />
          </div>
          <div class="name-err">{{ nameError }}</div>
          <div class="create-actions">
            <button class="btn" @click="goBack">← 返回</button>
            <button class="btn btn-gold" @click="goStep2">下一步 →</button>
          </div>
        </div>

        <!-- 第二步：出身 -->
        <div v-else-if="step === 2" key="origin" class="create-step">
          <div class="step-title">选择你的出身</div>
          <div class="step-sub">不同的出身，会带来不同的先天属性与故事起点（标「新手推荐」者节奏更平稳）</div>
          <div class="origin-grid">
            <button
              v-for="origin in origins"
              :key="origin.id"
              class="origin-card"
              :class="{ picked: selectedOrigin?.id === origin.id }"
              @click="selectOrigin(origin)"
            >
              <span v-if="origin.qualityBoost" class="origin-tag">新手推荐</span>
              <div class="oc-banner">
                <img v-if="origin.image" :src="origin.image" :alt="origin.name" loading="lazy" decoding="async" />
              </div>
              <div class="oc-body">
                <div class="oc-name">{{ origin.name }}</div>
                <div class="oc-desc">{{ origin.desc }}</div>
                <div class="oc-bonus">{{ origin.bonus }}</div>
              </div>
            </button>
          </div>
          <div class="create-actions">
            <button class="btn" @click="step = 1">← 上一步</button>
            <button class="btn btn-gold" :disabled="!selectedOrigin" @click="goStep3">进行武魂觉醒 →</button>
          </div>
        </div>

        <!-- 第三步：武魂觉醒 -->
        <div v-else key="awaken" class="create-step">
          <div class="step-title">武魂觉醒仪式</div>
          <div class="step-sub">觉醒台上金光闪耀，你的武魂即将现身…… 觉醒完成后，即可踏上学院历练之旅</div>
          <div class="awaken-stage" :class="{ 'has-result': spiritRevealed, 'is-rerolling': rerollActive }" :aria-busy="rerollActive">
            <!-- 顶级/神级武魂轮播装饰（纯视觉，不参与抽取、保底或属性计算） -->
            <div
              v-for="side in carouselSides"
              :key="side"
              class="carousel-group"
              :class="'carousel-' + side"
              aria-hidden="true"
            >
              <div
                v-for="(slot, index) in sideSlots(side)"
                :key="index"
                class="carousel-cell"
                :class="carouselSlotClass(index)"
              >
                <Transition name="cshift" mode="out-in">
                  <img
                    v-if="slot"
                    :key="slot.id"
                    class="carousel-slot"
                    :src="slot.image"
                    alt=""
                    :data-spirit-id="slot.id"
                    :data-tier="slot.tier"
                    loading="lazy"
                    decoding="async"
                    @error="onImgError"
                  />
                </Transition>
              </div>
            </div>
            <!-- 外圈光环 -->
            <div class="altar-ring r1" :class="{ reveal: awakenRevealed }"></div>
            <div class="altar-ring r2" :class="{ reveal: awakenRevealed }"></div>
            <div class="altar-ring r3" :class="{ reveal: awakenRevealed }"></div>
            <!-- 光束 -->
            <div class="light-rays" :class="{ reveal: awakenRevealed }"></div>
            <!-- 六芒星阵 -->
            <div class="magic-circle" :class="{ reveal: awakenRevealed }">
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.6"/>
                <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" stroke-width="0.3" opacity="0.4"/>
                <circle cx="100" cy="100" r="65" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.5" stroke-dasharray="4 3"/>
                <polygon points="100,10 177,145 23,145" fill="none" stroke="currentColor" stroke-width="1" opacity="0.7"/>
                <polygon points="100,190 23,55 177,55" fill="none" stroke="currentColor" stroke-width="1" opacity="0.7"/>
                <circle cx="100" cy="10" r="3" fill="currentColor" opacity="0.8"/>
                <circle cx="177" cy="145" r="3" fill="currentColor" opacity="0.8"/>
                <circle cx="23" cy="145" r="3" fill="currentColor" opacity="0.8"/>
                <circle cx="100" cy="190" r="3" fill="currentColor" opacity="0.8"/>
                <circle cx="23" cy="55" r="3" fill="currentColor" opacity="0.8"/>
                <circle cx="177" cy="55" r="3" fill="currentColor" opacity="0.8"/>
                <text x="100" y="25" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.6" font-family="serif">武</text>
                <text x="165" y="140" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.6" font-family="serif">魂</text>
                <text x="35" y="140" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.6" font-family="serif">觉</text>
                <text x="100" y="185" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.6" font-family="serif">醒</text>
                <text x="35" y="60" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.6" font-family="serif">天</text>
                <text x="165" y="60" text-anchor="middle" fill="currentColor" font-size="8" opacity="0.6" font-family="serif">赋</text>
              </svg>
            </div>
            <!-- 中心圆盘 -->
            <div class="awaken-img-wrap" :class="{ reveal: spiritRevealed }">
              <div v-if="!spiritRevealed" class="awaken-seal" role="img" aria-label="待觉醒的魂印">
                <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle class="seal-orbit seal-orbit-outer" cx="60" cy="60" r="46" />
                  <circle class="seal-orbit seal-orbit-inner" cx="60" cy="60" r="33" />
                  <path class="seal-rune" d="M60 18 76 44 102 60 76 76 60 102 44 76 18 60 44 44Z" />
                  <path class="seal-rune seal-rune-inner" d="M60 34 86 60 60 86 34 60Z" />
                  <circle class="seal-core" cx="60" cy="60" r="10" />
                  <circle class="seal-node" cx="60" cy="14" r="3" />
                  <circle class="seal-node" cx="106" cy="60" r="3" />
                  <circle class="seal-node" cx="60" cy="106" r="3" />
                  <circle class="seal-node" cx="14" cy="60" r="3" />
                </svg>
                <span>魂印待启</span>
              </div>
              <template v-else>
                <img
                  v-if="awakenedSpirit?.image"
                  :src="awakenedSpirit.image"
                  :alt="awakenedSpirit.name"
                  decoding="async"
                  @error="onImgError"
                />
                <div v-else class="awaken-q-reveal" :style="{ color: tierColor }">
                  {{ awakenedSpirit?.icon || '✦' }}
                </div>
              </template>
            </div>

            <!-- 觉醒信息 -->
            <div id="awaken-info" :class="{ 'is-concealed': !spiritRevealed, 'is-revealed': spiritRevealed }">
              <div><span class="awaken-tier" :style="{ color: tierColor, borderColor: tierColor }">{{ tierName }}</span></div>
              <div class="awaken-name">{{ awakenedSpirit?.name }}</div>
              <div class="awaken-stats">
                <div class="awaken-stat">先天魂力 <b>{{ innatePower }}{{ innatePower >= 100 ? '（满魂力！）' : '' }}</b></div>
                <div class="awaken-stat">起始等级 <b>Lv.{{ initialSoulLevel }}</b></div>
                <div class="awaken-stat">攻击 <b>{{ previewStatValues.attack }}</b></div>
                <div class="awaken-stat">防御 <b>{{ previewStatValues.defense }}</b></div>
                <div class="awaken-stat">生命 <b>{{ previewStatValues.hp }}</b></div>
                <div class="awaken-stat">速度 <b>{{ previewStatValues.speed }}</b></div>
              </div>
              <div
                class="awaken-ring-ready"
                :class="{ 'is-placeholder': initialSoulLevel < 10 }"
                role="status"
                :aria-hidden="initialSoulLevel < 10"
              >
                第一魂环猎取资格已解锁 · 当前尚未获得魂环
              </div>
              <div class="awaken-desc">
                <div class="awaken-desc-head">武魂志 · 完整记载</div>
                <p v-for="(paragraph, index) in awakenDescParagraphs" :key="index" class="awaken-desc-p">{{ paragraph }}</p>
              </div>
            </div>
            <div class="awaken-left" :class="{ 'is-concealed': !spiritRevealed, 'is-revealed': spiritRevealed }">
              <template v-if="innatePower >= 100">
                <b style="color:#ffd700">✦ 先天满魂力！万年不遇的天才！✦</b><br />可无限次重新觉醒
              </template>
              <template v-else>
                可无限次重新觉醒
              </template>
              <br />{{ selectedOrigin?.name }}神级保底：{{ currentPity }} / {{ PITY_LIMIT }}
              <template v-if="currentPity >= PITY_LIMIT">
                <br /><b style="color:#fbbf24">✦ 神级保底已解锁，可自行选择一个神级武魂！</b>
              </template>
              <template v-if="otherOriginsPity.length">
                <br /><span class="awaken-other-pity">其他出身：{{ otherOriginsPity.map(item => item.name + ' ' + item.count + '/' + PITY_LIMIT).join('、') }}</span>
              </template>
            </div>

            <!-- BUG-DIALOG-005 快速重抽处理提示（绝对定位，不改变结果区与操作条尺寸） -->
            <div v-if="rerollActive" class="reroll-hint" role="status" aria-live="polite">
              <b>连续重抽中…</b>
              <span>停止点击后显示最新结果</span>
            </div>

            <div class="create-actions awaken-actions">
              <button class="btn" @click="step = 2">← 重新选择出身</button>
              <button v-if="!spiritRevealed" class="btn" @click="doAwaken()">✦ 开始觉醒 ✦</button>
              <template v-else>
                <button class="btn" :disabled="stopLocked" @click="rerollAwaken()">重新觉醒</button>
                <button v-if="currentPity >= PITY_LIMIT && !showGodPicker" class="btn btn-gold" :disabled="rerollActive" @click="openGodPicker">✦ 自选神级武魂 ✦</button>
                <button class="btn btn-gold" :disabled="rerollActive" @click="confirmSpirit">就是它了！→</button>
              </template>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 神级武魂选择弹窗（BUG-DIALOG-004 方案C：列表 → 独立详情 → 确认选择） -->
      <ModalDialog v-model="showGodPicker" title="选择神级武魂" :closable="true" panel-class="is-wide">
        <div ref="godPickerBody" class="god-picker-body">
          <div v-if="godPickerView === 'list'" class="god-picker-grid" aria-label="神级武魂列表">
            <button
              v-for="spirit in godSpirits"
              :key="spirit.id"
              class="god-pick-card"
              :data-spirit-id="spirit.id"
              @click="openGodDetail(spirit)"
            >
              <div class="gpc-icon">{{ spirit.icon || '✦' }}</div>
              <div class="gpc-name">{{ spirit.name }}</div>
              <div class="gpc-desc">{{ spirit.desc?.slice(0, 40) }}…</div>
              <div class="gpc-action">查看详情 →</div>
            </button>
          </div>
          <div v-else-if="previewedGodSpirit" class="god-dossier">
            <div class="god-dossier-back-row">
              <button ref="godDetailBackBtn" class="god-dossier-back" @click="backToGodList">← 返回神级武魂列表</button>
            </div>
            <div class="god-dossier-main">
              <div class="god-dossier-image">
                <img
                  v-if="previewedGodSpirit.image"
                  :src="previewedGodSpirit.image"
                  :alt="previewedGodSpirit.name"
                  @error="onImgError"
                />
                <div v-else class="god-dossier-icon">{{ previewedGodSpirit.icon || '✦' }}</div>
              </div>
              <div class="god-dossier-body">
                <div class="god-dossier-kicker">神级武魂</div>
                <h3 class="god-dossier-name">{{ previewedGodSpirit.name }}</h3>
                <div class="god-dossier-desc">
                  <p v-for="(paragraph, index) in splitSpiritDescription(previewedGodSpirit?.desc)" :key="index" class="god-dossier-p">{{ paragraph }}</p>
                </div>
                <button class="btn btn-gold god-dossier-confirm" @click="pickGodSpirit(previewedGodSpirit)">确认选择「{{ previewedGodSpirit.name }}」</button>
              </div>
            </div>
          </div>
        </div>
      </ModalDialog>
    </div>
  </div>
</template>
<script>
// 觉醒轮播/介绍分段/快速重抽的纯函数与常量已下沉 composables/useAwakening.js;
// 此处 re-export 维持 create-awakening-ui.test.js 对本模块的导入契约。
export {
  buildCarouselPool,
  carouselOffset,
  carouselSlots,
  alignedCarouselStarts,
  splitSpiritDescription,
  SHORT_DESC_LIMIT,
  RAPID_REVEAL_DELAY_MS,
  RARE_STOP_HOLD_MS,
  PITY_CAP,
  shouldStopRapidReroll
} from '@/composables/useAwakening'
</script>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ORIGINS } from '@/data/game-data'
import { useGameData } from '@/composables/useGameData'
import { useGameRules } from '@/composables/useGameRules'
import { useUiStore } from '@/stores/ui'
import { initialLevelFromInnatePower, initNewCharacter, saveToLocal, saveToCloud } from '@/stores/serializer'
import { useApi } from '@/composables/useApi'
import ModalDialog from '@/components/ModalDialog.vue'
import {
  PITY_LIMIT,
  clearDraft,
  removeLegacyKey,
  incrementOriginCount,
  resetOriginCount
} from '@/utils/creation-pity'
import {
  buildCarouselPool,
  carouselSlots,
  alignedCarouselStarts,
  splitSpiritDescription,
  shouldStopRapidReroll,
  RAPID_REVEAL_DELAY_MS,
  RARE_STOP_HOLD_MS,
  useAwakeningPity
} from '@/composables/useAwakening'

const router = useRouter()
const { data, loadAll } = useGameData()
const { TIER_NAMES, TIER_COLORS, previewStats: calcPreview, rollSpiritTier, pick } = useGameRules()
const ui = useUiStore()

const originIds = ORIGINS.map(o => o.id)

// localStorage 访问本身也可能抛错（如隐私模式），一律兜底为 null。
let storage = null
try {
  storage = typeof window !== 'undefined' ? window.localStorage : null
} catch { /* ignore */ }

const origins = ORIGINS
const step = ref(1)
const transitionName = ref('slide-forward')
const playerName = ref('')
const nameError = ref('')
const selectedOrigin = ref(null)
const awakenedSpirit = ref(null)
const awakenRevealed = ref(false)
const spiritRevealed = ref(false)
const innatePower = ref(0)
const showGodPicker = ref(false)

// ============ BUG-DIALOG-004 方案C：神级武魂选择 ============
// 列表层与详情层是弹窗内的两个视图；只有详情层的“确认选择”才调用既有 pickGodSpirit。
const godPickerView = ref('list')
const previewedGodSpirit = ref(null)
const godPickerBody = ref(null)
const godDetailBackBtn = ref(null)

const awakenDescParagraphs = computed(() => splitSpiritDescription(awakenedSpirit.value?.desc))

// 创建期神级保底草稿（按出身隔离）：进入创建页时已有草稿则恢复，无草稿则新建全 0 草稿；
// 读取的同时删除旧全局键 dldl_god_spirit_pity（不迁移）。逻辑在 useAwakening.js。
const { pityDraft, currentPity, pityOf, otherOriginsPity, updatePity } = useAwakeningPity(storage, selectedOrigin)

const tierName = computed(() => awakenedSpirit.value ? TIER_NAMES[awakenedSpirit.value.tier] || '' : '')
const tierColor = computed(() => awakenedSpirit.value ? TIER_COLORS[awakenedSpirit.value.tier] || '#c9a84c' : '#c9a84c')
const initialSoulLevel = computed(() => initialLevelFromInnatePower(innatePower.value))

const previewStatValues = computed(() => {
  if (!awakenedSpirit.value || !selectedOrigin.value) return { attack: 0, defense: 0, hp: 0, speed: 0 }
  return calcPreview(awakenedSpirit.value, selectedOrigin.value, initialSoulLevel.value)
})

const godSpirits = computed(() => (data.value.spirits || []).filter(s => s.tier === 'god'))

// ============ BUG-DIALOG-002：顶级/神级武魂双侧轮播（纯装饰，单一计时器） ============
const CAROUSEL_TICK_MS = 3200
const carouselPool = computed(() => buildCarouselPool(data.value.spirits))
const carouselSides = ['left', 'right']
const carouselLeftStart = ref(0)
const carouselRightStart = ref(0)
let carouselTimer = null
let carouselTurn = 0
const preloadedUrls = new Set()

const sideSlots = side => carouselSlots(carouselPool.value, side === 'right' ? carouselRightStart.value : carouselLeftStart.value)
const carouselSlotClass = index => ['carousel-top', 'carousel-main', 'carousel-bottom'][index] || 'carousel-slot'

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch { return false }
}

function preloadImage(url) {
  if (!url || preloadedUrls.has(url)) return
  preloadedUrls.add(url)
  const img = new Image()
  img.src = url
}

function preloadNextFor(side) {
  const pool = carouselPool.value
  if (!pool.length) return
  const start = side === 'right' ? carouselRightStart.value : carouselLeftStart.value
  preloadImage(pool[(start + 3) % pool.length]?.image)
}

function advanceCarousel() {
  const pool = carouselPool.value
  if (!pool.length || spiritRevealed.value || step.value !== 3) {
    stopCarousel()
    return
  }
  if (carouselTurn % 2 === 0) {
    carouselLeftStart.value = (carouselLeftStart.value + 1) % pool.length
    preloadNextFor('left')
  } else {
    carouselRightStart.value = (carouselRightStart.value + 1) % pool.length
    preloadNextFor('right')
  }
  carouselTurn += 1
}

function startCarousel() {
  if (spiritRevealed.value || step.value !== 3) return
  const pool = carouselPool.value
  const aligned = alignedCarouselStarts(pool.length, carouselLeftStart.value)
  carouselLeftStart.value = aligned.left
  carouselRightStart.value = aligned.right
  if (prefersReducedMotion() || !pool.length) return
  if (carouselTimer !== null) return
  carouselTurn = 0
  carouselTimer = setInterval(advanceCarousel, CAROUSEL_TICK_MS)
  preloadNextFor('left')
  preloadNextFor('right')
}

function stopCarousel() {
  if (carouselTimer !== null) {
    clearInterval(carouselTimer)
    carouselTimer = null
  }
}

watch([step, spiritRevealed, carouselPool], ([s, revealed]) => {
  if (s === 3 && !revealed) startCarousel()
  else stopCarousel()
})

onBeforeUnmount(() => {
  stopCarousel()
  clearRapidState()
})

function goBack() {
  router.push('/')
}

function goStep2() {
  const name = playerName.value.trim()
  if (name.length < 2) {
    nameError.value = '名字至少需要 2 个字'
    return
  }
  if (name.length > 8) {
    nameError.value = '名字不能超过 8 个字'
    return
  }
  nameError.value = ''
  transitionName.value = 'slide-forward'
  step.value = 2
}

function selectOrigin(origin) {
  selectedOrigin.value = origin
}

function goStep3() {
  clearRapidState()
  transitionName.value = 'slide-forward'
  step.value = 3
  awakenedSpirit.value = null
  awakenRevealed.value = false
  spiritRevealed.value = false
}

onMounted(() => loadAll())

// ============ BUG-DIALOG-005 方案B+：重新觉醒快速重抽（固定操作条、保留旧结果、单一揭示计时器） ============
// 状态分离：spiritRevealed 只描述“是否已展示过结果”（首次觉醒仪式）；
// 快速重抽期间的输入阶段（rerollActive）、安全锁（stopLocked）与待展示结果（pendingResult）独立管理。
// 计时器纪律：揭示计时器与安全锁计时器各自最多存在一个；每次新点击先 clearTimeout 旧计时器；
// 离开步骤 / 重新选择出身 / 卸载时立即全部清理，杜绝陈旧回调改写界面。
const rerollActive = ref(false)
const stopLocked = ref(false)
const pendingResult = ref(null)
let revealTimer = null
let safetyTimer = null

function clearRevealTimer() {
  if (revealTimer !== null) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
}

function clearSafetyTimer() {
  if (safetyTimer !== null) {
    clearTimeout(safetyTimer)
    safetyTimer = null
  }
}

function clearRapidState() {
  clearRevealTimer()
  clearSafetyTimer()
  rerollActive.value = false
  stopLocked.value = false
  pendingResult.value = null
}

// 单次真实抽取：与首次觉醒仪式共用同一套品质抽取 / 武魂池 / 先天魂力公式，
// 随机数消耗顺序保持一致（不影响既有随机序列注入与既有验收断言）。
function rollSpiritDraw() {
  const spirits = data.value.spirits
  const boost = selectedOrigin.value?.qualityBoost
  const tier = rollSpiritTier(boost)
  const pool = spirits.filter(s => s.tier === tier)
  let spirit
  if (pool.length === 0) {
    const fallbackPool = spirits.filter(s => s.tier === 'mid' || s.tier === 'low')
    spirit = pick(fallbackPool.length ? fallbackPool : spirits)
  } else {
    spirit = pick(pool)
  }
  const actualTier = spirit?.tier || tier
  const tierPower = {
    god: 100,
    top: 85 + Math.floor(Math.random() * 15),
    high: 70 + Math.floor(Math.random() * 15),
    mid: 40 + Math.floor(Math.random() * 25),
    low: 10 + Math.floor(Math.random() * 25)
  }
  let power = tierPower[actualTier] || 30
  if (boost) power = Math.min(100, power + 10 + Math.floor(Math.random() * 10))
  if (actualTier === 'god') power = 100
  else if (actualTier === 'top' && Math.random() < 0.1) power = 100
  return { spirit, tier: actualTier, power }
}

// 收敛计时器到点：直接把最新待展示结果替换到界面（保留旧结果期间不做任何动画重置）。
function commitPendingResult() {
  revealTimer = null
  if (!pendingResult.value) {
    rerollActive.value = false
    return
  }
  awakenedSpirit.value = pendingResult.value.spirit
  innatePower.value = pendingResult.value.power
  pendingResult.value = null
  rerollActive.value = false
}

// 自动停止（神级 / 首次达到 50 保底）后的安全锁：只禁用“重新觉醒”，拒绝尾随点击。
function startStopLock() {
  clearSafetyTimer()
  stopLocked.value = true
  safetyTimer = setTimeout(() => {
    safetyTimer = null
    stopLocked.value = false
  }, RARE_STOP_HOLD_MS)
}

// 快速重抽：每次有效点击 = 立即执行一次真实抽取 + 严格按当前出身累计一次保底。
// 不合并点击、不丢弃抽取、不只按最后一次计算；保底公式/概率/属性计算一律不动。
function rerollAwaken() {
  if (!data.value.spirits.length || !selectedOrigin.value) return
  if (stopLocked.value) return
  const draw = rollSpiritDraw()
  const previousPity = currentPity.value
  if (draw.tier === 'god') updatePity(resetOriginCount)
  else updatePity(incrementOriginCount)
  const nextPity = currentPity.value

  // 自动停止：立即展示最新结果（神级只清当前出身保底；首次 49→50 停止一次），并进入安全锁。
  if (shouldStopRapidReroll(previousPity, nextPity, draw.tier)) {
    clearRevealTimer()
    awakenedSpirit.value = draw.spirit
    innatePower.value = draw.power
    pendingResult.value = null
    rerollActive.value = false
    startStopLock()
    return
  }

  // 快速重抽：保留旧结果（仅压暗），暂存最新结果，重启单一揭示计时器。
  rerollActive.value = true
  pendingResult.value = { spirit: draw.spirit, power: draw.power }
  clearRevealTimer()
  revealTimer = setTimeout(commitPendingResult, RAPID_REVEAL_DELAY_MS)
}

async function doAwaken(forcedSpirit = null) {
  if (!data.value.spirits.length) await loadAll()
  const spirits = data.value.spirits
  if (!spirits.length) return

  if (forcedSpirit) {
    awakenedSpirit.value = forcedSpirit
    updatePity(resetOriginCount)
    innatePower.value = 100
  } else {
    const draw = rollSpiritDraw()
    awakenedSpirit.value = draw.spirit
    if (draw.tier === 'god') updatePity(resetOriginCount)
    else updatePity(incrementOriginCount)
    innatePower.value = draw.power
  }

  // 重置动画（首次觉醒仪式保持原有 50ms / 650ms 揭示节奏，与既有验收一致）
  clearRapidState()
  awakenRevealed.value = false
  spiritRevealed.value = false

  // 激活法阵特效
  setTimeout(() => { awakenRevealed.value = true }, 50)
  setTimeout(() => { spiritRevealed.value = true }, 650)
}

function onImgError(e) {
  e.target.style.display = 'none'
}

function openGodPicker() {
  godPickerView.value = 'list'
  previewedGodSpirit.value = null
  showGodPicker.value = true
}

// 卡片点击：只进入该武魂的独立详情视图。
// 不调用 pickGodSpirit、不关闭弹窗、不清零保底、不改变背后的觉醒结果。
function openGodDetail(spirit) {
  previewedGodSpirit.value = spirit
  godPickerView.value = 'detail'
  nextTick(() => godDetailBackBtn.value?.focus())
}

// 返回列表，并尽量把焦点恢复到刚才查看的卡片。
async function backToGodList() {
  const targetId = previewedGodSpirit.value?.id
  godPickerView.value = 'list'
  await nextTick()
  if (!targetId || !godPickerBody.value) return
  const card = godPickerBody.value.querySelector(`.god-pick-card[data-spirit-id="${CSS.escape(targetId)}"]`)
  card?.focus()
}

// 关闭弹窗后重置为列表层：下次打开默认回到武魂列表，不停留在上次详情层。
watch(showGodPicker, open => {
  if (!open) {
    godPickerView.value = 'list'
    previewedGodSpirit.value = null
  }
})

function pickGodSpirit(spirit) {
  showGodPicker.value = false
  doAwaken(spirit)
}

function confirmSpirit() {
  if (rerollActive.value) return
  if (!awakenedSpirit.value || !selectedOrigin.value || !playerName.value.trim()) return

  initNewCharacter({
    name: playerName.value.trim(),
    origin: selectedOrigin.value,
    spirit: awakenedSpirit.value,
    innatePower: innatePower.value
  })

  // 本地落盘是进入游戏的硬门槛；失败时保留当前觉醒页供玩家重试，
  // 同时保留创建草稿保底，供玩家下次尝试（只有 saveToLocal 成功才清除）。
  try {
    saveToLocal()
  } catch (error) {
    ui.notify(`角色创建失败：无法写入本地存档（${error.message}）`, 'error', 6000)
    return
  }

  // 角色确认成功：清除当前创建草稿保底，并删除旧全局键；下次创建绝不继承。
  clearDraft(storage)
  removeLegacyKey(storage)

  // 异步保存到云端（不阻塞跳转；未登录时仅保留本地）
  const api = useApi()
  saveToCloud(api).then(result => {
    if (result.success) {
      console.log('云端存档成功，版本:', result.version)
    } else if (result.needLogin) {
      console.log('未登录账号，角色仅保存在本地')
    } else if (result.conflict) {
      console.warn('云端版本冲突，已使用本地存档')
    } else {
      console.warn('云端存档失败:', result.error)
    }
  }).catch(e => console.warn('云端存档异常:', e))

  router.push('/game')
}

watch(step, (newStep, oldStep) => {
  transitionName.value = newStep < oldStep ? 'slide-back' : 'slide-forward'
})

// BUG-DIALOG-005：离开觉醒步骤（重新选择出身 / 返回上一步）立即取消揭示与安全锁计时器，
// 杜绝陈旧回调在返回后改写界面；已执行的抽取与保底不回滚。
watch(step, (newStep) => {
  if (newStep !== 3) clearRapidState()
})
</script>

<style scoped src="./create-page.base.css"></style>
<style scoped src="./create-page.awaken.css"></style>
<style scoped src="./create-page.result.css"></style>