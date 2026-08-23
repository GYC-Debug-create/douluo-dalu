'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { classifyEventLocation } = require('../public/game-rules');

function walk(dir, predicate, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, output);
    else if (predicate(full)) output.push(full);
  }
  return output;
}

function validateJsonFiles(publicDir, errors) {
  const files = walk(path.join(publicDir, 'data'), file => file.endsWith('.json'));
  for (const file of files) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`${path.relative(publicDir, file)}：JSON 无法解析（${error.message}）`);
    }
  }
  return files.length;
}

function validateImageReferences(publicDir, errors) {
  const dataSources = walk(path.join(publicDir, 'data'), file => file.endsWith('.json'));
  const sources = [
    ...dataSources,
    path.join(publicDir, 'index.html'),
    path.join(publicDir, 'game.html'),
    path.join(publicDir, 'codex.html'),
    path.join(publicDir, 'map.html'),
    path.join(publicDir, 'js', 'config.js')
  ];
  const pattern = /(?:src\s*=\s*["']|(?:image|icon|banner)\s*[:=]\s*["'])(assets\/[^"]+?\.(?:jpg|jpeg|png|webp|gif))/gi;
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) {
      const relativeAsset = decodeURIComponent(match[1]);
      const asset = path.join(publicDir, ...relativeAsset.split('/'));
      if (!fs.existsSync(asset)) {
        errors.push(`${path.relative(publicDir, file)}：资源不存在 ${relativeAsset}`);
      }
    }
  }
}

function loadEvents(publicDir, errors) {
  const file = path.join(publicDir, 'game-data.js');
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('const EVENTS = [');
  const end = source.indexOf('// ==================== 结局库', start);
  if (start < 0 || end < 0) {
    errors.push('game-data.js：无法定位 EVENTS 数据');
    return [];
  }
  const context = {};
  try {
    vm.createContext(context);
    vm.runInContext(`${source.slice(start, end)}\nthis.EVENTS = EVENTS;`, context, { timeout: 1000 });
    const expanded = fs.readFileSync(path.join(publicDir, 'game-events-expanded.js'), 'utf8');
    vm.runInContext(`${expanded}\nthis.EVENTS = EVENTS;`, context, { timeout: 3000 });
    return context.EVENTS || [];
  } catch (error) {
    errors.push(`事件库无法解析（${error.message}）`);
    return [];
  }
}

// 与 public/game-rules.js 的 phaseForLevel、frontend/src/engine/event-rules.js 的
// PHASE_RANGES 保持同一边界（正典身份期：初级学院 1~10、进阶学院 11~40、历练 41~70、封神 71~100）。
const PHASE_RANGES = { academy:[1,10], adventure:[11,40], master:[41,70], god:[71,100] };
const NUMERIC_RESULT_FIELDS = ['attack','defense','speed','hp','maxHp','heal','damage','exp','gold','fate','mp','spiritPowerGain'];

// 正典称呼纠偏（判例23）：史莱克七怪与主角同代，不得被称为"学长/导师"。
const CANON_ADDRESS_PATTERN = /(唐三|戴沐白|小舞|奥斯卡|马红俊|宁荣荣|朱竹清)[^"'”“」』]{0,6}(学长|导师)/;

function validateCanonAddress(sourceName, event, errors){
  const texts = [event && event.name, ...(event && event.text || [])];
  for(const choice of (event && event.choices) || []){
    if(!choice) continue;
    texts.push(choice.text, choice.result && choice.result.text);
  }
  for(const text of texts){
    if(typeof text === 'string' && CANON_ADDRESS_PATTERN.test(text)){
      errors.push(`${sourceName}：${event.id} 对正典人物使用不当称呼「${CANON_ADDRESS_PATTERN.exec(text)[0]}」（应为"同学"等平辈称呼）`);
      return;
    }
  }
}

function validateResult(eventId, choiceIndex, result, errors){
  if(!result || typeof result !== 'object') return;
  for(const field of NUMERIC_RESULT_FIELDS){
    if(result[field] !== undefined && !Number.isFinite(Number(result[field]))){
      errors.push(`事件库：${eventId} 第 ${choiceIndex + 1} 个选项的 ${field} 不是有效数字`);
    }
  }
  if(result.hp !== undefined && (result.heal !== undefined || result.damage !== undefined || result.maxHp !== undefined)){
    errors.push(`事件库：${eventId} 第 ${choiceIndex + 1} 个选项同时使用兼容字段 hp 与明确生命字段`);
  }
}

function validateEvents(publicDir, errors, eventNames) {
  const events = loadEvents(publicDir, errors);
  const ids = new Set();
  const names = eventNames || new Set();
  const knownIds = new Set(events.map(event => event.id).filter(Boolean));
  for(const event of events){
    if(!event.id) errors.push(`game-data.js：事件「${event.name || '未命名'}」缺少 ID`);
    else if(ids.has(event.id)) errors.push(`game-data.js：全局事件 ID 重复 ${event.id}`);
    else ids.add(event.id);
    const nameKey = String(event.name || '').trim();
    if(nameKey && names.has(nameKey)) errors.push(`game-data.js：事件名重复「${nameKey}」（${event.id}）`);
    names.add(nameKey);
    const min = Number(event.minLevel) || 1;
    const max = Number(event.maxLevel) || 100;
    const effectivePhase = min <= 10 ? 'academy' : min <= 40 ? 'adventure' : min <= 70 ? 'master' : 'god';
    const range = PHASE_RANGES[event.phase];
    if(!range) errors.push(`事件库：${event.id} 使用无效阶段 ${event.phase}`);
    else if(min > max || min > range[1] || max < range[0]) errors.push(`事件库：${event.id} 的阶段与等级区间不可达（应归入 ${effectivePhase}）`);
    validateCanonAddress('事件库', event, errors);
    if(event.npcIds && !Array.isArray(event.npcIds)) errors.push(`game-data.js：${event.id} 的 npcIds 必须是数组`);
    if(!Array.isArray(event.choices) || event.choices.length === 0){
      errors.push(`game-data.js：${event.id} 缺少可选项`);
      continue;
    }
    event.choices.forEach((choice, index) => {
      if(!choice || !choice.text) errors.push(`game-data.js：${event.id} 第 ${index + 1} 个选项缺少文本`);
      if(!choice.result && !choice.next && typeof choice.effect !== 'function') errors.push(`game-data.js：${event.id} 第 ${index + 1} 个选项没有结果或后续事件`);
      validateResult(event.id, index, choice.result, errors);
      if(choice.next && typeof choice.next === 'string' && !knownIds.has(choice.next)){
        errors.push(`事件库：${event.id} 引用不存在的 next ${choice.next}`);
      }
    });
  }
  return events;
}

function validateSpiritEventMap(publicDir, errors, baseEvents, eventNames) {
  const names = eventNames || new Set();
  let spirits, eventData, mappingData;
  try{
    spirits = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'spirit-codex.json'), 'utf8')).spirits || [];
    eventData = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'spirit-events.json'), 'utf8')).spirit_events || {};
    mappingData = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'spirit-event-map.json'), 'utf8')).mappings || [];
  }catch { return 0; }
  const spiritIds = new Set(spirits.map(spirit => spirit.id));
  const eventKeys = new Set(Object.keys(eventData));
  const mappedKeys = new Set();
  const mappedSpirits = new Set();
  for(const entry of mappingData){
    if(!entry || !eventKeys.has(entry.eventKey)) errors.push(`spirit-event-map.json：无效事件键 ${entry && entry.eventKey}`);
    if(!entry || !spiritIds.has(entry.spiritId)) errors.push(`spirit-event-map.json：无效武魂 ID ${entry && entry.spiritId}`);
    if(mappedKeys.has(entry.eventKey)) errors.push(`spirit-event-map.json：事件键重复 ${entry.eventKey}`);
    if(mappedSpirits.has(entry.spiritId)) errors.push(`spirit-event-map.json：武魂重复映射 ${entry.spiritId}`);
    mappedKeys.add(entry.eventKey); mappedSpirits.add(entry.spiritId);
  }
  for(const key of eventKeys) if(!mappedKeys.has(key)) errors.push(`spirit-event-map.json：事件键 ${key} 未映射`);
  for(const spirit of spirits) if(!mappedSpirits.has(spirit.id)) errors.push(`spirit-event-map.json：武魂 ${spirit.id} 未映射`);
  const ids = new Set((baseEvents || []).map(event => event.id));
  const knownIds = new Set([...ids, ...Object.values(eventData).flat().map(event => event && event.id).filter(Boolean)]);
  let checked = 0;
  for(const [key, events] of Object.entries(eventData)){
    if(!Array.isArray(events) || events.length === 0) errors.push(`spirit-events.json：${key} 没有事件`);
    for(const event of events || []){
      checked++;
      if(!event.id) errors.push(`spirit-events.json：${key} 存在无 ID 事件`);
      else if(ids.has(event.id)) errors.push(`spirit-events.json：全局事件 ID 重复 ${event.id}`);
      else ids.add(event.id);
      const nameKey = String(event.name || '').trim();
      if(nameKey && names.has(nameKey)) errors.push(`spirit-events.json：事件名与已有事件重复「${nameKey}」（${event.id}）`);
      names.add(nameKey);
      validateCanonAddress('spirit-events.json', event, errors);
      if(event.npcIds && !Array.isArray(event.npcIds)) errors.push(`spirit-events.json：${event.id} 的 npcIds 必须是数组`);
      const min = Number(event.minLevel) || 1;
      const max = Number(event.maxLevel) || 100;
      const range = PHASE_RANGES[event.phase];
      if(event.phase && (!range || min > max || min > range[1] || max < range[0])){
        errors.push(`spirit-events.json：${event.id} 的阶段与等级区间不可达`);
      }
      if(!Array.isArray(event.choices) || event.choices.length === 0){
        errors.push(`spirit-events.json：${event.id} 缺少可选项`);
        continue;
      }
      event.choices.forEach((choice, index) => {
        if(!choice || !choice.text) errors.push(`spirit-events.json：${event.id} 第 ${index + 1} 个选项缺少文本`);
        if(!choice.result && !choice.next && typeof choice.effect !== 'function') errors.push(`spirit-events.json：${event.id} 第 ${index + 1} 个选项没有结果或后续事件`);
        validateResult(event.id, index, choice.result, errors);
        if(choice.next && typeof choice.next === 'string' && !knownIds.has(choice.next)) errors.push(`spirit-events.json：${event.id} 引用不存在的 next ${choice.next}`);
      });
    }
  }
  return checked;
}

function validateRingEvents(publicDir, errors, events) {
  events = events || loadEvents(publicDir, errors);
  const ringEvents = events.filter(event => /^ring_hunt_\d+$/.test(event.id || '')); 
  const ids = new Set();
  for (const event of ringEvents) {
    if (ids.has(event.id)) errors.push(`game-data.js：魂环事件 ID 重复 ${event.id}`);
    ids.add(event.id);
    if (!event.name || !event.location) errors.push(`game-data.js：${event.id} 缺少名称或地点`);
    if (!Array.isArray(event.text) || event.text.length === 0) errors.push(`game-data.js：${event.id} 缺少正文`);
    if (!Array.isArray(event.choices) || event.choices.length === 0) {
      errors.push(`game-data.js：${event.id} 缺少可选项`);
      continue;
    }
    event.choices.forEach((choice, index) => {
      if (!choice.text || !choice.result || !choice.result.text) {
        errors.push(`game-data.js：${event.id} 第 ${index + 1} 个选项结构不完整`);
      }
      for (const [key, value] of Object.entries(choice.result || {})) {
        if (['attack', 'defense', 'speed', 'hp', 'exp', 'gold', 'fate'].includes(key) && !Number.isFinite(value)) {
          errors.push(`game-data.js：${event.id} 第 ${index + 1} 个选项的 ${key} 不是有效数字`);
        }
      }
    });
  }
  return ringEvents.length;
}

function validateEventLocations(publicDir, events, errors){
  let locations = [];
  try{ locations = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'map-data.json'), 'utf8')).locations || []; }
  catch { return 0; }
  let unknown = 0;
  for(const event of events || []){
    const classification = classifyEventLocation(event.location, locations);
    if(classification.scope === 'unknown'){
      unknown++;
      errors.push(`事件库：${event.id} 的地点“${event.location}”既未映射到地图，也未显式标记为全局地点`);
    }
  }
  return unknown;
}

function validateLocationLinks(publicDir, errors) {
  const file = path.join(publicDir, 'data', 'map-data.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  const ids = new Set((data.locations || []).map(location => location.id));
  for (const location of data.locations || []) {
    for (const target of location.connectedTo || []) {
      if (!ids.has(target)) errors.push(`data/map-data.json：${location.id} 连接到不存在的地点 ${target}`);
    }
  }
}

function validateProject(rootDir) {
  const publicDir = path.join(rootDir, 'public');
  const errors = [];
  const checkedJsonFiles = validateJsonFiles(publicDir, errors);
  validateImageReferences(publicDir, errors);
  validateLocationLinks(publicDir, errors);
  const eventNames = new Set();
  const events = validateEvents(publicDir, errors, eventNames);
  const spiritEventsChecked = validateSpiritEventMap(publicDir, errors, events, eventNames);
  const ringEventsChecked = validateRingEvents(publicDir, errors, events);
  const unmappedEventLocations = validateEventLocations(publicDir, events, errors);
  // 大图体积告警：>1MB 的图片影响弱网体验（不阻断校验，仅提示）
  const warnings = [];
  try{
    const assetsDir = path.join(publicDir, 'assets');
    const walk = dir => {
      if(!fs.existsSync(dir)) return;
      for(const entry of fs.readdirSync(dir, { withFileTypes:true })){
        const full = path.join(dir, entry.name);
        if(entry.isDirectory()) walk(full);
        else if(/\.(jpe?g|png|webp)$/i.test(entry.name)){
          const size = fs.statSync(full).size;
          if(size > 1024 * 1024) warnings.push(`${path.relative(publicDir, full)} ${(size / 1024 / 1024).toFixed(2)}MB`);
        }
      }
    };
    walk(assetsDir);
  }catch(e){ /* 资源目录缺失时跳过 */ }
  return { errors, warnings, checkedJsonFiles, ringEventsChecked, eventsChecked:events.length, spiritEventsChecked, unmappedEventLocations };
}

if (require.main === module) {
  const result = validateProject(path.resolve(__dirname, '..'));
  if (result.errors.length) {
    console.error(`数据校验失败，共 ${result.errors.length} 项：`);
    result.errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`数据校验通过：${result.checkedJsonFiles} 个 JSON 文件，${result.ringEventsChecked} 个魂环事件。`);
    if(result.warnings && result.warnings.length){
      console.log(`⚠ 大图告警（${result.warnings.length} 张，>1MB）：`);
      result.warnings.slice(0, 10).forEach(w => console.log(`  - ${w}`));
      if(result.warnings.length > 10) console.log(`  …共 ${result.warnings.length} 张`);
    }
  }
}

module.exports = { validateProject };
