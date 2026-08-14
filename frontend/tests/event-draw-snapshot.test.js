/**
 * M2 抽取一致性快照测试
 *
 * 用途：在固定种子（mulberry32 PRNG 替代 Math.random）下，连续调用 nextEvent()
 * 记录产出的事件 id 序列。M2 事件引擎性能重构（预构建索引/缓存 adaptEvent/共享 G
 * Proxy）必须保证该序列与重构前逐位一致——这是"纯性能重构、不改游戏规则"的硬验收。
 *
 * 若序列需要更新（经 GLM5.3 审查确认属于预期变更），用 SNAPSHOT_SEQUENCE 下方的
 * 说明操作：临时将 expect 改为输出并用新序列替换即可。
 * 若偶发失败：先单独重跑本文件（npm test --prefix frontend -- --run
 * tests/event-draw-snapshot.test.js）确认是否环境噪声（模块图缓存竞争），
 * 连续多次稳定失败才视为真实行为变更。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const battleHarness = vi.hoisted(() => ({ active: { value: false } }))

vi.mock('@/composables/useBattleSystem', () => ({
  useBattleSystem() {
    return {
      active: battleHarness.active,
      isActive: () => battleHarness.active.value,
      startEventBattle() {}
    }
  }
}))

import { ORIGINS } from '@/data/game-data'
// 副作用导入：与真实游戏（GamePage.vue）一致，将扩展/地点事件合并进 EVENTS，
// 使快照覆盖完整事件池（541 条），而非仅基础池。
import '@/data/events-expanded'
import { useEventEngine } from '@/composables/useEventEngine'
import { useGameData } from '@/composables/useGameData'
import { initNewCharacter } from '@/stores/serializer'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

// mulberry32：确定性 PRNG，替代 Math.random
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const spirit = {
  id: 'snap_spirit', eventKey: 'snap', name: '快照武魂', tier: 'mid',
  type: '器武魂', subtype: '武器', attack: 12, defense: 8, hp: 30, speed: 9,
  image: '', desc: '快照测试武魂', icon: '⚔'
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  battleHarness.active.value = false
  initNewCharacter({ name: '快照', origin: ORIGINS[0], spirit, innatePower: 50 })
})

async function loadMinimalData() {
  globalThis.fetch = vi.fn(async url => ({
    ok: true,
    async json() {
      const u = String(url)
      if (u.includes('map-data')) {
        return { locations: [
          { id: 'shrek_academy', name: '史莱克学院', x: 1, y: 1 },
          { id: 'star_duo_outer', name: '星斗大森林外围', x: 2, y: 2 }
        ] }
      }
      if (u.includes('spirit-codex')) return { spirits: [spirit] }
      if (u.includes('ring-codex')) return { rings: [{ id: 'white_ring', name: '十年魂环', tier: 'white', color: '#eee', statBonus: { attack: 1, defense: 1, hp: 5 } }] }
      if (u.includes('beast-codex')) return { beasts: [{ id: 'test_beast', name: '测试魂兽' }] }
      return {}
    }
  }))
  await useGameData().loadAll()
}

function drawSnapshot(engine, draws) {
  const player = usePlayerStore()
  const eventStore = useEventStore()
  const game = useGameStore()
  eventStore._prologueDone = true
  eventStore._earlyLifeDone = true
  eventStore._enrollmentComplete = true
  eventStore._firstClassDone = true
  // 主线里程碑全部完成，避免主线分支抢占随机池（快照聚焦动态/连锁/普通池抽取路径）
  eventStore.doneEvents = [
    'first_hunt', 'reach_lv10', 'soul_master_prelim', 'spirit_hall_exam',
    'soul_master_final', 'god_trial_sea', 'final_evil'
  ]
  eventStore._mainStoryVersion = 1
  player.level = 5
  game.setLocation('shrek_academy')
  const ids = []
  for (let i = 0; i < draws; i++) {
    engine.nextEvent()
    ids.push(engine.currentEvent.value?.id || 'none')
    eventStore._eventCount = (eventStore._eventCount || 0) + 1
  }
  return ids
}

describe('M2 抽取一致性快照', () => {
  it('固定种子下 nextEvent 抽取序列稳定（M2 重构前后必须一致）', async () => {
    await loadMinimalData()
    const engine = useEventEngine()
    const prng = mulberry32(20260814)
    const random = vi.spyOn(Math, 'random').mockImplementation(prng)
    try {
      const ids = drawSnapshot(engine, 30)
      // 基线：2026-08-14 于 M2 优化后的代码上生成（种子 20260814，Lv.5 academy 阶段，
      // 全量事件池 364 条，含 events-expanded 副作用合并），连续 13 次运行稳定。
      // 任何重构不得改变此序列——差异即行为变更。
      expect(ids).toEqual([
        'first_class', 'ac_extra_07', 'ac_daily_04', 'ac_gold_03', 'dyn_lucky',
        'ac_dorm_02', 'or_noble_01', 'ac_teacher_02', 'sp_wp_01', 'ac_extra_02',
        'ac_class_01', 'mentor_1', 'ac_food_01', 'ac_sp_02', 'sp_wp_01',
        'mentor_1', 'ac_food_01', 'ac_more_11', 'ac_season_02', 'ac_train_02',
        'cafeteria_funny', 'ac_extra_01', 'fake_master', 'ac_daily_05', 'training_hill',
        'cafeteria_funny', 'playground_spar', 'ac_gold_04', 'mentor_1', 'ac_dorm_02'
      ])
    } finally {
      random.mockRestore()
    }
  })
})
