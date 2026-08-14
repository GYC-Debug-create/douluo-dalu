'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, isValidPlayerId, getPlayerFile, DATA_DIR } = require('../server');

function listen(){
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, base:`http://127.0.0.1:${server.address().port}` }));
  });
}

async function authenticate(base, playerId, name){
  const response = await fetch(base + '/api/player/auth', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ playerId, name })
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.success, true);
  assert.ok(json.token);
  return json.token;
}

test('playerId 路径防护、安全响应头、404、413 与错误脱敏', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  for(const value of ['../etc','..\\etc','a/b','%2e%2e','a'.repeat(81),'空 格']){
    assert.equal(isValidPlayerId(value), false, value);
    assert.equal(getPlayerFile(value), null);
  }
  assert.equal(isValidPlayerId('p_safe-123'), true);
  assert.ok(getPlayerFile('p_safe-123').startsWith(DATA_DIR + path.sep));

  const root = await fetch(base + '/');
  assert.equal(root.status, 200);
  assert.equal(root.headers.get('x-powered-by'), null);
  assert.match(root.headers.get('content-security-policy') || '', /object-src 'none'/);
  assert.equal(root.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await root.text(), /斗罗大陆 · 武魂觉醒/);

  const traversal = await fetch(base + '/api/player/load/' + encodeURIComponent('../etc'));
  assert.equal(traversal.status, 400);
  assert.deepEqual(await traversal.json(), { error:'存档 ID 无效' });

  const invalidSave = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ playerId:'../evil', data:{ name:'恶意' } })
  });
  assert.equal(invalidSave.status, 401, '所有写接口都必须先通过 Token 鉴权');

  const invalidAuth = await fetch(base + '/api/player/auth', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ playerId:'../evil', name:'恶意' })
  });
  assert.equal(invalidAuth.status, 400, '非法存档 ID 不能获得 Token');

  const api404 = await fetch(base + '/api/not-found');
  assert.equal(api404.status, 404);
  assert.equal((await api404.json()).error, '接口不存在');
  const static404 = await fetch(base + '/missing-resource.js');
  assert.equal(static404.status, 404);
  assert.doesNotMatch(await static404.text(), /id="screen-game"/, '未知静态资源不得伪装成 game.html');

  const tooLarge = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ playerId:'p_too_large', data:{ journal:'x'.repeat(2.1 * 1024 * 1024) } })
  });
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(await tooLarge.json(), { error:'请求内容超过 2MB 限制' });

  const corruptName = 'player_p_corrupt_list.json';
  const corruptPath = path.join(DATA_DIR, corruptName);
  fs.writeFileSync(corruptPath, '{not json', 'utf8');
  t.after(() => { if(fs.existsSync(corruptPath)) fs.unlinkSync(corruptPath); });
  const list = await fetch(base + '/api/player/list');
  assert.equal(list.status, 200, '单个损坏存档不能拖垮列表');
  assert.equal((await list.json()).success, true);
});

test('T27 服务器存档 save → load 往返一致（临时 ID）', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  const playerId = 'p_roundtrip_' + Date.now().toString(36);
  const payload = {
    playerId,
    data: {
      name:'往返测试', level:25, exp:123, gold:888,
      spirit:{ name:'昊天锤', tier:'top' },
      rings:[{ ringId:'yellow_ring', skill:'流光斩' }],
      gameMode:'text-rpg'
    }
  };
  const token = await authenticate(base, playerId, payload.data.name);
  const saveRes = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json', 'x-auth-token':token },
    body:JSON.stringify(payload)
  });
  assert.equal(saveRes.status, 200);
  const saveJson = await saveRes.json();
  assert.equal(saveJson.success, true);

  const loadRes = await fetch(base + '/api/player/load/' + playerId);
  assert.equal(loadRes.status, 200);
  const loadJson = await loadRes.json();
  assert.equal(loadJson.success, true);
  assert.equal(loadJson.data.name, '往返测试');
  assert.equal(loadJson.data.level, 25);
  assert.equal(loadJson.data.gold, 888);
  assert.equal(loadJson.data.playerId, playerId);
  assert.equal(loadJson.data.rings.length, 1);

  // 列表可见且 gameMode 正确
  const listRes = await fetch(base + '/api/player/list');
  const listJson = await listRes.json();
  const found = listJson.list.find(save => save.playerId === playerId);
  assert.ok(found, '存档应出现在列表中');
  assert.equal(found.gameMode, 'text-rpg');

  // 清理
  const delRes = await fetch(base + '/api/player/' + playerId, {
    method:'DELETE', headers:{ 'x-auth-token':token }
  });
  assert.equal(delRes.status, 200);
});
