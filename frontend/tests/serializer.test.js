import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ORIGINS } from '@/data/game-data'
import { usePlayerStore } from '@/stores/player'
import { useCombatStore } from '@/stores/combat'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import {
  LOCAL_SAVE_KEY,
  deserializeSave,
  initialLevelFromInnatePower,
  initNewCharacter,
  loadFromLocal,
  saveToLocal,
  serializeSave
} from '@/stores/serializer'

class MemoryStorage {
  constructor() { this.values = new Map() }
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

class CountingStorage extends MemoryStorage {
  constructor() {
    super()
    this.setKeys = []
    this.removeKeys = []
  }
  setItem(key, value) {
    this.setKeys.push(String(key))
    super.setItem(key, value)
  }
  removeItem(key) {
    this.removeKeys.push(String(key))
    super.removeItem(key)
  }
}

class LimitedStorage extends MemoryStorage {
  constructor() {
    super()
    this.limit = Infinity
  }
  bytes() {
    let total = 0
    for (const [key, value] of this.values) total += key.length + value.length
    return total
  }
  setItem(key, value) {
    const normalizedKey = String(key)
    const normalizedValue = String(value)
    const current = this.values.get(normalizedKey)
    const next = this.bytes() - (current ? normalizedKey.length + current.length : 0) + normalizedKey.length + normalizedValue.length
    if (next > this.limit) {
      const error = new Error('quota exceeded')
      error.name = 'QuotaExceededError'
      error.code = 22
      throw error
    }
    super.setItem(normalizedKey, normalizedValue)
  }
}

class HistoryRejectingStorage extends MemoryStorage {
  setItem(key, value) {
    if (String(key).includes('_hist')) throw new Error('history unavailable')
    super.setItem(key, value)
  }
}

const spirit = {
  id: 'test_spirit', eventKey: 'test', name: '测试武魂', tier: 'mid',
  type: '器武魂', subtype: '武器', attack: 12, defense: 8, hp: 30, speed: 9,
  image: '', desc: '测试用武魂', icon: '⚔'
}

function createCharacter(name = '测试魂师') {
  initNewCharacter({ name, origin: ORIGINS[0], spirit, innatePower: 50 })
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
})

describe('Vue 存档兼容', () => {
  it('BUG-DIALOG-008 先天魂力按十点一级换算并钳制在 Lv.1~10', () => {
    expect(initialLevelFromInnatePower(-1)).toBe(1)
    expect(initialLevelFromInnatePower(9)).toBe(1)
    expect(initialLevelFromInnatePower(20)).toBe(2)
    expect(initialLevelFromInnatePower(75)).toBe(7)
    expect(initialLevelFromInnatePower(90)).toBe(9)
    expect(initialLevelFromInnatePower(99)).toBe(9)
    expect(initialLevelFromInnatePower(100)).toBe(10)
    expect(initialLevelFromInnatePower(999)).toBe(10)
  })

  it('BUG-DIALOG-008 满魂力开局只解锁第一魂环资格，不自动发放魂环或魂技', () => {
    initNewCharacter({ name: '满魂力验收', origin: ORIGINS[0], spirit: { ...spirit, tier: 'god' }, innatePower: 100 })
    const player = usePlayerStore()
    const event = useEventStore()
    expect(player.level).toBe(10)
    expect(player.exp).toBe(0)
    expect(player.rings).toEqual([])
    expect(player.skills).toEqual([])
    expect(event.pendingRingLv).toBe(10)
    expect(event._ringHuntDeferredUntil).toBe(0)
  })

  it('BUG-DIALOG-008 九十点先天魂力从 Lv.9 开始且不提前解锁魂环位', () => {
    initNewCharacter({ name: '九级验收', origin: ORIGINS[0], spirit: { ...spirit, tier: 'top' }, innatePower: 90 })
    expect(usePlayerStore().level).toBe(9)
    expect(useEventStore().pendingRingLv).toBeNull()
  })

  it('新角色会清空旧运行态，并以最终属性满血开局', () => {
    const player = usePlayerStore()
    const event = useEventStore()
    const game = useGameStore()
    player.inventory.push({ name: '旧角色道具', count: 99 })
    event.doneEvents.push('old_event')
    game._visitedLocations.push('old_location')

    createCharacter()

    expect(player.hp).toBeGreaterThan(0)
    expect(player.inventory.some(item => item.name === '旧角色道具')).toBe(false)
    expect(event.doneEvents).toEqual([])
    expect(game._visitedLocations).toEqual([])
    expect(player.inventory.find(item => item.name === '回魂丹')?.count).toBe(2)
  })

  it('始终写旧版正式键，并可迁移开发期 Vue 临时键', () => {
    createCharacter()
    const saved = saveToLocal()
    expect(localStorage.getItem(LOCAL_SAVE_KEY)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(LOCAL_SAVE_KEY)).playerId).toBe(saved.playerId)

    localStorage.clear()
    localStorage.setItem('dldl_save', JSON.stringify(saved))
    const migrated = loadFromLocal()
    expect(migrated.playerId).toBe(saved.playerId)
    expect(localStorage.getItem(LOCAL_SAVE_KEY)).toBeTruthy()
  })

  it('旧事件动态标记往返后不丢失，加载另一角色会先重置所有 store', () => {
    createCharacter('角色甲')
    const event = useEventStore()
    const player = usePlayerStore()
    event._dynamicFlags._mentorAccepted = true
    const roleA = serializeSave()
    expect(roleA._mentorAccepted).toBe(true)

    const roleB = { ...roleA, playerId: 'p_role_b', name: '角色乙', _mentorAccepted: false }
    player._bossKills = 99
    expect(deserializeSave(roleB)).toBe(true)
    expect(player.name).toBe('角色乙')
    expect(player._bossKills).toBe(roleB._bossKills || 0)
    expect(event._dynamicFlags._mentorAccepted).toBe(false)
  })

  it('浏览器拒绝写入时明确抛出存档错误', () => {
    createCharacter()
    globalThis.localStorage = {
      getItem() { return null },
      setItem() { throw new Error('storage denied') },
      removeItem() {},
      clear() {}
    }
    expect(() => saveToLocal()).toThrow('storage denied')
  })

  it('连续保存不逐次搬移五份历史，手动保存可强制创建历史快照', () => {
    const storage = new CountingStorage()
    globalThis.localStorage = storage
    createCharacter('历史压力测试')
    const player = usePlayerStore()

    saveToLocal()
    player.gold += 1
    saveToLocal()
    player.gold += 1
    saveToLocal()
    player.gold += 1
    saveToLocal()

    const normalHistoryWrites = storage.setKeys.filter(key => /_hist[1-5]$/.test(key))
    expect(normalHistoryWrites).toEqual([])

    player.gold += 1
    saveToLocal({ forceHistory: true })
    expect(storage.getItem(`${LOCAL_SAVE_KEY}_hist1`)).toBeTruthy()
    expect(loadFromLocal().gold).toBe(player.gold)
  })

  it('QuotaExceededError 时按 hist5→hist1 清理后优先保住最新主档', () => {
    const storage = new LimitedStorage()
    globalThis.localStorage = storage
    createCharacter('容量测试A')
    saveToLocal()
    const previousMain = storage.getItem(LOCAL_SAVE_KEY)
    storage.setItem(`${LOCAL_SAVE_KEY}_backup`, previousMain)
    for (let index = 1; index <= 5; index++) {
      storage.setItem(`${LOCAL_SAVE_KEY}_hist${index}`, '历史副本'.repeat(500))
    }
    storage.limit = storage.bytes() + 10

    const player = usePlayerStore()
    player.name = '容量测试B'.repeat(100)
    expect(() => saveToLocal()).not.toThrow()
    expect(JSON.parse(storage.getItem(LOCAL_SAVE_KEY)).name).toBe(player.name)
    expect(storage.getItem(LOCAL_SAVE_KEY)).toBeTruthy()
  })

  it('历史链写入失败不回滚已经成功写入的主档', () => {
    const storage = new HistoryRejectingStorage()
    globalThis.localStorage = storage
    createCharacter('历史失败测试')
    saveToLocal()
    const player = usePlayerStore()
    player.gold += 99
    expect(() => saveToLocal()).not.toThrow()
    expect(JSON.parse(storage.getItem(LOCAL_SAVE_KEY)).gold).toBe(player.gold)
  })

  it('战斗成就与隐藏结局所需遥测会随存档往返', () => {
    createCharacter()
    const combat = useCombatStore()
    combat._maxCombo = 20
    combat._maxComboFinisher = 20
    combat._reactionCount = 30
    combat._reactionTriggered = true
    combat._fusionUsed = true
    combat._usedElements = ['fire', 'water', 'wind', 'earth', 'thunder', 'ice', 'light', 'dark']
    const saved = serializeSave()

    combat.$reset()
    expect(deserializeSave(saved)).toBe(true)
    expect(combat._maxCombo).toBe(20)
    expect(combat._maxComboFinisher).toBe(20)
    expect(combat._reactionCount).toBe(30)
    expect(combat._reactionTriggered).toBe(true)
    expect(combat._fusionUsed).toBe(true)
    expect(combat._usedElements).toHaveLength(8)
  })
})
