import { describe, expect, it } from 'vitest'
import { EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS } from '@/data/game-data'
import { LOCATION_EVENTS } from '@/data/location-events'
import { LATE_GAME_EVENTS } from '@/data/late-game-events'
import { MAIN_STORY_EVENTS } from '@/data/main-story'
import '@/data/events-expanded'
import {
  adaptEvent,
  isEventEligible,
  eventRuleSummary,
  choiceHasLevelRequirement
} from '@/engine/event-rules'
import { rankTitleForLevel } from '@/engine/rules'

const byId = id => EVENTS.find(event => event.id === id)

function ctx(overrides = {}) {
  const level = overrides.level ?? 20
  return {
    level,
    phase: overrides.phase || (level <= 6 ? 'academy' : level <= 18 ? 'adventure' : level <= 40 ? 'master' : 'god'),
    ringCount: overrides.ringCount ?? 0,
    spirit: overrides.spirit,
    doneEvents: overrides.doneEvents || [],
    recentEvents: [],
    locationMatches: true,
    isMainStory: false,
    isRingHunt: false,
    ascended: false,
    ...overrides
  }
}

describe('事件中央触发规则', () => {
  it('扩展后的静态事件 ID 唯一，并包含地点专属事件', () => {
    // 基线 350 = 348 + P0-B 新增 ml_bibi_omen / ml_bibi_hunt（比比东主线铺垫）；
    // 儿童版 +10 段主线（ms_*，已退役但保留数据）+ 后期地点事件（LATE_GAME_EVENTS）
    // + 名场面主线 14 段（MAIN_STORY_EVENTS）。
    expect(EVENTS).toHaveLength(360 + LOCATION_EVENTS.length + LATE_GAME_EVENTS.length + MAIN_STORY_EVENTS.length)
    expect(MAIN_STORY_EVENTS).toHaveLength(14)
    expect(new Set(EVENTS.map(event => event.id)).size).toBe(EVENTS.length)
    expect(EVENTS.filter(event => event.locationActionType === 'local_exploration')).toHaveLength(6)
    expect(EVENTS.filter(event => event.locationActionType === 'local_commission')).toHaveLength(6)
    expect(EVENTS.filter(event => event.locationActionType === 'local_contact')).toHaveLength(4)
  })

  it('主线事件不能从普通随机池进入，但可按主线入口触发并遵守前置', () => {
    const nuoding = adaptEvent(byId('p02_nuoding'))
    expect(nuoding.mainStoryOnly).toBe(true)
    expect(isEventEligible(nuoding, ctx({ level: 2, phase: 'academy' }))).toBe(false)
    expect(isEventEligible(nuoding, ctx({ level: 2, phase: 'academy', isMainStory: true }))).toBe(true)

    const master = adaptEvent(byId('p03_master'))
    expect(isEventEligible(master, ctx({ level: 5, phase: 'academy', isMainStory: true }))).toBe(false)
    expect(isEventEligible(master, ctx({ level: 5, phase: 'academy', isMainStory: true, doneEvents: ['p02_nuoding'] }))).toBe(true)

    // 旧主线节点退役：主线入口也不会再触发
    expect(isEventEligible(adaptEvent(byId('first_hunt')), ctx({ level: 5, phase: 'academy', isMainStory: true }))).toBe(false)
  })

  it('高危魂兽和身份事件同时受等级、魂环数与章节控制', () => {
    for (const id of ['shapeshift_beast', 'titan_encounter', 'adv_more_03_bear', 'adv_more_04_scorpion', 'ma_big_13']) {
      expect(isEventEligible(adaptEvent(byId(id)), ctx({ level: 20, phase: 'master', ringCount: 2 }))).toBe(false)
    }

    const martialBody = adaptEvent(byId('ma_more_04'))
    // 2026-08-15 T6：ma_more_04 归历练期（master），Lv.70 新语义 phase=master
    expect(isEventEligible(martialBody, ctx({ level: 70, phase: 'master', ringCount: 6 }))).toBe(false)
    expect(isEventEligible(martialBody, ctx({ level: 70, phase: 'master', ringCount: 7 }))).toBe(true)

    const titleChallenge = adaptEvent(byId('ma_extra_01'))
    expect(isEventEligible(titleChallenge, ctx({ level: 89, phase: 'god', ringCount: 8 }))).toBe(false)
    expect(isEventEligible(titleChallenge, ctx({ level: 90, phase: 'god', ringCount: 8 }))).toBe(true)

    const tribulation = adaptEvent(byId('ma_daily_08'))
    expect(tribulation.maxLevel).toBe(99)
    expect(isEventEligible(tribulation, ctx({ level: 98, phase: 'god', ringCount: 8 }))).toBe(false)
    // 儿童版名场面主线：神位属于唐三，"百级成神"事件已封存，任何等级都不出现
    expect(isEventEligible(tribulation, ctx({ level: 99, phase: 'god', ringCount: 8 }))).toBe(false)
  })

  it('普通遭遇不会直接授予正式魂环', () => {
    for (const id of ['ac_forest_01', 'sp_bs_02', 'adv_more_01_beast']) {
      const event = byId(id)
      const text = JSON.stringify(event)
      expect(text).not.toMatch(/获得了魂环|获取魂环|猎杀它，获取魂环/)
      expect(event.choices.every(choice => !choice.result?.ring)).toBe(true)
    }
  })

  it('武魂类型、子类和品阶限制不能被错误武魂绕过', () => {
    const weapon = byId('sp_wp_01')
    expect(isEventEligible(adaptEvent(weapon), ctx({ level: 3, phase: 'academy', spirit: { type: '器武魂', subtype: '武器' } }))).toBe(true)
    expect(isEventEligible(adaptEvent(weapon), ctx({ level: 3, phase: 'academy', spirit: { type: '兽武魂', subtype: '强攻系' } }))).toBe(false)

    const beast = adaptEvent(byId('sp_bs_04'))
    expect(isEventEligible(beast, ctx({ level: 30, phase: 'master', spirit: { type: '器武魂', subtype: '武器' } }))).toBe(false)
    expect(isEventEligible(beast, ctx({ level: 30, phase: 'master', spirit: { type: '兽武魂', subtype: '强攻系' } }))).toBe(true)

    for (const [id, subtype, level, phase] of [
      ['sp_df_02', '防御系', 15, 'adventure'],
      ['sp_sp_02', '敏攻系', 15, 'adventure'],
      ['sp_ct_02', '控制系', 18, 'adventure'],
      ['sp_aux_02', '辅助系', 15, 'adventure'],
      ['sp_pl_03', '植物系', 18, 'adventure'],
      ['sp_tl_01', '生活器物', 3, 'academy']
    ]) {
      const event = byId(id)
      if (!event) continue
      expect(isEventEligible(adaptEvent(event), ctx({ level, phase, spirit: { subtype } }))).toBe(true)
      expect(isEventEligible(adaptEvent(event), ctx({ level, phase, spirit: { subtype: '武器' } }))).toBe(false)
    }

    const divine = adaptEvent({
      id: 'spirit_legacy_test', name: '神级传承', phase: 'god', minLevel: 20,
      spiritId: '神级武魂', spiritSubtype: '神器', spiritTier: 'god', choices: [{ text: '接受', result: {} }]
    }, { spiritMeta: { id: '神级武魂', type: '器武魂', subtype: '神器', tier: 'god' } })
    expect(divine.minLevel).toBe(20)
    const legacy = adaptEvent({ ...divine, id: '神级武魂_legacy', minLevel: 20 })
    expect(legacy.minLevel).toBe(100)
    expect(isEventEligible(legacy, ctx({ level: 99, phase: 'god', ringCount: 8, spirit: { id: '神级武魂', type: '器武魂', subtype: '神器', tier: 'god' } }))).toBe(false)
  })

  it('JSON 武魂共鸣事件最低等级为 10，动态事件收到 ctx', () => {
    const resonance = adaptEvent({
      id: '水壶_resonance', name: '武魂共鸣', phase: 'academy', minLevel: 5,
      spiritId: '水壶', spiritSubtype: '武器', choices: [{ text: '倾听', result: {} }]
    }, { spiritMeta: { id: '水壶', type: '器武魂', subtype: '武器', tier: 'low' } })
    expect(resonance.minLevel).toBe(10)
    expect(isEventEligible(resonance, ctx({ level: 5, phase: 'academy', spirit: { id: '水壶', type: '器武魂', subtype: '武器', tier: 'low' } }))).toBe(false)
    // 2026-08-15 T6 阶段表重划：Lv.10 归属初级学院（academy），共鸣事件 phase 随之
    expect(isEventEligible(resonance, ctx({ level: 10, phase: 'academy', spirit: { id: '水壶', type: '器武魂', subtype: '武器', tier: 'low' } }))).toBe(true)

    const combo = DYNAMIC_EVENTS.find(event => event.id === 'dyn_combo_master')
    const night = DYNAMIC_EVENTS.find(event => event.id === 'dyn_night')
    expect(combo.condition({}, { combo: 4 })).toBe(false)
    expect(combo.condition({}, { combo: 5 })).toBe(true)
    expect(night.condition({}, { timeOfDay: 'night' })).toBe(true)
  })

  it('连锁 mentor_2 与 Lv.8 冒险篇一致，选择项门槛可审计', () => {
    const mentor = adaptEvent(CHAINED_EVENTS.mentor_2)
    expect(mentor.phase).toBe('adventure')
    expect(mentor.minLevel).toBe(8)
    expect(choiceHasLevelRequirement(adaptEvent(byId('adv_more_06_titan')).choices[1], 84)).toBe(false)
    expect(choiceHasLevelRequirement(adaptEvent(byId('adv_more_06_titan')).choices[1], 85)).toBe(true)
    expect(eventRuleSummary(CHAINED_EVENTS.mentor_2).phase).toBe('adventure')
  })

  it('等级称谓按魂环阶段而不是粗粒度篇章显示', () => {
    expect(rankTitleForLevel(6)).toBe('魂士')
    expect(rankTitleForLevel(10)).toBe('魂师')
    expect(rankTitleForLevel(20)).toBe('大魂师')
    expect(rankTitleForLevel(70)).toBe('魂圣')
    expect(rankTitleForLevel(80)).toBe('魂斗罗')
    expect(rankTitleForLevel(90)).toBe('封号斗罗')
    expect(rankTitleForLevel(100)).toBe('神级魂师')
  })
})
