// 旧存档归属迁移工具（账号体系上线后使用一次）
// 用法：
//   node scripts/migrate-legacy-saves.js list                    列出所有存档及其归属
//   node scripts/migrate-legacy-saves.js assign <用户名> <playerId...>   把指定存档归属给账号（写 owner 字段）
//   node scripts/migrate-legacy-saves.js remove <playerId...>    把指定存档移动到 data/removed/（不删除）
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const REMOVED_DIR = path.join(DATA_DIR, 'removed');
const [, , command, ...args] = process.argv;

function saveFiles() {
  return fs.readdirSync(DATA_DIR)
    .filter(name => /^player_[A-Za-z0-9_-]{3,80}\.json$/.test(name))
    .map(name => path.join(DATA_DIR, name));
}

function readSave(file) {
  try {
    // 兼容带 BOM 的 UTF-8 文件（例如曾被 Windows 工具编辑过的存档）
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function describe(data) {
  if (!data) return '（损坏）';
  const spirit = typeof data.spirit === 'object' ? data.spirit.name : data.spirit;
  return `${data.name || '未知'} Lv.${data.level || '?'} 武魂:${spirit || '?'} 归属:${data.owner || '无'} 最后保存:${data.lastSave || '?'}`;
}

if (command === 'list') {
  const files = saveFiles();
  console.log(`共 ${files.length} 个存档：\n`);
  for (const file of files.sort()) {
    const data = readSave(file);
    console.log(`${path.basename(file)}\t${describe(data)}`);
  }
} else if (command === 'assign' && args.length >= 2) {
  const [username, ...playerIds] = args;
  if (!/^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,20}$/.test(username)) {
    console.error('用户名格式无效（2-20 位字母/数字/中文/_-）');
    process.exit(1);
  }
  for (const playerId of playerIds) {
    const file = path.join(DATA_DIR, `player_${playerId}.json`);
    if (!fs.existsSync(file)) {
      console.error(`跳过：存档不存在 ${playerId}`);
      continue;
    }
    const data = readSave(file);
    if (!data) {
      console.error(`跳过：存档损坏 ${playerId}`);
      continue;
    }
    data.owner = username;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log(`已归属：${playerId} → ${username}（${data.name || '未知'} Lv.${data.level || '?'}）`);
  }
} else if (command === 'remove' && args.length >= 1) {
  if (!fs.existsSync(REMOVED_DIR)) fs.mkdirSync(REMOVED_DIR, { recursive: true });
  for (const playerId of args) {
    const file = path.join(DATA_DIR, `player_${playerId}.json`);
    if (!fs.existsSync(file)) {
      console.error(`跳过：存档不存在 ${playerId}`);
      continue;
    }
    fs.renameSync(file, path.join(REMOVED_DIR, path.basename(file)));
    // 同步移动历史版本目录
    const archiveDir = path.join(DATA_DIR, 'archive', playerId);
    if (fs.existsSync(archiveDir)) {
      fs.renameSync(archiveDir, path.join(REMOVED_DIR, `archive_${playerId}`));
    }
    console.log(`已归档：${playerId} → data/removed/`);
  }
} else {
  console.log(`用法：
  node scripts/migrate-legacy-saves.js list
  node scripts/migrate-legacy-saves.js assign <用户名> <playerId...>
  node scripts/migrate-legacy-saves.js remove <playerId...>`);
  process.exit(1);
}
