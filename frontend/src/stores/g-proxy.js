/**
 * G 代理桥（store 桥接层）
 *
 * 旧事件脚本约定的 effect/cond 签名是 (G) => string，G 是旧版全局游戏对象。
 * 这里用 Proxy 把对 G 的读写桥接到各 Pinia store，让旧脚本无需改写即可运行。
 * 从 useEventEngine.js 移出：它本质是"store 视图层"，不是事件引擎逻辑。
 */
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useCombatStore } from '@/stores/combat'
import { useGameRules } from '@/composables/useGameRules'

export function buildGProxy() {
  const player = usePlayerStore()
  const event = useEventStore()
  const game = useGameStore()
  const combat = useCombatStore()
  const { finalStats, getMaxSpiritPower } = useGameRules()

  // 合并所有 store 的 state 到一个响应式代理
  const handler = {
    get(_target, key) {
      // 先查 player store
      if (key in player.$state) return player.$state[key]
      // 再查 event store
      if (key in event.$state) return event.$state[key]
      // 再查 game store
      if (key in game.$state) return game.$state[key]
      // 战斗统计等字段属于 combat store
      if (key in combat.$state) return combat.$state[key]
      if (key in event._dynamicFlags) return event._dynamicFlags[key]
      // 特殊方法
      if (key === 'finalStats') return finalStats()
      if (key === 'maxHp') return finalStats().maxHp
      if (key === 'maxSpiritPower') return getMaxSpiritPower()
      return undefined
    },
    set(_target, key, value) {
      if (key in player.$state) { player.$state[key] = value; return true }
      if (key in event.$state) { event.$state[key] = value; return true }
      if (key in game.$state) { game.$state[key] = value; return true }
      if (key in combat.$state) { combat.$state[key] = value; return true }
      // 旧事件会动态创建 G._* 标记，集中保存以便刷新后恢复。
      event._dynamicFlags[key] = value
      return true
    }
  }

  return new Proxy({}, handler)
}
