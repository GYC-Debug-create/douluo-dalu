'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { richText, plainText } = require('../public/game-rules');

const root = path.resolve(__dirname, '..');

// ---------- richText 白名单：仅恢复 <br> 与 color:#hex span ----------
test('richText 恢复白名单标签 <br> 与 <span style="color:#hex">', () => {
  const html = richText('第一行<br><br><span style="color:#7fc48c">绿色文字</span>结束');
  assert.equal(html, '第一行<br><br><span style="color:#7fc48c">绿色文字</span>结束');
});

test('richText 拦截脚本、事件属性与未知样式注入', () => {
  assert.equal(richText('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(richText('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(richText('<span onclick="x()">hi</span>'), '&lt;span onclick=&quot;x()&quot;&gt;hi</span>');
  assert.equal(richText('<span style="color:red">hi</span>'), '&lt;span style=&quot;color:red&quot;&gt;hi</span>');
  assert.equal(
    richText('<span style="color:#7fc48c;background:url(javascript:1)">hi</span>'),
    '&lt;span style=&quot;color:#7fc48c;background:url(javascript:1)&quot;&gt;hi</span>'
  );
});

test('richText 对无标签文本保持原样', () => {
  assert.equal(richText('达到 Lv.10 后可正式猎取第一魂环。'), '达到 Lv.10 后可正式猎取第一魂环。');
});

// ---------- plainText：纯文本场景 ----------
test('plainText 剥离全部标签并将 <br> 转为换行', () => {
  assert.equal(plainText('第一行<br><br><span style="color:#7fc48c">绿色</span>'), '第一行\n\n绿色');
  assert.equal(plainText('<script>alert(1)</script>'), 'alert(1)');
});

// ---------- 数据侧：实战训练事件的三条结果文本 ----------
test('实战训练结果文本经 richText 后不再出现字面量标签', () => {
  const gameData = fs.readFileSync(path.join(root, 'public', 'game-data.js'), 'utf8');
  const matches = gameData.match(/result: \{ text: '[^']*<[^']*'/g) || [];
  assert.ok(matches.length >= 3, '应能找到带 HTML 的结果文本');
  for(const m of matches){
    const text = m.replace(/^result: \{ text: '|'$/g, '');
    const safe = richText(text);
    assert.ok(!safe.includes('&lt;br'), `换行标签应被恢复: ${text}`);
    assert.ok(!safe.includes('&lt;span'), `span 标签应被恢复: ${text}`);
    assert.ok(!safe.includes('<script>'), '不得恢复脚本标签');
  }
});

// ---------- 渲染点接入断言：防止回归为 fmt 全量转义 ----------
test('结果文本渲染点已接入白名单富文本（game.js / game-combat.js）', () => {
  const game = fs.readFileSync(path.join(root, 'public', 'game.js'), 'utf8');
  const combat = fs.readFileSync(path.join(root, 'public', 'game-combat.js'), 'utf8');
  assert.match(game, /renderContinue\(ev, `\$\{richText\(resolvedResult\.text\)\}\$\{renderRewardSummary\(reward\)\}`/);
  assert.match(game, /addDiaryEntry\(`经历事件「\$\{ev\.name\}」：\$\{plainText\(/);
  assert.match(combat, /safeRichText\(state\.options\.result\.text\)/);
});
