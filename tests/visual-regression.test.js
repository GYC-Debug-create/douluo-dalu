'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('文字 RPG 只保留一套 Toast 布局规则，避免同时设置 top 与 bottom 被拉成长条', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'legacy', 'game.html'), 'utf8');
  const toastBlocks = [...html.matchAll(/\.toast\s*\{([^}]+)\}/g)].map(match => match[1]);
  assert.equal(toastBlocks.length, 1, `检测到 ${toastBlocks.length} 套 .toast 样式，存在覆盖风险`);
  assert.ok(!toastBlocks[0].includes('top:') || !toastBlocks[0].includes('bottom:'), 'Toast 不应同时设置 top 与 bottom');
});
