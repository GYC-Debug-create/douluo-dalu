'use strict';

// 回归测试：Docker 镜像必须包含 /api/spirits 与 /api/beasts 接口依赖的
// public/data/*.json（Dockerfile 已单独 COPY），本地开发环境同样由 public/ 提供。
// 该测试守护三个接口在任一环境（本地 / 测试 / Docker）行为一致。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('../server');

function listen() {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

test('游戏数据接口：/api/health /api/spirits /api/beasts 在部署环境中必须可用', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200, '/api/health 应返回 200');
  const healthJson = await health.json();
  assert.equal(healthJson.status, 'ok');

  const spirits = await fetch(base + '/api/spirits');
  assert.equal(spirits.status, 200, '/api/spirits 应返回 200');
  const spiritsJson = await spirits.json();
  assert.equal(spiritsJson.success, true, '/api/spirits 应返回 success:true');
  assert.ok(Array.isArray(spiritsJson.data.spirits) && spiritsJson.data.spirits.length > 0, '/api/spirits 武魂数组应为非空');

  const beasts = await fetch(base + '/api/beasts');
  assert.equal(beasts.status, 200, '/api/beasts 应返回 200');
  const beastsJson = await beasts.json();
  assert.equal(beastsJson.success, true, '/api/beasts 应返回 success:true');
  assert.ok(Array.isArray(beastsJson.data.beasts) && beastsJson.data.beasts.length > 0, '/api/beasts 魂兽数组应为非空');

  // 数据内容与本地 public 目录一致（同一数据结构）
  const localSpirits = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'public', 'data', 'spirits.json'), 'utf8'));
  assert.deepEqual(spiritsJson.data, localSpirits, '/api/spirits 数据应与 public/data/spirits.json 一致');
});

test('Docker 镜像只携带接口需要的数据文件，不重复复制整套 public 图片', () => {
  const dockerfile = fs.readFileSync(path.resolve(__dirname, '..', 'Dockerfile'), 'utf8');
  assert.doesNotMatch(dockerfile, /COPY\s+public\s+\.\/public/);
  assert.match(dockerfile, /COPY\s+public\/data\/spirits\.json\s+\.\/public\/data\/spirits\.json/);
  assert.match(dockerfile, /COPY\s+public\/data\/beasts\.json\s+\.\/public\/data\/beasts\.json/);
  const dockerignore = fs.readFileSync(path.resolve(__dirname, '..', '.dockerignore'), 'utf8');
  assert.match(dockerignore, /^public\/\*$/m);
  assert.match(dockerignore, /^!public\/data\/spirits\.json$/m);
  assert.match(dockerignore, /^!public\/data\/beasts\.json$/m);
});
