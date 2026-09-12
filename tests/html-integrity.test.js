'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'legacy', 'game.html'), 'utf8');
const game = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'legacy', 'game.js'), 'utf8');
const visual = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'legacy', 'game-visual.js'), 'utf8');

test('正式文字 RPG HTML 不含重复 ID，关键引导目标存在', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
  for(const id of ['status-panel','scene-area','rings-row','story-status','ring-status','btn-bag','btn-save','btn-settings','tutorial-overlay','level-notifications']){
    assert.ok(ids.includes(id), `缺少 #${id}`);
  }
  assert.equal(ids.filter(id => id === 'btn-shop').length, 1);
});

test('保留无限重新觉醒并移除突发命运抉择触发器', () => {
  assert.match(game, /redraws:\s*Infinity/);
  assert.doesNotMatch(game, /function\s+maybeTriggerStoryDecision/);
  assert.doesNotMatch(game, /function\s+triggerStoryDecision/);
  assert.doesNotMatch(game, /openModal\('✦ 等级提升/);
});

test('开场动画可立即跳过且完整动画只在首次访问播放', () => {
  assert.match(html, /<button[^>]+id="ci-skip"[^>]+aria-label="跳过开场动画"/);
  assert.match(visual, /localStorage\.getItem\('dldl_intro_seen_v2'\)/);
  assert.match(visual, /skipBtn\.classList\.add\('show'\)/);
});

test('早年剧情不向玩家暴露内部英文阶段值', () => {
  assert.match(game, /EARLY_STAGE_LABELS/);
  assert.match(game, /esc\(stageLabel\)/);
  assert.doesNotMatch(game, /esc\(node\.stage\)/);
});

test('音频快捷键与帮助口径一致', () => {
  assert.match(visual, /e\.key === 'v'.*AudioFX\.toggle\(\)/s);
  assert.match(game, /<kbd>V<\/kbd><span>静音或恢复音频<\/span>/);
  assert.doesNotMatch(game, /case 'm':[^\n]*AudioFX/);
});
