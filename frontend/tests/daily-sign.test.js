import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const gameDataHarness = vi.hoisted(() => ({
  data: { value: { npcData: [{ id: 'mentor', name: '导师' }] } }
}))
vi.mock('@/composables/useGameData', () => ({ useGameData() { return gameDataHarness } }))
vi.mock('@/composables/useBattleSystem', () => ({
  useBattleSystem() {
    return { isActive: () => false, start: () => {} }
  }
}))

import { DAILY_REWARDS, ORIGINS } from '@/data/game-data'
import { previewDailySign, recordDailySign } from '@/engine/rules'
import { useGameFeatures } from '@/composables/useGameFeatures'
import { deserializeSave, initNewCharacter, loadFromLocal, saveToLocal } from '@/stores/serializer'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

const spirit = {
  id: 'social_spirit', eventKey: 'social', name: '社交武魂', tier: 'mid',
  type: '辅助系', subtype: '光', attack: 12, defense: 10, hp: 50, speed: 12,
  image: '', desc: '人物互动测试', icon: '✨'
}

function createCharacter(name = '签到验收') {
  initNewCharacter({ name, origin: ORIGINS[0], spirit, innatePower: 50 })
}

function toastMessages() {
  return useUiStore().notifications.map(notification => notification.message)
}

function sums(texts) {
  let gold = 0, exp = 0
  for (const text of texts) {
    const g = text.match(/金币\+(\d+)/)
    const e = text.match(/经验\+(\d+)/)
    if (g) gold += Number(g[1])
    if (e) exp += Number(e[1])
  }
  return { gold, exp }
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
})

describe('每日签到：预览、发放与提示使用同一奖励对象', () => {
  it('第1天签到只发放面板列出的 100 金币，成就奖励单独可见', () => {
    createCharacter()
    const features = useGameFeatures()
    const player = usePlayerStore()
    const game = useGameStore()
    // 让签到金币恰好把累计收入推过 500，现场 +300/+80 的同类静默来源。
    game._totalGoldEarned = 450

    const preview = features.signPreview('2026-08-04')
    expect(preview).toMatchObject({ signedToday: false, nextStreak: 1, rewardDay: 1, today: '2026-08-04' })

    const goldBefore = player.gold
    const expBefore = player.exp
    features.dailySign('2026-08-04')

    // 签到本身发放第1天奖励 +100 金币；gold_500 成就额外 +50 金币/+20 经验。
    expect(player.gold - goldBefore).toBe(150)
    expect(player.exp - expBefore).toBe(20)

    const toasts = toastMessages()
    // 签到成功提示必须与面板预览（第1天 金币+100）完全一致。
    expect(toasts.at(-1)).toBe('签到成功，领取第1天奖励，金币+100')
    // 成就奖励以独立提示出现，不允许静默混入签到奖励。
    expect(toasts).toContain('解锁成就「小有积蓄」，奖励金币+50、经验+20')
    // 全部提示金额之和与角色实际增量完全一致。
    const total = sums(toasts)
    expect(total.gold).toBe(player.gold - goldBefore)
    expect(total.exp).toBe(player.exp - expBefore)

    expect(game._dailySign).toMatchObject({ lastDate: '2026-08-04', cycleDay: 1, totalDays: 1 })
  })

  it('连续签到第2天发放第2档：金币+150、经验+50', () => {
    createCharacter()
    const features = useGameFeatures()
    const player = usePlayerStore()
    const game = useGameStore()
    game._dailySign = { lastDate: '2026-08-03', cycleDay: 1, totalDays: 1 }
    // 50 经验不足以触发升级，保持增量可精确断言。
    player.level = 5
    player.exp = 10

    const preview = features.signPreview('2026-08-04')
    expect(preview).toMatchObject({ signedToday: false, nextStreak: 2, rewardDay: 2 })

    const goldBefore = player.gold
    const expBefore = player.exp
    features.dailySign('2026-08-04')

    expect(player.gold - goldBefore).toBe(150)
    expect(player.exp - expBefore).toBe(50)
    expect(player.level).toBe(5)
    expect(toastMessages().at(-1)).toBe('签到成功，领取第2天奖励，金币+150，经验+50')
    expect(game._dailySign).toMatchObject({ lastDate: '2026-08-04', cycleDay: 2, totalDays: 2 })
  })

  it.each(DAILY_REWARDS)('第$day天：成功提示与实际发放完全等于奖励表定义', (rewardEntry) => {
    createCharacter()
    const features = useGameFeatures()
    const player = usePlayerStore()
    const game = useGameStore()
    // level 28 + 2 环：新成长曲线下 400 经验不升级、不进溢出，保证经验增量可精确断言。
    // 预解锁会在该场景触发的成就，使本用例只验证“签到奖励”本身的数量关系。
    player.level = 28
    player.exp = 10
    player.rings = [{ bonus: {} }, { bonus: {} }]
    player._achievementList = ['lv_10', 'gold_500', 'gold_2000', 'sign_7']
    if (rewardEntry.day > 1) {
      game._dailySign = { lastDate: '2026-08-03', cycleDay: rewardEntry.day - 1, totalDays: rewardEntry.day - 1 }
    }

    const preview = features.signPreview('2026-08-04')
    expect(preview.rewardDay).toBe(rewardEntry.day)
    expect(preview.signedToday).toBe(false)

    const goldBefore = player.gold
    const expBefore = player.exp
    features.dailySign('2026-08-04')

    const labels = { gold: '金币', exp: '经验', fatePoint: '命运值' }
    const expectedParts = [`第${rewardEntry.day}天奖励`]
    const expectedDeltas = { gold: 0, exp: 0 }
    for (const [key, value] of Object.entries(rewardEntry.reward)) {
      expectedParts.push(`${labels[key] || key}+${value}`)
      if (key === 'gold') expectedDeltas.gold = value
      if (key === 'exp') expectedDeltas.exp = value
    }
    expect(toastMessages().at(-1)).toBe(`签到成功，领取${expectedParts.join('，')}`)
    // 奖励表中有多少就发多少；表中没有的经验/金币不得出现在提示或到账中。
    if (rewardEntry.reward.gold) expect(player.gold - goldBefore).toBe(rewardEntry.reward.gold)
    else expect(player.gold - goldBefore).toBe(0)
    if (rewardEntry.reward.exp) expect(player.exp - expBefore).toBe(rewardEntry.reward.exp)
    else expect(player.exp - expBefore).toBe(0)
    // 全部提示金额之和 === 实际增量（任何额外奖励都必须有提示）。
    const total = sums(toastMessages())
    expect(total.gold).toBe(player.gold - goldBefore)
    expect(total.exp).toBe(player.exp - expBefore)
    expect(game._dailySign.cycleDay).toBe(rewardEntry.day)
    expect(game._dailySign.totalDays).toBe(rewardEntry.day)
  })

  it('重复签到不重复领取，提示今日已经签到', () => {
    createCharacter()
    const features = useGameFeatures()
    const player = usePlayerStore()
    const game = useGameStore()

    features.dailySign('2026-08-04')
    expect(player.gold).toBe(200)
    expect(features.signPreview('2026-08-04').signedToday).toBe(true)

    const goldBefore = player.gold
    const expBefore = player.exp
    features.dailySign('2026-08-04')
    features.dailySign('2026-08-04')

    expect(player.gold).toBe(goldBefore)
    expect(player.exp).toBe(expBefore)
    expect(game._dailySign.totalDays).toBe(1)
    expect(toastMessages().slice(-2)).toEqual(['今日已经签到', '今日已经签到'])
  })

  it('刷新恢复后保留签到状态，且不能再次领取', () => {
    createCharacter()
    const features = useGameFeatures()
    const player = usePlayerStore()
    features.dailySign('2026-08-04')
    saveToLocal()

    // 模拟刷新：全新 pinia 从本地存档恢复。
    setActivePinia(createPinia())
    const restored = loadFromLocal()
    expect(restored).toBeTruthy()
    expect(deserializeSave(restored)).toBe(true)

    const features2 = useGameFeatures()
    const player2 = usePlayerStore()
    expect(player2.gold).toBe(200)
    expect(features2.signPreview('2026-08-04').signedToday).toBe(true)

    const goldBefore = player2.gold
    features2.dailySign('2026-08-04')
    expect(player2.gold).toBe(goldBefore)
    expect(features2.gameStore._dailySign.totalDays).toBe(1)
  })

  it('日期边界：断签重置为第1天，周循环回卷，同日不可领', () => {
    // 断签 5 天：连续中断，回落到第1天。
    expect(previewDailySign({ lastDate: '2026-07-30', cycleDay: 5 }, '2026-08-04'))
      .toMatchObject({ signedToday: false, dayGap: 5, nextStreak: 1, rewardDay: 1 })
    // 第7天后再签：连续 8 天，奖励回卷到第1天。
    expect(previewDailySign({ lastDate: '2026-08-03', cycleDay: 7 }, '2026-08-04'))
      .toMatchObject({ nextStreak: 8, rewardDay: 1 })
    expect(recordDailySign({ lastDate: '2026-08-03', cycleDay: 7, totalDays: 7 }, '2026-08-04'))
      .toMatchObject({ changed: true, nextStreak: 8, rewardDay: 1 })
    // 同日已签到：不可重复记录，天数不再增长。
    expect(recordDailySign({ lastDate: '2026-08-04', cycleDay: 3, totalDays: 3 }, '2026-08-04'))
      .toMatchObject({ changed: false, signedToday: true, nextStreak: 3, rewardDay: 3 })
  })

  it('面板跨午夜后点击：以点击时最新日期发放，不发放旧日期奖励', () => {
    createCharacter()
    const features = useGameFeatures()
    const game = useGameStore()
    game._dailySign = { lastDate: '2026-08-03', cycleDay: 1, totalDays: 1 }
    // 面板在 08-03 打开时显示“今日已签到”；玩家午夜后再次点击。
    expect(features.signPreview('2026-08-03').signedToday).toBe(true)

    // 弹窗点击处理：onSignIn 重新计算当天预览并以其 today 发放。
    const fresh = features.signPreview('2026-08-04')
    expect(fresh.signedToday).toBe(false)
    expect(fresh.today).toBe('2026-08-04')
    features.dailySign(fresh.today)

    expect(toastMessages().at(-1)).toBe('签到成功，领取第2天奖励，金币+150，经验+50')
    expect(game._dailySign.lastDate).toBe('2026-08-04')
    expect(game._dailySign.cycleDay).toBe(2)
  })
})
