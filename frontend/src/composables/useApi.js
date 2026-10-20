/**
 * 后端 API 通信 composable
 * 账号体系（注册 / 登录）+ 无状态 Token 鉴权 + 乐观锁 + 历史版本
 */
import { ref, computed } from 'vue'

// Token 存储到 sessionStorage（关闭标签页后失效，比 localStorage 更安全）
const TOKEN_KEY = 'dldl_auth_token'
const USERNAME_KEY = 'dldl_auth_user'
const PLAYER_ID_KEY = 'dldl_player_id'
const SERVER_VERSION_KEY = 'dldl_server_version'

const authToken = ref(null)
const authUsername = ref(null)
const playerId = ref(null)
const serverVersion = ref(0)

// 从 sessionStorage 恢复
try {
  authToken.value = sessionStorage.getItem(TOKEN_KEY)
  authUsername.value = sessionStorage.getItem(USERNAME_KEY)
  playerId.value = sessionStorage.getItem(PLAYER_ID_KEY)
  const v = sessionStorage.getItem(SERVER_VERSION_KEY)
  serverVersion.value = v ? parseInt(v, 10) : 0
} catch { /* ignore */ }

const isLoggedIn = computed(() => !!authToken.value && !!authUsername.value)

function persistSession(token, username) {
  authToken.value = token
  authUsername.value = username
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(USERNAME_KEY, username)
  } catch { /* ignore */ }
}

function authHeaders() {
  return authToken.value ? { 'x-auth-token': authToken.value } : {}
}

/**
 * 注册 / 登录（成功后自动保存会话）
 */
async function postAuth(endpoint, username, password) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || '请求失败')
  if (!body.success) throw new Error('请求失败')
  persistSession(body.token, body.username)
  return body
}

function register(username, password) {
  return postAuth('/api/auth/register', username, password)
}

function login(username, password) {
  return postAuth('/api/auth/login', username, password)
}

/**
 * 修改密码（需登录，验证原密码）
 */
async function changePassword(oldPassword, newPassword) {
  if (!isLoggedIn.value) throw new Error('未登录')
  const res = await fetch('/api/auth/password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken.value
    },
    body: JSON.stringify({ oldPassword, newPassword })
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    logout()
    throw new Error(body.error || '登录已过期，请重新登录')
  }
  if (!res.ok) throw new Error(body.error || '修改密码失败')
  // 改密后服务端作废全部旧 Token，并为当前设备换发新 Token
  if (body.token) persistSession(body.token, authUsername.value)
  return body
}

/**
 * 保存存档（带乐观锁）
 * @param {object} data - 存档数据（必须包含 playerId）
 * @param {number|null} expectVersion - 期望的版本号（乐观锁）
 * @returns {Promise<{success: boolean, version: number, conflict?: boolean}>}
 */
async function saveData(data, expectVersion = null) {
  if (!isLoggedIn.value) {
    throw new Error('未登录，请先登录账号')
  }

  const pid = (data && typeof data === 'object' && data.playerId) ? data.playerId : playerId.value
  if (!pid) throw new Error('存档缺少玩家 ID')

  const body = {
    playerId: pid,
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
    logout()
    throw new Error('登录已过期，请重新登录')
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
    try {
      sessionStorage.setItem(SERVER_VERSION_KEY, String(result.version))
      sessionStorage.setItem(PLAYER_ID_KEY, pid)
    } catch { /* ignore */ }
    playerId.value = pid
  }
  return result
}

/**
 * 加载存档（需登录，且只能读取本人存档）
 * @param {string} pid - 玩家 ID
 */
async function loadData(pid) {
  const res = await fetch(`/api/player/load/${pid}`, { headers: authHeaders() })
  if (res.status === 401) {
    logout()
    throw new Error('登录已过期，请重新登录')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '加载失败')
  }
  const result = await res.json()
  if (result.success && result.data) {
    serverVersion.value = result.version || 0
    playerId.value = pid
    try {
      sessionStorage.setItem(SERVER_VERSION_KEY, String(serverVersion.value))
      sessionStorage.setItem(PLAYER_ID_KEY, pid)
    } catch { /* ignore */ }
  }
  return result
}

/**
 * 获取存档列表（当前账号名下）
 */
async function listSaves() {
  const res = await fetch('/api/player/list', { headers: authHeaders() })
  if (res.status === 401) {
    logout()
    throw new Error('请先登录账号')
  }
  if (!res.ok) throw new Error('获取列表失败')
  return await res.json()
}

/**
 * 获取历史版本列表
 * @param {string} pid - 玩家 ID
 */
async function getHistory(pid) {
  const res = await fetch(`/api/player/history/${pid}`, { headers: authHeaders() })
  if (res.status === 401) {
    logout()
    throw new Error('请先登录账号')
  }
  if (!res.ok) throw new Error('获取历史版本失败')
  return await res.json()
}

/**
 * 恢复历史版本
 * @param {string} pid - 玩家 ID
 * @param {number} version - 版本号
 */
async function restoreVersion(pid, version) {
  if (!isLoggedIn.value) throw new Error('未登录')

  const res = await fetch(`/api/player/restore/${pid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken.value
    },
    body: JSON.stringify({ playerId: pid, version })
  })

  if (res.status === 401) {
    logout()
    throw new Error('登录已过期，请重新登录')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '恢复失败')
  }

  const result = await res.json()
  if (result.success) {
    serverVersion.value = result.version
    try {
      sessionStorage.setItem(SERVER_VERSION_KEY, String(result.version))
    } catch { /* ignore */ }
  }
  return result
}

/**
 * 删除存档
 * @param {string} pid - 玩家 ID
 */
async function deleteSave(pid) {
  if (!isLoggedIn.value) throw new Error('未登录')

  const res = await fetch(`/api/player/${pid}`, {
    method: 'DELETE',
    headers: { 'x-auth-token': authToken.value }
  })

  if (res.status === 401) {
    logout()
    throw new Error('登录已过期，请重新登录')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '删除失败')
  }

  // 清除当前角色的会话版本（保留账号登录状态）
  playerId.value = null
  serverVersion.value = 0
  try {
    sessionStorage.removeItem(PLAYER_ID_KEY)
    sessionStorage.removeItem(SERVER_VERSION_KEY)
  } catch { /* ignore */ }

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
 * 登出：清除账号会话与角色会话
 */
function logout() {
  authToken.value = null
  authUsername.value = null
  playerId.value = null
  serverVersion.value = 0
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USERNAME_KEY)
    sessionStorage.removeItem(PLAYER_ID_KEY)
    sessionStorage.removeItem(SERVER_VERSION_KEY)
  } catch { /* ignore */ }
}

export function useApi() {
  return {
    authToken: () => authToken.value,
    username: () => authUsername.value,
    isLoggedIn,
    playerId: () => playerId.value,
    serverVersion: () => serverVersion.value,
    isAuthenticated: () => isLoggedIn.value,
    register,
    login,
    changePassword,
    logout,
    saveData,
    loadData,
    listSaves,
    getHistory,
    restoreVersion,
    deleteSave,
    healthCheck
  }
}
