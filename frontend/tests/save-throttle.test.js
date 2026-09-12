/**
 * 存档写入节流直测（阶段四C）
 *
 * markSaveDirty 只标脏不落盘;800ms 静默后自动落盘;flushSaveIfDirty 立即落盘。
 * 锁定"高频动作裁剪冗余写入"与"页面隐藏前强制落盘"两条契约。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { markSaveDirty, flushSaveIfDirty } from '@/stores/serializer'
import { initNewCharacter } from '@/stores/serializer'
import { ORIGINS } from '@/data/game-data'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

const spirit = {
  id: 'throttle_spirit', eventKey: 'throttle', name: '节流武魂', tier: 'mid',
  type: '强攻系', subtype: '火', attack: 20, defense: 12, hp: 80, speed: 20,
  image: '', desc: '节流测试', icon: '⚔️'
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  initNewCharacter({ name: '节流验收', origin: ORIGINS[0], spirit, innatePower: 50 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('存档写入节流', () => {
  it('标脏后不立即落盘,flush 立即写入', () => {
    flushSaveIfDirty() // 清掉 beforeEach 可能的残留
    expect(localStorage.getItem('dldl_text_rpg_save')).toBeNull()

    markSaveDirty()
    expect(localStorage.getItem('dldl_text_rpg_save')).toBeNull() // 未到空闲点

    expect(flushSaveIfDirty()).toBeTruthy()
    expect(localStorage.getItem('dldl_text_rpg_save')).toBeTruthy()
  })

  it('标脏后 800ms 静默自动落盘', async () => {
    flushSaveIfDirty()
    markSaveDirty()
    await vi.advanceTimersByTimeAsync(900)
    expect(localStorage.getItem('dldl_text_rpg_save')).toBeTruthy()
  })

  it('连续标脏只调度一次(裁剪冗余写入)', async () => {
    flushSaveIfDirty()
    markSaveDirty()
    markSaveDirty()
    markSaveDirty()
    await vi.advanceTimersByTimeAsync(900)
    // 只要最终状态落盘即可;多次标脏不应产生多次定时器
    expect(localStorage.getItem('dldl_text_rpg_save')).toBeTruthy()
  })

  it('重复 flush 不产生写入', () => {
    flushSaveIfDirty()
    expect(flushSaveIfDirty()).toBeNull()
  })

  it('写入失败经 onError 上报(配额超限场景)', async () => {
    flushSaveIfDirty()
    const quotaError = Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError })
    const onError = vi.fn()
    markSaveDirty(onError)
    await vi.advanceTimersByTimeAsync(900)
    // saveToLocal 会把底层错误包装为"本地存档失败:...",onError 收到的是包装后错误
    expect(onError).toHaveBeenCalledTimes(1)
    expect(String(onError.mock.calls[0][0].message)).toContain('本地存档失败')
    setItemSpy.mockRestore()
  })
})
