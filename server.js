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
// DATA_DIR 支持环境变量覆盖（部署/基准测试用），默认仍是仓库 data 目录。
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const ARCHIVE_DIR = path.resolve(DATA_DIR, 'archive');

// ============ 配置常量 ============
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;   // Token 有效期 30 天（家用规模，减少重复登录）
const RATE_LIMIT_WINDOW = 60 * 1000;          // 限流窗口 1 分钟
const RATE_LIMIT_GENERAL = 60;                // 通用 API 每分钟上限
const RATE_LIMIT_AUTH = Number(process.env.RATE_LIMIT_AUTH) || 10; // 登录/注册类接口每分钟上限（按 IP；测试可调大）
const RATE_LIMIT_SAVE = 10;                   // 存档接口每分钟上限
const MAX_HISTORY = 5;                        // 最多保留 5 个历史版本
const MAX_SAVES_PER_ACCOUNT = 30;             // 每个账号最多存档数，防止磁盘被灌满
const LOGIN_MAX_FAILS = 5;                    // 同一账号连续输错次数上限
const LOGIN_LOCK_MS = 15 * 60 * 1000;         // 超限后锁定 15 分钟（防暴力猜密码）
const MIN_NEW_PASSWORD = 6;                   // 新设密码最短长度（老账号登录仍兼容 4 位）
const MAX_BODY_SIZE = '2mb';
// 内测期不开放注册：账号只能由管理员用 scripts/account-admin.js 创建。
// 需要临时开放时设置环境变量 ALLOW_REGISTER=1（每次请求实时读取）。
const isRegistrationOpen = () => process.env.ALLOW_REGISTER === '1';
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || path.resolve(DATA_DIR, 'accounts.json');
const TOKEN_SECRET_FILE = process.env.TOKEN_SECRET_FILE || path.resolve(DATA_DIR, '.token-secret');

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

// 部署在 Nginx 之后：信任一跳代理，req.ip 取 Nginx 追加的真实客户端 IP，
// 使限流按玩家分桶而不是全服共用（Nginx 用 $proxy_add_x_forwarded_for 只追加不覆盖，
// 直接连 3000 端口时不受影响）。
app.set('trust proxy', 1);

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

// 登录失败计数（按账号名）：连续输错 LOGIN_MAX_FAILS 次锁定 LOGIN_LOCK_MS，
// 按账号而非 IP 计数，换 IP 也无法继续猜同一个账号的密码。
const loginFailures = new Map();

function loginLockRemainingMs(username) {
  const entry = loginFailures.get(username);
  if (!entry) return 0;
  return Math.max(0, entry.lockedUntil - Date.now());
}

function recordLoginFailure(username) {
  const now = Date.now();
  const entry = loginFailures.get(username) || { count: 0, lockedUntil: 0, lastAt: 0 };
  // 距上次失败超过锁定时长则重新计数
  if (now - entry.lastAt > LOGIN_LOCK_MS) entry.count = 0;
  entry.count++;
  entry.lastAt = now;
  if (entry.count >= LOGIN_MAX_FAILS) {
    entry.lockedUntil = now + LOGIN_LOCK_MS;
    entry.count = 0;
  }
  loginFailures.set(username, entry);
}

// 定期清理过期的限流桶（每 5 分钟）
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetTime + RATE_LIMIT_WINDOW) rateBuckets.delete(key);
  }
  for (const [key, entry] of loginFailures) {
    if (now > entry.lockedUntil && now - entry.lastAt > LOGIN_LOCK_MS) loginFailures.delete(key);
  }
}, 5 * 60 * 1000);
rateLimitCleanupTimer.unref();

// ============ 旧轨访问统计(为"双轨退役"决策积累数据) ============
// 旧轨已整体迁入 public/legacy/(阶段四整改):眼不见为净,但仍可正常访问。
// 精确计数旧版专属入口的命中次数;计数中间件必须挂在静态挂载之前,
// 否则被 static 终结的请求不会经过。数据落盘 data/legacy-access-stats.json,
// 一周后按 /api/health 读数决定旧轨去留;决策完成后可整体移除本模块。
const LEGACY_ACCESS_PATHS = new Set([
  '/legacy/game.html', '/legacy/map.html', '/legacy/codex.html', '/legacy/debug-saves.html',
  '/legacy/index.html',
  '/legacy/game.js', '/legacy/game-combat.js', '/legacy/game-data.js',
  '/legacy/game-events-expanded.js', '/legacy/game-visual.js', '/legacy/game-rules.js',
  '/legacy/save-utils.js'
]);
const LEGACY_STATS_FILE = path.resolve(DATA_DIR, 'legacy-access-stats.json');
let legacyAccess = { since: new Date().toISOString().slice(0, 10), totals: {} };
try {
  const raw = JSON.parse(fs.readFileSync(LEGACY_STATS_FILE, 'utf8'));
  if (raw && typeof raw.totals === 'object' && raw.since) legacyAccess = raw;
} catch { /* 首次统计 */ }

// 统计文件仅约 200 字节,同步写 + tmp/rename 原子替换;退出前也要落全,
// 故不用异步 IO(与"请求路径禁同步"约定不冲突——这里不在请求路径上)。
function flushLegacyAccess() {
  try {
    const tmp = LEGACY_STATS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(legacyAccess, null, 2), 'utf8');
    fs.renameSync(tmp, LEGACY_STATS_FILE);
  } catch (error) {
    console.warn('旧轨访问统计写入失败:', error.message);
  }
}

app.use((req, res, next) => {
  if (LEGACY_ACCESS_PATHS.has(req.path)) {
    legacyAccess.totals[req.path] = (legacyAccess.totals[req.path] || 0) + 1;
  }
  next();
});
// 定时落盘与信号钩子仅真实启动时挂载:被测试 require 时不产生定时器和
// 磁盘写入,避免测试计数污染生产测量数据。
if (require.main === module) {
  const legacyAccessFlushTimer = setInterval(flushLegacyAccess, 60 * 1000);
  legacyAccessFlushTimer.unref();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, flushLegacyAccess);
  }
}

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
    } else if (/\.(png|jpe?g|webp|gif|ico)$/i.test(basename)) {
      // 无 hash 的图片资产：文件名稳定（事件图按内容命名），7 天强缓存
      // 显著改善二次访问与翻页浏览速度；更新图片时改文件名或手动清缓存。
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (/\.(js|css|svg|woff2?|ttf|eot|json)$/.test(filePath)) {
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

// 旧轨已迁入 public/legacy/，但其代码仍以裸相对路径引用 assets/data
// （浏览器按 /legacy/assets/... 解析），这里挂两个别名目录指向真实文件，
// 免改旧轨任何代码；真实目录仍由下方 public 静态挂载提供。
app.use('/legacy/assets', express.static(path.join(PUBLIC_DIR, 'assets'), staticOptions));
app.use('/legacy/data', express.static(path.join(PUBLIC_DIR, 'data'), staticOptions));
// Docker 镜像只带 frontend/dist（public/assets 不进镜像），再挂一层 dist 下的同名目录兜底。
app.use('/legacy/assets', express.static(path.join(FRONTEND_DIST_DIR, 'assets'), staticOptions));
app.use('/legacy/data', express.static(path.join(FRONTEND_DIST_DIR, 'data'), staticOptions));

// Vue 生产构建优先；旧 public 目录继续提供地图、图鉴、数据等兼容资源。
app.use(express.static(FRONTEND_DIST_DIR, staticOptions));

function sendVueIndex(req, res, next) {
  const indexFile = path.join(FRONTEND_DIST_DIR, 'index.html');
  res.setHeader('Cache-Control', 'no-cache');
  return res.sendFile(indexFile, error => {
    if (error && !res.headersSent) {
      // 未构建时给出可操作的 503 提示（请求路径内不做同步 exists 探测）。
      return res.status(503).type('text').send('Vue 前端尚未构建，请先运行 npm run build。');
    }
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

// ============ 账号与 Token（注册 / 登录 / 无状态鉴权） ============
// Token 为无状态 HMAC 签名：服务器重启后仍然有效；签名密钥持久化在 data/.token-secret
//（可用环境变量 TOKEN_SECRET 覆盖，需 ≥16 字符）。账号与 scrypt 密码哈希存储在 data/accounts.json。
function loadOrCreateTokenSecret() {
  if (process.env.TOKEN_SECRET && String(process.env.TOKEN_SECRET).length >= 16) {
    return process.env.TOKEN_SECRET;
  }
  try {
    const existing = fs.readFileSync(TOKEN_SECRET_FILE, 'utf8').trim();
    if (existing.length >= 16) return existing;
  } catch { /* 首次启动 */ }
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(TOKEN_SECRET_FILE, secret, { mode: 0o600 });
  } catch (error) {
    console.warn('无法持久化 Token 密钥（重启后所有登录将失效）:', error.message);
  }
  return secret;
}
const TOKEN_SECRET = loadOrCreateTokenSecret();

// ---- 账号存储（文件持久化 + 原子写入） ----
// 管理员会在服务运行期间用 scripts/account-admin.js 直接改 accounts.json：
// 按 mtime 热加载，新建/删除/重置密码即时生效，也避免服务端把内存旧副本写回覆盖掉管理员的修改。
let accounts = {};
let accountsMtimeMs = -1;
try {
  accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) accounts = {};
  accountsMtimeMs = fs.statSync(ACCOUNTS_FILE).mtimeMs;
} catch { /* 尚无账号文件 */ }

async function refreshAccounts() {
  try {
    const stat = await fsp.stat(ACCOUNTS_FILE);
    if (stat.mtimeMs === accountsMtimeMs) return;
    const parsed = JSON.parse(await fsp.readFile(ACCOUNTS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      accounts = parsed;
      accountsMtimeMs = stat.mtimeMs;
    }
  } catch (error) {
    // 文件不存在 / 写到一半解析失败：沿用内存副本，下次请求再试
    if (error.code !== 'ENOENT') console.warn('读取账号文件失败，沿用内存中的账号:', error.message);
  }
}

// 账号写操作串行化，避免并发改密码时 tmp 文件互相踩踏
let accountsWriteChain = Promise.resolve();
function withAccountsLock(fn) {
  const run = accountsWriteChain.then(async () => {
    await refreshAccounts();
    return fn();
  });
  accountsWriteChain = run.catch(() => {});
  return run;
}

// 原子写账号文件（请求路径全异步：tmp + rename）
async function saveAccounts() {
  const tmp = ACCOUNTS_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(accounts, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fsp.rename(tmp, ACCOUNTS_FILE);
  try {
    accountsMtimeMs = (await fsp.stat(ACCOUNTS_FILE)).mtimeMs;
  } catch { /* 下次 refresh 会重新读 */ }
}

function isValidUsername(username) {
  return typeof username === 'string' && /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,20}$/.test(username);
}
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 4 && password.length <= 128;
}
// scrypt 是 CPU 密集操作：异步执行避免阻塞事件循环（参数与原 scryptSync 完全一致）。
const scryptAsync = (password, salt, keylen) => new Promise((resolve, reject) => {
  crypto.scrypt(String(password), salt, keylen, (error, derived) => {
    if (error) reject(error); else resolve(derived);
  });
});
async function hashPassword(password, salt) {
  return (await scryptAsync(password, salt, 64)).toString('hex');
}
async function registerAccount(username, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  accounts[username] = { salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
  await saveAccounts();
}
// 账号不存在时也跑一次同等开销的 scrypt，避免靠响应耗时探测哪些账号存在。
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
async function verifyAccount(username, password) {
  const entry = Object.prototype.hasOwnProperty.call(accounts, username) ? accounts[username] : null;
  if (!entry || !entry.salt || !entry.hash) {
    await hashPassword(password, DUMMY_SALT);
    return false;
  }
  const expected = Buffer.from(entry.hash, 'hex');
  const actual = Buffer.from(await hashPassword(password, entry.salt), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ---- 无状态 Token（HMAC 签名，重启有效） ----
function generateToken(username) {
  const expires = Date.now() + TOKEN_TTL;
  const payload = `${username}:${expires}`;
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${signature}`;
}
function validateToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  let username, expires;
  try {
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const separator = payload.lastIndexOf(':');
    if (separator <= 0) return null;
    username = payload.slice(0, separator);
    expires = Number(payload.slice(separator + 1));
  } catch {
    return null;
  }
  if (!isValidUsername(username) || !Number.isFinite(expires)) return null;
  if (Date.now() > expires) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(`${username}:${expires}`).digest('base64url');
  const signatureA = Buffer.from(parts[1]);
  const signatureB = Buffer.from(expected);
  if (signatureA.length !== signatureB.length || !crypto.timingSafeEqual(signatureA, signatureB)) return null;
  return { username, expires };
}

// Token 只编码了过期时间，签发时间 = 过期时间 - TOKEN_TTL。
// 改密码 / 管理员重置密码会写 passwordChangedAt，此前签发的 Token 全部作废；
// 账号被管理员删除后，其 Token 也立即失效。
function isSessionCurrent(session) {
  const entry = Object.prototype.hasOwnProperty.call(accounts, session.username) ? accounts[session.username] : null;
  if (!entry || !entry.hash) return false;
  const changedAt = Date.parse(entry.passwordChangedAt || '') || 0;
  return session.expires - TOKEN_TTL >= changedAt;
}

// 鉴权中间件：所有存档读写接口必须携带有效 Token
async function requireAuth(req, res, next) {
  try {
    const session = validateToken(req.headers['x-auth-token']);
    if (session) await refreshAccounts();
    if (!session || !isSessionCurrent(session)) {
      return res.status(401).json({ error: '未登录或登录已过期，请重新登录' });
    }
    req.authUser = session.username;
    next();
  } catch (error) {
    next(error);
  }
}

function isLoopbackRequest(req) {
  const ip = req.ip || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// ============ 存档历史版本管理 ============
async function archiveCurrentSave(playerId) {
  const file = getPlayerFile(playerId);
  if (!file) return null;
  let current;
  try {
    current = JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return null; // 与原实现一致：存档不存在或损坏时跳过归档
  }

  const archiveDir = getArchiveDir(playerId);
  if (!archiveDir) return null;
  await fsp.mkdir(archiveDir, { recursive: true });

  try {
    const version = current._serverVersion || 0;
    const archiveFile = path.resolve(archiveDir, `v${version}.json`);
    await fsp.writeFile(archiveFile, JSON.stringify(current, null, 2), 'utf8');

    // 清理超出上限的旧版本
    const archives = (await fsp.readdir(archiveDir))
      .filter(f => /^v\d+\.json$/.test(f))
      .map(f => ({ name: f, version: parseInt(f.match(/\d+/)[0], 10) }))
      .sort((a, b) => b.version - a.version);

    for (let i = MAX_HISTORY; i < archives.length; i++) {
      await fsp.unlink(path.resolve(archiveDir, archives[i].name)).catch(() => {});
    }

    return version;
  } catch {
    return null;
  }
}

// ============ 健康检查 ============
// 公网只回 status；内存、存档数、旧轨统计等运维细节仅对本机请求开放
//（容器内：docker exec douluo-game-app wget -qO- http://127.0.0.1:3000/api/health）。
app.get('/api/health', rateLimit(RATE_LIMIT_GENERAL, 'health'), async (req, res) => {
  if (!isLoopbackRequest(req)) {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }
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
    legacyAccess: { since: legacyAccess.since, totals: { ...legacyAccess.totals } },
    timestamp: new Date().toISOString()
  });
});

// ============ 注册 / 登录 ============
app.post('/api/auth/register', rateLimit(RATE_LIMIT_AUTH, 'register'), async (req, res) => {
  try {
    if (!isRegistrationOpen()) {
      return res.status(403).json({ error: '暂未开放注册，请联系管理员获取账号' });
    }
    const { username, password } = req.body || {};
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: '账号需为 2-20 位字母、数字、中文或 _- 字符' });
    }
    if (!isValidPassword(password) || password.length < MIN_NEW_PASSWORD) {
      return res.status(400).json({ error: `密码长度需为 ${MIN_NEW_PASSWORD}-128 位` });
    }
    const created = await withAccountsLock(async () => {
      if (Object.prototype.hasOwnProperty.call(accounts, username)) return false;
      await registerAccount(username, password);
      return true;
    });
    if (!created) {
      return res.status(409).json({ error: '该账号已存在，请直接登录' });
    }
    return res.json({ success: true, username, token: generateToken(username), expiresIn: TOKEN_TTL });
  } catch (error) {
    console.error('注册失败:', error);
    return res.status(500).json({ error: '服务器暂时无法完成注册' });
  }
});

app.post('/api/auth/login', rateLimit(RATE_LIMIT_AUTH, 'login'), async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!isValidUsername(username) || !isValidPassword(password)) {
      return res.status(400).json({ error: '账号或密码格式不正确' });
    }
    const lockedMs = loginLockRemainingMs(username);
    if (lockedMs > 0) {
      const retryAfter = Math.ceil(lockedMs / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: `密码输错次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后再试`, retryAfter });
    }
    await refreshAccounts();
    if (!(await verifyAccount(username, password))) {
      recordLoginFailure(username);
      return res.status(401).json({ error: '账号或密码错误' });
    }
    loginFailures.delete(username);
    return res.json({ success: true, username, token: generateToken(username), expiresIn: TOKEN_TTL });
  } catch (error) {
    console.error('登录失败:', error);
    return res.status(500).json({ error: '服务器暂时无法登录' });
  }
});

// ============ 修改密码（需登录，验证原密码） ============
app.post('/api/auth/password', rateLimit(RATE_LIMIT_AUTH, 'password'), requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!isValidPassword(oldPassword) || !isValidPassword(newPassword)) {
      return res.status(400).json({ error: '密码长度需为 4-128 位' });
    }
    if (newPassword.length < MIN_NEW_PASSWORD) {
      return res.status(400).json({ error: `新密码至少 ${MIN_NEW_PASSWORD} 位` });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ error: '新密码不能与原密码相同' });
    }
    // 原密码同样计入失败锁定，防止拿到 Token 后借改密码接口猜原密码
    const lockedMs = loginLockRemainingMs(req.authUser);
    if (lockedMs > 0) {
      return res.status(429).json({ error: `密码输错次数过多，请 ${Math.ceil(lockedMs / 60000)} 分钟后再试` });
    }
    const outcome = await withAccountsLock(async () => {
      if (!(await verifyAccount(req.authUser, oldPassword))) return { ok: false };
      const salt = crypto.randomBytes(16).toString('hex');
      accounts[req.authUser].salt = salt;
      accounts[req.authUser].hash = await hashPassword(newPassword, salt);
      accounts[req.authUser].passwordChangedAt = new Date().toISOString();
      await saveAccounts();
      return { ok: true };
    });
    if (!outcome.ok) {
      recordLoginFailure(req.authUser);
      // 用 403 而非 401：前端遇 401 会当作登录过期直接登出，输错原密码不该被踢下线
      return res.status(403).json({ error: '原密码不正确' });
    }
    // 旧 Token（包括其他设备上的登录）随改密作废，这里给当前设备换发新 Token
    return res.json({ success: true, message: '密码修改成功', token: generateToken(req.authUser), expiresIn: TOKEN_TTL });
  } catch (error) {
    console.error('修改密码失败:', error);
    return res.status(500).json({ error: '服务器暂时无法修改密码' });
  }
});

// ============ 同账号存档串行化 ============
// 请求路径异步化后，"读版本→校验乐观锁→写档"之间存在 await 间隙；
// 这里按 playerId 串行化写类操作，保持与原同步实现等价的逐请求原子语义，
// 防止两个并发保存都读到同一版本号而互相覆盖。
const playerLocks = new Map();

function withPlayerLock(playerId, fn) {
  const previous = playerLocks.get(playerId) || Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.catch(() => {});
  playerLocks.set(playerId, tail);
  run.finally(() => {
    if (playerLocks.get(playerId) === tail) playerLocks.delete(playerId);
  });
  return run;
}

// ============ 存档 API（账号归属 + 乐观锁 + 历史版本） ============
app.post('/api/player/save', rateLimit(RATE_LIMIT_SAVE, 'save'), requireAuth, async (req, res) => {
  try {
    const { playerId, data, expectVersion } = req.body || {};

    const file = getPlayerFile(playerId);
    if (!file || !data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: '存档 ID 或数据无效' });
    }

    const outcome = await withPlayerLock(playerId, async () => {
      // 乐观锁 + 账号归属：已存在的存档必须属于当前账号，且版本号必须匹配
      let currentVersion = 0;
      let existing = null;
      try {
        existing = JSON.parse(await fsp.readFile(file, 'utf8'));
      } catch {
        existing = null; // 不存在或损坏都按"新档"处理（与原 existsSync 语义一致）
      }
      if (existing) {
        if (!existing.owner) {
          return { status: 403, body: { error: '该存档尚未归属任何账号，暂不能写入' } };
        }
        if (existing.owner !== req.authUser) {
          return { status: 403, body: { error: '该存档不属于当前账号' } };
        }
        currentVersion = existing._serverVersion || 0;

        if (expectVersion !== currentVersion) {
          return {
            status: 409,
            body: { error: '存档版本冲突，请刷新后重试', currentVersion, conflict: true }
          };
        }

        // 归档当前版本
        await archiveCurrentSave(playerId);
      } else {
        const { list } = await loadPlayerList();
        if (list.filter(item => item.owner === req.authUser).length >= MAX_SAVES_PER_ACCOUNT) {
          return { status: 403, body: { error: `每个账号最多 ${MAX_SAVES_PER_ACCOUNT} 个存档，请先删除不用的存档` } };
        }
      }

      const newVersion = currentVersion + 1;
      const saveData = {
        ...data,
        playerId,
        owner: req.authUser,
        _serverVersion: newVersion,
        lastSave: new Date().toISOString()
      };

      await fsp.writeFile(file, JSON.stringify(saveData, null, 2), 'utf8');
      invalidatePlayerListCache();
      return {
        status: 200,
        body: { success: true, message: '存档成功', lastSave: saveData.lastSave, version: newVersion }
      };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('保存失败:', error);
    return res.status(500).json({ error: '服务器暂时无法保存存档' });
  }
});

app.get('/api/player/load/:playerId', rateLimit(RATE_LIMIT_GENERAL, 'load'), requireAuth, async (req, res) => {
  try {
    const file = getPlayerFile(req.params.playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });
    let data = null;
    try {
      data = JSON.parse(await fsp.readFile(file, 'utf8'));
    } catch {
      return res.json({ success: false, message: '无存档', data: null });
    }
    if (data.owner !== req.authUser) {
      return res.status(403).json({ error: '该存档不属于当前账号' });
    }
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
app.get('/api/player/history/:playerId', rateLimit(RATE_LIMIT_GENERAL, 'history'), requireAuth, async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const file = getPlayerFile(playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });
    // 必须是本人名下的存档才能查历史；主档不存在/损坏时无法确认归属，一律按无历史处理，
    // 避免任何登录用户凭 playerId 窥探别人的历史版本。
    let owned = false;
    try {
      const data = JSON.parse(await fsp.readFile(file, 'utf8'));
      if (data.owner !== req.authUser) {
        return res.status(403).json({ error: '该存档不属于当前账号' });
      }
      owned = true;
    } catch { /* 主档不存在或损坏 */ }
    if (!owned) return res.json({ success: true, versions: [] });
    const archiveDir = getArchiveDir(playerId);
    let entries = [];
    try {
      entries = (await fsp.readdir(archiveDir)).filter(f => /^v\d+\.json$/.test(f));
    } catch {
      return res.json({ success: true, versions: [] });
    }

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

app.post('/api/player/restore/:playerId', rateLimit(RATE_LIMIT_SAVE, 'restore'), requireAuth, async (req, res) => {
  try {
    const { playerId } = req.params;
    const file = getPlayerFile(playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });

    const { version } = req.body || {};
    if (!Number.isInteger(version) || version < 0) {
      return res.status(400).json({ error: '版本号无效' });
    }

    const outcome = await withPlayerLock(playerId, async () => {
      let existing = null;
      try {
        existing = JSON.parse(await fsp.readFile(file, 'utf8'));
      } catch {
        return { status: 404, body: { error: '无存档' } };
      }
      if (existing.owner !== req.authUser) {
        return { status: 403, body: { error: '该存档不属于当前账号' } };
      }

      const archiveDir = getArchiveDir(playerId);
      const archiveFile = path.resolve(archiveDir, `v${version}.json`);
      const prefix = archiveDir.endsWith(path.sep) ? archiveDir : archiveDir + path.sep;
      if (!archiveFile.startsWith(prefix)) {
        return { status: 404, body: { error: '历史版本不存在' } };
      }
      let data = null;
      try {
        data = JSON.parse(await fsp.readFile(archiveFile, 'utf8'));
      } catch {
        return { status: 404, body: { error: '历史版本不存在' } };
      }

      // 归档当前版本（如果存在）
      await archiveCurrentSave(playerId);

      // 恢复指定版本
      const currentVersion = data._serverVersion || 0;
      data._serverVersion = currentVersion + 1;
      data.lastSave = new Date().toISOString();
      await fsp.writeFile(file, JSON.stringify(data, null, 2), 'utf8');

      invalidatePlayerListCache();
      return {
        status: 200,
        body: { success: true, message: '版本恢复成功', version: data._serverVersion }
      };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('恢复版本失败:', error);
    return res.status(500).json({ error: '服务器暂时无法恢复版本' });
  }
});

// ============ 存档列表缓存（TTL 45s，写操作主动失效；mtime/size 增量索引） ============
// 索引文件 data/.player-index.json 记录每个存档的 stat 指纹与已解析摘要：
// 未变更的文件直接复用摘要（O(1)），仅变更/新增的文件才重新 JSON.parse。
const PLAYER_LIST_TTL = 45 * 1000;
const PLAYER_INDEX_FILE = path.join(DATA_DIR, '.player-index.json');
let playerListCache = null;
let playerListCacheAt = 0;
let playerListInflight = null;

function invalidatePlayerListCache() {
  playerListCache = null;
  playerListCacheAt = 0;
}

async function readPlayerIndex() {
  try {
    const index = JSON.parse(await fsp.readFile(PLAYER_INDEX_FILE, 'utf8'));
    return index && typeof index === 'object' ? index : {};
  } catch {
    return {}; // 无索引或损坏：退化为全量重建
  }
}

async function writePlayerIndex(index) {
  const tmp = PLAYER_INDEX_FILE + '.tmp';
  try {
    await fsp.writeFile(tmp, JSON.stringify(index), 'utf8');
    await fsp.rename(tmp, PLAYER_INDEX_FILE);
  } catch {
    // 索引写失败只影响下次全量重建，不影响列表正确性
  }
}

async function parsePlayerSummary(playerId, file) {
  const data = JSON.parse(await fsp.readFile(file, 'utf8'));
  if (data.gameMode !== 'text-rpg' && !(data.spirit && typeof data.spirit === 'object')) return null;
  return {
    playerId, name: data.name || '未知', level: Number(data.level) || 1,
    spirit: data.spirit || '未知', gameMode: data.gameMode, lastSave: data.lastSave,
    version: data._serverVersion || 0,
    owner: typeof data.owner === 'string' ? data.owner : ''
  };
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
    const fileSet = new Set(files);
    const index = await readPlayerIndex();
    const nextIndex = {};
    const list = [];
    let dirty = Object.keys(index).some(key => !fileSet.has(key));

    for (const fileName of files) {
      const playerId = fileName.slice(7, -5);
      const file = getPlayerFile(playerId);
      if (!file) continue;
      let stat = null;
      try {
        stat = await fsp.stat(file);
      } catch {
        continue; // 并发删除等竞态：本轮直接跳过
      }
      const cached = index[fileName];
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size && 'summary' in cached) {
        nextIndex[fileName] = cached;
        if (cached.summary) list.push(cached.summary);
        continue;
      }
      dirty = true;
      let summary = null;
      try {
        summary = await parsePlayerSummary(playerId, file);
        if (summary) list.push(summary);
      } catch (error) {
        console.warn(`跳过损坏存档 ${fileName}:`, error.message);
      }
      nextIndex[fileName] = { mtimeMs: stat.mtimeMs, size: stat.size, summary };
    }

    if (dirty) await writePlayerIndex(nextIndex);
    playerListCache = list;
    playerListCacheAt = Date.now();
    return list;
  })().finally(() => { playerListInflight = null; });
  return { list: await playerListInflight, cached: false };
}

// ============ 存档列表（只返回当前账号名下的存档） ============
app.get('/api/player/list', rateLimit(RATE_LIMIT_GENERAL, 'list'), requireAuth, async (req, res) => {
  try {
    const { list, cached } = await loadPlayerList();
    return res.json({ success: true, list: list.filter(item => item.owner === req.authUser), cached });
  } catch (error) {
    console.error('获取列表失败:', error);
    return res.status(500).json({ error: '服务器暂时无法读取存档列表' });
  }
});

// ============ 删除存档（仅限本人存档） ============
app.delete('/api/player/:playerId', rateLimit(RATE_LIMIT_SAVE, 'delete'), requireAuth, async (req, res) => {
  try {
    const { playerId } = req.params;
    const file = getPlayerFile(playerId);
    if (!file) return res.status(400).json({ error: '存档 ID 无效' });

    const outcome = await withPlayerLock(playerId, async () => {
      let existing = null;
      try {
        existing = JSON.parse(await fsp.readFile(file, 'utf8'));
      } catch (error) {
        // 文件本就不存在：幂等成功，但不动历史目录（无法确认归属）
        if (error.code === 'ENOENT') return { status: 200, body: { success: true } };
        return { status: 403, body: { error: '存档已损坏，无法确认归属，请联系管理员处理' } };
      }
      // 只有存档主人能删；未归属账号的旧档也不允许任何人删除
      if (!existing || existing.owner !== req.authUser) {
        return { status: 403, body: { error: '该存档不属于当前账号' } };
      }
      await fsp.unlink(file).catch(() => {});

      // 同时清理历史版本
      const archiveDir = getArchiveDir(playerId);
      if (archiveDir) {
        await fsp.rm(archiveDir, { recursive: true, force: true }).catch(() => {});
      }

      invalidatePlayerListCache();
      return { status: 200, body: { success: true } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('删除失败:', error);
    return res.status(500).json({ error: '服务器暂时无法删除存档' });
  }
});

// ============ 游戏数据接口 ============
// 只读数据：首次请求时序列化一次并缓存字符串，避免每次请求重复 stringify 大 JSON。
const staticJsonCache = new Map();
function sendStaticData(res, file) {
  let body = staticJsonCache.get(file);
  if (!body) {
    body = JSON.stringify({ success: true, data: require(file) });
    staticJsonCache.set(file, body);
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.type('json').send(body);
}
app.get('/api/spirits', (req, res) => sendStaticData(res, './public/data/spirits.json'));
app.get('/api/beasts', (req, res) => sendStaticData(res, './public/data/beasts.json'));
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
  loadPlayerList, invalidatePlayerListCache, withPlayerLock,
  DATA_DIR, PUBLIC_DIR, FRONTEND_DIST_DIR, ARCHIVE_DIR
};
