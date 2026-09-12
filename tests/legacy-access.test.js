'use strict';

// 旧轨访问统计:确认 /game.html 等旧版入口命中会被计数,
// 且读数通过 /api/health 暴露——这是"双轨退役"决策的数据来源。

const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');

function listen() {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

test('旧轨入口命中被计数并经 /api/health 暴露', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  const before = await (await fetch(base + '/api/health')).json();
  const beforeHits = (before.legacyAccess?.totals?.['/game.html']) || 0;
  assert.ok(before.legacyAccess && typeof before.legacyAccess.since === 'string', 'health 应携带 legacyAccess 统计块');

  // 旧版专属页面(存在于 public/,且构建产物 dist 中已被移除)
  assert.equal((await fetch(base + '/game.html')).status, 200, '旧轨 game.html 应可达');
  assert.equal((await fetch(base + '/game.html')).status, 200);

  const after = await (await fetch(base + '/api/health')).json();
  const afterHits = after.legacyAccess.totals['/game.html'] || 0;
  assert.equal(afterHits, beforeHits + 2, 'game.html 两次访问应恰好 +2');
  assert.equal(after.legacyAccess.totals['/'], undefined, 'Vue 入口 / 不计入旧轨统计');
});
