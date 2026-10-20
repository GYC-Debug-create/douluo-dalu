/**
 * 斗罗大陆·武魂觉醒 —— 游戏规则（纯逻辑层）
 * 从 game-rules.js 迁移为 ES 模块，逻辑 100% 不变。
 */

'use strict';

import { ACTIONS_PER_SEASON } from './time-rules.js'
export { ACTIONS_PER_DAY, ACTIONS_PER_SEASON, travelDurationDays, travelDurationTicks } from './time-rules.js'

export function finiteNumber(value, fallback){
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// 兼容旧事件：hp 曾同时承担"当前生命变化"的含义。
// 新事件应使用 heal、damage、maxHp，避免把永久生命和即时治疗混为一谈。
export function normalizeLegacyHealthResult(resultValue){
  const result = resultValue && typeof resultValue === 'object' ? { ...resultValue } : {};
  if(Object.prototype.hasOwnProperty.call(result, 'hp')){
    if(result.heal === undefined && result.damage === undefined){
      const legacyHp = finiteNumber(result.hp, 0);
      if(legacyHp >= 0) result.heal = legacyHp;
      else result.damage = Math.abs(legacyHp);
    }
    // 明确字段优先，避免旧 hp 与 heal/damage 被重复结算。
    delete result.hp;
  }
  return result;
}

// 保持魂环选项的"结果 + 选项索引"接口稳定，避免调用方把纯 result 当成包装对象。
export function findRingChoiceResult(choices, beast){
  if(!Array.isArray(choices) || !beast) return null;
  const fullName = String(beast.name || '');
  const baseName = fullName.replace(/^(?:十万年|万年|千年|百年|十年)/, '');
  const index = choices.findIndex(choice => {
    const text = String(choice && choice.text || '');
    return (fullName && text.includes(fullName)) ||
      (baseName && text.includes(baseName)) ||
      (choice && choice.result && choice.result.battle === beast.id);
  });
  if(index < 0) return null;
  return { result: choices[index] && choices[index].result || {}, index };
}

const EVENT_LOCATION_HINTS = [
  [/诺丁/, 'nuoding_city'],
  [/史莱克|学院|大师|食堂|操场|宿舍|图书馆|后山|大礼堂|清水湖|练功场|课堂|自习室|校园|钟楼|冥想室/, 'shrek_academy'],
  [/星斗大森林.*(?:深处|核心|湖畔|核心区|禁忌区|黑水河)|森林深处/, 'star_duo_deep'],
  [/圣魂村|出生的小村庄|山村/, 'holy_soul_village'],
  [/冰火两仪眼|绝密山谷|落日森林.*灵药|灵药谷/, 'medicine_valley'],
  [/落日森林|落日峡谷|落日山脉/, 'sunset_forest'],
  [/武魂城/, 'wuhun_city'],
  [/武魂殿|武魂分殿/, 'spirit_hall'],
  [/东海港口|东海港|港口调查|船队补给|海运委托|港口执事|船长|海上航行|出海/, 'east_sea_port'],
  [/海神岛|海滩|近海|深海|魔鲸海域/, 'sea_god_island'],
  [/极北冰原|北方冰原|冰封森林|冰原/, 'ice_forest'],
  [/杀戮之都|试炼之城/, 'slaughter_city'],
  [/远古遗迹|上古遗迹|地下遗迹|剑冢|魂骨殿|丹房|古籍阁|密室/, 'ancient_ruins'],
  [/上三宗|七宝琉璃宗/, 'seven_treasure_glaze'],
  [/昊天宗/, 'haotian_sect'],
  [/力之一族/, 'strength_clan'],
  [/敏之一族/, 'speed_clan'],
  [/御之一族/, 'defense_clan'],
  [/破之一族/, 'breaking_clan'],
  [/钢铁之城|铁匠铺|锻造|魂导器工坊|废弃矿洞|矿洞/, 'steel_city'],
  [/迷雾沼泽|暗影沼泽|毒雾|阴暗峡谷/, 'shadow_swamp'],
  [/深渊裂隙|深渊裂缝|混沌之中/, 'abyss_rift'],
  [/邪魔森林|废弃教堂/, 'evil_forest'],
  [/元素峡谷|火山/, 'element_valley'],
  [/死亡沙漠|沙漠/, 'desert_death'],
  [/龙之谷/, 'dragon_valley'],
  [/神界之门|苍穹之巅|天空之城|神界|虚空|天劫|神圣殿堂|云雾山|万丈悬崖/, 'sky_city'],
  [/天斗城|天斗帝国|边境小城|官道|民间|大赛|皇宫|佣兵公会|拍卖|酒楼|药堂|药铺|茶馆|客栈|广阔平原|大陆中部.*岩石|路边|十字路口|某城镇|山寨/, 'tian_dou_city'],
  [/星斗大森林|魂兽领地|猎魂森林|星斗小村|森林|野外|荒野|荒山|山林|深山|山谷|山区|山顶|悬崖|无名古墓|未知山脉|瀑布|温泉|花海|巢穴/, 'star_duo_outer']
];
const GLOBAL_EVENT_LOCATIONS = /^(?:斗罗大陆|斗罗大陆各地|大陆各地|旅途|未知|任意|修炼中|冥想中|闭关|闭关修炼|自己选的地方|史莱克学院\/自己宗门|你的宗门|你的神殿|你的府邸|你的住处|你的修炼室)$/;

// 事件地点前缀判定（单一来源）：与 classifyEventLocation 的全局判定不同，
// 这里是"以全局地点词开头"即视为全局事件（eventMatchesCurrentLocation 语义），
// event-index.js 与 useEventEngine.js 共用，禁止手抄副本。
export const GLOBAL_LOCATION_PREFIX = /^(?:斗罗大陆|斗罗大陆各地|大陆各地|旅途|未知|任意|修炼中|冥想中|闭关|闭关修炼)/;

export function classifyEventLocation(value, mapLocations){
  const raw = String(value || '').trim();
  const text = raw.replace(/[·・\s]/g, '');
  if(!text) return { scope:'global', id:null };
  if(GLOBAL_EVENT_LOCATIONS.test(text)) return { scope:'global', id:null };
  const locations = Array.isArray(mapLocations) ? mapLocations : [];
  const direct = locations.find(location => {
    const id = String(location && location.id || '');
    const name = String(location && location.name || '').replace(/[·・\s]/g, '');
    return id === raw || (name && (text === name || text.includes(name) || name.includes(text)));
  });
  if(direct) return { scope:'mapped', id:direct.id };
  for(const [pattern, id] of EVENT_LOCATION_HINTS){
    if(pattern.test(text)) return { scope:'mapped', id };
  }
  return { scope:'unknown', id:null };
}

export function calculateRingBacklash(maxHpValue, currentHpValue, riskValue){
  const currentFallback = Math.max(1, finiteNumber(currentHpValue, 1));
  const maxHp = Math.max(1, finiteNumber(maxHpValue, currentFallback));
  const currentHp = Math.max(1, finiteNumber(currentHpValue, maxHp));
  const risk = Math.max(0, Math.min(100, finiteNumber(riskValue, 0)));
  const rawDamage = Math.floor(maxHp * (0.2 + risk / 200));
  const damage = Math.max(1, finiteNumber(rawDamage, 1));
  return { maxHp, currentHp, risk, damage, remainingHp:Math.max(1, currentHp - damage) };
}

function dateAtNoon(key){    const parts = String(key || '').split('-').map(Number);
  if(parts.length !== 3 || !parts.every(Number.isFinite)) return NaN;
  return new Date(parts[0], parts[1] - 1, parts[2], 12).getTime();
}

export function previewDailySign(signValue, today){
  const sign = signValue && typeof signValue === 'object' ? signValue : {};
  const signedToday = sign.lastDate === today;
  const previous = dateAtNoon(sign.lastDate);
  const current = dateAtNoon(today);
  const dayGap = Number.isFinite(previous) && Number.isFinite(current) ? Math.round((current - previous) / 86400000) : NaN;
  const previousStreak = Math.max(0, finiteNumber(sign.cycleDay, 0));
  const nextStreak = signedToday ? Math.max(1, previousStreak) : (dayGap === 1 ? previousStreak + 1 : 1);
  const rewardDay = ((Math.max(1, nextStreak) - 1) % 7) + 1;
  return { signedToday, dayGap, nextStreak, rewardDay };
}

export function recordDailySign(signValue, today){
  const sign = signValue && typeof signValue === 'object' ? { ...signValue } : {};
  const preview = previewDailySign(sign, today);
  if(preview.signedToday) return { changed:false, sign, ...preview };
  sign.lastDate = today;
  sign.cycleDay = preview.nextStreak;
  sign.totalDays = Math.max(0, finiteNumber(sign.totalDays, 0)) + 1;
  sign.maxStreak = Math.max(Math.max(0, finiteNumber(sign.maxStreak, 0)), preview.nextStreak);
  return { changed:true, sign, ...preview };
}

// 斗罗大陆的魂环不是装饰，而是每一段等级成长的硬门槛。
// 没有第 N 个魂环时，最多只能停在 N×10 级；第九环后才允许继续到 100 级。
export const RING_LEVELS = [10,20,30,40,50,60,70,80,90];
export function levelCapForRings(ringCount){
  const count = Math.max(0, Math.floor(finiteNumber(ringCount, 0)));
  return count >= RING_LEVELS.length ? 100 : RING_LEVELS[count];
}

// 季节：32 个时段（4 天）换一个季节，四季循环。
export function seasonForGameTime(gameTime){
  const t = Math.max(0, Math.floor(finiteNumber(gameTime, 0)));
  return ['spring', 'summer', 'autumn', 'winter'][Math.floor(t / ACTIONS_PER_SEASON) % 4];
}

// 阶段名与魂师等级称号分开：god phase 从 Lv.41 开始，并不等于已经成神。
export function rankTitleForLevel(level){
  const value = Math.max(1, Math.floor(finiteNumber(level, 1)));
  if(value <= 9) return '魂士';
  if(value <= 19) return '魂师';
  if(value <= 29) return '大魂师';
  if(value <= 39) return '魂尊';
  if(value <= 49) return '魂宗';
  if(value <= 59) return '魂王';
  if(value <= 69) return '魂帝';
  if(value <= 79) return '魂圣';
  if(value <= 89) return '魂斗罗';
  if(value <= 99) return '封号斗罗';
  return '神级魂师';
}

// 阶段划分（单一来源）：与 rankTitleForLevel 不同，god phase 从 Lv.71 开始，并不等于已经成神。
// 边界按斗罗 1 正典身份期：觉醒/初级学院 1~10、进阶学院 10~40、历练 40~70、封神 70~100。
export function phaseForLevel(level){
  const value = Math.max(1, Math.floor(finiteNumber(level, 1)));
  if(value <= 10) return 'academy';
  if(value <= 40) return 'adventure';
  if(value <= 70) return 'master';
  return 'god';
}

// 战斗伤害公式（与 game-combat.js 的 damageFormula 保持同一实现，便于纯函数回归测试）。
// base = attack × (0.88 ~ 1.12 随机) − 有效防御 × 0.48，最低 1，再乘倍率。
export function calculateDamage(attack, defense, options){
  const opt = options || {};
  const penetration = Math.max(0, Math.min(0.8, finiteNumber(opt.penetration, 0)));
  const effectiveDefense = Math.max(0, finiteNumber(defense, 0)) * (1 - penetration);
  const atk = Math.max(0, finiteNumber(attack, 0));
  const base = Math.max(1, atk * (0.88 + Math.random() * 0.24) - effectiveDefense * 0.48);
  return Math.max(1, Math.round(base * (finiteNumber(opt.multiplier, 1))));
}

// 成长曲线（单一来源）：
// expNeed(lv) = round(40 * lv^1.15 * 后期折扣)。Lv.1 需 40，Lv.10 需 565，Lv.50 需 3192，Lv.99 需 4339，
// 1→100 累计 260,218 经验（儿童版加入后期折扣前为 367,228）。
// 40 级以前与旧版完全一致；旧轨 legacy game.js 仍使用无折扣的旧公式（旧轨已停止维护）。
// 儿童版节奏调整：41 级以后所需经验逐步打折（到 80 级起只需原来的 55%），
// 让后期每一级大约 3~4 次行动，不再出现"连续几十次行动升不了一级"。
export function lateGameExpMultiplier(level){
  const lv = Math.max(1, Math.floor(finiteNumber(level, 1)));
  if(lv <= 40) return 1;
  return 1 - 0.45 * Math.min(1, (lv - 40) / 40);
}

export function experienceNeededForLevel(level){
  const normalizedLevel = Math.max(1, Math.floor(finiteNumber(level, 1)));
  return Math.round(40 * Math.pow(normalizedLevel, 1.15) * lateGameExpMultiplier(normalizedLevel));
}

// 卡在魂环门槛时，最多暂存 1.5 级的经验。超出部分由结算层折成金币并提示去猎环，
// 避免拿到魂环后一口气连升十级、跳过一整段内容。
export const OVERFLOW_LEVEL_LIMIT = 1.5;

export function advanceExperience(stateValue, amount, expNeed){
  const state = stateValue && typeof stateValue === 'object' ? stateValue : {};
  const needFor = typeof expNeed === 'function' ? expNeed : experienceNeededForLevel;
  let level = Math.max(1, Math.floor(finiteNumber(state.level, 1)));
  let exp = Math.max(0, finiteNumber(state.exp, 0));
  let overflowExp = Math.max(0, finiteNumber(state.overflowExp, 0));
  let remaining = Math.max(0, finiteNumber(amount, 0)) + overflowExp;
  overflowExp = 0;
  const ringCount = Math.max(0, Math.floor(finiteNumber(state.ringCount, Array.isArray(state.rings) ? state.rings.length : 0)));
  const cap = levelCapForRings(ringCount);
  const levels = [];
  let wasted = 0;

  while(level < 100 && remaining > 0){
    if(level >= cap){
      const limit = Math.max(1, Math.round(OVERFLOW_LEVEL_LIMIT * Math.max(1, finiteNumber(needFor(cap), 1))));
      const stored = overflowExp + remaining;
      overflowExp = Math.min(stored, limit);
      wasted = Math.max(0, stored - limit);
      remaining = 0;
      break;
    }
    const required = Math.max(1, finiteNumber(needFor(level), 1));
    const toNext = Math.max(0, required - exp);
    if(remaining < toNext){
      exp += remaining;
      remaining = 0;
      break;
    }
    remaining -= toNext;
    exp = 0;
    level++;
    levels.push(level);
  }
  if(level >= 100){
    exp = 0;
    overflowExp = 0;
  }
  const result = { level, exp, overflowExp, levels, capped: level < 100 && level >= cap };
  if(wasted > 0) result.wasted = wasted;
  return result;
}

function escapeHtml(text){
  return String(text == null ? '' : text)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// 数据文本允许的富文本白名单：仅恢复换行与带 color 内联样式的 span（颜色值限 #hex）。
// 其余一切标签/属性保持转义，防止脚本或事件注入。
const RICH_TAG_RULES = [
  [/&lt;br\s*\/?&gt;/gi, '<br>'],
  [/&lt;span style=&quot;color:#([0-9a-fA-F]{3,8})&quot;&gt;/g, '<span style="color:#$1">'],
  [/&lt;\/span&gt;/gi, '</span>'],
  [/&lt;b&gt;/gi, '<b>'],
  [/&lt;\/b&gt;/gi, '</b>']
];

// 富文本安全渲染：先整体转义，再按白名单恢复少量展示标签。可用于 innerHTML 注入点。
export function richText(text){
  let safe = escapeHtml(text);
  for(const [pattern, replacement] of RICH_TAG_RULES){
    safe = safe.replace(pattern, replacement);
  }
  return safe;
}

// 剧情占位符（单一来源）：{name}=主角名、{spirit}=武魂名、{ringLabel}=本次魂环名、{origin}=出身。
// 文本会以 v-html 渲染，替换值一律先转义，防止玩家名注入标签。未提供的占位符用中性兜底词，
// 保证玩家永远看不到花括号原文。
const TEMPLATE_FALLBACKS = Object.freeze({ name: '你', spirit: '武魂', ringLabel: '新的魂环', origin: '家乡' })
export function fillTemplate(text, values = {}){
  if(text == null) return text;
  return String(text).replace(/\{(name|spirit|ringLabel|origin)\}/g, (_, key) => {
    const value = values[key];
    return escapeHtml(value === undefined || value === null || value === '' ? TEMPLATE_FALLBACKS[key] : value);
  });
}

// 对整个事件做占位符替换：正文、选项文本、选项结果文本、条件提示。返回新对象，不改原数据。
export function fillEventTemplates(event, values = {}){
  if(!event || typeof event !== 'object') return event;
  const fill = text => typeof text === 'string' ? fillTemplate(text, values) : text;
  const text = Array.isArray(event.text) ? event.text.map(fill) : fill(event.text);
  const choices = Array.isArray(event.choices) ? event.choices.map(choice => {
    if(!choice || typeof choice !== 'object') return choice;
    const next = { ...choice, text: fill(choice.text) };
    if(typeof choice.reply === 'string') next.reply = fill(choice.reply);
    if(typeof choice.requirementHint === 'string') next.requirementHint = fill(choice.requirementHint);
    if(choice.result && typeof choice.result === 'object' && typeof choice.result.text === 'string'){
      next.result = { ...choice.result, text: fill(choice.result.text) };
    }
    if(choice.result?.defeatOutcome && typeof choice.result.defeatOutcome.text === 'string'){
      next.result = { ...(next.result || choice.result), defeatOutcome: { ...choice.result.defeatOutcome, text: fill(choice.result.defeatOutcome.text) } };
    }
    if(Array.isArray(choice.replyVariants)){
      next.replyVariants = choice.replyVariants.map(variant => ({ ...variant, text: fill(variant.text) }));
    }
    return next;
  }) : event.choices;
  // 名场面专用字段（engine/story-marks.js）：按记号追加的段落与收尾段落也要替换占位符。
  const extra = {};
  if(Array.isArray(event.variants)) extra.variants = event.variants.map(variant => ({ ...variant, text: fill(variant.text) }));
  if(typeof event.closing === 'string') extra.closing = fill(event.closing);
  return { ...event, ...extra, name: fill(event.name), text, choices };
}

// 纯文本：剥离全部标签（<br> 转为换行）并还原常见实体，供日记等纯文本展示场景。
export function plainText(text){
  return String(text == null ? '' : text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
