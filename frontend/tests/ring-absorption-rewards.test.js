import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { EVENTS, ORIGINS } from '@/data/game-data'
import '@/data/events-expanded'
import { initNewCharacter } from '@/stores/serializer'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useEventEngine } from '@/composables/useEventEngine'
import { useGameData } from '@/composables/useGameData'

class Storage {
  values=new Map()
  getItem(key){return this.values.get(key)??null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}
beforeEach(async()=>{
  vi.useFakeTimers()
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage',new Storage())
  vi.stubGlobal('sessionStorage',new Storage())
  vi.stubGlobal('fetch',async url=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL(`../../public/data/${String(url).split('/').at(-1)}`,import.meta.url),'utf8'))}))
  await useGameData().loadAll()
  const spirit=useGameData().data.value.spirits.find(row=>row.id==='木剑')
  initNewCharacter({name:'吸收结算边界',origin:ORIGINS[0],spirit,innatePower:50})
  const player=usePlayerStore()
  player.level=90
  player.rings=Array.from({length:8},(_,i)=>({ringId:`test_ring_${i}`,bonus:{}}))
  useEventStore().pendingRingLv=90
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllTimers();vi.useRealTimers()})
describe('非战斗猎环的奖励原子性',()=>{
  it('百万年吸收失败不奖经验、金币或永久属性，后续成功才授环并奖励一次',()=>{
    const engine=useEventEngine(),player=usePlayerStore(),event=useEventStore()
    const source=EVENTS.find(row=>row.id==='ring_hunt_90'),choice=source.choices[0]
    const rng=vi.spyOn(Math,'random').mockReturnValue(.99)
    const before={gold:player.gold,exp:player.exp,overflow:player.overflowExp,bonus:JSON.stringify(player.bonus),hp:player.hp}
    engine.applyChoice(source,choice,0)
    expect(player.rings).toHaveLength(8)
    expect(event.pendingRingLv).toBe(90)
    expect(player.hp).toBeLessThan(before.hp)
    expect(player.gold).toBe(before.gold)
    expect(player.exp).toBe(before.exp)
    expect(player.overflowExp).toBe(before.overflow)
    expect(JSON.stringify(player.bonus)).toBe(before.bonus)
    expect(engine.resultRewards.value).toEqual([])
    rng.mockReturnValue(0)
    engine.applyChoice(source,choice,0)
    expect(player.rings).toHaveLength(9)
    expect(player.bonus.attack).toBeGreaterThan(JSON.parse(before.bonus).attack||0)
    expect(event.pendingRingLv).toBeNull()
    const afterSuccess={gold:player.gold,exp:player.exp,bonus:JSON.stringify(player.bonus)}
    engine.applyChoice(source,choice,0)
    expect(player.rings).toHaveLength(9)
    expect({gold:player.gold,exp:player.exp,bonus:JSON.stringify(player.bonus)}).toEqual(afterSuccess)
  })
})
