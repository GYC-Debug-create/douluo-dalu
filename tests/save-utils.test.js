'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CURRENT_SAVE_VERSION, migrateSave, isValidSave, recoverFromStorage } = require('../public/legacy/save-utils');

test('旧存档迁移到当前版本并补齐新增字段', () => {
  const migrated = migrateSave({ name:'测试魂师', spirit:'蓝银草', level:5 });
  assert.equal(migrated._saveVersion, CURRENT_SAVE_VERSION);
  assert.deepEqual(migrated.inventory, []);
  assert.deepEqual(migrated.battleStats, { wins:0, losses:0, kills:0 });
  assert.deepEqual(migrated._storyPath, []);
  assert.equal(migrated._ringHuntDeferredUntil, 0);
  assert.equal(migrated._mainStoryVersion, 0, '旧存档不应被强制倒放早期主线');
  assert.equal(migrated._storyMilestoneDeferredUntil, 0);
});

test('存档核心字段无效时拒绝读取', () => {
  assert.equal(isValidSave({ name:'', spirit:'蓝银草', level:1 }), false);
  assert.equal(isValidSave({ name:'魂师', spirit:'蓝银草', level:0 }), false);
});

test('主存档损坏时恢复有效备份', () => {
  const storage = {
    getItem(key){ return key.endsWith('_backup') ? JSON.stringify({ name:'备份魂师', spirit:'昊天锤', level:8 }) : '{损坏'; }
  };
  const result = recoverFromStorage(storage, 'save');
  assert.equal(result.source, 'backup');
  assert.equal(result.data.name, '备份魂师');
  assert.equal(result.data._saveVersion, CURRENT_SAVE_VERSION);
});

test('备份损坏时继续尝试历史备份链', () => {
  const values = {
    save:'{坏主档', save_backup:'{坏备份',
    save_hist1:JSON.stringify({ name:'历史魂师', spirit:{ name:'九宝琉璃塔' }, level:18 })
  };
  const result = recoverFromStorage({ getItem:key => values[key] || null }, 'save');
  assert.equal(result.source, 'history-1');
  assert.equal(result.data.name, '历史魂师');
});

test('魂环与魂技迁移保持同名，并隔离异常多余记录', () => {
  const migrated = migrateSave({
    name:'错名魂师', spirit:{ name:'武魂' }, level:50,
    rings:[
      { ringId:'yellow_ring', skill:'流光斩', name:'百年魂环', source:'独眼狼', skillDef:{ damage:40, cost:10, cooldown:2 } },
      { ringId:'purple_ring', skill:'震岳击', name:'千年魂环', source:'铁甲熊' }
    ],
    skills:[{ name:'烈焰斩', damage:99 }, { name:'旧技能' }, { name:'无归属技能' }]
  });
  assert.equal(migrated.rings.length, 2);
  assert.equal(migrated.skills.length, 2);
  assert.equal(migrated.skills[0].name, '流光斩');
  assert.equal(migrated.skills[0].ring, 1);
  assert.equal(migrated.skills[0].skillId, migrated.rings[0].skillId);
  assert.equal(migrated._orphanedSkills.length, 1);
  assert.ok(migrated._saveIntegrityWarnings.some(warning => warning.includes('无魂环归属')));
});

test('旧格式字符串魂环也会迁移为安全对象', () => {
  const migrated = migrateSave({
    name:'字符串旧档', spirit:{ name:'武魂' }, level:10,
    rings:['十年魂环'], skills:['旧魂技']
  });
  assert.equal(migrated.rings[0].skill, '十年魂环');
  assert.equal(migrated.skills[0].name, '十年魂环');
  assert.ok(migrated._saveIntegrityWarnings.some(warning => warning.includes('格式异常')));
});

test('BUG-DIALOG-014 旧档魂环内部键统一迁移为中文且魂技保持同名', () => {
  const migrated = migrateSave({
    name:'内部键旧档', spirit:{ name:'铁锤' }, level:12,
    rings:[{
      ringId:'white_ring', name:'十年魂环', source:'spirit_deer_ten',
      skill:'spirit_deer_ten魂技', beastId:'spirit_deer_ten', year:10,
      skillDef:{ damage:42, cost:15, cooldown:3 }
    }],
    skills:[{ name:'spirit_deer_ten魂技', source:'spirit_deer_ten', damage:42, cost:15, cooldown:3 }]
  });
  assert.equal(migrated.rings[0].source, '灵鹿');
  assert.equal(migrated.rings[0].skill, '灵鹿魂技');
  assert.equal(migrated.rings[0].beastId, '灵鹿');
  assert.equal(migrated.skills[0].name, '灵鹿魂技');
  assert.equal(migrated.skills[0].source, '灵鹿');
  assert.equal(migrated.skills[0].damage, 42);
});

test('BUG-DIALOG-015 旧档按真实等级和魂环数恢复猎环目标', () => {
  const make = (level, rings) => migrateSave({
    name:`Lv${level}旧档`, spirit:{ name:'铁锤' }, level,
    rings:rings || [], skills:(rings || []).map(ring => ({ name:ring.skill }))
  });
  assert.equal(make(9).pendingRingLv, null);
  assert.equal(make(10).pendingRingLv, 10);
  assert.equal(make(12).pendingRingLv, 10);
  assert.equal(make(12, [{ name:'十年魂环', skill:'灵鹿魂技' }]).pendingRingLv, null);
  assert.equal(make(20, [{ name:'十年魂环', skill:'灵鹿魂技' }]).pendingRingLv, 20);
});

test('异常超过九环的旧档只保留正式魂环并记录警告', () => {
  const rings = Array.from({ length: 11 }, (_, index) => ({ skill:`魂技${index + 1}`, name:`魂环${index + 1}` }));
  const migrated = migrateSave({ name:'异常旧档', spirit:{ name:'武魂' }, level:100, rings, skills:rings.map(ring => ({ name:ring.skill })) });
  assert.equal(migrated.rings.length, 9);
  assert.equal(migrated.skills.length, 9);
  assert.equal(migrated._legacyRingOverflow.length, 2);
  assert.ok(migrated._saveIntegrityWarnings.some(warning => warning.includes('11个魂环')));
});

test('旧高等级存档迁移时跳过新增新手叙事', () => {
  const migrated = migrateSave({
    name:'旧高等级魂师', spirit:{ name:'武魂' }, level:100,
    _saveVersion:7, _progressionRulesVersion:1,
    _earlyLifeDone:false, _firstClassDone:false,
    rings:[{ skill:'魂技一', name:'十年魂环' }], skills:[{ name:'旧名称' }],
    doneEvents:['dyn_old_1','dyn_old_2','dyn_old_3']
  });
  assert.equal(migrated._prologueDone, true);
  assert.equal(migrated._earlyLifeDone, true);
  assert.equal(migrated._enrollmentComplete, true);
  assert.equal(migrated._firstClassDone, true);
  assert.equal(migrated._introPendingEvent, null);
});

test('未开始的新档不会被旧档迁移规则提前标记完成', () => {
  const migrated = migrateSave({ name:'新手魂师', spirit:{ name:'武魂' }, level:1, _saveVersion:8, _progressionRulesVersion:2 });
  assert.equal(migrated._prologueDone, false);
  assert.equal(migrated._earlyLifeDone, false);
  assert.equal(migrated._firstClassDone, false);
});

test('地点、签到、技能树和魂骨迁移幂等', () => {
  const legacy = {
    name:'旧档魂师', spirit:{ name:'昊天锤' }, level:20, gold:300,
    _currentLocation:'slk_academy', completedEvents:['old_event'], doneEvents:['new_event'],
    _dailySign:{ date:'2026-01-01', streak:3 }, _skillTree:['offense_1','defense_1'],
    _bones:['骨A','骨B'], _forgeBones:[]
  };
  const once = migrateSave(legacy);
  const twice = migrateSave(once);
  assert.equal(once._currentLocation, 'shrek_academy');
  assert.deepEqual(once.doneEvents, ['new_event','old_event']);
  assert.equal(once._dailySign.totalDays, 3);
  assert.deepEqual(once._skillTree, { offense_1:true, defense_1:true });
  assert.equal(once._forgeBones.length, 2);
  assert.equal(twice._forgeBones.length, 2, '重复迁移不得重复补发魂骨碎片');
  assert.equal(twice._totalGoldEarned, 300);
});
