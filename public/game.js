/**
 * 斗罗大陆·武魂觉醒 —— 游戏引擎
 * 依赖 game-data.js（ORIGINS / EVENTS / ENDINGS）
 */
'use strict';

// ==================== 全局状态 ====================
const $ = id => document.getElementById(id);
const DATA = { spirits: null, beasts: null, rings: null, spiritSkills: null, beastVariants: null, mapData: null, npcData: null, boneData: null, locationData: null, spiritEvents: null, spiritEventMap: null };
var G = null;                 // 玩家存档对象（var 使 window.G 可被路由守卫访问）

// ==================== 武魂人格系统 ====================
// 武魂特质映射：subtype → 特质数组
const SPIRIT_TRAITS = {
  '生活器物': ['实用', '生存', '灵巧'],
  '武器': ['战斗', '锋利', '刚猛'],
  '强攻系': ['力量', '破坏', '狂暴'],
  '防御系': ['坚韧', '守护', '沉稳'],
  '敏攻系': ['敏捷', '隐匿', '灵动'],
  '控制系': ['精神', '束缚', '智慧'],
  '辅助系': ['治愈', '祝福', '奉献'],
  '植物系': ['生长', '自然', '生命'],
  '神器': ['神圣', '审判', '威严'],
  '神兽': ['远古', '威严', '不朽'],
  '特殊': ['神秘', '命运', '独特']
};

// 武魂特质 → 事件奖励加成
const TRAIT_BONUS = {
  '战斗': { exp: 1.3, attack: 1.5 },
  '力量': { attack: 1.5, exp: 1.2 },
  '破坏': { attack: 2, exp: 1.2 },
  // 狂暴只影响攻击，不再反转生命恢复；旧存档/旧事件的 hp 仍按当前生命变化处理。
  '狂暴': { attack: 1.5 },
  '坚韧': { defense: 1.5, maxHp: 1.3 },
  '守护': { defense: 1.5, fate: 1 },
  '沉稳': { defense: 1.5, exp: 1.1 },
  '敏捷': { speed: 1.5, exp: 1.2 },
  '隐匿': { speed: 1.5, gold: 1.2 },
  '灵动': { speed: 1.5, fate: 1 },
  '精神': { spiritPowerGain: 1.5, exp: 1.2 },
  '智慧': { exp: 1.5, spiritPowerGain: 1.2 },
  '束缚': { defense: 1.2, attack: 1.2 },
  '治愈': { heal: 1.5, maxHp: 1.1, fate: 1 },
  '祝福': { fate: 1.5, heal: 1.2 },
  '奉献': { fate: 1.5, gold: 1.3 },
  '生长': { maxHp: 1.3, defense: 1.2 },
  '自然': { heal: 1.3, spiritPowerGain: 1.2 },
  '生命': { maxHp: 1.2, heal: 1.5, fate: 1 },
  '神圣': { fate: 1.5, attack: 1.3 },
  '审判': { attack: 1.5, fate: 1 },
  '威严': { exp: 1.3, attack: 1.2 },
  '远古': { exp: 1.3, defense: 1.2 },
  '不朽': { maxHp: 1.5, defense: 1.3 },
  '实用': { gold: 1.5, exp: 1.1 },
  '生存': { maxHp: 1.3, defense: 1.2 },
  '灵巧': { speed: 1.3, gold: 1.2 },
  '锋利': { attack: 1.5, speed: 1.1 },
  '刚猛': { attack: 1.3, defense: 1.1 },
  '神秘': { fate: 1.5, exp: 1.3 },
  '命运': { fate: 2, exp: 1.2 },
  '独特': { exp: 1.3, fate: 1 }
};

// 命运路线
const DESTINY_PATHS = [
  { id:'lone_wolf', name:'独行之路', desc:'独自修炼，不依赖宗门，靠自己的双手开辟未来', tags:['wild','hunt','survive'] },
  { id:'sect_master', name:'宗门之路', desc:'广结善缘，开宗立派，以宗门之力问鼎巅峰', tags:['social','sect','teach','trade'] },
  { id:'adventurer', name:'冒险之路', desc:'走遍大陆每个角落，探寻秘境与上古遗迹', tags:['explore','ruin','secret','mystery'] },
  { id:'hero', name:'英雄之路', desc:'行侠仗义，斩妖除魔，守护天下苍生', tags:['justice','fight','evil','protect'] },
  { id:'fate_weaver', name:'命运之路', desc:'命运的安排总是出人意料，你永远不知道明天会发生什么', tags:['fate','random','lucky','unlucky'] }
];

function getSpiritPersonality(sp){
  // 获取武魂特质
  const traits = SPIRIT_TRAITS[sp.subtype] || SPIRIT_TRAITS[sp.type === '器武魂' ? '武器' : '强攻系'] || ['独特'];
  // 如果tier高，加额外特质
  const extra = [];
  if(sp.tier === 'god') extra.push('神圣');
  if(sp.tier === 'top') extra.push('威严');
  return { traits: [...traits, ...extra], subtype: sp.subtype || sp.type };
}

function getTraitMultiplier(trait, field){
  const bonus = TRAIT_BONUS[trait];
  if(!bonus) return 1;
  // 兼容旧配置：历史 hp 倍率只作为最大生命倍率，不再影响治疗或伤害。
  if(field === 'maxHp' && bonus.maxHp === undefined && bonus.hp !== undefined) return bonus.hp;
  return bonus[field] || 1;
}

function getSpiritBonus(field){
  // 返回该武魂所有特质对该字段的倍率之积。
  // 生命恢复与最大生命使用正向倍率；任何历史负值都不允许把治疗变成伤害。
  if(!G || !G._personality) return 1;
  let mult = 1;
  for(const t of G._personality.traits){
    const value = getTraitMultiplier(t, field);
    mult *= Number.isFinite(value) && value > 0 ? value : 1;
  }
  return Math.min(mult, 2.5); // 上限2.5倍
}
let newChar = { name: '', origin: null, spirit: null, redraws: Infinity };
const LS_KEY = 'dldl_text_rpg_save';
const GOD_PITY_KEY = 'dldl_god_spirit_pity';
const GOD_PITY_LIMIT = 50;

function getGodPityCount(){
  try{ return Math.max(0, Math.min(GOD_PITY_LIMIT, Number(localStorage.getItem(GOD_PITY_KEY)) || 0)); }
  catch(e){ return 0; }
}
function setGodPityCount(count){
  const safe = Math.max(0, Math.min(GOD_PITY_LIMIT, Number(count) || 0));
  try{ localStorage.setItem(GOD_PITY_KEY, String(safe)); }catch(e){}
  return safe;
}
function updateGodPityUI(){
  const button = $('btn-god-pity');
  if(!button) return;
  button.classList.toggle('action-slot-hidden', getGodPityCount() < GOD_PITY_LIMIT);
  button.setAttribute('aria-hidden', getGodPityCount() < GOD_PITY_LIMIT ? 'true' : 'false');
}

// ==================== 工具 ====================
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function rand(a, b){ return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmt(text){
  return esc(text).replace(/\{name\}/g, esc(G ? G.name : ''))
                  .replace(/\{spirit\}/g, esc(G ? G.spirit.name : ''));
}
// 富文本安全渲染：内部整体转义，仅按白名单恢复 <br>/<span style="color:#…"> 等标签；
// 占位符在恢复之后用已转义值替换，避免二次转义，也不受白名单影响。
function richText(text){
  if(typeof GameRules !== 'undefined' && typeof GameRules.richText === 'function'){
    return GameRules.richText(text)
      .replace(/\{name\}/g, esc(G ? G.name : ''))
      .replace(/\{spirit\}/g, esc(G ? G.spirit.name : ''));
  }
  return fmt(text);
}
// 纯文本：剥离全部 HTML 标签（<br> 转换行），供日记等纯文本展示。
function plainText(text){
  if(typeof GameRules !== 'undefined' && typeof GameRules.plainText === 'function'){
    return GameRules.plainText(text);
  }
  return String(text == null ? '' : text).replace(/<[^>]*>/g, '');
}
function toast(msg){
  const gameScreen = $('screen-game');
  const inGame = gameScreen && gameScreen.classList.contains('active');
  const modalOpen = $('modal-mask') && $('modal-mask').classList.contains('show');
  const t = $(inGame && !modalOpen ? 'game-toast' : 'toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
// 新角色开局：清空前一个角色残留的界面通知，避免“带着旧身份的感觉”开场。
function resetRoleShell(){
  ['toast','game-toast'].forEach(id => {
    const el = document.getElementById(id);
    if(!el){ return; }
    el.classList.remove('show');
    if(el._timer){ clearTimeout(el._timer); el._timer = null; }
    el.textContent = '';
  });
  const banner = document.getElementById('achievement-banner');
  if(banner) banner.classList.remove('show');
  if(typeof VisualFX !== 'undefined' && VisualFX.resetNotifications) VisualFX.resetNotifications();
  const host = document.getElementById('level-notifications');
  if(host) host.innerHTML = '';
  pendingLevelNotice = null;
  clearTimeout(levelNoticeTimer);
  const sceneArea = document.getElementById('scene-area');
  if(sceneArea) sceneArea.dataset.awaitingChoice = '';
  const overlay = document.getElementById('tutorial-overlay');
  if(overlay && !overlay.classList.contains('hidden')){
    if(activeTutorialCleanup) activeTutorialCleanup(false);
    else { overlay.classList.add('hidden'); overlay.innerHTML = ''; }
  }
  const mask = document.getElementById('modal-mask');
  if(mask && mask.classList.contains('show')) closeModal();
}
// 累计经验：跨等级计算时以“累计经验值”为基准，避免溢出被重复计入。
function cumulativeExp(level, exp){
  let total = exp;
  for(let i = 1; i < level; i++){
    total += Math.round(40 * Math.pow(Math.max(1, i), 1.15));
  }
  return total;
}

function expNeed(lv){ return Math.round(40 * Math.pow(lv, 1.15)); }
function addGold(amount, applyBonuses){
  if(!G) return 0;
  const raw = Math.round(Number(amount) || 0);
  const titleGold = applyBonuses !== false && raw > 0 ? Math.max(0, Number(getTitleBonus('gold')) || 0) : 0;
  const spiritGold = applyBonuses !== false && raw > 0 ? getSpiritBonus('gold') : 1;
  const value = raw > 0 ? Math.round(raw * spiritGold * (1 + titleGold)) : raw;
  G.gold = Math.max(0, (Number(G.gold) || 0) + value);
  if(value > 0) G._totalGoldEarned = (Number(G._totalGoldEarned) || 0) + value;
  return value;
}
function settingNumber(key, fallback){
  try{
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }catch(e){ return fallback; }
}

const FORMATIONS = [
  { id:'none', name:'无阵法', desc:'不使用任何阵法，自由战斗', bonus:'无加成', attack:0, defense:0, speed:0, spirit:0 },
  { id:'attack', name:'冲锋阵', desc:'集中力量强攻', bonus:'攻击+15%，防御-10%', attack:0.15, defense:-0.10, speed:0, spirit:0 },
  { id:'defense', name:'铁桶阵', desc:'稳扎稳打，以守为攻', bonus:'防御+20%，攻击-5%', attack:-0.05, defense:0.20, speed:0, spirit:0 },
  { id:'speed', name:'疾风阵', desc:'抢占先机，快速制敌', bonus:'速度+25%', attack:0, defense:0, speed:0.25, spirit:0 },
  { id:'spirit', name:'聚灵阵', desc:'凝聚魂力，持久作战', bonus:'最大魂力与恢复+30%', attack:0, defense:0, speed:0, spirit:0.30 }
];

function getActiveFormation(){
  return FORMATIONS.find(f => f.id === (G && G._activeFormation)) || FORMATIONS[0];
}

function getSpiritElement(){
  if(!G || !G.spirit) return 'none';
  const text = `${G.spirit.id || ''} ${G.spirit.name || ''} ${G.spirit.type || ''} ${G.spirit.subtype || ''}`;
  if(typeof BattleSystem !== 'undefined') return BattleSystem.normalizeElement(text);
  if(/火|焰|凤凰/.test(text)) return 'fire';
  if(/冰|雪|寒/.test(text)) return 'ice';
  if(/雷|电/.test(text)) return 'thunder';
  if(/水|海/.test(text)) return 'water';
  if(/草|木|植物|蓝银/.test(text)) return 'wood';
  if(/土|岩|熊/.test(text)) return 'earth';
  if(/天使|神圣|光/.test(text)) return 'light';
  if(/暗|影|冥|罗刹/.test(text)) return 'dark';
  if(/毒/.test(text)) return 'poison';
  if(/剑|刀|锤|金/.test(text)) return 'metal';
  if(/风|鸟|鹰/.test(text)) return 'wind';
  return 'none';
}

function getMaxSpiritPower(){
  if(!G) return 0;
  const formation = getActiveFormation();
  const skillMult = (G._skillBonuses && G._skillBonuses.mpMult) || 0;
  const titlePower = Math.max(0, Number(getTitleBonus('spiritPowerGain')) || 0);
  return Math.max(1, Math.round((Number(G.spiritPowerMax) || 1) * (1 + skillMult + (formation.spirit || 0)) + titlePower));
}

function phaseForLevel(level){
  level = Number(level) || 1;
  if(level <= 6) return 'academy';
  if(level <= 18) return 'adventure';
  if(level <= 40) return 'master';
  return 'god';
}

// 历史扩展包曾使用英文资源名，而项目中的正式素材为中文文件名。
const EVENT_ASSET_ALIASES = {
'assets/scenes/library.jpg':'assets/scenes/library_night.jpg',
'assets/scenes/ruin.jpg':'assets/scenes/temple.jpg',
'assets/scenes/sky_city.jpg':'assets/locations/天空之城.jpg',
'assets/scenes/tian_dou_city.jpg':'assets/locations/天斗城.jpg',
  'assets/beasts/one_eye_wolf.jpg':'assets/beasts/独眼狼.jpg',
  'assets/beasts/flower_snake.jpg':'assets/beasts/花蛇.jpg',
  'assets/beasts/rock_python.jpg':'assets/beasts/岩蟒.jpg',
  'assets/beasts/nether_wolf_king.jpg':'assets/beasts/幽冥狼王.jpg',
  'assets/beasts/titan_giant_ape.jpg':'assets/beasts/泰坦巨猿.jpg',
  'assets/beasts/titan_giant_ape_king.jpg':'assets/beasts/泰坦巨猿王.jpg',
  'assets/beasts/sky_blue_bull_python.jpg':'assets/beasts/天青牛蟒.jpg',
  'assets/beasts/deep_sea_demon_whale_king.jpg':'assets/beasts/深海魔鲸王.jpg',
  'assets/beasts/black_water_dragon.jpg':'assets/beasts/黑水蛟龙.jpg',
  'assets/beasts/blue_frog.jpg':'assets/beasts/蓝蛙.jpg',
  'assets/beasts/dark_gold_terrorclaw_bear.jpg':'assets/beasts/暗金恐爪熊.jpg',
  'assets/beasts/earth_bear.jpg':'assets/beasts/大地之熊.jpg',
  'assets/beasts/evil_demon_tiger_shark.jpg':'assets/beasts/邪魔虎鲨.jpg',
  'assets/beasts/flame_tiger.jpg':'assets/beasts/烈焰虎.jpg',
  'assets/beasts/human_faced_spider.jpg':'assets/beasts/人面魔蛛.jpg',
  'assets/beasts/ice_emperor_scorpion.jpg':'assets/beasts/冰帝蝎.jpg',
  'assets/beasts/ice_wolf.jpg':'assets/beasts/冰狼.jpg',
  'assets/beasts/iron_armor_bear.jpg':'assets/beasts/铁甲熊.jpg',
  'assets/beasts/iron_horn_sheep.jpg':'assets/beasts/铁角羊.jpg',
  'assets/beasts/marmot.jpg':'assets/beasts/土拨鼠.jpg',
  'assets/beasts/poison_spider.jpg':'assets/beasts/毒蛛.jpg',
  'assets/beasts/shadow_fox.jpg':'assets/beasts/暗影狐.jpg',
  'assets/beasts/soft_bone_rabbit.jpg':'assets/beasts/柔骨兔.jpg',
  'assets/beasts/spirit_deer.jpg':'assets/beasts/灵鹿.jpg',
  'assets/beasts/thousand_eye_centipede.jpg':'assets/beasts/千眼蜈蚣.jpg',
  'assets/beasts/thunder_bird.jpg':'assets/beasts/雷鸟.jpg',
  'assets/beasts/wild_rabbit.jpg':'assets/beasts/野兔.jpg',
  'assets/beasts/wind_butterfly.jpg':'assets/beasts/风蝶.jpg',
  'assets/beasts/wind_spirit_swallow.jpg':'assets/beasts/风灵燕.jpg'
};

function normalizeEventShape(event, spiritId){
  const ev = { ...event };
  ev.name = ev.name || ev.title || '未命名事件';
  ev.location = ev.location || '斗罗大陆';
  ev.text = Array.isArray(ev.text) ? ev.text : [String(ev.text || '')];
  ev.choices = (Array.isArray(ev.choices) ? ev.choices : []).map(choice => {
    const normalized = { ...choice };
    if(choice && choice.result && typeof choice.result === 'object'){
      normalized.result = { ...choice.result };
      // 旧事件的 hp 统一迁移：正数是当前生命恢复，负数是当前生命损伤；
      // 永久生命请使用 maxHp，明确损伤请使用 damage。明确字段优先，但仍删除旧 hp，避免重复结算。
      if(normalized.result.hp !== undefined){
        if(normalized.result.heal === undefined && normalized.result.damage === undefined){
          const legacyHp = Number(normalized.result.hp) || 0;
          if(legacyHp >= 0) normalized.result.heal = legacyHp;
          else normalized.result.damage = Math.abs(legacyHp);
        }
        delete normalized.result.hp;
      }
    }
    return normalized;
  });
  // minLevel 是可达性的唯一等级依据；阶段冲突时自动归入对应阶段。
  if(ev.minLevel) ev.phase = phaseForLevel(ev.minLevel);
  else if(!ev.phase) ev.phase = phaseForLevel(1);
  if(ev.image && EVENT_ASSET_ALIASES[ev.image]) ev.image = EVENT_ASSET_ALIASES[ev.image];
  if(spiritId) ev.spiritId = spiritId;
  return ev;
}

function normalizeLoadedEvents(){
  const seen = new Set();
  for(let i = 0; i < EVENTS.length; i++){
    const ev = normalizeEventShape(EVENTS[i], EVENTS[i].spiritId);
    if(!ev.id) throw new Error(`第${i + 1}个事件缺少稳定 ID`);
    if(seen.has(ev.id)) throw new Error(`事件 ID 重复：${ev.id}`);
    seen.add(ev.id);
    EVENTS[i] = ev;
  }
}

function localDateKey(date){
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function completeWorldAction(){
  if(!G) return;
  G._eventCount = (G._eventCount || 0) + 1;
  advanceTime();
  decrementDynamicCooldowns();
  const weather = getWeather();
  if(weather && weather.id === 'storm') G._stormAdventure = true;
  const time = getGameTime();
  if(time && time.id === 'night') G._nightTraining = G._nightTraining || false;
  checkHiddenLocationReveal();
}


// ==================== 数据加载 ====================
async function loadData(){
  // B-03：累计加载失败的文件，标题页可见可重试，避免“半空世界”无提示
  const loadErrors = [];
  window.__dataLoadErrors = loadErrors;
  const load = (url, fallback) => fetch(url).then(r => r.json()).catch(() => { loadErrors.push(url.replace('/data/', '')); return fallback; });
  const [sp, be, ri, sk, bv, md, np, bn, lc, se, sem] = await Promise.all([
    load('/data/spirit-codex.json', { spirits: [] }),
    load('/data/beast-codex.json', { beasts: [] }),
    load('/data/ring-codex.json', { rings: [] }),
    load('/data/spirit-skills.json', { spirits: {} }),
    load('/data/beast-variants.json', {}),
    load('/data/map-data.json', { locations: [] }),
    load('/data/npc-codex.json', { npcs: [] }),
    load('/data/bone-codex.json', { bones: [] }),
    load('/data/location-codex.json', { locations: [] }),
    load('/data/spirit-events.json', { spirit_events: {} }),
    load('/data/spirit-event-map.json', { mappings: [] })
  ]);
  DATA.spirits = sp.spirits || [];
  DATA.beasts = be.beasts || [];
  DATA.rings = ri.rings || [];
  DATA.spiritSkills = sk.spirits || {};
  DATA.beastVariants = bv;
  DATA.mapData = md.locations || [];
  DATA.npcData = np.npcs || [];
  DATA.boneData = bn.bones || [];
  DATA.locationData = lc.locations || [];
  DATA.spiritEvents = se.spirit_events || {};
  DATA.spiritEventMap = sem.mappings || [];
  // 英文事件键通过独立稳定映射对应正式武魂 ID，禁止按数组下标静默配对。
  const keyToSpiritId = new Map(DATA.spiritEventMap.map(entry => [entry.eventKey, entry.spiritId]));
  Object.entries(DATA.spiritEvents).forEach(([eventKey, events]) => {
    const spiritId = keyToSpiritId.get(eventKey);
    const spirit = DATA.spirits.find(item => item.id === spiritId);
    if(!spirit){ console.warn('找不到专属事件对应武魂:', eventKey, spiritId); return; }
    spirit.eventKey = eventKey;
    for(const source of events){
      const ev = normalizeEventShape(source, spirit.id);
      ev.spiritEventKey = eventKey;
      // 武魂专属故事是每个角色的个人记忆，不应在随机池中无限重复。
      ev.unique = source.unique !== false;
      EVENTS.push(ev);
    }
  });
  normalizeLoadedEvents();
}

// ==================== 界面切换 ====================
function showScreen(id){
  // 使用 transitionToScreen 直接切换画面，避免 hash 变化触发路由守卫
  // 路由守卫可能干扰游戏状态（如返回标题页后继续冒险时被拦截）
  if(window.transitionToScreen){
    window.transitionToScreen(id);
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active','is-mounted','is-leaving'));
    const el = document.getElementById(id);
    if(el) el.classList.add('active','is-mounted');
    window.scrollTo(0, 0);
  }
  // 同步 hash（但不触发 hashchange，因为 transitionToScreen 已处理画面切换）
  const screenToHash = {
    'screen-title': 'title',
    'screen-create': 'create',
    'screen-game': 'game',
    'screen-ending': 'ending'
  };
  const hash = screenToHash[id];
  if(hash){
    try{
      if(window.location.hash !== '#/' + hash) history.replaceState(null, '', '#/' + hash);
    }catch(e){}
  }
}

// ==================== 弹窗 ====================
let modalReturnFocus = null;
function openModal(title, html){
  modalReturnFocus = document.activeElement;
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal-mask').classList.add('show');
  $('modal-mask').setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => $('modal-x').focus());
}
function closeModal(){
  $('modal-mask').classList.remove('show');
  $('modal-mask').setAttribute('aria-hidden', 'true');
  if(modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus();
}
$('modal-x').addEventListener('click', closeModal);
$('modal-mask').addEventListener('click', e => { if(e.target === e.currentTarget) closeModal(); });
window.addEventListener('keydown', e => {
  const mask = $('modal-mask');
  if(!mask.classList.contains('show')) return;
  if(e.key === 'Escape'){
    closeModal();
    return;
  }
  if(e.key !== 'Tab') return;
  const focusable = [...mask.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
    .filter(element => element.offsetParent !== null);
  if(!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});

// ==================== 创建角色 ====================
let stepTransitionTimer = 0;
function gotoStep(n, options){
  if(n < 1 || n > 3) return false;
  const steps = [1,2,3].map(i => $('step-' + i));
  const target = steps[n - 1];
  const currentIndex = steps.findIndex(step => !step.classList.contains('hidden'));
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const immediate = Boolean(options && options.immediate) || reduced || !current;
  if(stepTransitionTimer || current === target) {
    if(current === target) [1,2,3].forEach(i => $('dot-' + i).classList.toggle('on', i <= n));
    return current === target;
  }

  [1,2,3].forEach(i => $('dot-' + i).classList.toggle('on', i <= n));
  if(immediate){
    steps.forEach((step, index) => {
      step.classList.toggle('hidden', index !== n - 1);
      step.classList.remove('is-step-leaving','step-enter-forward','step-leave-forward','step-enter-back','step-leave-back');
    });
    return true;
  }

  const forward = n - 1 > currentIndex;
  const enterClass = forward ? 'step-enter-forward' : 'step-enter-back';
  const leaveClass = forward ? 'step-leave-forward' : 'step-leave-back';
  const container = $('create-steps');
  container.classList.add('step-transitioning');
  target.classList.remove('hidden');
  current.classList.add('is-step-leaving', leaveClass);
  target.classList.add(enterClass);

  stepTransitionTimer = window.setTimeout(() => {
    current.classList.add('hidden');
    current.classList.remove('is-step-leaving', leaveClass);
    target.classList.remove(enterClass);
    container.classList.remove('step-transitioning');
    stepTransitionTimer = 0;
    const focusTarget = target.querySelector('input,button,[tabindex]:not([tabindex="-1"])');
    if(focusTarget) focusTarget.focus({ preventScroll: true });
  }, 250);
  return true;
}

function renderOrigins(){
  $('origin-grid').innerHTML = ORIGINS.map(o => `
    <button class="origin-card" data-id="${o.id}">
      <div class="oc-banner"><img src="${o.image}" alt="${esc(o.name)}"
        onerror="this.style.display='none'"></div>
      ${o.id === 'star_forest' ? '<span class="origin-tag">✦ 新手推荐</span>' : ''}
      <div class="oc-body">
        <div class="oc-name">${esc(o.name)}</div>
        <div class="oc-desc">${esc(o.desc)}</div>
        <div class="oc-bonus">✦ ${esc(o.bonus)}</div>
      </div>
    </button>`).join('');
  $('origin-grid').querySelectorAll('.origin-card').forEach(card =>
    card.addEventListener('click', () => {
      $('origin-grid').querySelectorAll('.origin-card').forEach(c => c.classList.remove('picked'));
      card.classList.add('picked');
      newChar.origin = ORIGINS.find(o => o.id === card.dataset.id);
      $('btn-to-awaken').disabled = false;
    }));
}

function rollSpiritTier(boost){
  const r = Math.random() * 100;
  let tier;
  if(r < 40) tier = 'low';
  else if(r < 75) tier = 'mid';
  else if(r < 93) tier = 'high';
  else if(r < 99) tier = 'top';
  else tier = 'god';
  if(boost && tier !== 'god' && Math.random() < 0.10){
    tier = { low: 'mid', mid: 'high', high: 'top', top: 'god' }[tier];
  }
  return tier;
}

const TIER_NAMES = { low: '低级武魂', mid: '中级武魂', high: '高级武魂', top: '顶级武魂', god: '神级武魂' };
const TIER_COLORS = { low: '#94a3b8', mid: '#22c55e', high: '#3b82f6', top: '#a855f7', god: '#fbbf24' };

function doAwaken(forcedSpirit){
  if(!DATA.spirits || DATA.spirits.length === 0){
    toast('武魂数据正在加载中，请稍候...');
    return;
  }
  const boost = newChar.origin && newChar.origin.qualityBoost;
  const tier = forcedSpirit ? 'god' : rollSpiritTier(boost);
  const pool = DATA.spirits.filter(s => s.tier === tier);
  if(forcedSpirit){
    newChar.spirit = forcedSpirit;
    setGodPityCount(0);
  }else if(pool.length === 0){
    const fallbackPool = DATA.spirits.filter(s => s.tier === 'mid' || s.tier === 'low');
    newChar.spirit = pick(fallbackPool.length ? fallbackPool : DATA.spirits);
    setGodPityCount(getGodPityCount() + 1);
  }else{
    newChar.spirit = pick(pool);
    if(tier === 'god') setGodPityCount(0);
    else setGodPityCount(getGodPityCount() + 1);
  }
  updateGodPityUI();

  const info = $('awaken-info');
  const awakenLeft = $('awaken-left');
  info.classList.remove('is-revealed');
  awakenLeft.classList.remove('is-revealed');
  const wrap = $('awaken-img-wrap');
  wrap.classList.remove('reveal');
  void wrap.offsetWidth; // 重触发动画
  
  // 激活法阵特效
  ['magic-circle','light-rays','altar-r1','altar-r2','altar-r3'].forEach(id => {
    const el = $(id);
    if(el) el.classList.add('reveal');
  });
  
  // 延迟显示，营造仪式感
  wrap.innerHTML = '<div class="awaken-q" style="color:var(--gold);text-shadow:0 0 60px rgba(201,168,76,.8)">✦</div>';
  setTimeout(() => {
    wrap.classList.add('reveal');
    const fallback = () => {
      const node = document.createElement('div');
      node.className = 'awaken-q-reveal';
      node.style.color = TIER_COLORS[tier] || '#c9a84c';
      node.textContent = newChar.spirit.icon || '✦';
      return node;
    };
    wrap.replaceChildren();
    if(newChar.spirit.image){
      const image = document.createElement('img');
      image.src = newChar.spirit.image;
      image.alt = newChar.spirit.name || '觉醒武魂';
      image.addEventListener('error', () => image.replaceWith(fallback()), { once:true });
      wrap.appendChild(image);
    }else{
      wrap.appendChild(fallback());
    }
  }, 600);

  // 计算先天魂力（基于武魂品质和出身加成）
  const tierPower = { god: 100, top: 85+Math.floor(Math.random()*15), high: 70+Math.floor(Math.random()*15), mid: 40+Math.floor(Math.random()*25), low: 10+Math.floor(Math.random()*25) };
  let innatePower = tierPower[tier] || 30;
  if(boost) innatePower = Math.min(100, innatePower + 10 + Math.floor(Math.random()*10));
  // 满魂力判定（神级武魂必满，顶级武魂10%几率，高级5%）
  if(tier === 'god') innatePower = 100;
  else if(tier === 'top' && Math.random() < 0.1) innatePower = 100;
  newChar.innatePower = innatePower;
  
  const o = newChar.origin;
  // 使用 previewStats 函数计算预览属性，确保与 finalStats 完全一致
  const baseStats = previewStats(newChar.spirit, o, 1);

  $('awaken-tier').textContent = TIER_NAMES[tier];
  $('awaken-tier').style.color = TIER_COLORS[tier];
  $('awaken-tier').style.borderColor = TIER_COLORS[tier];
  $('awaken-name').textContent = newChar.spirit.name;
  $('awaken-stats').innerHTML = `
    <div class="awaken-stat">先天魂力 <b>${innatePower}${innatePower>=100?'（满魂力！）':''}</b></div>
    <div class="awaken-stat">攻击 <b>${baseStats.attack}</b></div>
    <div class="awaken-stat">防御 <b>${baseStats.defense}</b></div>
    <div class="awaken-stat">生命 <b>${baseStats.hp}</b></div>
    <div class="awaken-stat">速度 <b>${baseStats.speed}</b></div>
  `;
  $('awaken-desc').textContent = newChar.spirit.desc;
  info.classList.remove('is-concealed');
  awakenLeft.classList.remove('is-concealed');
  info.setAttribute('aria-hidden', 'false');
  awakenLeft.setAttribute('aria-hidden', 'false');
  void info.offsetWidth;
  info.classList.add('is-revealed');
  awakenLeft.classList.add('is-revealed');
  const isFull = innatePower >= 100;
  const pity = getGodPityCount();
  const pityText = pity >= GOD_PITY_LIMIT
    ? '<br><b style="color:#fbbf24">✦ 神级保底已解锁，可自行选择一个神级武魂！</b>'
    : `<br>神级保底：${pity} / ${GOD_PITY_LIMIT}`;
  $('awaken-left').innerHTML = (isFull
    ? '<b style="color:#ffd700">✦ 先天满魂力！万年不遇的天才！✦</b><br>可无限次重新觉醒'
    : '可无限次重新觉醒') + pityText;
  $('btn-awaken').classList.add('action-slot-hidden');
  $('btn-Redraw').classList.remove('action-slot-hidden');
  $('btn-confirm-spirit').classList.remove('action-slot-hidden');
  $('btn-awaken').setAttribute('aria-hidden', 'true');
  $('btn-Redraw').setAttribute('aria-hidden', 'false');
  $('btn-confirm-spirit').setAttribute('aria-hidden', 'false');
  updateGodPityUI();
}

function openGodPitySelection(){
  if(getGodPityCount() < GOD_PITY_LIMIT){
    toast(`还需 ${GOD_PITY_LIMIT - getGodPityCount()} 次未出神级才可自选`);
    return;
  }
  const gods = (DATA.spirits || []).filter(spirit => spirit.tier === 'god');
  const html = `<div style="margin-bottom:12px;color:#e6c878;text-align:center">50次神级保底已触发，请选择你的神级武魂。选择后保底计数归零。</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;max-height:60vh;overflow-y:auto">
      ${gods.map(spirit => `<button class="origin-card" data-god-spirit="${esc(spirit.id)}" style="padding:12px;text-align:left">
        <div style="font-size:30px;margin-bottom:5px">${esc(spirit.icon || '✦')}</div>
        <div class="oc-name">${esc(spirit.name)}</div>
        <div class="oc-desc">${esc(spirit.desc || '')}</div>
        <div class="oc-bonus">攻击 ${spirit.attack || 0} · 防御 ${spirit.defense || 0} · 生命 ${spirit.hp || 0} · 速度 ${spirit.speed || 0}</div>
      </button>`).join('')}
    </div>`;
  openModal('✦ 自选神级武魂 ✦', html);
  document.querySelectorAll('[data-god-spirit]').forEach(button => button.addEventListener('click', () => {
    const spirit = gods.find(item => item.id === button.dataset.godSpirit);
    if(!spirit) return;
    closeModal();
    doAwaken(spirit);
    toast(`✦ 神级保底生效：觉醒「${spirit.name}」！`);
  }));
}

function createPlayer(){
  const o = newChar.origin;
  const sp = newChar.spirit;
  const personality = getSpiritPersonality(sp);
  const destiny = DESTINY_PATHS[Math.floor(Math.random() * DESTINY_PATHS.length)];
  // 先天魂力（从觉醒阶段传递，默认计算）
  const innatePower = newChar.innatePower || (sp.tier === 'god' ? 100 : sp.tier === 'top' ? 90 : sp.tier === 'high' ? 75 : sp.tier === 'mid' ? 50 : 20);
  G = {
    playerId: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: newChar.name,
    origin: o.id,
    originName: o.fullName,
    spirit: { id: sp.id, eventKey:sp.eventKey, name: sp.name, tier: sp.tier, type: sp.type, subtype: sp.subtype, image: sp.image, desc: sp.desc, icon: sp.icon },
    spiritBase: { attack: sp.attack, defense: sp.defense, hp: sp.hp, speed: sp.speed },
    innatePower: innatePower,
    level: 1,
    exp: 0,
    bonus: { attack: 0, defense: 0, hp: 0, speed: 0 },
    originBonus: o.stats,
    weapon: o.weapon || null,
    spiritPowerMax: 60 + Math.floor(innatePower * 1.2) + o.spiritPower * 3,
    spiritPower: 60 + Math.floor(innatePower * 1.2) + o.spiritPower * 3,
    hp: 0, // 稍后由 finalStats 填充
    rings: [],
    skills: [],
    inventory: [
      { name: '回魂丹', type: 'heal', value: 60, count: 2 },
      { name: '聚魂丹', type: 'mp', value: 40, count: 1 }
    ],
    gold: 100,
    fatePoints: 0,
    choices: {},
    doneEvents: [],
    battleStats: { wins: 0, losses: 0, kills: 0 },
    pendingRingLv: null,
    finished: false,
    createdAt: Date.now(),
    // 个性化系统
    _personality: personality,
    _destiny: destiny,
    _recentEvents: [],
    _prologueDone: false,
    _spiritAwakeningStoryDone: false,
    _earlyLifeDone: false,
    _registeredAtHall: false,
    _enrollmentComplete: false,
    _introPendingEvent: null,
    _tutorialPostponed: false,
    _firstClassDone: false,
    _academyRecommendation: null,
    _progressionRulesVersion: 2,
    _mainStoryVersion: 1,
    _storyMilestoneDeferredUntil: 0,
    overflowExp: 0,
    _currentLocation: ({ star_forest:'holy_soul_village', spirit_city:'wuhun_city', border_town:'tian_dou_city', sea_island:'tian_dou_city' }[o.id] || 'shrek_academy'),
    _visitedLocations: [],
    _forgeBonesMigrated: true
  };
  // 如果出身有武器，加入背包并显示在背包界面
  if(o.weapon){
    G.weapon = o.weapon;
    // 将武器也加入背包清单，让玩家可见
    const existing = G.inventory.find(item => item.name === o.weapon.name);
    if(!existing){
      G.inventory.push({
        name: o.weapon.name,
        type: 'weapon',
        value: o.weapon.attack || 0,
        count: 1,
        desc: o.weapon.attack ? `攻击+${o.weapon.attack}` : '初始武器'
      });
    }
  }
  const fs = finalStats();
  G.hp = fs.maxHp;
  return G;
}

// ==================== 开场剧情系统 ====================
const PROLOGUE = {
  // 出生场景（根据出身不同）
  birth: {
    'star_forest': [
      '圣魂村外，星斗大森林的边缘，一间简陋的茅屋里传来了婴儿的啼哭。',
      '你出生在一个普通的农户家庭。父亲是个憨厚的铁匠，母亲是位温柔的村妇。',
      '窗外的森林在夜色中低语，仿佛有什么古老的存在在注视着这个新生命。'
    ],
    'spirit_city': [
      '武魂城的深处，一座气势恢宏的府邸中，你降生了。',
      '你的家族是武魂殿登记在册的魂师世家，祖上曾出过魂斗罗级别的强者。',
      '你出生的那一刻，祠堂里供奉的武魂令牌微微震颤，发出一声低鸣。'
    ],
    'border_town': [
      '天斗帝国边境，一座常年受魂兽侵扰的小城。',
      '你的父亲是守城军中的一名小队长，母亲在城里开了间药铺。',
      '城墙上的警钟还在回响——昨夜又有一群幽冥狼闯过了防线。你就在这样紧张的气氛中降生了。'
    ],
    'sea_island': [
      '海神岛周边的一个小渔村，咸湿的海风透过窗棂吹进产房。',
      '你的父母都是普通的渔民，世世代代在这片海域讨生活。',
      '你出生时，海潮声格外响亮，远处的海神岛方向似乎有一道金光闪过。'
    ]
  },
  // 年少经历（随机）
  childhood: [
    [
      '六岁以前，你在村子里度过了无忧无虑的童年时光。',
      '你和小伙伴们在田间追逐，听老人们讲魂师的故事，梦想着有一天自己也能觉醒武魂。'
    ],
    [
      '你的童年并不轻松。父亲从你记事起就教你锻炼身体，说强健的体魄是成为魂师的基础。',
      '每天清晨天不亮，你就要起床扎马步、举石锁。虽然辛苦，但你的身子骨确实比同龄人结实得多。'
    ],
    [
      '你从小就显露出与众不同的气质。别的孩子还在玩泥巴的时候，你就喜欢一个人坐着发呆，望着远方出神。',
      '村里的老魂师说你"眼神有光"，将来一定不是池中之物。'
    ],
    [
      '你是村里出了名的孩子王，带着一群小伙伴"闯荡"村子周围的山林。',
      '虽然好几次因为闯祸被父母追着打，但你的领导力和勇气就在这些"冒险"中慢慢培养起来了。'
    ]
  ],
  // 觉醒仪式
  ceremony: [
    '终于，你六岁了。按照斗罗大陆的惯例，每个孩子在六岁时都要进行武魂觉醒仪式。',
    '这一天，村里来了一位身着武魂殿制服的魂师大人，为适龄的孩子们主持觉醒。',
    '你和其他几个孩子排着队，心中既紧张又期待。武魂决定了一个人的一生——是成为受人尊敬的魂师，还是做一辈子普通人？答案即将揭晓。'
  ]
};

const OPENING_BACKGROUNDS = {
  star_forest:'assets/scenes/forest_outer.jpg', spirit_city:'assets/scenes/wuhun_city.jpg',
  border_town:'assets/scenes/border_town.jpg', sea_island:'assets/scenes/sea_god_island.jpg'
};

function buildSpiritAwakeningScenes(){
  const spirit = G.spirit || {};
  const traits = (G._personality && G._personality.traits || []).slice(0, 3).join('、') || '独特';
  const sourceEvents = spirit.eventKey && DATA.spiritEvents ? DATA.spiritEvents[spirit.eventKey] : null;
  const sourceLine = sourceEvents && sourceEvents[0] ? String(sourceEvents[0].text || '').split(/[。！？]/)[0] : '';
  const form = spirit.type === '兽武魂' ? '兽影自光中昂首而起' : spirit.type === '器武魂' ? '器形在掌心由虚转实' : '魂光沿着经脉舒展成形';
  const tierLine = spirit.tier === 'god' ? '整座觉醒殿为之静默，穹顶的金纹一一亮起。那不是力量的炫耀，而是一份等待你回应的古老意志。' :
    spirit.tier === 'top' ? '四周魂力如潮水聚拢，主持仪式的魂师也不由屏住呼吸。' :
    `光芒并不以品阶评判你的未来；它安静地停在你身前，等待你亲手赋予「${spirit.name}」意义。`;
  return [
    { chapter:'第三章 · 魂之回应', location:'武魂觉醒殿', image:'assets/scenes/temple.jpg', text:`六枚觉醒石依次点亮，${form}——你的武魂「${spirit.name}」第一次显现在世间。` },
    { chapter:'第三章 · 魂之回应', location:`${TIER_NAMES[spirit.tier] || '武魂'} · ${spirit.name}`, image:spirit.image || 'assets/scenes/temple.jpg', text:tierLine, highlight:spirit.tier === 'god' || spirit.tier === 'top' },
    { chapter:'第三章 · 魂之回应', location:'心海', image:'assets/scenes/library_night.jpg', text:`你从武魂的回应里理解了${traits}。${sourceLine ? sourceLine + '。' : ''}${spirit.desc || '它的道路尚待你去探索。'} 你明白：武魂定义起点，却不能替你决定终点。` }
  ];
}

// 视觉小说式序章。点击监听只绑定专用舞台；键盘监听仅在序章激活期间存在。
function playPrologue(onComplete){
  const originId = G.origin || (newChar.origin && newChar.origin.id) || 'star_forest';
  const originName = G.originName || (newChar.origin && newChar.origin.fullName) || '斗罗大陆';
  const originImage = OPENING_BACKGROUNDS[originId] || 'assets/scenes/forest_outer.jpg';
  const scenes = [];
  (PROLOGUE.birth[originId] || PROLOGUE.birth.star_forest).forEach(text => scenes.push({ chapter:'第一章 · 来处', location:originName, image:originImage, text }));
  PROLOGUE.ceremony.forEach(text => scenes.push({ chapter:'第二章 · 六岁', location:'武魂觉醒日', image:'assets/scenes/temple.jpg', text }));
  scenes.push(...buildSpiritAwakeningScenes());
  const isFull = G.innatePower >= 100;
  scenes.push({ chapter:'序章 · 启程', location:'斗罗大陆', image:'assets/scenes/mountain_path.jpg', text:`你的名字是${G.name}，先天魂力${G.innatePower}级${isFull ? '——先天满魂力。' : '。'}武魂：${G.spirit.name}。`, highlight:true });
  scenes.push({ chapter:'序章 · 启程', location:'前路', image:'assets/scenes/mountain_path.jpg', text:'斗罗大陆的篇章，就此展开……', highlight:true });
  showPrologueScenes(scenes, onComplete);
}

function showPrologueScenes(scenes, onComplete){
  const area = $('scene-area');
  if(!area){ if(onComplete) onComplete(); return; }
  let index = 0;
  let auto = true;
  let finished = false;
  let autoTimer = null;
  let advancing = false;

  const clearTimer = () => { if(autoTimer){ clearTimeout(autoTimer); autoTimer = null; } };
  const cleanup = () => {
    clearTimer();
    area.removeEventListener('click', stageClick);
    window.removeEventListener('keydown', keyHandler);
  };
  const finish = () => {
    if(finished) return;
    finished = true;
    cleanup();
    if(typeof onComplete === 'function') onComplete();
  };
  const advance = () => {
    if(finished || advancing) return;
    advancing = true;
    clearTimer();
    index++;
    if(index >= scenes.length){ finish(); return; }
    render();
    queueMicrotask(() => { advancing = false; });
  };
  const render = () => {
    const scene = scenes[index];
    const safeImage = /^assets\/[\w\-/\u4e00-\u9fa5]+\.(jpg|jpeg|png|webp)$/i.test(scene.image || '') ? scene.image : 'assets/scenes/temple.jpg';
    area.innerHTML = `<div class="prologue-vn" id="prologue-stage" style="background-image:linear-gradient(180deg,rgba(15,10,5,.08),rgba(15,10,5,.3)),url('${safeImage}')" aria-label="序章视觉小说舞台">
      <div class="prologue-box">
        <div class="prologue-chapter">${esc(scene.chapter)}</div><div class="prologue-location">${esc(scene.location)}</div>
        <div class="prologue-line ${scene.highlight ? 'highlight' : ''}">${esc(scene.text)}</div>
        <div class="prologue-controls"><span class="prologue-progress">${index + 1} / ${scenes.length} · 点击文本框继续</span>
          <div class="prologue-actions"><button class="prologue-control" id="prologue-auto" aria-pressed="${auto}">${auto ? '自动播放：开' : '自动播放：关'}</button><button class="prologue-control" id="prologue-skip">跳过序章</button><button class="prologue-control primary" id="prologue-next">继续 ▶</button></div>
        </div>
      </div></div>`;
    $('prologue-next').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); advance(); });
    $('prologue-skip').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); finish(); });
    $('prologue-auto').addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation(); auto = !auto; render();
    });
    clearTimer();
    if(auto) autoTimer = setTimeout(advance, Math.round(3600 * settingNumber('dldl_text_speed', 1)));
  };
  const stageClick = event => {
    if(!event.target.closest('#prologue-stage') || event.target.closest('button')) return;
    event.preventDefault(); event.stopPropagation(); advance();
  };
  const keyHandler = event => {
    if(finished || ![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); advance();
  };
  area.addEventListener('click', stageClick);
  window.addEventListener('keydown', keyHandler);
  render();
}

const EARLY_LIFE_ORIGINS = {
  star_forest:{ place:'圣魂村外', person:'村中老铁匠', image:'assets/scenes/forest_outer.jpg', memory:'林风与铁锤声陪伴你长大' },
  spirit_city:{ place:'武魂城旧街', person:'家族藏书阁的守卷人', image:'assets/scenes/wuhun_city.jpg', memory:'礼法、典籍与家族期待环绕着你' },
  border_town:{ place:'边境城墙', person:'守城队长', image:'assets/scenes/border_town.jpg', memory:'警钟和药草气味教会你珍惜安宁' },
  sea_island:{ place:'海边渔村', person:'识潮的老船长', image:'assets/scenes/sea_god_island.jpg', memory:'潮汐与风暴磨出了你的耐性' }
};

function earlyLifeNodes(){
  const origin = EARLY_LIFE_ORIGINS[G.origin] || EARLY_LIFE_ORIGINS.star_forest;
  const spirit = G.spirit || { name:'武魂', type:'未知' };
  const homeLocation = {
    star_forest:'holy_soul_village', spirit_city:'wuhun_city',
    border_town:'tian_dou_city', sea_island:'sea_god_island'
  }[G.origin] || 'shrek_academy';
  return [
    { id:`early_family_${G.origin}`, stage:'family', minLevel:1, name:'家的灯火', location:origin.place, image:origin.image,
      text:`${origin.memory}。入学前的最后一个清晨，家里还有许多事要做。你决定——`, choices:[
        { id:'help', text:'留下帮家人做完手头的活', path:'loyal', result:{ defense:1 }, reply:'你学会了把力量用在照顾身边的人上。' },
        { id:'train', text:'先完成今日的基础锻炼', path:'pragmatic', result:{ attack:1 }, reply:'一遍遍扎实的动作，让你的根基更稳。' },
        { id:'listen', text:'听家人再讲一次故乡往事', path:'scholar', result:{ fate:1 }, reply:'那些往事成为你日后辨认归途的坐标。' }
      ] },
    { id:`early_person_${G.origin}`, stage:'mentor', minLevel:1, name:'重要的人', location:origin.place, image:origin.image,
      text:`${origin.person}在路口等你。对方没有替你选择道路，只问：“成为魂师以后，你最想守住什么？”`, choices:[
        { id:'people', text:'守住重要的人', path:'merciful', result:{ defense:1 }, reply:'对方点点头，把一句“莫忘本心”留给了你。' },
        { id:'truth', text:'守住求知与判断', path:'scholar', result:{ spiritPowerGain:1 }, reply:'一册写满批注的旧笔记被郑重交到你手中。' },
        { id:'freedom', text:'守住选择自己道路的自由', path:'rebel', result:{ speed:1 }, reply:'你第一次清楚说出了属于自己的答案。' }
      ] },
    { id:`early_spirit_${spirit.id}`, stage:'first-resonance', minLevel:1, name:'第一次武魂感应', location:'入学前夜', image:spirit.image || 'assets/scenes/library_night.jpg',
      text:`夜深时，「${spirit.name}」在你的心海中轻轻回应。作为${spirit.type || '独特武魂'}，它没有催促你证明强弱，只将一缕魂力递到你面前。`, choices:[
        { id:'accept', text:'坦然接纳这份力量', path:'ambitious', result:{ attack:1 }, reply:`你与「${spirit.name}」的气息第一次完整重合。` },
        { id:'observe', text:'先观察魂力如何流转', path:'tactician', result:{ defense:1 }, reply:'你记住了每一次明暗变化，对自己的武魂多了一分理解。' },
        { id:'promise', text:'许诺绝不轻视任何武魂', path:'saint', result:{ fate:1 }, reply:'那缕魂光温和地亮了一瞬，像是在回应你的承诺。' }
      ] },
    { id:`early_registration_${G.origin}`, stage:'registration', minLevel:1, name:'魂师登记与评定', location:`${origin.place} · 武魂殿分殿`, image:'assets/scenes/temple.jpg',
      text:`觉醒后的手续不能只靠一纸天赋。你来到${origin.place}的武魂殿分殿，登记武魂、测定魂力，并听取执事对未来修炼方向的建议。`, choices:[
        { id:'register', text:'如实登记，接受完整评定', path:'prudent', result:{ spiritPowerGain:2, fate:1 }, reply:'执事将你的武魂与魂力等级记入档案，并提醒你：十级之后必须获取魂环，不能靠药物强行越阶。', after:'registered' },
        { id:'question', text:'追问不同武魂的修炼道路', path:'scholar', result:{ spiritPowerGain:1, defense:1 }, reply:'你问了许多细节，执事虽然忙碌，仍认真告诉你学院与宗门的区别。', after:'registered' },
        { id:'private', text:'只登记必要信息，保留家族底牌', path:'prudent', result:{ speed:1, fate:-1 }, reply:'你谨慎地收起评定单，决定用接下来的表现赢得真正的推荐。', after:'registered' }
      ] },
    { id:`early_recommendation_${G.origin}`, stage:'recommendation', minLevel:1, name:'入学资格与推荐', location:origin.place, image:origin.image,
      text:'登记完成后，你面临的不是“被传送进学院”，而是一次真正的选择：凭什么进入更好的魂师学院，又愿意用什么证明自己？', choices:[
        { id:'shrek_recommend', text:'接受史莱克学院的入学推荐', path:'sect_master', result:{ fate:1, exp:15 }, reply:'推荐信上盖下了印章。史莱克学院愿意给你一次入学考核的机会，但最终仍要靠自己的表现留下。', after:'recommended' },
        { id:'local_then_shrek', text:'先在当地学院打基础，再申请转入', path:'pragmatic', result:{ defense:1, exp:25 }, reply:'你选择稳扎稳打，先用基础训练证明自己；推荐人答应把你的档案转交史莱克。', after:'recommended' },
        { id:'self_recommend', text:'自荐参加史莱克的公开考核', path:'rebel', result:{ attack:1, speed:1 }, reply:'你没有等待别人替你背书，而是在报名册上写下自己的名字，约定前往学院接受考核。', after:'recommended' }
      ] },
    { id:`early_enrollment_${G.origin}`, stage:'enrollment', minLevel:1, name:'报到与分班', location:'史莱克学院', image:'assets/scenes/academy_classroom.jpg',
      text:'几日后，你抵达史莱克学院。门口没有凭空出现的“新手传送”，只有登记、核验、入学考核与分班。弗兰德看过你的档案，给了你最后一个选择。', choices:[
        { id:'combat_class', text:'选择实战班，从训练场开始', path:'ambitious', result:{ attack:1, hp:10 }, reply:'你在分班册上写下名字，决定用一次次实战赢得同伴与老师的认可。', after:'enrolled' },
        { id:'theory_class', text:'选择理论与战术班，先打牢基础', path:'scholar', result:{ defense:1, spiritPowerGain:1 }, reply:'你选择先理解武魂、魂兽与战术，再把知识变成战场上的判断。', after:'enrolled' },
        { id:'balanced_class', text:'选择综合班，边学边找方向', path:'pragmatic', result:{ speed:1, fate:1 }, reply:'你没有急着给自己贴标签，决定在学院生活中慢慢找到真正适合自己的道路。', after:'enrolled' }
      ] }
  ].map(node => ({ ...node, homeLocation }));
}

const EARLY_STAGE_LABELS = {
  family:'故乡记忆', mentor:'成长引路', 'first-resonance':'武魂初鸣',
  registration:'魂师登记', recommendation:'入学抉择', enrollment:'学院报到'
};

function playEarlyLifeNodes(onComplete){
  if(G._earlyLifeDone){ if(onComplete) onComplete(); return; }
  const allNodes = earlyLifeNodes();
  const nodes = allNodes.filter(node => !G.doneEvents.includes(node.id) && G.level >= node.minLevel);
  let index = 0;
  let choosing = false;
  const next = () => {
    if(index >= nodes.length){
      G._earlyLifeDone = true;
      if(G._enrollmentComplete && !G._firstClassDone) G._introPendingEvent = 'first_class';
      saveLocal();
      if(onComplete) onComplete();
      return;
    }
    const node = nodes[index];
    const area = $('scene-area');
    const stageLabel = EARLY_STAGE_LABELS[node.stage] || '成长经历';
    area.innerHTML = `<div class="scene-location">【${esc(node.location)} · ${esc(stageLabel)}】</div><div class="scene-title">${esc(node.name)}</div><img class="scene-img" src="${esc(node.image)}" alt="" onerror="this.style.display='none'"><div class="scene-text"><p>${esc(node.text)}</p></div><div class="choices">${node.choices.map((choice, choiceIndex) => `<button class="choice-btn" data-early-choice="${choiceIndex}"><span class="ck">${String.fromCharCode(65 + choiceIndex)}</span>${esc(choice.text)}</button>`).join('')}</div>`;
    area.querySelectorAll('[data-early-choice]').forEach(button => button.addEventListener('click', () => {
      if(choosing) return;
      const choice = node.choices[Number(button.dataset.earlyChoice)];
      if(!choice || G.doneEvents.includes(node.id)) return;
      choosing = true;
      area.querySelectorAll('[data-early-choice]').forEach(item => { item.disabled = true; });
      G.choices[node.id] = choice.id;
      G._storyDecisions[node.id] = choice.id;
      G._storyPath.push(choice.path);
      if(!G.doneEvents.includes(node.id)) G.doneEvents.push(node.id);
      applyResultRewards(choice.result);
      if(choice.after === 'registered') G._registeredAtHall = true;
      if(choice.after === 'recommended') G._academyRecommendation = choice.id;
      if(choice.after === 'enrolled'){
        G._enrollmentComplete = true;
        G._currentLocation = 'shrek_academy';
        visitLocation('shrek_academy', { silent:true });
        G._introPendingEvent = 'first_class';
      }
      completeWorldAction();
      addDiaryEntry(`【早年经历】${node.name}：${choice.reply}`, 'event');
      saveLocal(); refreshPanel(); index++;
      renderContinue(node, `${esc(choice.reply)}<br><span class="hl-gold">这段经历已写入你的成长轨迹。</span>`, () => { choosing = false; next(); });
    }));
  };
  next();
}

// ==================== 属性计算 ====================
/**
 * 统一基础属性计算（不含魂环、锻造、称号、技能树、NPC好感等运行时加成）
 * 供 previewStats 和 finalStats 共用，确保预览和实际属性始终一致。
 */
function calcBaseStats(spiritBase, originBonus, level, weapon){
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const factor = 1 + lv * 0.05;
  const weaponAtk = weapon ? Number(weapon.attack) || 0 : 0;
  const bonus = originBonus || { attack:0, defense:0, hp:0, speed:0 };
  return {
    attack: Math.round((spiritBase.attack||0) * factor + (bonus.attack||0) + weaponAtk),
    defense: Math.round((spiritBase.defense||0) * factor + (bonus.defense||0)),
    hp: Math.round((spiritBase.hp||0) * factor + (bonus.hp||0) + 60),
    speed: Math.round((spiritBase.speed||0) * factor + (bonus.speed||0))
  };
}

/** 预览属性计算（与 finalStats 使用相同公式，仅用于觉醒界面预览） */
function previewStats(spirit, origin, level){
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const weaponAtk = origin.weapon ? (origin.weapon.attack || 0) : 0;
  const stats = origin.stats || { attack:0, defense:0, hp:0, speed:0 };
  // 调用统一函数，确保与 finalStats 的基础部分一致
  const base = calcBaseStats(
    { attack:spirit.attack||0, defense:spirit.defense||0, hp:spirit.hp||0, speed:spirit.speed||0 },
    stats,
    lv,
    origin.weapon || null
  );
  return base;
}

function finalStats(){
  const lv = G.level;
  let ringAtk = 0, ringDef = 0, ringHp = 0;
  (G.rings || []).forEach(r => {
    const bonus = r.bonus || {};
    ringAtk += Number(bonus.attack) || 0;
    ringDef += Number(bonus.defense) || 0;
    ringHp += Number(bonus.hp) || 0;
  });
  const crafted = G._craftedBones || [];
  const craftedAtk = crafted.reduce((sum, bone) => sum + (Number(bone.attack) || 0), 0);
  const craftedDef = crafted.reduce((sum, bone) => sum + (Number(bone.defense) || 0), 0);
  const craftedHp = crafted.reduce((sum, bone) => sum + (Number(bone.hp) || 0), 0);
  const craftedSpd = crafted.reduce((sum, bone) => sum + (Number(bone.speed) || 0), 0);
  const weaponAtk = G.weapon ? Number(G.weapon.attack) || 0 : 0;
  // 技能树加成
  const sb = G._skillBonuses || {};
  // 称号加成
  const tAtk = getTitleBonus('attack');
  const tDef = getTitleBonus('defense');
  const tHp = getTitleBonus('hp');
  const tSpd = getTitleBonus('speed');

  // 使用统一基础属性计算函数，确保与 previewStats 一致
  const base = calcBaseStats(G.spiritBase, G.originBonus, lv, G.weapon);
  let attack = base.attack + G.bonus.attack + ringAtk + craftedAtk + tAtk;
  let defense = base.defense + G.bonus.defense + ringDef + craftedDef + tDef;
  let maxHp = base.hp + G.bonus.hp + ringHp + craftedHp + tHp;
  let speed = base.speed + G.bonus.speed + craftedSpd + tSpd;

  // 应用技能树与阵法加成。
  const formation = getActiveFormation();
  attack = Math.round(attack * (1 + (sb.attackMult || 0) + (formation.attack || 0)));
  defense = Math.round(defense * (1 + (sb.defenseMult || 0) + (formation.defense || 0)));
  maxHp = Math.round(maxHp * (1 + (sb.hpMult || 0)));
  speed = Math.round(speed * (1 + (sb.speedMult || 0) + (formation.speed || 0)));

  // NPC好感度加成
  const npcBonus = getNpcRelationBonuses();
  attack += npcBonus.attack;
  defense += npcBonus.defense;
  maxHp += npcBonus.hp;
  speed += npcBonus.speed;

  return { attack, defense, maxHp, speed, npcBonus };
}

// 属性变化闪烁动画
function flashStat(id, cur, prev){
  if(cur === prev) return;
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth; // 强制回流
  el.classList.add(cur > prev ? 'flash-up' : 'flash-down');
}

function refreshPanel(){
  const fs = finalStats();
  G.hp = Number.isFinite(Number(G.hp)) ? Math.min(Number(G.hp), fs.maxHp) : fs.maxHp;
  const maxSpiritPower = getMaxSpiritPower();
  G.spiritPower = Number.isFinite(Number(G.spiritPower)) ? Math.min(Number(G.spiritPower), maxSpiritPower) : maxSpiritPower;
  $('sp-name').textContent = G.name;
  $('sp-lv').textContent = G.level;
  $('sp-phase').textContent = phaseName(G.level);
  $('sp-spirit-name').textContent = G.spirit.name + '（' + TIER_NAMES[G.spirit.tier] + '）';
  // 武魂特质与命运路线
  const traitEl = $('sp-traits');
  if(traitEl && G._personality){
    const traits = (G._personality.traits || []).slice(0, 3);
    traitEl.innerHTML = traits.map(t => `<span class="trait-tag">${esc(t)}</span>`).join('') +
      `<span class="destiny-tag">✦ ${esc(G._destiny && G._destiny.name ? G._destiny.name : '')}</span>`;
  }
  const img = $('sp-spirit-img');
  img.replaceChildren();
  if(G.spirit.image){
    const spiritImage = document.createElement('img');
    spiritImage.src = G.spirit.image;
    spiritImage.alt = G.spirit.name || '武魂';
    spiritImage.addEventListener('error', () => {
      img.textContent = G.spirit.icon || '✦';
    }, { once:true });
    img.appendChild(spiritImage);
  }else{
    img.textContent = G.spirit.icon || '✦';
  }
  $('hp-text').textContent = `${G.hp} / ${fs.maxHp}`;
  $('hp-bar').style.width = Math.max(0, G.hp / fs.maxHp * 100) + '%';
  $('mp-text').textContent = `${G.spiritPower} / ${maxSpiritPower}`;
  $('mp-bar').style.width = Math.max(0, G.spiritPower / maxSpiritPower * 100) + '%';
  const need = expNeed(G.level);
  const progressionActive = Number(G._progressionRulesVersion) >= 2;
  const atRingGate = progressionActive && G.pendingRingLv && G.level >= G.pendingRingLv && G.level < 100;
  const integrityWarning = Array.isArray(G._saveIntegrityWarnings) && G._saveIntegrityWarnings.length
    ? `<span class="status-warning" title="${esc(G._saveIntegrityWarnings.join('；'))}">已校正存档数据</span>` : '';
  const sceneArea = $('scene-area');
  const sceneHasPendingChoice = Boolean(sceneArea && sceneArea.dataset.awaitingChoice === 'true');
  const battleActive = Boolean(G._battleActive || (typeof BattleSystem !== 'undefined' && BattleSystem.isActive && BattleSystem.isActive()));
  const actionLocked = sceneHasPendingChoice || battleActive;
  const freeAdventureReady = Boolean(G._earlyLifeDone && G._firstClassDone && G._prologueDone);
  const storyStatus = $('story-status');
  if(storyStatus){
    const milestone = nextMainStoryMilestone();
    const fullStory = Number(G._mainStoryVersion) >= 1;
    const target = milestone && resolveMapLocation(milestone.targetId);
    const remaining = milestone ? Math.max(0, (Number(G._storyMilestoneDeferredUntil) || 0) - (Number(G._eventCount) || 0)) : 0;
    storyStatus.className = 'story-status visible';
    if(G.finished){
      storyStatus.innerHTML = '<span>主线已完成</span>' + integrityWarning;
    }else if(!fullStory){
      const legacyReady = milestone && G.level >= milestone.minLevel;
      const legacyActions = actionLocked ? '' : `<div class="status-actions"><button type="button" class="status-action" data-status-action="adventure">继续历练</button>${legacyReady ? '<button type="button" class="status-action primary" data-status-action="story">查看最终决战</button>' : '<button type="button" class="status-action" data-status-action="train">修炼</button>'}</div>`;
      storyStatus.innerHTML = `<span>旧档兼容：自由成长${legacyReady ? ` · 可前往${esc(target ? target.name : milestone.targetId)}挑战最终决战` : ` · Lv.${milestone ? milestone.minLevel : 95}后开放最终决战`}</span>${legacyActions}${integrityWarning}`;
    }else if(milestone){
      const ready = G.level >= milestone.minLevel;
      const label = ready
        ? `主线目标：${esc(milestone.name)}${target ? ` · 前往${esc(target.name)}` : ''}${remaining ? ` · 暂缓${remaining}次行动` : ''}`
        : `下一主线：Lv.${milestone.minLevel}「${esc(milestone.name)}」 · 还需${Math.max(0, milestone.minLevel - G.level)}级`;
      const actions = !freeAdventureReady || actionLocked ? '' : (ready
        ? `<button type="button" class="status-action primary" data-status-action="story">${remaining ? '查看主线目标' : '开始主线'}</button><button type="button" class="status-action" data-status-action="map">查看地图</button>`
        : '<button type="button" class="status-action primary" data-status-action="train">进入修炼</button><button type="button" class="status-action" data-status-action="adventure">继续历练</button>');
      storyStatus.innerHTML = `<span>${label}</span>${actions ? `<div class="status-actions">${actions}</div>` : ''}${integrityWarning}`;
    }else{
      const fallbackActions = !freeAdventureReady || actionLocked ? '' : '<div class="status-actions"><button type="button" class="status-action primary" data-status-action="train">进入修炼</button><button type="button" class="status-action" data-status-action="adventure">继续历练</button></div>';
      storyStatus.innerHTML = `<span>主线目标：继续修炼，迎接最终命运</span>${fallbackActions}${integrityWarning}`;
    }
  }
  const ringStatus = $('ring-status');
  if(ringStatus){
    const ringCount = (G.rings || []).length;
    let statusText = `魂环 ${ringCount}/9`;
    let statusClass = 'visible';
    let actions = '';
    if(!progressionActive){
      statusText += ' · 旧档沿用自由成长规则';
      actions = '<button type="button" class="status-action" data-status-action="adventure">继续历练</button>';
    }else if(G.pendingRingLv && G.level < 100){
      const remaining = Math.max(0, (Number(G._ringHuntDeferredUntil) || 0) - (Number(G._eventCount) || 0));
      statusText = remaining > 0
        ? `第${ringCount + 1}魂环待猎取 · 暂缓中，还需历练${remaining}次`
        : `第${ringCount + 1}魂环待猎取 · Lv.${G.pendingRingLv}门槛已达`;
      if(remaining > 0) statusClass += ' warn';
      actions = `<button type="button" class="status-action primary" data-status-action="ring">${remaining ? '查看猎环' : '开始猎环'}</button>${remaining ? '<button type="button" class="status-action" data-status-action="adventure">继续历练</button>' : ''}`;
    }else if(progressionActive && ringCount < 9){
      const nextRingLevel = (GameRules.RING_LEVELS || [10,20,30,40,50,60,70,80,90])[ringCount];
      statusText += ` · 下一魂环 Lv.${nextRingLevel} · 还需${Math.max(0, nextRingLevel - G.level)}级`;
      actions = '<button type="button" class="status-action primary" data-status-action="train">进入修炼</button>';
    }else if(ringCount >= 9){
      statusText += ' · 九环已齐';
    }
    ringStatus.className = `ring-status ${statusClass}`;
    if(actionLocked) actions = '';
    ringStatus.innerHTML = `<span>${statusText}</span>${actions ? `<div class="status-actions">${actions}</div>` : ''}${integrityWarning}`;
  }
  if(G.level >= 100){
    $('exp-text').textContent = 'MAX';
    $('exp-bar').style.width = '100%';
  }else if(atRingGate){
    const stored = Number(G.overflowExp) || 0;
    $('exp-text').textContent = `魂环门槛 · 已储存 ${stored} 经验`;
    $('exp-bar').style.width = '100%';
  }else{
    $('exp-text').textContent = `${G.exp} / ${need}`;
    $('exp-bar').style.width = Math.min(100, G.exp / need * 100) + '%';
  }
  // 属性变化闪烁动画
  if(!G._prevStats) G._prevStats = { attack:0, defense:0, hp:0, speed:0, gold:0 };
  flashStat('at-attack', fs.attack, G._prevStats.attack);
  flashStat('at-defense', fs.defense, G._prevStats.defense);
  flashStat('at-hp', fs.maxHp, G._prevStats.hp);
  flashStat('at-speed', fs.speed, G._prevStats.speed);
  flashStat('sp-gold', G.gold, G._prevStats.gold);
  G._prevStats = { attack:fs.attack, defense:fs.defense, hp:fs.maxHp, speed:fs.speed, gold:G.gold };
  $('at-attack').textContent = fs.attack;
  $('at-defense').textContent = fs.defense;
  $('at-hp').textContent = fs.maxHp;
  $('at-speed').textContent = fs.speed;
  $('sp-gold').textContent = G.gold;
  $('sp-fate').textContent = G.fatePoints;
  const compactStatus = $('compact-status');
  if(compactStatus){
    const ringHint = atRingGate ? `第${G.rings.length + 1}魂环待猎取` : `魂环 ${G.rings.length}/9`;
    const compactMilestone = nextMainStoryMilestone();
    const freeAdventureReady = Boolean(G._earlyLifeDone && G._firstClassDone && G._prologueDone);
    let compactAction = '';
    if(freeAdventureReady && !G.finished && !actionLocked){
      if(atRingGate) compactAction = '<button type="button" class="compact-action" data-status-action="ring">开始猎环</button>';
      else if(compactMilestone && G.level >= compactMilestone.minLevel) compactAction = '<button type="button" class="compact-action" data-status-action="story">开始主线</button>';
      else compactAction = '<button type="button" class="compact-action" data-status-action="train">修炼</button>';
    }
    compactStatus.innerHTML = `<span>Lv.${G.level} · ${soulRankName(G.level)} · HP ${Math.round(G.hp)}/${fs.maxHp} · 魂力 ${Math.round(G.spiritPower)}/${maxSpiritPower} · ${ringHint}</span>${compactAction}`;
  }

  const RING_COLORS = {
    white: { bg:'#d4d4d4', text:'#666' },
    yellow: { bg:'#facc15', text:'#5a3e00' },
    purple: { bg:'#a855f7', text:'#fff' },
    black: { bg:'#3b3f4a', text:'#ccc' },
    red: { bg:'#dc2626', text:'#fff' },
    special: { bg:'#fbbf24', text:'#5a3e00' }
  };
  let ringsHtml = '';
  if(!(G.rings || []).length){
    // 首屏：尚未获得任何魂环时，用一张“下一目标”卡替代 9 个空格子，明确行动方向。
    const ringGoal = (GameRules.RING_LEVELS || [10,20,30,40,50,60,70,80,90])[0];
    const goalLv = Number(ringGoal) || 10;
    const goalActions = !progressionActive || actionLocked ? '' : `
      <div class="status-actions rg-goal-actions">
        <button type="button" class="status-action primary" data-status-action="train">进入修炼</button>
        <button type="button" class="status-action" data-status-action="adventure">继续历练</button>
      </div>`;
    const targetText = progressionActive
      ? `Lv.${goalLv} 解锁猎取 · 先修炼提升等级`
      : `自由成长 · 历练中逐步解锁`;
    ringsHtml = `<div class="ring-goal-card">
      <div class="rg-main"><span class="rg-ring">第 1 魂环</span><span class="rg-target">${targetText}</span></div>
      ${goalActions}
    </div>`;
  }else{
    for(let i = 0; i < 9; i++){
      const r = G.rings[i];
      if(r){
        const c = RING_COLORS[r.tier] || RING_COLORS.special;
        const skillName = r.skill || (G.skills[i] && G.skills[i].name) || '未知魂技';
        const source = r.source || r.name || '来源未记录';
        const year = r.yearLabel || r.name || '年份未知';
        ringsHtml += `<button class="ring-card" data-ring-index="${i}" style="--ring-color:${c.bg};--ring-text:${c.text};--ring-tint:${c.bg}22" aria-label="第${i + 1}魂环，${esc(year)}，魂技${esc(skillName)}，来源${esc(source)}"><span class="ring-index">${i + 1}</span><span class="ring-main"><span class="ring-skill">${esc(skillName)}</span><span class="ring-source">${esc(source)}</span></span><span class="ring-year">${esc(year)}</span></button>`;
      }else{
        ringsHtml += `<button class="ring-card empty" disabled aria-label="第${i + 1}魂环，尚未获得"><span class="ring-index">${i + 1}</span><span class="ring-main"><span class="ring-skill">空魂环位</span><span class="ring-source">达到对应等级后猎取</span></span><span class="ring-year">未获得</span></button>`;
      }
    }
  }
  $('rings-row').innerHTML = ringsHtml;
  $('rings-row').querySelectorAll('[data-ring-index]').forEach(button => button.addEventListener('click', () => showRingDetail(Number(button.dataset.ringIndex))));

  // 更新玩家状态图标（无独立图标层，保持清空）
  const playerStatusEl = $('player-status-effects');
  if(playerStatusEl){
    playerStatusEl.innerHTML = '';
  }

  // 更新称号显示
  const titleEl = $('sp-title');
  if(titleEl){
    const title = TITLES.find(t => t.id === G._activeTitle);
    titleEl.textContent = title ? `「${title.name}」` : '';
  }
  // 更新时间/天气显示
  updateTimeWeatherUI();
}

function canUseStatusAction(){
  if(typeof BattleSystem !== 'undefined' && BattleSystem.isActive && BattleSystem.isActive()){
    toast('战斗进行中，请先完成当前回合');
    return false;
  }
  const sceneArea = $('scene-area');
  if(!sceneArea || sceneArea.dataset.awaitingChoice !== 'true') return true;
  const pendingChoice = sceneArea.querySelector('.choices .choice-btn:not(:disabled)');
  toast('请先完成当前剧情选择，再切换行动目标');
  if(pendingChoice) pendingChoice.focus();
  return false;
}

function handleStatusAction(action){
  if(!G || !canUseStatusAction()) return;
  if(action === 'train'){
    openTraining();
    return;
  }
  if(action === 'map'){
    openMap();
    return;
  }
  if(action === 'adventure'){
    nextEvent();
    return;
  }
  if(action === 'ring'){
    const ringEvent = G.pendingRingLv && EVENTS.find(event => event.id === ringEventId(G.pendingRingLv));
    if(ringEvent) renderRingHunt(ringEvent);
    else toast('当前魂环事件数据尚未加载完成');
    return;
  }
  if(action === 'story'){
    const milestone = nextMainStoryMilestone();
    if(!milestone){ toast('当前没有可执行的主线目标'); return; }
    if(G.level < milestone.minLevel){ openTraining(); return; }
    if(!renderMainStoryMilestone(milestone)) toast('当前主线事件数据尚未加载完成');
  }
}

function soulRankName(lv){
  if(lv < 10) return '魂士';
  if(lv < 20) return '魂师';
  if(lv < 30) return '大魂师';
  if(lv < 40) return '魂尊';
  if(lv < 50) return '魂宗';
  if(lv < 60) return '魂王';
  if(lv < 70) return '魂帝';
  if(lv < 80) return '魂圣';
  if(lv < 90) return '魂斗罗';
  if(lv < 100) return '封号斗罗';
  return '神级魂师';
}
function phaseName(lv){
  if(lv <= 6) return `学院篇 · ${soulRankName(lv)}`;
  if(lv <= 18) return `实战篇 · ${soulRankName(lv)}`;
  if(lv <= 40) return `进阶篇 · ${soulRankName(lv)}`;
  return `神途篇 · ${soulRankName(lv)}`;
}
function currentPhase(){
  const lv = G.level;
  if(lv <= 6) return 'academy';
  if(lv <= 18) return 'adventure';
  if(lv <= 40) return 'master';
  return 'god';
}

// ==================== 存档 ====================
function saveLocal(){
  if(!G) return false;
  try{
    const migrated = SaveUtils.migrateSave({ ...G, gameMode:'text-rpg' });
    if(!migrated) throw new Error('存档核心字段不完整');
    migrated._saveTime = Date.now();
    const serialized = JSON.stringify(migrated);
    const currentRaw = localStorage.getItem(LS_KEY);
    if(currentRaw && currentRaw !== serialized){
      // 主存档永远代表当前正在游玩的角色；旧角色只进入备份链，不阻止新角色保存。
      for(let i = 4; i >= 1; i--){
        const older = localStorage.getItem(`${LS_KEY}_hist${i}`);
        if(older) localStorage.setItem(`${LS_KEY}_hist${i + 1}`, older);
      }
      const backup = localStorage.getItem(LS_KEY + '_backup');
      if(backup) localStorage.setItem(LS_KEY + '_hist1', backup);
      localStorage.setItem(LS_KEY + '_backup', currentRaw);
    }
    localStorage.setItem(LS_KEY, serialized);
    G = migrated;
    window.G = G;
    return true;
  }catch(e){
    console.error('本地存档失败:', e);
    if(!G || !G._suppressSaveToast) toast('存档写入失败：浏览器存储空间可能已满');
    return false;
  }
}

// 页面离开/切后台时推送云端存档（C-b）：覆盖 interval 存档的盲区，崩溃/杀进程最多丢数秒。
let lastCloudPushAt = 0;
async function pushCloudSaveOnLeave(){
  if(!G || G.finished || typeof navigator === 'undefined' || navigator.onLine === false) return;
  const now = Date.now();
  if(now - lastCloudPushAt < 3000) return;
  lastCloudPushAt = now;
  try{ await saveServer(true); }catch(e){ /* 尽力而为，失败由下次 interval 或手动保存兜底 */ }
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') pushCloudSaveOnLeave();
});
window.addEventListener('pagehide', () => { pushCloudSaveOnLeave(); });

// D：多标签互斥——其他窗口保存了不同角色时本窗口明确提示，防止静默互相覆盖
window.addEventListener('storage', event => {
  if(!G || event.key !== LS_KEY) return;
  try{
    const other = JSON.parse(String(event.newValue));
    if(other && other.playerId && other.playerId !== G.playerId){
      toast(`检测到另一窗口正在游玩「${other.name}」（Lv.${other.level}），本窗口保存可能被覆盖，请及时回标题页选择存档`);
    }else if(other && other.playerId === G.playerId && other._saveTime && G._saveTime && other._saveTime > G._saveTime){
      toast('本存档已在其他窗口更新，建议重新读取');
    }
  }catch(e){ /* 解析失败忽略 */ }
});
async function saveServer(silent){
  if(!G) return false;
  const localOk = saveLocal();
  try{
    const res = await fetch('/api/player/save', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ playerId:G.playerId, data:G })
    });
    let json = null;
    try{ json = await res.json(); }catch(e){}
    const serverOk = Boolean(res.ok && json && json.success);
    if(!silent){
      if(serverOk) toast('✦ 本地与服务器存档成功');
      else if(localOk) toast('已保存到本地，服务器保存失败');
      else toast('存档失败');
    }
    return serverOk;
  }catch(e){
    if(!silent) toast(localOk ? '已保存到本地，服务器暂不可用' : '存档失败');
    return false;
  }
}

// 自动存档
let autoSaveTimer = null;
function startAutoSave(){
  if(autoSaveTimer){ clearInterval(autoSaveTimer); autoSaveTimer = null; }
  let seconds = 60;
  try{
    const raw = localStorage.getItem('dldl_autosave_seconds');
    if(raw !== null && Number.isFinite(Number(raw))) seconds = Number(raw);
  }catch(e){}
  if(seconds <= 0) return;
  seconds = Math.max(15, seconds);
  autoSaveTimer = setInterval(() => {
    if(G && !G.finished) saveServer(true);
  }, seconds * 1000);
}

// 存档恢复
function recoverSave(){
  const result = SaveUtils.recoverFromStorage(localStorage, LS_KEY);
  if(result.source !== 'none' && result.source !== 'main'){
    toast(`检测到主存档损坏，已从${result.source === 'backup' ? '最近备份' : '历史备份'}恢复`);
    try{ localStorage.setItem(LS_KEY, JSON.stringify(result.data)); }
    catch(e){ console.error('恢复后的存档写入失败:', e); }
  }
  if(result.source === 'none' && localStorage.getItem(LS_KEY)){
    toast('存档无法读取，请删除损坏存档或重新开始');
  }
  return result.data;
}

// ==================== 经验与升级 ====================
function progressionRulesActive(){
  return Boolean(G && Number(G._progressionRulesVersion) >= 2);
}

function gainExp(n){
  if(!G) return { levels:[], capped:false };
  const amount = Math.max(0, Math.round(Number(n) || 0));
  // D-d：满级后经验不再静默蒸发，按 1:1 转化为金币
  if(G.level >= 100 && amount > 0){
    const converted = addGold(amount);
    toast(`满级经验已转化为 ${converted} 金币`);
    return { level:G.level, exp:0, overflowExp:0, levels:[], capped:true };
  }
  const result = GameRules.advanceExperience({
    level:G.level,
    exp:G.exp,
    overflowExp:progressionRulesActive() ? G.overflowExp : 0,
    ringCount:progressionRulesActive() ? (G.rings || []).length : 9
  }, amount, expNeed);
  G.level = result.level;
  G.exp = result.exp;
  G.overflowExp = progressionRulesActive() ? result.overflowExp : 0;
  const ups = result.levels || [];
  if(ups.length){
    const fs = finalStats();
    // D-a：升级恢复生命缺口的一半（连升≥2级才全额恢复），魂力回满；保留升级的正反馈但不“白嫖满血”
    const healRatio = ups.length >= 2 ? 1 : 0.5;
    const healed = Math.round((fs.maxHp - G.hp) * healRatio);
    G.hp = Math.min(fs.maxHp, G.hp + Math.max(0, healed));
    G.spiritPower = getMaxSpiritPower();
    ups.forEach(lv => onLevelUp(lv));
  }else{
    updatePendingRing();
  }
  saveLocal();
  refreshPanel();
  return result;
}

let pendingLevelNotice = null;
let levelNoticeTimer = null;
function queueLevelNotice(level, ringUnlocked){
  if(!pendingLevelNotice) pendingLevelNotice = { from:Math.max(1, level - 1), to:level, ringUnlocked:false };
  pendingLevelNotice.to = Math.max(pendingLevelNotice.to, level);
  pendingLevelNotice.ringUnlocked = pendingLevelNotice.ringUnlocked || Boolean(ringUnlocked);
  clearTimeout(levelNoticeTimer);
  const flush = () => {
    // 成就与升级都属于高优先级反馈，必须顺序展示，不能在移动端互相覆盖正文。
    if(typeof VisualFX !== 'undefined' && VisualFX.isAchievementActive && VisualFX.isAchievementActive()){
      levelNoticeTimer = setTimeout(flush, 180);
      return;
    }
    const notice = pendingLevelNotice; pendingLevelNotice = null;
    const host = $('level-notifications');
    if(!host || !notice) return;
    const element = document.createElement('div');
    element.className = 'level-notice'; element.tabIndex = 0;
    element.innerHTML = `<strong>${notice.from === notice.to ? `等级提升至 Lv.${notice.to}` : `Lv.${notice.from} → Lv.${notice.to}`}</strong><span>生命与魂力已恢复${notice.ringUnlocked ? ` · 新魂环位已解锁，请继续冒险猎取第 ${G.rings.length + 1} 魂环` : ''}</span>`;
    host.appendChild(element);
    setTimeout(() => { element.classList.add('leaving'); setTimeout(() => element.remove(), 260); }, 2500);
  };
  levelNoticeTimer = setTimeout(flush, 60);
}

function showRingDetail(index){
  const ring = G && G.rings && G.rings[index];
  if(!ring) return;
  const skill = (G.skills || [])[index] || {};
  openModal(`第 ${index + 1} 魂环 · ${ring.name || ring.yearLabel || '魂环'}`, `<div class="skill-card sk-${esc(skill.type || ring.skillType || '攻击')}">
    <div class="skill-name">${esc(ring.skill || skill.name || '未知魂技')}</div><div class="skill-meta"><span class="skill-tag" style="color:${esc(ring.color || '#c9a84c')};border-color:${esc(ring.color || '#c9a84c')}">${esc(ring.yearLabel || ring.name || '年份未知')}</span><span class="skill-tag" style="color:#a89a7c;border-color:#4a3d22">${esc(skill.type || ring.skillType || '魂技')}</span></div>
    <div class="skill-desc">${esc(skill.desc || ring.skillDesc || '该魂技的详细记录尚待补全。')}</div><div style="margin-top:10px;color:#a89a7c;font-size:13px">来源：${esc(ring.source || '来源未记录')} · 消耗：${Number(skill.cost || (ring.skillDef && ring.skillDef.cost)) || 0} 魂力 · 冷却：${Number(skill.cooldown || (ring.skillDef && ring.skillDef.cooldown)) || 0} 回合</div>
  </div>`);
}

// 最近事件冷却：避免短期内重复同一事件
function recentCooldown(pool){
  if(!G._recentEvents) G._recentEvents = [];
  const recent = G._recentEvents;
  // 过滤掉最近12个事件中出现的（除非事件总数不够）
  const filtered = pool.filter(e => !recent.includes(e.id));
  if(filtered.length >= 3) return filtered;
  // 如果过滤后太少，只过滤最近5个
  const recent5 = recent.slice(-5);
  const filtered2 = pool.filter(e => !recent5.includes(e.id));
  return filtered2.length >= 2 ? filtered2 : pool;
}

// 根据已获魂环数推导下一个待获取魂环的等级。
// 旧存档按兼容策略继续沿用原有等级，不被新门槛强行倒退；新档启用硬门槛。
function updatePendingRing(){
  if(!G) return null;
  if(!progressionRulesActive()){
    G.pendingRingLv = null;
    return null;
  }
  const ringLvs = GameRules.RING_LEVELS || [10,20,30,40,50,60,70,80,90];
  const idx = Math.max(0, (G.rings || []).length);
  if(idx < ringLvs.length && G.level >= ringLvs[idx]) G.pendingRingLv = ringLvs[idx];
  else G.pendingRingLv = null;
  return G.pendingRingLv;
}

function onLevelUp(lv){
  const hadRing = !!G.pendingRingLv;
  updatePendingRing();
  const ringUnlocked = Boolean(G.pendingRingLv && (!hadRing || [10,20,30,40,50,60,70,80,90].includes(lv)));
  // 升级反馈不阻断剧情或战斗，多级提升由队列合并成一条横幅。
  AudioFX.playSfx('levelup');
  const panel = document.querySelector('.status-panel');
  if(panel){
    const rect = panel.getBoundingClientRect();
    ParticleEngine.emit('levelUp', rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, window.innerHeight / 2));
  }
  VisualFX.flash('gold', 200);
  checkAchievements();
  addDiaryEntry(`等级提升至 Lv.${lv}！`, 'levelup');
  checkQuests();
  queueLevelNotice(lv, ringUnlocked);
}

// ==================== 魂环与技能生成 ====================
const SKILL_PREFIX = {
  '器武魂': ['破空', '流光', '震岳', '穿云'],
  '兽武魂': ['狂暴', '撕天', '啸月', '裂地'],
  '植物系': ['缠绕', '荆棘', '春生', '寄生'],
  '食物系': ['甘露', '回春', '盛宴', '滋养'],
  '本体武魂': ['金刚', '瞬影', '神行', '不灭']
};
const SKILL_ACTION = ['斩', '击', '刺', '舞', '闪', '护', '芒', '印'];

const SKILL_EFFECTS = {
  '斩':{type:'攻击',desc:'凌厉一击，对目标造成高额伤害',anim:'slash'},
  '击':{type:'攻击',desc:'刚猛重击，有几率击退目标',anim:'smash'},
  '刺':{type:'攻击',desc:'精准突刺，暴击率提升',anim:'stab'},
  '舞':{type:'群攻',desc:'武魂舞动，对范围内敌人造成伤害',anim:'spin'},
  '闪':{type:'闪避',desc:'身形闪动，提升闪避率并反击',anim:'dash'},
  '护':{type:'防御',desc:'魂力护体，大幅提升防御',anim:'shield'},
  '芒':{type:'远程',desc:'魂力外放，发射能量攻击',anim:'beam'},
  '印':{type:'控制',desc:'凝结魂印，有几率封印目标行动',anim:'seal'},
  '缠绕':{type:'控制',desc:'藤蔓缠绕，束缚目标行动',anim:'bind'},
  '荆棘':{type:'反伤',desc:'荆棘护盾，反弹受到的伤害',anim:'thorns'},
  '春生':{type:'治疗',desc:'春生万物，恢复自身生命',anim:'heal'},
  '寄生':{type:'持续',desc:'寄生种子，持续吸取目标生命',anim:'drain'},
  '甘露':{type:'治疗',desc:'甘露降世，恢复队友生命',anim:'bless'},
  '回春':{type:'治疗',desc:'回春之术，持续恢复生命',anim:'regen'},
  '盛宴':{type:'增益',desc:'食物盛宴，全属性临时提升',anim:'feast'},
  '滋养':{type:'增益',desc:'滋养身心，提升魂力恢复速度',anim:'nourish'},
  '狂暴':{type:'增益',desc:'进入狂暴状态，攻击力暴涨',anim:'rage'},
  '撕天':{type:'强攻',desc:'撕裂天空，造成巨额伤害',anim:'tear'},
  '啸月':{type:'群攻',desc:'仰天长啸，音波攻击周围敌人',anim:'roar'},
  '裂地':{type:'群攻',desc:'裂地一击，震飞周围敌人',anim:'quake'},
  '破空':{type:'强攻',desc:'破空一击，无视部分防御',anim:'pierce'},
  '流光':{type:'速攻',desc:'流光一闪，极速连击',anim:'flash'},
  '震岳':{type:'强攻',desc:'震岳之威，造成伤害并眩晕',anim:'stun'},
  '穿云':{type:'远程',desc:'穿云箭/气，超远程打击',anim:'arrow'},
  '金刚':{type:'防御',desc:'金刚不坏，短时间免疫伤害',anim:'iron'},
  '瞬影':{type:'闪避',desc:'瞬影无踪，完全闪避下次攻击',anim:'blink'},
  '神行':{type:'增益',desc:'神行百变，速度大幅提升',anim:'swift'},
  '不灭':{type:'复活',desc:'不灭战体，濒死时恢复生命',anim:'revive'}
};

function genSkillName(){
  const type = G.spirit.type || '器武魂';
  const pool = SKILL_PREFIX[type] || SKILL_PREFIX['器武魂'];
  return pick(pool) + pick(SKILL_ACTION);
}

function getSkillDesc(skillName){
  for(const key in SKILL_EFFECTS){
    if(skillName.includes(key)) return SKILL_EFFECTS[key];
  }
  return {type:'攻击',desc:'发动魂技攻击',anim:'beam'};
}

// 魂兽不再只是来源文字：其属性、栖息环境和特殊能力会稳定影响魂技。
const BEAST_SKILL_PROFILES = [
  { test:/蛛|虫|毒/, prefix:['蛛网','蚀毒','缚魂'], action:['缠','刺','印'], type:'控制', desc:'以魂兽毒性与蛛网之力限制目标行动。', anim:'bind', element:'poison', reward:{ defense:1 } },
  { test:/鹿|兔|燕|蝶|鸟|禽|狐/, prefix:['逐风','幻影','灵跃'], action:['闪','舞','印'], type:'速攻', desc:'借魂兽的速度制造残影并连续突进。', anim:'dash', element:'wind', reward:{ speed:2 } },
  { test:/虎|狼|熊|猿|豹|狮|龙/, prefix:['裂爪','震岳','撕天'], action:['击','斩','啸'], type:'强攻', desc:'将魂兽的力量化为正面爆发，撕开敌方防线。', anim:'smash', element:'earth', reward:{ attack:2 } },
  { test:/蛇|鳄|蛟|鲸|鲨|海/, prefix:['潮汐','寒鳞','噬浪'], action:['刺','涌','印'], type:'持续', desc:'以水域魂力持续侵蚀目标，并削弱其行动。', anim:'drain', element:'water', reward:{ defense:1, speed:1 } },
  { test:/藤|草|树|植物/, prefix:['荆棘','寄生','森罗'], action:['缠绕','印','舞'], type:'控制', desc:'召唤植物根须束缚目标，逐步扩大控制范围。', anim:'bind', element:'wood', reward:{ defense:2 } }
];

function getBeastSkillProfile(beast){
  if(!beast) return null;
  const text = `${beast.name || ''} ${beast.type || ''} ${beast.specialAbility || ''}`;
  return BEAST_SKILL_PROFILES.find(profile => profile.test.test(text)) || null;
}

function genSkillNameForBeast(beast){
  const profile = getBeastSkillProfile(beast);
  if(!profile) return genSkillName();
  const seed = String(beast.id || beast.name || '').length + (G.rings || []).length;
  return profile.prefix[seed % profile.prefix.length] + profile.action[seed % profile.action.length];
}

const RING_DEF_BY_KIND = {
  ten: 'white_ring', hundred: 'yellow_ring', thousand: 'purple_ring',
  ten_thousand: 'black_ring', hundred_thousand: 'red_ring', red: 'red_ring'
};

const RING_YEAR_INFO = {
  white:  { label:'十年魂环',  max:'423年',   color:'#e8e8e8', glow:'rgba(232,232,232,.5)' },
  yellow: { label:'百年魂环',  max:'999年',   color:'#facc15', glow:'rgba(250,204,21,.5)' },
  purple: { label:'千年魂环',  max:'9999年',  color:'#a855f7', glow:'rgba(168,85,247,.5)' },
  black:  { label:'万年魂环',  max:'99999年', color:'#4b5563', glow:'rgba(75,85,99,.5)' },
  red:    { label:'十万年魂环',max:'百万年',  color:'#dc2626', glow:'rgba(220,38,38,.5)' }
};

function makeRing(ringId, sourceName, beast){
  const def = DATA.rings.find(r => r.id === ringId);
  if(!def) return null;
  const profile = getBeastSkillProfile(beast);
  const skill = genSkillNameForBeast(beast);
  const skillInfo = profile || getSkillDesc(skill);
  const beastElement = beast && (beast.element || beast.type || beast.specialAbility);
  return {
    ringId: def.id,
    skillId: `ring:${def.id}:${(G.rings || []).length + 1}`,
    name: def.name,
    tier: def.tier,
    yearLabel: RING_YEAR_INFO[def.tier]?.label || def.name,
    color: RING_YEAR_INFO[def.tier]?.color || '#c9a84c',
    skill,
    skillType: skillInfo.type,
    skillDesc: skillInfo.desc,
    skillAnim: skillInfo.anim,
    skillElement: profile ? profile.element : (beastElement || null),
    beastId: beast && beast.id || null,
    source: sourceName || def.name,
    bonus: { attack: def.statBonus.attack, defense: def.statBonus.defense, hp: def.statBonus.hp },
    skillDef: { damage: Math.round(20 + G.level * 2.2 + def.statBonus.attack * 0.8), cost: 15 + G.rings.length * 5, cooldown: 3 }
  };
}

function grantRing(ring, sourceText){
  if(!G || !ring || (G.rings || []).length >= 9) return null;
  G.rings.push(ring);
  const fallbackSkillInfo = getSkillDesc(ring.skill);
  const skillInfo = { type:ring.skillType || fallbackSkillInfo.type, desc:ring.skillDesc || fallbackSkillInfo.desc, anim:ring.skillAnim || fallbackSkillInfo.anim };
  const skillEntry = {
    skillId: ring.skillId || `ring:${ring.ringId || ring.name || 'unknown'}:${G.rings.length}`,
    name: ring.skill,
    type: ring.skillType || skillInfo.type,
    desc: ring.skillDesc || skillInfo.desc,
    anim: ring.skillAnim || skillInfo.anim,
    element: ring.skillElement || null,
    damage: ring.skillDef.damage,
    cost: ring.skillDef.cost,
    cooldown: ring.skillDef.cooldown,
    ring: G.rings.length,
    source: ring.source,
    beastId: ring.beastId || null
  };
  G.skills.push(skillEntry);
  updatePendingRing();
  refreshPanel();
  addDiaryEntry(`获得第${G.rings.length}魂环「${ring.name}」，习得魂技「${ring.skill}」。`, 'discovery');
  checkQuests();
  
  // 播放魂环获取粒子特效
  if(typeof ParticleEngine !== 'undefined'){
    if(typeof ParticleEngine.emit === 'function') ParticleEngine.emit('holyBurst', window.innerWidth / 2, window.innerHeight / 2, ring.color);
  }
  
  // 详细的魂环获取弹窗
  const yearInfo = RING_YEAR_INFO[ring.tier] || {};
  const html = `
    <div style="text-align:center;padding:10px 0">
      <div style="position:relative;display:inline-block;margin-bottom:20px">
        <div class="ring-reveal-anim" style="width:120px;height:120px;border-radius:50%;border:6px solid ${ring.color};box-shadow:0 0 40px ${yearInfo.glow||'rgba(201,168,76,.5)'},inset 0 0 30px ${yearInfo.glow||'rgba(201,168,76,.3)'};display:flex;align-items:center;justify-content:center;font-family:'Ma Shan Zheng',serif;font-size:42px;color:${ring.color};text-shadow:0 0 20px ${ring.color};animation:ringRevealPop 1s cubic-bezier(.34,1.56,.64,1)">${G.rings.length}</div>
        <div style="position:absolute;inset:-15px;border-radius:50%;border:2px solid ${ring.color}66;animation:ringSpin 3s linear infinite"></div>
        <div style="position:absolute;inset:-30px;border-radius:50%;border:1px dashed ${ring.color}33;animation:ringSpin 6s linear infinite reverse"></div>
      </div>
      <div style="font-family:'Ma Shan Zheng',serif;font-size:clamp(20px,3vw,28px);color:${ring.color};letter-spacing:4px;margin-bottom:6px;text-shadow:0 0 20px ${yearInfo.glow||'rgba(201,168,76,.4)'}">${esc(ring.yearLabel||ring.name)}</div>
      <div style="font-size:13px;color:#a89a7c;margin-bottom:16px;letter-spacing:2px">第 ${G.rings.length} 魂环 · 来自「${esc(ring.source)}」</div>
      
      <div style="background:rgba(20,16,10,.7);border:1px solid var(--line);border-radius:8px;padding:20px;margin-bottom:16px;text-align:left;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${ring.color},transparent);animation:skillBarGlow 2s ease-in-out infinite"></div>
        <div style="font-family:'Ma Shan Zheng',serif;font-size:22px;color:#e6c878;letter-spacing:3px;margin-bottom:8px">✦ ${esc(ring.skill)} ✦</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <span style="padding:3px 12px;border-radius:20px;border:1px solid ${ring.color}66;font-size:12px;color:${ring.color};background:${ring.color}11">${esc(skillInfo.type)}</span>
          <span style="padding:3px 12px;border-radius:20px;border:1px solid #3a2f1a;font-size:12px;color:#a89a7c">伤害 ${ring.skillDef.damage}</span>
          <span style="padding:3px 12px;border-radius:20px;border:1px solid #3a2f1a;font-size:12px;color:#a89a7c">消耗 ${ring.skillDef.cost}魂力</span>
        </div>
        <div style="font-size:14px;color:#d4c5a0;line-height:2">${esc(skillInfo.desc)}</div>
      </div>
      
      <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:8px">
        <div style="text-align:center;padding:8px 16px"><div style="font-size:12px;color:#a89a7c">攻击</div><div style="font-size:20px;color:#ff8866;font-weight:700">+${ring.bonus.attack}</div></div>
        <div style="text-align:center;padding:8px 16px"><div style="font-size:12px;color:#a89a7c">防御</div><div style="font-size:20px;color:#66aaff;font-weight:700">+${ring.bonus.defense}</div></div>
        <div style="text-align:center;padding:8px 16px"><div style="font-size:12px;color:#a89a7c">生命</div><div style="font-size:20px;color:#7fc48c;font-weight:700">+${ring.bonus.hp}</div></div>
      </div>
      
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px">
        <button class="btn btn-gold" id="btn-ring-ok" style="min-height:42px;padding:10px 28px">继续冒险</button>
        <button class="btn" id="btn-ring-trial" style="min-height:42px;padding:10px 20px;border-color:#a855f7;color:#a855f7">⚔ 试用魂技</button>
        <button class="btn" id="btn-ring-skills" style="min-height:42px;padding:10px 20px">查看所有魂技</button>
      </div>
    </div>`;
  
  // 先完成魂环结算，再在下一帧展示详情弹窗；否则 completeRingEvent 会同步覆盖弹窗，
  // 玩家只能看到“继续冒险”页面而看不到新魂环的属性和魂技。
  setTimeout(() => {
    openModal(`✦ 第${G.rings.length}魂环 · ${esc(ring.yearLabel||ring.name)} ✦`, html);
    const okBtn = document.getElementById('btn-ring-ok');
    const trialBtn = document.getElementById('btn-ring-trial');
    const skillsBtn = document.getElementById('btn-ring-skills');
    if(okBtn) okBtn.addEventListener('click', closeModal);
    if(trialBtn) trialBtn.addEventListener('click', () => {
      closeModal();
      startSkillTrial(skillEntry);
    });
    if(skillsBtn) skillsBtn.addEventListener('click', () => {
      closeModal();
      setTimeout(() => showMySkills(), 200);
    });
  }, 0);
  
  saveLocal();
  return skillEntry;
}

function tierColor(tier){
  return RING_YEAR_INFO[tier]?.color || { white: '#e8e8e8', yellow: '#facc15', purple: '#a855f7', black: '#4b5563', red: '#dc2626', special: '#fbbf24' }[tier] || '#fbbf24';
}

// ==================== 猎环事件 ====================
function ringEventId(lv){ return 'ring_hunt_' + lv; }

const RING_DESTINATIONS = {
  10:'star_duo_outer', 20:'star_duo_outer', 30:'star_duo_deep', 40:'star_duo_deep',
  50:'sunset_forest', 60:'wuhun_city', 70:'star_duo_deep', 80:'sea_god_island', 90:'sky_city'
};

const MAIN_STORY_MILESTONES = [
  { id:'first_hunt', name:'第一次魂兽实战', minLevel:5, targetId:'star_duo_outer' },
  { id:'reach_lv10', name:'修炼至 Lv.10', minLevel:5, requires:['first_hunt'] },
  { id:'soul_master_prelim', name:'魂师大赛·预赛', minLevel:20, targetId:'tian_dou_city', requires:['first_hunt'] },
  { id:'spirit_hall_exam', name:'武魂殿考核', minLevel:25, targetId:'spirit_hall', requires:['soul_master_prelim'] },
  { id:'soul_master_final', name:'魂师大赛·决赛', minLevel:36, targetId:'tian_dou_city', requires:['soul_master_prelim'] },
  { id:'god_trial_sea', name:'神位传承·海神九考', minLevel:75, targetId:'sea_god_island', requires:['soul_master_final'] },
  { id:'final_evil', name:'最终决战·讨伐武魂殿', minLevel:95, targetId:'wuhun_city', requires:['god_trial_sea'] }
];

function nextMainStoryMilestone(){
  if(!G) return null;
  const fullStory = Number(G._mainStoryVersion) >= 1;
  if(!fullStory){
    const finalMilestone = MAIN_STORY_MILESTONES.find(item => item.id === 'final_evil');
    return finalMilestone && !(G.doneEvents || []).includes('final_evil') ? finalMilestone : null;
  }
  return MAIN_STORY_MILESTONES.find(item => {
    if((G.doneEvents || []).includes(item.id)) return false;
    return (item.requires || []).every(id => (G.doneEvents || []).includes(id));
  }) || null;
}

function findLocationPath(fromId, targetId){
  if(!DATA.mapData || !fromId || !targetId) return [];
  if(fromId === targetId){
    const same = DATA.mapData.find(location => location.id === fromId);
    return same ? [same] : [];
  }
  const byId = new Map(DATA.mapData.map(location => [location.id, location]));
  const queue = [fromId];
  const previous = new Map([[fromId, null]]);
  while(queue.length){
    const currentId = queue.shift();
    if(currentId === targetId) break;
    const current = byId.get(currentId);
    if(!current) continue;
    const neighbors = new Set(current.connectedTo || []);
    // 部分历史地图只声明单向连接，旅行应按玩家看到的无向道路处理。
    DATA.mapData.forEach(location => { if((location.connectedTo || []).includes(currentId)) neighbors.add(location.id); });
    for(const nextId of neighbors){
      if(!byId.has(nextId) || previous.has(nextId)) continue;
      previous.set(nextId, currentId);
      queue.push(nextId);
    }
  }
  if(!previous.has(targetId)) return [];
  const ids = [];
  for(let id = targetId; id !== null; id = previous.get(id)) ids.push(id);
  return ids.reverse().map(id => byId.get(id)).filter(Boolean);
}

function travelAlongRoute(targetValue, options){
  if(!G || G._traveling) return false;
  const target = resolveMapLocation(targetValue);
  const current = resolveMapLocation(G._currentLocation) || resolveMapLocation('shrek_academy');
  if(!target || !current){ toast('无法规划这段旅程'); return false; }
  if(target.id === current.id){
    if(options && typeof options.onArrive === 'function') options.onArrive();
    return true;
  }
  const path = findLocationPath(current.id, target.id);
  if(path.length < 2){ toast('这条路线暂时无法通行'); return false; }
  let cost = 0;
  for(let i = 1; i < path.length; i++){
    const location = path[i];
    if(location.unlockedLevel && G.level < location.unlockedLevel){
      toast(`前往「${location.name}」需要达到 Lv.${location.unlockedLevel}`);
      return false;
    }
    cost += travelCost(path[i - 1], location, false);
  }
  if(G.gold < cost){ toast(`这段旅程需要 ${cost} 金币，当前金币不足`); return false; }
  G._traveling = true;
  let previous = current;
  for(let i = 1; i < path.length; i++){
    const location = path[i];
    const legCost = travelCost(previous, location, false);
    G.gold -= legCost;
    G._currentLocation = location.id;
    visitLocation(location.id, { silent:true });
    completeWorldAction();
    addDiaryEntry(`从「${previous.name}」前往「${location.name}」，花费${legCost}金币。`, 'discovery');
    previous = location;
  }
  G._traveling = false;
  saveLocal();
  refreshPanel();
  syncMapState();
  closeModal();
  if(window.navigateTo) window.navigateTo('game');
  const onArrive = options && options.onArrive;
  if(typeof onArrive === 'function') setTimeout(onArrive, 80);
  else renderContinue(null, `你沿着安全路线抵达「${esc(target.name)}」，共花费 ${cost} 金币。`);
  return true;
}

function renderRingTravelGuide(ev, targetId){
  const area = $('scene-area');
  area.dataset.awaitingChoice = 'true';
  const target = resolveMapLocation(targetId);
  const current = resolveMapLocation(G._currentLocation) || resolveMapLocation('shrek_academy');
  const path = current && target ? findLocationPath(current.id, target.id) : [];
  const routeNames = path.map(location => location.name).join(' → ');
  let cost = 0;
  for(let i = 1; i < path.length; i++) cost += travelCost(path[i - 1], path[i], false);
  area.innerHTML = `<div class="scene-location">【猎环前置·行程准备】</div>
    <div class="scene-title">${esc(ev.name)}</div>
    <div class="scene-text"><p>这次魂环的猎场在<strong style="color:#e6c878">「${esc(target ? target.name : ev.location)}」</strong>，不在你当前所在的区域。</p>
    <p style="color:#a89a7c">为避免剧情凭空跳转，你可以沿已知道路前往：<br><span style="color:#c9a84c">${esc(routeNames || '路线不可用')}</span></p>
    <p style="color:#a89a7c">预计旅费：<b style="color:#e6c878">${cost}</b> 金币 · 途中会推进时间，但不会插入随机遭遇。</p></div>
    <div class="choices"><button class="choice-btn" id="btn-ring-travel" ${path.length < 2 || G.gold < cost ? 'disabled' : ''}><span class="ck">🧭</span>沿路线前往猎场</button>
    <button class="choice-btn" id="btn-ring-map"><span class="ck">🗺</span>打开地图查看路线</button>
    <button class="choice-btn" id="btn-ring-defer"><span class="ck">◀</span>先留在这里准备</button></div>`;
  const travelButton = $('btn-ring-travel');
  if(travelButton) travelButton.addEventListener('click', () => travelAlongRoute(targetId, { suppressEncounter:true, onArrive:() => renderRingHunt(ev) }));
  const mapButton = $('btn-ring-map');
  if(mapButton) mapButton.addEventListener('click', openMap);
  const deferButton = $('btn-ring-defer');
  if(deferButton) deferButton.addEventListener('click', () => {
    G._ringHuntDeferredUntil = (G._eventCount || 0) + 2;
    saveLocal();
    renderContinue(ev, '你决定先准备充分，再前往合适的猎场。');
  });
  refreshPanel();
}

function renderMainStoryTravelGuide(milestone, ev){
  const area = $('scene-area');
  area.dataset.awaitingChoice = 'true';
  const target = resolveMapLocation(milestone.targetId);
  const current = resolveMapLocation(G._currentLocation) || resolveMapLocation('shrek_academy');
  const path = current && target ? findLocationPath(current.id, target.id) : [];
  let cost = 0;
  for(let i = 1; i < path.length; i++) cost += travelCost(path[i - 1], path[i], false);
  const routeNames = path.map(location => location.name).join(' → ');
  area.innerHTML = `<div class="scene-location">【主线行程】</div><div class="scene-title">${esc(milestone.name)}</div>
    <div class="scene-text"><p>新的主线已经出现。你需要先前往<strong style="color:#e6c878">「${esc(target ? target.name : milestone.targetId)}」</strong>，剧情不会把你凭空传送过去。</p>
    <p style="color:#a89a7c">路线：${esc(routeNames || '暂时无法规划')}<br>预计旅费：<b style="color:#e6c878">${cost}</b> 金币。</p></div>
    <div class="choices"><button class="choice-btn" id="btn-story-travel" ${path.length < 2 || G.gold < cost ? 'disabled' : ''}><span class="ck">🧭</span>沿路线前往并推进主线</button>
    <button class="choice-btn" id="btn-story-map"><span class="ck">🗺</span>打开地图</button>
    <button class="choice-btn" id="btn-story-defer"><span class="ck">◀</span>先历练两次</button></div>`;
  const travelButton = $('btn-story-travel');
  if(travelButton) travelButton.addEventListener('click', () => travelAlongRoute(milestone.targetId, { onArrive:() => renderScene(ev, buildChoices(ev)) }));
  const mapButton = $('btn-story-map');
  if(mapButton) mapButton.addEventListener('click', openMap);
  const deferButton = $('btn-story-defer');
  if(deferButton) deferButton.addEventListener('click', () => {
    G._storyMilestoneDeferredUntil = (G._eventCount || 0) + 2;
    saveLocal();
    renderContinue(ev, `你记下了主线目标「${esc(milestone.name)}」，决定先完成两次历练再出发。`);
  });
  refreshPanel();
}

function renderMainStoryMilestone(milestone){
  const source = EVENTS.find(event => event.id === milestone.id);
  if(!source) return false;
  const ev = { ...source, _mainStory:true };
  const currentId = resolveMapLocation(G._currentLocation)?.id;
  if(milestone.targetId && currentId !== milestone.targetId){
    renderMainStoryTravelGuide(milestone, ev);
  }else{
    renderScene(ev, buildChoices(ev));
  }
  return true;
}

function findRingChoiceResult(ev, beast){
  if(!ev || !beast) return null;
  if(typeof GameRules !== 'undefined' && typeof GameRules.findRingChoiceResult === 'function'){
    return GameRules.findRingChoiceResult(ev.choices, beast);
  }
  if(!Array.isArray(ev.choices)) return null;
  const fullName = String(beast.name || '');
  const baseName = fullName.replace(/^(?:十万年|万年|千年|百年|十年)/, '');
  const index = ev.choices.findIndex(choice => {
    const text = String(choice && choice.text || '');
    return (fullName && text.includes(fullName)) || (baseName && text.includes(baseName)) || (choice && choice.result && choice.result.battle === beast.id);
  });
  return index < 0 ? null : { result:ev.choices[index].result || {}, index };
}

function completeRingEvent(ev, ring, result, fallbackExp, choiceIndex, actionAlreadyCompleted){
  const reward = result ? { ...result } : { exp:fallbackExp };
  if(!actionAlreadyCompleted) completeWorldAction();
  delete reward.battle;
  if(!reward.exp && fallbackExp) reward.exp = fallbackExp;
  // grantRing 后新的魂环位已经生效。先独立释放旧的暂存经验，再结算本次魂环奖励，
  // 这样提示中的“释放暂存经验”不会混入新获得的经验。
  const gains = [];
  const storedBefore = progressionRulesActive() ? (Number(G.overflowExp) || 0) : 0;
  if(storedBefore > 0){
    gainExp(0);
    const released = Math.max(0, storedBefore - (Number(G.overflowExp) || 0));
    if(released > 0) gains.push(`释放暂存经验+${released}`);
  }
  gains.push(...applyResultRewards(reward).list);
  G.pendingRingLv = null;
  G._ringHuntDeferredUntil = 0;
  updatePendingRing();
  if(G.pendingRingLv && Number(G.overflowExp) > 0){
    gains.push(`另有${Number(G.overflowExp)}经验暂存至下一魂环`);
  }
  if(ev && ev.id){
    if(!G.doneEvents.includes(ev.id)) G.doneEvents.push(ev.id);
    G.choices[ev.id] = String.fromCharCode(65 + Math.max(0, Number(choiceIndex) || 0));
  }
  checkAchievements();
  checkQuests();
  saveLocal();
  refreshPanel();
  closeModal();
  const text = reward.text || `你成功获得了第${G.rings.length}魂环。`;
  renderContinue(ev, `${fmt(text)}${gains.length ? `<br><span class="hl-gold">${gains.join('　')}</span>` : ''}`);
}

const RING_BEAST_ALIASES = {
  spirit_deer_ten:'灵鹿', poison_spider_ten:'毒蛛', wind_rabbit_ten:'野兔'
};

function pickBeastsFor(tierKey, count, ev){
  // 新数据结构：每个魂兽种族包含 variants，按 tierKey 从对应变体中提取。
  // 事件正文点名的魂兽优先进入候选，其余位置再随机补足，确保战斗、奖励和来源文本一致。
  const pool = [];
  for(const b of DATA.beasts){
    if(b.variants && b.variants[tierKey]){
      const v = b.variants[tierKey];
      pool.push({
        id: b.id,
        name: v.name || b.name,
        type: b.type,
        habitat: b.habitat,
        attack: v.attack,
        defense: v.defense,
        hp: v.hp,
        speed: v.speed,
        image: b.image,
        icon: b.icon || '🐾',
        element: b.element || b.type || b.specialAbility,
        ringColor: v.ringColor,
        dropRate: v.dropRate
      });
    }
  }
  const shuffled = shuffle(pool);
  const preferredIds = new Set((ev && ev.choices || []).map(choice => {
    const battleId = choice && choice.result && choice.result.battle;
    return RING_BEAST_ALIASES[battleId] || battleId;
  }).filter(Boolean));
  const preferred = shuffled.filter(beast => preferredIds.has(beast.id));
  const extras = shuffled.filter(beast => !preferredIds.has(beast.id));
  return [...preferred, ...extras].slice(0, count);
}

function renderRingHunt(ev){
  const ringIdx = G.rings.length; // 第几个魂环(0-8)
  const ringLevel = Number(ev && ev.minLevel) || (GameRules.RING_LEVELS || [10,20,30,40,50,60,70,80,90])[ringIdx];
  const destinationId = RING_DESTINATIONS[ringLevel];
  const currentId = resolveMapLocation(G._currentLocation)?.id;
  if(destinationId && currentId && currentId !== destinationId){
    renderRingTravelGuide(ev, destinationId);
    return;
  }
  
  if(ev.ring === 'special60'){
    const defs = ['god_given_ring', 'evolution_ring', 'dual_color_ring']
      .map(id => DATA.rings.find(r => r.id === id))
      .filter(definition => definition && (!definition.minLevel || G.level >= Number(definition.minLevel)));
    const choices = defs.map((d, choiceIndex) => ({
      text: `选择「${d.name}」`,
      hint: `攻击+${d.statBonus.attack} 防御+${d.statBonus.defense} 生命+${d.statBonus.hp} · 风险${d.absorptionRisk}`,
      fn: () => {
        const skillEntry = grantRing(makeRing(d.id, '天赐机缘', null), '天降祥瑞，直入你体内');
        if(!skillEntry) return;
        completeRingEvent(ev, skillEntry, { text:'天赐魂环与你的武魂完成共鸣，魂力根基进一步稳固。', attack:3, defense:3, speed:3, heal:30, exp:80, fate:1 }, 80, choiceIndex);
      }
    }));
    renderScene(ev, choices);
    return;
  }
  
  if(ev.ring === 'special90'){
    const defs = ['million_gold_ring', 'god_given_ring'].map(id => DATA.rings.find(r => r.id === id));
    const choices = defs.map((d, choiceIndex) => ({
      text: `选择「${d.name}」`,
      hint: `攻击+${d.statBonus.attack} 防御+${d.statBonus.defense} 生命+${d.statBonus.hp}`,
      fn: () => {
        const skillEntry = grantRing(makeRing(d.id, '神界之门', null), '神界之门为你赐福');
        if(!skillEntry) return;
        completeRingEvent(ev, skillEntry, { text:'神界之门闭合，最后一枚魂环在你体内沉静下来。', attack:6, defense:6, speed:6, heal:30, exp:100, fate:2 }, 100, choiceIndex);
      }
    }));
    renderScene(ev, choices);
    return;
  }
  
  // 普通魂环获取：让玩家选择挑战年份
  // 每个魂环位置可选择的年份档位
  const tierOptions = getRingTierOptions(ringIdx);
  if(!tierOptions.length){
    toast('当前魂环阶段没有可用猎场配置，请稍后再试');
    return;
  }
  
  const area = $('scene-area');
  area.dataset.awaitingChoice = 'true';
  const currentLoc = G._currentLocation || 'shrek_academy';
  const locData = DATA.mapData ? DATA.mapData.find(l => l.id === currentLoc) : null;
  const locName = locData ? locData.name : (ev.location || '猎魂森林');
  
  area.innerHTML = `
    <div class="scene-location">【${esc(locName)}】</div>
    <div class="scene-title">${esc(ev.name)}</div>
    <div class="scene-text">
      <p>你需要猎杀魂兽获取第 <b style="color:#e6c878">${ringIdx + 1}</b> 魂环。</p>
      <p style="color:#a89a7c">不同年份的魂兽实力不同，吸收高年份魂环可获得更强属性和魂技，但也有<span style="color:#ff6b6b">反噬风险</span>。请谨慎选择。</p>
    </div>
    <div style="margin:20px 0;display:grid;gap:14px" id="tier-select-list"></div>
    <div class="choices">
      <button class="choice-btn" id="btn-hunt-back"><span class="ck">◀</span>暂时离开，稍后再来</button>
    </div>`;
  
  const tierList = $('tier-select-list');
  tierOptions.forEach(opt => {
    const yearInfo = RING_YEAR_INFO[opt.tier];
    const riskColor = opt.risk > 50 ? '#ff6b6b' : (opt.risk > 20 ? '#facc15' : '#66bb6a');
    const card = document.createElement('div');
    card.className = 'choice-btn';
    card.style.cssText = 'text-align:left;padding:16px 20px;flex-direction:column;align-items:flex-start;gap:8px;min-height:auto';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;width:100%">
        <div style="width:14px;height:14px;border-radius:50%;border:3px solid ${yearInfo.color};box-shadow:0 0 12px ${yearInfo.glow};flex-shrink:0"></div>
        <div style="font-family:'Ma Shan Zheng',serif;font-size:20px;color:${yearInfo.color};letter-spacing:2px;flex:1">${yearInfo.label}</div>
        ${opt.recommended ? '<span style="padding:2px 10px;border-radius:12px;font-size:11px;background:rgba(102,187,106,.2);color:#66bb6a;border:1px solid rgba(102,187,106,.3)">推荐</span>' : ''}
      </div>
      <div style="font-size:13px;color:#a89a7c;line-height:1.8;margin-left:26px">
        <div>属性加成：攻击+${opt.bonus.attack}　防御+${opt.bonus.defense}　生命+${opt.bonus.hp}</div>
        <div>魂环上限：${yearInfo.max}</div>
        <div>吸收风险：<span style="color:${riskColor}">${opt.risk === 0 ? '无风险' : opt.risk + '% 反噬概率'}</span></div>
        ${opt.note ? `<div style="color:#c9a84c;margin-top:4px">${opt.note}</div>` : ''}
      </div>`;
    card.addEventListener('click', () => {
      // 进入该年份魂兽选择
      showBeastSelection(ev, opt.tier, opt);
    });
    tierList.appendChild(card);
  });
  
  $('btn-hunt-back').addEventListener('click', () => {
    // 保留待获取魂环，只推迟两个行动，避免玩家被同一界面反复拦住。
    G._ringHuntDeferredUntil = (G._eventCount || 0) + 2;
    saveLocal();
    renderContinue(ev, '你决定先准备充分。再历练两次后，可重新猎取这个魂环。');
  });
  
  visitLocation(currentLoc);
  refreshPanel();
}

// 获取某魂环位置可选择的年份档位
function getRingTierOptions(ringIdx){
  // ringIdx: 0=第1魂环, 8=第9魂环
  // 档位定义：tier, bonus, risk%, recommended, note
  const baseBonus = Object.fromEntries(['white','yellow','purple','black','red'].map(tier => {
    const definition = DATA.rings.find(r => r.tier === tier);
    return [tier, definition ? { ...definition.statBonus } : { attack:0, defense:0, hp:0 }];
  }));
  
  // 各位置推荐档位和可挑战档位
  const ringConfigs = [
    // 第1魂环(Lv10)：遵循魂环图鉴门槛，不能在低等级直接挑战百年/千年魂环。
    { rec:'white', can:['white','yellow','purple'] },
    // 第2魂环(Lv20)
    { rec:'yellow', can:['yellow','purple'] },
    // 第3魂环(Lv30)
    { rec:'purple', can:['yellow','purple','black'] },
    // 第4魂环(Lv40)
    { rec:'purple', can:['purple','black'] },
    // 第5魂环(Lv50)
    { rec:'black', can:['purple','black','red'] },
    // 第6魂环(Lv60) 特殊
    null,
    // 第7、8魂环：万年黑环是稳妥推荐；十万年红环属于传奇级高风险挑战。
    { rec:'black', can:['black','red'] },
    { rec:'black', can:['black','red'] },
    // 第9魂环(Lv90) 特殊
    null
  ];
  
  const cfg = ringConfigs[ringIdx];
  if(!cfg) return [];
  
  // 先按图鉴的最低等级过滤，再计算越阶风险；防止 Lv.10 直接出现紫环等高阶选项。
  const level = Number(G.level) || 1;
  return cfg.can.filter(tier => {
    const definition = DATA.rings.find(r => r.tier === tier);
    return !definition || !definition.minLevel || level >= Number(definition.minLevel);
  }).map(tier => {
    const base = baseBonus[tier];
    let risk = 0;
    let note = '';
    const isRec = tier === cfg.rec;
    
    if(tier !== cfg.rec){
      // 越一级加15%风险，越两级加40%
      const tierOrder = ['white','yellow','purple','black','red'];
      const recIdx = tierOrder.indexOf(cfg.rec);
      const tierIdx = tierOrder.indexOf(tier);
      const diff = tierIdx - recIdx;
      if(tier === 'red' && cfg.rec === 'black') risk = 45;
      else if(diff === 1) risk = 20;
      else if(diff >= 2) risk = 45;
      else if(diff === -1) { risk = 0; note = '稳妥选择，属性略低'; }
      else if(diff <= -2) { risk = 0; note = '过于保守，属性加成较低'; }
    }
    
    return {
      tier,
      bonus: base,
      risk,
      recommended: isRec,
      note: note || (risk > 0 ? (risk >= 40 ? '九死一生' : '有一定风险') : '安全吸收')
    };
  });
}

// 显示某年份的魂兽选择
function showBeastSelection(ev, tier, tierOpt){
  const tierMap = { white:'ten', yellow:'hundred', purple:'thousand', black:'ten_thousand', red:'hundred_thousand' };
  const ringId = RING_DEF_BY_KIND[tierMap[tier]];
  const beasts = pickBeastsFor(tierMap[tier], 4, ev); // 原事件魂兽优先，随机魂兽补足至4个
  
  const area = $('scene-area');
  area.dataset.awaitingChoice = 'true';
  const currentLoc = G._currentLocation || 'shrek_academy';
  const locData = DATA.mapData ? DATA.mapData.find(l => l.id === currentLoc) : null;
  const locName = locData ? locData.name : (ev.location || '猎魂森林');
  const yearInfo = RING_YEAR_INFO[tier];
  
  area.innerHTML = `
    <div class="scene-location">【${esc(locName)}】</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <button class="top-btn" id="btn-back-tier" style="padding:4px 10px;font-size:12px">◀ 返回选择年份</button>
      <div style="font-family:'Ma Shan Zheng',serif;font-size:22px;color:${yearInfo.color};letter-spacing:3px">${yearInfo.label} · 选择魂兽</div>
    </div>
    <div class="scene-text">
      <p>在密林中搜寻，你发现了 <b>${beasts.length}</b> 只适合猎杀的${yearInfo.label.replace('魂环','魂兽')}。</p>
      ${tierOpt.risk > 0 ? `<p style="color:#facc15">⚠ 越阶吸收将有 <b>${tierOpt.risk}%</b> 概率反噬受伤！</p>` : ''}
    </div>
    <div style="margin:16px 0;display:grid;gap:12px" id="beast-select-list"></div>`;
  
  $('btn-back-tier').addEventListener('click', () => renderRingHunt(ev));
  
  const beastList = $('beast-select-list');
  beasts.forEach((b, i) => {
    const card = document.createElement('div');
    card.className = 'choice-btn';
    card.style.cssText = 'text-align:left;padding:14px 18px;flex-direction:column;align-items:flex-start;gap:6px;min-height:auto';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;width:100%">
        <div style="font-size:32px">${b.icon || '🐾'}</div>
        <div style="flex:1">
          <div style="font-family:'Ma Shan Zheng',serif;font-size:18px;color:#e6c878;letter-spacing:2px">${esc(b.name)}</div>
          <div style="font-size:12px;color:#a89a7c">${esc(b.type)} · 栖息于${esc(b.habitat)}</div>
        </div>
        <div style="text-align:right;font-size:12px;color:#a89a7c;line-height:1.6">
          <div>攻击 <b style="color:#ff8a65">${b.attack}</b></div>
          <div>生命 <b style="color:#81c784">${b.hp}</b></div>
        </div>
      </div>`;
    card.addEventListener('click', () => {
      attemptAbsorbRing(ev, ringId, b, tierOpt, i);
    });
    beastList.appendChild(card);
  });
  
  visitLocation(currentLoc);
  refreshPanel();
}

// 猎杀魂兽后再进行魂环吸收判定。
function attemptAbsorbRing(ev, ringId, beast, tierOpt, displayChoiceIndex){
  const enemy = {
    id:beast.id || beast.name,
    name:beast.name,
    icon:beast.icon || '🐾',
    image:beast.image || null,
    attack:Number(beast.attack) || 10,
    defense:Number(beast.defense) || 5,
    hp:Number(beast.hp) || 50,
    maxHp:Number(beast.hp) || 50,
    speed:Number(beast.speed) || 10,
    element:beast.element || beast.type,
    isNpc:false,
    isBoss:['black','red'].includes(tierOpt.tier)
  };
  BattleSystem.start(enemy, {
    event:ev,
    countKill:true,
    allowFlee:true,
    onVictory:() => resolveRingAbsorption(ev, ringId, beast, tierOpt, displayChoiceIndex),
    onDefeat:() => {
      G.pendingRingLv = [10,20,30,40,50,60,70,80,90][G.rings.length] || null;
      G._ringHuntDeferredUntil = (G._eventCount || 0) + 2;
      saveLocal();
      renderContinue(ev, `你没能战胜「${esc(beast.name)}」，养好伤后再历练两次，就可以重新尝试猎取魂环。`);
    }
  });
  refreshPanel();
}

function resolveRingAbsorption(ev, ringId, beast, tierOpt, displayChoiceIndex){
  const pendingLevel = G.pendingRingLv;
  G._ringHuntDeferredUntil = 0;
  const risk = Number.isFinite(Number(tierOpt && tierOpt.risk)) ? Math.max(0, Math.min(100, Number(tierOpt.risk))) : 0;
  const success = Math.random() * 100 >= risk;
  if(!success){
    const backlash = GameRules.calculateRingBacklash(finalStats().maxHp, G.hp, risk);
    const dmg = backlash.damage;
    G.hp = backlash.remainingHp;
    refreshPanel();
    saveLocal();
    const area = $('scene-area');
    area.innerHTML = `
      <div class="scene-location">【魂环反噬】</div>
      <div class="scene-title" style="color:#ff6b6b">✦ 吸收失败 ✦</div>
      <div class="scene-text">
        <p>你战胜了「${esc(beast.name)}」，但${esc(RING_YEAR_INFO[tierOpt.tier].label)}的魂力过于狂暴。</p>
        <p style="color:#ff6b6b">经脉受到反噬，损失 <b>${dmg}</b> 点生命。</p>
        <p style="color:#a89a7c">魂环已经消散，需要重新寻找魂兽。</p>
      </div>
      <div class="choices">
        <button class="choice-btn" id="btn-retry-hunt"><span class="ck">⚔</span>重新搜寻魂兽</button>
        <button class="choice-btn" id="btn-giveup-hunt"><span class="ck">◀</span>暂时离开</button>
      </div>`;
    $('btn-retry-hunt').addEventListener('click', () => {
      G.pendingRingLv = pendingLevel || [10,20,30,40,50,60,70,80,90][G.rings.length] || null;
      renderRingHunt(ev);
    });
    $('btn-giveup-hunt').addEventListener('click', () => {
      G._ringHuntDeferredUntil = (G._eventCount || 0) + 2;
      saveLocal();
      renderContinue(ev, '你服下疗伤丹药，决定先历练两次、准备充分后再来猎取魂环。');
    });
    VisualFX.flash('red', 400);
    AudioFX.playSfx('hit');
    return;
  }
  const ring = makeRing(ringId, beast.name, beast);
  const skillEntry = grantRing(ring, `成功猎杀「${beast.name}」，吸收其魂环`);
  if(!skillEntry) return;
  const selected = findRingChoiceResult(ev, beast);
  const selectedResult = selected ? { ...selected.result } : {};
  if(selectedResult.text){
    const ringLabel = (RING_YEAR_INFO[tierOpt.tier] || {}).label || '魂环';
    selectedResult.text = String(selectedResult.text).replace(/\{ringLabel\}/g, ringLabel);
  }
  const profile = getBeastSkillProfile(beast);
  if(profile && profile.reward){
    for(const [field, value] of Object.entries(profile.reward)){
      if(selectedResult[field] === undefined) selectedResult[field] = value;
    }
  }
  const fallbackExp = 40 + G.level * 2 + (tierOpt.risk > 0 ? 30 : 0);
  const recordedChoiceIndex = selected ? selected.index : Math.max(0, Number(displayChoiceIndex) || 0);
  completeRingEvent(ev, skillEntry, selectedResult, fallbackExp, recordedChoiceIndex, true);
}

// ==================== 事件系统 ====================
function showGainExpAndContinue(ev, expAmount){
  gainExp(expAmount);
  renderContinue(ev, `经历了这一切，你感觉又成长了许多。（经验 +${expAmount}）`);
}

function renderContinue(ev, extraText, nextHandler){
  const area = $('scene-area');
  delete area.dataset.awaitingChoice;
  const currentLoc = G._currentLocation || 'slk_academy';
  const locData = DATA.mapData ? DATA.mapData.find(l => l.id === currentLoc) : null;
  const locName = locData ? locData.name : (ev ? ev.location : '大陆某地');
  area.innerHTML = `
    <div class="scene-location">【${esc(locName)}】</div>
    <div class="scene-title">${esc(ev ? ev.name : '继续旅程')}</div>
    <div class="scene-text"><p>${extraText || '你休整片刻，准备踏上新的旅程。'}</p></div>
    <div class="choices">
      <button class="choice-btn" id="btn-next-ev"><span class="ck">▶</span>继续前行</button>
      <button class="choice-btn" id="btn-open-map" style="border-color:rgba(139,92,246,.4)"><span class="ck">🗺</span>查阅万象地图</button>
    </div>`;
  $('btn-next-ev').addEventListener('click', typeof nextHandler === 'function' ? nextHandler : nextEvent);
  $('btn-open-map').addEventListener('click', openMap);
  // 记录访问地点并同步状态栏，确保暂缓猎环、失败休整等状态立即可见。
  if(currentLoc) visitLocation(currentLoc);
  refreshPanel();
}

// 事件地点由公共规则统一分类：具体地点映射到地图 ID，抽象地点显式标记为全局。
// 真正未知的地点不再默认全地图触发，以免“矿洞/神殿”等剧情出现在错误区域。
function eventLocationInfo(value){
  if(typeof GameRules !== 'undefined' && typeof GameRules.classifyEventLocation === 'function'){
    return GameRules.classifyEventLocation(value, DATA.mapData);
  }
  const resolved = resolveMapLocation(value);
  return resolved ? { scope:'mapped', id:resolved.id } : { scope:'unknown', id:null };
}

function eventLocationId(value){
  const info = eventLocationInfo(value);
  return info.scope === 'mapped' ? info.id : null;
}

function eventMatchesCurrentLocation(event){
  const current = resolveMapLocation(G && G._currentLocation);
  const info = eventLocationInfo(event && event.location);
  if(info.scope === 'global') return true;
  if(info.scope === 'unknown' || !current) return false;
  return current.id === info.id;
}

function availableEvents(){
  const phase = currentPhase();
  return EVENTS.filter(e => {
    if(!e.choices || e.choices.length === 0) return false;
    if(e.ring || Number(e.weight) === 0) return false;
    if(e.phase !== phase) return false;
    if(e.spiritId && (!G.spirit || G.spirit.id !== e.spiritId)) return false;
    if(e.unique && G.doneEvents.includes(e.id)) return false;
    if(e.minLevel && G.level < e.minLevel) return false;
    if(e.maxLevel && G.level > e.maxLevel) return false;
    if(!eventMatchesCurrentLocation(e)) return false;
    return true;
  });
}

// 事件与武魂/路线的匹配度
// 出身标签映射
const ORIGIN_TAGS = {
  star_forest: ['wild','survive','nature','hunt'],
  spirit_city: ['social','sect','noble','trade'],
  border_town: ['fight','guard','military','weapon'],
  sea_island: ['sea','water','nature','speed']
};

function eventMatchBonus(ev){
  let bonus = 0;
  const pt = G._personality;
  const dy = G._destiny;
  if(!pt || !dy) return 0;
  // 武魂特质匹配：事件标签与武魂特质交集
  if(ev.tags && pt.traits){
    for(const tag of ev.tags){
      if(pt.traits.includes(tag)) bonus += 2;
      if(pt.subtype === tag) bonus += 3;
      if(G.spirit.type === tag) bonus += 2;
    }
  }
  // 命运路线匹配：事件标签与路线标签交集
  if(ev.tags && dy.tags){
    for(const tag of ev.tags){
      if(dy.tags.includes(tag)) bonus += 3;
    }
  }
  // 出身匹配：事件标签与出身标签交集
  const originTags = ORIGIN_TAGS[G.origin] || [];
  if(ev.tags && originTags.length){
    for(const tag of ev.tags){
      if(originTags.includes(tag)) bonus += 3;
    }
  }
  return bonus;
}

function nextEvent(){
  if(!G || (typeof BattleSystem !== 'undefined' && BattleSystem.isActive())) return;
  if(G._enrollmentComplete && !G._firstClassDone){
    const firstClass = EVENTS.find(event => event.id === 'first_class');
    if(firstClass){ renderScene(firstClass, buildChoices(firstClass)); return; }
  }
  if(shouldShowTutorial() && G._firstClassDone && !G._tutorialStarted){
    G._tutorialStarted = true;
    saveLocal();
    startTutorial(nextEvent);
    return;
  }
  // Lv.100 仍必须先完成最终决战；魂环门槛优先于同等级主线。
  if(G.level >= 100 && G.doneEvents.includes('final_evil') && !G.finished){ showEnding(); return; }
  // 随机“命运抉择”弹窗已移除；剧情选项会自然记录路线与命运值。
  if(G.pendingRingLv && (G._ringHuntDeferredUntil || 0) <= (G._eventCount || 0)){
    const ev = EVENTS.find(e => e.id === ringEventId(G.pendingRingLv));
    if(ev){ renderRingHunt(ev); return; }
  }
  const milestone = nextMainStoryMilestone();
  if(milestone && G.level >= milestone.minLevel && (G._storyMilestoneDeferredUntil || 0) <= (G._eventCount || 0)){
    if(renderMainStoryMilestone(milestone)) return;
  }
  if(G._pendingChain && typeof CHAINED_EVENTS !== 'undefined'){
    const pending = CHAINED_EVENTS[G._pendingChain];
    if(!pending){
      G._pendingChain = null;
    }else if((!pending.minLevel || G.level >= pending.minLevel) && (!pending.requires || pending.requires(G))){
      G._pendingChain = null;
      const ev = { ...normalizeEventShape(pending), _chain:true, unique:true };
      renderScene(ev, buildChoices(ev));
      return;
    }
  }
  const dynamic = checkDynamicEvents();
  if(dynamic && Math.random() < 0.35){
    if(dynamic.cooldown){
      if(!G._dynCooldowns) G._dynCooldowns = {};
      G._dynCooldowns[dynamic.id] = dynamic.cooldown;
    }
    const ev = { ...normalizeEventShape(dynamic), _dynamic:true, unique:Boolean(dynamic.once) };
    renderScene(ev, buildChoices(ev));
    return;
  }
  // 普通冒险也可能发生随机遭遇；设置行动间隔，避免连续打断剧情。
  const lastEncounter = Number(G._lastRandomEncounterAction) || -99;
  if((G._eventCount || 0) - lastEncounter >= 3){
    const timeMod = (getGameTime().mod || {}).encounterMult || 1;
    const weatherMod = (getWeather().mod || {}).encounterMult || 1;
    if(Math.random() < 0.08 * timeMod * weatherMod && triggerRandomEncounter()){
      G._lastRandomEncounterAction = G._eventCount || 0;
      return;
    }
  }
  const chained = checkChainedEvents();
  if(chained && Math.random() < 0.25){
    const ev = { ...normalizeEventShape(chained), _chain:true, unique:true };
    renderScene(ev, buildChoices(ev));
    return;
  }
  const pool = availableEvents();
  if(!pool.length){
    completeWorldAction();
    G.hp = Math.min(finalStats().maxHp, G.hp + 50);
    G.spiritPower = Math.min(getMaxSpiritPower(), G.spiritPower + 30);
    gainExp(25);
    addDiaryEntry('在当前地区休整一日，恢复状态并继续修炼。', 'event');
    renderContinue(null, '当前地区暂时没有与你阶段相符的新事件。你休整一日，精气神与魂力都得到恢复，并继续积累了修炼经验。<br><span class="hl-gold">经验+25</span>');
    refreshPanel(); saveLocal();
    return;
  }
  // 冷却过滤 + 武魂/路线加权
  const cooled = recentCooldown(pool);
  const weighted = [];
  cooled.forEach(e => {
    const baseW = e.weight || 1;
    const matchBonus = eventMatchBonus(e);
    const totalW = baseW + matchBonus;
    for(let i = 0; i < Math.max(1, totalW); i++) weighted.push(e);
  });
  const ev = pick(weighted);
  renderScene(ev, buildChoices(ev));
}

function buildChoices(ev){
  return ev.choices.map((c, i) => ({
    text:c.text,
    hint:c.hint || null,
    cond:c.cond || c.req || null,
    cost:c.cost || null,
    fn:() => applyChoice(ev, c, i)
  }));
}

function condText(cond){
  if(typeof cond === 'function') return '满足特殊条件';
  const parts = [];
  if(cond.attack) parts.push(`攻击 ≥ ${cond.attack}`);
  if(cond.defense) parts.push(`防御 ≥ ${cond.defense}`);
  if(cond.speed) parts.push(`速度 ≥ ${cond.speed}`);
  if(cond.level) parts.push(`等级 ≥ ${cond.level}`);
  if(cond.gold) parts.push(`金币 ≥ ${cond.gold}`);
  if(cond.fate) parts.push(`命运值 ≥ ${cond.fate}`);
  if(cond.item) parts.push(`需要 ${cond.item}${cond.itemCount && cond.itemCount > 1 ? ` ×${cond.itemCount}` : ''}`);
  return parts.join(' · ');
}

function checkCond(cond){
  if(!cond) return true;
  if(typeof cond === 'function'){
    try{ return Boolean(cond(G)); }catch(e){ return false; }
  }
  const fs = finalStats();
  if(cond.attack && fs.attack < cond.attack) return false;
  if(cond.defense && fs.defense < cond.defense) return false;
  if(cond.speed && fs.speed < cond.speed) return false;
  if(cond.level && G.level < cond.level) return false;
  if(cond.gold && G.gold < cond.gold) return false;
  if(cond.fate && G.fatePoints < cond.fate) return false;
  if(cond.item){
    const required = Math.max(1, Number(cond.itemCount) || 1);
    const it = G.inventory.find(x => x.name === cond.item && Number(x.count) >= required);
    if(!it) return false;
  }
  return true;
}

function renderScene(ev, choices){
  const area = $('scene-area');

  // 场景过渡动画
  VisualFX.transition(() => {
    area.classList.remove('hidden');

    // 根据场景设置粒子背景
    const locName = ev.location || '';
    if(/森林|林/.test(locName)) ParticleEngine.setBackground('forest');
    else if(/火|焰|山|熔/.test(locName)) ParticleEngine.setBackground('fire');
    else if(/冰|雪|寒/.test(locName)) ParticleEngine.setBackground('ice');
    else if(/雷|电/.test(locName)) ParticleEngine.setBackground('thunder');
    else if(/神|圣|殿/.test(locName)) ParticleEngine.setBackground('holy');
    else if(/暗|冥|渊/.test(locName)) ParticleEngine.setBackground('dark');
    else ParticleEngine.setBackground('default');

    const imgHtml = ev.image
      ? `<img class="scene-img" src="${ev.image}" alt="" onerror="this.style.display='none'">` : '';

    const paras = ev.text.map(p => `<p>${fmt(p)}</p>`).join('');

    const choicesHtml = choices.map((c, i) => {
      const key = String.fromCharCode(65 + i);
      const cond = c.cond;
      const ok = checkCond(cond);
      const costTxt = c.cost && c.cost.gold ? `花费 ${c.cost.gold} 金币` : '';
      const condTxt = cond ? condText(cond) : '';
      const hintTxt = c.hint || '';
      const sub = [hintTxt, condTxt, costTxt].filter(Boolean).join('　');
      return `<button class="choice-btn" data-i="${i}" ${ok ? '' : 'disabled'}>
        <span class="ck">${key}</span>${fmt(c.text)}
        ${sub ? `<span class="cond ${cond ? (ok ? 'ok' : 'no') : ''}">${esc(sub)}${cond ? (ok ? ' ✓' : ' ✗') : ''}</span>` : ''}
      </button>`;
    }).join('');

    area.dataset.awaitingChoice = choices.some(choice => checkCond(choice.cond)) ? 'true' : 'false';
    area.innerHTML = `
      <div class="scene-location">【${esc(ev.location)}】</div>
      <div class="scene-title">${esc(ev.name)}</div>
      ${imgHtml}
      <div class="scene-text">${paras}</div>
      <div class="choices">${choicesHtml}</div>
      <div class="result-banner hidden" id="result-banner"></div>`;

    let choiceChosen = false;
    area.querySelectorAll('.choice-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        if(choiceChosen || btn.disabled) return;
        const c = choices[Number(btn.dataset.i)];
        if(!c || !c.fn) return;
        choiceChosen = true;
        area.querySelectorAll('.choice-btn').forEach(option => { option.disabled = true; });
        c.fn();
      }));
    refreshPanel();
  }, '◆');
}

function applyResultRewards(result){
  const r = (typeof GameRules !== 'undefined' && GameRules.normalizeLegacyHealthResult)
    ? GameRules.normalizeLegacyHealthResult(result)
    : (result || {});
  const gains = [];
  // 结构化奖励结果：list 为展示文本，数值字段供结果页汇总与自动测试断言。
  const summary = {
    list: gains,
    exp: 0,
    gold: 0,
    fate: 0,
    items: [],
    levelBefore: G ? G.level : 1,
    levelAfter: G ? G.level : 1,
    levels: [],
    overflowExp: 0
  };
  const fs = finalStats();
  const npcBonus = getNpcRelationBonuses();
  const addPermanent = (field, label) => {
    if(!r[field]) return;
    const mult = r[field] > 0 ? getSpiritBonus(field) : 1;
    const val = Math.round(Number(r[field]) * mult);
    G.bonus[field] = (Number(G.bonus[field]) || 0) + val;
    gains.push(`${label}${val >= 0 ? '+' : ''}${val}${mult > 1 ? '（武魂共鸣）' : ''}`);
  };
  addPermanent('attack', '攻击');
  addPermanent('defense', '防御');
  addPermanent('speed', '速度');

  if(r.maxHp){
    const mult = r.maxHp > 0 ? getSpiritBonus('maxHp') : 1;
    const val = Math.max(0, Math.round(Number(r.maxHp) * mult));
    G.bonus.hp = (Number(G.bonus.hp) || 0) + val;
    gains.push(`最大生命+${val}${mult > 1 ? '（武魂共鸣）' : ''}`);
  }
  if(typeof r.heal === 'number'){
    const rawHeal = Number(r.heal) || 0;
    if(rawHeal > 0){
      const mult = getSpiritBonus('heal');
      const val = Math.round(rawHeal * mult);
      const healed = Math.max(0, Math.min(finalStats().maxHp, G.hp + val) - G.hp);
      G.hp = Math.max(1, Math.min(finalStats().maxHp, G.hp + val));
      gains.push(`生命恢复+${healed}${mult > 1 ? '（武魂共鸣）' : ''}`);
    }
  }
  if(r.damage){
    const val = Math.max(0, Math.round(Number(r.damage) || 0));
    if(val > 0){
      G.hp = Math.max(1, G.hp - val);
      gains.push(`生命-${val}`);
    }
  }
  if(r.gold){
    const val = addGold(r.gold, true);
    summary.gold += val;
    gains.push(`金币${val >= 0 ? '+' : ''}${val}`);
  }
  if(r.spiritPowerGain){
    const raw = Number(r.spiritPowerGain) || 0;
    const titlePower = raw > 0 ? Math.max(0, Number(getTitleBonus('spiritPowerGain')) || 0) : 0;
    const mult = raw > 0 ? getSpiritBonus('spiritPowerGain') : 1;
    const val = Math.round(raw * mult + titlePower);
    if(val > 0){
      G.spiritPowerMax += val * 2;
      G.spiritPower = Math.min(getMaxSpiritPower(), G.spiritPower + val * 2);
      gains.push(`魂力上限+${val * 2}`);
    }else if(val < 0){
      const loss = Math.abs(val * 2);
      G.spiritPower = Math.max(0, G.spiritPower - loss);
      gains.push(`魂力-${loss}`);
    }
  }
  if(r.fate){
    const mult = r.fate > 0 ? getSpiritBonus('fate') * (npcBonus.fateMul || 1) : 1;
    const val = Math.round(Number(r.fate) * mult);
    G.fatePoints += val;
    summary.fate += val;
    gains.push(`命运值${val >= 0 ? '+' : ''}${val}`);
  }
  if(r.mp){
    const val = Number(r.mp) || 0;
    G.spiritPower = Math.max(0, Math.min(getMaxSpiritPower(), G.spiritPower + val));
    gains.push(`魂力${val >= 0 ? '+' : ''}${val}`);
  }
  const recordItemChange = item => {
    const itemCount = addItem(item);
    if(itemCount < 0) gains.push(`消耗「${item.name}」×${Math.abs(itemCount)}`);
    else if(itemCount > 0) gains.push(`获得「${item.name}」×${itemCount}`);
    else if(Number(item.count) < 0) gains.push(`未消耗「${item.name}」（库存不足）`);
  };
  if(r.item) recordItemChange(r.item);
  if(r.item2) recordItemChange(r.item2);
  if(r.heal === true || r.healFull){
    G.hp = finalStats().maxHp;
    G.spiritPower = getMaxSpiritPower();
    gains.push('完全恢复');
  }
  if(r.evolve) doEvolve(gains);
  if(r.exp){
    const rawExp = Number(r.exp) || 0;
    if(rawExp > 0){
      const time = getGameTime();
      const timeMult = time && time.mod && time.mod.expMult ? time.mod.expMult : 1;
      const val = Math.max(1, Math.round(rawExp * getSpiritBonus('exp') * (npcBonus.expMul || 1) * timeMult));
      const levelResult = gainExp(val);
      summary.exp += val;
      summary.levelAfter = levelResult.level;
      summary.levels = levelResult.levels;
      summary.overflowExp = levelResult.overflowExp;
      gains.push(`经验+${val}${levelResult.levels.length ? `（Lv.${levelResult.levels.join(' → ')}）` : ''}`);
    }
  }
  return summary;
}

// 结果页奖励明细：单项 + 总计行；总计必须等于实际变化。
function renderRewardSummary(reward){
  if(!reward || !Array.isArray(reward.list) || reward.list.length === 0) return '';
  const line = reward.list.join('　');
  const levelText = reward.levelAfter > reward.levelBefore ? `，Lv.${reward.levelBefore} → Lv.${reward.levelAfter}` : '';
  const overflowText = reward.overflowExp > 0 ? `，溢出经验+${reward.overflowExp}（达到魂环门槛后释放）` : '';
  const totals = [];
  if(reward.exp) totals.push(`经验+${reward.exp}${levelText}`);
  if(reward.gold) totals.push(`金币+${reward.gold}`);
  if(reward.fate) totals.push(`命运值+${reward.fate}`);
  const totalLine = totals.length ? `<br><span class="hl-gold">奖励总计：${totals.join('，')}${overflowText}</span>` : '';
  return `<br><span class="hl-gold">${line}</span>${totalLine}`;
}

function recordEventDiscoveries(ev){
  if(!ev) return;
  const locationText = String(ev.location || '');
  const mapLocation = resolveMapLocation(locationText);
  if(mapLocation) visitLocation(mapLocation.id);
  if(Array.isArray(ev.npcIds)) ev.npcIds.forEach(id => meetNpc(id));
  const text = `${ev.name || ''} ${locationText} ${(ev.text || []).join(' ')}`;
  for(const npc of DATA.npcData || []){
    if(!Array.isArray(ev.npcIds) && text.includes(npc.name)) meetNpc(npc.id);
  }
}

function recordNaturalStoryChoice(ev, choice, index){
  if(!G || !ev || !choice) return;
  const result = choice.result || {};
  const text = `${choice.text || ''} ${result.text || ''}`;
  let path = choice.path || result.path || null;
  if(!path && /仁慈|帮助|救|守护|放过|分享/.test(text)) path = 'merciful';
  else if(!path && /研究|观察|请教|计划|谨慎/.test(text)) path = 'scholar';
  else if(!path && /反抗|坚持|自由|拒绝/.test(text)) path = 'rebel';
  else if(!path && /力量|迎战|攻击|决战/.test(text)) path = 'ambitious';
  else if(!path && /储存|稳妥|离开|休息/.test(text)) path = 'prudent';
  if(!path && !result.fate) return;
  path = path || (Number(result.fate) > 0 ? 'merciful' : Number(result.fate) < 0 ? 'dark' : 'pragmatic');
  const decisionId = `event:${ev.id}`;
  if(G._storyDecisions[decisionId] !== undefined) return;
  G._storyDecisions[decisionId] = String.fromCharCode(65 + index);
  G._storyPath.push(path);
  if(!G._fateExplained && result.fate){
    G._fateExplained = true;
    toast('命运值会影响部分事件与结局，可在统计和帮助中查看');
    addDiaryEntry('首次获得命运值：它会影响部分事件和结局。', 'event');
  }
}

function applyChoice(ev, choice, idx){
  if(!G || !ev || !choice) return;
  if(typeof BattleSystem !== 'undefined' && BattleSystem.isActive()) return;
  if(choice.cost && choice.cost.gold) G.gold = Math.max(0, G.gold - Number(choice.cost.gold));
  const r = choice.result || {};
  G.choices[ev.id] = String.fromCharCode(65 + idx);
  if(ev.id === 'first_class'){
    G._firstClassDone = true;
    G._introPendingEvent = null;
  }
  recordNaturalStoryChoice(ev, choice, idx);
  if(!r.battle && (ev.unique || ev._chain || ev._dynamic) && !G.doneEvents.includes(ev.id)) G.doneEvents.push(ev.id);
  if(!G._recentEvents) G._recentEvents = [];
  G._recentEvents.push(ev.id);
  if(G._recentEvents.length > 15) G._recentEvents.shift();
  recordEventDiscoveries(ev);
  if(choice.next) G._pendingChain = choice.next;
  let effectText = '';
  if(typeof choice.effect === 'function'){
    try{ effectText = choice.effect(G) || ''; }
    catch(error){ console.error('事件效果执行失败:', error); effectText = '这次尝试没有产生预期效果。'; }
  }
  const resolvedResult = effectText ? { ...r, text:effectText } : r;

  if(resolvedResult.battle){
    BattleSystem.startEventBattle(ev, resolvedResult);
    return;
  }

  const reward = applyResultRewards(resolvedResult);
  completeWorldAction();
  addDiaryEntry(`经历事件「${ev.name}」：${plainText(String(resolvedResult.text || '').replace(/\{name\}|\{spirit\}/g, ''))}`, 'event');
  // 任务/成就奖励先结算再渲染，保证结果页明细的总计等于实际变化。
  const expBeforeQA = cumulativeExp(G.level, G.exp);
  checkQuests();
  checkAchievements();
  const qaExp = cumulativeExp(G.level, G.exp) - expBeforeQA;
  if(qaExp > 0){
    reward.exp += qaExp;
    reward.list.push(`任务/成就经验+${qaExp}`);
  }
  renderContinue(ev, `${richText(resolvedResult.text)}${renderRewardSummary(reward)}`);
  refreshPanel();
  saveLocal();
}

function addItem(item){
  if(!item || !item.name) return 0;
  const count = Number(item.count) || 1;
  const exist = G.inventory.find(x => x.name === item.name && x.value === item.value);
  if(count < 0){
    const consume = Math.min(exist ? Math.max(0, Number(exist.count) || 0) : 0, Math.abs(count));
    if(exist){
      exist.count -= consume;
      G.inventory = G.inventory.filter(x => x.count > 0);
    }
    return -consume;
  }
  if(exist) exist.count += count;
  else G.inventory.push({ name:item.name, type:item.type || 'special', value:item.value, desc:item.desc || '', effect:item.effect || null, count });
  // 扩展剧情中的宝物原本只有说明文字；获得时立即落实永久效果。
  if(count > 0 && item.effect && typeof item.effect === 'object'){
    ['attack','defense','hp','speed'].forEach(field => {
      if(item.effect[field]) G.bonus[field] = (Number(G.bonus[field]) || 0) + Number(item.effect[field]) * count;
    });
    if(item.effect.spiritPowerGain){
      const gain = Number(item.effect.spiritPowerGain) * count;
      G.spiritPowerMax = (Number(G.spiritPowerMax) || 0) + gain;
      G.spiritPower = Math.min(getMaxSpiritPower(), (Number(G.spiritPower) || 0) + gain);
    }
    if(item.effect.fate) G.fatePoints = (Number(G.fatePoints) || 0) + Number(item.effect.fate) * count;
  }
  return count;
}

function doEvolve(gains){
  const order = ['low', 'mid', 'high', 'top', 'god'];
  const idx = order.indexOf(G.spirit.tier);
  if(idx < order.length - 1){
    const newTier = order[idx + 1];
    const pool = DATA.spirits.filter(s => s.tier === newTier);
    const ns = pick(pool);
    G.spirit = { id: ns.id, name: ns.name, tier: ns.tier, type: ns.type, image: ns.image, desc: ns.desc, icon: ns.icon };
    G.spiritBase = { attack: ns.attack, defense: ns.defense, hp: ns.hp, speed: ns.speed };
    G._evolved = true;
    gains.push(`✦ 武魂进化为「${ns.name}」！`);
    // 进化特效
    AudioFX.playSfx('levelup');
    VisualFX.flash('gold', 400);
    const panel = document.querySelector('.status-panel');
    if(panel){
      const rect = panel.getBoundingClientRect();
      ParticleEngine.emit('holyBurst', rect.width / 2, rect.height / 2);
    }
    setTimeout(() => openModal('✦ 武魂进化 ✦', `
      <div class="lvup-line" style="font-size:18px">天地机缘让你的武魂脱胎换骨！</div>
      <div class="big-lv" style="font-size:36px">${esc(ns.name)}</div>
      <div class="lvup-line">${esc(ns.desc)}</div>`), 400);
    checkAchievements();
  }else{
    G.bonus.attack += 3; G.bonus.defense += 3;
    gains.push('全属性提升');
  }
}

// ==================== 敌人构建 ====================
function npcEnemy(name, lvScale, icon){
  const fs = finalStats();
  return {
    id: 'npc_' + Date.now(),
    name,
    isNpc: true,
    icon: icon || '🗡️',
    image: null,
    attack: Math.round(fs.attack * lvScale),
    defense: Math.round(fs.defense * lvScale * 0.8),
    hp: Math.round(fs.maxHp * lvScale),
    maxHp: Math.round(fs.maxHp * lvScale),
    speed: Math.round(fs.speed * lvScale),
    sub: '魂师对手'
  };
}

function buildEnemy(key){
  if(key && typeof key === 'object') return { ...key, maxHp:key.maxHp || key.hp };
  const aliases = {
    one_eye_wolf:'独眼狼', flower_snake:'花蛇', rock_python:'岩蟒', nether_wolf_king:'幽冥狼王',
    titan_giant_ape:'泰坦巨猿', titan_giant_ape_king:'泰坦巨猿王', spirit_deer_ten:'灵鹿',
    poison_spider_ten:'毒蛛', poison_spider:'毒蛛', wind_rabbit_ten:'野兔', wild_rabbit:'野兔',
    black_water_dragon:'黑水蛟龙', dark_gold_terrorclaw_bear:'暗金恐爪熊',
    deep_sea_demon_whale_king:'深海魔鲸王', flame_tiger:'烈焰虎', human_faced_spider:'人面魔蛛',
    ice_emperor_scorpion:'冰帝蝎', ice_wolf:'冰狼', iron_armor_bear:'铁甲熊', iron_horn_sheep:'铁角羊',
    thousand_eye_centipede:'千眼蜈蚣', thunder_bird:'雷鸟', wind_butterfly:'风蝶', wind_spirit_swallow:'风灵燕'
  };
  const beastId = aliases[key] || key;
  const beast = DATA.beasts.find(b => b.id === beastId || b.name === beastId);
  if(beast){
    let tier = G.level >= 75 ? 'hundred_thousand' : G.level >= 50 ? 'ten_thousand' : G.level >= 28 ? 'thousand' : G.level >= 10 ? 'hundred' : 'ten';
    if(/_ten$/.test(String(key))) tier = 'ten';
    const v = (beast.variants && (beast.variants[tier] || beast.variants.ten || beast.variants[Object.keys(beast.variants)[0]])) || {};
    const boss = /王|皇|帝/.test(v.name || beast.name) || ['泰坦巨猿王','深海魔鲸王'].includes(beast.id);
    return {
      id:beast.id, name:v.name || beast.name, isNpc:false, isBoss:boss,
      icon:beast.icon || '🐾', image:beast.image,
      attack:Number(v.attack) || 10, defense:Number(v.defense) || 5,
      hp:Number(v.hp) || 50, maxHp:Number(v.hp) || 50, speed:Number(v.speed) || 10,
      element:beast.element || beast.type || beast.specialAbility,
      sub:`${beast.type} · ${beast.habitat}`,
      special:beast.specialAbility
    };
  }
  const fs = finalStats();
  const table = {
    academy_rival:  () => npcEnemy('天斗学院·小霸王', 0.85),
    prelim_fighter: () => npcEnemy('预赛对手·疾风剑士', 0.92),
    final_fighter:  () => npcEnemy('决赛对手·武魂殿天才', 1.08, '⚔️'),
    arena_fighter:  () => npcEnemy('竞技场·双刀客', 0.98),
    evil_master:    () => npcEnemy('邪魂师·黑袍人', 1.03, '☠️'),
    god_rival:      () => npcEnemy('神位传承者·宿敌', 1.15, '👑'),
    holy_lord:     () => ({
      id:'holy_lord', name:'武魂殿圣殿大供奉', isNpc:false, isBoss:true, icon:'👁️',
      image:null,
      attack:Math.round(fs.attack * 0.92), defense:Math.round(fs.defense * 0.88),
      hp:Math.round(fs.maxHp * 2.1), maxHp:Math.round(fs.maxHp * 2.1),
      speed:Math.round(fs.speed * 0.92), element:'暗', sub:'最终BOSS · 武魂殿巅峰', special:'',
      exp:500, gold:200
    })
  };
  return (table[key] || (() => npcEnemy('游历魂师', 0.82)))();
}

// ==================== 背包 ====================
function openBag(){
  // 历史入口统一到正式背包，保证商店道具在所有入口下具有同一套说明与规则。
  openInventory();
}

// ==================== 存档管理 ====================
/** 直接尝试从本地存档恢复并进入游戏（跳过存档选择弹窗） */
function tryContinueFromLocalSave(){
  console.log('[继续冒险] 开始尝试恢复存档');
  // 先尝试使用备份恢复链
  const recovered = SaveUtils.recoverFromStorage(localStorage, LS_KEY);
  let localSave = recovered.data && (recovered.data.gameMode === 'text-rpg' || typeof recovered.data.spirit === 'object') ? recovered.data : null;
  let recoveredSource = recovered.source;
  
  // 如果备份链也找不到，直接读取 localStorage 主键
  if(!localSave){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && (parsed.gameMode === 'text-rpg' || typeof parsed.spirit === 'object')){
          const migrated = SaveUtils.migrateSave(parsed);
          if(migrated) localSave = migrated;
        }
      }
    }catch(e){
      console.error('[继续冒险] 直接读取 localStorage 失败:', e);
    }
  }
  
  if(!localSave){
    console.log('[继续冒险] 没有找到可继续的存档');
    toast('没有找到可继续的存档，请重新开始新游戏');
    showScreen('screen-title');
    return;
  }
  console.log('[继续冒险] 找到存档:', localSave.name, 'Lv.' + localSave.level, 'playerId:', localSave.playerId);
  
  // 直接设置 G 并进入游戏，不经过 tryContinueIntoGame 的二级封装
  // 这样错误处理更集中，避免多层 catch 导致状态丢失
  const migrated = SaveUtils.migrateSave(localSave);
  if(!migrated){
    console.error('[继续冒险] migrateSave 返回 null');
    toast('存档数据损坏，无法继续冒险');
    openSaveList();
    return;
  }
  // 兼容性检查：确保 spirit 是对象（文字 RPG 模式）
  if(typeof migrated.spirit !== 'object'){
    console.error('[继续冒险] 存档不是文字 RPG 模式');
    toast('该存档不是文字版存档，无法在当前模式读取');
    showScreen('screen-title');
    return;
  }
  G = migrated;
  window.G = G;
  // ★ 立即写入 localStorage，确保路由守卫能检测到游戏状态
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(G));
    console.log('[继续冒险] 已写入 localStorage');
  }catch(e){
    console.error('[继续冒险] 写入 localStorage 失败:', e);
  }
  console.log('[继续冒险] 直接恢复:', G.name, 'Lv.' + G.level);
  
  // 直接调用 enterGame（不经过 tryContinueIntoGame 的二级封装）
  // 如果 enterGame 抛出异常，try-catch 会捕获并显示错误
  try{
    enterGame(false);
  }catch(e){
    console.error('[继续冒险] enterGame 抛出异常:', e);
    toast('进入游戏失败: ' + (e.message || '未知错误') + '，请尝试手动选择存档');
    openSaveList();
    return;
  }
  
  // 立即检查游戏画面是否显示（而非等待 500ms）
  const gameScreen = document.getElementById('screen-game');
  if(gameScreen && !gameScreen.classList.contains('active')){
    console.warn('[继续冒险] 游戏画面未显示，立即强制切换');
    // 先确保 G 仍然有效
    if(!window.G || !window.G.name){
      console.error('[继续冒险] G 已丢失，无法继续');
      toast('游戏状态恢复失败，请手动选择存档');
      openSaveList();
      return;
    }
    // 强制切换游戏画面
    if(window.transitionToScreen) window.transitionToScreen('screen-game');
    else if(gameScreen) gameScreen.classList.add('active');
    // 同步 hash 确保路由守卫不拦截
    try{ history.replaceState(null, '', '#/game'); }catch(ex){}
    setTimeout(() => {
      if(gameScreen && !gameScreen.classList.contains('active')){
        console.error('[继续冒险] 强制切换仍失败，弹出存档列表');
        toast('自动恢复失败，请手动选择存档');
        openSaveList();
      }
    }, 500);
  }else if(gameScreen && gameScreen.classList.contains('active')){
    console.log('[继续冒险] 游戏画面已成功显示');
    if(recoveredSource !== 'main' && recoveredSource !== 'none'){
      toast('已从备份存档恢复，建议重新保存以更新存档');
    }
  }
}

/** 尝试进入游戏，如果失败则回退到标题页 */
function tryContinueIntoGame(isNewGame){
  try{
    enterGame(isNewGame);
  }catch(e){
    console.error('[进入游戏] 异常:', e);
    toast('进入游戏失败: ' + e.message);
    showScreen('screen-title');
  }
}

async function openSaveList(){
  const recovered = SaveUtils.recoverFromStorage(localStorage, LS_KEY);
  // 兼容检查：也接受含有 spirit 对象的存档（即使 gameMode 未标记）
  const localSave = recovered.data && (recovered.data.gameMode === 'text-rpg' || typeof recovered.data.spirit === 'object') ? recovered.data : null;
  console.log('[存档列表] 本地存档:', localSave ? localSave.name + ' Lv.' + localSave.level : '无');
  let serverList = [];
  let serverAvailable = true;
  try{
    const res = await fetch('/api/player/list');
    if(!res.ok) throw new Error('服务器响应异常');
    const json = await res.json();
    serverList = (json.list || [])
      .filter(save => save.gameMode === 'text-rpg' || (save.gameMode == null && typeof save.spirit === 'object'))
      .sort((a, b) => String(b.lastSave || '').localeCompare(String(a.lastSave || '')));
  }catch(error){
    serverAvailable = false;
    console.warn('服务器存档列表不可用，继续显示本地存档:', error);
  }

  const rows = [];
  const localServerIndex = localSave ? serverList.findIndex(save => save.playerId === localSave.playerId) : -1;
  const matchingServer = localServerIndex >= 0 ? serverList[localServerIndex] : null;
  if(localSave){
    rows.push(`<div class="save-group-title">本机 · 最近存档（优先读取）</div>`);
    const sourceLabel = recovered.source === 'main' ? '本地' : (recovered.source === 'backup' ? '本地备份恢复' : '本地历史恢复');
    rows.push(`<div class="save-row local-save-row">
      <div>
        <div class="sn">${esc(localSave.name)} <span style="color:#c9a84c">Lv.${localSave.level}</span> <span style="color:#7fc48c;font-size:12px">（${sourceLabel}${matchingServer ? '＋服务器' : ''}）</span></div>
        <div class="si">武魂：${esc(localSave.spirit && localSave.spirit.name || '未知')} · ${localSave._saveTime ? new Date(localSave._saveTime).toLocaleString('zh-CN') : '时间未知'}${matchingServer ? ` · 云端 ${esc(String(matchingServer.lastSave || '').slice(0, 16).replace('T', ' '))}` : ''}</div>
      </div>
      <div class="save-acts"><button class="mini-btn" id="btn-local-load">读取本地</button>${matchingServer ? `<button class="mini-btn" data-load="${esc(matchingServer.playerId)}">读取云端</button>` : ''}<button class="mini-btn danger" id="btn-local-del">删除本地</button></div>
    </div>`);
  }
  const otherServer = serverList.filter((_, index) => index !== localServerIndex);
  if(otherServer.length){
    rows.push(`<div class="save-group-title">云端 · 其他角色</div>`);
  }
  otherServer.forEach(save => rows.push(`<div class="save-row">
    <div>
      <div class="sn">${esc(save.name)} <span style="color:#c9a84c">Lv.${Number(save.level) || 1}</span> <span style="color:#6b5e42;font-size:12px">（服务器）</span></div>
      <div class="si">武魂：${esc(typeof save.spirit === 'object' ? save.spirit.name : save.spirit)} · ${esc(String(save.lastSave || '').slice(0, 16).replace('T', ' '))}</div>
    </div>
    <div class="save-acts"><button class="mini-btn" data-load="${esc(save.playerId)}">读取</button><button class="mini-btn danger" data-del="${esc(save.playerId)}">删除</button></div>
  </div>`));

  if(!rows.length){
    openModal('继续冒险', `<div style="text-align:center;color:#a89a7c;padding:24px">没有找到可继续的存档，先开始新的旅程吧！${serverAvailable ? '' : '<br><small>服务器暂不可用</small>'}</div>`);
    return;
  }
  openModal('继续冒险', rows.join('') + (!serverAvailable ? '<div style="text-align:center;color:#d6a25d;font-size:12px;margin-top:8px">服务器暂不可用，当前仅显示本地存档</div>' : ''));
  const localLoad = $('btn-local-load');
  if(localLoad) localLoad.addEventListener('click', () => {
    // C-a：云端比本地更新时，读取本地会覆盖云端，需明确确认
    if(matchingServer){
      const localTime = Number(localSave._saveTime) || 0;
      const cloudTime = new Date(String(matchingServer.lastSave || '')).getTime();
      if(cloudTime > localTime + 5000 && !confirm(`云端有更新的存档（${esc(String(matchingServer.lastSave || '').slice(0, 16).replace('T', ' '))} 晚于本地），读取本地将覆盖云端进度。仍要读取本地吗？`)) return;
    }
    try{
      const migrated = SaveUtils.migrateSave(localSave);
      if(!migrated){
        toast('本地存档读取失败：存档数据无效');
        return;
      }
      G = migrated;
      window.G = G;
      console.log('[读档] 本地读取成功:', G.name, 'Lv.' + G.level);
      saveLocal();
      closeModal();
      tryContinueIntoGame(false);
      if(G) toast(`✦ 欢迎回来，${G.name}${recovered.source === 'backup' ? '（已恢复备份）' : ''}`);
    }catch(e){
      console.error('[本地读档] 异常:', e);
      toast('本地存档读取异常，请尝试重新存档');
    }
  });
  const localDelete = $('btn-local-del');
  if(localDelete) localDelete.addEventListener('click', () => {
    if(!confirm('确定删除本地存档及其全部本地备份吗？服务器存档不会受影响。')) return;
    Object.keys(localStorage).filter(key => key === LS_KEY || key.startsWith(LS_KEY + '_')).forEach(key => localStorage.removeItem(key));
    $('btn-continue').textContent = '继续冒险';
    openSaveList();
    toast('本地存档与备份已删除');
  });
  $('modal-body').querySelectorAll('[data-load]').forEach(button => button.addEventListener('click', () => {
    // C-a：读取云端（含本地行内的“读取云端”）前，若本地同角色更新则需确认
    const target = serverList.find(save => save.playerId === button.dataset.load);
    if(target && localSave && target.playerId === localSave.playerId){
      const localTime = Number(localSave._saveTime) || 0;
      const cloudTime = new Date(String(target.lastSave || '')).getTime();
      if(localTime > cloudTime + 5000 && !confirm('本地存档比云端更新，读取云端将覆盖本地进度。仍要读取云端吗？')) return;
    }
    loadPlayer(button.dataset.load);
  }));
  $('modal-body').querySelectorAll('[data-del]').forEach(button => button.addEventListener('click', async () => {
    const target = serverList.find(save => save.playerId === button.dataset.del);
    const name = target ? target.name : '';
    const typed = prompt(`确定删除云端存档「${name}」吗？此操作不可恢复。\n请输入角色名「${name}」确认：`);
    if(typed === null) return;
    if(String(typed).trim() !== String(name).trim()){ toast('角色名不匹配，已取消删除'); return; }
    try{
      const res = await fetch('/api/player/' + encodeURIComponent(button.dataset.del), { method:'DELETE' });
      if(!res.ok) throw new Error('删除失败');
      toast('服务器存档已删除');
      openSaveList();
    }catch(error){ toast('删除失败，服务器暂不可用'); }
  }));
}

async function loadPlayer(playerId){
  console.log('[读档] 开始读取 playerId:', playerId);
  try{
    const res = await fetch('/api/player/load/' + encodeURIComponent(playerId));
    if(!res.ok) throw new Error('server error');
    const json = await res.json();
    console.log('[读档] 服务器返回 success:', json.success, 'data存在:', !!json.data);
    if(json.success && json.data){
      console.log('[读档] 服务器数据 name:', json.data.name, 'level:', json.data.level);
      G = SaveUtils.migrateSave(json.data);
      if(!G) throw new Error('服务器存档结构无效');
      console.log('[读档] migrateSave 成功, G.playerId:', G.playerId);
      window.G = G; // 确保路由守卫可访问
      
      // ★ 直接写入 localStorage（路由守卫依赖此检查，必须成功）
      try{
        const serialized = JSON.stringify(G);
        localStorage.setItem(LS_KEY, serialized);
        console.log('[读档] 直接写入 localStorage 成功, 大小:', serialized.length, 'bytes');
      }catch(e1){
        console.error('[读档] 直接写入 localStorage 失败:', e1);
      }
      
      // 再做备份链（非关键，失败不影响）
      try{ saveLocal(); }catch(e){ console.warn('[读档] 备份链失败:', e); }
      
      console.log('[读档] 调用 closeModal + tryContinueIntoGame');
      closeModal();
      tryContinueIntoGame(false);
      if(G) toast('✦ 欢迎回来，' + G.name);
    }else toast('存档读取失败');
  }catch(e){
    console.error('[读档] 服务器读档失败:', e);
    // 服务器失败时也使用完整本地备份链，而不是只解析可能损坏的主档。
    try{
      const recovered = SaveUtils.recoverFromStorage(localStorage, LS_KEY);
      if(!recovered.data) throw new Error('没有有效本地存档');
      console.log('[读档] 回退到本地存档:', recovered.source);
      G = recovered.data;
      window.G = G;
      if(recovered.source !== 'main') localStorage.setItem(LS_KEY, JSON.stringify(G));
      closeModal();
      tryContinueIntoGame(false);
      if(G) toast(`✦ 欢迎回来，${G.name}（${recovered.source === 'main' ? '本地存档' : '备份恢复'}）`);
    }catch(e2){
      console.error('[读档] 全部失败:', e2);
      toast('存档读取失败，请尝试导入备份或重新开始');
    }
  }
}

// ==================== 进入游戏 / 结局 ====================
function enterGame(isNewGame){
  if(!G || typeof G !== 'object'){
    console.error('[enterGame] G 无效:', G);
    toast('没有有效的游戏数据');
    showScreen('screen-title');
    return;
  }
  const migrated = SaveUtils.migrateSave(G);
  if(!migrated || typeof migrated.spirit !== 'object'){
    console.error('[enterGame] migrateSave 失败:', G && G.name, G && G.level);
    toast('该存档不是文字版存档，无法在当前模式读取');
    showScreen('screen-title');
    return;
  }
  // 兼容旧档：缺失 spiritBase 或 originBonus 时从武魂数据中重建
  if(!migrated.spiritBase || !migrated.originBonus){
    console.warn('[enterGame] 存档缺少 spiritBase 或 originBonus，尝试重建');
    if(!migrated.spiritBase){
      const spiritData = DATA.spirits.find(s => s.id === (migrated.spirit && migrated.spirit.id));
      if(spiritData){
        migrated.spiritBase = { attack:spiritData.attack || 10, defense:spiritData.defense || 10, hp:spiritData.hp || 100, speed:spiritData.speed || 10 };
      } else {
        migrated.spiritBase = { attack:10, defense:10, hp:100, speed:10 };
      }
    }
    if(!migrated.originBonus){
      migrated.originBonus = { attack:0, defense:0, hp:0, speed:0, spiritPower:0 };
    }
    toast('已重建部分缺失属性，建议重新保存');
  }
  G = migrated;
  window.G = G;
  // 旧档兼容：早期版本 _personality/_destiny 可能保存为字符串，
  // 若不做归一化，refreshPanel 读取 .traits/.name 会抛异常导致“继续冒险”中断。
  if(G._personality && typeof G._personality === 'string'){
    G._personality = { traits:[G._personality], subtype:G.spirit && G.spirit.subtype ? G.spirit.subtype : '' };
  }
  if(G._destiny && typeof G._destiny === 'string'){
    const matched = (typeof DESTINY_PATHS !== 'undefined' ? DESTINY_PATHS : []).find(p => p.name === G._destiny || p.id === G._destiny);
    G._destiny = matched || { name:G._destiny };
  }
  G._personality = G._personality && typeof G._personality === 'object' ? G._personality : { traits:['独特'], subtype:'' };
  G._destiny = G._destiny && typeof G._destiny === 'object' ? G._destiny : { name:G._destiny || '命运之路' };
  if(G.spirit && !G.spirit.eventKey){
    const spiritData = DATA.spirits && DATA.spirits.find(spirit => spirit.id === G.spirit.id);
    if(spiritData && spiritData.eventKey) G.spirit.eventKey = spiritData.eventKey;
  }
  const originLocMap = {
    star_forest:'holy_soul_village', spirit_city:'wuhun_city', border_town:'tian_dou_city', sea_island:'tian_dou_city'
  };
  const currentLocation = resolveMapLocation(G._currentLocation) || resolveMapLocation(originLocMap[G.origin]) || resolveMapLocation('shrek_academy');
  G._currentLocation = currentLocation ? currentLocation.id : 'shrek_academy';
  // 旧档补齐出身显示名（P1-12：出身稳定保存并在面板/日记可见）
  if(!G.originName){
    const originDef = ORIGINS.find(o => o.id === G.origin);
    G.originName = originDef ? originDef.fullName : (G.origin ? `未知出身（${G.origin}）` : '未知');
  }
  G._metNpcs = Array.isArray(G._metNpcs) ? G._metNpcs : [];
  G._bones = Array.isArray(G._bones) ? G._bones : [];
  G._forgeBones = Array.isArray(G._forgeBones) ? G._forgeBones : [];
  G._craftedBones = Array.isArray(G._craftedBones) ? G._craftedBones : [];
  // 魂骨→碎片的一次性旧档迁移由 SaveUtils 负责，进入游戏不重复补发。
  G._visitedLocations = Array.isArray(G._visitedLocations) ? G._visitedLocations : [];
  visitLocation(G._currentLocation, { silent:true });
  G._achievementList = Array.isArray(G._achievementList) ? G._achievementList : [];
  G._titles = Array.isArray(G._titles) ? G._titles : [];
  G._activeTitle = G._activeTitle || 'novice';
  G._skillTree = G._skillTree && typeof G._skillTree === 'object' ? G._skillTree : {};
  G._diary = Array.isArray(G._diary) ? G._diary : [];
  G._npcRelations = G._npcRelations && !Array.isArray(G._npcRelations) ? G._npcRelations : {};
  G._npcCooldowns = G._npcCooldowns || {};
  G._dailySign = G._dailySign || {};
  G._towerFloor = Number(G._towerFloor) || 0;
  G._gameTime = Number(G._gameTime) || 0;
  G._weather = Number(G._weather) || 0;
  G._dynCooldowns = G._dynCooldowns || {};
  G.battleStats = G.battleStats || { wins:0, losses:0, kills:0 };
  G._storyPath = Array.isArray(G._storyPath) ? G._storyPath : [];
  G._storyDecisions = G._storyDecisions || {};
  G._activeFormation = G._activeFormation || 'none';
  G._progressionRulesVersion = Math.max(1, Math.floor(Number(G._progressionRulesVersion) || (isNewGame ? 2 : 1)));
  G.overflowExp = Math.max(0, Number(G.overflowExp) || 0);
  G._registeredAtHall = Boolean(G._registeredAtHall);
  G._enrollmentComplete = Boolean(G._enrollmentComplete);
  G._firstClassDone = Boolean(G._firstClassDone || G.doneEvents.includes('first_class'));
  G._introPendingEvent = G._introPendingEvent || null;
  G._totalGoldEarned = Math.max(Number(G._totalGoldEarned) || 0, Number(G.gold) || 0);
  G._battleActive = false;
  G._bossKilled = Boolean(G._bossKilled);
  G._exploredHidden = Array.isArray(G._exploredHidden) ? G._exploredHidden : [];
  if(progressionRulesActive()) updatePendingRing();
  applySkillTreeBonuses();
  // 根据用户偏好启动游戏音乐和粒子
  const audioEnabled = localStorage.getItem('dldl_audio_enabled');
  if(audioEnabled !== 'false') AudioFX.setMood('academy');
  const particlesEnabled = localStorage.getItem('dldl_particles_enabled');
  if(particlesEnabled !== 'false'){
    ParticleEngine.start();
    ParticleEngine.setBackground('forest');
  }
  // 先启动统一过渡，再同步 Hash；G 已就绪，路由守卫不会误拦截。
  if(window.transitionToScreen) window.transitionToScreen('screen-game');
  else {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const gameScreen = document.getElementById('screen-game');
    if(gameScreen) gameScreen.classList.add('active');
  }
  try{
    if(window.location.hash !== '#/game') history.replaceState(null, '', '#/game');
  }catch(e){}
  console.log('[enterGame] 游戏画面正在显示');
  refreshPanel();
  saveLocal();
  startAutoSave();
  
  const beginFirstAdventure = () => {
    playEarlyLifeNodes(() => {
      if(G._enrollmentComplete && !G._firstClassDone){
        const firstClass = EVENTS.find(event => event.id === 'first_class');
        G._introPendingEvent = null;
        if(firstClass){ renderScene(firstClass, buildChoices(firstClass)); return; }
      }
      if(isNewGame && shouldShowTutorial()) setTimeout(() => startTutorial(nextEvent), 350);
      else nextEvent();
    });
  };
  // 新游戏：武魂专属 VN 序章只播放一次；旧存档迁移后不会被强制重播。
  if(isNewGame && !G._prologueDone){
    playPrologue(() => {
      G._prologueDone = true;
      G._spiritAwakeningStoryDone = true;
      saveLocal();
      beginFirstAdventure();
    });
  } else {
    beginFirstAdventure();
  }
}

function showEnding(){
  G.finished = true;
  saveLocal();
  saveServer(true);
  // 结局判定：先检查有特殊条件的结局（从高到低），再回退到命运值
  let ending = null;
  // 优先匹配有req条件的结局
  for(const e of ENDINGS){
    if(e.req && e.req(G) && G.fatePoints >= e.minFate){
      ending = e;
      break;
    }
  }
  // E4：同时满足多个结局条件时，明确提示按优先级结算
  const matchedAll = ENDINGS.filter(e => e.req && e.req(G) && G.fatePoints >= e.minFate);
  if(matchedAll.length > 1){
    toast(`满足 ${matchedAll.length} 个结局条件，按「${matchedAll[0].title}」优先结算`);
  }
  // 如果没有匹配特殊条件，按命运值从高到低匹配
  if(!ending){
    const sorted = [...ENDINGS].filter(e => !e.req).sort((a, b) => b.minFate - a.minFate);
    ending = sorted.find(e => G.fatePoints >= e.minFate) || ENDINGS[ENDINGS.length - 1];
  }
  $('ending-title').textContent = '【结局】' + ending.title;
  $('ending-sub').textContent = `${G.name} · ${G.spirit.name} · Lv.${G.level}`;
  $('ending-text').innerHTML = ending.text.map(p => `<p>${esc(p)}</p>`).join('');
  $('ending-stats').innerHTML = [
    { v: G.level, l: '最终等级' },
    { v: G.rings.length, l: '魂环数量' },
    { v: G.battleStats.wins, l: '战斗胜利' },
    { v: G.battleStats.kills, l: '猎杀魂兽' },
    { v: G.gold, l: '剩余金币' },
    { v: G.fatePoints, l: '命运值' },
    { v: (G._achievementList||[]).length, l: '达成成就' },
    { v: G._towerFloor || 0, l: '挑战塔层数' },
    { v: (G._storyPath||[]).length, l: '关键选择' },
    { v: calcCombatPower(), l: '综合战力' }
  ].map(s => `<div class="ending-stat"><div class="es-v">${s.v}</div><div class="es-l">${s.l}</div></div>`).join('');
  // 剧情路径总结
  const sp = getStoryPathSummary();
  if(sp){
    const pathHtml = `<div class="ending-story-path">
      <div class="esp-title">✦ 命运之路 ✦</div>
      <div class="esp-dominant">主导路线：<span style="color:#c9a84c">${esc(sp.dominantName)}</span></div>
      <div class="esp-paths">${sp.topPaths.map(p => `<span class="esp-path-tag">${esc(p.name)} ×${p.count}</span>`).join('')}</div>
    </div>`;
    $('ending-text').innerHTML += pathHtml;
  }
  // 播放结局音乐
  if(typeof AudioFX !== 'undefined'){
    AudioFX.setMood('ending');
  }
  // 结局粒子效果
  if(typeof ParticleEngine !== 'undefined'){
    ParticleEngine.setBackground('holy');
  }
  showScreen('screen-ending');
}

// ==================== 时间/天气系统 ====================
function getGameTime(){
  if(!G._gameTime) G._gameTime = 0;
  const times = TIME_PERIODS;
  return times[G._gameTime % times.length];
}

function advanceTime(){
  if(!G._gameTime) G._gameTime = 0;
  G._gameTime++;
  // 每次推进时间有概率改变天气
  if(!G._weather) G._weather = 0;
  if(Math.random() < 0.3){
    G._weather = Math.floor(Math.random() * WEATHER_TYPES.length);
  }
  updateTimeWeatherUI();
}

function getWeather(){
  if(!G._weather && G._weather !== 0) G._weather = 0;
  return WEATHER_TYPES[G._weather % WEATHER_TYPES.length];
}

function updateTimeWeatherUI(){
  const el = document.getElementById('time-weather-display');
  if(!el || !G) return;
  const time = getGameTime();
  const weather = getWeather();
  el.innerHTML = `<span title="${time.desc}">${time.icon} ${time.name}</span> <span title="${weather.desc}">${weather.icon} ${weather.name}</span>`;
}

// 检查动态事件
function checkDynamicEvents(){
  if(typeof DYNAMIC_EVENTS === 'undefined') return null;
  const ctx = {
    combo: Number(G._maxCombo) || 0,
    timeOfDay: getGameTime().id
  };
  for(const ev of DYNAMIC_EVENTS){
    if(ev.once && G.doneEvents && G.doneEvents.includes(ev.id)) continue;
    if(ev.cooldown){
      if(!G._dynCooldowns) G._dynCooldowns = {};
      if(G._dynCooldowns[ev.id] && G._dynCooldowns[ev.id] > 0) continue;
    }
    if(ev.condition && ev.condition(G, ctx)){
      return ev;
    }
  }
  return null;
}

// 检查连锁事件
function checkChainedEvents(){
  if(typeof CHAINED_EVENTS === 'undefined') return null;
  const phase = currentPhase();
  for(const key in CHAINED_EVENTS){
    const ev = CHAINED_EVENTS[key];
    if(ev.phase !== phase) continue;
    if(ev.minLevel && G.level < ev.minLevel) continue;
    if(ev.requires && !ev.requires(G)) continue;
    if(G.doneEvents && G.doneEvents.includes(ev.id)) continue;
    if(G._recentEvents && G._recentEvents.includes(ev.id)) continue;
    // 连锁事件权重较高
    return ev;
  }
  return null;
}

// 减少动态事件冷却
function decrementDynamicCooldowns(){
  if(!G._dynCooldowns) return;
  for(const id in G._dynCooldowns){
    if(G._dynCooldowns[id] > 0) G._dynCooldowns[id]--;
  }
}

// ==================== 地图与旅行 ====================
function resolveMapLocation(value){
  if(!value || !DATA.mapData) return null;
  const raw = String(value);
  let found = DATA.mapData.find(loc => loc.id === raw || loc.name === raw);
  if(found) return found;
  found = DATA.mapData.find(loc => raw.includes(loc.name) || loc.name.includes(raw));
  if(found) return found;
  const aliases = {
    '星斗大森林·外围':'star_duo_outer','星斗大森林·深处':'star_duo_deep',
    '史莱克学院':'shrek_academy','星斗大森林外围':'star_duo_outer','星斗大森林深处':'star_duo_deep','星斗大森林':'star_duo_outer',
    '武魂城':'wuhun_city','武魂殿':'spirit_hall','天斗城':'tian_dou_city','落日森林':'sunset_forest',
    '海神岛':'sea_god_island','冰封森林':'ice_forest','杀戮之都':'slaughter_city','远古遗迹':'ancient_ruins',
    '深渊裂缝':'abyss_rift','龙之谷':'dragon_valley','灵药谷':'medicine_valley','暗影沼泽':'shadow_swamp',
    '元素峡谷':'element_valley','死亡沙漠':'desert_death','邪魔森林':'evil_forest','钢铁之城':'steel_city',
    '天空之城':'sky_city','圣魂村':'holy_soul_village','昊天宗':'haotian_sect','七宝琉璃宗':'seven_treasure_glaze',
    '力之一族领地':'strength_clan','敏之一族领地':'speed_clan','御之一族领地':'defense_clan','破之一族领地':'breaking_clan',
    'slk_academy':'shrek_academy'
  };
  const alias = Object.entries(aliases).find(([name]) => raw.includes(name));
  return alias ? DATA.mapData.find(loc => loc.id === alias[1]) || null : null;
}

function visitedMapIds(){
  const ids = new Set();
  for(const value of G._visitedLocations || []){
    const loc = resolveMapLocation(value);
    if(loc) ids.add(loc.id);
  }
  const current = resolveMapLocation(G._currentLocation);
  if(current) ids.add(current.id);
  return [...ids];
}

function syncMapState(){
  const frame = document.getElementById('map-iframe');
  if(!frame || !frame.contentWindow || !G || !DATA.mapData) return;
  const visited = new Set(visitedMapIds());
  const current = resolveMapLocation(G._currentLocation);
  const locations = DATA.mapData.map(loc => {
    const adjacent = Boolean(current && ((current.connectedTo || []).includes(loc.id) || (loc.connectedTo || []).includes(current.id)));
    const wasVisited = visited.has(loc.id);
    return {
      id:loc.id,
      name:loc.name,
      unlockedLevel:Number(loc.unlockedLevel) || 1,
      visited:wasVisited,
      current:Boolean(current && current.id === loc.id),
      adjacent,
      normalCost:travelCost(current, loc, false),
      fastCost:travelCost(current, loc, true)
    };
  });
  frame.contentWindow.postMessage({
    type:'map-state',
    currentId:current ? current.id : '',
    visitedIds:[...visited],
    level:G.level,
    gold:G.gold,
    locations,
    discoveredHidden:(G._discoveredHidden || []).map(h => ({ id:h.id, name:h.name, desc:h.desc }))
  }, '*');
}

function openMap(){
  if(!G) return;
  saveServer(true);
  if(window.navigateTo) window.navigateTo('map');
  else window.location.href = 'map.html';
  const frame = document.getElementById('map-iframe');
  if(frame){
    if(frame.contentDocument && frame.contentDocument.readyState === 'complete') setTimeout(syncMapState, 50);
    else frame.addEventListener('load', syncMapState, { once:true });
  }
}

function travelCost(from, to, fast){
  if(!to) return 0;
  const base = Math.max(5, Math.round(Number(to.travelTime || 15) / 3));
  return fast ? base * 2 : base;
}

function travelToLocation(locationValue, fast){
  if(!G) return false;
  // 旅行完成后自动收起顶部菜单，避免展开状态遮挡场景。
  document.querySelectorAll('details.top-group[open]').forEach(d => d.removeAttribute('open'));
  const target = resolveMapLocation(locationValue);
  const current = resolveMapLocation(G._currentLocation) || resolveMapLocation('shrek_academy');
  if(!target){ toast('无法定位该地点'); return false; }
  if(target.unlockedLevel && G.level < target.unlockedLevel){ toast(`需要达到 Lv.${target.unlockedLevel} 才能前往`); return false; }
  if(current && target.id === current.id){ toast('你已经在这里了'); return false; }
  const visited = visitedMapIds();
  const isVisited = visited.includes(target.id);
  const connected = !current || (current.connectedTo || []).includes(target.id) || (target.connectedTo || []).includes(current.id);
  if(!isVisited && !connected){ toast('只能先探索与当前位置相邻的地点'); return false; }
  const useFast = Boolean(fast && isVisited);
  const cost = travelCost(current, target, useFast);
  if(G.gold < cost){ toast(`旅行需要 ${cost} 金币，当前金币不足`); return false; }
  G.gold -= cost;
  G._currentLocation = target.id;
  visitLocation(target.id, { silent:true });
  completeWorldAction();
  addDiaryEntry(`从「${current ? current.name : '旅途'}」前往「${target.name}」，花费${cost}金币。`, 'discovery');
  saveLocal();
  refreshPanel();
  closeModal();
  if(window.navigateTo) window.navigateTo('game');
  const encounterRate = useFast ? 0.08 : 0.32;
  if(Math.random() < encounterRate){
    setTimeout(() => triggerRandomEncounter(), 80);
  }else{
    const travelDays = Math.max(1, Math.round(Number(target.travelTime || 15) / 3));
    const encounterPct = useFast ? 8 : 32;
    renderContinue(null, `你顺利抵达「${esc(target.name)}」，旅费 ${cost} 金币（路程约 ${travelDays} 天，遇险率约 ${encounterPct}%）。`);
  }
  return true;
}

// ==================== 战争迷雾系统 ====================
// 隐藏地点配置：clue 为玩家可理解的发现线索（可隐藏完整条件，但不能完全无提示）
const HIDDEN_LOCATIONS = [
  { id:'secret_cave', name:'隐秘洞窟', mapX:59, mapY:47, revealCondition:G => G.level >= 15 && G._visitedLocations && G._visitedLocations.includes('star_duo_outer'),
    clue:'传闻星斗大森林外围有一处被藤蔓掩盖的洞窟，只有达到 Lv.15 的魂师深入探索后才可能发现。',
    desc:'在星斗大森林深处发现的一个隐秘洞窟，传说其中藏有上古遗宝' },
  { id:'ancient_altar', name:'远古祭坛', mapX:26, mapY:64, revealCondition:G => G.level >= 25 && G._visitedLocations && G._visitedLocations.includes('ancient_ruins'),
    clue:'远古遗迹中流传着祭坛的传说，据说 Lv.25 以上的强者在遗迹中能找到通往它的密道。',
    desc:'远古遗迹中隐藏的祭坛，似乎与神界有着某种联系' },
  { id:'dragon_nest', name:'龙巢遗迹', mapX:79, mapY:41, revealCondition:G => G.level >= 35 && G._visitedLocations && G._visitedLocations.includes('dragon_valley'),
    clue:'龙之谷的猎人们偶尔提到谷底深处有巨龙巢穴的残迹，只有 Lv.35 以上的勇士才能抵达。',
    desc:'龙之谷最深处的龙巢，据说沉睡着上古龙族的宝藏' },
  { id:'abyss_rift', name:'深渊裂缝', mapX:19, mapY:44, revealCondition:G => G.level >= 45 && G._bossKilled !== true,
    clue:'传说大地上有一道通往地底深渊的裂缝，深渊魔鲸等恐怖魂兽栖息其中，Lv.45 以上的魂师才能靠近。',
    desc:'大地上裂开的一道深渊裂缝，从中涌出令人不安的气息' },
  { id:'fairy_pool', name:'仙灵之池', mapX:43, mapY:44, revealCondition:G => G.level >= 20 && G._npcRelations && Object.keys(G._npcRelations).length >= 3,
    clue:'山民说，只有与至少三位人物建立羁绊、且达到 Lv.20 的旅人，才能在清晨的雾气中看见那汪仙灵之池。',
    desc:'只有与足够多的人建立羁绊后才能发现的仙灵之池' },
  { id:'star_fall', name:'陨星之地', mapX:50, mapY:28, revealCondition:G => G._stormAdventure === true && G.level >= 30,
    clue:'暴风雨之夜总有人声称看见流星坠落在远方，经历过暴风雨奇遇且达到 Lv.30 的魂师或可寻到那片陨星之地。',
    desc:'在暴风雨中发现的陨星坠落之地，蕴含星辰之力' }
];

function checkHiddenLocationReveal(){
  if(!G._discoveredHidden) G._discoveredHidden = [];
  for(const hidden of HIDDEN_LOCATIONS){
    if(G._discoveredHidden.find(h => h.id === hidden.id)) continue;
    if(hidden.revealCondition(G)){
      G._discoveredHidden.push({ id: hidden.id, name: hidden.name, desc: hidden.desc });
      toast(`✦ 发现隐藏地点：${hidden.name}！`);
      VisualFX.showAchievement('发现秘境', hidden.name, '🗺');
      AudioFX.playSfx('unlock');
      addDiaryEntry(`发现了隐藏地点「${hidden.name}」——${hidden.desc}。`, 'discovery');
      checkAchievements();
    }
  }
}

// ==================== 随机遭遇系统 ====================
const RANDOM_ENCOUNTERS = [
  { id:'ambush_beast', weight:30, minLevel:1, type:'battle',
    text:'一只野生魂兽突然从草丛中窜出，拦住了你的去路！',
    getEnemy:G => {
      const lvl = Math.max(1, G.level + rand(-2, 2));
      return {
        name: '野生魂兽', icon: '🐺',
        maxHp: 30 + lvl * 12, hp: 30 + lvl * 12,
        attack: 8 + lvl * 3, defense: 4 + lvl * 2, speed: 6 + lvl * 2,
        exp: 20 + lvl * 5, gold: 10 + lvl * 3
      };
    }
  },
  { id:'wandering_merchant', weight:15, minLevel:1, type:'merchant',
    text:'一位行商路过，他打量了你一番："魂师大人，要看看我的商品吗？"',
    items:[
      { name:'初级恢复丹', type:'item', price:50, effect:'heal', value:30 },
      { name:'魂力药水', type:'item', price:80, effect:'mp', value:20 },
      { name:'神秘宝箱', type:'item', price:200, effect:'random', value:0 }
    ]
  },
  { id:'lost_traveler', weight:12, minLevel:1, type:'event',
    text:'你遇到一位迷路的旅人，他看起来十分焦急。',
    choices:[
      { text:'指路（获得好感）', effect:G => { addGold(20); return '旅人感谢你的帮助，赠予20金币。'; } },
      { text:'无视', effect:G => '你匆匆离去，旅人叹了口气。' }
    ]
  },
  { id:'spirit_fragment', weight:10, minLevel:5, type:'reward',
    text:'你在路边发现了一块散发着微光的灵力碎片！',
    reward:G => { G.spiritPower = Math.min(getMaxSpiritPower(), G.spiritPower + 20); return '魂力恢复20点！'; }
  },
  { id:'ancient_cache', weight:8, minLevel:10, type:'reward',
    text:'你发现了一个古老的藏宝箱！',
    reward:G => { const gold = 100 + G.level * 10; addGold(gold); return `获得${gold}金币！`; }
  },
  { id:'rival_soul_master', weight:15, minLevel:8, type:'battle',
    text:'一位同级别的魂师拦住了你："来切磋一番如何？"',
    getEnemy:G => {
      const lvl = G.level;
      return {
        name: '魂师挑战者', icon: '⚔',
        maxHp: Math.round(40 + lvl * 15), hp: Math.round(40 + lvl * 15),
        attack: Math.round(10 + lvl * 3.5), defense: Math.round(5 + lvl * 2.5), speed: Math.round(8 + lvl * 2),
        exp: 30 + lvl * 8, gold: 20 + lvl * 5
      };
    }
  },
  { id:'rare_beast', weight:5, minLevel:15, type:'battle',
    text:'你感受到了一股强大的气息——一只罕见的精英魂兽出现了！',
    getEnemy:G => {
      const lvl = G.level + 3;
      return {
        name: '精英魂兽', icon: '👹',
        maxHp: Math.round(60 + lvl * 20), hp: Math.round(60 + lvl * 20),
        attack: Math.round(15 + lvl * 4), defense: Math.round(8 + lvl * 3), speed: Math.round(10 + lvl * 2),
        exp: 50 + lvl * 12, gold: 50 + lvl * 8,
        special: '精英',
        isBoss: true
      };
    }
  }
];

function triggerRandomEncounter(){
  const available = RANDOM_ENCOUNTERS.filter(e => G.level >= e.minLevel);
  if(available.length === 0) return false;
  const totalWeight = available.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let encounter = null;
  for(const e of available){
    roll -= e.weight;
    if(roll <= 0){ encounter = e; break; }
  }
  if(!encounter) return false;

  if(encounter.type === 'battle'){
    const enemy = encounter.getEnemy(G);
    const reward = { exp:enemy.exp || 30 + G.level * 3, gold:enemy.gold || 0, text:encounter.text };
    BattleSystem.start(enemy, { result:reward, countKill:!enemy.isNpc, allowFlee:true });
    return true;
  } else if(encounter.type === 'reward'){
    const msg = encounter.reward(G);
    toast(encounter.text + ' ' + msg);
    addDiaryEntry(encounter.text + ' ' + msg, 'discovery');
    VisualFX.showAchievement('意外发现', msg, '✦');
    refreshPanel();
    saveLocal();
    return true;
  } else if(encounter.type === 'merchant'){
    openRandomMerchant(encounter);
    return true;
  } else if(encounter.type === 'event'){
    openRandomEvent(encounter);
    return true;
  }
  return false;
}

function openRandomMerchant(encounter){
  const items = encounter.items;
  const html = `<div style="margin-bottom:12px;color:#d5c8a8;font-size:14px;line-height:1.6">${esc(encounter.text)}</div>
  <div class="shop-list">
    ${items.map((it, i) => {
      const canBuy = G.gold >= it.price;
      return `<div class="shop-item ${canBuy ? 'available' : 'unavailable'}">
        <div class="si-name">${esc(it.name)}</div>
        <div class="si-price">${it.price}金币</div>
        <button class="btn btn-sm ${canBuy ? 'btn-gold' : ''}" ${canBuy ? '' : 'disabled'} data-buy="${i}">购买</button>
      </div>`;
    }).join('')}
  </div>`;
  openModal('行商', html);
  document.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.buy);
      const it = items[i];
      if(G.gold < it.price) return;
      G.gold -= it.price;
      if(it.effect === 'heal'){
        const fs = finalStats();
        G.hp = Math.min(fs.maxHp, G.hp + it.value);
        toast(`恢复了${it.value}点生命！`);
      } else if(it.effect === 'mp'){
        G.spiritPower = Math.min(getMaxSpiritPower(), G.spiritPower + it.value);
        toast(`恢复了${it.value}点魂力！`);
      } else if(it.effect === 'random'){
        const rewards = [
          () => { const g = rand(100, 500); addGold(g); return `${g}金币`; },
          () => { const e = 50 + G.level * 5; gainExp(e); return `${e}经验`; },
          () => { G.bonus.attack = (G.bonus.attack||0) + 2; return '攻击+2'; },
          () => { G.bonus.defense = (G.bonus.defense||0) + 2; return '防御+2'; },
          () => { G.bonus.speed = (G.bonus.speed||0) + 1; return '速度+1'; }
        ];
        const msg = pick(rewards)();
        toast(`神秘宝箱开出：${msg}！`);
        VisualFX.showAchievement('宝箱开启', msg, '🎁');
      }
      saveLocal();
      refreshPanel();
      closeModal();
    });
  });
}

function openRandomEvent(encounter){
  const choicesHtml = encounter.choices.map((c, i) => {
    return `<button class="choice-btn" data-choice="${i}">${esc(c.text)}</button>`;
  }).join('');
  const html = `<div style="margin-bottom:12px;color:#d5c8a8;font-size:14px;line-height:1.6">${esc(encounter.text)}</div>
  <div class="choices">${choicesHtml}</div>`;
  openModal('遭遇', html);
  document.querySelectorAll('[data-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.choice);
      const choice = encounter.choices[i];
      const result = choice.effect(G);
      toast(result);
      addDiaryEntry(encounter.text + ' ' + result, 'event');
      saveLocal();
      refreshPanel();
      closeModal();
    });
  });
}

// ==================== 快速旅行系统 ====================
function exploreHiddenLocation(hiddenId){
  const hidden = (G._discoveredHidden || []).find(location => location.id === hiddenId);
  if(!hidden){ toast('尚未发现该秘境'); return; }
  if(!G._exploredHidden) G._exploredHidden = [];
  const firstVisit = !G._exploredHidden.includes(hiddenId);
  closeModal();
  if(firstVisit){
    G._exploredHidden.push(hiddenId);
    const gold = 120 + G.level * 8;
    const exp = 80 + G.level * 10;
    addGold(gold);
    gainExp(exp);
    if(!G._forgeBones) G._forgeBones = [];
    G._forgeBones.push({ source:hidden.name, tier:G.level >= 50 ? 3 : 2, obtainedAt:Date.now() });
    addDiaryEntry(`深入探索秘境「${hidden.name}」，获得${gold}金币、${exp}经验及魂骨碎片。`, 'discovery');
    checkAchievements();
    saveLocal();
    refreshPanel();
    renderContinue(null, `你深入探索「${esc(hidden.name)}」：${esc(hidden.desc || '')}<br><span class="hl-gold">金币+${gold}　经验+${exp}　魂骨碎片×1</span>`);
  }else{
    renderContinue(null, `你再次来到「${esc(hidden.name)}」静心修炼。这里的秘密已经被你探索过了。`);
  }
}

function openFastTravel(){
  if(!G) return;
  const visited = visitedMapIds();
  const current = resolveMapLocation(G._currentLocation);
  const locations = visited.map(id => DATA.mapData.find(loc => loc.id === id)).filter(Boolean);
  const hidden = G._discoveredHidden || [];
  if(!locations.length && !hidden.length){
    openModal('快速旅行', '<div style="text-align:center;color:#a89a7c;padding:30px">尚未发现可旅行的地点，继续冒险即可扩展足迹。</div>');
    return;
  }
  const html = `<div class="fast-travel-list">
    ${locations.map(loc => {
      const isCurrent = current && loc.id === current.id;
      const cost = travelCost(current, loc, true);
      return `<button class="ft-card ${isCurrent ? 'current' : ''}" data-fast-travel="${esc(loc.id)}" ${isCurrent ? 'disabled' : ''} style="width:100%;text-align:left">
        <div class="ft-name">${esc(loc.name)}${isCurrent ? ' ← 当前所在' : ''}</div>
        <div class="ft-desc">${esc(loc.description || '').slice(0, 70)}${(loc.description || '').length > 70 ? '…' : ''}</div>
        <div class="ft-region">${isCurrent ? '当前位置' : `快速旅行费用：${cost}金币`}</div>
      </button>`;
    }).join('')}
    ${hidden.map(loc => `<button class="ft-card" data-hidden-travel="${esc(loc.id)}" style="width:100%;text-align:left;border-color:#a78bfa">
      <div class="ft-name">🔮 ${esc(loc.name)}${(G._exploredHidden || []).includes(loc.id) ? '（已探索）' : '（新发现）'}</div>
      <div class="ft-desc">${esc(loc.desc || '')}</div><div class="ft-region">进入秘境 · 免费</div>
    </button>`).join('')}
  </div><div style="margin-top:10px;font-size:13px;color:#a89a7c;text-align:center">已访问地点可快速前往；新发现的秘境首次探索有奖励。</div>`;
  openModal('🗺 快速旅行与秘境', html);
  document.querySelectorAll('[data-fast-travel]').forEach(button => button.addEventListener('click', () => travelToLocation(button.dataset.fastTravel, true)));
  document.querySelectorAll('[data-hidden-travel]').forEach(button => button.addEventListener('click', () => exploreHiddenLocation(button.dataset.hiddenTravel)));
}

// ==================== 阵法选择 ====================
function openFormationSelect(){
  if(!G) return;
  const formations = FORMATIONS;
  const current = G._activeFormation || 'none';
  const html = `<div style="display:flex;flex-direction:column;gap:10px">
    ${formations.map(f => `
      <div class="ft-card ${f.id === current ? 'current' : ''}" data-form="${f.id}" style="cursor:pointer">
        <div class="ft-name">${esc(f.name)}${f.id === current ? ' ✓' : ''}</div>
        <div class="ft-desc">${esc(f.desc)}</div>
        <div class="ft-region">${esc(f.bonus)}</div>
      </div>`).join('')}
  </div>`;
  openModal('⚔ 阵法选择', html);
  document.querySelectorAll('[data-form]').forEach(card => {
    card.addEventListener('click', () => {
      G._activeFormation = card.dataset.form;
      if(!G._formationsUsed) G._formationsUsed = [];
      if(card.dataset.form !== 'none' && !G._formationsUsed.includes(card.dataset.form)) G._formationsUsed.push(card.dataset.form);
      toast(`已切换至「${formations.find(f=>f.id===card.dataset.form).name}」，属性已更新`);
      closeModal();
      refreshPanel();
      saveLocal();
    });
  });
}

// ==================== 人物图鉴 ====================
function openNpcCodex(){
  const npcs = DATA.npcData;
  if(!npcs.length){
    openModal('人物图鉴', '<div style="text-align:center;color:#a89a7c;padding:30px">图鉴数据加载中…</div>');
    return;
  }
  // 解锁记录：遇到过的NPC id
  const met = G._metNpcs || [];
  const html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;max-height:60vh;overflow-y:auto;padding:4px">
    ${npcs.map(n => {
      const unlocked = met.includes(n.id);
      return `
      <button class="npc-card" data-npc-detail="${unlocked ? esc(n.id) : ''}" ${unlocked ? '' : 'disabled'} style="
        border:1px solid ${unlocked ? '#c9a84c' : 'var(--line)'};border-radius:6px;width:100%;text-align:left;color:inherit;
        padding:12px;background:${unlocked ? 'rgba(46,36,20,.8)' : 'rgba(20,16,10,.5)'};
        cursor:${unlocked ? 'pointer' : 'default'};transition:all .25s;
      ">
        <div style="font-family:'Ma Shan Zheng',serif;font-size:16px;color:${unlocked ? '#c9a84c' : '#4a3d22'};letter-spacing:2px">${unlocked ? esc(n.name) : '？？？'}</div>
        <div style="font-size:11px;color:#a89a7c;margin-top:2px">${unlocked ? esc(n.title || '') : '未知'}</div>
        ${unlocked ? `<div style="font-size:11px;color:#7fc48c;margin-top:4px">✓ 已结识</div>` : ''}
      </button>`;
    }).join('')}
  </div>
  <div style="margin-top:12px;font-size:13px;color:#a89a7c;text-align:center">已结识 ${met.length}/${npcs.length} 位人物</div>`;
  openModal('人物图鉴', html);
  $('modal-body').querySelectorAll('[data-npc-detail]').forEach(button => {
    if(button.dataset.npcDetail) button.addEventListener('click', () => showNpcDetail(button.dataset.npcDetail));
  });
}

function showNpcDetail(npcId){
  const n = DATA.npcData.find(x => x.id === npcId);
  if(!n) return;
  const affinity = getNpcRelation(npcId);
  const level = getNpcRelationLevel(affinity);
  const nextLevel = NPC_RELATION_LEVELS.find(l => l.min > affinity);
  const progressPct = nextLevel ? Math.round((affinity - level.min) / (nextLevel.min - level.min) * 100) : 100;
  const reward = NPC_RELATION_REWARDS[level.min];

  // 互动按钮
  const interactionHtml = NPC_INTERACTIONS.map(inter => {
    const check = canInteract(npcId, inter.id);
    const costText = inter.cost > 0 ? `${inter.cost}金` : '免费';
    return `<button class="btn btn-sm ${check.ok ? 'btn-gold' : ''}" ${check.ok ? '' : 'disabled'}
      data-interact="${inter.id}" data-npc="${npcId}"
      title="${esc(inter.desc)}${check.ok ? '' : '（' + check.reason + '）'}"
      style="margin:3px;min-width:80px;font-size:12px">
      ${esc(inter.name)}<br><span style="font-size:10px;opacity:.7">${costText} · +${inter.affinity}♥</span>
    </button>`;
  }).join('');

  const html = `
    <div style="padding:10px">
      <div style="font-family:'Ma Shan Zheng',serif;font-size:28px;color:#c9a84c;letter-spacing:3px">${esc(n.name)}</div>
      <div style="font-size:15px;color:#e6c878;margin-bottom:12px">${esc(n.title || '')} · ${esc(n.faction || '')}</div>
      <div style="font-size:14px;color:#d5c8a8;line-height:2;margin-bottom:12px;text-indent:2em">${esc(n.desc || '')}</div>
      <div style="font-size:13px;color:#a89a7c;line-height:1.8">
        <b style="color:#c9a84c">性格：</b>${esc(Array.isArray(n.personality) ? n.personality.join('、') : (n.personality || ''))}<br>
        <b style="color:#c9a84c">常驻地点：</b>${esc(n.location || '')}<br>
        <b style="color:#c9a84c">技能：</b>${esc((n.skills || []).join('、'))}<br>
        <b style="color:#c9a84c">关系：</b>${esc((n.relationships || []).map(r => typeof r === 'string' ? r : (r.target + '(' + r.relation + ')')).join('、'))}
      </div>
      ${n.storyEvents && n.storyEvents.length ? `
        <div style="margin-top:10px;font-size:13px;color:#a89a7c;border-top:1px solid var(--line);padding-top:8px">
          <b style="color:#c9a84c">相关事件：</b>${esc(n.storyEvents.join('、'))}
        </div>` : ''}
      <!-- 好感度面板 -->
      <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:14px;color:${level.color}">♥ ${level.name}</span>
          <span style="font-size:12px;color:#a89a7c">${affinity}${nextLevel ? ' / ' + nextLevel.min : ' (满级)'}</span>
        </div>
        <div style="height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${progressPct}%;background:${level.color};border-radius:4px;transition:width .5s"></div>
        </div>
        ${reward ? `<div style="font-size:12px;color:#7fc48c;margin-bottom:8px">✦ ${reward.desc}</div>` : ''}
        ${nextLevel ? `<div style="font-size:11px;color:#6b5e42">下一级：${nextLevel.name}（需${nextLevel.min}好感）</div>` : ''}
      </div>
      <!-- 互动按钮 -->
      <div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">
        <div style="font-size:13px;color:#c9a84c;margin-bottom:8px">✦ 互动</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${interactionHtml}</div>
      </div>
    </div>`;
  openModal('人物详情', html);

  // 绑定互动按钮
  document.querySelectorAll('[data-interact]').forEach(btn => {
    btn.addEventListener('click', () => {
      interactNpc(btn.dataset.npc, btn.dataset.interact);
    });
  });
}

function meetNpc(npcId){
  if(!G._metNpcs) G._metNpcs = [];
  if(!G._metNpcs.includes(npcId)){
    G._metNpcs.push(npcId);
    const n = DATA.npcData.find(x => x.id === npcId);
    if(n) toast(`✦ 结识了「${n.name}」！人物图鉴已更新`);
    checkAchievements();
  }
}

// ==================== 魂骨图鉴 ====================
// 魂骨品级内部值 → 玩家可见名称（P2-18：禁止直接展示内部字段）
const BONE_TIER_NAMES = {
  common:'普通魂骨', rare:'稀有魂骨', epic:'史诗魂骨',
  legendary:'传说魂骨', mythic:'神话魂骨', divine:'神级魂骨'
};
const BONE_TIER_COLORS = {
  common:'#9ca3af', rare:'#22c55e', epic:'#a855f7',
  legendary:'#f59e0b', mythic:'#06b6d4', divine:'#fbbf24'
};
function boneTierName(tier){
  return BONE_TIER_NAMES[tier] || (typeof tier === 'string' && tier ? tier : '未知品级');
}
function boneTierColor(tier){
  return BONE_TIER_COLORS[tier] || '#c9a84c';
}

function openBoneCodex(){
  const bones = DATA.boneData;
  if(!bones.length){
    openModal('魂骨图鉴', '<div style="text-align:center;color:#a89a7c;padding:30px">图鉴数据加载中…</div>');
    return;
  }
  const owned = G._bones || [];
  const collected = owned.filter(id => bones.some(b => b.id === id)).length;
  const html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;max-height:60vh;overflow-y:auto;padding:4px">
    ${bones.map(b => {
      const has = owned.includes(b.id);
      const color = boneTierColor(b.tier);
      return `
      <div style="
        border:1px solid ${has ? color : 'var(--line)'};border-radius:6px;
        padding:12px;background:${has ? 'rgba(201,168,76,.08)' : 'rgba(20,16,10,.5)'};
        opacity:${has ? '1' : '.55'};
      ">
        <div style="font-family:'Ma Shan Zheng',serif;font-size:15px;color:${has ? '#c9a84c' : '#6b5e42'};letter-spacing:2px">
          ${esc(b.name)}
        </div>
        <div style="font-size:11px;color:${color};margin-top:2px">
          ${esc(b.type || '')} · ${esc(boneTierName(b.tier))} · ${esc(b.source || '')}
        </div>
        ${has ? `<div style="font-size:13px;color:#ccc;margin-top:6px;line-height:1.6">${esc(b.desc || '')}</div>
          ${b.skills ? b.skills.map(s => `<div style="font-size:12px;color:#7fc48c;margin-top:2px">✦ ${esc(s.name)}：${esc(s.desc || '')}</div>`).join('') : ''}`
        : `<div style="font-size:11px;color:#a89a7c;margin-top:6px;line-height:1.6">获取条件：${esc(b.dropCondition || b.source || '尚未探明')}</div>`}
      </div>`;
    }).join('')}
  </div>
  <div style="margin-top:12px;font-size:13px;color:#a89a7c;text-align:center;line-height:1.8">
    已收集 ${collected}/${bones.length} 块魂骨（${bones.length} 为斗罗大陆已知魂骨总数）<br>
    魂骨由魂兽极低概率掉落、魂师大赛奖励与秘境探索等途径获得，收集后永久生效并可转化为锻造材料。
  </div>`;
  openModal('魂骨图鉴', html);
}

function obtainBone(boneId){
  if(!G._bones) G._bones = [];
  if(!G._bones.includes(boneId)){
    G._bones.push(boneId);
    const bone = DATA.boneData.find(x => x.id === boneId);
    if(!G._forgeBones) G._forgeBones = [];
    const tier = bone && /divine|神/.test(String(bone.tier || '')) ? 3 : (bone && /legend|传说/.test(String(bone.tier || '')) ? 2 : 1);
    G._forgeBones.push({ source:boneId, tier, obtainedAt:Date.now() });
    if(bone) toast(`✦ 获得魂骨「${bone.name}」及${tier}阶锻造材料！`);
    checkAchievements();
  }
}

// ==================== 地点百科 ====================
function openLocationCodex(){
  const locs = DATA.locationData;
  if(!locs.length){
    openModal('地点百科', '<div style="text-align:center;color:#a89a7c;padding:30px">百科数据加载中…</div>');
    return;
  }
  const visited = G._visitedLocations || [];
  const html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;max-height:60vh;overflow-y:auto;padding:4px">
    ${locs.map(l => {
      const hasVisited = visited.includes(l.id);
      return `
      <button data-location-detail="${esc(l.id)}" style="
        border:1px solid ${hasVisited ? '#c9a84c' : 'var(--line)'};border-radius:6px;width:100%;text-align:left;color:inherit;
        padding:12px;background:${hasVisited ? 'rgba(46,36,20,.8)' : 'rgba(20,16,10,.5)'};
        cursor:pointer;transition:all .25s;
      ">
        <div style="font-family:'Ma Shan Zheng',serif;font-size:16px;color:${hasVisited ? '#c9a84c' : '#6b5e42'};letter-spacing:2px">${esc(l.name)}</div>
        <div style="font-size:12px;color:#a89a7c;margin-top:2px">${esc(l.region || '')}</div>
        ${hasVisited ? '<div style="font-size:11px;color:#7fc48c;margin-top:4px">✓ 已探索</div>' : ''}
      </button>`;
    }).join('')}
  </div>`;
  openModal('地点百科', html);
  $('modal-body').querySelectorAll('[data-location-detail]').forEach(button => button.addEventListener('click', () => showLocationDetail(button.dataset.locationDetail)));
}

function showLocationDetail(locId){
  const l = DATA.locationData.find(x => x.id === locId);
  if(!l) return;
  const html = `
    <div style="padding:10px;max-height:60vh;overflow-y:auto">
      <div style="font-family:'Ma Shan Zheng',serif;font-size:28px;color:#c9a84c;letter-spacing:3px">${esc(l.name)}</div>
      <div style="font-size:15px;color:#e6c878;margin-bottom:12px">${esc(l.region || '')}</div>
      <div style="font-size:14px;color:#d5c8a8;line-height:2;margin-bottom:10px;text-indent:2em">${esc(l.history || l.description || '')}</div>
      ${l.geography ? `<div style="font-size:13px;color:#a89a7c;line-height:1.8;margin-bottom:8px"><b style="color:#c9a84c">地理：</b>${esc(l.geography)}</div>` : ''}
      ${l.culture ? `<div style="font-size:13px;color:#a89a7c;line-height:1.8;margin-bottom:8px"><b style="color:#c9a84c">文化：</b>${esc(l.culture)}</div>` : ''}
      ${l.famousEvents ? `<div style="font-size:13px;color:#a89a7c;line-height:1.8;margin-bottom:8px"><b style="color:#c9a84c">著名事件：</b>${esc(l.famousEvents)}</div>` : ''}
      ${l.famousFigures ? `<div style="font-size:13px;color:#a89a7c;line-height:1.8;margin-bottom:8px"><b style="color:#c9a84c">著名人物：</b>${esc(l.famousFigures)}</div>` : ''}
      ${l.secrets ? `<div style="font-size:13px;color:#d06a5a;line-height:1.8;margin-top:8px;border-top:1px solid var(--line);padding-top:8px"><b style="color:#c9a84c">秘闻：</b>${esc(l.secrets)}</div>` : ''}
    </div>`;
  openModal('地点详情', html);
}

function visitLocation(locId, options){
  if(!G || !locId) return;
  const silent = Boolean(options && options.silent);
  if(!G._visitedLocations) G._visitedLocations = [];
  const mapLoc = resolveMapLocation(locId);
  const canonicalId = mapLoc ? mapLoc.id : String(locId);
  if(!G._visitedLocations.includes(canonicalId)){
    G._visitedLocations.push(canonicalId);
    const codexLoc = DATA.locationData.find(x => x.id === canonicalId || x.id === (mapLoc && mapLoc.name) || x.name === (mapLoc && mapLoc.name));
    if(!silent) toast(`✦ 首次抵达「${codexLoc ? codexLoc.name : (mapLoc ? mapLoc.name : canonicalId)}」，地点百科已更新`);
    // 到达地点只记录足迹；人物必须通过事件中的 npcIds 或正文相遇后解锁，
    // 避免玩家路过学院就自动“认识”所有重要角色。
    checkHiddenLocationReveal();
    checkAchievements();
    syncMapState();
  }
}

// ==================== 武魂魂技展示 ====================
function showSpiritSkills(spiritId){
  showMySkills();
}

// 查看我的魂技
function showMySkills(){
  if(!G) return;
  if(G.skills.length === 0){
    toast('你还没有获得任何魂技，先去获取魂环吧！');
    return;
  }
  const html = `
    <div style="padding:6px;max-height:65vh;overflow-y:auto">
      <div style="font-family:'Ma Shan Zheng',serif;font-size:clamp(20px,3vw,26px);color:#c9a84c;letter-spacing:3px;margin-bottom:6px;text-align:center">${esc(G.name)} · 魂技一览</div>
      <div style="text-align:center;font-size:13px;color:#a89a7c;margin-bottom:16px;letter-spacing:1px">武魂：${esc(G.spirit.name)} · 已获得 ${G.rings.length} 个魂环</div>
      <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        ${G.rings.map((r,i) => {
          const yearInfo = RING_YEAR_INFO[r.tier] || {};
          return `<div class="ring-mini" data-ring="${i}" style="width:36px;height:36px;border-radius:50%;border:3px solid ${r.color||yearInfo.color||'#c9a84c'};display:flex;align-items:center;justify-content:center;font-size:13px;color:${r.color||yearInfo.color||'#c9a84c'};cursor:pointer;box-shadow:0 0 10px ${yearInfo.glow||'rgba(201,168,76,.3)'};transition:transform .2s" title="${esc(r.yearLabel||r.name)}">${i+1}</div>`;
        }).join('')}
      </div>
      ${G.skills.map((s, i) => {
        const r = G.rings[i] || {};
        const yearInfo = RING_YEAR_INFO[r.tier] || {};
        const skClass = 'sk-' + (s.type||'攻击');
        return `<div class="skill-card ${skClass}" data-skill="${i}">
          <div class="skill-ring-num" style="color:${r.color||yearInfo.color||'#a89a7c'}">第${s.ring||i+1}魂技</div>
          <div class="skill-name" style="color:${r.color||'#e6c878'}">${esc(s.name)}</div>
          <div class="skill-meta">
            <span class="skill-tag" style="color:${r.color||'#c9a84c'};border-color:${r.color||'#c9a84c'}44;background:${r.color||'#c9a84c'}11">${esc(s.type||'攻击')}</span>
            <span class="skill-tag" style="color:#a89a7c;border-color:#3a2f1a">伤害 ${s.damage||0}</span>
            <span class="skill-tag" style="color:#a89a7c;border-color:#3a2f1a">魂力 ${s.cost||0}</span>
            ${r.yearLabel ? `<span class="skill-tag" style="color:${r.color};border-color:${r.color}44;background:${r.color}11">${esc(r.yearLabel)}</span>` : ''}
          </div>
          <div class="skill-desc">${esc(s.desc||'来自'+(s.source||'魂环')+'的魂技')}</div>
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-sm trial-skill-btn" data-skill="${i}" style="border-color:#a855f7;color:#a855f7;padding:4px 14px;min-height:unset;font-size:12px">⚔ 试用</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  openModal(`✦ 魂技录 ✦`, html);
  
  setTimeout(() => {
    // 试用按钮
    document.querySelectorAll('.trial-skill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.skill);
        const skill = G.skills[idx];
        closeModal();
        setTimeout(() => startSkillTrial(skill), 200);
      });
    });
  }, 50);
}

// 魂技试用（简易战斗演示）
function startSkillTrial(skill){
  if(!skill) return;
  const fs = finalStats();
  
  // 创建试用界面
  let arena = document.getElementById('trial-arena');
  if(!arena){
    arena = document.createElement('div');
    arena.id = 'trial-arena';
    arena.className = 'trial-arena';
    document.body.appendChild(arena);
  }
  
  // 试用人偶（根据魂环等级选择强度）
  const dummyHP = 100 + (skill.ring||1) * 60;
  const dummyAtk = 10 + (skill.ring||1) * 5;
  const dummies = [
    {name:'练习木桩',icon:'🪵',hp:dummyHP,maxHp:dummyHP},
    {name:'十年魂兽·风鸡',icon:'🐓',hp:dummyHP,maxHp:dummyHP},
    {name:'百年魂兽·幽冥狼',icon:'🐺',hp:dummyHP*1.2,maxHp:dummyHP*1.2},
    {name:'千年魂兽·人面魔蛛',icon:'🕷️',hp:dummyHP*1.5,maxHp:dummyHP*1.5},
  ];
  const dummy = dummies[Math.min((skill.ring||1)-1, dummies.length-1)];
  
  let playerHP = fs.maxHp;
  let playerMP = G.spiritPower;
  let enemyHP = dummy.hp;
  let enemyMax = dummy.maxHp;
  let turn = 0;
  let ended = false;
  
  const skillIcons = {slash:'⚔️',smash:'💥',stab:'🗡️',spin:'🌀',dash:'💨',shield:'🛡️',beam:'✨',seal:'📿',
    bind:'🌿',thorns:'🌹',heal:'💚',drain:'🩸',bless:'🙏',regen:'🌱',feast:'🍖',nourish:'🍵',
    rage:'😤',tear:'🌪️',roar:'🔊',quake:'🌋',pierce:'🎯',flash:'⚡',stun:'💫',arrow:'🏹',
    iron:'🗿',blink:'👻',swift:'🏃',revive:'💫'};
  const fxIcon = skillIcons[skill.anim] || '✨';
  
  function render(){
    arena.innerHTML = `
      <div class="trial-top">
        <div class="trial-title">⚔ 魂技试用 ⚔</div>
        <div class="trial-sub">试用「${esc(skill.name)}」· ${esc(skill.type||'攻击')}系 · ${esc(dummy.name)}</div>
      </div>
      <div class="trial-fighters">
        <div class="trial-fighter" id="trial-player">
          <div class="trial-fighter-name">${esc(G.name)}</div>
          <div class="trial-fighter-icon" style="color:#c9a84c">${G.spirit.icon||'✦'}</div>
          <div class="trial-hp-bar"><div class="trial-hp-fill player" style="width:${(playerHP/fs.maxHp)*100}%"></div></div>
          <div class="trial-hp-text">HP ${Math.max(0,Math.round(playerHP))}/${fs.maxHp} · MP ${Math.round(playerMP)}</div>
        </div>
        <div class="trial-vs">VS</div>
        <div class="trial-fighter" id="trial-enemy">
          <div class="trial-fighter-name">${esc(dummy.name)}</div>
          <div class="trial-fighter-icon" style="color:#d06a5a">${dummy.icon}</div>
          <div class="trial-hp-bar"><div class="trial-hp-fill enemy" style="width:${(enemyHP/enemyMax)*100}%"></div></div>
          <div class="trial-hp-text">HP ${Math.max(0,Math.round(enemyHP))}/${Math.round(enemyMax)}</div>
        </div>
      </div>
      <div class="trial-log" id="trial-log"></div>
      <div class="trial-actions">
        <button class="btn btn-gold" id="btn-use-skill" ${playerMP<(skill.cost||15)?'disabled':''} style="min-height:42px;padding:10px 24px">
          ${fxIcon} 释放${esc(skill.name)}（${skill.cost||15}魂力）
        </button>
        <button class="btn" id="btn-normal-atk" style="min-height:42px;padding:10px 20px">普通攻击</button>
        <button class="btn" id="btn-trial-exit" style="min-height:42px;padding:10px 20px;border-color:#a89a7c;color:#a89a7c">退出</button>
      </div>`;
    
    const log = document.getElementById('trial-log');
    const useBtn = document.getElementById('btn-use-skill');
    const atkBtn = document.getElementById('btn-normal-atk');
    const exitBtn = document.getElementById('btn-trial-exit');
    
    function addLog(text, color){
      const line = document.createElement('div');
      line.style.color = color || '#a89a7c';
      line.textContent = text;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }
    
    function showFx(icon, targetId, color){
      const target = document.getElementById(targetId);
      if(!target) return;
      const rect = target.getBoundingClientRect();
      const fx = document.createElement('div');
      fx.className = 'skill-fx';
      fx.textContent = icon;
      fx.style.color = color || '#c9a84c';
      fx.style.left = (rect.left + rect.width/2 - 24) + 'px';
      fx.style.top = (rect.top + rect.height/2 - 60) + 'px';
      fx.style.position = 'fixed';
      document.body.appendChild(fx);
      setTimeout(() => fx.remove(), 800);
    }
    
    function showDmg(targetId, val, color){
      const target = document.getElementById(targetId);
      if(!target) return;
      const rect = target.getBoundingClientRect();
      const dmg = document.createElement('div');
      dmg.className = 'dmg-float';
      dmg.textContent = '-' + Math.round(val);
      dmg.style.color = color || '#ff6b6b';
      dmg.style.left = (rect.left + rect.width/2 - 20) + 'px';
      dmg.style.top = (rect.top + 10) + 'px';
      dmg.style.position = 'fixed';
      document.body.appendChild(dmg);
      setTimeout(() => dmg.remove(), 1000);
    }
    
    function enemyTurn(){
      if(ended) return;
      turn++;
      setTimeout(() => {
        if(ended) return;
        const base = dummyAtk + Math.random()*dummyAtk*0.5;
        const dmg = Math.max(1, Math.round(base - fs.defense*0.3));
        playerHP -= dmg;
        showFx('💢', 'trial-enemy', '#d06a5a');
        setTimeout(() => showDmg('trial-player', dmg, '#ff6b6b'), 200);
        addLog(`${dummy.name}发动攻击，对你造成${dmg}点伤害。`, '#d06a5a');
        
        setTimeout(() => {
          if(playerHP <= 0){
            ended = true;
            playerHP = 0;
            addLog('你被击倒了……不过这只是试炼，不要气馁！', '#d06a5a');
            render();
            document.getElementById('btn-use-skill').style.display = 'none';
            document.getElementById('btn-normal-atk').style.display = 'none';
            document.getElementById('btn-trial-exit').textContent = '离开试炼场';
            return;
          }
          render();
        }, 600);
      }, 500);
    }
    
    if(useBtn) useBtn.addEventListener('click', () => {
      if(ended || playerMP < (skill.cost||15)) return;
      playerMP -= skill.cost||15;
      const base = skill.damage + fs.attack*0.8;
      const isHeal = (skill.type||'').includes('治疗');
      const isBuff = (skill.type||'').includes('增益') || (skill.type||'').includes('防御');
      
      showFx(fxIcon, 'trial-enemy', '#c9a84c');
      
      if(isHeal){
        const heal = Math.round(skill.damage * 0.8);
        playerHP = Math.min(fs.maxHp, playerHP + heal);
        setTimeout(() => {
          showDmg('trial-player', -heal, '#7fc48c');
          const d = document.querySelector('.dmg-float:last-child');
          if(d){d.textContent='+'+heal;d.style.color='#7fc48c';}
          addLog(`你施展「${skill.name}」，恢复了${heal}点生命！`, '#7fc48c');
        }, 300);
      } else if(isBuff){
        addLog(`你施展「${skill.name}」，魂力在体内涌动，防御提升！`, '#66aaff');
        playerHP = Math.min(fs.maxHp, playerHP + 20);
      } else {
        const crit = Math.random() < 0.2;
        const dmg = Math.round(base * (crit ? 1.8 : 1) + Math.random()*base*0.2);
        enemyHP -= dmg;
        setTimeout(() => showDmg('trial-enemy', dmg, crit ? '#ffd700' : '#ffdd44'), 300);
        addLog(`你施展「${skill.name}」，${crit?'暴击！':''}对${dummy.name}造成${dmg}点伤害！${crit?' ✦':''}`, crit ? '#ffd700' : '#e6c878');
      }
      
      setTimeout(() => {
        if(enemyHP <= 0){
          ended = true;
          enemyHP = 0;
          addLog(`✦ ${dummy.name}被击败！你成功施展了「${skill.name}」！`, '#7fc48c');
          render();
          document.getElementById('btn-use-skill').style.display = 'none';
          document.getElementById('btn-normal-atk').style.display = 'none';
          document.getElementById('btn-trial-exit').textContent = '离开试炼场';
          return;
        }
        render();
        enemyTurn();
      }, 700);
    });
    
    if(atkBtn) atkBtn.addEventListener('click', () => {
      if(ended) return;
      const dmg = Math.max(1, Math.round(fs.attack*0.5 + Math.random()*fs.attack*0.3));
      enemyHP -= dmg;
      showFx('👊', 'trial-enemy', '#c9a84c');
      setTimeout(() => showDmg('trial-enemy', dmg, '#aaaaaa'), 200);
      addLog(`你发动普通攻击，造成${dmg}点伤害。`);
      setTimeout(() => {
        if(enemyHP <= 0){
          ended = true;enemyHP = 0;
          addLog(`${dummy.name}被击败！`, '#7fc48c');
          render();
          document.getElementById('btn-use-skill').style.display = 'none';
          document.getElementById('btn-normal-atk').style.display = 'none';
          document.getElementById('btn-trial-exit').textContent = '离开试炼场';
          return;
        }
        render();
        enemyTurn();
      }, 600);
    });
    
    if(exitBtn) exitBtn.addEventListener('click', () => {
      arena.classList.remove('active');
      setTimeout(() => arena.remove(), 400);
    });
  }
  
  arena.classList.add('active');
  render();
  const log = document.getElementById('trial-log');
  if(log) log.innerHTML = `<div style="color:#c9a84c">欢迎来到魂技试炼场！在这里你可以尽情试用新获得的魂技。</div>`;
}

// ==================== 武魂个性化事件匹配 ====================
function getSpiritSpecificEvents(){
  if(!G || !G.spirit) return [];
  return EVENTS.filter(event => event.spiritId === G.spirit.id).map(event => event.id);
}

// 更新eventMatchBonus以支持武魂ID精确匹配
const origEventMatchBonus = eventMatchBonus;
eventMatchBonus = function(ev){
  let bonus = origEventMatchBonus(ev);
  if(G && G.spirit && ev.spiritId === G.spirit.id) bonus += 15;
  return bonus;
};

// ==================== 技能树系统 ====================
function openSkillTree(){
  if(!G) return;
  if(!G._skillTree) G._skillTree = {};
  const totalPoints = getSkillPoints(G.level);
  const usedPoints = getUsedSkillPoints(G._skillTree);
  const available = totalPoints - usedPoints;

  const branchesHtml = Object.entries(SKILL_TREE).map(([key, branch]) => {
    const nodesHtml = branch.nodes.map(node => {
      const learned = G._skillTree[node.id];
      const canLearn = !learned && available >= node.cost &&
        node.req.every(r => G._skillTree[r]);
      const reqMet = node.req.every(r => G._skillTree[r]);
      const cls = learned ? 'learned' : (canLearn ? 'available' : (reqMet ? 'locked' : 'locked-no-req'));
      return `<div class="st-node ${cls}" data-id="${node.id}" data-cost="${node.cost}" data-branch="${key}">
        <div class="st-node-icon" style="border-color:${branch.color};color:${branch.color}">${branch.icon}</div>
        <div class="st-node-info">
          <div class="st-node-name">${esc(node.name)}</div>
          <div class="st-node-desc">${esc(node.desc)}</div>
          <div class="st-node-cost">${learned ? '✓ 已习得' : `消耗 ${node.cost} 点`}</div>
        </div>
      </div>`;
    }).join('');
    return `<div class="st-branch">
      <div class="st-branch-title" style="color:${branch.color}">${branch.icon} ${branch.name}</div>
      <div class="st-nodes">${nodesHtml}</div>
    </div>`;
  }).join('');

  openModal('✦ 技能树 ✦', `
    <div class="st-header">
      <div class="st-points">可用技能点：<b style="color:#e6c878">${available}</b> / ${totalPoints}</div>
      <div class="st-hint">每5级获得2点技能点，选择你的成长路线</div>
      <button class="btn btn-sm" id="btn-skill-reset" ${usedPoints === 0 ? 'disabled' : ''}>重置技能树</button>
    </div>
    <div class="st-tree">${branchesHtml}</div>
  `);

  // D-b：技能树重置（退还全部已用技能点，战斗中禁用）
  const resetBtn = document.getElementById('btn-skill-reset');
  if(resetBtn) resetBtn.addEventListener('click', () => {
    const usedNow = getUsedSkillPoints(G._skillTree);
    if(usedNow === 0){ toast('当前没有已学习的技能节点'); return; }
    if(typeof BattleSystem !== 'undefined' && BattleSystem.isActive()){ toast('战斗中不能重置技能树'); return; }
    if(!confirm(`重置技能树将退还 ${usedNow} 点技能点，确定吗？`)) return;
    G._skillTree = {};
    applySkillTreeBonuses();
    saveLocal();
    refreshPanel();
    toast(`技能树已重置，退还 ${usedNow} 点技能点`);
    openSkillTree();
  });

  // 绑定点击
  document.querySelectorAll('.st-node.available').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const cost = Number(el.dataset.cost);
      if(available < cost) return;
      G._skillTree[id] = true;
      AudioFX.playSfx('levelup');
      VisualFX.showAchievement('技能习得', el.querySelector('.st-node-name').textContent, '✦');
      applySkillTreeBonuses();
      saveLocal();
      openSkillTree(); // 刷新
    });
  });
}

// 应用技能树加成到玩家属性
function applySkillTreeBonuses(){
  if(!G._skillTree) return;
  // 重置加成
  G._skillBonuses = {
    attackMult: 0, defenseMult: 0, hpMult: 0, speedMult: 0, mpMult: 0,
    critRate: 0, critDmg: 0, defPenetration: 0, antiCrit: 0,
    regen: 0, comboBonus: 0, extraAttack: 0, dodge: 0,
    skillDmgBonus: 0, mpCostReduction: 0, cdReduction: 0,
    mpRecovery: 0, alwaysStatus: false, lastStand: false, firstStrike: false
  };
  Object.keys(G._skillTree).forEach(id => {
    for(const branch of Object.values(SKILL_TREE)){
      const node = branch.nodes.find(n => n.id === id);
      if(node && node.effect){
        Object.entries(node.effect).forEach(([k, v]) => {
          if(typeof v === 'boolean') G._skillBonuses[k] = v;
          else G._skillBonuses[k] = (G._skillBonuses[k] || 0) + v;
        });
      }
    }
  });
}

// ==================== 成就系统 ====================
function checkAchievements(){
  if(!G) return;
  if(!G._achievementList) G._achievementList = [];
  const cp = calcCombatPower ? calcCombatPower() : 0;
  ACHIEVEMENTS.forEach(ach => {
    if(G._achievementList.includes(ach.id)) return;
    // 战力成就特殊处理
    if(ach.id === 'power_10k' && cp < 10000) return;
    if(ach.id === 'power_30k' && cp < 30000) return;
    if(ach.id === 'power_50k' && cp < 50000) return;
    if(ach.cond(G)){
      G._achievementList.push(ach.id);
      VisualFX.showAchievement(ach.name, ach.desc, ach.icon);
      AudioFX.playSfx('achievement');
      // 成就奖励：少量金币和经验
      addGold(50);
      gainExp(20);
    }
  });
}

function openAchievements(){
  if(!G) return;
  if(!G._achievementList) G._achievementList = [];
  const unlocked = G._achievementList.length;
  const total = ACHIEVEMENTS.length;
  const html = `<div class="ach-grid">
    ${ACHIEVEMENTS.map(a => {
      const got = G._achievementList.includes(a.id);
      return `<div class="ach-card ${got ? 'unlocked' : 'locked'}">
        <div class="ach-icon">${got ? a.icon : '❓'}</div>
        <div class="ach-info">
          <div class="ach-name">${got ? esc(a.name) : '？？？'}</div>
          <div class="ach-desc">${esc(a.desc)}</div>
        </div>
        <div class="ach-status">${got ? '✓' : '🔒'}</div>
      </div>`;
    }).join('')}
  </div>
  <div style="text-align:center;margin-top:12px;color:#a89a7c;font-size:14px">
    已解锁 ${unlocked} / ${total} 个成就
  </div>`;
  openModal('✦ 成就殿堂 ✦', html);
}

// ==================== 称号系统 ====================
function getUnlockedTitles(){
  if(!G) return [];
  const cp = calcCombatPower ? calcCombatPower() : 0;
  return TITLES.filter(t => {
    // 战力称号特殊处理
    if(t.id === 'power_elite' && cp < 10000) return false;
    if(t.id === 'power_epic' && cp < 30000) return false;
    if(t.id === 'power_god' && cp < 50000) return false;
    return t.cond(G);
  });
}

function openTitles(){
  if(!G) return;
  if(!G._activeTitle) G._activeTitle = 'novice';
  const unlocked = getUnlockedTitles();
  const html = `<div class="title-list">
    ${unlocked.map(t => {
      const active = G._activeTitle === t.id;
      const bonusText = Object.entries(t.bonus).map(([k, v]) => {
        const names = { attack:'攻击', defense:'防御', hp:'生命', speed:'速度', spiritPowerGain:'魂力增益', gold:'金币加成' };
        return `${names[k] || k}+${v}`;
      }).join('，');
      return `<div class="title-card ${active ? 'active' : ''}" data-id="${t.id}">
        <div class="title-name">${esc(t.name)}</div>
        <div class="title-desc">${esc(t.desc)}</div>
        ${bonusText ? `<div class="title-bonus">加成：${esc(bonusText)}</div>` : ''}
        <div class="title-action">${active ? '✓ 当前称号' : `<button class="btn btn-gold btn-sm" data-set-title="${esc(t.id)}">佩戴</button>`}</div>
      </div>`;
    }).join('')}
  </div>`;
  openModal('✦ 称号管理 ✦', html);
  $('modal-body').querySelectorAll('[data-set-title]').forEach(button => button.addEventListener('click', () => setTitle(button.dataset.setTitle)));
}

function setTitle(titleId){
  if(!G) return;
  const t = TITLES.find(x => x.id === titleId);
  if(!t || !getUnlockedTitles().some(item => item.id === titleId)) return;
  G._activeTitle = titleId;
  AudioFX.playSfx('select');
  toast(`已佩戴称号「${t.name}」`);
  refreshPanel();
  saveLocal();
  openTitles();
}

function getTitleBonus(field){
  if(!G || !G._activeTitle) return 0;
  const t = TITLES.find(x => x.id === G._activeTitle);
  if(!t || !t.bonus) return 0;
  return t.bonus[field] || 0;
}

// ==================== 冒险日记 ====================
function addDiaryEntry(text, type){
  if(!G._diary) G._diary = [];
  const phase = phaseName(G.level);
  G._diary.push({
    turn: G._eventCount || 0,
    level: G.level,
    phase,
    text,
    type: type || 'event',
    time: Date.now()
  });
  // 保留最近200条
  if(G._diary.length > 200) G._diary = G._diary.slice(-200);
}

function openJournal(){
  if(!G) return;
  if(!G._diary) G._diary = [];
  const diary = G._diary.slice().reverse();
  const typeColors = { event:'#c9a84c', battle:'#d06a5a', levelup:'#7fc48c', discovery:'#a78bfa', npc:'#5a8fc4' };
  const typeNames = { event:'事件', battle:'战斗', levelup:'升级', discovery:'发现', npc:'人物' };
  const filterBtns = Object.keys(typeNames).map(t =>
    `<button class="diary-filter-btn" data-type="${t}" style="border-color:${typeColors[t]};color:${typeColors[t]}">${typeNames[t]}</button>`
  ).join('');
  const html = `<div class="journal-header">
    <div style="margin-bottom:8px;font-size:13px;color:#a89a7c">出身：${esc(G.originName || (ORIGINS.find(o => o.id === G.origin) || {}).fullName || G.origin || '未知')} · 当前所在地：${esc((resolveMapLocation(G._currentLocation) || { name:'史莱克学院' }).name)}</div>
    <div class="jh-filters">
      <button class="diary-filter-btn active" data-type="all" style="border-color:#c9a84c;color:#c9a84c">全部</button>
      ${filterBtns}
    </div>
    <input type="text" class="diary-search" placeholder="搜索日记内容..." id="diary-search-input">
  </div>
  <div class="diary-list" id="diary-list-container">
    ${diary.length ? diary.map(d => `<div class="diary-entry" data-type="${d.type}" style="border-left-color:${typeColors[d.type] || '#c9a84c'}">
      <div class="de-header">
        <span class="de-phase">${esc(d.phase)}</span>
        <span class="de-type" style="color:${typeColors[d.type] || '#c9a84c'}">${typeNames[d.type] || '事件'}</span>
        <span class="de-level">Lv.${d.level}</span>
      </div>
      <div class="de-text">${esc(d.text)}</div>
    </div>`).join('') : '<div style="text-align:center;color:#a89a7c;padding:40px">还没有冒险记录，去探索斗罗大陆吧！</div>'}
  </div>`;
  openModal('✦ 冒险日记 ✦', html);
  // 绑定过滤按钮
  setTimeout(() => {
    document.querySelectorAll('.diary-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diary-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type;
        const search = (document.getElementById('diary-search-input') || {}).value || '';
        document.querySelectorAll('.diary-entry').forEach(entry => {
          const matchType = type === 'all' || entry.dataset.type === type;
          const matchSearch = !search || entry.textContent.toLowerCase().includes(search.toLowerCase());
          entry.style.display = (matchType && matchSearch) ? '' : 'none';
        });
      });
    });
    const searchInput = document.getElementById('diary-search-input');
    if(searchInput){
      searchInput.addEventListener('input', () => {
        const activeBtn = document.querySelector('.diary-filter-btn.active');
        const type = activeBtn ? activeBtn.dataset.type : 'all';
        const search = searchInput.value;
        document.querySelectorAll('.diary-entry').forEach(entry => {
          const matchType = type === 'all' || entry.dataset.type === type;
          const matchSearch = !search || entry.textContent.toLowerCase().includes(search.toLowerCase());
          entry.style.display = (matchType && matchSearch) ? '' : 'none';
        });
      });
    }
  }, 50);
}

// ==================== 剧情路径汇总 ====================
// 路径由普通剧情与早年节点自然写入，不再使用脱离上下文的随机模态抉择。
// 获取剧情路径总结
function getStoryPathSummary(){
  if(!G._storyPath || G._storyPath.length === 0) return null;
  const dominant = STORY_BRANCHES.getDominantPath(G._storyPath);
  const pathCounts = {};
  G._storyPath.forEach(p => { pathCounts[p] = (pathCounts[p] || 0) + 1; });
  const topPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    dominant,
    dominantName: STORY_BRANCHES.getPathDesc(dominant),
    topPaths: topPaths.map(([p, c]) => ({ path: p, name: STORY_BRANCHES.getPathDesc(p), count: c })),
    total: G._storyPath.length
  };
}

// ==================== 统计面板 ====================
function calcCombatPower(){
  if(!G) return 0;
  const fs = finalStats();
  let power = fs.attack * 2 + fs.defense * 1.5 + fs.maxHp * 0.3 + fs.speed * 1.2;
  power += G.level * 50;
  power += G.rings.length * 200;
  power += (G.skills || []).length * 100;
  // 技能树加成
  const skillNodes = G._skillTree ? Object.keys(G._skillTree).filter(k => G._skillTree[k]).length : 0;
  power += skillNodes * 80;
  // NPC关系加成
  const npcBonus = getNpcRelationBonuses();
  power += npcBonus.attack * 5 + npcBonus.defense * 5 + npcBonus.hp * 2;
  // 挑战塔层数
  power += (G._towerFloor || 0) * 150;
  // 命运值
  power += (G.fatePoints || 0) * 100;
  return Math.round(power);
}

function getCombatPowerRank(power){
  if(power >= 50000) return { name:'神级', color:'#ffeb88' };
  if(power >= 30000) return { name:'传说', color:'#ff66ff' };
  if(power >= 20000) return { name:'史诗', color:'#a78bfa' };
  if(power >= 12000) return { name:'精英', color:'#c9a84c' };
  if(power >= 6000)  return { name:'熟练', color:'#7fc48c' };
  if(power >= 3000)  return { name:'初级', color:'#5a8fc4' };
  return { name:'新手', color:'#a89a7c' };
}

function openStats(){
  if(!G) return;
  const bs = G.battleStats || { wins:0, losses:0, kills:0 };
  const winRate = bs.wins + bs.losses > 0 ? Math.round(bs.wins / (bs.wins + bs.losses) * 100) : 0;
  const visited = (G._visitedLocations || []).length;
  const bones = (G._bones || []).length;
  const achievements = (G._achievementList || []).length;
  const titles = getUnlockedTitles().length;
  const skillPoints = getSkillPoints(G.level) - getUsedSkillPoints(G._skillTree || {});
  const towerFloor = G._towerFloor || 0;
  const diaryCount = (G._diary || []).length;
  const fs = finalStats();
  const cp = calcCombatPower();
  const cpRank = getCombatPowerRank(cp);
  const npcRelations = G._npcRelations ? Object.keys(G._npcRelations).length : 0;
  const hiddenFound = (G._discoveredHidden || []).length;
  const craftedBones = (G._craftedBones || []).length;
  const maxCombo = G._maxCombo || 0;

  // 战力评估面板
  const cpHtml = `<div class="combat-power-display" style="border-color:${cpRank.color}">
    <div class="cp-label">综合战力</div>
    <div class="cp-value" style="color:${cpRank.color}">${cp.toLocaleString()}</div>
    <div class="cp-rank" style="color:${cpRank.color}">「${cpRank.name}」</div>
  </div>`;

  // 详细属性面板
  const weaponInfo = G.weapon ? `${G.weapon.name}（攻击+${G.weapon.attack}）` : '无';
  const originInfo = G.originName || (ORIGINS && ORIGINS.find ? (ORIGINS.find(o => o.id === G.origin) || {}).fullName : G.origin || '');
  const academyInfo = G._academyRecommendation ? `（学院推荐：${G._academyRecommendation}）` : '';
  const detailHtml = `<div class="stat-detail-grid">
    <div class="sd-row"><span class="sd-label">出身</span><span class="sd-value" style="color:#c9a84c">${esc(originInfo)}${esc(academyInfo)}</span></div>
    <div class="sd-row"><span class="sd-label">攻击力</span><span class="sd-value" style="color:#ff8844">${fs.attack}</span></div>
    <div class="sd-row"><span class="sd-label">防御力</span><span class="sd-value" style="color:#88aacc">${fs.defense}</span></div>
    <div class="sd-row"><span class="sd-label">生命值</span><span class="sd-value" style="color:#7fc48c">${fs.maxHp}</span></div>
    <div class="sd-row"><span class="sd-label">速度</span><span class="sd-value" style="color:#c9a84c">${fs.speed}</span></div>
    <div class="sd-row"><span class="sd-label">当前武器</span><span class="sd-value" style="color:#c9a84c">${weaponInfo}</span></div>
    <div class="sd-row"><span class="sd-label">出身加成</span><span class="sd-value" style="color:#a89a7c">攻+${G.originBonus.attack||0} 防+${G.originBonus.defense||0} 血+${G.originBonus.hp||0} 速+${G.originBonus.speed||0}</span></div>
    <div class="sd-row"><span class="sd-label">魂环加成</span><span class="sd-value" style="color:#a78bfa">攻+${(G.rings||[]).reduce((a,r)=>a+((r.bonus||{}).attack||0),0)} 防+${(G.rings||[]).reduce((a,r)=>a+((r.bonus||{}).defense||0),0)} 血+${(G.rings||[]).reduce((a,r)=>a+((r.bonus||{}).hp||0),0)}</span></div>
    <div class="sd-row"><span class="sd-label">元素属性</span><span class="sd-value">${getSpiritElement() || '无'}</span></div>
    <div class="sd-row"><span class="sd-label">当前阵法</span><span class="sd-value">${getActiveFormation() ? getActiveFormation().name : '无'}</span></div>
    ${fs.npcBonus && fs.npcBonus.attack > 0 ? `<div class="sd-row"><span class="sd-label">NPC加成</span><span class="sd-value" style="color:#ff8ab8">攻+${fs.npcBonus.attack} 防+${fs.npcBonus.defense} 血+${fs.npcBonus.hp}</span></div>` : ''}
  </div>`;

  const stats = [
    { label:'当前等级', value:G.level, icon:'⭐', color:'#e6c878' },
    { label:'武魂', value:G.spirit ? G.spirit.name : '-', icon:'✦', color:'#c9a84c' },
    { label:'魂环数量', value:G.rings.length, icon:'◯', color:'#a78bfa' },
    { label:'战斗胜利', value:bs.wins, icon:'⚔', color:'#7fc48c' },
    { label:'战斗败北', value:bs.losses, icon:'✕', color:'#d06a5a' },
    { label:'胜率', value:winRate + '%', icon:'📊', color:'#5a8fc4' },
    { label:'猎杀魂兽', value:bs.kills, icon:'👹', color:'#d06a5a' },
    { label:'最大连击', value:maxCombo, icon:'⚡', color:'#ffd700' },
    { label:'累计获得金币', value:G._totalGoldEarned || 0, icon:'💰', color:'#e6c878' },
    { label:'命运值', value:G.fatePoints || 0, icon:'☆', color:'#c9a0d8' },
    { label:'已探索地点', value:visited, icon:'🗺', color:'#7fc48c' },
    { label:'隐藏秘境', value:hiddenFound, icon:'🔮', color:'#a78bfa' },
    { label:'收集魂骨', value:bones, icon:'🦴', color:'#c9a84c' },
    { label:'锻造魂骨', value:craftedBones, icon:'🔨', color:'#d06a5a' },
    { label:'NPC关系', value:npcRelations, icon:'♥', color:'#ff8ab8' },
    { label:'达成成就', value:achievements + '/' + ACHIEVEMENTS.length, icon:'🏆', color:'#e6c878' },
    { label:'解锁称号', value:titles, icon:'👑', color:'#a78bfa' },
    { label:'可用技能点', value:skillPoints, icon:'🔥', color:'#d06a5a' },
    { label:'挑战塔层数', value:towerFloor, icon:'🏰', color:'#5a8fc4' },
    { label:'冒险日志', value:diaryCount + '条', icon:'📖', color:'#a89a7c' },
    { label:'关键选择', value:(G._storyPath||[]).length, icon:'🛤', color:'#c9a0d8' }
  ];

  // 剧情路径总结
  const sp = getStoryPathSummary();
  const spHtml = sp ? `<div class="ending-story-path" style="margin-top:12px">
    <div class="esp-title">✦ 命运之路 ✦</div>
    <div class="esp-dominant">主导路线：<span style="color:#c9a84c">${esc(sp.dominantName)}</span></div>
    <div class="esp-paths">${sp.topPaths.map(p => `<span class="esp-path-tag">${esc(p.name)} ×${p.count}</span>`).join('')}</div>
  </div>` : '';

  const html = `${cpHtml}
  ${detailHtml}
  ${spHtml}
  <div class="stats-grid">
    ${stats.map(s => `<div class="stat-card">
      <div class="sc-icon" style="color:${s.color}">${s.icon}</div>
      <div class="sc-value" style="color:${s.color}">${s.value}</div>
      <div class="sc-label">${esc(s.label)}</div>
    </div>`).join('')}
  </div>`;
  openModal('✦ 冒险统计 ✦', html);
}

// ==================== 商店系统 ====================
function openShop(){
  if(!G) return;
  const items = SHOP_ITEMS.filter(it => !it.reqLevel || G.level >= it.reqLevel);
  const html = `<div class="shop-header">
    <div class="shop-gold">💰 金币：<span style="color:#ffd700">${G.gold}</span></div>
  </div>
  <div class="shop-grid">
    ${items.map(it => {
      const owned = (G.inventory.find(x => x.name === it.name) || {count:0}).count;
      const canBuy = G.gold >= it.price;
      return `<div class="shop-card ${canBuy ? '' : 'disabled'}">
      <div class="sc-icon">${it.icon}</div>
      <div class="sc-info">
        <div class="sc-name">${esc(it.name)}</div>
        <div class="sc-desc">${esc(it.desc)}</div>
      </div>
      <div class="sc-bottom">
        <span class="sc-price" style="color:${canBuy ? '#ffd700' : '#d06a5a'}">${it.price}金</span>
        <span class="sc-owned">已有${owned}</span>
        <button class="shop-buy-btn" data-item="${it.id}" ${canBuy ? '' : 'disabled'}>购买</button>
      </div>
    </div>`;
    }).join('')}
  </div>`;
  openModal('✦ 魂师商店 ✦', html);
  setTimeout(() => {
    document.querySelectorAll('.shop-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.item;
        buyShopItem(itemId);
      });
    });
  }, 50);
}

function buyShopItem(itemId){
  if(!G) return;
  const item = SHOP_ITEMS.find(it => it.id === itemId);
  if(!item) return;
  if(G.gold < item.price){ toast('金币不足！'); return; }
  G.gold -= item.price;
  // 根据类型处理
  if(item.type === 'exp'){
    gainExp(item.value);
    addDiaryEntry(`购买并使用了「${item.name}」，获得${item.value}经验。`, 'event');
  } else if(item.type === 'fate'){
    G.fatePoints = (G.fatePoints || 0) + item.value;
    addDiaryEntry(`购买并使用了「${item.name}」，命运值+${item.value}。`, 'event');
  } else {
    // 加入背包
    const exist = G.inventory.find(x => x.name === item.name);
    if(exist) exist.count++;
    else G.inventory.push({ name: item.name, type: item.type, value: item.value, count: 1 });
    addDiaryEntry(`购买了「${item.name}」，花费${item.price}金币。`, 'event');
  }
  AudioFX.playSfx('coin');
  VisualFX.flash('gold', 150);
  if(typeof ParticleEngine !== 'undefined'){
    const center = VisualFX.getBattleCenter ? VisualFX.getBattleCenter() : { x: window.innerWidth/2, y: window.innerHeight/2 };
    ParticleEngine.emit('coinDrop', center.x, center.y);
  }
  refreshPanel();
  saveLocal();
  openShop(); // 刷新商店
}

// 使用背包道具（非战斗）
function useItem(itemName){
  if(!G) return;
  const it = G.inventory.find(x => x.name === itemName && x.count > 0);
  if(!it) return;
  const fs = finalStats();
  let used = false;
  if(it.type === 'heal'){
    const heal = Math.min(it.value, fs.maxHp - G.hp);
    if(heal <= 0){
      toast('当前生命已满，无需恢复。');
      return;
    }
    G.hp += heal;
    toast(`使用「${it.name}」，恢复${heal}点生命。`);
    used = true;
  } else if(it.type === 'healFull'){
    const heal = fs.maxHp - G.hp;
    if(heal <= 0){
      toast('当前生命已满，无需恢复。');
      return;
    }
    G.hp = fs.maxHp;
    toast(`使用「${it.name}」，恢复${heal}点生命。`);
    used = true;
  } else if(it.type === 'mp'){
    const maxSp = getMaxSpiritPower();
    const restore = Math.min(Number(it.value) || 0, maxSp - G.spiritPower);
    G.spiritPower += restore;
    toast(`使用「${it.name}」，恢复${restore}点魂力。`);
    used = restore > 0;
  } else if(['cure','cureAll'].includes(it.type)){
    toast(`「${it.name}」用于解除战斗状态，请在战斗的“道具”菜单中使用。`);
  } else if(it.type === 'buffAtk'){
    G._tempAtkBuff = Math.max(G._tempAtkBuff || 0, Number(it.value) || 0.2);
    toast(`使用「${it.name}」，下一场战斗获得3回合攻击增益！`);
    used = true;
  } else if(it.type === 'buffDef'){
    G._tempDefBuff = Math.max(G._tempDefBuff || 0, Number(it.value) || 0.2);
    toast(`使用「${it.name}」，下一场战斗获得3回合防御增益！`);
    used = true;
  } else if(it.type === 'buffSpd'){
    G._tempSpdBuff = Math.max(G._tempSpdBuff || 0, Number(it.value) || 0.2);
    toast(`使用「${it.name}」，下一场战斗获得3回合速度增益！`);
    used = true;
  } else {
    toast(`「${it.name}」暂时不能主动使用。`);
  }
  if(used){
    it.count--;
    if(it.count <= 0) G.inventory = G.inventory.filter(x => x !== it);
    AudioFX.playSfx('heal');
    addDiaryEntry(`使用了「${it.name}」。`, 'event');
    refreshPanel();
    saveLocal();
  }
}

function openInventory(){
  if(!G) return;
  const items = G.inventory.filter(x => x.count > 0);
  // 道具图标映射
  const ITEM_ICONS = {
    '回魂丹': '💊', '聚魂丹': '🔮', '回天丹': '💎', '洗髓丹': '⚗️',
    '金疮药': '🩹', '解毒丹': '🌿', '铁剑': '⚔️', '青钢剑': '🗡️',
    '玄铁剑': '⚔️', '皮甲': '🥋', '铁甲': '🛡️', '玄铁甲': '🛡️',
    '布靴': '👟', '皮靴': '🥾', '储物袋': '🎒',
    '经验丹': '⭐', '命运符': '🎴', '突破丹': '🔥', '感悟心得': '📜',
    '秘籍': '📖', '武魂碎片': '💠', '魂骨': '🦴', '仙草': '🌺'
  };
  const ITEM_QUALITY = {
    'heal': '#7fc48c', 'mp': '#88ccff', 'healFull': '#44ff88',
    'buffAtk': '#ff8866', 'buffDef': '#66aaff', 'cureAll': '#ffdd44',
    'weapon': '#c9a84c', 'armor': '#8899aa', 'accessory': '#cc66ff'
  };
  const getIcon = (name) => ITEM_ICONS[name] || (name.includes('丹') ? '💊' : name.includes('剑') ? '⚔️' : name.includes('甲') ? '🛡️' : '📦');
  const getTypeLabel = (t) => ({
    'heal':'恢复生命','mp':'恢复魂力','healFull':'恢复全部生命',
    'buffAtk':'攻击增益','buffDef':'防御增益','buffSpd':'速度增益','cure':'解除中毒（战斗中）','cureAll':'净化负面（战斗中）',
    'weapon':'武器','armor':'防具','accessory':'饰品'
  }[t] || '特殊道具');
  const html = items.length ? `<div class="inv-grid">
    ${items.map(it => {
      const qColor = ITEM_QUALITY[it.type] || '#c9a84c';
      return `<div class="inv-card" style="border-color:${qColor}33">
        <div class="ic-icon" style="font-size:32px;margin-bottom:8px;filter:drop-shadow(0 0 8px ${qColor}40)">${getIcon(it.name)}</div>
        <div class="ic-name" style="color:${qColor}">${esc(it.name)}</div>
        <div class="ic-count">×${it.count}</div>
        <div class="ic-desc">${getTypeLabel(it.type)}${it.value?' · '+it.value+(it.type==='heal'?'生命':it.type==='mp'?'魂力':''):''}</div>
        ${it.type !== 'weapon' && it.type !== 'armor' && it.type !== 'accessory' && !it.effect ? `<button class="inv-use-btn" data-item="${esc(it.name)}">使用</button>` : `<div style="margin-top:8px;font-size:11px;color:#7fc48c">永久效果已生效</div>`}
      </div>`;
    }).join('')}
  </div>` : '<div style="text-align:center;color:#a89a7c;padding:40px">背包空空如也，去商店看看吧！</div>';
  openModal('✦ 背包 ✦', html);
  setTimeout(() => {
    document.querySelectorAll('.inv-use-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        useItem(btn.dataset.item);
        closeModal();
      });
    });
  }, 50);
}

// ==================== 设置菜单 ====================
function applyUserSettings(){
  let textSpeed = 1;
  let battleAnimation = 'normal';
  let particleQuality = 'normal';
  try{
    textSpeed = Number(localStorage.getItem('dldl_text_speed')) || 1;
    battleAnimation = localStorage.getItem('dldl_battle_animation') || 'normal';
    particleQuality = localStorage.getItem('dldl_particle_quality') || 'normal';
  }catch(e){}
  document.documentElement.style.setProperty('--text-anim-speed', `${Math.max(0.15, 0.7 * textSpeed)}s`);
  document.body.classList.toggle('battle-animations-minimal', battleAnimation === 'minimal');
  if(ParticleEngine.setQuality) ParticleEngine.setQuality(particleQuality);
}

function exportSaveFile(){
  if(!G || !saveLocal()){ toast('没有可导出的有效存档'); return; }
  const data = JSON.stringify(G, null, 2);
  const blob = new Blob([data], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = String(G.name || '魂师').replace(/[\\/:*?"<>|]/g, '_');
  link.href = url;
  link.download = `斗罗大陆-${safeName}-Lv${G.level}-${localDateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('存档文件已导出');
}

async function importSaveFile(file){
  if(!file) return;
  if(file.size > 5 * 1024 * 1024){ toast('存档文件过大，无法导入'); return; }
  try{
    const text = await file.text();
    const imported = SaveUtils.migrateSave(JSON.parse(text));
    if(!imported || imported.gameMode !== 'text-rpg' || typeof imported.spirit !== 'object' || !imported.spiritBase){
      throw new Error('不是有效的文字版存档');
    }
    if(!confirm(`导入「${imported.name} Lv.${imported.level}」并切换到该角色？当前存档会自动进入备份链。`)) return;
    G = imported;
    window.G = G;
    if(!saveLocal()) throw new Error('本地存储空间不足');
    closeModal();
    enterGame(false);
    toast(`已导入「${G.name}」的存档`);
  }catch(error){
    console.error('导入存档失败:', error);
    toast(`导入失败：${error.message || '文件损坏'}`);
  }
}

function openSettings(){
  if(!G) return;
  const audioOn = AudioFX.isEnabled ? AudioFX.isEnabled() : true;
  const particlesOn = ParticleEngine.isRunning ? ParticleEngine.isRunning() : true;
  const volumes = AudioFX.getVolumes ? AudioFX.getVolumes() : { master:.5, music:.4, sfx:.6 };
  const getSetting = (key, fallback) => { try{ return localStorage.getItem(key) || fallback; }catch(e){ return fallback; } };
  const textSpeed = getSetting('dldl_text_speed', '1');
  const autosave = getSetting('dldl_autosave_seconds', '60');
  const battleAnimation = getSetting('dldl_battle_animation', 'normal');
  const particleQuality = getSetting('dldl_particle_quality', 'normal');
  const select = (id, value, options) => `<select id="${id}" class="setting-select">${options.map(([v,n]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  openModal('✦ 设置 ✦', `<div class="settings-list">
    <div class="setting-row" id="setting-audio"><div class="sr-info"><div class="sr-name">🔊 音频总开关</div><div class="sr-desc">快捷键 V 可随时静音或恢复</div></div><button class="sr-toggle ${audioOn ? 'on' : ''}">${audioOn ? '已开启' : '已关闭'}</button></div>
    <div class="setting-row setting-sliders"><div class="sr-info"><div class="sr-name">🎚 音量</div><div class="sr-desc">主音量 <input aria-label="主音量" id="volume-master" type="range" min="0" max="100" value="${Math.round(volumes.master * 100)}">　音乐 <input aria-label="音乐音量" id="volume-music" type="range" min="0" max="100" value="${Math.round(volumes.music * 100)}">　音效 <input aria-label="音效音量" id="volume-sfx" type="range" min="0" max="100" value="${Math.round(volumes.sfx * 100)}"></div></div></div>
    <div class="setting-row" id="setting-particles"><div class="sr-info"><div class="sr-name">✨ 粒子特效</div><div class="sr-desc">技能、环境和奖励特效</div></div><button class="sr-toggle ${particlesOn ? 'on' : ''}">${particlesOn ? '已开启' : '已关闭'}</button></div>
    <div class="setting-row"><div class="sr-info"><div class="sr-name">粒子质量</div><div class="sr-desc">性能较弱时选择低</div></div>${select('setting-particle-quality', particleQuality, [['low','低'],['normal','标准'],['high','高']])}</div>
    <div class="setting-row"><div class="sr-info"><div class="sr-name">📖 文字节奏</div><div class="sr-desc">控制剧情淡入和开场自动播放速度</div></div>${select('setting-text-speed', textSpeed, [['0.6','快速'],['1','标准'],['1.5','舒缓']])}</div>
    <div class="setting-row"><div class="sr-info"><div class="sr-name">⚔ 战斗动画</div><div class="sr-desc">控制敌方回合等待与动画强度</div></div>${select('setting-battle-animation', battleAnimation, [['normal','标准'],['fast','快速'],['minimal','最简']])}</div>
    <div class="setting-row"><div class="sr-info"><div class="sr-name">⏱ 自动云存档</div><div class="sr-desc">本地存档仍会在关键操作后自动更新</div></div>${select('setting-autosave', autosave, [['0','关闭'],['30','30秒'],['60','1分钟'],['120','2分钟'],['300','5分钟']])}</div>
    <div class="setting-row" id="setting-save"><div class="sr-info"><div class="sr-name">💾 手动存档</div><div class="sr-desc">等待服务器返回后再报告结果</div></div><button class="btn btn-gold btn-sm">立即保存</button></div>
    <div class="setting-row"><div class="sr-info"><div class="sr-name">📦 存档文件</div><div class="sr-desc">下载备份文件，或从文件恢复文字版进度</div></div><div class="setting-actions"><button class="btn btn-sm" id="setting-export">导出</button><button class="btn btn-sm" id="setting-import">导入</button><input class="hidden" type="file" id="setting-import-file" accept="application/json,.json"></div></div>
    <div class="setting-row"><div class="sr-info"><div class="sr-name">🗂 存档管理</div><div class="sr-desc">查看本地档与服务器文字版存档</div></div><button class="btn btn-sm" id="setting-manage">打开</button></div>
    <div class="setting-row"><div class="sr-info"><div class="sr-name">🧭 新手引导</div><div class="sr-desc">重新查看所有基础操作说明</div></div><button class="btn btn-sm" id="setting-tutorial">重新查看</button></div>
    <div style="padding:10px 12px;background:rgba(20,16,10,.6);border-radius:6px;font-size:12px;color:#a89a7c;line-height:1.8">快捷键：S 存档 · I 背包 · B 商店 · M 设置 · V 静音 · ESC 关闭弹窗</div>
  </div>`);

  const audioButton = document.querySelector('#setting-audio .sr-toggle');
  if(audioButton) audioButton.addEventListener('click', () => { AudioFX.toggle(); openSettings(); });
  const particleButton = document.querySelector('#setting-particles .sr-toggle');
  if(particleButton) particleButton.addEventListener('click', () => { particlesOn ? ParticleEngine.disable() : ParticleEngine.enable(); openSettings(); });
  [['master','volume-master'],['music','volume-music'],['sfx','volume-sfx']].forEach(([type,id]) => {
    const input = document.getElementById(id);
    if(input) input.addEventListener('input', () => AudioFX.setVolume(type, Number(input.value) / 100));
  });
  const bindSelect = (id, key, callback) => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => { localStorage.setItem(key, el.value); if(callback) callback(el.value); });
  };
  bindSelect('setting-particle-quality', 'dldl_particle_quality', value => { if(ParticleEngine.setQuality) ParticleEngine.setQuality(value); });
  bindSelect('setting-text-speed', 'dldl_text_speed', applyUserSettings);
  bindSelect('setting-battle-animation', 'dldl_battle_animation', applyUserSettings);
  bindSelect('setting-autosave', 'dldl_autosave_seconds', startAutoSave);
  const saveButton = document.querySelector('#setting-save button');
  if(saveButton) saveButton.addEventListener('click', async () => { saveButton.disabled = true; saveButton.textContent = '保存中…'; await saveServer(false); closeModal(); });
  const exportButton = document.getElementById('setting-export');
  if(exportButton) exportButton.addEventListener('click', exportSaveFile);
  const importButton = document.getElementById('setting-import');
  const importInput = document.getElementById('setting-import-file');
  if(importButton && importInput){ importButton.addEventListener('click', () => importInput.click()); importInput.addEventListener('change', () => importSaveFile(importInput.files[0])); }
  const manageButton = document.getElementById('setting-manage');
  if(manageButton) manageButton.addEventListener('click', () => { closeModal(); openSaveList(); });
  const tutorialButton = document.getElementById('setting-tutorial');
  if(tutorialButton) tutorialButton.addEventListener('click', () => {
    localStorage.removeItem('dldl_tutorial_done');
    if(G) G._tutorialPostponed = false; // 手动重看时清除“稍后再看”标记
    closeModal();
    startTutorial();
  });
}

// ==================== 帮助面板 ====================
function openHelp(){
  const html = `<div class="help-container">
    <div class="help-tabs">
      <button class="help-tab active" data-tab="basics">基础操作</button>
      <button class="help-tab" data-tab="combat">战斗系统</button>
      <button class="help-tab" data-tab="systems">功能系统</button>
      <button class="help-tab" data-tab="shortcuts">快捷键</button>
      <button class="help-tab" data-tab="tips">进阶攻略</button>
    </div>

    <div class="help-content" id="help-basics">
      <div class="help-section">
        <h3>🎮 游戏入门</h3>
        <div class="help-item"><b>创建角色</b>：选择出身和武魂，这将决定你的初始属性和技能路线。不同武魂拥有截然不同的游戏体验。</div>
        <div class="help-item"><b>主界面</b>：顶部按钮栏可快速访问各功能系统，左下角显示角色状态，右下角为战斗操作区。</div>
        <div class="help-item"><b>探索</b>：在主线或魂环状态卡点击「继续历练」，或在当前事件完成后点击「继续前行」，会推进一次冒险行动。事件会根据武魂、等级、地点和时间动态生成。</div>
        <div class="help-item"><b>存档</b>：进度自动保存到本地，也可在「设置」中手动存档到服务器。建议定期手动存档以防数据丢失。</div>
      </div>
      <div class="help-section">
        <h3>🗺 地图系统</h3>
        <div class="help-item"><b>移动</b>：在地图界面点击相邻地点可进行移动，不同地点有不同的事件和遭遇。</div>
        <div class="help-item"><b>快速旅行</b>：已探索的地点之间可以使用快速旅行功能直接传送。</div>
        <div class="help-item"><b>战争迷雾</b>：未探索的区域被迷雾覆盖，需要亲临才能揭开。</div>
        <div class="help-item"><b>隐藏地点</b>：某些特殊地点需要满足特定条件才能发现，以下是当前流传的线索：</div>
        <div class="help-item" style="padding-left:12px;border-left:2px solid var(--line);margin-left:8px">${HIDDEN_LOCATIONS.map(h => {
          const found = (typeof G !== 'undefined' && G && (G._discoveredHidden || []).find(x => x.id === h.id));
          return `<div style="margin:4px 0"><b style="color:${found ? '#7fc48c' : '#a89a7c'}">${esc(h.name)}</b>：${found ? esc(h.desc) : esc(h.clue)}</div>`;
        }).join('')}</div>
      </div>
    </div>

    <div class="help-content hidden" id="help-combat">
      <div class="help-section">
        <h3>⚔ 战斗基础</h3>
        <div class="help-item"><b>攻击</b>：对敌人造成伤害，伤害值受攻击力、技能加成和元素克制影响。</div>
        <div class="help-item"><b>技能</b>：消耗魂力释放强力技能，每个武魂拥有独特的技能链。技能伤害远高于普通攻击。</div>
        <div class="help-item"><b>防御</b>：减少本回合受到的伤害，同时少量恢复魂力。</div>
        <div class="help-item"><b>物品</b>：使用背包中的丹药和道具，可在战斗中恢复生命或获得增益。</div>
        <div class="help-item"><b>逃跑</b>：普通战斗可尝试脱离，速度越高成功率越高；Boss战和试炼战不可逃跑。</div>
      </div>
      <div class="help-section">
        <h3>🔥 元素系统</h3>
        <div class="help-item"><b>元素克制</b>：不同元素存在多组克制关系，克制时伤害提升35%，被克时降低20%，光暗互克。</div>
        <div class="help-item"><b>元素反应</b>：连续使用不同元素技能可触发元素反应，造成额外伤害和状态效果。</div>
        <div class="help-item"><b>反应类型</b>：蒸汽爆发、烈焰风暴、超导反应、感电连锁、沙暴肆虐、审判之光、蒸发、冻结等。</div>
      </div>
      <div class="help-section">
        <h3>💥 连击与暴击</h3>
        <div class="help-item"><b>连击</b>：连续攻击与攻击型魂技会累积连击，防御、道具和恢复技能会中断连击。</div>
        <div class="help-item"><b>连击终结</b>：每达到5的倍数会立即触发连携终结，连击越高额外伤害越强。</div>
        <div class="help-item"><b>暴击</b>：攻击有概率触发暴击，造成1.5倍伤害。暴击率受幸运属性影响。</div>
        <div class="help-item"><b>极限突破</b>：生命值低于20%时触发，恢复30%生命并获得狂暴+再生状态。</div>
      </div>
      <div class="help-section">
        <h3>☠ 状态效果</h3>
        <div class="help-item"><b>增益</b>：攻击提升、防御提升、速度提升、再生、狂暴、护盾等。</div>
        <div class="help-item"><b>减益</b>：中毒、燃烧、冰冻、麻痹、眩晕、虚弱、破甲等。</div>
        <div class="help-item"><b>状态管理</b>：使用解毒丹可解除中毒，净化符可解除所有负面状态。</div>
      </div>
    </div>

    <div class="help-content hidden" id="help-systems">
      <div class="help-section">
        <h3>🌟 技能树</h3>
        <div class="help-item">每5级获得2技能点，可在强攻、防御、灵巧、魂力四条路线中分配。</div>
        <div class="help-item">技能树节点永久生效；可手动释放的魂技来自魂环，并在正式战斗中消耗魂力。</div>
      </div>
      <div class="help-section">
        <h3>🏆 成就与称号</h3>
        <div class="help-item">完成特定条件解锁成就，获得金币和命运值奖励。</div>
        <div class="help-item">称号提供永久属性加成，在成就界面可查看和切换已获得的称号。</div>
      </div>
      <div class="help-section">
        <h3>🗼 挑战塔</h3>
        <div class="help-item">20层递增难度挑战，每层有强力守护者。通关20层可获得「二十层之主」称号。</div>
        <div class="help-item">需要达到对应等级才能挑战更高楼层。</div>
      </div>
      <div class="help-section">
        <h3>📅 每日签到</h3>
        <div class="help-item">每天可签到一次，连续签到7天可获得额外大奖。签到奖励随天数递增。</div>
      </div>
      <div class="help-section">
        <h3>🔨 魂骨锻造</h3>
        <div class="help-item">消耗魂骨碎片和金币锻造成品；成品会自动计入角色属性，目前没有单独穿戴槽位。锻造有成功率，失败会损失材料。</div>
        <div class="help-item">高级配方需要达到对应等级才能使用。</div>
      </div>
      <div class="help-section">
        <h3>📜 支线任务</h3>
        <div class="help-item">接受并完成各种支线任务，获得经验、金币和特殊奖励。任务有不同难度等级。</div>
      </div>
      <div class="help-section">
        <h3>👥 NPC关系</h3>
        <div class="help-item">与NPC互动（交谈、送礼、切磋、帮助、宴请）提升好感度。好感度等级越高，获得的加成越大。</div>
        <div class="help-item">关系等级会提供属性/经验加成；达到特定门槛后，部分事件和结局条件才会成立。</div>
      </div>
      <div class="help-section">
        <h3>🛒 商店与背包</h3>
        <div class="help-item">商店出售各种丹药和道具，高级商品需要达到对应等级。背包中的道具可在战斗内外使用。</div>
      </div>
      <div class="help-section">
        <h3>🏋 修炼系统</h3>
        <div class="help-item">花费金币进行修炼，快速获得经验。不同修炼方式有不同效率和风险。</div>
      </div>
    </div>

    <div class="help-content hidden" id="help-shortcuts">
      <div class="help-section">
        <h3>⌨ 键盘快捷键</h3>
        <div class="shortcut-list">
          <div class="shortcut-row"><kbd>S</kbd><span>快速存档</span></div>
          <div class="shortcut-row"><kbd>I</kbd><span>打开背包</span></div>
          <div class="shortcut-row"><kbd>B</kbd><span>打开商店</span></div>
          <div class="shortcut-row"><kbd>J</kbd><span>打开冒险日志</span></div>
          <div class="shortcut-row"><kbd>A</kbd><span>查看成就</span></div>
          <div class="shortcut-row"><kbd>T</kbd><span>查看属性面板</span></div>
          <div class="shortcut-row"><kbd>M</kbd><span>打开设置</span></div>
          <div class="shortcut-row"><kbd>V</kbd><span>静音或恢复音频</span></div>
          <div class="shortcut-row"><kbd>H</kbd><span>打开帮助</span></div>
          <div class="shortcut-row"><kbd>ESC</kbd><span>关闭弹窗</span></div>
        </div>
      </div>
      <div class="help-section">
        <h3>🎮 战斗快捷操作</h3>
        <div class="help-item"><b>自动战斗</b>：点击「自动」开启，AI 优先治疗与恢复，其次释放魂技，再普通攻击；防御、道具与逃跑由当前状态自动判断。</div>
        <div class="help-item"><b>战斗速度</b>：可在1×/2×/3×之间切换战斗速度，加速战斗节奏。</div>
      </div>
    </div>

    <div class="help-content hidden" id="help-tips">
      <div class="help-section">
        <h3>💡 新手攻略</h3>
        <div class="help-item"><b>前期</b>：优先提升等级，解锁更多技能和系统。不要忽视探索，奇遇事件往往带来丰厚奖励。</div>
        <div class="help-item"><b>技能点</b>：建议前期集中投资一条技能路线，而非分散点。攻击路线适合快速清怪，防御路线适合挑战Boss。</div>
        <div class="help-item"><b>金币管理</b>：前期金币有限，优先购买回魂丹和聚魂丹。九转还魂丹留到Boss战使用。</div>
        <div class="help-item"><b>元素搭配</b>：了解敌人属性，选择克制的元素技能。善用元素反应可大幅提升伤害。</div>
      </div>
      <div class="help-section">
        <h3>🎯 进阶技巧</h3>
        <div class="help-item"><b>连击维持</b>：避免使用防御和物品，保持连续攻击以维持连击数。高连击下连击终结技伤害惊人。</div>
        <div class="help-item"><b>NPC关系</b>：优先提升关键NPC的好感度，高等级关系提供的属性加成非常可观。</div>
        <div class="help-item"><b>挑战塔</b>：按顺序挑战20层守护者，层数越高奖励与魂骨碎片品质越好；通关20层可获得「二十层之主」称号。挑战前确保状态充足。</div>
        <div class="help-item"><b>每日签到</b>：坚持每日签到，第七天的大奖价值远超日常奖励。</div>
        <div class="help-item"><b>魂骨锻造</b>：收集魂骨碎片和金币锻造成品；成品会自动计入角色属性，目前不设单独穿戴槽位。</div>
        <div class="help-item"><b>状态管理</b>：Boss战中合理使用净化符和丹药，保持角色状态良好。</div>
      </div>
      <div class="help-section">
        <h3>🏆 结局指南</h3>
        <div class="help-item">游戏拥有多种结局，由你的命运值、剧情路径和关键选择共同决定。</div>
        <div class="help-item"><b>光明结局</b>：保持高命运值，选择仁慈和正义的选项。</div>
        <div class="help-item"><b>黑暗结局</b>：命运值极低，选择残忍和黑暗的选项。</div>
        <div class="help-item"><b>隐藏结局</b>：满足特殊条件可解锁隐藏结局，探索所有可能性。</div>
      </div>
    </div>
  </div>`;
  openModal('✦ 帮助指南 ✦', html);

  // 标签页切换
  const tabs = document.querySelectorAll('.help-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.help-content').forEach(c => c.classList.add('hidden'));
      const target = document.getElementById('help-' + tab.dataset.tab);
      if(target) target.classList.remove('hidden');
      AudioFX.playSfx('click');
    });
  });
}

// ==================== 挑战塔 ====================
function openChallengeTower(){
  if(!G) return;
  if(!G._towerFloor) G._towerFloor = 0;
  const currentFloor = G._towerFloor;
  const floors = CHALLENGE_TOWER.floors;

  const floorsHtml = floors.map(f => {
    const cleared = f.floor <= currentFloor;
    const isNext = f.floor === currentFloor + 1;
    const levelLocked = G.level < f.minLv;
    const statusCls = cleared ? 'cleared' : (isNext && !levelLocked ? 'next' : 'locked');
    const statusText = cleared ? '✓ 已通关' : (levelLocked ? `🔒 需${f.minLv}级` : (isNext ? '可挑战' : '需先通关前层'));
    const canChallenge = isNext && !levelLocked;
    return `<div class="tower-floor ${statusCls}" ${canChallenge ? `data-floor="${f.floor}"` : ''}> 
      <div class="tf-number">${f.floor}</div>
      <div class="tf-info">
        <div class="tf-name">${esc(f.name)}</div>
        <div class="tf-enemy">守护者：${esc(f.enemy.name)} · HP ${f.enemy.hp} · 攻 ${f.enemy.attack}</div>
        <div class="tf-reward">奖励：${f.reward.gold}金币 ${f.reward.exp ? '+' + f.reward.exp + '经验' : ''} ${f.reward.title ? '+称号' : ''}</div>
      </div>
      <div class="tf-status">${statusText}</div>
    </div>`;
  }).join('');

  const html = `<div class="tower-header">
    <div class="th-title">${esc(CHALLENGE_TOWER.name)}</div>
    <div class="th-desc">${esc(CHALLENGE_TOWER.desc)}</div>
    <div class="th-progress">已通关 <b>${currentFloor}</b> / ${floors.length} 层</div>
  </div>
  <div class="tower-list">${floorsHtml}</div>`;

  openModal('🏰 挑战塔', html);

  // 绑定挑战按钮
  document.querySelectorAll('.tower-floor.next[data-floor]').forEach(el => {
    el.addEventListener('click', () => {
      const floorNum = Number(el.dataset.floor);
      const floor = floors.find(f => f.floor === floorNum);
      if(!floor) return;
      if(G.level < floor.minLv){
        toast(`需要达到 ${floor.minLv} 级才能挑战`);
        return;
      }
      challengeTowerFloor(floor);
    });
  });
}

function challengeTowerFloor(floor){
  if(!floor || (typeof BattleSystem !== 'undefined' && BattleSystem.isActive())) return;
  if(floor.floor !== (G._towerFloor || 0) + 1){ toast('请按顺序挑战塔层'); return; }
  closeModal();
  const enemy = {
    ...floor.enemy,
    maxHp:floor.enemy.hp,
    level:floor.minLv,
    id:'tower_' + floor.floor,
    icon:'🏰',
    isNpc:true,
    isBoss:floor.floor % 5 === 0
  };
  addDiaryEntry(`挑战塔第${floor.floor}层「${floor.name}」，对手是${enemy.name}。`, 'battle');
  const wasTowerFloor = G._towerFloor || 0;
  BattleSystem.start(enemy, {
    allowFlee:false,
    countKill:false,
    onVictory:() => {
      const firstClear = floor.floor > wasTowerFloor;
      G._towerFloor = Math.max(G._towerFloor || 0, floor.floor);
      const floorReward = floor.reward || {};
      // D-f：首通给全额奖励；重复通关只给小额金币/碎片，避免“凹”塔白拿
      const gainsResult = firstClear
        ? applyResultRewards({ gold:floorReward.gold || 0, exp:floorReward.exp || 0, fate:floorReward.fatePoint || 0 })
        : applyResultRewards({ gold:Math.max(10, Math.round((floorReward.gold || 0) / 5)) });
      const gains = gainsResult.list;
      if(!G._forgeBones) G._forgeBones = [];
      const fragmentTier = floor.floor >= 15 ? 3 : (floor.floor >= 8 ? 2 : 1);
      G._forgeBones.push({ source:`挑战塔第${floor.floor}层`, tier:fragmentTier, obtainedAt:Date.now() });
      gains.push(`魂骨碎片×1（${fragmentTier}阶）`);
      if(floorReward.title) gains.push('解锁称号「二十层之主」');
      VisualFX.showAchievement('塔层通关', `第${floor.floor}层「${floor.name}」`, '🏰');
      AudioFX.playSfx('achievement');
      addDiaryEntry(`${firstClear ? '首次' : '重复'}通过挑战塔第${floor.floor}层，获得${gains.join('、')}。`, 'battle');
      checkQuests();
      checkAchievements();
      saveLocal();
      refreshPanel();
      renderContinue(null, `挑战塔第${floor.floor}层通关！你在正式交锋中击败了${esc(enemy.name)}。${renderRewardSummary(gainsResult)}`);
    },
    onDefeat:() => {
      saveLocal();
      refreshPanel();
      renderContinue(null, `挑战塔第${floor.floor}层挑战失败。你已被送出试炼场，恢复后可再次挑战。`);
    }
  });
}

// ==================== 每日签到 ====================
function openDailySign(){
  if(!G) return;
  if(!G._dailySign) G._dailySign = {};
  const sign = G._dailySign;
  const today = localDateKey();
  const preview = GameRules.previewDailySign(sign, today);
  const { signedToday, dayGap, nextStreak } = preview;
  const displayDay = preview.rewardDay;

  const rewardsHtml = DAILY_REWARDS.map(reward => {
    const isToday = reward.day === displayDay && !signedToday;
    const completedInCycle = signedToday ? displayDay : displayDay - 1;
    const isPast = reward.day <= completedInCycle;
    const cls = isToday ? 'today' : (isPast ? 'past' : 'future');
    const rewardText = Object.entries(reward.reward).map(([key, value]) => {
      const names = { gold:'金币', exp:'经验', fatePoint:'命运值' };
      return `+${value} ${names[key] || key}`;
    }).join('，');
    return `<div class="sign-day ${cls}">
      <div class="sd-num">第${reward.day}天</div>
      <div class="sd-name">${esc(reward.name)}</div>
      <div class="sd-reward">${rewardText}</div>
      <div class="sd-status">${isToday ? '✦ 可领取' : (isPast ? '✓ 已领取' : '')}</div>
    </div>`;
  }).join('');

  openModal('✦ 每日签到 ✦', `<div class="sign-header">
    <div class="sh-cycle">连续签到 <b>${signedToday ? sign.cycleDay || 1 : nextStreak}</b> 天 · 累计 ${sign.totalDays || 0} 天</div>
    <div class="sh-status">${signedToday ? '今日已签到，明天再来吧！' : (dayGap > 1 ? '上次签到已中断，今天重新开始连续签到。' : '点击下方按钮签到领奖')}</div>
    <div class="sh-next">${(() => { const td = (displayDay % 7) + 1; const tr = DAILY_REWARDS.find(r => r.day === td); if(!tr) return ''; const names = { gold:'金币', exp:'经验', fatePoint:'命运值' }; return `明天（第 ${td} 天）可领：${Object.entries(tr.reward).map(([k, v]) => `+${v} ${names[k] || k}`).join('，')}`; })()}</div>
  </div>
  <div class="sign-grid">${rewardsHtml}</div>
  ${signedToday ? '' : '<div style="text-align:center;margin-top:16px"><button class="btn btn-gold btn-big" id="btn-do-sign">立即签到</button></div>'}`);

  const signBtn = document.getElementById('btn-do-sign');
  if(signBtn) signBtn.addEventListener('click', () => {
    const recorded = GameRules.recordDailySign(G._dailySign, today);
    if(!recorded.changed){ toast('今日已经签到'); return; }
    G._dailySign = recorded.sign;
    const updatedSign = G._dailySign;
    const reward = DAILY_REWARDS[displayDay - 1];
    const raw = reward ? reward.reward : {};
    const parts = applyResultRewards({ gold:raw.gold || 0, exp:raw.exp || 0, fate:raw.fatePoint || 0 }).list;
    toast(`签到成功！${parts.length ? '获得 ' + parts.join('、') : ''}`);
    VisualFX.showAchievement('每日签到', `连续${nextStreak}天 · 累计${updatedSign.totalDays}天`, '✦');
    AudioFX.playSfx('sign');
    addDiaryEntry(`每日签到第${displayDay}档，连续${nextStreak}天，获得${parts.join('、')}。`, 'event');
    checkAchievements();
    saveLocal();
    refreshPanel();
    openDailySign();
  });
}

// ==================== 魂骨锻造 ====================
function openForge(){
  if(!G) return;
  if(!G._forgeBones) G._forgeBones = [];
  const bones = G._forgeBones;
  const recipes = FORGE_RECIPES;

  const recipesHtml = recipes.map(rc => {
    const material = rc.materials[0];
    const eligibleCount = bones.filter(bone => (Number(bone.tier) || 1) >= (material.minTier || 1)).length;
    const canForge = G.gold >= rc.goldCost && eligibleCount >= material.count;
    const resultStats = [];
    if(rc.result.attack) resultStats.push(`攻+${rc.result.attack}`);
    if(rc.result.defense) resultStats.push(`防+${rc.result.defense}`);
    if(rc.result.hp) resultStats.push(`血+${rc.result.hp}`);
    if(rc.result.speed) resultStats.push(`速+${rc.result.speed}`);
    return `<div class="forge-recipe ${canForge ? 'available' : 'unavailable'}" data-id="${rc.id}">
      <div class="fr-name">${esc(rc.name)}</div>
      <div class="fr-desc">${esc(rc.desc)}</div>
      <div class="fr-result">产物：${esc(rc.result.name)}（${resultStats.join('，')}）</div>
      <div class="fr-cost">消耗：${rc.materials[0].count}块魂骨 + ${rc.goldCost}金币${rc.successRate ? `（成功率${Math.round(rc.successRate*100)}%）` : ''}</div>
      <button class="btn btn-sm ${canForge ? 'btn-gold' : ''}" ${canForge ? '' : 'disabled'} data-forge="${rc.id}">锻造</button>
    </div>`;
  }).join('');

  const html = `<div class="forge-header">
    <div class="fh-info">可用锻造材料：<b>${bones.length}</b> 块 | 金币：<b>${G.gold}</b></div>
    <div class="fh-desc">在冒险中获得的魂骨碎片可以在此锻造为强大的成品魂骨</div>
  </div>
  <div class="forge-list">${recipesHtml}</div>
  <div style="margin-top:12px;font-size:13px;color:#a89a7c;text-align:center">
    💡 通过挑战塔、击败精英魂兽、探索秘境可获得锻造材料
  </div>`;

  openModal('🔨 魂骨锻造', html);

  document.querySelectorAll('[data-forge]').forEach(btn => {
    btn.addEventListener('click', () => {
      const recipeId = btn.dataset.forge;
      const rc = recipes.find(r => r.id === recipeId);
      if(!rc) return;
      const material = rc.materials[0];
      const eligibleIndexes = bones.map((bone, index) => ({ bone, index }))
        .filter(entry => (Number(entry.bone.tier) || 1) >= (material.minTier || 1))
        .slice(0, material.count).map(entry => entry.index);
      if(G.gold < rc.goldCost || eligibleIndexes.length < material.count){
        toast(`需要${material.count}块${material.minTier || 1}阶以上魂骨碎片及${rc.goldCost}金币`);
        return;
      }
      const consumeCount = material.count;
      // D-e：材料不可再生，锻造前二次确认（含成功率说明）
      const rateText = rc.successRate ? `成功率 ${Math.round(rc.successRate * 100)}%，失败返还一半材料` : '';
      if(!confirm(`消耗 ${material.count} 块魂骨碎片 + ${rc.goldCost} 金币锻造「${rc.result.name}」？${rateText}`)) return;
      eligibleIndexes.sort((a,b) => b-a).forEach(index => bones.splice(index, 1));
      G.gold -= rc.goldCost;
      // 成功率判定
      if(rc.successRate && Math.random() > rc.successRate){
        const refund = Math.max(1, Math.floor(consumeCount / 2));
        for(let i = 0; i < refund; i++){
          bones.push({ source:`锻造返还·${rc.name}`, tier: material.minTier || 1, refunded:true });
        }
        toast(`锻造失败！已返还 ${refund} 块材料……`);
        VisualFX.flash('red', 300);
        AudioFX.playSfx('hurt');
        addDiaryEntry(`尝试锻造「${rc.name}」失败，消耗了${consumeCount}块魂骨和${rc.goldCost}金币。`, 'event');
    } else {
        // 添加成品魂骨
        const newBone = Object.assign({}, rc.result);
        if(!G._craftedBones) G._craftedBones = [];
        G._craftedBones.push(newBone);
        toast(`✦ 锻造成功！获得「${rc.result.name}」！`);
        VisualFX.showAchievement('锻造成功', rc.result.name, '🔨');
        AudioFX.playSfx('forgeSuccess');
        const center = VisualFX.getBattleCenter ? VisualFX.getBattleCenter() : { x: window.innerWidth/2, y: window.innerHeight/2 };
        ParticleEngine.emit('forgeSuccess', center.x, center.y);
        addDiaryEntry(`成功锻造「${rc.result.name}」，消耗了${consumeCount}块魂骨和${rc.goldCost}金币。`, 'discovery');
      }
      saveLocal();
      refreshPanel();
      openForge();
    });
  });
}

// ==================== 支线任务板 ====================
function openQuests(){
  if(!G) return;
  if(!G._quests) G._quests = {};
  const questProgress = getQuestProgress();

  const questsHtml = QUESTS.map(q => {
    const claimed = G._quests[q.id + '_claimed'];
    const progress = questProgress[q.type] || 0;
    const done = progress >= q.target;
    const status = claimed ? 'claimed' : (done ? 'ready' : 'progress');
    const pct = Math.min(100, Math.round(progress / q.target * 100));
    const rewardText = Object.entries(q.reward).map(([k, v]) => {
      const names = { gold:'金币', exp:'经验' };
      return `+${v} ${names[k] || k}`;
    }).join('，');
    return `<div class="quest-card ${status}">
      <div class="qc-name">${esc(q.name)}</div>
      <div class="qc-desc">${esc(q.desc)}</div>
      <div class="qc-progress">
        <div class="qc-bar"><div class="qc-bar-fill" style="width:${pct}%"></div></div>
        <span class="qc-num">${Math.min(progress, q.target)} / ${q.target}</span>
      </div>
      <div class="qc-reward">奖励：${rewardText}</div>
      ${status === 'ready' ? `<button class="btn btn-gold btn-sm" data-quest="${q.id}">领取奖励</button>` : ''}
      ${status === 'claimed' ? '<div class="qc-done">✓ 已完成</div>' : ''}
    </div>`;
  }).join('');

  const claimedCount = QUESTS.filter(q => G._quests[q.id + '_claimed']).length;
  const html = `<div class="quest-header">
    <div class="qh-progress">已完成 <b>${claimedCount}</b> / ${QUESTS.length} 个任务</div>
  </div>
  <div class="quest-list">${questsHtml}</div>`;

  openModal('✦ 任务板 ✦', html);

  document.querySelectorAll('[data-quest]').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.quest;
      const q = QUESTS.find(x => x.id === qid);
      if(!q) return;
      G._quests[qid + '_claimed'] = true;
      const r = q.reward;
      if(r.gold) addGold(r.gold);
      if(r.exp) gainExp(r.exp);
      const parts = [];
      if(r.gold) parts.push(`${r.gold}金币`);
      if(r.exp) parts.push(`${r.exp}经验`);
      toast(`任务完成！获得 ${parts.join('、')}`);
      VisualFX.showAchievement('任务完成', q.name, '✓');
      AudioFX.playSfx('quest');
      addDiaryEntry(`完成任务「${q.name}」，获得${parts.join('、')}。`, 'event');
      checkAchievements();
      saveLocal();
      refreshPanel();
      openQuests();
    });
  });
}

// ==================== 新手引导系统 ====================
let activeTutorialCleanup = null;
function startTutorial(onComplete){
  if(activeTutorialCleanup) activeTutorialCleanup(false);
  const overlay = $('tutorial-overlay');
  if(!overlay){ if(typeof onComplete === 'function') onComplete(); return; }
  let step = 0;
  let finished = false;
  let targetCleanup = null;
  let battleStarted = false;
  const returnFocus = document.activeElement;

  const clearStepBindings = () => {
    if(targetCleanup){ targetCleanup(); targetCleanup = null; }
  };
  const cleanup = completed => {
    if(finished) return;
    finished = true;
    clearStepBindings();
    overlay.classList.add('hidden'); overlay.innerHTML = '';
    window.removeEventListener('keydown', keyHandler);
    window.removeEventListener('resize', positionCurrent);
    if(typeof BattleSystem !== 'undefined' && BattleSystem.cancelTraining) BattleSystem.cancelTraining();
    if($('modal-mask').classList.contains('show')) closeModal();
    if(completed) localStorage.setItem('dldl_tutorial_done', '1');
    activeTutorialCleanup = null;
    if(returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    if(typeof onComplete === 'function') setTimeout(onComplete, 80);
  };
  activeTutorialCleanup = cleanup;
  const finishTutorial = () => cleanup(true);
  const keyHandler = event => {
    if(event.key !== 'Escape' || finished) return;
    event.preventDefault(); event.stopPropagation(); finishTutorial();
  };
  const nextStep = () => { clearStepBindings(); battleStarted = false; step++; showStep(); };

  function prepareTarget(selector){
    if(!selector) return null;
    const target = document.querySelector(selector);
    if(!target) return null;
    const group = target.closest('details.top-group');
    if(group) group.open = true;
    if(target.closest('.status-panel.panel-collapsed')){
      const toggle = $('status-toggle'); if(toggle) toggle.click();
    }
    target.scrollIntoView({ block:'nearest', inline:'nearest', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    return target;
  }
  function renderOverlay(s, target, instruction){
    const rect = target ? target.getBoundingClientRect() : null;
    const pad = 7;
    const spot = rect ? `<div class="tut-spotlight" style="left:${Math.max(4, rect.left - pad)}px;top:${Math.max(4, rect.top - pad)}px;width:${Math.min(window.innerWidth - 8, rect.width + pad * 2)}px;height:${Math.min(window.innerHeight - 8, rect.height + pad * 2)}px"></div>` : '';
    const bubbleWidth = Math.min(300, window.innerWidth - 20);
    const left = rect ? Math.max(10, Math.min(window.innerWidth - bubbleWidth - 10, rect.left + rect.width / 2 - bubbleWidth / 2)) : Math.max(10, (window.innerWidth - bubbleWidth) / 2);
    const below = rect && rect.bottom + 190 < window.innerHeight;
    const top = rect ? (below ? rect.bottom + 13 : Math.max(10, rect.top - 205)) : Math.max(20, window.innerHeight / 2 - 110);
    const actionRequired = s.action === 'click' || (s.action === 'battle' && battleStarted);
    overlay.innerHTML = `${spot}<div class="tut-bubble" role="dialog" aria-label="新手引导：${esc(s.title)}" style="left:${left}px;top:${top}px;width:${bubbleWidth}px"><div class="tut-title">${step + 1}/${TUTORIAL_STEPS.length} · ${esc(s.title)}</div><div>${esc(s.text)}</div>${instruction ? `<div class="tut-instruction">${esc(instruction)}</div>` : ''}<div class="tut-actions"><button class="tut-skip">跳过引导</button><button class="tut-later">稍后再看</button>${actionRequired ? '' : `<button class="tut-next">${esc(s.btn)}</button>`}</div></div>`;
    const skipButton = overlay.querySelector('.tut-skip');
    if(skipButton) skipButton.addEventListener('click', finishTutorial);
    // 稍后再看：关闭引导、恢复剧情，本次存档不再自动弹出，可随时从设置手动查看。
    const laterButton = overlay.querySelector('.tut-later');
    if(laterButton) laterButton.addEventListener('click', () => {
      if(G) G._tutorialPostponed = true;
      if(typeof saveLocal === 'function') saveLocal();
      cleanup(false);
    });
    const nextButton = overlay.querySelector('.tut-next');
    if(nextButton) nextButton.addEventListener('click', () => {
      if(s.action === 'battle') startTutorialBattle(s);
      else nextStep();
    });
    requestAnimationFrame(() => (nextButton || skipButton || overlay).focus && (nextButton || skipButton || overlay).focus());
  }
  function positionCurrent(){
    if(finished || step >= TUTORIAL_STEPS.length) return;
    const s = TUTORIAL_STEPS[step];
    const selector = s.action === 'battle' && battleStarted ? '#btn-battle-attack' : s.target;
    renderOverlay(s, prepareTarget(selector), battleStarted ? '请点击高亮的“普通攻击”完成试战。' : (s.action === 'click' ? '请亲自点击高亮目标，完成后自动进入下一步。' : ''));
  }
  function startTutorialBattle(s){
    battleStarted = true;
    BattleSystem.start({ id:'tutorial_dummy', name:'训练木偶', icon:'🪵', isNpc:true, attack:1, defense:0, speed:1, hp:1, maxHp:1 }, {
      training:true, allowFlee:false, countKill:false,
      onVictory:() => { toast('教学试战完成：普通攻击会结算伤害并推进回合'); setTimeout(nextStep, 220); }
    });
    setTimeout(positionCurrent, 30);
  }
  function showStep(){
    if(finished) return;
    if(step >= TUTORIAL_STEPS.length){ finishTutorial(); return; }
    clearStepBindings();
    const s = TUTORIAL_STEPS[step];
    const target = prepareTarget(s.target);
    if(s.action === 'click' && target){
      const handler = () => {
        target.removeEventListener('click', handler);
        setTimeout(() => { if($('modal-mask').classList.contains('show')) closeModal(); nextStep(); }, 180);
      };
      target.addEventListener('click', handler, { once:true });
      targetCleanup = () => target.removeEventListener('click', handler);
    }
    renderOverlay(s, target, s.action === 'click' ? '请亲自点击高亮目标，完成后自动进入下一步。' : '');
  }

  window.addEventListener('keydown', keyHandler, true);
  window.addEventListener('resize', positionCurrent);
  overlay.classList.remove('hidden');
  showStep();
}

function shouldShowTutorial(){
  if(localStorage.getItem('dldl_tutorial_done')) return false;
  // “稍后再看”后本档不再自动弹出，可从设置手动查看。
  if(typeof G !== 'undefined' && G && G._tutorialPostponed) return false;
  return true;
}

// ==================== 修炼系统 ====================
function openTraining(){
  if(!G) return;
  const options = TRAINING_OPTIONS;
  const html = `<div class="training-header">
    <div class="th-info">当前等级：<b>Lv.${G.level}</b> | 金币：<b>${G.gold}</b></div>
    <div class="th-desc">花费金币进行修炼，快速提升经验和实力</div>
  </div>
  <div class="training-list">
    ${options.map(opt => {
      const canAfford = G.gold >= opt.goldCost;
      return `<div class="train-card ${canAfford ? 'available' : 'unavailable'}" data-id="${opt.id}">
        <div class="tr-name">${esc(opt.name)}</div>
        <div class="tr-desc">${esc(opt.desc)}</div>
        <div class="tr-stats">
          <span>消耗：${opt.goldCost}金币</span>
          <span>经验：+${opt.expGain}</span>
          ${opt.mpRestore ? `<span>魂力：+${opt.mpRestore}</span>` : ''}
          ${opt.statChance ? `<span>属性提升概率：${Math.round(opt.statChance*100)}%</span>` : ''}
          ${opt.risk ? `<span style="color:#d06a5a">风险：${Math.round(opt.risk*100)}%</span>` : ''}
          <span>耗时：${opt.time}</span>
        </div>
        <button class="btn btn-sm ${canAfford ? 'btn-gold' : ''}" ${canAfford ? '' : 'disabled'} data-train="${opt.id}">修炼</button>
      </div>`;
    }).join('')}
  </div>`;
  openModal('✦ 修炼 ✦', html);

  document.querySelectorAll('[data-train]').forEach(btn => {
    btn.addEventListener('click', () => {
      const optId = btn.dataset.train;
      const opt = options.find(o => o.id === optId);
      if(!opt || G.gold < opt.goldCost) return;
      G.gold -= opt.goldCost;
      gainExp(opt.expGain);
      if(opt.mpRestore){
        G.spiritPower = Math.min(getMaxSpiritPower(), G.spiritPower + opt.mpRestore);
      }
      if(opt.statChance && Math.random() < opt.statChance){
        const stats = ['attack', 'defense', 'hp', 'speed'];
        const stat = pick(stats);
        const bonus = rand(1, 3);
        G.bonus[stat] = (G.bonus[stat] || 0) + bonus;
        const statNames = { attack:'攻击', defense:'防御', hp:'生命', speed:'速度' };
        toast(`✦ 修炼感悟！${statNames[stat]} +${bonus}！`);
        VisualFX.showAchievement('修炼感悟', `${statNames[stat]} +${bonus}`, '✦');
        addDiaryEntry(`修炼时有所感悟，${statNames[stat]}永久提升${bonus}点。`, 'levelup');
      }
      if(opt.risk && Math.random() < opt.risk){
        G.hp = Math.max(1, G.hp - Math.round(G.hp * 0.3));
        toast('修炼走火入魔！损失了部分生命！');
        VisualFX.flash('red', 300);
        VisualFX.shake('heavy');
        addDiaryEntry(`秘境修炼时走火入魔，损失了部分生命。`, 'event');
      } else {
        toast(`修炼完成！获得${opt.expGain}经验`);
        AudioFX.playSfx('levelup');
        const center = VisualFX.getBattleCenter ? VisualFX.getBattleCenter() : { x: window.innerWidth/2, y: window.innerHeight/2 };
        ParticleEngine.emit('spiritBurst', center.x, center.y);
        addDiaryEntry(`进行了一次${opt.name}，获得${opt.expGain}经验。`, 'event');
      }
      checkQuests();
      saveLocal();
      refreshPanel();
      openTraining();
    });
  });
}

function getQuestProgress(){
  const bs = G.battleStats || { wins:0, kills:0 };
  return {
    hunt: bs.kills,
    win: bs.wins,
    level: G.level,
    gold: G._totalGoldEarned || 0,
    explore: (G._visitedLocations || []).length,
    tower: G._towerFloor || 0,
    rings: G.rings.length
  };
}

function checkQuests(){
  if(!G || !G._quests) return;
  const progress = getQuestProgress();
  QUESTS.forEach(q => {
    const done = (progress[q.type] || 0) >= q.target;
    if(done && !G._quests[q.id + '_claimed'] && !G._quests[q.id + '_notified']){
      G._quests[q.id + '_notified'] = true;
      toast(`✦ 任务可领取：「${q.name}」`);
    }
  });
}

// ==================== NPC好感度系统 ====================
function getNpcRelation(npcId){
  if(!G._npcRelations) return 0;
  return G._npcRelations[npcId] || 0;
}

function getNpcRelationLevel(affinity){
  let level = NPC_RELATION_LEVELS[0];
  for(const l of NPC_RELATION_LEVELS){
    if(affinity >= l.min) level = l;
  }
  return level;
}

function changeNpcRelation(npcId, delta){
  if(!G._npcRelations) G._npcRelations = {};
  const cur = G._npcRelations[npcId] || 0;
  const newVal = Math.max(0, Math.min(500, cur + delta));
  G._npcRelations[npcId] = newVal;
  // 检查是否提升好感度等级
  const oldLevel = getNpcRelationLevel(cur);
  const newLevel = getNpcRelationLevel(newVal);
  if(newLevel.min > oldLevel.min){
    const npc = DATA.npcData.find(n => n.id === npcId);
    const npcName = npc ? npc.name : npcId;
    toast(`✦ 与「${npcName}」的关系提升为：${newLevel.name}！`);
    VisualFX.showAchievement('关系提升', `${npcName} · ${newLevel.name}`, '♥');
    addDiaryEntry(`与「${npcName}」的关系提升为「${newLevel.name}」。`, 'npc');
  }
  saveLocal();
}

// ==================== NPC互动系统 ====================
const NPC_INTERACTIONS = [
  { id:'talk', name:'闲谈', desc:'与对方闲聊，小幅提升好感度（免费）', cost:0, affinity:3, cooldown:3 },
  { id:'gift_small', name:'赠送小礼', desc:'送出100金币的小礼物', cost:100, affinity:8, cooldown:2 },
  { id:'gift_big', name:'赠送重礼', desc:'送出500金币的珍贵礼物', cost:500, affinity:20, cooldown:5 },
  { id:'spar', name:'切磋武艺', desc:'与对方切磋战斗，胜则大幅提升好感', cost:0, affinity:15, cooldown:5, type:'battle' },
  { id:'help', name:'协助事务', desc:'帮助对方处理事务，提升好感度', cost:0, affinity:10, cooldown:4, reqLevel:10 },
  { id:'feast', name:'设宴款待', desc:'花费1000金币设宴，大幅提升好感', cost:1000, affinity:35, cooldown:10, reqLevel:15 }
];

// NPC关系奖励配置
const NPC_RELATION_REWARDS = {
  20: { desc:'相识——解锁人物详情', bonus:{} },
  50: { desc:'友善——获得该NPC派系加成', bonus:{ expMul:1.05 } },
  100:{ desc:'信赖——获得属性加成', bonus:{ attack:3, defense:2 } },
  200:{ desc:'挚友——获得强力属性加成', bonus:{ attack:8, defense:5, hp:50 } },
  350:{ desc:'生死之交——获得终极加成', bonus:{ attack:15, defense:10, hp:100, speed:5, fateMul:1.1 } },
  500:{ desc:'灵魂伴侣——满足隐藏结局条件', bonus:{} }
};

function getNpcRelationBonuses(){
  if(!G._npcRelations) return { attack:0, defense:0, hp:0, speed:0, expMul:1, fateMul:1 };
  const bonus = { attack:0, defense:0, hp:0, speed:0, expMul:1, fateMul:1 };
  for(const npcId in G._npcRelations){
    const aff = G._npcRelations[npcId];
    for(const threshold in NPC_RELATION_REWARDS){
      if(aff >= Number(threshold)){
        const r = NPC_RELATION_REWARDS[threshold].bonus;
        if(r.attack) bonus.attack += r.attack;
        if(r.defense) bonus.defense += r.defense;
        if(r.hp) bonus.hp += r.hp;
        if(r.speed) bonus.speed += r.speed;
        if(r.expMul) bonus.expMul *= r.expMul;
        if(r.fateMul) bonus.fateMul *= r.fateMul;
      }
    }
  }
  return bonus;
}

function canInteract(npcId, interactionId){
  const inter = NPC_INTERACTIONS.find(i => i.id === interactionId);
  if(!inter) return { ok:false, reason:'未知互动' };
  if(!G || !(G._metNpcs || []).includes(npcId)) return { ok:false, reason:'尚未结识该人物' };
  if(inter.reqLevel && G.level < inter.reqLevel) return { ok:false, reason:`需要${inter.reqLevel}级` };
  if(inter.cost > 0 && G.gold < inter.cost) return { ok:false, reason:'金币不足' };
  if(!G._npcCooldowns) G._npcCooldowns = {};
  const key = npcId + '_' + interactionId;
  // 没有记录即代表首次互动，不能把默认的0误判为刚互动过。
  if(Object.prototype.hasOwnProperty.call(G._npcCooldowns, key)){
    const elapsed = (Number(G._gameTime) || 0) - Number(G._npcCooldowns[key]);
    if(elapsed < inter.cooldown) return { ok:false, reason:`冷却中（剩余${Math.max(1, inter.cooldown - Math.floor(elapsed))}次行动）` };
  }
  return { ok:true };
}

function interactNpc(npcId, interactionId){
  const check = canInteract(npcId, interactionId);
  if(!check.ok){ toast(check.reason); return; }
  const inter = NPC_INTERACTIONS.find(i => i.id === interactionId);
  const npc = DATA.npcData.find(n => n.id === npcId);
  if(!inter || !npc) return;
  const cooldownKey = npcId + '_' + interactionId;

  if(inter.type === 'battle'){
    closeModal();
    const relation = getNpcRelation(npcId);
    const scale = Math.min(1.08, 0.78 + G.level * 0.002 + relation * 0.00035);
    const enemy = npcEnemy(npc.name, scale, '🤺');
    enemy.id = 'npc_spar_' + npcId;
    enemy.image = npc.image || null;
    const expGain = 30 + G.level * 5;
    addDiaryEntry(`向「${npc.name}」发起正式切磋。`, 'npc');
    BattleSystem.start(enemy, {
      allowFlee:false,
      countKill:false,
      result:{ exp:expGain, text:`你在切磋中战胜了「${npc.name}」。` },
      onVictory:(enemy, gains) => {
        G._npcCooldowns[cooldownKey] = Number(G._gameTime) || 0;
        G._npcSparDone = true;
        const affinityGain = inter.affinity + rand(0, 5);
        changeNpcRelation(npcId, affinityGain);
        addDiaryEntry(`切磋战胜「${npc.name}」，好感提升${affinityGain}点。`, 'npc');
        checkAchievements();
        saveLocal();
        // 文案使用实际发放值（含武魂/NPC/时间倍率），避免显示与变化不一致。
        const actualExp = (gains || []).reduce((sum, g) => {
          const m = String(g).match(/经验\+(\d+)/);
          return sum + (m ? parseInt(m[1], 10) : 0);
        }, 0);
        renderContinue(null, `你在点到为止的切磋中战胜「${esc(npc.name)}」，获得 ${actualExp || expGain} 经验，好感度 +${affinityGain}。`);
      },
      onDefeat:() => {
        G._npcCooldowns[cooldownKey] = Number(G._gameTime) || 0;
        changeNpcRelation(npcId, 2);
        addDiaryEntry(`切磋败给「${npc.name}」，但从中学到了不少。`, 'npc');
        saveLocal();
        renderContinue(null, `你在切磋中败给了「${esc(npc.name)}」，但对方认可你的勇气，好感度 +2。`);
      }
    });
    return;
  }

  if(inter.cost > 0) G.gold -= inter.cost;
  const variance = Math.floor(inter.affinity * 0.3);
  const gain = Math.max(1, inter.affinity + rand(-variance, variance));
  let extraMsg = '';
  if(interactionId === 'help'){
    const expGain = 20 + G.level * 3;
    const reward = applyResultRewards({ exp:expGain });
    extraMsg = `获得${reward.exp}经验`;
  }else if(interactionId === 'feast'){
    const healed = Math.round(finalStats().maxHp * 0.3);
    G.hp = Math.min(finalStats().maxHp, G.hp + healed);
    extraMsg = '恢复30%生命';
  }else if(interactionId === 'gift_big' && Math.random() < 0.3){
    const goldBack = rand(100, 300);
    addGold(goldBack);
    extraMsg = `${npc.name}回赠${goldBack}金币`;
  }
  changeNpcRelation(npcId, gain);
  completeWorldAction();
  G._npcCooldowns[cooldownKey] = Number(G._gameTime) || 0;
  toast(`♥ 与「${npc.name}」互动成功！好感+${gain}${extraMsg ? '，' + extraMsg : ''}`);
  AudioFX.playSfx('heal');
  const center = VisualFX.getPlayerPos ? VisualFX.getPlayerPos() : { x: window.innerWidth/2, y: window.innerHeight/2 };
  ParticleEngine.emit('heal', center.x, center.y);
  addDiaryEntry(`与「${npc.name}」进行了「${inter.name}」，好感提升${gain}点。`, 'npc');
  saveLocal();
  refreshPanel();
  showNpcDetail(npcId);
}

function openNpcRelations(){
  if(!G) return;
  const npcs = DATA.npcData;
  if(!npcs || !npcs.length){
    openModal('人物关系', '<div style="text-align:center;color:#a89a7c;padding:30px">数据加载中…</div>');
    return;
  }
  const met = G._metNpcs || [];
  const relations = G._npcRelations || {};
  // 按好感度排序
  const sorted = met.map(id => {
    const npc = npcs.find(n => n.id === id);
    return npc ? { npc, affinity: relations[id] || 0 } : null;
  }).filter(Boolean).sort((a, b) => b.affinity - a.affinity);

  if(!sorted.length){
    openModal('人物关系', '<div style="text-align:center;color:#a89a7c;padding:30px">尚未结识任何人物。<br>在冒险中探索各地，结识更多伙伴吧！</div>');
    return;
  }

  const html = `<div class="npc-relation-list">
    ${sorted.map(({ npc, affinity }) => {
      const level = getNpcRelationLevel(affinity);
      const nextLevel = NPC_RELATION_LEVELS.find(l => l.min > affinity);
      const progressPct = nextLevel ? Math.round((affinity - level.min) / (nextLevel.min - level.min) * 100) : 100;
      const reward = NPC_RELATION_REWARDS[level.min];
      // H3：显示该人物当前贡献的来源明细
      const contrib = getNpcContribution(npc.id, affinity);
      const contribParts = [];
      if(contrib.attack) contribParts.push(`攻+${contrib.attack}`);
      if(contrib.defense) contribParts.push(`防+${contrib.defense}`);
      if(contrib.hp) contribParts.push(`血+${contrib.hp}`);
      if(contrib.speed) contribParts.push(`速+${contrib.speed}`);
      if(contrib.expMul > 1) contribParts.push(`经验×${contrib.expMul}`);
      if(contrib.fateMul > 1) contribParts.push(`命运×${contrib.fateMul}`);
      const contribText = contribParts.length ? `<div class="nrc-contrib">贡献：${contribParts.join('　')}</div>` : '';
      return `<button class="npc-relation-card" data-npc-relation="${esc(npc.id)}" style="border-color:${level.color};width:100%;color:inherit;text-align:left">
        <div class="nrc-name" style="color:${level.color}">${esc(npc.name)}</div>
        <div class="nrc-title">${esc(npc.title || '')} · ${esc(npc.faction || '')}</div>
        <div class="nrc-level" style="color:${level.color}">♥ ${level.name}</div>
        <div class="nrc-bar"><div class="nrc-bar-fill" style="width:${progressPct}%;background:${level.color}"></div></div>
        <div class="nrc-num">${affinity}${nextLevel ? ' / ' + nextLevel.min : ' (MAX)'}</div>
        ${contribText}
        ${reward ? `<div class="nrc-reward">${reward.desc}</div>` : ''}
      </button>`;
    }).join('')}
  </div>
  <div style="margin-top:12px;font-size:13px;color:#a89a7c;text-align:center">
    点击人物查看详情并进行互动 · 已结识 ${met.length}/${npcs.length} 位
  </div>`;

  openModal('♥ 人物关系', html);
  $('modal-body').querySelectorAll('[data-npc-relation]').forEach(button => button.addEventListener('click', () => showNpcDetail(button.dataset.npcRelation)));
}

// H3：计算单个 NPC 好感带来的属性/倍率贡献（全局加成来源可见）
function getNpcContribution(npcId, affinity){
  const bonus = { attack:0, defense:0, hp:0, speed:0, expMul:1, fateMul:1 };
  const aff = G._npcRelations && G._npcRelations[npcId];
  if(!aff) return bonus;
  for(const threshold in NPC_RELATION_REWARDS){
    if(aff >= Number(threshold)){
      const r = NPC_RELATION_REWARDS[threshold].bonus;
      if(r.attack) bonus.attack += r.attack;
      if(r.defense) bonus.defense += r.defense;
      if(r.hp) bonus.hp += r.hp;
      if(r.speed) bonus.speed += r.speed;
      if(r.expMul) bonus.expMul *= r.expMul;
      if(r.fateMul) bonus.fateMul *= r.fateMul;
    }
  }
  return bonus;
}

function bindUI(){
  // 全局按钮音效
  document.addEventListener('click', e => {
    if(e.target.closest('.btn, .ba-btn, .choice-btn, .top-btn, .origin-card')){
      AudioFX.playSfx('click');
    }
  });
  document.addEventListener('mouseover', e => {
    if(e.target.closest('.btn, .ba-btn, .choice-btn, .top-btn, .origin-card')){
      AudioFX.playSfx('hover');
    }
  });

  // 下拉菜单互斥：打开一个时关闭其他，点击外部时关闭所有
  document.querySelectorAll('details.top-group').forEach(d => {
    d.addEventListener('toggle', () => {
      if(d.open){
        document.querySelectorAll('details.top-group[open]').forEach(other => {
          if(other !== d) other.removeAttribute('open');
        });
      }
    });
    // 点击菜单内按钮后自动收起，避免菜单残留遮挡场景。
    d.querySelectorAll('button, summary').forEach(item => {
      item.addEventListener('click', () => {
        if(item.tagName !== 'SUMMARY') d.removeAttribute('open');
      });
    });
  });
  document.addEventListener('click', e => {
    if(!e.target.closest('details.top-group')){
      document.querySelectorAll('details.top-group[open]').forEach(d => d.removeAttribute('open'));
    }
    const statusButton = e.target.closest('[data-status-action]');
    if(statusButton){
      e.preventDefault();
      handleStatusAction(statusButton.dataset.statusAction);
    }
  });

  $('btn-new').addEventListener('click', () => {
    resetRoleShell();
    newChar = { name: '', origin: null, spirit: null, redraws: Infinity };
    $('input-name').value = '';
    $('name-err').textContent = '';
    $('btn-to-awaken').disabled = true;
    $('awaken-info').classList.add('is-concealed');
    $('awaken-info').classList.remove('is-revealed');
    $('awaken-info').setAttribute('aria-hidden', 'true');
    $('awaken-left').classList.add('is-concealed');
    $('awaken-left').classList.remove('is-revealed');
    $('awaken-left').setAttribute('aria-hidden', 'true');
    $('awaken-img-wrap').classList.remove('reveal');
    $('awaken-img-wrap').innerHTML = '<div class="awaken-q">？</div>';
    $('btn-awaken').classList.remove('action-slot-hidden');
    $('btn-Redraw').classList.add('action-slot-hidden');
    $('btn-confirm-spirit').classList.add('action-slot-hidden');
    $('btn-awaken').setAttribute('aria-hidden', 'false');
    $('btn-Redraw').setAttribute('aria-hidden', 'true');
    $('btn-confirm-spirit').setAttribute('aria-hidden', 'true');
    updateGodPityUI();
    renderOrigins();
    gotoStep(1, { immediate: true });
    showScreen('screen-create');
  });
  // “继续冒险”打开存档选择列表：本地最近存档 + 全部服务器存档均可选择
  $('btn-continue').addEventListener('click', openSaveList);
  $('btn-codex').addEventListener('click', () => {
    let started = false;
    try{
      const saved = localStorage.getItem(LS_KEY);
      const data = saved ? JSON.parse(saved) : null;
      started = Boolean(data && data.playerId && !data.finished);
    }catch(e){}
    if(window.G && !window.G.finished) started = true;
    if(!started) toast('万象图鉴收录了世界的全部知识，包含后续剧情线索。建议先开始旅程，边探索边收藏。');
    if(window.navigateTo) navigateTo('codex'); else location.href = '/codex.html';
  });
  $('btn-codex2').addEventListener('click', () => { saveLocal(); if(window.navigateTo) navigateTo('codex'); else location.href = '/codex.html'; });

  $('btn-back-title-1').addEventListener('click', () => showScreen('screen-title'));
  $('btn-to-origin').addEventListener('click', () => {
    const name = $('input-name').value.trim();
    if(name.length < 2 || name.length > 8){
      $('name-err').textContent = '名字需要 2 ~ 8 个字哦';
      return;
    }
    $('name-err').textContent = '';
    newChar.name = name;
    gotoStep(2);
  });
  $('btn-back-name').addEventListener('click', () => gotoStep(1));
  $('btn-to-awaken').addEventListener('click', () => gotoStep(3));
  $('btn-back-origin').addEventListener('click', () => gotoStep(2));

  $('btn-awaken').addEventListener('click', () => doAwaken());
  $('btn-Redraw').addEventListener('click', () => {
    if(newChar.redraws <= 0) return;
    newChar.redraws--;
    doAwaken();
  });
  $('btn-god-pity').addEventListener('click', openGodPitySelection);
  $('btn-confirm-spirit').addEventListener('click', async () => {
    createPlayer();
    await saveServer(true);
    enterGame(true); // true = 新游戏，播放开场剧情
  });

  $('btn-bag').addEventListener('click', openBag);
  $('btn-shop').addEventListener('click', openShop);
  $('btn-map').addEventListener('click', openMap);
  $('btn-npc').addEventListener('click', openNpcCodex);
  const btnRelation = $('btn-relation');
  if(btnRelation) btnRelation.addEventListener('click', openNpcRelations);
  $('btn-bone').addEventListener('click', openBoneCodex);
  $('btn-skilltree').addEventListener('click', openSkillTree);
  $('btn-ach').addEventListener('click', openAchievements);
  $('btn-title').addEventListener('click', openTitles);
  $('btn-skills').addEventListener('click', () => {
    showMySkills();
  });
  $('btn-save').addEventListener('click', () => saveServer(false));
  $('btn-home').addEventListener('click', async () => { await saveServer(true); showScreen('screen-title'); });

  // 左侧面板按钮
  const btnSkillTree2 = $('btn-skill-tree');
  if(btnSkillTree2) btnSkillTree2.addEventListener('click', openSkillTree);
  const btnAch2 = $('btn-achievements');
  if(btnAch2) btnAch2.addEventListener('click', openAchievements);
  const btnTitles2 = $('btn-titles');
  if(btnTitles2) btnTitles2.addEventListener('click', openTitles);
  const btnJournal = $('btn-journal');
  if(btnJournal) btnJournal.addEventListener('click', openJournal);
  const btnStats = $('btn-stats');
  if(btnStats) btnStats.addEventListener('click', openStats);
  const btnSettings = $('btn-settings');
  if(btnSettings) btnSettings.addEventListener('click', openSettings);
  const statusToggle = $('status-toggle');
  if(statusToggle) statusToggle.addEventListener('click', () => {
    const panel = $('status-panel');
    const layout = panel.closest('.game-layout');
    const collapsed = panel.classList.toggle('panel-collapsed');
    layout.classList.toggle('status-collapsed', collapsed);
    statusToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    statusToggle.textContent = collapsed ? '展开状态栏' : '收起状态栏';
  });
  if(window.innerWidth <= 1024 && statusToggle) statusToggle.click();

  // 顶部栏新增按钮
  const btnForge = $('btn-forge');
  if(btnForge) btnForge.addEventListener('click', openForge);
  const btnTrain = $('btn-train');
  if(btnTrain) btnTrain.addEventListener('click', openTraining);
  const btnQuests = $('btn-quests');
  if(btnQuests) btnQuests.addEventListener('click', openQuests);
  const btnTower = $('btn-tower');
  if(btnTower) btnTower.addEventListener('click', openChallengeTower);
  const btnSignin = $('btn-signin');
  if(btnSignin) btnSignin.addEventListener('click', openDailySign);
  const btnFormation = $('btn-formation');
  if(btnFormation) btnFormation.addEventListener('click', openFormationSelect);
  const btnFastTravel = $('btn-fasttravel');
  if(btnFastTravel) btnFastTravel.addEventListener('click', openFastTravel);

  // 兼容历史背包入口
  const btnInventory = $('btn-inventory');
  if(btnInventory) btnInventory.addEventListener('click', openInventory);
  const btnHelp = $('btn-help');
  if(btnHelp) btnHelp.addEventListener('click', openHelp);

  $('btn-ending-restart').addEventListener('click', () => { localStorage.removeItem(LS_KEY); showScreen('screen-title'); });
  $('btn-ending-codex').addEventListener('click', () => { if(window.navigateTo) navigateTo('codex'); else location.href = '/codex.html'; });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') closeModal();
    // 快捷键（仅游戏画面中）
    const gameVisible = $('screen-game').classList.contains('active');
    if(!gameVisible || G === null) return;
    // 弹窗、战斗和输入控件内不触发界面快捷键。
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if($('modal-mask').classList.contains('show') || (typeof BattleSystem !== 'undefined' && BattleSystem.isActive())) return;
    switch(e.key.toLowerCase()){
      case 's': if(G && !e.ctrlKey && !e.metaKey && !e.altKey){ e.preventDefault(); saveServer(false); } break;
      case 'i': if(G) openInventory(); break;
      case 'b': if(G) openShop(); break;
      case 'j': if(G) openJournal(); break;
      case 'a': if(G) openAchievements(); break;
      case 't': if(G) openStats(); break;
      case 'm': if(G) openSettings(); break;
      case 'h': if(G) openHelp(); break;
    }
  });
  window.addEventListener('beforeunload', saveLocal);
}

// B-03：数据加载失败时在标题页给出明确错误卡片与重试入口
function renderDataLoadErrorCard(files){
  const menu = document.querySelector('#screen-title .title-menu');
  if(!menu) return;
  const card = document.createElement('div');
  card.className = 'data-error-card';
  card.style.cssText = 'margin:0 auto 12px;max-width:420px;padding:10px 14px;border:1px solid #d06a5a;border-radius:6px;background:rgba(208,106,90,.1);color:#d06a5a;font-size:12px;line-height:1.7;text-align:left';
  card.innerHTML = `<b>⚠️ 部分数据加载失败</b>（${esc(files.join('、'))}）<br>游戏内容可能不完整，建议重试。<button id="btn-data-retry" class="btn btn-sm" style="margin-top:6px">重新加载</button>`;
  menu.insertBefore(card, menu.firstChild);
  const retry = document.getElementById('btn-data-retry');
  if(retry) retry.addEventListener('click', () => location.reload());
}

// ==================== 启动 ====================
(async function init(){
  console.log('[初始化] 开始');
  bindUI();
  try{
    await loadData();
    if(window.__dataLoadErrors && window.__dataLoadErrors.length){
      renderDataLoadErrorCard(window.__dataLoadErrors);
    }
  }catch(e){
    toast('数据加载失败，请刷新重试');
    return;
  }
  applyUserSettings();
  // 正常启动也使用备份恢复链，主档损坏时仍可继续游戏。
  try{
    const recovered = SaveUtils.recoverFromStorage(localStorage, LS_KEY);
    if(recovered.data && !recovered.data.finished){
      G = recovered.data;
      window.G = G;
      if(recovered.source !== 'main') localStorage.setItem(LS_KEY, JSON.stringify(G));
      $('btn-continue').textContent = `继续冒险（${G.name} Lv.${G.level}${recovered.source !== 'main' ? '·备份恢复' : ''}）`;
    }else if(localStorage.getItem(LS_KEY)){
      $('btn-continue').textContent = '继续冒险（存档需处理）';
    }
  }catch(e){ console.error('[初始化] 本地存档恢复失败:', e); }
  console.log('[初始化] 完成');
})();
