'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const combat = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'game-combat.js'), 'utf8');
const game = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'game.js'), 'utf8');
const userSave = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data', 'player_p_ms7sj4lkedoo7.json'), 'utf8'));

test('魂兽战斗胜利回调必须清理结束状态并继续魂环结算', () => {
  const callbackBlock = combat.slice(combat.indexOf("if(typeof onVictory === 'function')"), combat.indexOf("const resultText", combat.indexOf("if(typeof onVictory === 'function')")));
  assert.match(callbackBlock, /state\s*=\s*null/);
  assert.match(callbackBlock, /onVictory\(enemy, gains\)/);
  assert.doesNotMatch(callbackBlock, /if\(state === current\)/);
  assert.match(game, /onVictory:\(\) => resolveRingAbsorption\(ev, ringId, beast, tierOpt, displayChoiceIndex\)/);
  assert.match(combat, /deferResult:Boolean\(event && event\.ring\)/);
  assert.match(combat, /!state\.options\.deferResult/);
  assert.match(combat, /ringEvent.*_ringHuntDeferredUntil/s);
  assert.match(game, /red:'hundred_thousand'/);
  assert.match(game, /hundred_thousand:\s*'red_ring'/);
  assert.match(game, /recordedChoiceIndex/);
  assert.match(game, /selectedResult\.text.*ringLabel/s);
  assert.match(game, /tier === 'red' && cfg\.rec === 'black'/);
  assert.match(game, /MAIN_STORY_MILESTONES/);
  assert.match(game, /renderMainStoryTravelGuide/);
  assert.match(combat, /failedEvent && failedEvent\._mainStory/);
  assert.match(game, /if\(seen\.has\(ev\.id\)\) throw new Error/);
  assert.doesNotMatch(game, /ev\.id\s*=\s*count\s*\?/);
  assert.match(game, /ParticleEngine\.emit\('holyBurst'/);
  assert.doesNotMatch(game, /ParticleEngine\.burst\(/);
});

test('gyc 11 级存档仍保留原始用户记录', () => {
  assert.equal(userSave.name, 'gyc');
  assert.equal(userSave.level, 11);
  assert.equal(userSave.playerId, 'p_ms7sj4lkedoo7');
  assert.equal(userSave.rings.length, 1);
  assert.equal(userSave.spirit.name, '邪火凤凰');
});
