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
/**
 * BUG-DIALOG-002 纯展示逻辑：顶级/神级武魂轮播素材池。
 * 仅用于觉醒页两侧装饰展示，不参与 doAwaken() 的抽取、保底或属性计算。
 */
export function buildCarouselPool(spirits) {
  if (!Array.isArray(spirits)) return []
  return spirits.filter(s => s && (s.tier === 'top' || s.tier === 'god') && typeof s.image === 'string' && s.image.length > 0)
}

export function carouselOffset(poolSize) {
  if (poolSize < 6) return 0
  return Math.floor(poolSize / 2)
}

export function carouselSlots(pool, start) {
  const n = Array.isArray(pool) ? pool.length : 0
  return [0, 1, 2].map(k => (n > 0 ? pool[(start + k) % n] : null))
}

export function alignedCarouselStarts(poolSize, leftStart) {
  const n = Number.isInteger(poolSize) && poolSize > 0 ? poolSize : 0
  if (n === 0) return { left: 0, right: 0 }
  const left = ((Number.isInteger(leftStart) ? leftStart : 0) % n + n) % n
  return { left, right: (left + carouselOffset(n)) % n }
}

/**
 * BUG-DIALOG-004 长介绍视觉分段（纯函数，可独立测试）。
 *
 * 规则：
 * - 空值 / 非字符串 / 纯空白：返回空数组；
 * - 较短介绍（≤ SHORT_DESC_LIMIT 字）保留为单个段落；
 * - 长介绍优先在中文句号「。」、叹号「！」、问号「？」或分号「；」后，
 *   在文本中段（25%～75% 区间）内选择最接近中点的边界拆成两段；
 * - 找不到可靠边界时保持单段，绝不在词语中间强拆；
 * - 不修改、不删除、不重写任何原始字符（含标点）——
 *   所有段落按顺序 join 后严格等于原 desc 去除首尾空白后的结果。
 */
export const SHORT_DESC_LIMIT = 100

export function splitSpiritDescription(desc) {
  if (typeof desc !== 'string') return []
  const text = desc.trim()
  if (text.length === 0) return []
  if (text.length <= SHORT_DESC_LIMIT) return [text]
  const boundary = findParagraphBoundary(text)
  if (boundary < 0) return [text]
  return [text.slice(0, boundary), text.slice(boundary)]
}

function findParagraphBoundary(text) {
  const len = text.length
  const low = Math.floor(len * 0.25)
  const high = Math.ceil(len * 0.75)
  const mid = len / 2
  let best = -1
  let bestDist = Infinity
  for (let i = low; i < high; i++) {
    const ch = text[i]
    if (ch === '。' || ch === '！' || ch === '？' || ch === '；') {
      const dist = Math.abs(i + 1 - mid)
      if (dist < bestDist) {
        bestDist = dist
        best = i + 1
      }
    }
  }
  return best
}

/**
 * BUG-DIALOG-005 方案B+：快速重抽参数（纯常量，供组件与测试共用）。
 * - RAPID_REVEAL_DELAY_MS：停止点击后展示最新结果的收敛等待（约 250ms）；
 * - RARE_STOP_HOLD_MS：神级 / 首次达到 50 保底自动停止后的安全锁时长（约 650ms）；
 * - PITY_CAP：与 creation-pity 的 PITY_LIMIT 保持一致（50），用于纯函数判定“首次达到保底”。
 */
export const RAPID_REVEAL_DELAY_MS = 250
export const RARE_STOP_HOLD_MS = 650
export const PITY_CAP = 50

/**
 * 快速重抽自动停止判定（纯函数，不修改入参）：
 * - 神级：立即停止并展示神级结果；
 * - 非神级且首次达到保底上限（previous < PITY_CAP 且 next >= PITY_CAP）：停止一次；
 * - 其余情况（含已满保底后继续点击）不停止，继续快速重抽。
 * 非法/缺失计数一律按“不停止”安全处理（保底公式本身在 creation-pity 中封顶）。
 */
export function shouldStopRapidReroll(previousPity, nextPity, tier) {
  if (tier === 'god') return true
  if (!Number.isInteger(previousPity) || !Number.isInteger(nextPity)) return false
  return previousPity < PITY_CAP && nextPity >= PITY_CAP
}
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
  ensureDraft,
  clearDraft,
  removeLegacyKey,
  writeDraft,
  getOriginCount,
  incrementOriginCount,
  resetOriginCount
} from '@/utils/creation-pity'

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
// 读取的同时删除旧全局键 dldl_god_spirit_pity（不迁移）。
const pityDraft = ref(ensureDraft(storage, originIds))

const currentPity = computed(() => pityDraft.value ? getOriginCount(pityDraft.value, selectedOrigin.value?.id, originIds) : 0)

function pityOf(originId) {
  return pityDraft.value ? getOriginCount(pityDraft.value, originId, originIds) : 0
}

const otherOriginsPity = computed(() => {
  if (!pityDraft.value || !selectedOrigin.value) return []
  return origins
    .filter(origin => origin.id !== selectedOrigin.value.id)
    .map(origin => ({ name: origin.name, count: pityOf(origin.id) }))
    .filter(item => item.count > 0)
})

// 更新当前出身保底并尽力落盘；存储写入失败不阻断创建流程。
function updatePity(updater) {
  if (!pityDraft.value || !selectedOrigin.value) return
  pityDraft.value = updater(pityDraft.value, selectedOrigin.value.id, originIds)
  writeDraft(storage, pityDraft.value, originIds)
}

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

<style scoped>
.create-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  padding: clamp(12px, 3.7vh, 40px) 20px;
}
.create-box {
  width: min(860px, 96vw);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.create-box.is-awaken-step {
  width: min(1500px, 98vw);
}
.create-step {
  flex: 1;
  min-height: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.create-box.is-awaken-step .create-step { justify-content: flex-start; }

.step-dots {
  flex: none;
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 30px;
}
.step-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--line);
  transition: all 0.3s;
}
.step-dot.on {
  background: var(--gold);
  border-color: var(--gold);
  box-shadow: 0 0 8px rgba(201, 168, 76, 0.6);
}

.step-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 5vw, 40px);
  color: var(--gold);
  letter-spacing: 4px;
  text-align: center;
  margin-bottom: 8px;
}
.step-sub {
  text-align: center;
  color: var(--ink-dim);
  letter-spacing: 2px;
  margin-bottom: 28px;
  font-size: 15px;
}

/* 名字输入 */
.name-input-row {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}
.name-input {
  background: rgba(36, 28, 14, 0.85);
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 20px;
  letter-spacing: 3px;
  padding: 13px 20px;
  width: min(320px, 80vw);
  outline: none;
  text-align: center;
}
.name-input:focus { border-color: var(--gold); }
.name-input::placeholder { color: #8f8778; }
.name-err {
  color: #d06a5a;
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
  min-height: 20px;
  letter-spacing: 1px;
}

/* 出身卡片 */
.origin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.origin-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
  cursor: pointer;
  transition: all 0.3s;
  text-align: left;
  padding: 0;
  font-family: inherit;
}
.origin-card:hover {
  transform: translateY(-4px);
  border-color: var(--gold);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
}
.origin-card.picked {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px var(--gold), 0 8px 22px rgba(0, 0, 0, 0.5);
}
.origin-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  font-size: 11px;
  letter-spacing: 1px;
  color: #b9e7c0;
  border: 1px solid rgba(127, 196, 140, 0.8);
  background: rgba(18, 40, 34, 0.82);
  border-radius: 3px;
  padding: 2px 8px;
  pointer-events: none;
}
.oc-banner {
  height: 110px;
  overflow: hidden;
  position: relative;
}
.oc-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: sepia(0.15) brightness(0.85);
}
.oc-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(46, 36, 20, 1), transparent 65%);
}
.oc-body { padding: 14px 16px 16px; }
.oc-name {
  font-family: var(--font-display);
  font-size: 21px;
  color: var(--gold-hi);
  letter-spacing: 2px;
  margin-bottom: 6px;
}
.oc-desc {
  font-size: 14px;
  color: var(--ink);
  line-height: 1.8;
  margin-bottom: 8px;
}
.oc-bonus {
  font-size: 13px;
  color: var(--ink-dim);
  letter-spacing: 1px;
}
/* 按钮通用 */
.create-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
  flex-wrap: wrap;
}
.btn {
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
  transition: all 0.25s;
}
.btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-hi);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}
.btn-gold {
  border-color: var(--gold);
  color: var(--gold-hi);
}

/* 武魂觉醒 */
.awaken-stage {
  --disc-size: clamp(148px, 24vh, 240px);
  text-align: center;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  align-items: start;
  row-gap: clamp(6px, 1.2vh, 14px);
  flex: 1;
  min-height: 0;
  align-content: center;
  isolation: isolate;
}
.awaken-stage.has-result {
  --disc-size: clamp(120px, 18vh, 180px);
  row-gap: clamp(3px, 0.65vh, 7px);
}
.awaken-img-wrap {
  position: relative;
  z-index: 3;
  grid-row: 1;
  width: var(--disc-size);
  height: var(--disc-size);
  border-radius: 50%;
  background: radial-gradient(circle at center, #2a1f0e 0%, #181008 50%, #0a0804 100%);
  display: grid;
  place-items: center;
  border: 2px solid var(--line);
  overflow: hidden;
  transition: border-color 0.6s ease-out, box-shadow 0.6s ease-out;
}
.awaken-img-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at center, rgba(201, 168, 76, 0.08) 0%, transparent 70%);
  pointer-events: none;
}
.awaken-img-wrap.reveal {
  border-color: var(--gold);
  border-width: 3px;
  box-shadow: 0 0 50px rgba(201, 168, 76, 0.5), 0 0 100px rgba(201, 168, 76, 0.2), inset 0 0 40px rgba(201, 168, 76, 0.2);
  animation: awakenPop 1s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.awaken-img-wrap img {
  position: absolute;
  inset: -3px;
  z-index: 3;
  width: calc(100% + 6px);
  height: calc(100% + 6px);
  object-fit: cover;
  border: 0;
  border-radius: 0;
  animation: spiritGlow 4s ease-in-out infinite alternate;
}
@keyframes spiritGlow {
  from { filter: brightness(0.94) saturate(0.95); }
  to { filter: brightness(1.08) saturate(1.08); }
}
@keyframes awakenPop {
  0% { transform: scale(0.2); opacity: 0; }
  40% { transform: scale(1.15); opacity: 1; }
  60% { transform: scale(0.92); }
  80% { transform: scale(1.04); }
  100% { transform: scale(1); opacity: 1; }
}
.awaken-seal {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--gold-dim);
  animation: sealFloat 3.2s ease-in-out infinite alternate;
}
.awaken-seal svg {
  width: 62%;
  height: 62%;
  overflow: visible;
  filter: drop-shadow(0 0 22px rgba(201, 168, 76, 0.42));
}
.awaken-seal span {
  margin-top: -4px;
  font-family: var(--font-display);
  font-size: clamp(11px, 1.5vw, 14px);
  letter-spacing: 5px;
  color: rgba(227, 207, 154, 0.72);
  text-shadow: 0 0 14px rgba(201, 168, 76, 0.35);
}
.seal-orbit,
.seal-rune {
  fill: none;
  stroke: currentColor;
  stroke-linejoin: round;
}
.seal-orbit-outer { stroke-width: 1; stroke-dasharray: 4 5; }
.seal-orbit-inner { stroke-width: 0.8; opacity: 0.55; stroke-dasharray: 2 4; }
.seal-rune { stroke-width: 1.2; opacity: 0.78; }
.seal-rune-inner { stroke-width: 1.6; opacity: 0.9; }
.seal-core { fill: currentColor; opacity: 0.86; }
.seal-node { fill: currentColor; opacity: 0.72; }
@keyframes sealFloat {
  0% { opacity: 0.54; transform: scale(0.97); filter: blur(0.6px); }
  100% { opacity: 0.96; transform: scale(1.025); filter: blur(0); }
}

/* 双侧顶级/神级武魂轮播（BUG-DIALOG-002，纯装饰） */
.carousel-group {
  position: absolute;
  top: calc(var(--disc-size) * 0.5);
  z-index: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  translate: 0 -50%;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.9s ease;
}
.carousel-cell {
  position: relative;
  flex: none;
}
.carousel-left { left: 1.5%; }
.carousel-right { right: 1.5%; }
.awaken-stage.has-result .carousel-group {
  opacity: 0.2;
}
.carousel-slot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 1px solid rgba(201, 168, 76, 0.45);
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55), inset 0 0 18px rgba(0, 0, 0, 0.35), 0 0 22px rgba(201, 168, 76, 0.12);
  filter: sepia(0.3) brightness(0.82) saturate(0.9);
}
.carousel-main {
  width: clamp(210px, 15vw, 235px);
  height: clamp(210px, 15vw, 235px);
  opacity: 0.62;
}
.carousel-top,
.carousel-bottom {
  width: clamp(95px, 7vw, 125px);
  height: clamp(95px, 7vw, 125px);
  opacity: 0.22;
}
.cshift-enter-active,
.cshift-leave-active {
  transition: opacity 1.05s ease, transform 1.05s cubic-bezier(0.22, 1, 0.36, 1), filter 1.05s ease;
}
.cshift-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
  filter: blur(7px) sepia(0.3) brightness(0.65);
}
.cshift-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.97);
  filter: blur(7px) sepia(0.3) brightness(0.65);
}
@media (min-width: 1200px) and (max-width: 1399px) {
  .carousel-main {
    width: clamp(150px, 13vw, 175px);
    height: clamp(150px, 13vw, 175px);
  }
  .carousel-top,
  .carousel-bottom {
    width: clamp(80px, 7vw, 100px);
    height: clamp(80px, 7vw, 100px);
  }
}
@media (max-width: 1199px) {
  .carousel-group {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .carousel-group,
  .carousel-slot {
    transition: none;
    animation: none;
  }
  .awaken-seal {
    animation: none;
    opacity: 0.85;
  }
  /* BUG-DIALOG-005：reduced-motion 下快速重抽不做任何过渡动画，直接替换结果 */
  .awaken-stage.is-rerolling .awaken-img-wrap,
  .awaken-stage.is-rerolling #awaken-info,
  .awaken-stage.is-rerolling .awaken-left {
    transition: none;
  }
}
.awaken-q-reveal {
  font-size: clamp(55px, 12vw, 90px);
  animation: iconBurst 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  text-shadow: 0 0 40px currentColor, 0 0 80px currentColor;
  position: relative;
  z-index: 3;
  line-height: 1;
}
@keyframes iconBurst {
  0% { opacity: 0; transform: scale(0) rotate(-180deg); filter: blur(10px); }
  60% { transform: scale(1.3) rotate(10deg); filter: blur(0); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
}

/* 六芒星阵 */
.magic-circle {
  position: absolute;
  top: calc(var(--disc-size) * -0.08);
  left: 50%;
  z-index: 1;
  width: calc(var(--disc-size) * 1.16);
  height: calc(var(--disc-size) * 1.16);
  translate: -50% 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.4;
  pointer-events: none;
  color: var(--gold);
}
.magic-circle svg {
  width: 100%;
  height: 100%;
  animation: circleSpin 20s linear infinite;
}
.magic-circle.reveal {
  opacity: 1;
  animation: circleReveal 1s ease-out both;
}
@keyframes circleSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes circleReveal { from { opacity: 0; scale: 0.5; } to { opacity: 1; scale: 1; } }

/* 光束 */
.light-rays {
  position: absolute;
  top: calc(var(--disc-size) * -0.2);
  left: 50%;
  z-index: 2;
  width: calc(var(--disc-size) * 1.4);
  height: calc(var(--disc-size) * 1.4);
  translate: -50% 0;
  opacity: 0;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(10px);
  overflow: hidden;
}
.light-rays::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0 7%, rgba(230, 200, 120, 0.16) 13%, transparent 21% 32%, rgba(201, 168, 76, 0.11) 39%, transparent 48% 60%, rgba(230, 200, 120, 0.14) 68%, transparent 78% 89%, rgba(201, 168, 76, 0.1) 95%, transparent 100%);
  animation: raysSpin 8s linear infinite;
}
.light-rays.reveal {
  opacity: 1;
  animation: raysReveal 0.8s ease-out both;
}
@keyframes raysSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes raysReveal { from { opacity: 0; scale: 0.4; } to { opacity: 1; scale: 1; } }

/* 外圈光环 */
.altar-ring {
  position: absolute;
  left: 50%;
  top: calc(var(--disc-size) * -0.04);
  translate: -50% 0;
  width: calc(var(--disc-size) * 1.08);
  height: calc(var(--disc-size) * 1.08);
  border-radius: 50%;
  border: 1px solid rgba(201, 168, 76, 0.2);
  z-index: 1;
  pointer-events: none;
}
.altar-ring.r1 { animation: ringPulse 3s ease-in-out infinite; }
.altar-ring.r2 { top: calc(var(--disc-size) * -0.09); width: calc(var(--disc-size) * 1.18); height: calc(var(--disc-size) * 1.18); border-style: dashed; border-color: rgba(201, 168, 76, 0.1); animation: ringPulse 3s ease-in-out infinite 0.5s reverse; }
.altar-ring.r3 { top: calc(var(--disc-size) * -0.14); width: calc(var(--disc-size) * 1.28); height: calc(var(--disc-size) * 1.28); border-color: rgba(201, 168, 76, 0.08); animation: ringPulse 4s ease-in-out infinite 1s; }
@keyframes ringPulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.02); }
}
.altar-ring.reveal { border-color: var(--gold); }
.altar-ring.r1.reveal { box-shadow: 0 0 30px rgba(201, 168, 76, 0.3), inset 0 0 30px rgba(201, 168, 76, 0.1); }

/* 觉醒信息 */
#awaken-info.is-concealed, .awaken-left.is-concealed {
  display: none;
  pointer-events: none;
}
.awaken-tier {
  display: inline-block;
  font-size: clamp(15px, 2.5vw, 20px);
  letter-spacing: 5px;
  padding: 7px 30px;
  border: 2px solid;
  border-radius: 30px;
  margin-bottom: 16px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  font-family: var(--font-display);
}
#awaken-info.is-revealed .awaken-tier { animation: tierReveal 0.7s ease-out 0.5s both; }
@keyframes tierReveal { from { opacity: 0; transform: translateY(15px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
.awaken-name {
  font-size: clamp(26px, 5.5vw, 42px);
  color: var(--gold-hi);
  letter-spacing: 8px;
  margin-bottom: 16px;
  text-shadow: 0 0 30px rgba(201, 168, 76, 0.5);
  font-family: var(--font-display);
}
#awaken-info.is-revealed .awaken-name { animation: nameReveal 0.8s ease-out 0.65s both; }
@keyframes nameReveal { from { opacity: 0; transform: translateY(20px); letter-spacing: 16px; } to { opacity: 1; transform: translateY(0); letter-spacing: 8px; } }
.awaken-stats {
  display: flex;
  justify-content: center;
  gap: 10px 14px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.awaken-stat {
  padding: 6px 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(36, 28, 14, 0.5);
  font-size: 13px;
  color: var(--ink-dim);
  letter-spacing: 1px;
}
.awaken-stat b { color: var(--gold-hi); margin-left: 4px; }
.awaken-ring-ready {
  width: fit-content;
  max-width: min(640px, 92vw);
  margin: 0 auto 10px;
  padding: 7px 16px;
  border: 1px solid rgba(251, 191, 36, 0.58);
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.09);
  color: #fbd36a;
  font-size: 13px;
  letter-spacing: 1px;
  text-align: center;
}
.awaken-ring-ready.is-placeholder { visibility: hidden; }
#awaken-info.is-revealed .awaken-stats { animation: descReveal 0.8s ease-out 0.9s both; }
#awaken-info.is-revealed .awaken-ring-ready { animation: descReveal 0.8s ease-out 1s both; }
.awaken-desc {
  width: min(640px, 92vw);
  margin: 0 auto 14px;
  font-size: 15px;
  line-height: 2;
  color: var(--ink);
  text-align: left;
  background: rgba(36, 28, 14, 0.6);
  padding: 14px 20px;
  border-radius: 6px;
  border-left: 3px solid var(--gold);
  backdrop-filter: blur(4px);
}
.awaken-desc-head {
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 4px;
  color: var(--gold-dim);
  margin-bottom: 8px;
}
.awaken-desc-p {
  margin: 0;
  text-indent: 2em;
}
.awaken-desc-p + .awaken-desc-p {
  margin-top: 8px;
}
#awaken-info.is-revealed .awaken-desc { animation: descReveal 0.8s ease-out 0.8s both; }
@keyframes descReveal { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
.awaken-left {
  width: 100%;
  min-height: 40px;
  margin-top: 18px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink-dim);
  letter-spacing: 2px;
}
.awaken-left b { color: var(--gold-hi); }
.awaken-other-pity {
  font-size: 13px;
  color: #8f8778;
  letter-spacing: 1px;
}
.awaken-left.is-revealed { animation: descReveal 0.8s ease-out 1s both; }
.awaken-actions { margin-top: 10px; }
.awaken-stage.has-result .awaken-tier {
  margin-bottom: 5px;
  padding: 5px 22px;
  font-size: clamp(13px, 2vh, 17px);
}
.awaken-stage.has-result .awaken-name {
  margin-bottom: 6px;
  font-size: clamp(22px, 3.8vh, 34px);
}
.awaken-stage.has-result .awaken-stats {
  gap: 5px 8px;
  margin-bottom: 4px;
}
.awaken-stage.has-result .awaken-stat {
  padding: 4px 10px;
  font-size: 12px;
}
.awaken-stage.has-result .awaken-ring-ready {
  margin-bottom: 5px;
  padding: 5px 12px;
  font-size: 12px;
}
.awaken-stage.has-result .awaken-desc {
  height: 151px;
  margin-bottom: 4px;
  padding: 9px 14px;
  font-size: 13px;
  line-height: 1.58;
}
.awaken-stage.has-result .awaken-desc-head { margin-bottom: 4px; }
.awaken-stage.has-result .awaken-desc-p + .awaken-desc-p { margin-top: 4px; }
.awaken-stage.has-result .awaken-left {
  height: 64px;
  min-height: 0;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
  letter-spacing: 1px;
}
.awaken-stage.has-result .awaken-other-pity { font-size: 11px; }
.awaken-stage.has-result .awaken-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(660px, 96vw);
  height: 42px;
  min-height: 42px;
  margin-top: 3px;
  align-items: stretch;
}
.awaken-stage.has-result .awaken-actions .btn {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  padding-block: 0;
  white-space: nowrap;
}
.awaken-stage.has-result .awaken-actions:has(.btn:nth-child(4)) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.awaken-stage.has-result .awaken-actions:has(.btn:nth-child(4)) .btn {
  padding-inline: 4px;
  font-size: 12px;
  letter-spacing: 1px;
}

/* BUG-DIALOG-005 方案B+：快速重抽期间旧结果保留并压暗。
   用 filter 亮度 0.55（视觉等价 opacity 45%~60%），避开 is-revealed 动画 fill 对 opacity 的持续接管；
   快速重抽期间结果区/操作条 DOM 与布局零变化；压暗立即生效（无过渡，避免与 250ms 收敛计时打架）。 */
.awaken-stage.is-rerolling .awaken-img-wrap,
.awaken-stage.is-rerolling #awaken-info,
.awaken-stage.is-rerolling .awaken-left {
  filter: brightness(0.55) saturate(0.85);
}
.reroll-hint {
  position: absolute;
  left: 50%;
  translate: -50% 0;
  top: calc(var(--disc-size) + 6px);
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 6px 18px;
  border: 1px solid var(--gold);
  border-radius: 30px;
  background: rgba(12, 9, 4, 0.88);
  color: var(--gold);
  font-size: 14px;
  letter-spacing: 2px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 0 18px rgba(201, 168, 76, 0.35);
}
.reroll-hint b { color: var(--gold-hi); }
.reroll-hint span { color: #8f8778; font-size: 12px; letter-spacing: 1px; }
@media (max-width: 480px) {
  .reroll-hint {
    white-space: normal;
    width: max-content;
    max-width: 92vw;
    text-align: center;
  }
}

/* 神级武魂选择（BUG-DIALOG-004 方案C） */
.god-picker-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.god-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.god-pick-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.25s;
  text-align: center;
  font-family: inherit;
}
.god-pick-card:hover,
.god-pick-card:focus-visible {
  border-color: var(--gold);
  transform: translateY(-3px);
  box-shadow: 0 6px 18px rgba(201, 168, 76, 0.2);
  outline: none;
}
.god-pick-card:focus-visible {
  box-shadow: 0 0 0 2px var(--gold), 0 6px 18px rgba(201, 168, 76, 0.2);
}
.gpc-icon {
  font-size: 36px;
  margin-bottom: 8px;
  color: var(--gold-hi);
}
.gpc-name {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold-hi);
  letter-spacing: 2px;
  margin-bottom: 6px;
}
.gpc-desc {
  font-size: 12px;
  color: var(--ink-dim);
  line-height: 1.6;
}
.gpc-action {
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--gold);
}

/* 独立详情视图：左侧大图 + 右侧完整介绍与确认按钮，黑金风格 */
.god-dossier {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.god-dossier-back-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 14px;
}
.god-dossier-back {
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(36, 28, 14, 0.85);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 14px;
  letter-spacing: 2px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.god-dossier-back:hover,
.god-dossier-back:focus-visible {
  border-color: var(--gold);
  color: var(--gold-hi);
  outline: none;
  box-shadow: 0 0 0 2px var(--gold);
}
.god-dossier-main {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 26px;
  align-items: start;
  min-height: 0;
}
.god-dossier-image {
  aspect-ratio: 1 / 1;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  overflow: hidden;
  background: radial-gradient(circle at center, #2a1f0e 0%, #181008 55%, #0a0804 100%);
  display: grid;
  place-items: center;
  min-height: 0;
}
.god-dossier-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.god-dossier-icon {
  font-size: clamp(64px, 12vw, 96px);
  color: var(--gold-hi);
  text-shadow: 0 0 30px rgba(201, 168, 76, 0.5);
}
.god-dossier-body {
  min-width: 0;
}
.god-dossier-kicker {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 4px;
  color: var(--gold);
  border: 1px solid var(--gold);
  border-radius: 3px;
  padding: 2px 10px;
  margin-bottom: 10px;
  background: rgba(0, 0, 0, 0.35);
}
.god-dossier-name {
  font-family: var(--font-display);
  font-size: clamp(24px, 3.5vw, 30px);
  color: var(--gold-hi);
  letter-spacing: 4px;
  margin: 0 0 12px;
  text-shadow: 0 0 24px rgba(201, 168, 76, 0.35);
}
.god-dossier-desc {
  text-align: left;
}
.god-dossier-p {
  margin: 0 0 10px;
  text-indent: 2em;
}
.god-dossier-p:last-child {
  margin-bottom: 0;
}
.god-dossier-confirm {
  margin-top: 16px;
}
@media (max-width: 640px) {
  .god-dossier-main {
    grid-template-columns: minmax(0, 1fr);
  }
  .god-dossier-image {
    max-width: 100%;
  }
}

/* 过渡动画 */
.slide-forward-enter-active, .slide-forward-leave-active,
.slide-back-enter-active, .slide-back-leave-active {
  transition: all 0.25s ease-out;
}
.slide-forward-enter-from { opacity: 0; transform: translateX(28px); }
.slide-forward-leave-to { opacity: 0; transform: translateX(-28px); }
.slide-back-enter-from { opacity: 0; transform: translateX(-28px); }
.slide-back-leave-to { opacity: 0; transform: translateX(28px); }

/* 响应式适配 */
@media (max-height: 960px) {
  .step-dots { margin-bottom: clamp(8px, 1.6vh, 16px); }
  .step-title { font-size: clamp(24px, 4vh, 34px); }
  .step-sub { margin-bottom: clamp(10px, 2vh, 18px); font-size: 14px; }
  .origin-grid { gap: 10px; }
  .oc-banner { height: clamp(72px, 12vh, 96px); }
  .oc-body { padding: 9px 13px 11px; }
  .oc-name { font-size: 18px; margin-bottom: 3px; }
  .oc-desc { line-height: 1.5; margin-bottom: 4px; }
  .create-actions { margin-top: clamp(10px, 2vh, 18px); }
  .btn { min-height: 42px; padding: 9px 24px; font-size: 15px; }
  .awaken-stage { --disc-size: clamp(136px, 21vh, 200px); }
  .awaken-stage.has-result { --disc-size: clamp(104px, 15vh, 144px); }
  .awaken-left { margin-top: 8px; min-height: 30px; }
}

@media (max-width: 768px) {
  .create-screen {
    padding: 16px 12px;
  }
  .create-header h1 {
    font-size: 24px;
    letter-spacing: 3px;
  }
  .create-card {
    padding: 16px 14px;
    border-radius: 8px;
  }
  .create-card h2 {
    font-size: 18px;
  }
  .name-input {
    font-size: 18px;
  }
  .spirit-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .origin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .oc-banner { height: clamp(64px, 10vh, 82px); }
  .oc-body { padding: 8px 9px 9px; }
  .oc-name { font-size: 16px; letter-spacing: 1px; }
  .oc-desc {
    display: -webkit-box;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .oc-bonus { font-size: 11px; letter-spacing: 0; }
  .origin-tag { top: 5px; right: 5px; padding: 1px 5px; font-size: 9px; }
  .create-actions { flex-wrap: nowrap; gap: 8px; }
  .create-actions .btn { flex: 1; min-width: 0; padding-inline: 10px; letter-spacing: 1px; }
  .awaken-stage.has-result { --disc-size: clamp(100px, 15vh, 132px); }
  .awaken-stage.has-result .awaken-tier {
    margin-bottom: 2px;
    padding: 3px 12px;
    font-size: 12px;
    letter-spacing: 3px;
  }
  .awaken-stage.has-result .awaken-name {
    margin-bottom: 3px;
    font-size: 21px;
    letter-spacing: 4px;
  }
  .awaken-stage.has-result .awaken-stats { gap: 3px 4px; margin-bottom: 2px; }
  .awaken-stage.has-result .awaken-stat {
    padding: 2px 5px;
    font-size: 10px;
    letter-spacing: 0;
  }
  .awaken-stage.has-result .awaken-ring-ready {
    max-width: 96vw;
    margin-bottom: 3px;
    padding: 3px 6px;
    font-size: 10px;
    letter-spacing: 0;
  }
  .awaken-stage.has-result .awaken-desc {
    height: clamp(108px, calc(170px - 8vw), 140px);
    width: min(640px, 96vw);
    margin-bottom: 2px;
    padding: 6px 8px;
    font-size: 11px;
    line-height: 1.38;
    border-left-width: 2px;
  }
  .awaken-stage.has-result .awaken-desc-head {
    margin-bottom: 2px;
    font-size: 10px;
    letter-spacing: 2px;
  }
  .awaken-stage.has-result .awaken-desc-p { text-indent: 1em; }
  .awaken-stage.has-result .awaken-desc-p + .awaken-desc-p { margin-top: 2px; }
  .awaken-stage.has-result .awaken-left {
    height: 60px;
    margin-top: 1px;
    font-size: 10px;
    line-height: 1.3;
    letter-spacing: 0.3px;
  }
  .awaken-stage.has-result .awaken-other-pity { font-size: 9px; }
  .awaken-stage.has-result .awaken-actions {
    height: 34px;
    min-height: 34px;
    margin-top: 2px;
  }
  .awaken-stage.has-result .awaken-actions .btn {
    height: 100%;
    min-height: 0;
    padding-block: 5px;
    font-size: 11px;
  }
  .awaken-stage.has-result .awaken-actions:has(.btn:nth-child(4)) .btn {
    padding-inline: 2px;
    font-size: 9px;
    letter-spacing: 0;
  }
  .create-nav {
    gap: 8px;
    padding: 10px 0;
  }
  .create-nav button {
    padding: 8px 16px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .create-screen {
    padding: 12px 8px;
  }
  .create-header h1 {
    font-size: 20px;
  }
  .create-card {
    padding: 12px 10px;
  }
  .create-card h2 {
    font-size: 16px;
  }
  .step-dots { margin-bottom: 8px; }
  .step-title { font-size: 20px; letter-spacing: 2px; }
  .step-sub { font-size: 12px; line-height: 1.45; letter-spacing: 1px; margin-bottom: 8px; }
  .btn { min-height: 44px; font-size: 13px; }
  .name-input { font-size: 16px; width: 100%; }
}
</style>
