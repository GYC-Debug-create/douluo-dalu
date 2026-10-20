// 账号管理工具（管理员用，账号体系与游戏内"修改密码"共用同一份 data/accounts.json）
// 用法：
//   node scripts/account-admin.js create <用户名> <密码>         创建账号（已存在则报错）
//   node scripts/account-admin.js set-password <用户名> <新密码>  重置账号密码（该账号所有已登录设备随即下线）
//   node scripts/account-admin.js remove <用户名>                删除账号（其登录立即失效，存档文件保留）
//   node scripts/account-admin.js list                           列出所有账号
// 服务运行中直接改即可，服务端按文件修改时间自动热加载，无需重启。
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || path.join(DATA_DIR, 'accounts.json');
const [, , command, username, password] = process.argv;

const USERNAME_RE = /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,20}$/;

function usage() {
  console.log(`用法：
  node scripts/account-admin.js create <用户名> <密码>
  node scripts/account-admin.js set-password <用户名> <新密码>
  node scripts/account-admin.js remove <用户名>
  node scripts/account-admin.js list`);
}

const needsPassword = command === 'create' || command === 'set-password';
if (!command || (command !== 'list' && !username) || (needsPassword && !password)) {
  usage();
  process.exit(1);
}
if (command !== 'list' && !USERNAME_RE.test(username)) {
  console.error('用户名格式无效（2-20 位字母/数字/中文/_-）');
  process.exit(1);
}
if (needsPassword && (typeof password !== 'string' || password.length < 6 || password.length > 128)) {
  console.error('密码长度需为 6-128 位');
  process.exit(1);
}

let accounts = {};
try {
  accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) accounts = {};
} catch { /* 尚无账号文件 */ }

function hashPassword(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 64).toString('hex');
}

function save() {
  const tmp = ACCOUNTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(accounts, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, ACCOUNTS_FILE);
}

if (command === 'create') {
  if (accounts[username]) {
    console.error(`账号已存在：${username}`);
    process.exit(1);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  accounts[username] = { salt, hash: hashPassword(password, salt), createdAt: new Date().toISOString() };
  save();
  console.log(`已创建账号：${username}`);
} else if (command === 'set-password') {
  if (!accounts[username]) {
    console.error(`账号不存在：${username}`);
    process.exit(1);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  accounts[username].salt = salt;
  accounts[username].hash = hashPassword(password, salt);
  accounts[username].passwordChangedAt = new Date().toISOString();
  save();
  console.log(`已重置密码：${username}（旧登录已全部失效）`);
} else if (command === 'remove') {
  if (!accounts[username]) {
    console.error(`账号不存在：${username}`);
    process.exit(1);
  }
  delete accounts[username];
  save();
  console.log(`已删除账号：${username}（存档文件未删除）`);
} else if (command === 'list') {
  const names = Object.keys(accounts);
  if (!names.length) console.log('（暂无账号）');
  for (const name of names) console.log(`${name}	创建于 ${accounts[name].createdAt || '未知'}`);
} else {
  usage();
  process.exit(1);
}
