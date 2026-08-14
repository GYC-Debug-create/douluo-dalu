'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.resolve(__dirname, '..', 'public');
const read = name => fs.readFileSync(path.join(publicDir, name), 'utf8');

test('主要表单控件具有可访问名称和输入属性', () => {
  const index = read('index.html');
  const game = read('game.html');
  const codex = read('codex.html');
  assert.match(index, /id="player-name"[^>]*aria-label="魂师名号"[^>]*name="playerName"/);
  assert.match(game, /id="input-name"[^>]*aria-label="魂师名字"[^>]*name="playerName"/);
  assert.match(codex, /id="search"[^>]*aria-label="搜索图鉴"[^>]*name="codexSearch"/);
});

test('弹窗与动态通知具有正确语义', () => {
  const game = read('game.html');
  const codex = read('codex.html');
  assert.ok(game.includes('id="modal-mask" role="dialog" aria-modal="true"'));
  assert.ok(game.includes('id="toast" role="status" aria-live="polite"'));
  assert.ok(codex.includes('id="modal-overlay" role="dialog" aria-modal="true"'));
});

test('地图图例与图标按钮支持键盘和读屏', () => {
  const map = read('map.html');
  assert.ok(map.includes('id="zoomIn" aria-label="放大地图"'));
  assert.ok(map.includes('id="panelClose" aria-label="关闭地点详情"'));
  assert.match(map, /<button[^>]*class="legend-item"/);
  assert.doesNotMatch(map, /onclick="filterByRegion/);
});
