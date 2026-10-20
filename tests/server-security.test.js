'use strict';

// 账号数据与 Token 密钥使用临时文件，避免测试注册污染真实 data/accounts.json。
const os = require('node:os');
process.env.ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || require('node:path').join(os.tmpdir(), `douluo-test-accounts-${process.pid}.json`);
process.env.TOKEN_SECRET_FILE = process.env.TOKEN_SECRET_FILE || require('node:path').join(os.tmpdir(), `douluo-test-secret-${process.pid}.key`);
// 生产默认关闭注册；测试借注册接口快速建号，单独用例再验证关闭时被拒。
process.env.ALLOW_REGISTER = '1';
process.env.RATE_LIMIT_AUTH = '200';

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

async function register(base, username, password){
  const response = await fetch(base + '/api/auth/register', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200, `注册 ${username} 应成功`);
  const json = await response.json();
  assert.equal(json.success, true);
  assert.ok(json.token);
  assert.equal(json.username, username);
  return json.token;
}

function authHeaders(token){
  return { 'x-auth-token': token };
}

test('账号体系：注册 / 登录 / 错误密码 / 重复注册', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  const username = '账号甲_' + Date.now().toString(36);

  // 参数校验
  const badUser = await fetch(base + '/api/auth/register', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username:'x', password:'pass1234' })
  });
  assert.equal(badUser.status, 400);

  const badPass = await fetch(base + '/api/auth/register', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username, password:'123' })
  });
  assert.equal(badPass.status, 400);

  // 正常注册
  const token = await register(base, username, 'pass1234');

  // 重复注册
  const duplicate = await fetch(base + '/api/auth/register', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username, password:'other123' })
  });
  assert.equal(duplicate.status, 409);

  // 错误密码登录
  const wrongPass = await fetch(base + '/api/auth/login', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username, password:'wrong-pass' })
  });
  assert.equal(wrongPass.status, 401);

  // 正确登录
  const loginRes = await fetch(base + '/api/auth/login', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username, password:'pass1234' })
  });
  assert.equal(loginRes.status, 200);
  const loginJson = await loginRes.json();
  assert.ok(loginJson.token);
  assert.equal(loginJson.username, username);
});

test('修改密码：验证原密码，修改后旧密码失效', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  const username = '改密账号_' + Date.now().toString(36);
  await register(base, username, 'oldpass1');

  async function login(password) {
    const res = await fetch(base + '/api/auth/login', {
      method:'POST', headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ username, password })
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  const first = await login('oldpass1');
  assert.equal(first.status, 200);

  // 原密码错误 → 403（不是 401，前端遇 401 会直接登出）
  const wrongOld = await fetch(base + '/api/auth/password', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(first.json.token) },
    body:JSON.stringify({ oldPassword:'not-the-password', newPassword:'newpass2' })
  });
  assert.equal(wrongOld.status, 403);

  // 新密码与原密码相同 → 400
  const sameAsOld = await fetch(base + '/api/auth/password', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(first.json.token) },
    body:JSON.stringify({ oldPassword:'oldpass1', newPassword:'oldpass1' })
  });
  assert.equal(sameAsOld.status, 400);

  // 正确修改
  const change = await fetch(base + '/api/auth/password', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(first.json.token) },
    body:JSON.stringify({ oldPassword:'oldpass1', newPassword:'newpass2' })
  });
  assert.equal(change.status, 200);
  assert.equal((await change.json()).success, true);

  // 旧密码失效，新密码可登录
  assert.equal((await login('oldpass1')).status, 401);
  assert.equal((await login('newpass2')).status, 200);

  // 未登录不能改密
  const unauth = await fetch(base + '/api/auth/password', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ oldPassword:'newpass2', newPassword:'newpass3' })
  });
  assert.equal(unauth.status, 401);
});

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

  // 未登录访问存档接口一律 401
  const unauthList = await fetch(base + '/api/player/list');
  assert.equal(unauthList.status, 401, '未登录不能读取存档列表');
  const unauthLoad = await fetch(base + '/api/player/load/p_safe-123');
  assert.equal(unauthLoad.status, 401, '未登录不能读取存档');

  // 登录后仍拦截非法 playerId（路径防护）
  const token = await register(base, '路径防护_' + Date.now().toString(36), 'pass1234');
  const traversal = await fetch(base + '/api/player/load/' + encodeURIComponent('../etc'), { headers: authHeaders(token) });
  assert.equal(traversal.status, 400);
  assert.deepEqual(await traversal.json(), { error:'存档 ID 无效' });

  const invalidSave = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ playerId:'../evil', data:{ name:'恶意' } })
  });
  assert.equal(invalidSave.status, 401, '所有写接口都必须先通过登录鉴权');

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
  const list = await fetch(base + '/api/player/list', { headers: authHeaders(token) });
  assert.equal(list.status, 200, '单个损坏存档不能拖垮列表');
  assert.equal((await list.json()).success, true);
});

test('账号隔离：A 的存档 B 不能读写，各账号列表只含本人存档', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  const suffix = Date.now().toString(36);
  const playerId = 'p_iso_' + suffix;
  const tokenA = await register(base, '账号A_' + suffix, 'pass1234');
  const tokenB = await register(base, '账号B_' + suffix, 'pass1234');

  // A 创建存档
  const saveRes = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(tokenA) },
    body:JSON.stringify({ playerId, data:{ name:'甲的角色', level:12, spirit:{ name:'昊天锤' }, gameMode:'text-rpg' } })
  });
  assert.equal(saveRes.status, 200);
  const saveJson = await saveRes.json();
  assert.equal(saveJson.success, true);
  t.after(() => {
    const f = getPlayerFile(playerId);
    if (f && fs.existsSync(f)) fs.unlinkSync(f);
  });

  // B 不能读取 / 写入 / 删除 A 的存档
  const bLoad = await fetch(base + '/api/player/load/' + playerId, { headers: authHeaders(tokenB) });
  assert.equal(bLoad.status, 403, 'B 不能读取 A 的存档');

  const bSave = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(tokenB) },
    body:JSON.stringify({ playerId, data:{ name:'乙的角色', level:99 }, expectVersion: saveJson.version })
  });
  assert.equal(bSave.status, 403, 'B 不能覆盖 A 的存档');

  const bDelete = await fetch(base + '/api/player/' + playerId, { method:'DELETE', headers: authHeaders(tokenB) });
  assert.equal(bDelete.status, 403, 'B 不能删除 A 的存档');

  // A 能读取，且列表只含本人存档
  const aLoad = await fetch(base + '/api/player/load/' + playerId, { headers: authHeaders(tokenA) });
  assert.equal(aLoad.status, 200);
  assert.equal((await aLoad.json()).data.name, '甲的角色');

  const aList = await (await fetch(base + '/api/player/list', { headers: authHeaders(tokenA) })).json();
  assert.ok(aList.list.some(item => item.playerId === playerId), 'A 的列表应包含自己的存档');
  const bList = await (await fetch(base + '/api/player/list', { headers: authHeaders(tokenB) })).json();
  assert.ok(!bList.list.some(item => item.playerId === playerId), 'B 的列表不应包含 A 的存档');

  // 乐观锁：A 用错误版本号写入 → 409，云端不被覆盖
  const conflictSave = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(tokenA) },
    body:JSON.stringify({ playerId, data:{ name:'甲的角色' }, expectVersion: saveJson.version + 99 })
  });
  assert.equal(conflictSave.status, 409);
  assert.equal((await conflictSave.json()).conflict, true);

  // 不携带 expectVersion 覆盖已有存档 → 409（乐观锁强制）
  const noVersionSave = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(tokenA) },
    body:JSON.stringify({ playerId, data:{ name:'甲的角色' } })
  });
  assert.equal(noVersionSave.status, 409, '已存在存档必须携带匹配版本号');

  // A 正常推进版本并删除
  const save2 = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(tokenA) },
    body:JSON.stringify({ playerId, data:{ name:'甲的角色', level:13 }, expectVersion: saveJson.version })
  });
  assert.equal(save2.status, 200);

  const delRes = await fetch(base + '/api/player/' + playerId, { method:'DELETE', headers: authHeaders(tokenA) });
  assert.equal(delRes.status, 200);
});

test('T27 服务器存档 save → load 往返一致（账号登录后）', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));

  const suffix = Date.now().toString(36);
  const playerId = 'p_roundtrip_' + suffix;
  const token = await register(base, '往返账号_' + suffix, 'pass1234');
  const payload = {
    playerId,
    data: {
      name:'往返测试', level:25, exp:123, gold:888,
      spirit:{ name:'昊天锤', tier:'top' },
      rings:[{ ringId:'yellow_ring', skill:'流光斩' }],
      gameMode:'text-rpg'
    }
  };
  const saveRes = await fetch(base + '/api/player/save', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(token) },
    body:JSON.stringify(payload)
  });
  assert.equal(saveRes.status, 200);
  const saveJson = await saveRes.json();
  assert.equal(saveJson.success, true);

  const loadRes = await fetch(base + '/api/player/load/' + playerId, { headers: authHeaders(token) });
  assert.equal(loadRes.status, 200);
  const loadJson = await loadRes.json();
  assert.equal(loadJson.success, true);
  assert.equal(loadJson.data.name, '往返测试');
  assert.equal(loadJson.data.level, 25);
  assert.equal(loadJson.data.gold, 888);
  assert.equal(loadJson.data.playerId, playerId);
  assert.equal(loadJson.data.owner, '往返账号_' + suffix);
  assert.equal(loadJson.data.rings.length, 1);

  // 列表可见且只属于当前账号
  const listRes = await fetch(base + '/api/player/list', { headers: authHeaders(token) });
  const listJson = await listRes.json();
  const found = listJson.list.find(save => save.playerId === playerId);
  assert.ok(found, '存档应出现在列表中');
  assert.equal(found.gameMode, 'text-rpg');

  // 清理
  const delRes = await fetch(base + '/api/player/' + playerId, {
    method:'DELETE', headers: authHeaders(token)
  });
  assert.equal(delRes.status, 200);
});

test('内测模式：未开放注册时注册接口一律 403', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));
  process.env.ALLOW_REGISTER = '0';
  t.after(() => { process.env.ALLOW_REGISTER = '1'; });
  const res = await fetch(base + '/api/auth/register', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username:'不该建成_' + Date.now().toString(36), password:'pass1234' })
  });
  assert.equal(res.status, 403);
});

test('登录连续输错 5 次后锁定，正确密码也要等锁定结束', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const username = '锁定账号_' + Date.now().toString(36);
  await register(base, username, 'right-pass');
  const attempt = password => fetch(base + '/api/auth/login', {
    method:'POST', headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ username, password })
  });
  for (let i = 0; i < 5; i++) assert.equal((await attempt('wrong-pass')).status, 401);
  assert.equal((await attempt('right-pass')).status, 429, '锁定期内正确密码也被拒');
});

test('改密后旧 Token 立即失效，改密响应换发的新 Token 可用', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const username = '换发账号_' + Date.now().toString(36);
  const oldToken = await register(base, username, 'first-pass');
  const change = await fetch(base + '/api/auth/password', {
    method:'POST', headers:{ 'content-type':'application/json', ...authHeaders(oldToken) },
    body:JSON.stringify({ oldPassword:'first-pass', newPassword:'second-pass' })
  });
  assert.equal(change.status, 200);
  const { token: newToken } = await change.json();
  assert.ok(newToken, '改密响应应携带新 Token');
  assert.equal((await fetch(base + '/api/player/list', { headers: authHeaders(oldToken) })).status, 401);
  assert.equal((await fetch(base + '/api/player/list', { headers: authHeaders(newToken) })).status, 200);
});

test('未归属账号的旧存档：任何登录用户都不能删除或查看历史', async t => {
  const { server, base } = await listen();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = await register(base, '越权账号_' + Date.now().toString(36), 'pass1234');
  const playerId = 'p_unowned_' + Date.now().toString(36);
  const file = getPlayerFile(playerId);
  fs.writeFileSync(file, JSON.stringify({ name:'无主旧档', gameMode:'text-rpg' }));
  t.after(() => fs.rmSync(file, { force:true }));
  const del = await fetch(base + '/api/player/' + playerId, { method:'DELETE', headers: authHeaders(token) });
  assert.equal(del.status, 403);
  assert.ok(fs.existsSync(file), '无主旧档不应被删除');
});
