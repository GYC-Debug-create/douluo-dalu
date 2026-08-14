'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, FRONTEND_DIST_DIR } = require('../server');

function listen() {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test('生产入口提供 Vue 构建，同时保留 API 与 public 兼容资源', async t => {
  const indexFile = path.join(FRONTEND_DIST_DIR, 'index.html');
  assert.equal(fs.existsSync(indexFile), true, '测试前必须先构建 frontend/dist');

  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  for (const pathname of ['/', '/index.html']) {
    const response = await fetch(base + pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    const html = await response.text();
    assert.match(html, /<div id="app"><\/div>/, `${pathname} 应返回 Vue 挂载页`);
    assert.doesNotMatch(html, /id="screen-game"/, `${pathname} 不应返回旧版游戏页`);

    const entryAsset = html.match(/<script[^>]+src="([^"]+)"/);
    assert.ok(entryAsset, 'Vue 页面应引用编译后的入口脚本');
    const assetResponse = await fetch(base + entryAsset[1]);
    assert.equal(assetResponse.status, 200, `入口资产 ${entryAsset[1]} 应可访问`);
    assert.match(assetResponse.headers.get('content-type') || '', /javascript/);
  }

  const dataResponse = await fetch(base + '/data/spirits.json');
  assert.equal(dataResponse.status, 200);
  const spiritData = await dataResponse.json();
  assert.ok(Array.isArray(spiritData.spirits), '旧 public 数据仍应可读取');

  const mapResponse = await fetch(base + '/map.html');
  assert.equal(mapResponse.status, 200, '旧地图页面仍应可访问');

  const healthResponse = await fetch(base + '/api/health');
  assert.equal(healthResponse.status, 200, 'API 应与 Vue 入口共用同一服务');
  assert.equal((await healthResponse.json()).status, 'ok');
});
