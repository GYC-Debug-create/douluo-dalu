import { describe, expect, it } from 'vitest'
import { ORIGINS } from '@/data/game-data'
import {
  PITY_LIMIT,
  CREATION_PITY_KEY,
  LEGACY_PITY_KEY,
  normalizeCount,
  defaultCounts,
  normalizeCounts,
  parseDraft,
  createDraft,
  getOriginCount,
  setOriginCount,
  incrementOriginCount,
  resetOriginCount,
  isPityLimitReached,
  readDraft,
  writeDraft,
  clearDraft,
  removeLegacyKey,
  ensureDraft,
  newJourneyDraft
} from '@/utils/creation-pity'

const ORIGIN_IDS = ORIGINS.map(o => o.id)
const SAVE_KEY = 'dldl_text_rpg_save'

function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: key => { map.delete(key) },
    dump: () => Object.fromEntries(map)
  }
}

function draftWith(overrides = {}) {
  const base = createDraft(ORIGIN_IDS, { id: 'test-draft', now: 1000 })
  const draft = setOriginCount(base, 'star_forest', overrides.star_forest ?? 17, ORIGIN_IDS)
  return setOriginCount(draft, 'spirit_city', overrides.spirit_city ?? 0, ORIGIN_IDS)
}

describe('BUG-DIALOG-003 创建草稿保底（按出身隔离）', () => {
  it('新草稿四个出身全部为 0', () => {
    const draft = createDraft(ORIGIN_IDS, { id: 'fresh', now: 1 })
    expect(draft.version).toBe(1)
    expect(draft.draftId).toBe('fresh')
    expect(draft.counts).toEqual({ star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 })
    expect(getOriginCount(draft, 'star_forest', ORIGIN_IDS)).toBe(0)
    expect(getOriginCount(draft, 'sea_island', ORIGIN_IDS)).toBe(0)
  })

  it('星斗小村累计 17 时，武魂城世家仍为 0', () => {
    const draft = setOriginCount(createDraft(ORIGIN_IDS), 'star_forest', 17, ORIGIN_IDS)
    expect(getOriginCount(draft, 'star_forest', ORIGIN_IDS)).toBe(17)
    expect(getOriginCount(draft, 'spirit_city', ORIGIN_IDS)).toBe(0)
    expect(getOriginCount(draft, 'border_town', ORIGIN_IDS)).toBe(0)
    expect(getOriginCount(draft, 'sea_island', ORIGIN_IDS)).toBe(0)
  })

  it('武魂城世家增加到 1，不影响星斗小村的 17', () => {
    const draft = incrementOriginCount(draftWith(), 'spirit_city', ORIGIN_IDS)
    expect(getOriginCount(draft, 'spirit_city', ORIGIN_IDS)).toBe(1)
    expect(getOriginCount(draft, 'star_forest', ORIGIN_IDS)).toBe(17)
  })

  it('切回星斗小村恢复 17', () => {
    const draft = draftWith()
    const afterCity = incrementOriginCount(draft, 'spirit_city', ORIGIN_IDS)
    expect(getOriginCount(afterCity, 'star_forest', ORIGIN_IDS)).toBe(17)
    expect(getOriginCount(afterCity, 'spirit_city', ORIGIN_IDS)).toBe(1)
  })

  it('刷新后重新读取（经 JSON 序列化往返），两个出身分别保持 17 和 1', () => {
    const storage = createFakeStorage()
    writeDraft(storage, draftWith({ spirit_city: 1 }), ORIGIN_IDS)
    const raw = storage.dump()[CREATION_PITY_KEY]
    expect(typeof raw).toBe('string')
    const restored = readDraft(storage, ORIGIN_IDS)
    expect(restored).not.toBeNull()
    expect(getOriginCount(restored, 'star_forest', ORIGIN_IDS)).toBe(17)
    expect(getOriginCount(restored, 'spirit_city', ORIGIN_IDS)).toBe(1)
    expect(getOriginCount(restored, 'border_town', ORIGIN_IDS)).toBe(0)
    expect(restored.version).toBe(1)
  })

  it('明确开始“新的旅程”后，所有出身归零', () => {
    const storage = createFakeStorage()
    writeDraft(storage, draftWith(), ORIGIN_IDS)
    const fresh = newJourneyDraft(storage, ORIGIN_IDS)
    expect(fresh.counts).toEqual({ star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 })
    const restored = readDraft(storage, ORIGIN_IDS)
    expect(getOriginCount(restored, 'star_forest', ORIGIN_IDS)).toBe(0)
    expect(getOriginCount(restored, 'spirit_city', ORIGIN_IDS)).toBe(0)
  })

  it('自然神级只清零当前出身', () => {
    const draft = draftWith({ spirit_city: 1 })
    const after = resetOriginCount(draft, 'star_forest', ORIGIN_IDS)
    expect(getOriginCount(after, 'star_forest', ORIGIN_IDS)).toBe(0)
    expect(getOriginCount(after, 'spirit_city', ORIGIN_IDS)).toBe(1)
  })

  it('手动自选神级只清零当前出身', () => {
    const draft = draftWith()
    const after = resetOriginCount(draft, 'spirit_city', ORIGIN_IDS)
    expect(getOriginCount(after, 'spirit_city', ORIGIN_IDS)).toBe(0)
    expect(getOriginCount(after, 'star_forest', ORIGIN_IDS)).toBe(17)
  })

  it('49 → 50 正常累计', () => {
    const draft = setOriginCount(createDraft(ORIGIN_IDS), 'star_forest', 49, ORIGIN_IDS)
    expect(isPityLimitReached(getOriginCount(draft, 'star_forest', ORIGIN_IDS))).toBe(false)
    const after = incrementOriginCount(draft, 'star_forest', ORIGIN_IDS)
    expect(getOriginCount(after, 'star_forest', ORIGIN_IDS)).toBe(50)
    expect(isPityLimitReached(getOriginCount(after, 'star_forest', ORIGIN_IDS))).toBe(true)
  })

  it('50 后再次增加仍为 50（绝无 51/50）', () => {
    const draft = setOriginCount(createDraft(ORIGIN_IDS), 'star_forest', 50, ORIGIN_IDS)
    const after1 = incrementOriginCount(draft, 'star_forest', ORIGIN_IDS)
    const after2 = incrementOriginCount(after1, 'star_forest', ORIGIN_IDS)
    expect(getOriginCount(after1, 'star_forest', ORIGIN_IDS)).toBe(50)
    expect(getOriginCount(after2, 'star_forest', ORIGIN_IDS)).toBe(50)
  })

  it('负数、字符串、NaN、Infinity、51、超大数安全规范化', () => {
    expect(normalizeCount(-5)).toBe(0)
    expect(normalizeCount(3.9)).toBe(3)
    expect(normalizeCount('12')).toBe(12)
    expect(normalizeCount('abc')).toBe(0)
    expect(normalizeCount(NaN)).toBe(0)
    expect(normalizeCount(Infinity)).toBe(0)
    expect(normalizeCount(-Infinity)).toBe(0)
    expect(normalizeCount(51)).toBe(50)
    expect(normalizeCount(1e9)).toBe(50)
    expect(normalizeCount(undefined)).toBe(0)
    expect(normalizeCount(null)).toBe(0)
    expect(normalizeCount(50)).toBe(50)
    const draft = setOriginCount(createDraft(ORIGIN_IDS), 'star_forest', 999, ORIGIN_IDS)
    expect(getOriginCount(draft, 'star_forest', ORIGIN_IDS)).toBe(50)
  })

  it('损坏 JSON 安全回退', () => {
    expect(parseDraft('not-json{{{', ORIGIN_IDS)).toBeNull()
    expect(parseDraft('', ORIGIN_IDS)).toBeNull()
    expect(parseDraft('null', ORIGIN_IDS)).toBeNull()
    expect(parseDraft('[]', ORIGIN_IDS)).toBeNull()
    expect(parseDraft(JSON.stringify({ version: 99 }), ORIGIN_IDS)).toBeNull()
    const storage = createFakeStorage({ [CREATION_PITY_KEY]: 'broken{{' })
    expect(readDraft(storage, ORIGIN_IDS)).toBeNull()
    const draft = ensureDraft(storage, ORIGIN_IDS)
    expect(draft.counts).toEqual({ star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 })
    expect(() => readDraft(storage, ORIGIN_IDS)).not.toThrow()
  })

  it('未知出身 ID 被忽略，不能污染状态', () => {
    const dirty = { star_forest: 17, evil_origin: 99, spirit_city: '1' }
    const counts = normalizeCounts(dirty, ORIGIN_IDS)
    expect(counts).toEqual({ star_forest: 17, spirit_city: 1, border_town: 0, sea_island: 0 })
    expect(counts.evil_origin).toBeUndefined()
    const draft = setOriginCount(createDraft(ORIGIN_IDS), 'unknown_origin', 99, ORIGIN_IDS)
    expect(draft.counts).toEqual({ star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 })
    const parsed = parseDraft(JSON.stringify({ version: 1, draftId: 'd', counts: { evil: 5, star_forest: '17' }, updatedAt: 1 }), ORIGIN_IDS)
    expect(Object.keys(parsed.counts).sort()).toEqual([...ORIGIN_IDS].sort())
    expect(parsed.counts.star_forest).toBe(17)
  })

  it('旧全局键即使为 49 也不能迁移给任何出身', () => {
    const storage = createFakeStorage({ [LEGACY_PITY_KEY]: '49' })
    expect(readDraft(storage, ORIGIN_IDS)).toBeNull()
    const draft = ensureDraft(storage, ORIGIN_IDS)
    expect(draft.counts.star_forest).toBe(0)
    expect(draft.counts.spirit_city).toBe(0)
    expect(draft.counts.border_town).toBe(0)
    expect(draft.counts.sea_island).toBe(0)
    expect(storage.dump()[LEGACY_PITY_KEY]).toBeUndefined()
    newJourneyDraft(storage, ORIGIN_IDS)
    expect(storage.dump()[LEGACY_PITY_KEY]).toBeUndefined()
    expect(readDraft(storage, ORIGIN_IDS).counts.star_forest).toBe(0)
  })

  it('localStorage 读写抛错时页面逻辑不崩溃', () => {
    const throwing = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') }
    }
    expect(() => readDraft(throwing, ORIGIN_IDS)).not.toThrow()
    expect(readDraft(throwing, ORIGIN_IDS)).toBeNull()
    expect(writeDraft(throwing, createDraft(ORIGIN_IDS), ORIGIN_IDS)).toBe(false)
    expect(() => ensureDraft(throwing, ORIGIN_IDS)).not.toThrow()
    const draft = ensureDraft(throwing, ORIGIN_IDS)
    expect(getOriginCount(draft, 'star_forest', ORIGIN_IDS)).toBe(0)
    const after = incrementOriginCount(draft, 'star_forest', ORIGIN_IDS)
    expect(getOriginCount(after, 'star_forest', ORIGIN_IDS)).toBe(1)
    expect(() => clearDraft(throwing)).not.toThrow()
    expect(() => removeLegacyKey(throwing)).not.toThrow()
    expect(() => newJourneyDraft(throwing, ORIGIN_IDS)).not.toThrow()
  })

  it('清除草稿不影响 dldl_text_rpg_save 及其备份键', () => {
    const storage = createFakeStorage({
      [SAVE_KEY]: '{"name":"x"}',
      [`${SAVE_KEY}_backup`]: '{"name":"old"}',
      [`${SAVE_KEY}_hist1`]: 'h1',
      [`${SAVE_KEY}_hist2`]: 'h2',
      [`${SAVE_KEY}_hist3`]: 'h3',
      [`${SAVE_KEY}_hist4`]: 'h4',
      [CREATION_PITY_KEY]: '{"version":1}'
    })
    const before = storage.dump()
    clearDraft(storage)
    const after = storage.dump()
    expect(after[SAVE_KEY]).toBe(before[SAVE_KEY])
    expect(after[`${SAVE_KEY}_backup`]).toBe(before[`${SAVE_KEY}_backup`])
    expect(after[`${SAVE_KEY}_hist1`]).toBe('h1')
    expect(after[`${SAVE_KEY}_hist2`]).toBe('h2')
    expect(after[`${SAVE_KEY}_hist3`]).toBe('h3')
    expect(after[`${SAVE_KEY}_hist4`]).toBe('h4')
    expect(after[CREATION_PITY_KEY]).toBeUndefined()
  })

  it('不修改原始 ORIGINS 数组', () => {
    const snapshot = JSON.stringify(ORIGINS)
    const ids = ORIGINS.map(o => o.id)
    const draft = createDraft(ids)
    setOriginCount(draft, 'star_forest', 17, ids)
    incrementOriginCount(draft, 'spirit_city', ids)
    resetOriginCount(draft, 'star_forest', ids)
    normalizeCounts({ star_forest: 3 }, ids)
    defaultCounts(ids)
    expect(JSON.stringify(ORIGINS)).toBe(snapshot)
    expect(ORIGINS.length).toBe(4)
    expect(ORIGINS.map(o => o.id)).toEqual(['star_forest', 'spirit_city', 'border_town', 'sea_island'])
  })

  it('同样输入输出稳定，不依赖随机数', () => {
    const base = createDraft(ORIGIN_IDS, { id: 'fixed', now: 42 })
    const a1 = setOriginCount(base, 'star_forest', 17, ORIGIN_IDS)
    const a2 = setOriginCount(base, 'star_forest', 17, ORIGIN_IDS)
    expect(a1.counts).toEqual(a2.counts)
    expect(a1.draftId).toBe(a2.draftId)
    const b1 = incrementOriginCount(a1, 'spirit_city', ORIGIN_IDS)
    const b2 = incrementOriginCount(a1, 'spirit_city', ORIGIN_IDS)
    expect(b1.counts).toEqual(b2.counts)
    expect(normalizeCount(7)).toBe(7)
    expect(normalizeCount(7)).toBe(7)
    expect(PITY_LIMIT).toBe(50)
  })

  it('ensureDraft 在无草稿时自动建立新草稿（直接进入创建页）', () => {
    const storage = createFakeStorage()
    const draft = ensureDraft(storage, ORIGIN_IDS)
    expect(draft.counts.star_forest).toBe(0)
    expect(storage.dump()[CREATION_PITY_KEY]).toBeDefined()
    const again = ensureDraft(storage, ORIGIN_IDS)
    expect(again.draftId).toBe(draft.draftId)
  })

  it('defaultCounts 对空数组/非法入参安全降级为四出身全 0', () => {
    expect(defaultCounts([])).toEqual({ star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 })
    expect(defaultCounts(null)).toEqual({ star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 })
    expect(() => normalizeCounts(null, [])).not.toThrow()
    expect(getOriginCount(null, 'star_forest', ORIGIN_IDS)).toBe(0)
    expect(() => incrementOriginCount(null, 'star_forest', ORIGIN_IDS)).not.toThrow()
  })
})

describe('BUG-DIALOG-003-R2 损坏草稿校验', () => {
  const json = (overrides = {}) => JSON.stringify({
    version: 1,
    draftId: 'draft_abc123',
    counts: { star_forest: 17, spirit_city: 0, border_town: 0, sea_island: 0 },
    updatedAt: 1000,
    ...overrides
  })

  it('缺少 draftId 返回 null', () => {
    const parsed = JSON.parse(json())
    delete parsed.draftId
    expect(parseDraft(JSON.stringify(parsed), ORIGIN_IDS)).toBeNull()
  })

  it('draftId 不是字符串（数字/对象/null）返回 null', () => {
    expect(parseDraft(json({ draftId: 123 }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ draftId: { x: 1 } }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ draftId: null }), ORIGIN_IDS)).toBeNull()
  })

  it('空 draftId 与纯空白 draftId 返回 null', () => {
    expect(parseDraft(json({ draftId: '' }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ draftId: '   ' }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ draftId: '\t\n ' }), ORIGIN_IDS)).toBeNull()
  })

  it('缺少 counts 返回 null', () => {
    const parsed = JSON.parse(json())
    delete parsed.counts
    expect(parseDraft(JSON.stringify(parsed), ORIGIN_IDS)).toBeNull()
  })

  it('counts 为 null、数组、字符串、数字时返回 null', () => {
    expect(parseDraft(json({ counts: null }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ counts: [1, 2] }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ counts: 'abc' }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ counts: 7 }), ORIGIN_IDS)).toBeNull()
  })

  it('缺少 updatedAt 返回 null', () => {
    const parsed = JSON.parse(json())
    delete parsed.updatedAt
    expect(parseDraft(JSON.stringify(parsed), ORIGIN_IDS)).toBeNull()
  })

  it('updatedAt 为 NaN、Infinity、非数字字符串或 null 时返回 null', () => {
    expect(parseDraft(json({ updatedAt: NaN }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ updatedAt: Infinity }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ updatedAt: 'abc' }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ updatedAt: '123' }), ORIGIN_IDS)).toBeNull()
    expect(parseDraft(json({ updatedAt: null }), ORIGIN_IDS)).toBeNull()
  })

  it('合法 draftId 读取时执行 trim，且不改变正常生成的 ID', () => {
    const parsed = parseDraft(json({ draftId: '  draft_abc123  ' }), ORIGIN_IDS)
    expect(parsed.draftId).toBe('draft_abc123')
    expect(parsed.counts.star_forest).toBe(17)
    const normal = createDraft(ORIGIN_IDS, { id: 'normal-id', now: 5 })
    const roundTrip = parseDraft(JSON.stringify(normal), ORIGIN_IDS)
    expect(roundTrip.draftId).toBe('normal-id')
  })

  it('writeDraft 输入空 ID 时写出新的非空唯一 ID，并保留合法出身计数', () => {
    const storage = createFakeStorage()
    const ok = writeDraft(storage, { version: 1, draftId: '   ', counts: { star_forest: 17 }, updatedAt: 1000 }, ORIGIN_IDS)
    expect(ok).toBe(true)
    const stored = JSON.parse(storage.dump()[CREATION_PITY_KEY])
    expect(typeof stored.draftId).toBe('string')
    expect(stored.draftId.trim().length).toBeGreaterThan(0)
    expect(stored.draftId).not.toBe('   ')
    expect(stored.draftId).not.toMatch(/^\s+$/)
    expect(stored.counts).toEqual({ star_forest: 17, spirit_city: 0, border_town: 0, sea_island: 0 })
    expect(parseDraft(JSON.stringify(stored), ORIGIN_IDS)).not.toBeNull()
  })

  it('writeDraft 结果可以再次被 parseDraft 读取', () => {
    const storage = createFakeStorage()
    writeDraft(storage, draftWith({ spirit_city: 1 }), ORIGIN_IDS)
    const restored = readDraft(storage, ORIGIN_IDS)
    expect(restored).not.toBeNull()
    expect(restored.draftId).toBe('test-draft')
    expect(restored.version).toBe(1)
    expect(getOriginCount(restored, 'star_forest', ORIGIN_IDS)).toBe(17)
    expect(getOriginCount(restored, 'spirit_city', ORIGIN_IDS)).toBe(1)
  })

  it('ensureDraft 遇到缺字段草稿时建立全 0 新草稿，不继承旧计数，不抛错', () => {
    const broken = JSON.parse(json({ counts: { star_forest: 17 } }))
    delete broken.draftId
    const storage = createFakeStorage({ [CREATION_PITY_KEY]: JSON.stringify(broken) })
    expect(() => ensureDraft(storage, ORIGIN_IDS)).not.toThrow()
    const draft = ensureDraft(storage, ORIGIN_IDS)
    expect(draft.counts).toEqual({ star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 })
    expect(typeof draft.draftId).toBe('string')
    expect(draft.draftId.trim().length).toBeGreaterThan(0)
    expect(draft.draftId).not.toBe(broken.draftId)
  })
})
