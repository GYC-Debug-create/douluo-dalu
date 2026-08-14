import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ACHIEVEMENTS } from '@/data/game-data'
import { useEventStore } from '@/stores/event'
import {
  appendDiaryEntry,
  migrateSave,
  MAX_DIARY_ENTRIES,
  truncateDiary
} from '@/engine/save'

function diaryEntries(count) {
  return Array.from({ length: count }, (_, i) => ({
    turn: i, level: 1, phase: '学院篇', text: `日记${i}`, type: 'event', time: i
  }))
}

function minimalSave(diary) {
  return {
    name: '日记迁移', spirit: { name: '蓝银草', icon: '🌿' }, level: 1, hp: 100,
    _diary: diary
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('冒险日记上限与迁移（BUG-日记无限增长）', () => {
  it('appendDiaryEntry：199 条时追加后为 200，不截断', () => {
    const diary = diaryEntries(199)
    appendDiaryEntry(diary, { turn: 199, text: '第200条', type: 'event', time: 199 })
    expect(diary.length).toBe(200)
    expect(diary[199].text).toBe('第200条')
  })

  it('appendDiaryEntry：200 条时追加一条，截断为最新 200 条且顺序正确', () => {
    const diary = diaryEntries(200)
    appendDiaryEntry(diary, { turn: 200, text: '第201条', type: 'event', time: 200 })
    expect(diary.length).toBe(MAX_DIARY_ENTRIES)
    expect(diary[0].text).toBe('日记1') // 最旧一条被移除
    expect(diary[199].text).toBe('第201条') // 最新一条保留
    // 顺序保持连续
    for (let i = 0; i < 200; i++) expect(diary[i].turn).toBe(i + 1)
  })

  it('appendDiaryEntry：500 条时追加，只保留最新 200 条', () => {
    const diary = diaryEntries(500)
    appendDiaryEntry(diary, { turn: 500, text: '第501条', type: 'event', time: 500 })
    expect(diary.length).toBe(200)
    expect(diary[0].turn).toBe(301)
    expect(diary[199].text).toBe('第501条')
  })

  it('truncateDiary：199/200 条不截断，201/500 条截断为最新 200 条', () => {
    expect(truncateDiary(diaryEntries(199)).length).toBe(199)
    expect(truncateDiary(diaryEntries(200)).length).toBe(200)

    const cut201 = truncateDiary(diaryEntries(201))
    expect(cut201.length).toBe(200)
    expect(cut201[0].turn).toBe(1)
    expect(cut201[199].turn).toBe(200)

    const cut500 = truncateDiary(diaryEntries(500))
    expect(cut500.length).toBe(200)
    expect(cut500[0].turn).toBe(300)
    expect(cut500[199].turn).toBe(499)
  })

  it('truncateDiary 幂等：重复迁移结果一致', () => {
    const once = truncateDiary(diaryEntries(500))
    const twice = truncateDiary(once)
    expect(twice).toEqual(once)
    expect(twice.length).toBe(200)
  })

  it('truncateDiary 处理非数组输入', () => {
    expect(truncateDiary(null)).toEqual([])
    expect(truncateDiary(undefined)).toEqual([])
    expect(truncateDiary('bad')).toEqual([])
  })

  it('migrateSave 对旧存档日记截断为最新 200 条，且保留字段', () => {
    const diary = diaryEntries(500)
    const migrated = migrateSave(minimalSave(diary))
    expect(migrated).not.toBeNull()
    expect(migrated._diary.length).toBe(200)
    expect(migrated._diary[199].text).toBe('日记499')
    expect(migrated._diary[0].text).toBe('日记300')
    // 字段完整
    expect(migrated._diary[0]).toHaveProperty('turn')
    expect(migrated._diary[0]).toHaveProperty('level')
    expect(migrated._diary[0]).toHaveProperty('phase')
    expect(migrated._diary[0]).toHaveProperty('type')
    expect(migrated._diary[0]).toHaveProperty('time')
  })

  it('migrateSave 对 200 条以内的日记不改变', () => {
    const diary = diaryEntries(100)
    const migrated = migrateSave(minimalSave(diary))
    expect(migrated._diary.length).toBe(100)
    expect(migrated._diary).toEqual(diary)
  })

  it('migrateSave 重复迁移幂等', () => {
    const migratedOnce = migrateSave(minimalSave(diaryEntries(500)))
    const migratedTwice = migrateSave(migratedOnce)
    expect(migratedTwice._diary).toEqual(migratedOnce._diary)
    expect(migratedTwice._diary.length).toBe(200)
  })

  it('diary_50 / diary_100 成就判定不受截断影响', () => {
    const diary50 = ACHIEVEMENTS.find(a => a.id === 'diary_50')
    const diary100 = ACHIEVEMENTS.find(a => a.id === 'diary_100')
    expect(diary50).toBeTruthy()
    expect(diary100).toBeTruthy()
    expect(diary50.cond({ _diary: Array(50).fill({}) })).toBe(true)
    expect(diary100.cond({ _diary: Array(100).fill({}) })).toBe(true)
    expect(diary100.cond({ _diary: Array(200).fill({}) })).toBe(true)
    expect(diary50.cond({ _diary: Array(49).fill({}) })).toBe(false)
  })

  it('Event store 的公共写入口同样遵守 200 条上限', () => {
    const eventStore = useEventStore()
    for (let index = 0; index < 201; index++) {
      eventStore.addDiaryEntry({ turn: index, text: `记录${index}` })
    }
    expect(eventStore._diary).toHaveLength(MAX_DIARY_ENTRIES)
    expect(eventStore._diary[0].turn).toBe(1)
    expect(eventStore._diary.at(-1).turn).toBe(200)
  })
})
