/**
 * 觉醒页纯逻辑与保底草稿（阶段三 3.2 自 CreatePage.vue 拆出）
 *
 * 纯函数部分（轮播素材池/介绍分段/快速重抽判定）可独立测试；
 * useAwakeningPity 封装创建期神级保底草稿的读写（按出身隔离）。
 * CreatePage.vue 通过 re-export 维持 create-awakening-ui.test.js 的导入契约。
 */
import { ref, computed } from 'vue'
import { ORIGINS } from '@/data/game-data'
import { ensureDraft, getOriginCount, writeDraft } from '@/utils/creation-pity'

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

/**
 * 创建期神级保底草稿（按出身隔离）：进入创建页时已有草稿则恢复，无草稿则新建全 0 草稿；
 * 读取的同时删除旧全局键 dldl_god_spirit_pity（不迁移）。
 * @param {Storage|null} storage localStorage（隐私模式可为 null，全部读取退化为 0）
 * @param {import('vue').Ref<object|null>} selectedOrigin 当前选中的出身
 */
export function useAwakeningPity(storage, selectedOrigin) {
  const originIds = ORIGINS.map(o => o.id)
  const pityDraft = ref(ensureDraft(storage, originIds))

  const currentPity = computed(() => pityDraft.value ? getOriginCount(pityDraft.value, selectedOrigin.value?.id, originIds) : 0)

  function pityOf(originId) {
    return pityDraft.value ? getOriginCount(pityDraft.value, originId, originIds) : 0
  }

  const otherOriginsPity = computed(() => {
    if (!pityDraft.value || !selectedOrigin.value) return []
    return ORIGINS
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

  return { pityDraft, currentPity, pityOf, otherOriginsPity, updatePity }
}
