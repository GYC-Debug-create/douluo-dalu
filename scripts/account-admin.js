// 账号管理工具（管理员用，账号体系与游戏内"修改密码"共用同一份 data/accounts.json）
// 用法：
//   node scripts/account-admin.js create <用户名> <密码>         创建账号（已存在则报错）
//   node scripts/account-admin.js set-password <用户名> <新密码>  重置账号密码
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || path.join(DATA_DIR, 'accounts.json');
const [, , command, username, password] = process.argv;

const USERNAME_RE = /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,20}$/;

function usage() {
  console.log(`用法：
  node scripts/account-admin.js create <用户名> <密码>
  node scripts/account-admin.js set-password <用户名> <新密码>`);
}

if (!command || !username || !password) {
  usage();
  process.exit(1);
}
if (!USERNAME_RE.test(username)) {
  console.error('用户名格式无效（2-20 位字母/数字/中文/_-）');
  process.exit(1);
}
if (typeof password !== 'string' || password.length < 4 || password.length > 128) {
  console.error('密码长度需为 4-128 位');
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
  fs.writeFileSync(tmp, JSON.stringify(accounts, null, 2), 'utf8');
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
  save();
  console.log(`已重置密码：${username}`);
} else {
  usage();
  process.exit(1);
}
