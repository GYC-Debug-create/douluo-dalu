(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.SaveUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const CURRENT_SAVE_VERSION = 8;
  const MAX_RINGS = 9;
  // 事件扩展包曾因重复 ID 在运行时生成 __2；保留旧档选择/冷却记录的可读性。
  const EVENT_ID_ALIASES = {
    'adv_more_01__2':'adv_more_01_beast', 'adv_more_02__2':'adv_more_02_birds',
    'adv_more_03__2':'adv_more_03_bear', 'adv_more_04__2':'adv_more_04_scorpion',
    'adv_more_05__2':'adv_more_05_sheep', 'adv_more_06__2':'adv_more_06_titan',
    'ma_more_01__2':'ma_more_01_sect', 'ma_more_02__2':'ma_more_02_evil',
    'ma_more_03__2':'ma_more_03_snow', 'ma_more_04__2':'ma_more_04_mentor',
    'god_more_01__2':'god_more_01_envoy', 'god_more_02__2':'god_more_02_evil',
    'god_more_03__2':'god_more_03_rift'
  };
  const LOCATION_ALIASES = {
    slk_academy:'shrek_academy',
    '史莱克学院':'shrek_academy', '武魂城':'wuhun_city', '武魂殿':'spirit_hall',
    '天斗城':'tian_dou_city', '海神岛':'sea_god_island',
    '星斗大森林':'star_duo_outer', '星斗大森林外围':'star_duo_outer',
    '星斗大森林·外围':'star_duo_outer', '星斗大森林深处':'star_duo_deep',
    '星斗大森林·深处':'star_duo_deep'
  };
  const RING_BEAST_NAME_ALIASES = {
    spirit_deer_ten:'灵鹿', wind_rabbit_ten:'疾风兔', wind_rabbit_hundred:'疾风兔', wild_rabbit:'疾风兔',
    poison_spider_ten:'毒蛛', poison_spider_hundred:'毒蛛', poison_spider:'毒蛛', one_eye_wolf:'独眼狼',
    flower_snake:'花蛇', rock_python:'岩蟒', nether_wolf_king:'幽冥狼王', titan_giant_ape:'泰坦巨猿',
    titan_giant_ape_king:'泰坦巨猿王', black_water_dragon:'黑水蛟龙', dark_gold_terrorclaw_bear:'暗金恐爪熊',
    deep_sea_demon_whale_king:'深海魔鲸王', flame_tiger:'烈焰虎', human_faced_spider:'人面魔蛛',
    ice_emperor_scorpion:'冰帝蝎', ice_wolf:'冰狼', iron_armor_bear:'铁甲熊', iron_horn_sheep:'铁角羊',
    thousand_eye_centipede:'千眼蜈蚣', thunder_bird:'雷鸟', wind_butterfly:'风蝶', wind_spirit_swallow:'风灵燕'
  };
  const INTERNAL_RING_ID_RE = /^[a-z][a-z0-9_:-]*$/i;
  function cleanRingSource(value){
    return String(value || '').trim().replace(/魂技$/, '').replace(/^(猎杀|挑战|吸收|选择)/, '').replace(/[·—].*$/, '').trim();
  }
  function isInternalRingLabel(value){
    const cleaned = cleanRingSource(value);
    return Boolean(cleaned && (RING_BEAST_NAME_ALIASES[cleaned] || INTERNAL_RING_ID_RE.test(cleaned)));
  }
  function playerFacingRingSource(value, fallback){
    const cleaned = cleanRingSource(value);
    if(!cleaned) return fallback;
    if(RING_BEAST_NAME_ALIASES[cleaned]) return RING_BEAST_NAME_ALIASES[cleaned];
    if(INTERNAL_RING_ID_RE.test(cleaned)) return fallback;
    return cleaned;
  }
  const DEFAULTS = {
    gameMode: 'text-rpg',
    inventory: [],
    rings: [],
    skills: [],
    choices: {},
    doneEvents: [],
    completedEvents: [],
    bonus: { attack:0, defense:0, hp:0, speed:0 },
    battleStats: { wins:0, losses:0, kills:0 },
    _storyPath: [],
    _storyDecisions: {},
    _metNpcs: [],
    _bones: [],
    _forgeBones: [],
    _craftedBones: [],
    _visitedLocations: [],
    _discoveredHidden: [],
    _achievementList: [],
    _titles: [],
    _skillTree: {},
    _diary: [],
    _npcRelations: {},
    _npcCooldowns: {},
    _dailySign: {},
    _dynCooldowns: {},
    _recentEvents: [],
    _formationsUsed: [],
    _usedElements: [],
    _towerFloor: 0,
    _eventCount: 0,
    _gameTime: 0,
    _weather: 0,
    overflowExp: 0,
    _progressionRulesVersion: 2,
    pendingRingLv: null,
    _ringHuntDeferredUntil: 0,
    _mainStoryVersion: 0,
    _storyMilestoneDeferredUntil: 0,
    _totalGoldEarned: 0,
    _prologueDone: false,
    _earlyLifeDone: false,
    _spiritAwakeningStoryDone: false,
    _registeredAtHall: false,
    _enrollmentComplete: false,
    _introPendingEvent: null,
    _tutorialPostponed: false,
    _firstClassDone: false,
    _academyRecommendation: null,
    _forgeBonesMigrated: false,
    _saveIntegrityWarnings: [],
    _legacyRingOverflow: [],
    _orphanedSkills: []
  };

  function clone(value){
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function isValidSave(data){
    return Boolean(data && typeof data === 'object' && !Array.isArray(data) &&
      typeof data.name === 'string' && data.name.trim() &&
      data.spirit && Number.isFinite(Number(data.level)) && Number(data.level) >= 1);
  }

  function migrateSave(data){
    if(!isValidSave(data)) return null;
    const migrated = { ...clone(data) };
    for(const [key, value] of Object.entries(DEFAULTS)){
      if(migrated[key] === undefined || migrated[key] === null) migrated[key] = clone(value);
    }
    migrated.level = Number(migrated.level);
    migrated.exp = Math.max(0, Number(migrated.exp) || 0);
    migrated.overflowExp = Math.max(0, Number(migrated.overflowExp) || 0);
    migrated._ringHuntDeferredUntil = Math.max(0, Math.floor(Number(migrated._ringHuntDeferredUntil) || 0));
    migrated._mainStoryVersion = Math.max(0, Math.floor(Number(migrated._mainStoryVersion) || 0));
    migrated._storyMilestoneDeferredUntil = Math.max(0, Math.floor(Number(migrated._storyMilestoneDeferredUntil) || 0));
    migrated._progressionRulesVersion = Math.max(1, Math.floor(Number(migrated._progressionRulesVersion) || 1));
    migrated.gold = Math.max(0, Number(migrated.gold) || 0);
    migrated.fatePoints = Number(migrated.fatePoints) || 0;
    migrated.gameMode = migrated.gameMode || (typeof migrated.spirit === 'object' ? 'text-rpg' : 'legacy');
    if(!migrated.playerId && migrated.id) migrated.playerId = migrated.id;
    if(!migrated.playerId && migrated.gameMode === 'text-rpg') migrated.playerId = 'p_' + Date.now().toString(36);
    if(Array.isArray(migrated._npcRelations)){
      const normalized = {};
      migrated._npcRelations.forEach((entry, index) => {
        if(!entry) return;
        const id = entry.id || entry.name || `npc_${index}`;
        normalized[id] = Math.max(normalized[id] || 0, Number(entry.level || entry.affinity) || 0);
      });
      migrated._npcRelations = normalized;
    }
    if(migrated._dailySign.date && !migrated._dailySign.lastDate) migrated._dailySign.lastDate = migrated._dailySign.date;
    if(migrated._dailySign.streak && !migrated._dailySign.cycleDay) migrated._dailySign.cycleDay = migrated._dailySign.streak;
    if(migrated._dailySign.streak && !migrated._dailySign.totalDays) migrated._dailySign.totalDays = migrated._dailySign.streak;
    migrated._dailySign.cycleDay = Math.max(0, Number(migrated._dailySign.cycleDay) || 0);
    migrated._dailySign.totalDays = Math.max(migrated._dailySign.cycleDay, Number(migrated._dailySign.totalDays) || 0);
    migrated._dailySign.maxStreak = Math.max(migrated._dailySign.cycleDay, Number(migrated._dailySign.maxStreak) || 0);

    if(Array.isArray(migrated._skillTree)){
      migrated._skillTree = Object.fromEntries(migrated._skillTree.filter(Boolean).map(id => [String(id), true]));
    }else if(!migrated._skillTree || typeof migrated._skillTree !== 'object'){
      migrated._skillTree = {};
    }
    if(migrated._currentLocation && LOCATION_ALIASES[migrated._currentLocation]){
      migrated._currentLocation = LOCATION_ALIASES[migrated._currentLocation];
    }
    if(Array.isArray(migrated._visitedLocations)){
      migrated._visitedLocations = [...new Set(migrated._visitedLocations.map(id => LOCATION_ALIASES[id] || id))];
    }
    if(Array.isArray(migrated._discoveredHidden)){
      migrated._discoveredHidden = [...new Set(migrated._discoveredHidden.map(id => LOCATION_ALIASES[id] || id))];
    }
    const completed = Array.isArray(migrated.completedEvents) ? migrated.completedEvents : [];
    const normalizeEventId = id => EVENT_ID_ALIASES[id] || id;
    migrated.doneEvents = [...new Set([...(Array.isArray(migrated.doneEvents) ? migrated.doneEvents : []), ...completed].map(normalizeEventId))];
    migrated.completedEvents = migrated.doneEvents.slice();
    if(migrated.choices && typeof migrated.choices === 'object' && !Array.isArray(migrated.choices)){
      const choices = {};
      Object.entries(migrated.choices).forEach(([id, value]) => { choices[normalizeEventId(id)] = value; });
      migrated.choices = choices;
    }
    if(Array.isArray(migrated._recentEvents)) migrated._recentEvents = [...new Set(migrated._recentEvents.map(normalizeEventId))];
    if(migrated._storyDecisions && typeof migrated._storyDecisions === 'object'){
      const decisions = {};
      Object.entries(migrated._storyDecisions).forEach(([id, value]) => {
        const normalized = id.startsWith('event:') ? `event:${normalizeEventId(id.slice(6))}` : id;
        decisions[normalized] = value;
      });
      migrated._storyDecisions = decisions;
    }
    migrated._totalGoldEarned = Math.max(Number(migrated._totalGoldEarned) || 0, migrated.gold);
    if(!Number.isFinite(Number(migrated.hp))) migrated.hp = 1;
    else migrated.hp = Math.max(1, Number(migrated.hp));
    // 早期版本 _personality/_destiny 可能存为字符串，统一归一化为对象，避免读档后界面渲染抛异常。
    if(migrated._personality && typeof migrated._personality === 'string'){
      migrated._personality = { traits:[migrated._personality], subtype:'' };
    }
    if(migrated._destiny && typeof migrated._destiny === 'string'){
      migrated._destiny = { name:migrated._destiny };
    }
    migrated._personality = migrated._personality && typeof migrated._personality === 'object' ? migrated._personality : { traits:['独特'], subtype:'' };
    migrated._destiny = migrated._destiny && typeof migrated._destiny === 'object' ? migrated._destiny : { name:migrated._destiny || '命运之路' };

    // 魂环是魂技的唯一归属。旧版本允许独立保存 skills，曾出现魂环卡与战斗按钮使用不同名称；
    // 迁移时以每个魂环的 skill 为权威值，并把多余的测试记录隔离，不让它们进入正式战斗。
    const warnings = Array.isArray(migrated._saveIntegrityWarnings) ? migrated._saveIntegrityWarnings.slice() : [];
    const rawRingValues = Array.isArray(migrated.rings) ? migrated.rings.filter(Boolean) : [];
    const rawRings = rawRingValues.map((ring, index) => {
      if(typeof ring === 'object') return { ...ring };
      warnings.push(`第${index + 1}个魂环记录格式异常，已转换为兼容记录`);
      return { name:String(ring), skill:String(ring), source:'旧档兼容记录' };
    });
    if(rawRings.length > MAX_RINGS){
      migrated._legacyRingOverflow = rawRings.slice(MAX_RINGS);
      migrated.rings = rawRings.slice(0, MAX_RINGS);
      warnings.push(`检测到${rawRings.length}个魂环记录，已按正式规则保留前${MAX_RINGS}个`);
    }else{
      migrated.rings = rawRings;
      migrated._legacyRingOverflow = Array.isArray(migrated._legacyRingOverflow) ? migrated._legacyRingOverflow : [];
    }
    const rawSkills = Array.isArray(migrated.skills) ? migrated.skills.filter(Boolean).map(skill => {
      if(typeof skill === 'object') return skill;
      return { name:String(skill) };
    }) : [];
    const extraSkills = rawSkills.length > migrated.rings.length ? rawSkills.slice(migrated.rings.length) : [];
    const priorOrphanedSkills = Array.isArray(migrated._orphanedSkills) ? migrated._orphanedSkills : [];
    migrated._orphanedSkills = [...priorOrphanedSkills, ...extraSkills];
    if(extraSkills.length) warnings.push(`检测到${extraSkills.length}个无魂环归属的魂技记录，已移入兼容区`);
    migrated.skills = migrated.rings.map((ring, index) => {
      const legacy = rawSkills[index] || {};
      const rawSkill = String(ring.skill || legacy.name || `第${index + 1}魂技`);
      const internalSkillSource = isInternalRingLabel(rawSkill) ? cleanRingSource(rawSkill) : '';
      ring.source = playerFacingRingSource(ring.source || ring.beastId || internalSkillSource, ring.name || '未知魂兽');
      if(ring.beastId && RING_BEAST_NAME_ALIASES[ring.beastId]) ring.beastId = RING_BEAST_NAME_ALIASES[ring.beastId];
      const name = isInternalRingLabel(rawSkill)
        ? `${playerFacingRingSource(rawSkill, ring.source)}魂技`
        : rawSkill;
      const skill = { ...legacy, name };
      ring.skill = name;
      if(!ring.skillId) ring.skillId = `ring:${ring.ringId || ring.id || index + 1}:${index + 1}`;
      skill.skillId = ring.skillId;
      skill.ring = index + 1;
      skill.source = ring.source || skill.source || ring.name || '魂环';
      skill.type = ring.skillType || skill.type || '攻击';
      skill.desc = ring.skillDesc || skill.desc || '来自魂环的魂技。';
      skill.anim = ring.skillAnim || skill.anim || 'beam';
      skill.element = ring.skillElement || skill.element || null;
      if(!Number.isFinite(Number(skill.damage)) && ring.skillDef && Number.isFinite(Number(ring.skillDef.damage))) skill.damage = Number(ring.skillDef.damage);
      if(!Number.isFinite(Number(skill.cost)) && ring.skillDef && Number.isFinite(Number(ring.skillDef.cost))) skill.cost = Number(ring.skillDef.cost);
      if(!Number.isFinite(Number(skill.cooldown)) && ring.skillDef && Number.isFinite(Number(ring.skillDef.cooldown))) skill.cooldown = Number(ring.skillDef.cooldown);
      return skill;
    });
    const nextRingLevel = migrated.rings.length < MAX_RINGS ? (migrated.rings.length + 1) * 10 : null;
    migrated.pendingRingLv = nextRingLevel && migrated.level >= nextRingLevel ? nextRingLevel : null;
    if(!migrated.pendingRingLv) migrated._ringHuntDeferredUntil = 0;
    migrated._saveIntegrityWarnings = [...new Set(warnings)];

    // 旧档只在首次迁移时把已发现魂骨补成锻造碎片，避免每次进游戏重复发放。
    if(!migrated._forgeBonesMigrated){
      if((migrated._forgeBones || []).length === 0 && (migrated._bones || []).length){
        migrated._forgeBones = migrated._bones.map(id => ({ source:id, tier:1, migrated:true }));
      }
      migrated._forgeBonesMigrated = true;
    }
    // 已看完旧序章的存档跳过新增早年节点；新建角色会显式保存 false。
    if(data._earlyLifeDone === undefined) migrated._earlyLifeDone = data._prologueDone === true;
    if(data._spiritAwakeningStoryDone === undefined) migrated._spiritAwakeningStoryDone = data._prologueDone === true;
    if(data._enrollmentComplete === undefined) migrated._enrollmentComplete = migrated._earlyLifeDone === true;
    if(data._registeredAtHall === undefined) migrated._registeredAtHall = migrated._enrollmentComplete === true;
    if(data._introPendingEvent === undefined) migrated._introPendingEvent = null;
    if(data._firstClassDone === undefined) migrated._firstClassDone = data._earlyLifeDone === true || migrated.doneEvents.includes('first_class') || (data._earlyLifeDone === undefined && data._prologueDone === true);
    if(data._academyRecommendation === undefined) migrated._academyRecommendation = null;
    // 早期旧版本没有保存序章/第一堂课字段。只要已经有明显的自由成长记录，
    // 就把角色视为已经越过新增新手叙事，避免 Lv.50/Lv.100 旧档倒放早年主线。
    const legacyRules = Number(data._progressionRulesVersion || 0) < 2 ||
      (data._progressionRulesVersion === undefined && Number(data._saveVersion || 0) < 5);
    const legacyProgress = migrated.level > 1 || migrated.rings.length > 0 || migrated.skills.length > 0 ||
      migrated.doneEvents.length >= 7 || migrated.doneEvents.includes('first_class') ||
      data._earlyLifeDone === true || data._prologueDone === true || data._enrollmentComplete === true;
    if(legacyRules && legacyProgress){
      migrated._prologueDone = true;
      migrated._spiritAwakeningStoryDone = true;
      migrated._earlyLifeDone = true;
      migrated._registeredAtHall = true;
      migrated._enrollmentComplete = true;
      migrated._firstClassDone = true;
      migrated._introPendingEvent = null;
    }
    // 旧档已经在旧规则下自由成长，不倒退等级；从当前存档状态开始采用新的魂环门槛。
    // 新建存档由 createPlayer 显式标记为 2，避免把旧玩家误当成新手。
    if(data._progressionRulesVersion === undefined && Number(data._saveVersion || 0) < 5) migrated._progressionRulesVersion = 1;

    migrated.battleStats = {
      wins:Math.max(0, Number(migrated.battleStats && migrated.battleStats.wins) || 0),
      losses:Math.max(0, Number(migrated.battleStats && migrated.battleStats.losses) || 0),
      kills:Math.max(0, Number(migrated.battleStats && migrated.battleStats.kills) || 0)
    };
    migrated._saveVersion = CURRENT_SAVE_VERSION;
    return migrated;
  }

  function parseCandidate(raw){
    if(!raw) return null;
    try { return migrateSave(JSON.parse(raw)); }
    catch { return null; }
  }

  function recoverFromStorage(storage, key){
    const candidates = [
      [key, 'main'], [key + '_backup', 'backup'],
      ...Array.from({ length:5 }, (_, index) => [`${key}_hist${index + 1}`, `history-${index + 1}`])
    ];
    for(const [candidateKey, source] of candidates){
      const data = parseCandidate(storage.getItem(candidateKey));
      if(data) return { data, source };
    }
    return { data:null, source:'none' };
  }

  return { CURRENT_SAVE_VERSION, LOCATION_ALIASES, EVENT_ID_ALIASES, migrateSave, isValidSave, recoverFromStorage };
});
