import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ORIGINS } from '@/data/game-data'
import { usePlayerStore } from '@/stores/player'
import { initNewCharacter, loadFromLocal, saveToCloud, LOCAL_SAVE_KEY } from '@/stores/serializer'
import { useApi } from '@/composables/useApi'
import {
  clearCloudConflict,
  createCloudConflictState,
  getCloudConflictVersion,
  keepCloudConflictLocal,
  recordCloudConflict,
  refreshCloudConflict,
  reopenCloudConflict
} from '@/utils/cloud-conflict'

class MemoryStorage {
  constructor() { this.values = new Map() }
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body }
}

function loginResponse(username = '云档账号') {
  return jsonResponse(200, { success: true, username, token: 'tok_login', expiresIn: 2592000000 })
}

const spirit = {
  id: 'cloud_spirit', eventKey: 'cloud', name: '云存档武魂', tier: 'mid',
  type: '器武魂', subtype: '武器', attack: 12, defense: 8, hp: 30, speed: 9,
  image: '', desc: '云存档测试', icon: '⚔'
}

beforeEach(() => {
  setActivePinia(createPinia())
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
  initNewCharacter({ name: '云档测试', origin: ORIGINS[0], spirit, innatePower: 50 })
  useApi().logout()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete globalThis.fetch
})

describe('后台云存档（账号登录模式）', () => {
  it('未登录时 saveToCloud 返回 needLogin，进度已保存本地且不请求云端', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(404, { error: 'not found' }))
    globalThis.fetch = fetchMock

    const api = useApi()
    const result = await saveToCloud(api)

    expect(result.success).toBe(false)
    expect(result.needLogin).toBe(true)
    // 本地副本必须已写入，玩家进度不丢
    expect(loadFromLocal()).not.toBeNull()
    expect(globalThis.localStorage.getItem(LOCAL_SAVE_KEY)).not.toBeNull()
    // 未登录绝不触碰云端
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('登录过期（401）时 saveToCloud 返回 needLogin 且不静默重试', async () => {
    let saveCalls = 0
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/api/auth/login') return loginResponse()
      if (url === '/api/player/save') {
        saveCalls++
        return jsonResponse(401, { error: '未登录或登录已过期，请重新登录' })
      }
      return jsonResponse(404, { error: 'not found' })
    })

    const api = useApi()
    await api.login('云档账号', 'pass1234')
    const result = await saveToCloud(api)

    expect(result.success).toBe(false)
    expect(result.needLogin).toBe(true)
    // 401 后 api 自动登出，需要账号密码重新登录，不再自动重试
    expect(api.isAuthenticated()).toBe(false)
    expect(saveCalls).toBe(1)
    expect(loadFromLocal()).not.toBeNull()
  })

  it('两个客户端制造版本冲突：本地进度保留、云端不被静默覆盖，conflict 结果透传', async () => {
    let step = 0
    globalThis.fetch = vi.fn(async (url) => {
      if (url === '/api/auth/login') return loginResponse()
      if (url === '/api/player/save') {
        step++
        if (step === 1) return jsonResponse(200, { success: true, version: 1 }) // 客户端A首次保存
        if (step === 2) return jsonResponse(200, { success: true, version: 2 }) // 另一客户端推进云端
        return jsonResponse(409, { error: '存档版本冲突，请刷新后重试', currentVersion: 2, conflict: true })
      }
      return jsonResponse(404, { error: 'not found' })
    })

    const api = useApi()
    await api.login('云档账号', 'pass1234')

    const first = await saveToCloud(api)
    expect(first.success).toBe(true)

    // 模拟另一客户端把云端推进到 v2
    const other = await api.saveData({ playerId: usePlayerStore().playerId, name: '云档测试' }, 1)
    expect(other.success).toBe(true)
    expect(other.version).toBe(2)

    // 第二次后台保存：期望版本仍为 1，云端已是 2 → 409
    const second = await saveToCloud(api)
    expect(second.success).toBe(false)
    expect(second.conflict).toBe(true)
    expect(second.currentVersion).toBe(2)

    // 本地进度必须保留（saveToCloud 开头已成功写入本地）
    const local = loadFromLocal()
    expect(local).not.toBeNull()
    expect(local.name).toBe('云档测试')
    expect(globalThis.localStorage.getItem(LOCAL_SAVE_KEY)).not.toBeNull()
  })

  it('乐观锁保证：expectVersion 不匹配时云端版本不被覆盖', async () => {
    let cloudVersion = 5
    globalThis.fetch = vi.fn(async (url, options) => {
      if (url === '/api/auth/login') return loginResponse()
      if (url === '/api/player/save') {
        const body = JSON.parse(options.body)
        if (body.expectVersion !== cloudVersion) {
          return jsonResponse(409, { error: '存档版本冲突', currentVersion: cloudVersion, conflict: true })
        }
        cloudVersion++
        return jsonResponse(200, { success: true, version: cloudVersion })
      }
      return jsonResponse(404, { error: 'not found' })
    })

    const api = useApi()
    await api.login('云档账号', 'pass1234')
    const res = await api.saveData({ playerId: 'p_cloud', name: '云档测试' }, 3) // 期望 v3，云端已是 v5

    expect(res.conflict).toBe(true)
    expect(res.currentVersion).toBe(5)
    expect(cloudVersion).toBe(5) // 云端未被静默覆盖
  })

  it('未登录直接调 saveData 抛错，不产生网络请求', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(404, { error: 'not found' }))
    globalThis.fetch = fetchMock

    const api = useApi()
    await expect(api.saveData({ playerId: 'p_cloud', name: '云档测试' })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('暂时只保留本地后，自动保存仍可只写本地，手动保存会用原 currentVersion 重开冲突', () => {
    const state = createCloudConflictState()

    expect(recordCloudConflict(state, { conflict: true, currentVersion: 12 })).toBe(true)
    expect(keepCloudConflictLocal(state)).toBe(true)
    expect(state.pending.value).toEqual({ currentVersion: 12 })
    expect(state.showDialog.value).toBe(false)

    // 模拟下一次手动保存完成本地写入后的重开动作。
    expect(reopenCloudConflict(state)).toBe(true)
    expect(state.showDialog.value).toBe(true)
    expect(getCloudConflictVersion(state)).toBe(12)

    // 自动保存/重复冲突不得静默替换已保存的待处理版本。
    expect(recordCloudConflict(state, { conflict: true, currentVersion: 99 })).toBe(false)
    expect(getCloudConflictVersion(state)).toBe(12)
  })

  it('云端版本更新导致覆盖失败时保留冲突并刷新 currentVersion；成功解决才清除', () => {
    const state = createCloudConflictState()
    recordCloudConflict(state, { conflict: true, currentVersion: 2 })
    keepCloudConflictLocal(state)

    expect(refreshCloudConflict(state, { conflict: true, currentVersion: 3 })).toBe(true)
    expect(state.pending.value).toEqual({ currentVersion: 3 })
    expect(state.showDialog.value).toBe(true)
    expect(getCloudConflictVersion(state)).toBe(3)

    // 非冲突失败也不能清除 pending；重开仍使用最新保存的版本。
    state.showDialog.value = false
    expect(reopenCloudConflict(state)).toBe(true)
    expect(getCloudConflictVersion(state)).toBe(3)

    // “使用云端版本”和“覆盖云端”的成功分支都调用同一个清理动作。
    clearCloudConflict(state)
    expect(state.pending.value).toBeNull()
    expect(state.showDialog.value).toBe(false)
    expect(getCloudConflictVersion(state)).toBeNull()
  })
})
