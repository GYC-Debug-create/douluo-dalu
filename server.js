// 斗罗大陆小游戏后端：静态资源与文字 RPG 存档 API
// Phase 7 增量改善：Token 鉴权 / 乐观锁 / 历史版本 / 限流 / 缓存头 / 健康检查
'use strict';

const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIST_DIR = path.resolve(__dirname, 'frontend', 'dist');
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const DATA_DIR = path.resolve(__dirname, 'data');
const ARCHIVE_DIR = path.resolve(DATA_DIR, 'archive');

// ============ 配置常量 ============
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL = 24 * 60 * 60 * 1000;       // Token 有效期 24 小时
const RATE_LIMIT_WINDOW = 60 * 1000;          // 限流窗口 1 分钟
const RATE_LIMIT_GENERAL = 60;                // 通用 API 每分钟上限
const RATE_LIMIT_SAVE = 10;                   // 存档接口每分钟上限
const MAX_HISTORY = 5;                        // 最多保留 5 个历史版本
const MAX_BODY_SIZE = '2mb';

// ============ 安全头中间件 ============
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

// ============ 限流中间件 ============
const rateBuckets = new Map();

function rateLimit(maxRequests, label) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${label}:${ip}`;
    const now = Date.now();
    let bucket = rateBuckets.get(key);

    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
      rateBuckets.set(key, bucket);
    }

    bucket.count++;

    const remaining = Math.max(0, maxRequests - bucket.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetTime / 1000));

    if (bucket.count > maxRequests) {
      const retryAfter = Math.ceil((bucket.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: '请求过于频繁，请稍后再试', retryAfter });
    }

    next();
  };
}

// 定期清理过期的限流桶（每 5 分钟）
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetTime + RATE_LIMIT_WINDOW) rateBuckets.delete(key);
  }
}, 5 * 60 * 1000);
rateLimitCleanupTimer.unref();

// ============ JSON 解析 + 缓存头 ============
app.use(express.json({ limit: MAX_BODY_SIZE }));

// 静态资源缓存：带内容 hash 的 JS/CSS 可长期缓存，HTML 始终重新校验。
// Vite 的文件名格式为 name-<hash>.js/css；兼容 public 下无 hash 的旧资源。
const HASHED_ASSET_RE = /[-_][A-Za-z0-9]{8,}\.(?:js|css)$/i;
const staticOptions = {
  index: false,
  fallthrough: true,
  setHeaders: (res, filePath) => {
    const basename = path.basename(filePath);
    if (HASHED_ASSET_RE.test(basename)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|json)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (/\.html$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
};

// API 响应统一不缓存
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Vue 生产构建优先；旧 public 目录继续提供地图、图鉴、数据等兼容资源。
app.use(express.static(FRONTEND_DIST_DIR, staticOptions));

function sendVueIndex(req, res, next) {
  const indexFile = path.join(FRONTEND_DIST_DIR, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res.status(503).type('text').send('Vue 前端尚未构建，请先运行 npm run build。');
  }
  res.setHeader('Cache-Control', 'no-cache');
  return res.sendFile(indexFile, error => {
    if (error) next(error);
  });
}

app.get(['/', '/index.html'], sendVueIndex);
app.use(express.static(PUBLIC_DIR, staticOptions));

// ============ 数据目录初始化 ============
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

// ============ 工具函数 ============
const isValidPlayerId = playerId => typeof playerId === 'string' && /^[A-Za-z0-9_-]{3,80}$/.test(playerId);

function getPlayerFile(playerId) {
  if (!isValidPlayerId(playerId)) return null;
  const candidate = path.resolve(DATA_DIR, `player_${playerId}.json`);
  const prefix = DATA_DIR.endsWith(path.sep) ? DATA_DIR : DATA_DIR + path.sep;
  return candidate.startsWith(prefix) ? candidate : null;
}

function getArchiveDir(playerId) {
  if (!isValidPlayerId(playerId)) return null;
  const dir = path.resolve(ARCHIVE_DIR, playerId);
  return dir.startsWith(ARCHIVE_DIR) ? dir : null;
}

// ============ Token 鉴权 ============
const tokenStore = new Map(); // key: token, value: { playerId, expires }

function generateToken(playerId) {
  const timestamp = Date.now();
  const payload = `${playerId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  const token = `${playerId}.${timestamp}.${hmac}`;
  tokenStore.set(token, { playerId, expires: timestamp + TOKEN_TTL });
  return token;
}

function validateToken(token) {
  if (!token || typeof token !== 'string') return null;
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    tokenStore.delete(token);
    return null;
  }
  return entry.playerId;
}

// Token 验证中间件（写操作必须携带有效 Token）
function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  const playerId = validateToken(token);
  if (!playerId) {
    return res.status(401).json({ error: '未授权或 Token 已过期，请重新认证' });
  }
  req.authPlayerId = playerId;
  next();
}

// 定期清理过期 Token（每 10 分钟）
const tokenCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokenStore) {
    if (now > entry.expires) tokenStore.delete(token);
  }
}, 10 * 60 * 1000);
tokenCleanupTimer.unref();

// ============ 存档历史版本管理 ============
function archiveCurrentSave(playerId) {
  const file = getPlayerFile(playerId);
  if (!file || !fs.existsSync(file)) return null;

  const archiveDir = getArchiveDir(playerId);
  if (!archiveDir) return null;
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  try {
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    const version = current._serverVersion || 0;
    const archiveFile = path.resolve(archiveDir, `v${version}.json`);
    fs.writeFileSync(archiveFile, JSON.stringify(current, null, 2), 'utf8');

    // 清理超出上限的旧版本
    const archives = fs.readdirSync(archiveDir)
      .filter(f => /^v\d+\.json$/.test(f))
      .map(f => ({ name: f, version: parseInt(f.match(/\d+/)[0], 10) }))
      .sort((a, b) => b.version - a.version);

    for (let i = MAX_HISTORY; i < archives.length; i++) {
      fs.unlinkSync(path.resolve(archiveDir, archives[i].name));
    }

    return version;
  } catch {
    return null;
  }
}

// ============ 健康检查 ============
app.get('/api/health', rateLimit(RATE_LIMIT_GENERAL, 'health'), async (req, res) => {
  const memUsage = process.memoryUsage();
  let saveCount = 0;
  try {
    saveCount = (await fsp.readdir(DATA_DIR)).filter(f => /^player_.*\.json$/.test(f)).length;
  } catch (error) {
    console.warn('健康检查读取存档目录失败:', error.message);
  }
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    },
    saves: saveCount,
    timestamp: new Date().toISOString()
  });
});

// ============ Token 认证接口 ============
app.post('/api/player/auth', rateLimit(RATE_LIMIT_GENERAL, 'auth'), (req, res) => {
  try {
    const { playerId, name } = req.body || {};
    const file = getPlayerFile(playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });

    // 如果存档已存在，验证名字匹配
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.name && name && data.name !== name) {
        return res.status(403).json({ error: '名字与存档记录不匹配' });
      }
    }

    const token = generateToken(playerId);
    return res.json({ success: true, token, expiresIn: TOKEN_TTL });
  } catch (error) {
    console.error('认证失败:', error);
    return res.status(500).json({ error: '服务器暂时无法完成认证' });
  }
});

// ============ 存档 API（带乐观锁 + 历史版本） ============
app.post('/api/player/save', rateLimit(RATE_LIMIT_SAVE, 'save'), requireAuth, (req, res) => {
  try {
    const { playerId, data, expectVersion } = req.body || {};

    // 验证 Token 中的 playerId 与请求体一致
    if (playerId !== req.authPlayerId) {
      return res.status(403).json({ error: 'Token 与存档 ID 不匹配' });
    }

    const file = getPlayerFile(playerId);
    if (!file || !data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: '存档 ID 或数据无效' });
    }

    // 乐观锁：检查版本号
    let currentVersion = 0;
    if (fs.existsSync(file)) {
      const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
      currentVersion = existing._serverVersion || 0;

      if (expectVersion !== undefined && expectVersion !== currentVersion) {
        return res.status(409).json({
          error: '存档版本冲突，请刷新后重试',
          currentVersion,
          conflict: true
        });
      }

      // 归档当前版本
      archiveCurrentSave(playerId);
    }

    const newVersion = currentVersion + 1;
    const saveData = {
      ...data,
      playerId,
      _serverVersion: newVersion,
      lastSave: new Date().toISOString()
    };

    fs.writeFileSync(file, JSON.stringify(saveData, null, 2), 'utf8');
    invalidatePlayerListCache();
    return res.json({
      success: true,
      message: '存档成功',
      lastSave: saveData.lastSave,
      version: newVersion
    });
  } catch (error) {
    console.error('保存失败:', error);
    return res.status(500).json({ error: '服务器暂时无法保存存档' });
  }
});

app.get('/api/player/load/:playerId', rateLimit(RATE_LIMIT_GENERAL, 'load'), (req, res) => {
  try {
    const file = getPlayerFile(req.params.playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });
    if (!fs.existsSync(file)) return res.json({ success: false, message: '无存档', data: null });
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return res.json({
      success: true,
      data,
      version: data._serverVersion || 0
    });
  } catch (error) {
    console.error('加载失败:', error);
    return res.status(500).json({ error: '服务器暂时无法读取存档' });
  }
});

// ============ 存档历史版本接口 ============
app.get('/api/player/history/:playerId', rateLimit(RATE_LIMIT_GENERAL, 'history'), async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const archiveDir = getArchiveDir(playerId);
    if (!archiveDir || !fs.existsSync(archiveDir)) {
      return res.json({ success: true, versions: [] });
    }

    const entries = (await fsp.readdir(archiveDir)).filter(f => /^v\d+\.json$/.test(f));
    const files = [];
    for (const f of entries) {
      const version = parseInt(f.match(/\d+/)[0], 10);
      const filePath = path.resolve(archiveDir, f);
      const stat = await fsp.stat(filePath);
      let name = '未知', level = 1;
      try {
        const data = JSON.parse(await fsp.readFile(filePath, 'utf8'));
        name = data.name || name;
        level = Number(data.level) || level;
      } catch { /* ignore */ }
      files.push({ version, name, level, savedAt: stat.mtime.toISOString() });
    }
    files.sort((a, b) => b.version - a.version);

    return res.json({ success: true, versions: files });
  } catch (error) {
    console.error('获取历史版本失败:', error);
    return res.status(500).json({ error: '服务器暂时无法读取历史版本' });
  }
});

app.post('/api/player/restore/:playerId', rateLimit(RATE_LIMIT_SAVE, 'restore'), requireAuth, (req, res) => {
  try {
    const { playerId } = req.body || {};
    if (playerId !== req.authPlayerId) {
      return res.status(403).json({ error: 'Token 与存档 ID 不匹配' });
    }

    const { version } = req.body || {};
    if (typeof version !== 'number' || version < 0) {
      return res.status(400).json({ error: '版本号无效' });
    }

    const file = getPlayerFile(playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });

    const archiveDir = getArchiveDir(playerId);
    const archiveFile = path.resolve(archiveDir, `v${version}.json`);
    const prefix = archiveDir.endsWith(path.sep) ? archiveDir : archiveDir + path.sep;
    if (!archiveFile.startsWith(prefix) || !fs.existsSync(archiveFile)) {
      return res.status(404).json({ error: '历史版本不存在' });
    }

    // 归档当前版本（如果存在）
    archiveCurrentSave(playerId);

    // 恢复指定版本
    const data = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
    const currentVersion = data._serverVersion || 0;
    data._serverVersion = currentVersion + 1;
    data.lastSave = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

    invalidatePlayerListCache();
    return res.json({
      success: true,
      message: '版本恢复成功',
      version: data._serverVersion
    });
  } catch (error) {
    console.error('恢复版本失败:', error);
    return res.status(500).json({ error: '服务器暂时无法恢复版本' });
  }
});

// ============ 存档列表缓存（TTL 45s，写操作主动失效） ============
const PLAYER_LIST_TTL = 45 * 1000;
let playerListCache = null;
let playerListCacheAt = 0;
let playerListInflight = null;

function invalidatePlayerListCache() {
  playerListCache = null;
  playerListCacheAt = 0;
}

async function loadPlayerList() {
  if (playerListCache && Date.now() - playerListCacheAt < PLAYER_LIST_TTL) {
    return { list: playerListCache, cached: true };
  }
  if (playerListInflight) {
    return { list: await playerListInflight, cached: false };
  }
  playerListInflight = (async () => {
    const files = (await fsp.readdir(DATA_DIR)).filter(file => /^player_[A-Za-z0-9_-]{3,80}\.json$/.test(file));
    const list = [];
    for (const fileName of files) {
      try {
        const playerId = fileName.slice(7, -5);
        const file = getPlayerFile(playerId);
        if (!file) continue;
        const data = JSON.parse(await fsp.readFile(file, 'utf8'));
        if (data.gameMode !== 'text-rpg' && !(data.spirit && typeof data.spirit === 'object')) continue;
        list.push({
          playerId, name: data.name || '未知', level: Number(data.level) || 1,
          spirit: data.spirit || '未知', gameMode: data.gameMode, lastSave: data.lastSave,
          version: data._serverVersion || 0
        });
      } catch (error) {
        console.warn(`跳过损坏存档 ${fileName}:`, error.message);
      }
    }
    playerListCache = list;
    playerListCacheAt = Date.now();
    return list;
  })().finally(() => { playerListInflight = null; });
  return { list: await playerListInflight, cached: false };
}

// ============ 存档列表 ============
app.get('/api/player/list', rateLimit(RATE_LIMIT_GENERAL, 'list'), async (req, res) => {
  try {
    const { list, cached } = await loadPlayerList();
    return res.json({ success: true, list, cached });
  } catch (error) {
    console.error('获取列表失败:', error);
    return res.status(500).json({ error: '服务器暂时无法读取存档列表' });
  }
});

// ============ 删除存档 ============
app.delete('/api/player/:playerId', rateLimit(RATE_LIMIT_SAVE, 'delete'), requireAuth, (req, res) => {
  try {
    const { playerId } = req.params;
    if (playerId !== req.authPlayerId) {
      return res.status(403).json({ error: 'Token 与存档 ID 不匹配' });
    }
    const file = getPlayerFile(playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });
    if (fs.existsSync(file)) fs.unlinkSync(file);

    // 同时清理历史版本
    const archiveDir = getArchiveDir(playerId);
    if (archiveDir && fs.existsSync(archiveDir)) {
      fs.rmSync(archiveDir, { recursive: true, force: true });
    }

    // 吊销 Token
    for (const [token, entry] of tokenStore) {
      if (entry.playerId === playerId) tokenStore.delete(token);
    }

    invalidatePlayerListCache();
    return res.json({ success: true });
  } catch (error) {
    console.error('删除失败:', error);
    return res.status(500).json({ error: '服务器暂时无法删除存档' });
  }
});

// ============ 游戏数据接口 ============
app.get('/api/spirits', (req, res) => res.json({ success: true, data: require('./public/data/spirits.json') }));
app.get('/api/beasts', (req, res) => res.json({ success: true, data: require('./public/data/beasts.json') }));
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// ============ 页面入口 ============
app.use((req, res) => {
  if (req.accepts('html')) return res.status(404).type('html').send('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面不存在</title><body><h1>404</h1><p>页面不存在，<a href="/">返回文字 RPG</a></p></body></html>');
  return res.status(404).json({ error: '资源不存在' });
});

// ============ 错误处理 ============
app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  if (error && (error.type === 'entity.too.large' || error.status === 413)) {
    return res.status(413).json({ error: '请求内容超过 2MB 限制' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'JSON 请求格式无效' });
  }
  return res.status(500).json({ error: '服务器内部错误' });
});

// ============ 启动 ============
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('=================================');
    console.log('  斗罗大陆 - 武魂觉醒');
    console.log('  Phase 7: Token 鉴权 / 乐观锁 / 历史版本 / 限流 / 缓存头 / 健康检查');
    console.log('=================================');
    console.log(`服务器已启动: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log('按 Ctrl+C 停止服务器');
    console.log('=================================');
  });
}

module.exports = {
  app, isValidPlayerId, getPlayerFile, getArchiveDir,
  generateToken, validateToken, archiveCurrentSave,
  DATA_DIR, PUBLIC_DIR, FRONTEND_DIST_DIR, ARCHIVE_DIR
};
