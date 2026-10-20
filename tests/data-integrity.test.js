'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateProject } = require('../scripts/validate-data');

test('游戏数据、资源引用与魂环事件保持完整', () => {
  const root = path.resolve(__dirname, '..');
  const result = validateProject(root);
  assert.deepEqual(result.errors, [], result.errors.join('\n'));
  assert.ok(result.checkedJsonFiles >= 10, '应检查主要 JSON 数据文件');
  assert.equal(result.ringEventsChecked, 9, '应检查 9 个魂环获取事件');
  // 基线 350 = 348 + P0-B 新增 ml_bibi_omen / ml_bibi_hunt（比比东主线铺垫）；
  // 儿童版 +10 段主线（ms_*）= 360，总集合 528。后期地点事件（late_*）只在 Vue 端加载，旧轨校验不含。
  assert.equal(result.eventsChecked, 360, '应检查基础与扩展事件库');
  assert.equal(result.spiritEventsChecked, 168, '应检查全部武魂专属事件');
  assert.equal(result.unmappedEventLocations, 0, '所有具体事件地点都应映射到地图，或显式标记为全局地点');
  assert.equal(result.eventsChecked + result.spiritEventsChecked, 528, '最终事件集合应完整校验 528 个稳定 ID');
});
