'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRingBacklash, normalizeLegacyHealthResult, findRingChoiceResult, classifyEventLocation, previewDailySign, recordDailySign, levelCapForRings, advanceExperience, calculateDamage } = require('../public/game-rules');

test('魂环反噬对零风险、缺失字段和异常生命值始终返回有限数字', () => {
  for(const input of [
    [100, 80, 0], [100, 10, 45], [undefined, undefined, 20], [NaN, NaN, Infinity], [0, -10, -5]
  ]){
    const result = calculateRingBacklash(...input);
    for(const field of ['maxHp','currentHp','risk','damage','remainingHp']) assert.ok(Number.isFinite(result[field]), `${field} 应为有限数字`);
    assert.ok(result.remainingHp >= 1, '反噬后最低保留 1 HP');
    assert.ok(result.risk >= 0 && result.risk <= 100, '风险应收敛到 0~100');
  }
  assert.deepEqual(calculateRingBacklash(100, 10, 45), { maxHp:100, currentHp:10, risk:45, damage:42, remainingHp:1 });
});

test('旧事件生命字段统一为治疗或伤害，明确字段优先且不会重复结算', () => {
  assert.deepEqual(normalizeLegacyHealthResult({ hp: 20, exp: 5 }), { exp:5, heal:20 });
  assert.deepEqual(normalizeLegacyHealthResult({ hp: -8, exp: 5 }), { exp:5, damage:8 });
  assert.deepEqual(normalizeLegacyHealthResult({ hp: 20, heal:5, damage:2, maxHp:10 }), { heal:5, damage:2, maxHp:10 });
});

test('魂兽选项返回正确奖励和选项索引', () => {
  const choices = [
    { text:'猎杀百年独眼狼', result:{ attack:2 } },
    { text:'猎杀百年烈焰虎', result:{ heal:15 } },
    { text:'猎杀百年风灵燕', result:{ speed:2 } }
  ];
  const selected = findRingChoiceResult(choices, { id:'烈焰虎', name:'百年烈焰虎' });
  assert.deepEqual(selected, { result:{ heal:15 }, index:1 });
  assert.equal(findRingChoiceResult(choices, { id:'missing', name:'未知魂兽' }), null);
});

test('具体事件地点、全局地点和未知地点会被明确区分', () => {
  const map = [
    { id:'shrek_academy', name:'史莱克学院' },
    { id:'star_duo_outer', name:'星斗大森林外围' },
    { id:'sky_city', name:'天空之城' }
  ];
  assert.deepEqual(classifyEventLocation('史莱克学院·食堂', map), { scope:'mapped', id:'shrek_academy' });
  assert.deepEqual(classifyEventLocation('荒山野岭', map), { scope:'mapped', id:'star_duo_outer' });
  assert.deepEqual(classifyEventLocation('神界之门', map), { scope:'mapped', id:'sky_city' });
  assert.deepEqual(classifyEventLocation('闭关修炼', map), { scope:'global', id:null });
  assert.deepEqual(classifyEventLocation('完全不存在的地点', map), { scope:'unknown', id:null });
});

test('魂环门槛会暂存经验，获得魂环后可释放暂存经验', () => {
  assert.equal(levelCapForRings(0), 10);
  assert.equal(levelCapForRings(8), 90);
  assert.equal(levelCapForRings(9), 100);
  const capped = advanceExperience({ level:9, exp:0, ringCount:0 }, 150, () => 100);
  assert.deepEqual(capped, { level:10, exp:0, overflowExp:50, levels:[10], capped:true });
  const released = advanceExperience({ level:10, exp:0, overflowExp:50, ringCount:1 }, 0, () => 100);
  assert.deepEqual(released, { level:10, exp:50, overflowExp:0, levels:[], capped:false });
});

test('签到支持相邻日连续、断签重置、同日幂等和累计30天', () => {
  let sign = {};
  let today = '2026-01-01';
  let result = recordDailySign(sign, today);
  assert.equal(result.changed, true);
  sign = result.sign;
  assert.equal(sign.cycleDay, 1);
  assert.equal(sign.totalDays, 1);

  result = recordDailySign(sign, today);
  assert.equal(result.changed, false, '同一天不能重复签到');
  assert.equal(result.sign.totalDays, 1);

  result = recordDailySign(sign, '2026-01-02');
  sign = result.sign;
  assert.equal(sign.cycleDay, 2);
  assert.equal(sign.maxStreak, 2);

  result = recordDailySign(sign, '2026-01-05');
  sign = result.sign;
  assert.equal(sign.cycleDay, 1, '断签后当前连续天数重置');
  assert.equal(sign.totalDays, 3, '断签不重置累计天数');
  assert.equal(sign.maxStreak, 2, '最长连续天数保留');

  for(let day = 6; day <= 32; day++){
    const date = new Date(2026, 0, day, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    sign = recordDailySign(sign, key).sign;
  }
  assert.equal(sign.totalDays, 30);
  assert.equal(previewDailySign(sign, sign.lastDate).signedToday, true);
});

test('T27 伤害公式：范围、穿透、保底与倍率', () => {
  // 保底：任何输入伤害 ≥ 1
  for(let i = 0; i < 50; i++) assert.ok(calculateDamage(0, 9999) >= 1, '伤害至少为 1');
  for(let i = 0; i < 50; i++) assert.ok(calculateDamage(5, 9999, { penetration:0.8 }) >= 1);
  // 无随机波动上限：attack 100 vs defense 0 → base ∈ [88, 112]
  let maxSeen = 0, minSeen = Infinity;
  for(let i = 0; i < 200; i++){
    const dmg = calculateDamage(100, 0);
    maxSeen = Math.max(maxSeen, dmg); minSeen = Math.min(minSeen, dmg);
  }
  assert.ok(maxSeen <= 112, `上限应 ≤112，实际 ${maxSeen}`);
  assert.ok(minSeen >= 88, `下限应 ≥88，实际 ${minSeen}`);
  // 穿透：比较相同随机样本，避免两次独立波动让断言偶发反转。
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.5;
    const noPen = calculateDamage(100, 60);
    const pen = calculateDamage(100, 60, { penetration:0.5 });
    assert.ok(pen > noPen, '穿透应提高伤害');
  } finally {
    Math.random = originalRandom;
  }
  // 倍率：×2 后伤害区间应为 [176, 224]（随机波动同步放大）
  let min2 = Infinity, max2 = 0;
  for(let i = 0; i < 200; i++){
    const d = calculateDamage(100, 0, { multiplier:2 });
    min2 = Math.min(min2, d); max2 = Math.max(max2, d);
  }
  assert.ok(max2 <= 224 && min2 >= 176, `倍率 2 应在 [176,224]，实际 [${min2}, ${max2}]`);
  // 异常输入收敛为有限数字
  assert.ok(Number.isFinite(calculateDamage(NaN, NaN, { penetration: 9 })), '异常输入应收敛为有限数字');
});
