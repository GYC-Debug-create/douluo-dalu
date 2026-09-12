'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'public', 'legacy', 'game.js'), 'utf8');
const combat = fs.readFileSync(path.join(root, 'public', 'legacy', 'game-combat.js'), 'utf8');
const { migrateSave, isValidSave, recoverFromStorage } = require('../public/legacy/save-utils');
const { advanceExperience } = require('../public/legacy/game-rules');

// ---------- P0-01：保存 → 回标题 → 继续 → 刷新 → 再继续（数据层回归） ----------
test('P0-01 保存后继续冒险：存档写入后可反复恢复同一角色（含刷新）', () => {
  const store = new Map();
  const storage = {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  };
  const player = migrateSave({
    name:'回归魂师', spirit:{ name:'蓝电霸王龙' }, level:6, gold:520,
    playerId:'p_regression_01', _currentLocation:'star_duo_outer',
    exp:86, hp:180, origin:'border_town', originName:'天斗帝国边境小城',
    rings:[], _visitedLocations:['shrek_academy'], doneEvents:['first_hunt']
  });

  // 第一次保存（写主档 + 备份链）
  storage.setItem('dldl_text_rpg_save', JSON.stringify(player));
  storage.setItem('dldl_text_rpg_save_backup', JSON.stringify(player));

  // 回标题后“继续冒险”：从恢复链读取
  const first = recoverFromStorage(storage, 'dldl_text_rpg_save');
  assert.equal(first.source, 'main');
  assert.equal(first.data.playerId, 'p_regression_01');
  assert.equal(first.data.name, '回归魂师');
  assert.equal(first.data.level, 6);
  assert.equal(first.data.gold, 520);
  assert.equal(first.data._currentLocation, 'star_duo_outer');
  assert.equal(first.data.doneEvents.includes('first_hunt'), true);

  // 模拟刷新页面后再次“继续冒险”
  const second = recoverFromStorage(storage, 'dldl_text_rpg_save');
  assert.equal(second.data.playerId, 'p_regression_01');
  assert.equal(second.data.name, '回归魂师');
  assert.equal(second.data.level, 6);
  assert.equal(second.data.gold, 520);
  assert.deepEqual(second.data.rings, []);
  // 名字/等级/金币/位置/魂环/剧情一致
  assert.equal(second.data._currentLocation, first.data._currentLocation);
  assert.deepEqual(second.data.doneEvents, first.data.doneEvents);

  // 主档损坏时仍能从备份恢复同一角色
  store.set('dldl_text_rpg_save', '{损坏');
  const recovered = recoverFromStorage(storage, 'dldl_text_rpg_save');
  assert.equal(recovered.source, 'backup');
  assert.equal(recovered.data.playerId, 'p_regression_01');
});

test('P0-01 迁移保留 playerId 与地点别名归一', () => {
  const legacy = migrateSave({
    name:'旧档', spirit:{ name:'昊天锤' }, level:10, id:'old_id_1',
    _currentLocation:'星斗大森林·外围'
  });
  assert.equal(legacy.playerId, 'old_id_1');
  assert.equal(legacy._currentLocation, 'star_duo_outer');
  const legacy2 = migrateSave({
    name:'旧档2', spirit:{ name:'昊天锤' }, level:10,
    _currentLocation:'星斗大森林深处'
  });
  assert.equal(legacy2._currentLocation, 'star_duo_deep');
});

test('P0-01 字符串 _personality/_destiny 旧档迁移为对象，避免继续冒险中断', () => {
  const legacy = migrateSave({
    name:'字符串旧档', spirit:{ name:'昊天锤' }, level:12,
    _personality:'勇敢', _destiny:'逆天改命'
  });
  assert.equal(typeof legacy._personality, 'object');
  assert.ok(Array.isArray(legacy._personality.traits) && legacy._personality.traits.includes('勇敢'));
  assert.equal(typeof legacy._destiny, 'object');
  assert.equal(legacy._destiny.name, '逆天改命');
  // 迁移幂等：再次迁移不破坏
  const twice = migrateSave(legacy);
  assert.equal(typeof twice._personality, 'object');
  assert.equal(twice._destiny.name, '逆天改命');
});

// ---------- P1-03：地点名称统一 ----------
test('P1-03 事件地点统一使用稳定基名（星斗大森林外围/深处）', () => {
  const expanded = fs.readFileSync(path.join(root, 'public', 'legacy', 'game-events-expanded.js'), 'utf8');
  const base = fs.readFileSync(path.join(root, 'public', 'legacy', 'game-data.js'), 'utf8');
  const source = base + '\n' + expanded;
  // 不允许残留“星斗大森林·外围/深处/边缘”等旧变体写法
  assert.doesNotMatch(source, /星斗大森林·深处/);
  assert.doesNotMatch(source, /星斗大森林·外围/);
  assert.doesNotMatch(source, /星斗大森林边缘/);
  // 子区域必须以稳定基名开头
  const variants = [...source.matchAll(/location\s*:\s*'([^']*星斗大森林[^']*)'/g)].map(m => m[1]);
  for(const variant of variants){
    assert.ok(
      variant.startsWith('星斗大森林外围') || variant.startsWith('星斗大森林深处') || variant.startsWith('星斗小村'),
      `地点变体应使用稳定基名：${variant}`
    );
  }
  // 地图数据 id 与显示名一致
  const mapData = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'map-data.json'), 'utf8'));
  const outer = mapData.locations.find(loc => loc.id === 'star_duo_outer');
  assert.equal(outer.name, '星斗大森林外围');
  // 地点百科包含深处条目（修复图片 404 与详情缺失）
  const codex = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'location-codex.json'), 'utf8'));
  assert.ok(codex.locations.some(loc => loc.id === '星斗大森林深处'), '地点百科应包含星斗大森林深处');
});

// ---------- P1-05：觉醒预览与确认属性一致 ----------
test('P1-05 预览与最终属性调用同一基础属性函数', () => {
  assert.match(game, /function calcBaseStats\(/);
  const preview = game.slice(game.indexOf('function previewStats('), game.indexOf('function finalStats('));
  assert.match(preview, /const base = calcBaseStats\(/, 'previewStats 应调用统一 calcBaseStats');
  assert.match(preview, /origin\.stats/, 'previewStats 应传入出身加成');
  const final = game.slice(game.indexOf('function finalStats('), game.indexOf('function flashStat('));
  assert.match(final, /calcBaseStats\(G\.spiritBase, G\.originBonus, lv, G\.weapon\)/, 'finalStats 应调用统一 calcBaseStats');
});

// ---------- P1-06：满血不消耗治疗道具 ----------
test('P1-06 满血使用恢复道具不扣数量（战斗内外一致）', () => {
  const useItemBlock = game.slice(game.indexOf('function useItem('), game.indexOf('function openInventory('));
  assert.match(useItemBlock, /heal <= 0\)\{\s*toast\('当前生命已满，无需恢复。'\);\s*return;/, '非战斗满血应提示并提前返回');
  assert.match(useItemBlock, /if\(used\)\{\s*it\.count--/, '仅在真正使用时才扣减数量');
  const combatItemBlock = combat.slice(combat.indexOf("if(item.type === 'heal'"), combat.indexOf('item.count--'));
  assert.match(combatItemBlock, /healed <= 0\)\{[^}]*return;/, '战斗内满血应提示并提前返回');
});

// ---------- P1-08：经验明细与合计 ----------
test('P1-08 跨等级经验结算：前值 + 各项 = 后值（含溢出）', () => {
  // 经验 86/255 场景：前值(累计) + 94 = 后值(累计)
  const need = level => Math.round(40 * Math.pow(level, 1.15));
  const cumulative = (level, exp) => {
    let total = exp;
    for(let i = 1; i < level; i++) total += need(i);
    return total;
  };
  const before = cumulative(5, 86);
  const result = advanceExperience({ level:5, exp:86, ringCount:0 }, 94, need);
  const after = cumulative(result.level, result.exp) + (result.overflowExp || 0);
  assert.equal(after, before + 94, '累计经验变化必须等于发放值');
  // 跨等级：升级前后等级差可见
  const big = advanceExperience({ level:5, exp:86, ringCount:1 }, 800, need);
  assert.ok(big.level > 5, '大量经验应触发升级');
  assert.equal(cumulative(big.level, big.exp), cumulative(5, 86) + 800, '跨级后累计经验仍守恒');
});

test('P1-08 奖励结果结构化：总计字段与展示明细', () => {
  // applyResultRewards 返回结构化对象，结果页有总计行
  assert.match(game, /const summary = \{\s*list: gains,/, 'applyResultRewards 应返回结构化奖励结果');
  assert.match(game, /function renderRewardSummary\(reward\)/, '结果页应有奖励汇总渲染函数');
  assert.match(game, /奖励总计：/, '汇总行应包含“奖励总计”');
  const victoryBlock = combat.slice(combat.indexOf('const resultText ='), combat.indexOf('renderEnd(\'战斗胜利\''));
  assert.match(victoryBlock, /奖励总计/, '战斗结果页应显示总计');
  // 事件结果页在任务/成就结算后再渲染，保证总计=实际变化
  const applyChoiceBlock = game.slice(game.indexOf('function applyChoice('), game.indexOf('function addItem('));
  assert.ok(applyChoiceBlock.indexOf('renderRewardSummary(reward)') > applyChoiceBlock.indexOf('checkQuests();'), '事件结果应先结算任务/成就再渲染明细');
});

// ---------- P1-09：新手引导安全时机与稍后再看 ----------
test('P1-09 引导可跳过、稍后再看且不反复弹出', () => {
  assert.match(game, /class="tut-later">稍后再看/, '引导应提供“稍后再看”');
  assert.match(game, /G\._tutorialPostponed = true/, '稍后再看应记录推迟标记');
  assert.match(game, /function shouldShowTutorial/, '存在引导触发判断');
  const showBlock = game.slice(game.indexOf('function shouldShowTutorial'), game.indexOf('// ==================== 修炼系统'));
  assert.match(showBlock, /_tutorialPostponed/, '触发判断应尊重稍后再看标记');
  assert.match(showBlock, /dldl_tutorial_done/, '跳过应写完成标记');
});

// ---------- P1-10：NPC 结识提示只出现一次 ----------
test('P1-10 NPC 结识幂等：已结识不重复提示', () => {
  const meetBlock = game.slice(game.indexOf('function meetNpc('), game.indexOf('function openBoneCodex'));
  assert.match(meetBlock, /if\(!G\._metNpcs\.includes\(npcId\)\)/, '已结识 NPC 不应重复写入');
});

// ---------- P1-11：顶部菜单自动收起 ----------
test('P1-11 点击菜单项与旅行完成后自动收起顶部菜单', () => {
  assert.match(game, /item\.addEventListener\('click', \(\) => \{\s*if\(item\.tagName !== 'SUMMARY'\) d\.removeAttribute\('open'\)/, '点击菜单项后应自动收起');
  assert.match(game, /旅行完成后自动收起顶部菜单[\s\S]*?details\.top-group\[open\]/, '旅行完成后应自动收起菜单');
});

// ---------- P1-12：出身世界状态 ----------
test('P1-12 出身稳定保存并在面板/日记显示', () => {
  assert.match(game, /origin:\s*o\.id,/, 'createPlayer 应保存出身 ID');
  assert.match(game, /originName:\s*o\.fullName/, 'createPlayer 应保存出身显示名');
  assert.match(game, /<span class="sd-label">出身<\/span>/, '统计面板应显示出身');
  assert.match(game, /出身：/, '日记应显示出身');
});

// ---------- P2-17：隐藏地点线索 ----------
test('P2-17 隐藏地点提供玩家可理解线索并在帮助页展示', () => {
  assert.match(game, /clue:'传闻星斗大森林外围/, '隐藏地点应包含线索字段');
  assert.match(game, /HIDDEN_LOCATIONS\.map\(h => \{[\s\S]*?found \? esc\(h\.desc\) : esc\(h\.clue\)/, '帮助页应展示线索或已发现描述');
});

// ---------- P2-18：魂骨内部字段不直接展示 ----------
test('P2-18 魂骨图鉴不直接展示内部 tier 值', () => {
  const codex = fs.readFileSync(path.join(root, 'public', 'legacy', 'codex.html'), 'utf8');
  const boneMetaLine = (codex.match(/if\(currentCodex === 'bone'\)\s+return `[^`]*`/) || [''])[0];
  assert.doesNotMatch(boneMetaLine, /esc\(it\.tier\)/, 'codex.html 卡片不应直接输出内部 tier');
  assert.match(boneMetaLine, /boneTierName\(it\.tier\)/, 'codex.html 应使用中文品级映射');
  const boneChip = (codex.match(/<div class="card-traits"><span class="trait-chip" style="color:\$\{color\}">\$\{esc\(boneTierName\(it\.tier\)\)\}<\/span><\/div>/) || [''])[0];
  assert.ok(boneChip, '魂骨卡片特性标签应显示中文品级');
  const boneDetail = (codex.match(/<div class="modal-subtitle">\$\{esc\(it\.type \|\| ''\)\} · \$\{esc\(boneTierName\(it\.tier\)\)\} · 来源/) || [''])[0];
  assert.ok(boneDetail, '魂骨详情副标题应显示中文品级');
  const gameBone = game.slice(game.indexOf('const BONE_TIER_NAMES'), game.indexOf('function openBoneCodex'));
  assert.match(gameBone, /epic:'史诗魂骨'/, '游戏内应有 epic→史诗 映射');
  assert.match(gameBone, /legendary:'传说魂骨'/, '游戏内应有 legendary→传说 映射');
  assert.match(gameBone, /divine:'神级魂骨'/, '游戏内应有 divine→神级 映射');
  assert.match(game, /已收集 \$\{collected\}\/\$\{bones\.length\} 块魂骨/, '图鉴应说明收集数与总数');
  assert.match(game, /获取条件：/, '未收集魂骨应显示获取条件');
});

// ---------- P3-19：开场跳过即时生效 ----------
test('P3-19 开场跳过按钮即时生效', () => {
  const visual = fs.readFileSync(path.join(root, 'public', 'legacy', 'game-visual.js'), 'utf8');
  assert.match(visual, /ci-skip/, '电影开场应存在跳过按钮');
  assert.match(visual, /click.*skip/, '跳过按钮应绑定点击');
  const skipBlock = visual.slice(visual.indexOf('function skip'), visual.indexOf('function skip') + 600);
  assert.match(skipBlock, /finish\(\)/, '跳过应立即完成开场');
  const html = fs.readFileSync(path.join(root, 'public', 'legacy', 'game.html'), 'utf8');
  assert.match(html, /id="ci-skip"/, 'game.html 应包含跳过按钮');
});
