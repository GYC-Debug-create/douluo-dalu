/**
 * BUG-DIALOG-003 创建期神级保底状态（按出身隔离，仅存在于角色创建草稿内）。
 *
 * 存储模型（localStorage 独立键，不进入正式玩家存档）：
 * {
 *   "version": 1,
 *   "draftId": "当前创建草稿的唯一标识",
 *   "counts": { "star_forest": 17, "spirit_city": 1, "border_town": 0, "sea_island": 0 },
 *   "updatedAt": 123456789
 * }
 *
 * 规则：
 * - 计数一律规范化为 0~50 整数；负数/NaN/Infinity/字符串/超大数安全截断，杜绝 51/50。
 * - 未知出身字段忽略，不污染状态。
 * - 旧键 dldl_god_spirit_pity 不迁移（无法判断属于哪个角色与出身），读取新模型时删除。
 * - 所有 storage 读写带 try/catch，存储不可用时页面逻辑仍可继续。
 */
export const CREATION_PITY_KEY = 'dldl_create_spirit_pity_v1'
export const LEGACY_PITY_KEY = 'dldl_god_spirit_pity'
export const PITY_LIMIT = 50

const CANONICAL_ORIGIN_IDS = ['star_forest', 'spirit_city', 'border_town', 'sea_island']

function resolveOriginIds(originIds) {
  if (Array.isArray(originIds) && originIds.length > 0 && originIds.every(id => typeof id === 'string' && id.length > 0)) {
    return [...new Set(originIds)]
  }
  return [...CANONICAL_ORIGIN_IDS]
}

/** 将任意输入规范化为 0～PITY_LIMIT 的整数；非法输入归 0。 */
export function normalizeCount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(PITY_LIMIT, Math.trunc(n)))
}

/** 生成全 0 计数表（只含合法出身）。 */
export function defaultCounts(originIds = CANONICAL_ORIGIN_IDS) {
  return Object.fromEntries(resolveOriginIds(originIds).map(id => [id, 0]))
}

/** 规范化计数表：只保留合法出身字段，其余一律忽略。 */
export function normalizeCounts(counts, originIds = CANONICAL_ORIGIN_IDS) {
  const ids = resolveOriginIds(originIds)
  const result = defaultCounts(ids)
  if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
    for (const id of ids) {
      if (counts[id] !== undefined) result[id] = normalizeCount(counts[id])
    }
  }
  return result
}

/** 生成新的非空唯一草稿 ID（不含首尾空白）。 */
function generateDraftId(now = Date.now()) {
  return `draft_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 把任意 draft 相关字段规范化为标准草稿对象；任何关键字段缺失/非法一律返回 null。 */
export function parseDraft(raw, originIds = CANONICAL_ORIGIN_IDS) {
  if (typeof raw !== 'string' || raw.length === 0) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (parsed.version !== 1) return null
  if (typeof parsed.draftId !== 'string' || parsed.draftId.trim().length === 0) return null
  if (!parsed.counts || typeof parsed.counts !== 'object' || Array.isArray(parsed.counts)) return null
  if (Object.prototype.toString.call(parsed.counts) !== '[object Object]') return null
  if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) return null
  return {
    version: 1,
    draftId: parsed.draftId.trim(),
    counts: normalizeCounts(parsed.counts, originIds),
    updatedAt: parsed.updatedAt
  }
}

/** 新建全新草稿（四个出身全部 0）。options.id/options.now 便于测试注入。 */
export function createDraft(originIds = CANONICAL_ORIGIN_IDS, options = {}) {
  const now = Number.isFinite(Number(options?.now)) ? Number(options.now) : Date.now()
  const id = typeof options?.id === 'string' && options.id.trim().length > 0
    ? options.id.trim()
    : generateDraftId(now)
  return { version: 1, draftId: id, counts: defaultCounts(originIds), updatedAt: now }
}

/** 安全读取指定出身计数（草稿缺失/出身未知一律返回 0）。 */
export function getOriginCount(draft, originId, originIds = CANONICAL_ORIGIN_IDS) {
  if (!draft || typeof draft !== 'object') return 0
  const counts = draft.counts && typeof draft.counts === 'object' ? draft.counts : {}
  return normalizeCount(counts[originId])
}

/** 更新指定出身计数（未知出身直接返回原草稿，不污染状态）。 */
export function setOriginCount(draft, originId, value, originIds = CANONICAL_ORIGIN_IDS) {
  const ids = resolveOriginIds(originIds)
  if (!ids.includes(originId)) return draft
  const counts = normalizeCounts(draft && draft.counts, ids)
  counts[originId] = normalizeCount(value)
  return {
    version: 1,
    draftId: draft && typeof draft.draftId === 'string' ? draft.draftId : '',
    counts,
    updatedAt: Date.now()
  }
}

/** 当前出身 +1（50 封顶，绝不超过 50）。 */
export function incrementOriginCount(draft, originId, originIds = CANONICAL_ORIGIN_IDS) {
  return setOriginCount(draft, originId, getOriginCount(draft, originId, originIds) + 1, originIds)
}

/** 只清零当前出身（自然神级 / 手动自选神级共用）。 */
export function resetOriginCount(draft, originId, originIds = CANONICAL_ORIGIN_IDS) {
  return setOriginCount(draft, originId, 0, originIds)
}

/** 保底是否已达 50。 */
export function isPityLimitReached(count) {
  return normalizeCount(count) >= PITY_LIMIT
}

// ============ storage 封装（全部 try/catch，存储异常不阻断创建流程） ============

export function safeStorageGet(storage, key) {
  try {
    return typeof storage?.getItem === 'function' ? storage.getItem(key) : null
  } catch {
    return null
  }
}

export function safeStorageSet(storage, key, value) {
  try {
    if (typeof storage?.setItem !== 'function') return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeStorageRemove(storage, key) {
  try {
    if (typeof storage?.removeItem !== 'function') return false
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** 读取创建草稿；不存在/损坏返回 null。不会读取旧全局键。 */
export function readDraft(storage, originIds = CANONICAL_ORIGIN_IDS) {
  const raw = safeStorageGet(storage, CREATION_PITY_KEY)
  if (raw === null || raw === undefined || raw === '') return null
  return parseDraft(raw, originIds)
}

/**
 * 写入创建草稿（自动规范化）。
 * - 草稿 ID 缺失/空白时自动生成新的非空唯一 ID（绝不写出空 draftId）；
 * - 保留已经规范化的合法出身计数；
 * - 写入结果保证可被 parseDraft() 重新读取；失败返回 false。
 */
export function writeDraft(storage, draft, originIds = CANONICAL_ORIGIN_IDS) {
  const base = draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {}
  const existingId = typeof base.draftId === 'string' ? base.draftId.trim() : ''
  const normalized = {
    version: 1,
    draftId: existingId.length > 0 ? existingId : generateDraftId(),
    counts: normalizeCounts(base.counts, originIds),
    updatedAt: Number.isFinite(Number(base.updatedAt)) ? Number(base.updatedAt) : Date.now()
  }
  return safeStorageSet(storage, CREATION_PITY_KEY, JSON.stringify(normalized))
}

/** 清除已完成草稿（仅删除创建期键，绝不触碰正式存档及其备份键）。 */
export function clearDraft(storage) {
  return safeStorageRemove(storage, CREATION_PITY_KEY)
}

/** 删除旧全局键 dldl_god_spirit_pity（不迁移）。 */
export function removeLegacyKey(storage) {
  return safeStorageRemove(storage, LEGACY_PITY_KEY)
}

/**
 * 进入创建页时的草稿保证：
 * - 删除旧全局键；
 * - 已有草稿则原样读取（刷新保留）；
 * - 无草稿则新建全 0 草稿（直接进入创建页的场景）。
 */
export function ensureDraft(storage, originIds = CANONICAL_ORIGIN_IDS) {
  removeLegacyKey(storage)
  let draft = readDraft(storage, originIds)
  if (!draft) {
    draft = createDraft(originIds)
    writeDraft(storage, draft, originIds)
  }
  return draft
}

/** 标题页“新的旅程”：明确开始新角色，建立全新草稿并清零全部出身。 */
export function newJourneyDraft(storage, originIds = CANONICAL_ORIGIN_IDS) {
  removeLegacyKey(storage)
  const draft = createDraft(originIds)
  writeDraft(storage, draft, originIds)
  return draft
}
