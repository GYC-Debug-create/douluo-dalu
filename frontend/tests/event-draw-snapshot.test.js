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
  // 主线推进到"大师的考验"之后（下一段史莱克考核需 Lv.11），避免主线抢占随机池
  // （快照聚焦动态/连锁/普通池抽取路径）。世界账本里已认识诺丁篇的人物。
  eventStore.doneEvents = ['p02_nuoding', 'p03_master']
  eventStore._storyMarks = ['arrived_nuoding', 'met:唐三', 'met:小舞', 'met:王圣', 'met:玉小刚']
  eventStore._mainStoryVersion = 2
  player.level = 5
  game.setLocation('nuoding_city')
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
      // 基线：2026-08-22 于经济规格 v2 落地后重新生成（种子 20260814，Lv.5 academy 阶段，
      // 全量事件池 364 条，含 events-expanded 副作用合并）。
      // 变更记录：
      // - 2026-08-14 M2 基线：首版（重构前后一致性锁定）
      // - 2026-08-15 T4 基线：or_noble_01 等出身事件按 origin 限定被正确排除
      //   （star_forest 玩家不再触发 or_noble_01——这本身是 T4 修复生效的证据）。
      //   本序列于 --no-file-parallelism 下连续 3 次运行稳定。
      // - 2026-08-15 T6b 基线：T7 角色重构（ac_extra_04 弗兰德 minLevel 1→12、phase
      //   academy→adventure；ac_extra_06 同批调整）使 Lv.5 事件池排序变化，
      //   序列第 2 位 ac_extra_04→ac_extra_03 等 4 处偏移——修复生效的证据。
      // - 2026-08-15 T6 基线：阶段表重划（10/40/70）+ 364 事件全量重标——学院生活类
      //   事件移入进阶学院期（minLevel 10+），academy 池收窄为入门/武魂/命运内容；
      //   dy_sect_01 收徒按判例 7 提至 12 级。序列以 sp_wp_01/first_class/spirit_show/
      //   mentor_1 为主——重标生效的证据（学院日常不再出现在初级学院期）。
      // - 2026-08-22 经济规格 v2 基线：普通池抽取改为洗牌袋无放回
      //   （engine/event-rules.buildDrawQueue + 引擎 drawFromBag，队列随存档持久化），
      //   同一批候选耗尽前零重复——旧基线中 sp_wp_01 连续/高频重复的模式消失，
      //   四个池事件按周期轮转均匀分布；dyn_lucky 走动态事件路径（35% 判定），
      //   不经过洗牌袋，仅受种子影响位置。同日曲线统一为幂曲线 40*lv^1.15、
      //   事件经验按 academy1000/adventure2000/master4000/god8000 重标定
      //   （数值变更不影响抽取序列，记录备查）。
      // - 2026-10-06 名场面主线基线：玩家从诺丁学院起步（夹具在 nuoding_city、已认识诺丁篇人物），
      //   旧"第一堂课"退役（first_class 不再出现）；校园类通用事件发生在当前就读的学院。
      expect(ids).toEqual([
        'spirit_show', 'dyn_lucky', 'sp_wp_01', 'spirit_show', 'mentor_1',
        'sp_wp_01', 'sp_wp_01', 'spirit_show', 'sp_wp_01', 'mentor_1',
        'spirit_show', 'mentor_1', 'sp_wp_01', 'mentor_1', 'spirit_show',
        'spirit_show', 'sp_wp_01', 'spirit_show', 'mentor_1', 'sp_wp_01',
        'mentor_1', 'sp_wp_01', 'mentor_1', 'spirit_show', 'mentor_1',
        'sp_wp_01', 'spirit_show', 'sp_wp_01', 'mentor_1', 'spirit_show'
      ])
    } finally {
      random.mockRestore()
    }
  })
})
