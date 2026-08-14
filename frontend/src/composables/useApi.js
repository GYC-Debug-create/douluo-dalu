/**
 * 后端 API 通信 composable
 * 封装 Token 鉴权、乐观锁、历史版本等 Phase 7 后端功能
 */
import { ref } from 'vue'

// Token 存储到 sessionStorage（关闭标签页后失效，比 localStorage 更安全）
const TOKEN_KEY = 'dldl_auth_token'
const PLAYER_ID_KEY = 'dldl_player_id'
const SERVER_VERSION_KEY = 'dldl_server_version'

const authToken = ref(null)
const playerId = ref(null)
const serverVersion = ref(0)

// 从 sessionStorage 恢复
try {
  authToken.value = sessionStorage.getItem(TOKEN_KEY)
  playerId.value = sessionStorage.getItem(PLAYER_ID_KEY)
  const v = sessionStorage.getItem(SERVER_VERSION_KEY)
  serverVersion.value = v ? parseInt(v, 10) : 0
} catch { /* ignore */ }

/**
 * 认证：获取 Token
 * @param {string} pid - 玩家 ID
 * @param {string} name - 角色名（验证用）
 */
async function authenticate(pid, name) {
  const res = await fetch('/api/player/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: pid, name })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '认证失败')
  }
  const result = await res.json()
  if (!result.success) throw new Error('认证失败')

  authToken.value = result.token
  playerId.value = pid
  sessionStorage.setItem(TOKEN_KEY, result.token)
  sessionStorage.setItem(PLAYER_ID_KEY, pid)
  return result.token
}

/**
 * 保存存档（带乐观锁）
 * @param {object} data - 存档数据
 * @param {number|null} expectVersion - 期望的版本号（乐观锁）
 * @returns {Promise<{success: boolean, version: number, conflict?: boolean}>}
 */
async function saveData(data, expectVersion = null) {
  if (!authToken.value || !playerId.value) {
    throw new Error('未认证，请先调用 authenticate')
  }

  const body = {
    playerId: playerId.value,
    data,
    expectVersion: expectVersion !== null ? expectVersion : serverVersion.value
  }

  const res = await fetch('/api/player/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken.value
    },
    body: JSON.stringify(body)
  })

  // 409 冲突：版本号不匹配
  if (res.status === 409) {
    const err = await res.json()
    // 不自动采用云端版本号；否则下一次“重试”会绕过冲突检查并静默覆盖较新云档。
    // 只有用户明确选择覆盖，调用方才会把 currentVersion 作为 expectVersion 再保存。
    return { success: false, conflict: true, currentVersion: err.currentVersion }
  }

  // 401 未授权：Token 过期
  if (res.status === 401) {
    authToken.value = null
    sessionStorage.removeItem(TOKEN_KEY)
    throw new Error('Token 已过期，请重新认证')
  }

  // 429 限流
  if (res.status === 429) {
    const err = await res.json()
    throw new Error(`请求过于频繁，请 ${err.retryAfter || 60} 秒后重试`)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '保存失败')
  }

  const result = await res.json()
  if (result.success) {
    serverVersion.value = result.version
    sessionStorage.setItem(SERVER_VERSION_KEY, String(result.version))
  }
  return result
}

/**
 * 加载存档
 * @param {string} pid - 玩家 ID
 */
async function loadData(pid) {
  const res = await fetch(`/api/player/load/${pid}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '加载失败')
  }
  const result = await res.json()
  if (result.success && result.data) {
    serverVersion.value = result.version || 0
    sessionStorage.setItem(SERVER_VERSION_KEY, String(serverVersion.value))
    playerId.value = pid
    sessionStorage.setItem(PLAYER_ID_KEY, pid)
  }
  return result
}

/**
 * 获取存档列表
 */
async function listSaves() {
  const res = await fetch('/api/player/list')
  if (!res.ok) throw new Error('获取列表失败')
  return await res.json()
}

/**
 * 获取历史版本列表
 * @param {string} pid - 玩家 ID
 */
async function getHistory(pid) {
  const res = await fetch(`/api/player/history/${pid}`)
  if (!res.ok) throw new Error('获取历史版本失败')
  return await res.json()
}

/**
 * 恢复历史版本
 * @param {string} pid - 玩家 ID
 * @param {number} version - 版本号
 */
async function restoreVersion(pid, version) {
  if (!authToken.value) throw new Error('未认证')

  const res = await fetch(`/api/player/restore/${pid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken.value
    },
    body: JSON.stringify({ playerId: pid, version })
  })

  if (res.status === 401) {
    authToken.value = null
    sessionStorage.removeItem(TOKEN_KEY)
    throw new Error('Token 已过期，请重新认证')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '恢复失败')
  }

  const result = await res.json()
  if (result.success) {
    serverVersion.value = result.version
    sessionStorage.setItem(SERVER_VERSION_KEY, String(result.version))
  }
  return result
}

/**
 * 删除存档
 * @param {string} pid - 玩家 ID
 */
async function deleteSave(pid) {
  if (!authToken.value) throw new Error('未认证')

  const res = await fetch(`/api/player/${pid}`, {
    method: 'DELETE',
    headers: { 'x-auth-token': authToken.value }
  })

  if (res.status === 401) {
    authToken.value = null
    sessionStorage.removeItem(TOKEN_KEY)
    throw new Error('Token 已过期，请重新认证')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '删除失败')
  }

  // 清除本地 Token
  authToken.value = null
  playerId.value = null
  serverVersion.value = 0
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PLAYER_ID_KEY)
  sessionStorage.removeItem(SERVER_VERSION_KEY)

  return await res.json()
}

/**
 * 健康检查
 */
async function healthCheck() {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('健康检查失败')
  return await res.json()
}

/**
 * 登出：清除 Token
 */
function logout() {
  authToken.value = null
  playerId.value = null
  serverVersion.value = 0
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PLAYER_ID_KEY)
  sessionStorage.removeItem(SERVER_VERSION_KEY)
}

export function useApi() {
  return {
    authToken: () => authToken.value,
    playerId: () => playerId.value,
    serverVersion: () => serverVersion.value,
    isAuthenticated: () => !!authToken.value,
    authenticate,
    saveData,
    loadData,
    listSaves,
    getHistory,
    restoreVersion,
    deleteSave,
    healthCheck,
    logout
  }
}
