/**
 * 文字 RPG 正式回合制战斗系统
 * 依赖 game.js 暴露的 G / finalStats / applyResultRewards 等运行时函数。
 */
'use strict';

const BattleSystem = (() => {
  let state = null;
  let battleToken = 0;

  const ELEMENT_ICONS = {
    fire:'🔥', ice:'❄️', thunder:'⚡', water:'💧', wood:'🌿', earth:'🪨',
    light:'☀️', dark:'🌑', poison:'☠️', metal:'⚔️', wind:'💨', none:'◯'
  };
  const ELEMENT_NAMES = {
    fire:'火', ice:'冰', thunder:'雷', water:'水', wood:'木', earth:'土',
    light:'光', dark:'暗', poison:'毒', metal:'金', wind:'风', none:'无'
  };
  const STATUS_INFO = {
    burn:{ name:'燃烧', icon:'🔥', harmful:true },
    poison:{ name:'中毒', icon:'☠️', harmful:true },
    freeze:{ name:'冻结', icon:'❄️', harmful:true },
    stun:{ name:'眩晕', icon:'💫', harmful:true },
    weak:{ name:'虚弱', icon:'📉', harmful:true },
    armorBreak:{ name:'破甲', icon:'💔', harmful:true },
    regen:{ name:'再生', icon:'🌱', harmful:false },
    rage:{ name:'狂暴', icon:'🔥', harmful:false },
    shield:{ name:'护盾', icon:'🛡️', harmful:false },
    haste:{ name:'疾风', icon:'💨', harmful:false }
  };

  function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }
  function randomInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
  function safeRichText(text){
    if(typeof GameRules !== 'undefined' && typeof GameRules.richText === 'function'){
      // richText 内部整体转义并按白名单恢复标签；占位符在恢复之后用已转义值替换，避免二次转义。
      return GameRules.richText(text)
        .replace(/\{name\}/g, typeof G !== 'undefined' && G ? esc(G.name || '') : '')
        .replace(/\{spirit\}/g, typeof G !== 'undefined' && G ? esc(G.spirit.name || '') : '');
    }
    return typeof esc === 'function' ? esc(text) : String(text == null ? '' : text);
  }
  function animationPreference(){
    try{ return localStorage.getItem('dldl_battle_animation') || 'normal'; }catch(e){ return 'normal'; }
  }
  function reducedMotion(){ return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function animationsEnabled(){ return animationPreference() !== 'minimal' && !reducedMotion(); }
  function delayMs(){
    const preference = animationPreference();
    const base = preference === 'minimal' ? 80 : (preference === 'fast' ? 300 : 480);
    return Math.max(preference === 'minimal' ? 0 : 70, Math.round(base / ((state && state.speed) || 1)));
  }
  function setFeedback(actor, target, text, type, skillName){
    if(!state) return;
    state.feedback = { actor, target, text:String(text || ''), type:type || 'damage', skillName:skillName || '' };
  }
  function playSfx(type){ if(typeof AudioFX !== 'undefined') AudioFX.playSfx(type); }

  function normalizeElement(value){
    const text = String(value || '').toLowerCase();
    if(/火|fire|焰/.test(text)) return 'fire';
    if(/冰|雪|寒|ice/.test(text)) return 'ice';
    if(/雷|电|thunder/.test(text)) return 'thunder';
    if(/水|海|water/.test(text)) return 'water';
    if(/木|草|植物|wood/.test(text)) return 'wood';
    if(/土|岩|大地|earth/.test(text)) return 'earth';
    if(/光|神圣|天使|light/.test(text)) return 'light';
    if(/暗|影|冥|深渊|dark/.test(text)) return 'dark';
    if(/毒|poison/.test(text)) return 'poison';
    if(/金|剑|刀|锤|metal/.test(text)) return 'metal';
    if(/风|wind/.test(text)) return 'wind';
    return 'none';
  }

  function elementMultiplier(attacker, defender){
    attacker = normalizeElement(attacker);
    defender = normalizeElement(defender);
    if(attacker === 'none' || defender === 'none' || attacker === defender) return 1;
    const strongAgainst = {
      fire:['ice','metal','wood'], ice:['thunder','water'], thunder:['water','wind'],
      water:['fire','earth'], wood:['earth','water'], earth:['thunder','water'],
      metal:['wood','wind'], wind:['earth'], light:['dark'], dark:['light']
    };
    if((strongAgainst[attacker] || []).includes(defender)) return 1.35;
    if((strongAgainst[defender] || []).includes(attacker)) return 0.8;
    return 1;
  }

  function inferEnemyElement(enemy){
    return normalizeElement(enemy.element || enemy.sub || enemy.type || enemy.name);
  }

  function normalizeEnemy(raw){
    const fs = finalStats();
    const source = raw && typeof raw === 'object' ? raw : {};
    const hp = Number(source.hp || source.maxHp) || Math.max(60, Math.round(fs.maxHp * 0.75));
    return {
      id: source.id || ('enemy_' + Date.now()),
      name: source.name || '未知对手',
      icon: source.icon || (source.isNpc ? '⚔️' : '🐾'),
      image: source.image || null,
      attack: Math.max(1, Number(source.attack) || Math.round(fs.attack * 0.7)),
      defense: Math.max(0, Number(source.defense) || Math.round(fs.defense * 0.55)),
      speed: Math.max(1, Number(source.speed) || Math.round(fs.speed * 0.8)),
      hp,
      maxHp: Number(source.maxHp) || hp,
      element: inferEnemyElement(source),
      isNpc: Boolean(source.isNpc),
      isBoss: Boolean(source.isBoss || /boss|lord|king|主|王|神|最终/i.test(String(source.id || '') + source.name)),
      special: source.special || '',
      exp: Number(source.exp) || 0,
      gold: Number(source.gold) || 0
    };
  }

  function playerMaxSpirit(){
    return typeof getMaxSpiritPower === 'function' ? getMaxSpiritPower() : G.spiritPowerMax;
  }

  function addLog(text, type){
    if(!state) return;
    state.logs.push({ text:String(text), type:type || 'normal' });
    if(state.logs.length > 12) state.logs.shift();
  }

  function addStatus(list, id, turns, power){
    const existing = list.find(status => status.id === id);
    if(existing){
      existing.turns = Math.max(existing.turns, turns);
      existing.power = Math.max(existing.power || 0, power || 0);
    }else{
      list.push({ id, turns, power:power || 0 });
    }
  }

  function statusHtml(list){
    if(!list.length) return '<span class="battle-no-status">无状态</span>';
    return list.map(status => {
      const info = STATUS_INFO[status.id] || { name:status.id, icon:'✦' };
      return `<span class="battle-status ${info.harmful ? 'bad' : 'good'}" title="${info.name}，剩余${status.turns}回合">${info.icon}${info.name} ${status.turns}</span>`;
    }).join('');
  }

  function tickStatuses(target){
    const isPlayer = target === 'player';
    const list = isPlayer ? state.playerStatuses : state.enemyStatuses;
    let skip = false;
    for(const status of list){
      if(status.id === 'burn'){
        const maxHp = isPlayer ? finalStats().maxHp : state.enemy.maxHp;
        const damage = Math.max(1, Math.round(maxHp * 0.035));
        if(isPlayer) G.hp -= damage; else state.enemy.hp -= damage;
        addLog(`${isPlayer ? G.name : state.enemy.name}受到燃烧伤害 ${damage}。`, 'damage');
      }else if(status.id === 'poison'){
        const maxHp = isPlayer ? finalStats().maxHp : state.enemy.maxHp;
        const damage = Math.max(1, Math.round(maxHp * 0.025 + (status.power || 0)));
        if(isPlayer) G.hp -= damage; else state.enemy.hp -= damage;
        addLog(`${isPlayer ? G.name : state.enemy.name}受到中毒伤害 ${damage}。`, 'damage');
      }else if(status.id === 'regen'){
        const maxHp = isPlayer ? finalStats().maxHp : state.enemy.maxHp;
        const heal = Math.max(1, Math.round(maxHp * Math.max(0.03, status.power || 0.03)));
        if(isPlayer) G.hp = Math.min(maxHp, G.hp + heal);
        else state.enemy.hp = Math.min(state.enemy.maxHp, state.enemy.hp + heal);
        addLog(`${isPlayer ? G.name : state.enemy.name}恢复了 ${heal} 点生命。`, 'heal');
      }else if(status.id === 'freeze' || status.id === 'stun'){
        skip = true;
      }
    }
    list.forEach(status => status.turns--);
    const alive = list.filter(status => status.turns > 0);
    if(isPlayer) state.playerStatuses = alive; else state.enemyStatuses = alive;
    return skip;
  }

  function statusDamageModifier(statuses, attacking){
    let value = 1;
    if(attacking && statuses.some(s => s.id === 'weak')) value *= 0.75;
    if(attacking && statuses.some(s => s.id === 'rage')) value *= 1.3;
    if(!attacking && statuses.some(s => s.id === 'armorBreak')) value *= 1.2;
    return value;
  }

  function triggerElementReaction(element){
    element = normalizeElement(element);
    const previous = state.lastSkillElement;
    state.lastSkillElement = element;
    if(element === 'none' || previous === 'none' || !previous || previous === element) return;
    const pair = [previous, element].sort().join('+');
    const names = {
      'fire+water':'蒸汽爆发','fire+wind':'烈焰风暴','ice+thunder':'超导反应',
      'thunder+water':'感电连锁','earth+wind':'沙暴肆虐','dark+light':'审判之光',
      'fire+ice':'融冰爆发','ice+water':'冻结反应','fire+wood':'燃烧蔓延'
    };
    const name = names[pair] || '元素共鸣';
    const damage = Math.max(1, Math.round(finalStats().attack * 0.42));
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    recordDamage(damage);
    G._reactionTriggered = true;
    G._reactionCount = (G._reactionCount || 0) + 1;
    addLog(`${name}触发，额外造成 ${damage} 点伤害！`, 'crit');
  }

  function maybeApplyElementStatus(element, targetStatuses, guaranteed){
    const chance = guaranteed ? 1 : 0.28;
    if(Math.random() > chance) return null;
    const map = {
      fire:['burn',3], ice:['freeze',1], thunder:['stun',1], poison:['poison',4],
      dark:['weak',3], metal:['armorBreak',3], wood:['poison',3], water:['weak',2]
    };
    const def = map[normalizeElement(element)];
    if(!def) return null;
    addStatus(targetStatuses, def[0], def[1]);
    return STATUS_INFO[def[0]].name;
  }

  function updateBossPhase(){
    if(!state.enemy.isBoss) return;
    const ratio = state.enemy.hp / state.enemy.maxHp;
    const phase = ratio <= 0.3 ? 3 : (ratio <= 0.6 ? 2 : 1);
    if(phase <= state.bossPhase) return;
    state.bossPhase = phase;
    if(phase === 2){
      state.enemy.attack = Math.round(state.enemy.attack * 1.18);
      addStatus(state.enemyStatuses, 'rage', 99);
      addLog(`${state.enemy.name}进入第二阶段，气息骤然暴涨！`, 'boss');
    }else{
      state.enemy.attack = Math.round(state.enemy.attack * 1.22);
      state.enemy.defense = Math.round(state.enemy.defense * 1.12);
      addStatus(state.enemyStatuses, 'shield', 2);
      addLog(`${state.enemy.name}进入最终阶段，释放了护体领域！`, 'boss');
    }
    state.phaseNotice = `${state.enemy.name} · 阶段 ${phase}`;
    playSfx('warning');
    if(typeof VisualFX !== 'undefined') VisualFX.flash('red', 180);
  }

  // 伤害公式单一来源：委托 game-rules.calculateDamage（T27 可纯函数回归）
  function damageFormula(attack, defense, options){
    if(typeof GameRules !== 'undefined' && typeof GameRules.calculateDamage === 'function'){
      return GameRules.calculateDamage(attack, defense, options);
    }
    const opt = options || {};
    const penetration = clamp(opt.penetration || 0, 0, 0.8);
    const effectiveDefense = defense * (1 - penetration);
    const base = Math.max(1, attack * (0.88 + Math.random() * 0.24) - effectiveDefense * 0.48);
    return Math.max(1, Math.round(base * (opt.multiplier || 1)));
  }

  function recordDamage(value){
    G._totalDamage = (G._totalDamage || 0) + Math.max(0, value);
    G._maxDamage = Math.max(G._maxDamage || 0, value);
  }

  function decrementCooldowns(){
    state.cooldowns = state.cooldowns.map(value => Math.max(0, value - 1));
  }

  function applyComboFinisher(){
    if(!state || state.enemy.hp <= 0 || state.combo < 5 || state.combo % 5 !== 0 || state.lastFinisherCombo === state.combo) return;
    state.lastFinisherCombo = state.combo;
    const bonus = Math.max(1, Math.round(finalStats().attack * (0.35 + state.combo * 0.025)));
    state.enemy.hp = Math.max(0, state.enemy.hp - bonus);
    recordDamage(bonus);
    G._maxComboFinisher = Math.max(G._maxComboFinisher || 0, state.combo);
    addLog(`${state.combo}连击触发连携终结，额外造成 ${bonus} 点伤害！`, 'crit');
  }

  function skillElement(index, skill){
    const explicit = normalizeElement(skill && skill.element);
    if(explicit !== 'none') return explicit;
    const inferred = normalizeElement(`${skill && skill.name || ''} ${skill && skill.source || ''}`);
    if(inferred !== 'none') return inferred;
    const cycle = ['fire','ice','thunder','water','wood','earth','light','dark','wind'];
    return cycle[index % cycle.length];
  }

  function afterPlayerAction(){
    if(!state || state.ended) return;
    if(state.enemy.hp <= 0){
      state.busy = true;
      render();
      const token = state.token;
      setTimeout(() => { if(state && state.token === token && !state.ended) finishVictory(); }, animationsEnabled() ? Math.min(360, delayMs()) : 0);
      return;
    }
    updateBossPhase();
    state.turn = 'enemy';
    render();
    const token = state.token;
    setTimeout(() => {
      if(!state || state.token !== token || state.ended) return;
      enemyAction();
    }, delayMs());
  }

  function performAttack(){
    if(!state || state.turn !== 'player' || state.busy || state.ended) return;
    state.busy = true;
    const fs = finalStats();
    const sb = G._skillBonuses || {};
    state.combo++;
    G._maxCombo = Math.max(G._maxCombo || 0, state.combo);
    const comboMult = 1 + Math.min(0.6, Math.floor(state.combo / 5) * 0.1 + state.combo * 0.015 + (sb.comboBonus || 0));
    const critRate = clamp(0.05 + (sb.critRate || 0) + Math.max(0, fs.speed - state.enemy.speed) * 0.002 + state.combo * 0.005, 0.05, 0.65);
    const crit = Math.random() < critRate;
    const element = getSpiritElement();
    const elemental = elementMultiplier(element, state.enemy.element);
    const critMult = crit ? 1.5 + (sb.critDmg || 0) : 1;
    let damage = damageFormula(fs.attack, state.enemy.defense, {
      penetration:sb.defPenetration || 0,
      multiplier:comboMult * elemental * critMult * statusDamageModifier(state.playerStatuses, true) * statusDamageModifier(state.enemyStatuses, false)
    });
    const shield = state.enemyStatuses.find(s => s.id === 'shield');
    if(shield) damage = Math.max(1, Math.round(damage * 0.55));
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    recordDamage(damage);
    setFeedback('player', 'enemy', `-${damage}`, crit ? 'crit' : 'damage');
    playSfx(crit ? 'crit' : 'attack');
    G.spiritPower = Math.min(playerMaxSpirit(), G.spiritPower + (sb.mpRecovery || 2));
    let line = `${G.name}发动普通攻击，造成 ${damage} 点伤害`;
    if(crit) line += '（暴击）';
    if(elemental > 1) line += '（元素克制）';
    if(elemental < 1) line += '（元素受阻）';
    line += `，当前 ${state.combo} 连击。`;
    addLog(line, crit ? 'crit' : 'player');
    if(sb.alwaysStatus){
      const applied = maybeApplyElementStatus(element, state.enemyStatuses, true);
      if(applied) addLog(`${state.enemy.name}陷入${applied}状态。`, 'status');
    }
    if(sb.extraAttack && Math.random() < sb.extraAttack && state.enemy.hp > 0){
      const extra = Math.max(1, Math.round(damage * 0.45));
      state.enemy.hp = Math.max(0, state.enemy.hp - extra);
      recordDamage(extra);
      addLog(`影分身发动追击，额外造成 ${extra} 点伤害。`, 'player');
    }
    applyComboFinisher();
    state.busy = false;
    afterPlayerAction();
  }

  function performSkill(index){
    if(!state || state.turn !== 'player' || state.busy || state.ended) return;
    const skill = (G.skills || [])[index];
    if(!skill) return;
    const sb = G._skillBonuses || {};
    const cost = Math.max(1, Math.round((skill.cost || 15) * (1 - (sb.mpCostReduction || 0))));
    if(G.spiritPower < cost){ addLog('魂力不足，无法释放该魂技。', 'warning'); render(); return; }
    if((state.cooldowns[index] || 0) > 0){ addLog(`「${skill.name}」仍在冷却。`, 'warning'); render(); return; }
    state.busy = true;
    G.spiritPower -= cost;
    state.cooldowns[index] = Math.max(1, (skill.cooldown || 3) - (sb.cdReduction || 0));
    const fs = finalStats();
    const type = String(skill.type || '攻击');
    const desc = String(skill.desc || '');
    const isHeal = /治疗|恢复|回春|甘露/.test(type + desc);
    const isDefense = /防御|护|增益|复活|闪避/.test(type + desc);
    const element = skillElement(index, skill);
    if(!G._usedElements) G._usedElements = [];
    if(element !== 'none' && !G._usedElements.includes(element)) G._usedElements.push(element);

    playSfx('skill');
    if(isHeal){
      const heal = Math.max(10, Math.round((skill.damage || 20) * 0.8 + fs.maxHp * 0.14));
      G.hp = Math.min(fs.maxHp, G.hp + heal);
      addStatus(state.playerStatuses, 'regen', 2, 0.04);
      addLog(`${G.name}释放「${skill.name}」，恢复 ${heal} 点生命并获得再生。`, 'heal');
      setFeedback('player', 'player', `+${heal}`, 'heal', skill.name);
      state.combo = 0;
    }else if(isDefense){
      addStatus(state.playerStatuses, 'shield', 2);
      if(/增益|狂暴/.test(type + desc)) addStatus(state.playerStatuses, 'rage', 2);
      addLog(`${G.name}释放「${skill.name}」，获得护盾与战斗增益。`, 'player');
      setFeedback('player', 'player', '护盾', 'heal', skill.name);
      state.combo = 0;
    }else{
      state.combo++;
      G._maxCombo = Math.max(G._maxCombo || 0, state.combo);
      const elemental = elementMultiplier(element, state.enemy.element);
      const critRate = clamp(0.08 + (sb.critRate || 0) + state.combo * 0.006, 0.08, 0.7);
      const crit = Math.random() < critRate;
      const critMult = crit ? 1.5 + (sb.critDmg || 0) : 1;
      const skillMult = 1 + (sb.skillDmgBonus || 0) + Math.min(0.5, state.combo * 0.02 + (sb.comboBonus || 0));
      let damage = damageFormula(fs.attack + (skill.damage || 20) * 0.7, state.enemy.defense, {
        penetration:sb.defPenetration || 0,
        multiplier:elemental * critMult * skillMult * statusDamageModifier(state.playerStatuses, true) * statusDamageModifier(state.enemyStatuses, false)
      });
      const shield = state.enemyStatuses.find(s => s.id === 'shield');
      if(shield) damage = Math.max(1, Math.round(damage * 0.55));
      state.enemy.hp = Math.max(0, state.enemy.hp - damage);
      recordDamage(damage);
      setFeedback('player', 'enemy', `-${damage}`, crit ? 'crit' : 'damage', skill.name);
      let line = `${G.name}释放「${skill.name}」，造成 ${damage} 点伤害`;
      if(crit) line += '（暴击）';
      if(elemental > 1) line += '（元素克制）';
      line += '。';
      addLog(line, crit ? 'crit' : 'player');
      triggerElementReaction(element);
      const applied = maybeApplyElementStatus(element, state.enemyStatuses, Boolean(sb.alwaysStatus));
      if(applied) addLog(`${state.enemy.name}陷入${applied}状态。`, 'status');
      applyComboFinisher();
    }
    state.busy = false;
    afterPlayerAction();
  }

  function performFusion(){
    if(!state || state.turn !== 'player' || state.busy || state.ended || state.fusionUsed) return;
    const cost = 40;
    if((G.rings || []).length < 3){ addLog('至少获得三个魂环后才能施展武魂融合。', 'warning'); render(); return; }
    if(G.spiritPower < cost){ addLog('魂力不足，武魂融合需要40点魂力。', 'warning'); render(); return; }
    state.busy = true;
    state.fusionUsed = true;
    G._fusionUsed = true;
    G.spiritPower -= cost;
    const damage = damageFormula(finalStats().attack * 1.65, state.enemy.defense, { multiplier:1.65 * statusDamageModifier(state.enemyStatuses, false), penetration:0.25 });
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    recordDamage(damage);
    setFeedback('player', 'enemy', `-${damage}`, 'crit', '武魂融合');
    playSfx('skill');
    addStatus(state.playerStatuses, 'shield', 2);
    addStatus(state.playerStatuses, 'rage', 2);
    addLog(`人魂合一！${G.name}施展武魂融合，造成 ${damage} 点伤害并获得护盾。`, 'crit');
    state.busy = false;
    afterPlayerAction();
  }

  function performDefend(){
    if(!state || state.turn !== 'player' || state.busy || state.ended) return;
    state.defending = true;
    state.combo = 0;
    const formation = getActiveFormation();
    const restoreRate = formation && formation.id === 'spirit' ? 0.22 : 0.12;
    const restore = Math.max(5, Math.round(playerMaxSpirit() * restoreRate));
    G.spiritPower = Math.min(playerMaxSpirit(), G.spiritPower + restore);
    addStatus(state.playerStatuses, 'shield', 1);
    addLog(`${G.name}凝神防御，并恢复 ${restore} 点魂力。`, 'player');
    afterPlayerAction();
  }

  function showItems(){
    if(!state || state.ended) return;
    state.showItems = !state.showItems;
    render();
  }

  function useItem(index){
    if(!state || state.turn !== 'player' || state.busy || state.ended) return;
    const item = G.inventory[index];
    if(!item || item.count <= 0) return;
    const maxHp = finalStats().maxHp;
    let message = '';
    if(item.type === 'heal' || item.type === 'healFull'){
      const amount = item.type === 'healFull' ? maxHp : Math.min(maxHp, G.hp + Number(item.value || 0));
      const healed = amount - G.hp;
      if(healed <= 0){
        addLog('当前生命已满，无需恢复。', 'warning');
        render();
        return;
      }
      G.hp = amount;
      message = `恢复 ${healed} 点生命`;
    }else if(item.type === 'mp'){
      const before = G.spiritPower;
      G.spiritPower = Math.min(playerMaxSpirit(), G.spiritPower + Number(item.value || 0));
      message = `恢复 ${G.spiritPower - before} 点魂力`;
    }else if(item.type === 'buffAtk'){
      addStatus(state.playerStatuses, 'rage', 3, Number(item.value || 0.2));
      message = '获得 3 回合狂暴';
    }else if(item.type === 'buffDef'){
      addStatus(state.playerStatuses, 'shield', 3, Number(item.value || 0.2));
      message = '获得 3 回合护盾';
    }else if(item.type === 'buffSpd'){
      addStatus(state.playerStatuses, 'haste', 3, Number(item.value || 0.2));
      message = '获得 3 回合疾风，闪避率提升';
    }else if(item.type === 'cure'){
      const before = state.playerStatuses.length;
      state.playerStatuses = state.playerStatuses.filter(s => s.id !== String(item.value || 'poison'));
      if(before === state.playerStatuses.length){ addLog('当前没有中毒，无需使用解毒丹。', 'warning'); render(); return; }
      message = '解除了中毒';
    }else if(item.type === 'cureAll'){
      const before = state.playerStatuses.length;
      state.playerStatuses = state.playerStatuses.filter(s => !(STATUS_INFO[s.id] || {}).harmful);
      if(before === state.playerStatuses.length){ addLog('当前没有负面状态，无需使用净化符。', 'warning'); render(); return; }
      message = '清除了所有负面状态';
    }else{
      addLog(`「${item.name}」不能在战斗中使用。`, 'warning');
      render();
      return;
    }
    item.count--;
    G.inventory = G.inventory.filter(it => it.count > 0);
    state.combo = 0;
    state.showItems = false;
    addLog(`${G.name}使用「${item.name}」，${message}。`, 'heal');
    afterPlayerAction();
  }

  function attemptFlee(){
    if(!state || state.turn !== 'player' || state.busy || state.ended) return;
    if(state.enemy.isBoss || state.options.allowFlee === false){
      addLog('这场战斗无法逃跑。', 'warning');
      render();
      return;
    }
    const chance = clamp(0.45 + (finalStats().speed - state.enemy.speed) * 0.012, 0.2, 0.9);
    if(Math.random() < chance){
      state.ended = true;
      G._battleActive = false;
      addLog('你成功脱离了战斗。', 'warning');
      if(typeof completeWorldAction === 'function') completeWorldAction();
      const ringEvent = state.options.event && state.options.event.ring;
      const storyEvent = state.options.event && state.options.event._mainStory;
      if(ringEvent) G._ringHuntDeferredUntil = (G._eventCount || 0) + 2;
      if(storyEvent) G._storyMilestoneDeferredUntil = (G._eventCount || 0) + 2;
      saveLocal();
      refreshPanel();
      const escapeText = ringEvent ? '你摆脱了魂兽追击；魂环尚未获得，再历练两次后可重新搜寻。' :
        (storyEvent ? '你暂时退出了这场主线交锋；再历练两次后可以重新挑战。' : '你避开敌人的追击，重新整理行装。');
      renderEnd('已脱离战斗', escapeText, 'escape');
    }else{
      addLog('逃跑失败，敌人抓住了破绽！', 'damage');
      state.combo = 0;
      afterPlayerAction();
    }
  }

  function enemyAction(){
    if(!state || state.ended) return;
    if(state.enemy.hp <= 0){ finishVictory(); return; }
    const skip = tickStatuses('enemy');
    if(state.enemy.hp <= 0){ finishVictory(); return; }
    if(skip){
      addLog(`${state.enemy.name}受到控制，本回合无法行动。`, 'status');
      endRound();
      return;
    }
    const fs = finalStats();
    const sb = G._skillBonuses || {};
    const haste = state.playerStatuses.find(status => status.id === 'haste');
    const dodgeChance = clamp((sb.dodge || 0) + (haste ? Math.max(0.15, haste.power || 0) : 0) + Math.max(0, fs.speed - state.enemy.speed) * 0.002, 0, 0.65);
    if(Math.random() < dodgeChance){
      addLog(`${G.name}闪开了${state.enemy.name}的攻击。`, 'player');
      endRound();
      return;
    }
    let multiplier = statusDamageModifier(state.enemyStatuses, true);
    let specialName = '';
    if(state.enemy.isBoss && Math.random() < 0.24){
      multiplier *= 1.45 + state.bossPhase * 0.08;
      specialName = state.bossPhase >= 3 ? '灭世冲击' : '狂暴重击';
    }
    if(state.defending) multiplier *= 0.48;
    const shield = state.playerStatuses.find(s => s.id === 'shield');
    if(shield) multiplier *= 0.62;
    const antiCrit = sb.antiCrit || 0;
    const crit = Math.random() < Math.max(0.03, 0.1 - antiCrit);
    if(crit) multiplier *= 1.5;
    let damage = damageFormula(state.enemy.attack, fs.defense, {
      multiplier:multiplier * statusDamageModifier(state.playerStatuses, false)
    });
    G.hp = Math.max(0, G.hp - damage);
    setFeedback('enemy', 'player', `-${damage}`, crit ? 'crit' : 'damage', specialName);
    playSfx(specialName ? 'skill' : 'hurt');
    G._totalDamageTaken = (G._totalDamageTaken || 0) + damage;
    addLog(`${state.enemy.name}${specialName ? '施展「' + specialName + '」' : '发动攻击'}，造成 ${damage} 点伤害${crit ? '（暴击）' : ''}。`, 'damage');
    if(G.hp > 0 && G.hp <= fs.maxHp * 0.2 && !state.limitBreakUsed){
      state.limitBreakUsed = true;
      const heal = Math.round(fs.maxHp * 0.3);
      G.hp = Math.min(fs.maxHp, G.hp + heal);
      addStatus(state.playerStatuses, 'rage', 3);
      addStatus(state.playerStatuses, 'regen', 3, 0.05);
      addLog(`极限突破！${G.name}恢复 ${heal} 点生命并获得狂暴与再生。`, 'crit');
    }
    if(Math.random() < 0.2){
      const applied = maybeApplyElementStatus(state.enemy.element, state.playerStatuses, false);
      if(applied) addLog(`${G.name}陷入${applied}状态。`, 'status');
    }
    if(G.hp <= 0){
      if(sb.lastStand && !state.lastStandUsed){
        state.lastStandUsed = true;
        G.hp = Math.max(1, Math.round(fs.maxHp * 0.25));
        addLog('金身不灭发动！你在致命伤害下坚持了下来。', 'heal');
      }else{
        finishDefeat();
        return;
      }
    }
    endRound();
  }

  function endRound(){
    if(!state || state.ended) return;
    state.round++;
    state.defending = false;
    decrementCooldowns();
    const playerSkip = tickStatuses('player');
    if(G.hp <= 0){ finishDefeat(); return; }
    const regen = (G._skillBonuses || {}).regen || 0;
    if(regen > 0 && !state.playerStatuses.some(s => s.id === 'regen')) addStatus(state.playerStatuses, 'regen', 1, regen);
    state.turn = 'player';
    state.busy = false;
    render();
    if(playerSkip){
      addLog(`${G.name}受到控制，本回合无法行动。`, 'status');
      state.turn = 'enemy';
      render();
      const token = state.token;
      setTimeout(() => {
        if(state && state.token === token && !state.ended) enemyAction();
      }, delayMs());
    }
  }

  function maybeDropBone(){
    if(state.enemy.isNpc || Math.random() >= (state.enemy.isBoss ? 0.45 : 0.12)) return '';
    if(!G._forgeBones) G._forgeBones = [];
    G._forgeBones.push({ source:state.enemy.name, tier:state.enemy.isBoss ? 3 : 1, obtainedAt:Date.now() });
    if(state.enemy.isBoss && DATA.boneData && DATA.boneData.length){
      const available = DATA.boneData.filter(b => !(G._bones || []).includes(b.id));
      if(available.length) obtainBone(available[Math.floor(Math.random() * available.length)].id);
    }
    return '魂骨碎片×1';
  }

  function finishVictory(){
    if(!state || state.ended) return;
    state.ended = true;
    G._battleActive = false;
    if(state.options.training){
      playSfx('victory');
      const callback = state.options.onVictory;
      const enemy = state.enemy;
      // 训练战斗的回调不应依赖已结束的 battle state，避免胜利画面锁死。
      state = null;
      if(typeof callback === 'function') setTimeout(() => callback(enemy, []), 40);
      return;
    }
    G.battleStats = G.battleStats || { wins:0, losses:0, kills:0 };
    G.battleStats.wins++;
    if(!state.enemy.isNpc && state.options.countKill !== false) G.battleStats.kills++;
    if(state.enemy.isBoss){
      G._bossKills = (G._bossKills || 0) + 1;
      if(state.options.finalBoss || /abyss_lord|深渊之主/.test(state.enemy.id + state.enemy.name)) G._bossKilled = true;
    }
    const event = state.options.event;
    // 魂环事件只有在吸收成功后才算完成；失败时必须保留待猎状态。
    if(event && !event.ring && (event.unique || event._chain || event._dynamic || event.id === 'final_evil') && !G.doneEvents.includes(event.id)) G.doneEvents.push(event.id);
    let gains = [];
    let rewardExp = 0;
    let rewardGold = 0;
    const levelBefore = G.level;
    // ★ 使用累计经验公式计算总经验，确保跨等级时计算正确
    const cumulativeExp = (level, exp) => {
      let total = exp;
      for(let i = 1; i < level; i++){
        total += Math.round(40 * Math.pow(Math.max(1, i), 1.15));
      }
      return total;
    };
    const expBefore = cumulativeExp(G.level, G.exp);
    // 魂环的战斗奖励由 resolveRingAbsorption 在吸收成功后统一结算，避免战斗胜利和吸收回调各发一次。
    if(state.options.result && !state.options.deferResult && typeof applyResultRewards === 'function'){
      const reward = applyResultRewards(state.options.result);
      gains = reward.list;
      rewardExp += reward.exp;
      rewardGold += reward.gold;
    }
    if(state.enemy.exp && !state.options.result){
      const reward = applyResultRewards({ exp:state.enemy.exp, gold:state.enemy.gold || 0 });
      gains.push(...reward.list);
      rewardExp += reward.exp;
      rewardGold += reward.gold;
    }
    let totalExp = rewardExp;
    const boneDrop = maybeDropBone();
    if(boneDrop) gains.push(boneDrop);
    if(typeof completeWorldAction === 'function') completeWorldAction();
    if(typeof addDiaryEntry === 'function') addDiaryEntry(`战胜了「${state.enemy.name}」。`, 'battle');
    // 先记录 quest/achievement 前的总经验，然后调用它们
    // 注意：expBeforeQA 在战斗奖励结算之后取值，因此差值即为任务/成就新增经验
    const expBeforeQA = cumulativeExp(G.level, G.exp);
    if(typeof checkQuests === 'function') checkQuests();
    if(typeof checkAchievements === 'function') checkAchievements();
    const expAfterQA = cumulativeExp(G.level, G.exp);
    const qaExp = expAfterQA - expBeforeQA;
    if(qaExp > 0){
      gains.push(`任务/成就经验+${qaExp}`);
      totalExp += qaExp;
      rewardExp += qaExp;
    }
    // 如果总经验变化与显式记录不符，补一条汇总
    const expAfter = cumulativeExp(G.level, G.exp);
    const actualTotal = expAfter - expBefore;
    if(actualTotal !== totalExp && actualTotal > 0){
      gains.push(`其他经验+${actualTotal - totalExp}`);
      totalExp = actualTotal;
      rewardExp = actualTotal;
    }
    saveLocal();
    refreshPanel();
    const onVictory = state.options.onVictory;
    const enemy = state.enemy;
    if(typeof AudioFX !== 'undefined'){ AudioFX.playSfx('victory'); AudioFX.setMood('academy'); }
    if(typeof onVictory === 'function'){
      // 正式事件战斗的后续可能是魂环吸收、NPC结算或剧情推进。
      // 回调前清理已结束的战斗状态，避免旧 state 身份检查导致回调被静默跳过。
      state = null;
      try{
        onVictory(enemy, gains);
      }catch(error){
        console.error('战斗胜利后续处理失败:', error);
        const area = document.getElementById('scene-area');
        if(area){
          area.innerHTML = `<div class="battle-result victory"><div class="battle-result-title">战斗胜利</div><div class="battle-result-text">你击败了${fmt(enemy.name)}，后续奖励正在重新整理。</div><button class="choice-btn" id="btn-battle-continue"><span class="ck">▶</span>继续冒险</button></div>`;
          const button = document.getElementById('btn-battle-continue');
          if(button) button.addEventListener('click', () => renderContinue(null, `你战胜了${fmt(enemy.name)}，请继续前行。`));
        }
      }
      return;
    }
    const resultText = state.options.result && state.options.result.text
      ? safeRichText(state.options.result.text)
      : `你击败了${enemy.name}。`;
    const levelAfter = G.level;
    const levelText = levelAfter > levelBefore ? `（Lv.${levelBefore} → Lv.${levelAfter}）` : '';
    const overflowExp = Number(G.overflowExp) || 0;
    const gainsDetail = gains.length ? `<br><span class="hl-gold">${gains.join('　')}</span>` : '';
    const totals = [];
    if(totalExp > 0) totals.push(`经验+${totalExp}${levelText}`);
    if(rewardGold > 0) totals.push(`金币+${rewardGold}`);
    const totalDetail = totals.length ? `<br><span class="hl-gold">奖励总计：${totals.join('，')}${overflowExp > 0 ? `，溢出经验+${overflowExp}（达到魂环门槛后释放）` : ''}</span>` : '';
    renderEnd('战斗胜利', `${resultText}${gainsDetail}${totalDetail}`, 'victory');
  }

  function finishDefeat(){
    if(!state || state.ended) return;
    state.ended = true;
    G._battleActive = false;
    G.battleStats = G.battleStats || { wins:0, losses:0, kills:0 };
    G.battleStats.losses++;
    G.hp = Math.max(1, Math.round(finalStats().maxHp * 0.3));
    state.combo = 0;
    if(typeof completeWorldAction === 'function') completeWorldAction();
    const failedEvent = state.options.event;
    if(failedEvent && failedEvent._mainStory) G._storyMilestoneDeferredUntil = (G._eventCount || 0) + 2;
    if(typeof addDiaryEntry === 'function') addDiaryEntry(`与「${state.enemy.name}」交战失败，休整后重新出发。`, 'battle');
    if(typeof checkAchievements === 'function') checkAchievements();
    saveLocal();
    refreshPanel();
    const onDefeat = state.options.onDefeat;
    if(typeof AudioFX !== 'undefined'){ AudioFX.playSfx('defeat'); AudioFX.setMood('academy'); }
    if(typeof onDefeat === 'function'){
      const current = state;
      setTimeout(() => { if(state === current) onDefeat(state.enemy); }, 80);
      return;
    }
    renderEnd('战斗失败', `你没能战胜${state.enemy.name}。同伴将你带到安全处，生命恢复至30%。`, 'defeat');
  }

  function renderEnd(title, text, type){
    const area = document.getElementById('scene-area');
    if(!area || !state) return;
    const event = state.options.event;
    area.innerHTML = `<div class="battle-result ${type}">
      <div class="battle-result-title">${title}</div>
      <div class="battle-result-text">${text}</div>
      <button class="choice-btn" id="btn-battle-continue"><span class="ck">▶</span>继续冒险</button>
    </div>`;
    if(typeof AudioFX !== 'undefined') AudioFX.setMood('academy');
    const button = document.getElementById('btn-battle-continue');
    if(button) button.addEventListener('click', () => {
      const message = type === 'victory' ? `你战胜了${state.enemy.name}，稍作休整后继续前行。` :
        (type === 'escape' ? '你摆脱追击，重新踏上旅程。' : '你养好伤势，决定变强后再来挑战。');
      renderContinue(event || null, message);
    });
  }

  function toggleAuto(){
    if(!state || state.ended) return;
    state.auto = !state.auto;
    render();
  }

  function cycleSpeed(){
    if(!state || state.ended) return;
    state.speed = state.speed === 1 ? 2 : (state.speed === 2 ? 3 : 1);
    render();
  }

  function autoAction(){
    if(!state || state.ended || !state.auto || state.turn !== 'player' || state.busy) return;
    const token = state.token;
    setTimeout(() => {
      if(!state || state.token !== token || state.ended || !state.auto || state.turn !== 'player') return;
      const skills = G.skills || [];
      const usable = skills.map((skill, index) => ({ skill, index })).filter(({ skill, index }) => {
        const cost = Math.max(1, Math.round((skill.cost || 15) * (1 - ((G._skillBonuses || {}).mpCostReduction || 0))));
        return G.spiritPower >= cost && !(state.cooldowns[index] > 0);
      });
      const lowHp = G.hp < finalStats().maxHp * 0.38;
      const healing = usable.find(({ skill }) => /治疗|恢复|回春|甘露/.test((skill.type || '') + (skill.desc || '')));
      if(lowHp && healing) performSkill(healing.index);
      else if(usable.length) performSkill(usable[usable.length - 1].index);
      else performAttack();
    }, delayMs());
  }

  function render(){
    const area = document.getElementById('scene-area');
    if(!area || !state) return;
    const fs = finalStats();
    const feedback = state.feedback; state.feedback = null;
    const phaseNotice = state.phaseNotice; state.phaseNotice = '';
    const playerHpPct = clamp(G.hp / fs.maxHp * 100, 0, 100);
    const enemyHpPct = clamp(state.enemy.hp / state.enemy.maxHp * 100, 0, 100);
    const mpMax = playerMaxSpirit();
    const mpPct = clamp(G.spiritPower / mpMax * 100, 0, 100);
    const playerElement = normalizeElement(getSpiritElement());
    const enemyElement = state.enemy.element;
    const skills = (G.skills || []).map((skill, index) => {
      const sb = G._skillBonuses || {};
      const cost = Math.max(1, Math.round((skill.cost || 15) * (1 - (sb.mpCostReduction || 0))));
      const cooldown = state.cooldowns[index] || 0;
      const disabled = state.turn !== 'player' || state.ended || state.busy || cooldown > 0 || G.spiritPower < cost;
      const element = skillElement(index, skill);
      return `<button class="battle-action skill" data-battle-skill="${index}" ${disabled ? 'disabled' : ''}>
        <span>${ELEMENT_ICONS[element]} ${skill.name}</span><small>${cooldown ? `冷却${cooldown}` : `${cost}魂力`}</small>
      </button>`;
    }).join('');
    const usableItems = (G.inventory || []).map((item, index) => ({ item, index })).filter(({ item }) => item.count > 0 && ['heal','healFull','mp','buffAtk','buffDef','buffSpd','cure','cureAll'].includes(item.type));
    const items = state.showItems ? `<div class="battle-items">${usableItems.length ? usableItems.map(({ item, index }) =>
      `<button class="battle-item" data-battle-item="${index}">${item.name} ×${item.count}</button>`).join('') : '<span>没有可在战斗中使用的道具</span>'}</div>` : '';
    const image = state.enemy.image ? `<img src="${esc(state.enemy.image)}" alt="${esc(state.enemy.name)}" onerror="this.style.display='none'">` : `<span>${state.enemy.icon}</span>`;
    const feedbackFor = target => feedback && feedback.target === target ? `<div class="battle-float ${feedback.type}">${esc(feedback.text)}</div>` : '';
    area.innerHTML = `<div class="battle-shell ${animationsEnabled() ? '' : 'no-motion'}">
      ${feedback && feedback.skillName ? `<div class="battle-skill-banner">${esc(feedback.skillName)}</div>` : ''}${phaseNotice ? `<div class="battle-phase-banner">${esc(phaseNotice)}</div>` : ''}
      <div class="battle-heading">
        <span>第 ${state.round} 回合</span>
        <strong>${state.enemy.isBoss ? 'BOSS 战' : '正式战斗'}</strong>
        <div><button class="battle-mini ${state.auto ? 'active' : ''}" id="btn-battle-auto">自动</button><button class="battle-mini" id="btn-battle-speed">${state.speed}×</button></div>
      </div>
      <div class="battle-fighters">
        <div class="battle-fighter player ${feedback && feedback.actor === 'player' ? 'acting' : ''} ${feedback && feedback.target === 'player' ? 'hit' : ''}">
          ${feedbackFor('player')}<div class="battle-fighter-name">${esc(G.name)} <span>${ELEMENT_ICONS[playerElement]}${ELEMENT_NAMES[playerElement]}</span></div>
          <div class="battle-avatar">${G.spirit && G.spirit.image ? `<img src="${esc(G.spirit.image)}" alt="">` : esc((G.spirit && G.spirit.icon) || '✦')}</div>
          <div class="battle-bar hp"><i style="width:${playerHpPct}%"></i></div><div class="battle-value">生命 ${Math.max(0, Math.round(G.hp))}/${fs.maxHp}</div>
          <div class="battle-bar mp"><i style="width:${mpPct}%"></i></div><div class="battle-value">魂力 ${Math.round(G.spiritPower)}/${mpMax}</div>
          <div class="battle-statuses">${statusHtml(state.playerStatuses)}</div>
        </div>
        <div class="battle-versus"><span>VS</span><b>${state.combo} 连击</b></div>
        <div class="battle-fighter enemy ${state.enemy.isBoss ? 'boss' : ''} ${feedback && feedback.actor === 'enemy' ? 'acting' : ''} ${feedback && feedback.target === 'enemy' ? 'hit' : ''}">
          ${feedbackFor('enemy')}<div class="battle-fighter-name">${esc(state.enemy.name)} <span>${ELEMENT_ICONS[enemyElement]}${ELEMENT_NAMES[enemyElement]}</span></div>
          <div class="battle-avatar">${image}</div>
          <div class="battle-bar hp enemy"><i style="width:${enemyHpPct}%"></i></div><div class="battle-value">生命 ${Math.max(0, Math.round(state.enemy.hp))}/${state.enemy.maxHp}</div>
          <div class="battle-meta">攻 ${state.enemy.attack} · 防 ${state.enemy.defense} · 速 ${state.enemy.speed}${state.enemy.isBoss ? ` · 阶段${state.bossPhase}` : ''}</div>
          <div class="battle-statuses">${statusHtml(state.enemyStatuses)}</div>
        </div>
      </div>
      <div class="battle-log">${state.logs.map(log => `<div class="${log.type}">${esc(log.text)}</div>`).join('')}</div>
      <div class="battle-actions">
        <button class="battle-action primary" id="btn-battle-attack" ${state.turn !== 'player' || state.ended || state.busy ? 'disabled' : ''}>普通攻击</button>
        ${skills}
        <button class="battle-action" id="btn-battle-fusion" ${state.turn !== 'player' || state.ended || state.busy || state.fusionUsed || (G.rings || []).length < 3 ? 'disabled' : ''} title="${(G.rings || []).length < 3 ? '至少获得三个魂环后才能施展武魂融合' : '武魂融合：40魂力，高额伤害并获得护盾'}">武魂融合<small>${state.fusionUsed ? '本场已使用' : ((G.rings || []).length < 3 ? '需≥3魂环' : '40魂力')}</small></button>
        <button class="battle-action" id="btn-battle-defend" ${state.turn !== 'player' || state.ended || state.busy ? 'disabled' : ''}>防御</button>
        <button class="battle-action" id="btn-battle-item" ${state.turn !== 'player' || state.ended || state.busy ? 'disabled' : ''}>道具</button>
        <button class="battle-action danger" id="btn-battle-flee" ${state.turn !== 'player' || state.ended || state.busy || state.enemy.isBoss || state.options.allowFlee === false ? 'disabled' : ''}>逃跑</button>
      </div>${items}
    </div>`;
    const attack = document.getElementById('btn-battle-attack');
    const fusion = document.getElementById('btn-battle-fusion');
    const defend = document.getElementById('btn-battle-defend');
    const item = document.getElementById('btn-battle-item');
    const flee = document.getElementById('btn-battle-flee');
    const auto = document.getElementById('btn-battle-auto');
    const speed = document.getElementById('btn-battle-speed');
    if(attack) attack.addEventListener('click', performAttack);
    if(fusion) fusion.addEventListener('click', performFusion);
    if(defend) defend.addEventListener('click', performDefend);
    if(item) item.addEventListener('click', showItems);
    if(flee) flee.addEventListener('click', attemptFlee);
    if(auto) auto.addEventListener('click', toggleAuto);
    if(speed) speed.addEventListener('click', cycleSpeed);
    area.querySelectorAll('[data-battle-skill]').forEach(button => button.addEventListener('click', () => performSkill(Number(button.dataset.battleSkill))));
    area.querySelectorAll('[data-battle-item]').forEach(button => button.addEventListener('click', () => useItem(Number(button.dataset.battleItem))));
    autoAction();
  }

  function start(enemy, options){
    const normalized = normalizeEnemy(enemy);
    const token = ++battleToken;
    const fs = finalStats();
    G.hp = clamp(Number(G.hp) || fs.maxHp, 1, fs.maxHp);
    G.spiritPower = clamp(Number(G.spiritPower) || 0, 0, playerMaxSpirit());
    G._battleActive = true;
    state = {
      token,
      enemy:normalized,
      options:options || {},
      round:1,
      turn:'player',
      logs:[],
      combo:0,
      cooldowns:(G.skills || []).map(() => 0),
      playerStatuses:[],
      enemyStatuses:[],
      defending:false,
      busy:false,
      ended:false,
      auto:false,
      speed:(() => { try{ const pref = localStorage.getItem('dldl_battle_animation'); return pref === 'minimal' ? 3 : (pref === 'fast' ? 2 : 1); }catch(e){ return 1; } })(),
      showItems:false,
      bossPhase:1,
      lastStandUsed:false,
      limitBreakUsed:false,
      lastFinisherCombo:0,
      lastSkillElement:'none',
      fusionUsed:false,
      feedback:null,
      phaseNotice:''
    };
    const sb = G._skillBonuses || {};
    const formation = getActiveFormation();
    if(formation && formation.id !== 'none'){
      if(!G._formationsUsed) G._formationsUsed = [];
      if(!G._formationsUsed.includes(formation.id)) G._formationsUsed.push(formation.id);
    }
    if(sb.regen) addStatus(state.playerStatuses, 'regen', 99, sb.regen);
    if(G._tempAtkBuff){ addStatus(state.playerStatuses, 'rage', 3, G._tempAtkBuff); G._tempAtkBuff = 0; }
    if(G._tempDefBuff){ addStatus(state.playerStatuses, 'shield', 3, G._tempDefBuff); G._tempDefBuff = 0; }
    if(G._tempSpdBuff){ addStatus(state.playerStatuses, 'haste', 3, G._tempSpdBuff); G._tempSpdBuff = 0; }
    if(typeof refreshPanel === 'function') refreshPanel();
    addLog(`${normalized.name}出现了！战斗开始。`, normalized.isBoss ? 'boss' : 'normal');
    if(normalized.speed > fs.speed && !sb.firstStrike){
      state.turn = 'enemy';
      addLog(`${normalized.name}速度更快，抢先发动攻击。`, 'warning');
      render();
      setTimeout(() => { if(state && state.token === token && !state.ended) enemyAction(); }, delayMs());
    }else{
      render();
    }
    if(typeof AudioFX !== 'undefined') AudioFX.setMood(normalized.isBoss ? 'boss' : 'battle');
    return state;
  }

  function startEventBattle(event, result){
    const enemy = buildEnemy(result.battle);
    return start(enemy, {
      event,
      result,
      finalBoss:event && event.id === 'final_evil',
      deferResult:Boolean(event && event.ring),
      allowFlee:!(event && event.id === 'final_evil')
    });
  }

  function isActive(){ return Boolean(state && !state.ended); }
  function getState(){ return state; }
  function cancelTraining(){
    if(!state || !state.options || !state.options.training) return false;
    state.ended = true; G._battleActive = false; state = null; return true;
  }

  return {
    start,
    startEventBattle,
    isActive,
    getState,
    cancelTraining,
    performAttack,
    performSkill,
    performDefend,
    useItem,
    attemptFlee,
    enemyAction,
    toggleAuto,
    cycleSpeed,
    normalizeElement,
    elementMultiplier
  };
})();

if(typeof module === 'object' && module.exports) module.exports = BattleSystem;
