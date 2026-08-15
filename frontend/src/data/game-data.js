/**
 * 斗罗大陆·武魂觉醒 —— 剧情与静态数据（纯逻辑层）
 * 从 game-data.js 迁移为 ES 模块，数据 100% 不变。
 * 约定：文本中 {name}=主角名 {spirit}=武魂名
 * 选项: text/cond/cost/result{ text,exp,gold,hp,heal,damage,maxHp,mp,attack,defense,speed,fate,item,evolve,spiritPowerGain,battle,next }
 * 兼容规则：hp 仅表示当前生命变化；新内容优先使用 heal、damage、maxHp 明确区分语义。
 * 事件: id,name,location,phase,unique,weight,minLevel,ring,text[],choices[]
 */
export const ORIGINS = [
  {
    id: 'star_forest', name: '星斗小村', fullName: '星斗大森林外围旁的小村庄',
    desc: '你从小在森林边长大，听惯了魂兽的吼声，也练就了一身结实的筋骨。',
    bonus: '属性均衡，样样都不差',
    image: 'assets/scenes/forest_outer.jpg',
    stats: { attack: 2, defense: 2, hp: 20, speed: 2 }, spiritPower: 10
  },
  {
    id: 'spirit_city', name: '武魂城世家', fullName: '武魂城世家子弟',
    desc: '你出生在魂师世家，从小喝着灵药汤长大，魂力比同龄人浑厚得多。',
    bonus: '初始魂力高，更容易觉醒强大的武魂',
    image: 'assets/scenes/wuhun_city.jpg',
    stats: { attack: 3, defense: 1, hp: 10, speed: 1 }, spiritPower: 18, qualityBoost: true
  },
  {
    id: 'border_town', name: '边境小城', fullName: '天斗帝国边境小城',
    desc: '边境常有魂兽出没，你跟着守城的叔叔学过几招，手里还有一把称手的铁剑。',
    bonus: '开局获得武器「铁剑」（攻击+5）',
    image: 'assets/scenes/border_town.jpg',
    stats: { attack: 5, defense: 1, hp: 10, speed: 1 }, spiritPower: 10,
    weapon: { name: '铁剑', attack: 5 }
  },
  {
    id: 'sea_island', name: '海神岛渔村', fullName: '海神岛渔村',
    desc: '你在海边的渔村长大，从小追风逐浪，身子像鱼一样灵活。',
    bonus: '速度出众，天生亲水',
    image: 'assets/scenes/sea_god_island.jpg',
    stats: { attack: 1, defense: 1, hp: 10, speed: 6 }, spiritPower: 10
  }
];

// ==================== 技能树系统 ====================
export const SKILL_TREE = {
  // 强攻分支
  offense: {
    name: '强攻之道', color: '#d06a5a', icon: '⚔',
    nodes: [
      { id:'off1', name:'力量觉醒', desc:'攻击力+10%', cost:1, req:[], effect:{attackMult:0.10} },
      { id:'off2', name:'破甲一击', desc:'攻击无视10%防御', cost:1, req:['off1'], effect:{defPenetration:0.10} },
      { id:'off3', name:'狂战之血', desc:'攻击力+20%，暴击率+5%', cost:2, req:['off2'], effect:{attackMult:0.20, critRate:0.05} },
      { id:'off4', name:'致命精通', desc:'暴击伤害+50%', cost:2, req:['off3'], effect:{critDmg:0.50} },
      { id:'off5', name:'武魂真身', desc:'攻击力+30%，每次攻击附加元素状态', cost:3, req:['off4'], effect:{attackMult:0.30, alwaysStatus:true} }
    ]
  },
  // 防御分支
  defense: {
    name: '坚韧之道', color: '#5a8fc4', icon: '🛡',
    nodes: [
      { id:'def1', name:'铜皮铁骨', desc:'防御力+15%', cost:1, req:[], effect:{defenseMult:0.15} },
      { id:'def2', name:'生命涌泉', desc:'最大生命+15%', cost:1, req:['def1'], effect:{hpMult:0.15} },
      { id:'def3', name:'不动如山', desc:'受到暴击概率-15%，防御+20%', cost:2, req:['def2'], effect:{defenseMult:0.20, antiCrit:0.15} },
      { id:'def4', name:'自愈之力', desc:'每回合恢复5%生命', cost:2, req:['def3'], effect:{regen:0.05} },
      { id:'def5', name:'金身不灭', desc:'受到致命伤害时存活(每场1次)', cost:3, req:['def4'], effect:{lastStand:true} }
    ]
  },
  // 灵巧分支
  agility: {
    name: '灵巧之道', color: '#88ddaa', icon: '💨',
    nodes: [
      { id:'agi1', name:'风之足迹', desc:'速度+15%', cost:1, req:[], effect:{speedMult:0.15} },
      { id:'agi2', name:'连环打击', desc:'连击伤害加成+20%', cost:1, req:['agi1'], effect:{comboBonus:0.20} },
      { id:'agi3', name:'影分身', desc:'有15%概率额外攻击一次', cost:2, req:['agi2'], effect:{extraAttack:0.15} },
      { id:'agi4', name:'闪避大师', desc:'有15%概率闪避敌方攻击', cost:2, req:['agi3'], effect:{dodge:0.15} },
      { id:'agi5', name:'神行百变', desc:'速度+25%，先手攻击', cost:3, req:['agi4'], effect:{speedMult:0.25, firstStrike:true} }
    ]
  },
  // 魂力分支
  spirit: {
    name: '魂力之道', color: '#c9a84c', icon: '✦',
    nodes: [
      { id:'spi1', name:'魂力充沛', desc:'最大魂力+20%', cost:1, req:[], effect:{mpMult:0.20} },
      { id:'spi2', name:'魂力回收', desc:'攻击时恢复5点魂力', cost:1, req:['spi1'], effect:{mpRecovery:5} },
      { id:'spi3', name:'技能强化', desc:'技能伤害+25%', cost:2, req:['spi2'], effect:{skillDmgBonus:0.25} },
      { id:'spi4', name:'冷却缩减', desc:'技能冷却-1回合', cost:2, req:['spi3'], effect:{cdReduction:1} },
      { id:'spi5', name:'武魂共鸣', desc:'技能伤害+40%，魂力消耗-30%', cost:3, req:['spi4'], effect:{skillDmgBonus:0.40, mpCostReduction:0.30} }
    ]
  }
};

// 每5级获得2点，Lv.90后可完成整棵技能树；成就仍提供额外成长目标。
function getSkillPoints(level){
  return Math.floor(Number(level || 0) / 5) * 2;
}

// 获取已用技能点
function getUsedSkillPoints(tree){
  if(!tree) return 0;
  return Object.entries(tree).reduce((sum, [id, learned]) => {
    if(!learned) return sum;
    for(const branch of Object.values(SKILL_TREE)){
      const node = branch.nodes.find(n => n.id === id);
      if(node) return sum + node.cost;
    }
    return sum;
  }, 0);
}

// ==================== 成就系统 ====================
export const ACHIEVEMENTS = [
  // 战斗成就
  { id:'first_blood', name:'初出茅庐', desc:'赢得第一场战斗', icon:'⚔', cond:G => G.battleStats && G.battleStats.wins >= 1 },
  { id:'win_10', name:'小有名气', desc:'赢得10场战斗', icon:'🏆', cond:G => G.battleStats && G.battleStats.wins >= 10 },
  { id:'win_50', name:'战功赫赫', desc:'赢得50场战斗', icon:'🏅', cond:G => G.battleStats && G.battleStats.wins >= 50 },
  { id:'win_100', name:'百战不殆', desc:'赢得100场战斗', icon:'👑', cond:G => G.battleStats && G.battleStats.wins >= 100 },
  { id:'kill_50', name:'猎魂专家', desc:'猎杀50只魂兽', icon:'🗡', cond:G => G.battleStats && G.battleStats.kills >= 50 },
  // 等级成就
  { id:'lv_10', name:'初入魂师', desc:'达到10级', icon:'⭐', cond:G => G.level >= 10 },
  { id:'lv_30', name:'魂尊', desc:'达到30级', icon:'🌟', cond:G => G.level >= 30 },
  { id:'lv_50', name:'魂王', desc:'达到50级', icon:'💫', cond:G => G.level >= 50 },
  { id:'lv_70', name:'魂圣', desc:'达到70级', icon:'✨', cond:G => G.level >= 70 },
  { id:'lv_90', name:'魂斗罗', desc:'达到90级', icon:'🌠', cond:G => G.level >= 90 },
  { id:'lv_100', name:'封号斗罗', desc:'达到100级', icon:'🏆', cond:G => G.level >= 100 },
  // 魂环成就
  { id:'ring_3', name:'三环魂尊', desc:'获得3个魂环', icon:'🔮', cond:G => G.rings && G.rings.length >= 3 },
  { id:'ring_5', name:'五环魂王', desc:'获得5个魂环', icon:'🔮', cond:G => G.rings && G.rings.length >= 5 },
  { id:'ring_7', name:'七环魂圣', desc:'获得7个魂环', icon:'🔮', cond:G => G.rings && G.rings.length >= 7 },
  { id:'ring_9', name:'九环满阶', desc:'获得全部9个魂环', icon:'🔮', cond:G => G.rings && G.rings.length >= 9 },
  // 财富成就
  { id:'gold_500', name:'小有积蓄', desc:'累计获得500金币', icon:'💰', cond:G => (G._totalGoldEarned || 0) >= 500 },
  { id:'gold_2000', name:'富甲一方', desc:'累计获得2000金币', icon:'💎', cond:G => (G._totalGoldEarned || 0) >= 2000 },
  { id:'gold_5000', name:'财大气粗', desc:'累计获得5000金币', icon:'🏦', cond:G => (G._totalGoldEarned || 0) >= 5000 },
  // 命运成就
  { id:'fate_5', name:'命运之子', desc:'命运值达到5', icon:'🎴', cond:G => G.fatePoints >= 5 },
  { id:'fate_10', name:'天命所归', desc:'命运值达到10', icon:'🃏', cond:G => G.fatePoints >= 10 },
  // 探索成就
  { id:'npc_10', name:'广结善缘', desc:'结识10位人物', icon:'🤝', cond:G => G._metNpcs && G._metNpcs.length >= 10 },
  { id:'npc_20', name:'人脉广阔', desc:'结识20位人物', icon:'👥', cond:G => G._metNpcs && G._metNpcs.length >= 20 },
  { id:'bone_5', name:'魂骨收集者', desc:'获得5块魂骨', icon:'🦴', cond:G => G._bones && G._bones.length >= 5 },
  { id:'loc_10', name:'行万里路', desc:'探索10个地点', icon:'🗺', cond:G => G._visitedLocations && G._visitedLocations.length >= 10 },
  // 特殊成就
  { id:'boss_kill', name:'弑神者', desc:'击败最终Boss', icon:'🗡', cond:G => G._bossKilled === true },
  { id:'no_death', name:'不败传说', desc:'全程未被击败过', icon:'🛡', cond:G => G.battleStats && G.battleStats.losses === 0 && G.battleStats.wins >= 20 },
  { id:'evolve', name:'武魂进化', desc:'武魂成功进化', icon:'🔄', cond:G => G._evolved === true },
  // 挑战塔成就
  { id:'tower_5', name:'塔之新星', desc:'通过挑战塔第5层', icon:'🗼', cond:G => G._towerFloor >= 5 },
  { id:'tower_10', name:'塔之征服者', desc:'通过挑战塔第10层', icon:'🏰', cond:G => G._towerFloor >= 10 },
  { id:'tower_20', name:'二十层之主', desc:'通过挑战塔全部20层', icon:'👑', cond:G => G._towerFloor >= 20 },
  // 锻造成就
  { id:'forge_1', name:'初锻成功', desc:'成功锻造一件魂骨', icon:'🔨', cond:G => G._craftedBones && G._craftedBones.length >= 1 },
  { id:'forge_5', name:'锻造大师', desc:'成功锻造5件魂骨', icon:'⚒', cond:G => G._craftedBones && G._craftedBones.length >= 5 },
  // 日记成就
  { id:'diary_50', name:'笔耕不辍', desc:'冒险日记达到50条', icon:'📖', cond:G => G._diary && G._diary.length >= 50 },
  { id:'diary_100', name:'传记作者', desc:'冒险日记达到100条', icon:'📚', cond:G => G._diary && G._diary.length >= 100 },
  // 签到成就
  { id:'sign_7', name:'勤勉之人', desc:'完成一周签到', icon:'📅', cond:G => G._dailySign && (G._dailySign.maxStreak || G._dailySign.cycleDay || 0) >= 7 },
  // 技能树成就
  { id:'skill_5', name:'初学乍练', desc:'习得5个技能树节点', icon:'🌳', cond:G => G._skillTree && Object.keys(G._skillTree).filter(k => G._skillTree[k]).length >= 5 },
  { id:'skill_15', name:'学有所成', desc:'习得15个技能树节点', icon:'🌿', cond:G => G._skillTree && Object.keys(G._skillTree).filter(k => G._skillTree[k]).length >= 15 },
  { id:'skill_all', name:'武道宗师', desc:'习得全部技能树节点', icon:'🏆', cond:G => G._skillTree && Object.keys(G._skillTree).filter(k => G._skillTree[k]).length >= 20 },
  // 动态事件成就
  { id:'dyn_survivor', name:'绝处逢生', desc:'在濒死状态下触发武魂共鸣', icon:'💀', cond:G => G._dynSurvived === true },
  { id:'dyn_merchant', name:'神秘交易', desc:'遇到神秘商人并购买宝物', icon:'🎁', cond:G => G._dynMerchant === true },
  { id:'dyn_lucky', name:'幸运儿', desc:'发现路边的意外之财', icon:'🍀', cond:G => G._dynLucky === true },
  // 连锁事件成就
  { id:'chained_mentor', name:'师徒之缘', desc:'完成师徒连锁事件线', icon:'🧙', cond:G => G._mentorAccepted === true },
  // 时间/天气成就
  { id:'night_owl', name:'夜猫子', desc:'在夜晚进行修炼', icon:'🌙', cond:G => G._nightTraining === true },
  { id:'storm_chaser', name:'追风者', desc:'在暴雨天气下冒险', icon:'⛈', cond:G => G._stormAdventure === true },
  // 社交成就
  { id:'social_5', name:'人缘极佳', desc:'与5位NPC建立关系', icon:'💬', cond:G => G._npcRelations && Object.keys(G._npcRelations).length >= 5 },
  { id:'social_10', name:'社交达人', desc:'与10位NPC建立关系', icon:'🌟', cond:G => G._npcRelations && Object.keys(G._npcRelations).length >= 10 },
  // 连击成就
  { id:'combo_10', name:'连击新星', desc:'达成10连击', icon:'⚡', cond:G => G._maxCombo >= 10 },
  { id:'combo_20', name:'连击大师', desc:'达成20连击', icon:'🔥', cond:G => G._maxCombo >= 20 },
  // 元素成就
  { id:'element_master', name:'元素使', desc:'使用所有元素类型的技能', icon:'🌈', cond:G => G._usedElements && G._usedElements.length >= 8 },
  // 新战斗系统成就
  { id:'reaction_first', name:'元素共鸣', desc:'首次触发元素反应', icon:'⚛', cond:G => G._reactionTriggered === true },
  { id:'reaction_10', name:'反应链手', desc:'触发10次元素反应', icon:'🔮', cond:G => (G._reactionCount || 0) >= 10 },
  { id:'finisher_5', name:'终结者', desc:'触发连携终结技', icon:'💥', cond:G => G._maxComboFinisher >= 5 },
  { id:'finisher_20', name:'灭世一击', desc:'触发20连击终结技', icon:'☄', cond:G => G._maxComboFinisher >= 20 },
  { id:'fusion_master', name:'人魂合一', desc:'使用武魂融合', icon:'🕉', cond:G => G._fusionUsed === true },
  { id:'formation_master', name:'阵法通晓', desc:'使用过3种不同阵法', icon:'⚔', cond:G => G._formationsUsed && G._formationsUsed.length >= 3 },
  { id:'npc_close', name:'挚友', desc:'与任意NPC达到挚友关系', icon:'💚', cond:G => { if(!G._npcRelations) return false; return Object.values(G._npcRelations).some(v => v >= 200); } },
  { id:'npc_soulmate', name:'生死之交', desc:'与任意NPC达到生死之交', icon:'💛', cond:G => { if(!G._npcRelations) return false; return Object.values(G._npcRelations).some(v => v >= 350); } },
  { id:'npc_spar', name:'切磋精进', desc:'与NPC切磋武艺', icon:'🤺', cond:G => G._npcSparDone === true },
  // 剧情分支成就
  { id:'story_first', name:'命运之手', desc:'做出第一次关键剧情选择', icon:'🛤', cond:G => G._storyPath && G._storyPath.length >= 1 },
  { id:'story_3', name:'抉择之人', desc:'做出3次关键剧情选择', icon:'⚖', cond:G => G._storyPath && G._storyPath.length >= 3 },
  { id:'story_all', name:'命运编织者', desc:'留下6段不同的剧情选择记录', icon:'🌟', cond:G => G._storyDecisions && Object.keys(G._storyDecisions).length >= 6 },
  { id:'story_saint', name:'圣者之心', desc:'在剧情中3次选择仁慈之路', icon:'😇', cond:G => G._storyPath && G._storyPath.filter(p => p === 'saint' || p === 'merciful').length >= 3 },
  { id:'story_dark', name:'暗夜行者', desc:'在剧情中走向黑暗', icon:'🌑', cond:G => G._storyPath && G._storyPath.includes('dark') },
  { id:'story_rebel', name:'叛逆之魂', desc:'在剧情中坚持叛逆道路', icon:'🔥', cond:G => G._storyPath && G._storyPath.includes('rebel') },
  { id:'story_redemption', name:'浪子回头', desc:'在剧情中选择救赎', icon:'🌅', cond:G => G._storyPath && G._storyPath.includes('redemption') },
  // 战力成就
  { id:'power_10k', name:'初露锋芒', desc:'战力达到10000', icon:'💪', cond:G => true }, // 条件在checkAchievements中动态判断
  { id:'power_30k', name:'名震一方', desc:'战力达到30000', icon:'⚔', cond:G => true },
  { id:'power_50k', name:'神级战力', desc:'战力达到50000', icon:'✨', cond:G => true },
  // 探索成就
  { id:'explore_all', name:'足迹遍天下', desc:'探索所有地点', icon:'🗺', cond:G => G._visitedLocations && G._visitedLocations.length >= 20 },
  { id:'hidden_5', name:'秘境探索者', desc:'发现5个隐藏地点', icon:'🔮', cond:G => G._discoveredHidden && G._discoveredHidden.length >= 5 },
  // 锻造成就
  { id:'forge_10', name:'神匠之魂', desc:'成功锻造10件魂骨', icon:'🔨', cond:G => G._craftedBones && G._craftedBones.length >= 10 },
  // 签到成就
  { id:'sign_30', name:'持之以恒', desc:'累计签到30天', icon:'📅', cond:G => G._dailySign && (G._dailySign.totalDays || 0) >= 30 }
];

// ==================== 称号系统 ====================
export const TITLES = [
  { id:'novice', name:'初出茅庐', desc:'刚踏上魂师之路的新人', bonus:{}, cond:G => true },
  { id:'warrior', name:'战场勇士', desc:'赢得10场战斗的魂师', bonus:{ attack:5 }, cond:G => G.battleStats && G.battleStats.wins >= 10 },
  { id:'hunter', name:'猎魂专家', desc:'猎杀20只魂兽的猎人', bonus:{ attack:8, speed:3 }, cond:G => G.battleStats && G.battleStats.kills >= 20 },
  { id:'guardian', name:'守护者', desc:'50场战斗未尝败绩', bonus:{ defense:10, hp:50 }, cond:G => G.battleStats && G.battleStats.wins >= 50 && G.battleStats.losses < 3 },
  { id:'scholar', name:'博学者', desc:'结识15位人物', bonus:{ spiritPowerGain:5 }, cond:G => G._metNpcs && G._metNpcs.length >= 15 },
  { id:'explorer', name:'探险家', desc:'探索15个地点', bonus:{ speed:5, gold:0.1 }, cond:G => G._visitedLocations && G._visitedLocations.length >= 15 },
  { id:'collector', name:'收藏家', desc:'获得10块魂骨', bonus:{ defense:5, hp:30 }, cond:G => G._bones && G._bones.length >= 10 },
  { id:'champion', name:'竞技冠军', desc:'赢得50场战斗', bonus:{ attack:10, defense:5 }, cond:G => G.battleStats && G.battleStats.wins >= 50 },
  { id:'legend', name:'传奇魂师', desc:'达到90级', bonus:{ attack:15, defense:10, hp:100, speed:10 }, cond:G => G.level >= 90 },
  { id:'godslayer', name:'弑神者', desc:'击败最终Boss', bonus:{ attack:20, defense:15, hp:200, speed:15 }, cond:G => G._bossKilled === true },
  { id:'tower_master', name:'塔之主宰', desc:'通过挑战塔10层', bonus:{ attack:12, defense:8, speed:5 }, cond:G => G._towerFloor >= 10 },
  { id:'tower_conqueror', name:'二十层之主', desc:'征服挑战塔全部20层', bonus:{ attack:20, defense:15, hp:120, speed:10 }, cond:G => G._towerFloor >= 20 },
  { id:'forge_master', name:'锻造宗师', desc:'成功锻造5件魂骨', bonus:{ defense:8, hp:50 }, cond:G => G._craftedBones && G._craftedBones.length >= 5 },
  { id:'scholar_master', name:'博学大师', desc:'习得15个技能树节点', bonus:{ attack:8, defense:8, speed:5, hp:50 }, cond:G => G._skillTree && Object.keys(G._skillTree).filter(k => G._skillTree[k]).length >= 15 },
  { id:'diarist', name:'冒险记录者', desc:'冒险日记达到100条', bonus:{ spiritPowerGain:5, gold:0.1 }, cond:G => G._diary && G._diary.length >= 100 },
  { id:'diligent', name:'勤勉魂师', desc:'完成一周签到', bonus:{ hp:30, spiritPowerGain:3 }, cond:G => G._dailySign && (G._dailySign.maxStreak || G._dailySign.cycleDay || 0) >= 7 },
  // 新增称号
  { id:'survivor', name:'绝处逢生', desc:'在濒死状态下触发武魂共鸣', bonus:{ hp:50, defense:5 }, cond:G => G._dynSurvived === true },
  { id:'merchant_friend', name:'商贾之友', desc:'与神秘商人完成交易', bonus:{ gold:0.15 }, cond:G => G._dynMerchant === true },
  { id:'mentor_disciple', name:'师门传人', desc:'拜入神秘老者门下', bonus:{ attack:10, defense:5, spiritPowerGain:5 }, cond:G => G._mentorAccepted === true },
  { id:'night_walker', name:'夜行者', desc:'在夜晚进行修炼', bonus:{ speed:5, spiritPowerGain:3 }, cond:G => G._nightTraining === true },
  { id:'storm_rider', name:'风雨行者', desc:'在暴雨天气下冒险', bonus:{ defense:8, hp:30 }, cond:G => G._stormAdventure === true },
  { id:'social_master', name:'人脉之王', desc:'与10位NPC建立关系', bonus:{ spiritPowerGain:8, gold:0.1 }, cond:G => G._npcRelations && Object.keys(G._npcRelations).length >= 10 },
  { id:'combo_master', name:'连击宗师', desc:'达成20连击', bonus:{ attack:8, speed:8 }, cond:G => G._maxCombo >= 20 },
  { id:'element_sage', name:'元素智者', desc:'使用所有元素类型的技能', bonus:{ attack:5, defense:5, spiritPowerGain:5 }, cond:G => G._usedElements && G._usedElements.length >= 8 },
  { id:'wealth_lord', name:'富甲天下', desc:'拥有50000金币', bonus:{ gold:0.2, defense:5 }, cond:G => G.gold >= 50000 },
  { id:'beast_slayer', name:'万兽之王', desc:'猎杀100只魂兽', bonus:{ attack:15, speed:5 }, cond:G => G.battleStats && G.battleStats.kills >= 100 },
  // 新战斗系统称号
  { id:'reaction_master', name:'元素炼金术士', desc:'触发10次元素反应', bonus:{ attack:8, spiritPowerGain:5 }, cond:G => (G._reactionCount || 0) >= 10 },
  { id:'finisher_master', name:'连携终结者', desc:'触发20连击终结技', bonus:{ attack:12, speed:8 }, cond:G => G._maxComboFinisher >= 20 },
  { id:'fusion_adept', name:'武魂融合者', desc:'使用武魂融合', bonus:{ attack:10, defense:5, hp:50 }, cond:G => G._fusionUsed === true },
  { id:'formation_tactician', name:'阵法军师', desc:'使用过3种不同阵法', bonus:{ attack:5, defense:5, speed:5 }, cond:G => G._formationsUsed && G._formationsUsed.length >= 3 },
  { id:'soul_bonded', name:'魂之羁绊', desc:'与任意NPC达到生死之交', bonus:{ attack:10, defense:8, hp:80, speed:5 }, cond:G => { if(!G._npcRelations) return false; return Object.values(G._npcRelations).some(v => v >= 350); } },
  { id:'sparrior', name:'切磋名家', desc:'与NPC切磋武艺', bonus:{ attack:5, speed:3 }, cond:G => G._npcSparDone === true },
  // 剧情分支称号
  { id:'fate_weaver', name:'命运编织者', desc:'留下6段不同的剧情选择记录', bonus:{ attack:10, defense:8, speed:5, spiritPowerGain:5 }, cond:G => G._storyDecisions && Object.keys(G._storyDecisions).length >= 6 },
  { id:'saint_heart', name:'圣者之心', desc:'在剧情中3次选择仁慈之路', bonus:{ defense:10, hp:80, spiritPowerGain:5 }, cond:G => G._storyPath && G._storyPath.filter(p => p === 'saint' || p === 'merciful').length >= 3 },
  { id:'dark_walker', name:'暗夜行者', desc:'在剧情中走向黑暗', bonus:{ attack:12, speed:5 }, cond:G => G._storyPath && G._storyPath.includes('dark') },
  { id:'redeemed', name:'浪子回头', desc:'在剧情中选择救赎', bonus:{ attack:8, defense:8, hp:60, spiritPowerGain:8 }, cond:G => G._storyPath && G._storyPath.includes('redemption') },
  // 战力称号
  { id:'power_elite', name:'精英魂师', desc:'战力达到10000', bonus:{ attack:5, defense:3 }, cond:G => true },
  { id:'power_epic', name:'史诗强者', desc:'战力达到30000', bonus:{ attack:10, defense:8, speed:5 }, cond:G => true },
  { id:'power_god', name:'神级战力', desc:'战力达到50000', bonus:{ attack:15, defense:12, hp:100, speed:10 }, cond:G => true },
  // 探索称号
  { id:'world_explorer', name:'世界探索者', desc:'探索所有地点', bonus:{ speed:8, gold:0.15, spiritPowerGain:5 }, cond:G => G._visitedLocations && G._visitedLocations.length >= 20 },
  // 锻造称号
  { id:'master_forger', name:'神匠宗师', desc:'成功锻造10件魂骨', bonus:{ defense:10, hp:50, gold:0.1 }, cond:G => G._craftedBones && G._craftedBones.length >= 10 }
];

// ==================== 事件库 ====================
export const EVENTS = [
  // ---------- 学院篇 ----------
  {
    id: 'first_class', name: '第一堂课', location: '史莱克学院·教室',
    phase: 'academy', unique: true, npcIds: ['玉小刚'], weight: 5,
    text: [
      '叮铃铃——上课铃响了。{name}抱着崭新的课本，找了个靠窗的位置坐下。',
      '讲课的是一位头发花白的老教师，大家都叫他"大师"。他在黑板上写下四个大字：武魂之道。',
      '"魂师的强大，不只看武魂，更看心。"大师推了推眼镜，"现在，谁来说说，你想走哪条路？"'
    ],
    choices: [
      { text: '我要成为最强的攻击型魂师！', result: { text: '大师欣慰地点头："好志气！记住，最强的矛，要有最稳的手。"你在笔记本上认真写下这句话。', attack: 2, exp: 30, fate: 1 } },
      { text: '我想保护大家，走防御路线', result: { text: '大师露出笑容："守护之心，最为难得。"你感觉自己的信念更坚定了。', defense: 2, exp: 30, fate: 1 } },
      { text: '速度才是王道，天下武功唯快不破！', result: { text: '"小鬼头，倒是机灵。"大师哈哈大笑，教室里也跟着笑成一片。', speed: 2, exp: 30 } },
      { text: '我……我还没想好', result: { text: '"诚实也是美德。"大师温和地说，"慢慢找，属于你的路总会出现。"', hp: 15, exp: 40, fate: 1 } }
    ]
  },
  {
    id: 'cafeteria_funny', name: '食堂大作战', location: '史莱克学院·食堂',
    phase: 'academy', weight: 3,
    text: [
      '中午的食堂人山人海，红烧肉的香味飘出三条街。{name}端着餐盘左冲右突，终于抢到了最后一份红烧肉！',
      '刚要下筷子，一个胖乎乎的高年级学长笑眯眯地凑了过来："小学弟，这块肉，让给我怎么样？"'
    ],
    choices: [
      { text: '护住餐盘：先来后到，这是我的！', cond: { attack: 12 }, result: { text: '你瞪大眼睛护住餐盘，气势居然把学长镇住了。"行啊小家伙，有骨气！"学长哈哈大笑着走了。红烧肉真香！', attack: 1, hp: 10, exp: 25, fate: 1 } },
      { text: '分他一半，交个朋友', result: { text: '学长感动得差点哭出来："以后在学院，谁欺负你就报我胖虎的名字！"他塞给你一把亮晶晶的金币。', gold: 50, exp: 20, fate: 1 } },
      { text: '趁他不注意，三口吃光！', cond: { speed: 10 }, result: { text: '你以迅雷不及掩耳之势把肉塞进嘴里，腮帮子鼓得像小松鼠。学长目瞪口呆，半天憋出一句："……好快的嘴。"', speed: 1, exp: 25 } },
      { text: '算了，让给他吧', result: { text: '你咽着口水把肉让了出去。没想到大师正好路过，看在眼里，第二天特意给你带了一份更大的红烧肉！', exp: 35, fate: 2 } }
    ]
  },
  {
    id: 'playground_spar', name: '操场对练', location: '史莱克学院·操场',
    phase: 'academy', weight: 3,
    text: [
      '午后的操场热闹非凡。一个叫唐三的同学正与大家切磋对练，他动作行云流水，看得你眼花缭乱。',
      '"{name}，来试试吧。"唐三笑着把木剑递给你，"别怕，点到为止。"'
    ],
    choices: [
      { text: '全力以赴，正面进攻！', result: { text: '你使出浑身解数冲了上去，虽然三招就被学长轻轻放倒，但唐三扶起你说："这股冲劲，将来必成大器。"', attack: 2, exp: 40, damage:10 } },
      { text: '仔细观察，寻找破绽再出手', cond: { speed: 11 }, result: { text: '你绕着学长转了十几圈，终于抓到一瞬间的空档一剑刺出——被挡下了，但唐三眼睛一亮："好眼力！"', speed: 2, exp: 45, fate: 1 } },
      { text: '请教发力的诀窍', result: { text: '唐三耐心地给你演示了整整一个下午，你感觉浑身经脉都通畅了许多。', spiritPowerGain: 4, exp: 35, attack: 1 } },
      { text: '今天状态不好，下次吧', result: { text: '你坐在场边看完了整场对练，也学到了不少东西。只是手心有点痒痒的。', exp: 15 } }
    ]
  },
  {
    id: 'library_night', name: '图书馆的夜灯', location: '史莱克学院·图书馆',
    phase: 'academy', weight: 2,
    text: [
      '夜深了，图书馆里只剩{name}一个人。昏黄的灯光下，一本厚厚的《武魂百科》摊开在桌上。',
      '窗外忽然刮起一阵风，书页哗啦啦地翻动，停在了记载着"武魂进化"的那一页。'
    ],
    choices: [
      { text: '挑灯夜读，把这一章背下来', result: { text: '你读到东方既白，脑袋里装满了知识。原来武魂还能进化！你默默记下了所有要点。', exp: 45, spiritPowerGain: 3 } },
      { text: '困了，趴在桌上小睡一会儿', result: { text: '你做了一个梦，梦见自己的{spirit}闪闪发光。醒来时神清气爽，书上的内容竟然也记住了一大半！', hp: 20, mp: 10, exp: 25 } }
    ]
  },
  {
    id: 'senior_rumor', name: '学长的小道消息', location: '史莱克学院·宿舍',
    phase: 'academy', weight: 2,
    text: [
      '熄灯后，上铺的学长神秘兮兮地探下头来："喂，{name}，听说了吗？学院后山的山洞里，藏着以前学长留下的宝贝！"',
      '"不过……"他压低声音，"那里晚上好像有蛇出没。"'
    ],
    choices: [
      { text: '明天就去探宝！', result: { text: '你在山洞深处摸到一个锈迹斑斑的铁盒，里面居然有三枚回魂丹！至于蛇……还好你只踩到了一截像蛇的枯藤。', item: { name: '回魂丹', type: 'heal', value: 60, count: 3 }, exp: 30, fate: 1 } },
      { text: '太危险了，还是好好睡觉', result: { text: '你裹紧小被子美美睡了一觉。第二天听说去探宝的学长被一条花蛇追得满山跑，你暗自庆幸。', hp: 15, exp: 15 } },
      { text: '报告老师，让大人去处理', result: { text: '大师夸你懂事，奖励了你一笔奖学金。学长气得直翻白眼，但也拿你没办法。', gold: 80, exp: 20, fate: 1 } }
    ]
  },
  {
    id: 'first_hunt', name: '第一次魂兽实战', location: '星斗大森林外围',
    phase: 'academy', unique: true, minLevel: 5, weight: 5,
    text: [
      '大师带着你们来到星斗大森林外围："今天的实践课——猎杀一只十年魂兽，记住，这是实战训练，不是正式猎环！"',
      '大师提醒你：实战训练与正式猎环是两条不同流程，吸收资格必须按当前等级和已有魂环判断。',
      '灌木丛沙沙作响，一只灰黑色的独眼狼踱了出来，幽绿的独眼在树荫下闪着光。',
      '{name}握紧了拳头，心跳得像打鼓。这是你第一次真正面对魂兽！'
    ],
    image: 'assets/beasts/独眼狼.jpg',
    choices: [
      { text: '鼓起勇气，冲在最前面！', cond: { attack: 14 }, result: { text: '你大吼一声冲了出去，{spirit}的光芒照亮了林间！', battle: 'one_eye_wolf', exp: 60, fate: 1 } },
      { text: '和队友配合，稳扎稳打', result: { text: '你们摆开阵型，有人佯攻有人包抄。独眼狼左支右绌，最终被你们合力制服。团队的胜利！', exp: 55, defense: 1 } },
      { text: '有点害怕，跟在后面捡漏', result: { text: '你紧张地跟在队尾，关键时刻补上了最后一击！虽然有点不好意思，但大师说："懂得审时度势，也是本事。"', exp: 40, damage:5 } }
    ]
  },
  {
    id: 'reach_lv10', name: '修炼之途', location: '史莱克学院',
    phase: 'academy', unique: true, minLevel: 5, weight: 5,
    text: [
      '实战训练结束，大师拍着你的肩膀："干得不错！不过真正的猎环之旅才刚刚开始。"',
      '"魂师每提升一个大阶，就能获取一个魂环。你的第一魂环在 Lv.10 时解锁，到时候我亲自带你去猎杀合适的魂兽。"',
      '你现在需要做的就是专注修炼，提升魂力至 Lv.10。届时不仅可以获得第一魂环，还能正式成为一名魂师！'
    ],
    choices: [
      { text: '潜心修炼，冲击 Lv.10', result: { text: '你暗下决心，要在最短时间内突破 Lv.10。每天的修炼计划排得满满当当，大师看在眼里，露出了欣慰的笑容。', exp: 40, fate: 1 } },
      { text: '请教大师修炼心得', result: { text: '大师详细讲解了魂力运转的技巧，你茅塞顿开，感觉修炼之路清晰了许多。"记住，厚积薄发，稳扎稳打。"', exp: 50, fate: 1 } },
      { text: '先休息一天，劳逸结合', result: { text: '你好好休息了一晚，第二天精神饱满，修炼效率反而更高了。', exp: 30, hp: 30 } }
    ]
  },
  {
    id: 'exam_week', name: '期末大考', location: '史莱克学院·考场',
    phase: 'academy', weight: 2,
    text: [
      '期末考试来了！笔试考《魂兽图鉴》和《魂师守则》，{name}握着笔，手心里全是汗。',
      '第一题：十年魂兽的魂环是什么颜色？这题你会！可是第二题……人面魔蛛有几条腿？！'
    ],
    choices: [
      { text: '认真作答，相信自己的积累', result: { text: '你行云流水地答完整张卷子，居然考了全班第三！大师奖励了你一颗聚魂丹。', item: { name: '聚魂丹', type: 'mp', value: 40, count: 1 }, exp: 50, fate: 1 } },
      { text: '偷瞄一眼同桌的答案', result: { text: '你刚歪过头，就撞上了大师严厉的目光……"作弊，扣十分，放学后留下扫地。"呜呜，早知道就自己写了。', exp: 10, fate: -1 } },
      { text: '不会的全写"老师你真好看"', result: { text: '阅卷的大师哭笑不得，在卷子上批道："嘴甜，但不能当魂力用。下次努力。"居然也给了辛苦分。', exp: 25 } }
    ]
  },
  {
    id: 'forest_trip', name: '森林边缘的历练', location: '星斗大森林外围',
    phase: 'academy', weight: 3,
    text: [
      '周末，{name}独自来到森林外围历练。阳光透过层层叠叠的树叶，在地上洒下斑驳的光点。',
      '忽然，前方的草丛剧烈晃动起来——一只花蛇吐着信子滑了出来，斑斓的鳞片在阳光下妖艳无比。'
    ],
    image: 'assets/beasts/flower_snake.jpg',
    choices: [
      { text: '迎战！正好练练手', result: { text: '你亮出{spirit}迎了上去！', battle: 'flower_snake', exp: 45 } },
      { text: '悄悄绕开，不招惹它', cond: { speed: 12 }, result: { text: '你屏住呼吸，踩着落叶最轻的地方绕了个大圈。花蛇毫无察觉。你在心里给自己比了个大拇指。', speed: 1, exp: 30 } },
      { text: '躲起来观察它的习性', result: { text: '你趴在树后看了半个时辰：原来花蛇捕猎前会先把尾巴盘成弹簧！这些知识书上可没有。', exp: 40, fate: 1 } }
    ]
  },
  {
    id: 'mystery_merchant', name: '神秘货郎', location: '学院门口·集市',
    phase: 'academy', weight: 2,
    text: [
      '学院门口来了个挑担子的货郎，担子上瓶瓶罐罐叮当乱响。他冲你挤挤眼："小魂师，来点好东西？回魂丹，吃了精神百倍，童叟无欺！"',
      '你摸了摸口袋里的金币，有点心动。'
    ],
    choices: [
      { text: '买两颗回魂丹（30金币）', cond: { gold: 30 }, cost: { gold: 30 }, result: { text: '货郎麻利地包好丹药塞给你："拿好嘞！"丹药闻起来有股清香，应该是真货。', item: { name: '回魂丹', type: 'heal', value: 60, count: 2 } } },
      { text: '买一颗聚魂丹（40金币）', cond: { gold: 40 }, cost: { gold: 40 }, result: { text: '"识货！"货郎竖起大拇指，"这可是好东西，魂力枯竭时一颗顶半天。"', item: { name: '聚魂丹', type: 'mp', value: 40, count: 1 } } },
      { text: '讲讲价试试', cond: { fate: 1 }, result: { text: '你眨巴着眼睛砍了半天价，货郎被磨得没办法："行行行，怕了你了！"最后半价卖给你一颗回魂丹。', item: { name: '回魂丹', type: 'heal', value: 60, count: 1 }, exp: 15 } },
      { text: '不买了，捂紧钱包', result: { text: '你摇摇头走开了。身后传来货郎的吆喝："下次再来啊——"', exp: 5 } }
    ]
  },
  {
    id: 'training_hill', name: '后山苦修', location: '史莱克学院·后山',
    phase: 'academy', weight: 3,
    text: [
      '天还没亮，{name}就爬上了后山。晨雾缭绕中，你一遍遍运转魂力，汗水浸透了衣衫。',
      '所谓天才，不过是比别人多流一倍的汗水。'
    ],
    choices: [
      { text: '修炼攻击技巧', result: { text: '你把{spirit}使得虎虎生风，一块大石头被你劈成了两半！', attack: 1, exp: 25, damage:5 } },
      { text: '修炼防御身法', result: { text: '你在梅花桩上腾挪闪转，直到夕阳西下方才停下。身法又稳了几分。', defense: 1, exp: 25 } },
      { text: '打坐凝聚魂力', result: { text: '魂力在经脉中缓缓流淌，如春水般温润。', spiritPowerGain: 3, exp: 20, mp: 15 } }
    ]
  },
  {
    id: 'help_granny', name: '帮老奶奶找猫', location: '学院旁·小镇',
    phase: 'academy', weight: 2,
    text: [
      '下山买文具的路上，一位白发老奶奶拉住了你："小魂师，我的小花猫跑进巷子里不见了，你能帮我找找吗？"',
      '她急得直跺脚，你看了看天色，离熄灯还有一个时辰。'
    ],
    choices: [
      { text: '当然要帮！', result: { text: '你翻遍了七条巷子，终于在屋顶上找到了那只胖成球的花猫。老奶奶非要塞给你一包自己做的桂花糖，甜到了心里。', hp: 15, exp: 20, fate: 2 } },
      { text: '用武魂帮忙找', result: { text: '你灵机一动，用{spirit}的力量感知四周，不到一炷香就锁定了小猫的位置。老奶奶看得目瞪口呆，逢人就夸你。', exp: 25, fate: 1, spiritPowerGain: 2 } },
      { text: '时间不早了，婉拒', result: { text: '你抱歉地摇摇头。走出老远，你心里还有点过意不去。', exp: 5 } }
    ]
  },
  {
    id: 'rainy_day', name: '雨天的顿悟', location: '史莱克学院·屋檐下',
    phase: 'academy', weight: 2,
    text: [
      '暴雨突至，{name}被困在教学楼里。你坐在屋檐下，看雨点在水洼里打出一个又一个圆圈。',
      '看着看着，你忽然入了定——原来魂力也可以像这雨水一样，绵绵不绝。'
    ],
    choices: [
      { text: '静心感悟', result: { text: '雨停时，你只觉得浑身舒畅，对魂力的理解又深了一层。', spiritPowerGain: 3, exp: 30 } },
      { text: '冲进雨里撒欢', result: { text: '你在雨里又跑又跳，像一只快乐的小鸭子。虽然第二天打了个喷嚏，但心情好极了！', damage:5, exp: 15, fate: 1 } }
    ]
  },
  {
    id: 'swim_contest', name: '游泳比赛', location: '学院·清水湖',
    phase: 'academy', weight: 2,
    text: [
      '夏日炎炎，学院组织了一场游泳比赛。同学们摩拳擦掌，奖品是一整盒冰镇灵果！',
      '"预备——跳！"'
    ],
    choices: [
      { text: '全力冲刺！', cond: { speed: 12 }, result: { text: '你像一尾小鱼劈波斩浪，第一个触到了对岸！冰镇灵果真甜啊！', speed: 1, exp: 30, hp: 20, fate: 1 } },
      { text: '稳扎稳打，享受比赛', result: { text: '你不紧不慢地游完全程，虽然只拿了第三，但玩得非常开心。', exp: 20, hp: 15 } },
      { text: '在岸边给大家加油', result: { text: '你的加油声喊得比谁都响，嗓子都哑了。冠军分了你一颗灵果！', hp: 10, exp: 15, fate: 1 } }
    ]
  },
  {
    id: 'cooking_disaster', name: '厨艺大灾难', location: '学院·小厨房',
    phase: 'academy', weight: 2,
    text: [
      '你想给同学们露一手，做一道家乡的拿手菜。可是……锅里的东西怎么变成黑乎乎的一坨了？！',
      '浓烟滚滚，呛得你直咳嗽。同学们捂着鼻子冲了进来。'
    ],
    choices: [
      { text: '厚着脸皮请大家尝尝', result: { text: '大家视死如归地尝了一口，表情精彩纷呈。胖虎学长咽下去之后竖起了大拇指："有……有创意！"从此你的"黑暗料理"名扬全校。', fate: 1, exp: 20 } },
      { text: '赶紧毁尸灭迹', cond: { speed: 10 }, result: { text: '你以迅雷不及掩耳之势把锅刷得干干净净。等大家冲进来时，只看到你无辜的笑脸："什么烟？没有啊？"', speed: 1, exp: 15 } },
      { text: '虚心向大厨请教', result: { text: '食堂大厨手把手教了你一下午。三天后，你做的红烧肉居然有模有样了！', exp: 30, fate: 1 } }
    ]
  },
  {
    id: 'star_gazing', name: '屋顶看星星', location: '学院·宿舍屋顶',
    phase: 'academy', weight: 2,
    text: [
      '熄灯后，{name}偷偷爬上了屋顶。夏夜的星空璀璨无比，银河像一条发光的丝带横贯天际。',
      '听说，每一颗星星都对应着一位强大的魂师。哪一颗会是你呢？'
    ],
    choices: [
      { text: '许个愿吧', result: { text: '你对着流星许下心愿：我要成为最厉害的魂师！那一刻，你感觉浑身充满了力量。', spiritPowerGain: 3, fate: 2, exp: 20 } },
      { text: '数星星数到睡着', result: { text: '数到第三百二十七颗时，你迷迷糊糊睡着了。第二天在屋顶被晨露冻醒，打了个大喷嚏。', damage:5, exp: 15 } }
    ]
  },
  {
    id: 'spirit_show', name: '武魂展示会', location: '学院·大礼堂',
    phase: 'academy', weight: 2,
    text: [
      '学院举办武魂展示会，每个学员都要上台展示自己的武魂。台下坐满了同学和老师。',
      '"下一位，{name}！"主持人的声音响起。'
    ],
    choices: [
      { text: '自信满满地上台展示', result: { text: '你的{spirit}在台上大放光彩，赢得了满堂喝彩！大师在台下欣慰地点头。', exp: 35, fate: 1 } },
      { text: '紧张得手心冒汗', result: { text: '你深吸三口气走上台，虽然声音有点抖，但完整展示了自己的武魂。下台后同学们纷纷鼓掌："很棒了！"', exp: 30, defense: 1 } },
      { text: '在后台帮别人加油', result: { text: '你帮紧张的同学整理衣领、递水打气。虽然没有上台，但大家都记住了这个热心肠的小伙伴。', fate: 2, exp: 20 } }
    ]
  },
  {
    id: 'lost_kitten', name: '后山的小猫', location: '学院·后山',
    phase: 'academy', weight: 2,
    text: [
      '你在后山修炼时，听到草丛里传来细弱的叫声——是一只受伤的小花猫，腿上缠着荆棘。',
      '它睁着水汪汪的大眼睛看着你，可怜巴巴地"喵"了一声。'
    ],
    choices: [
      { text: '救它！带回去疗伤', result: { text: '你小心翼翼地把小猫带回宿舍，用回魂丹的药粉给它敷了伤口。三天后，小猫活蹦乱跳，成了全宿舍的团宠。', fate: 2, exp: 25, cost: null } },
      { text: '给它留点吃的', result: { text: '你把怀里的肉干留给小猫，看着它狼吞虎咽的样子，心里暖暖的。', exp: 15, fate: 1 } }
    ]
  },
  {
    id: 'old_tree', name: '会发光的古树', location: '星斗大森林外围',
    phase: 'academy', weight: 2,
    text: [
      '森林深处，你发现了一棵会发光的古树。树皮上流淌着淡金色的纹路，周围开满了从未见过的花。',
      '据说，这样的古树下常常埋藏着天地灵物。'
    ],
    choices: [
      { text: '在树下打坐修炼', result: { text: '古树散发的灵气缓缓渗入你的体内，魂力运转比平时快了三倍！', spiritPowerGain: 5, exp: 35 } },
      { text: '挖挖看树根下有什么', result: { text: '你挖了半天，挖出一颗拳头大的灵果！咬一口，甜丝丝的，浑身暖洋洋的。', hp: 40, exp: 25 } },
      { text: '折一枝花带回去', result: { text: '你把花插在宿舍的窗台上。奇怪的是，这花一个月都没有凋谢，还让你的睡眠质量变好了。', hp: 20, fate: 1 } }
    ]
  },
  {
    id: 'fake_master', name: '假冒的大师', location: '学院门口',
    phase: 'academy', weight: 1,
    text: [
      '一个自称"隐世高人"的怪老头拦住了你："小家伙，看你骨骼清奇，老夫有一套绝世功法，只要五十金币就卖给你！"',
      '他掏出一本油光发亮的破书，封面上写着《九天十地无敌神功》。'
    ],
    choices: [
      { text: '买来试试（50金币）', cond: { gold: 50 }, cost: { gold: 50 }, result: { text: '你翻开一看——里面画的全是歪歪扭扭的小人，还缺了三页！你气得去找老头理论，他早就跑没影了。大师听说后笑得直不起腰。', exp: 10, fate: -1 } },
      { text: '识破骗局，扭头就走', result: { text: '你瞥了一眼那本书："这字还没我写得好呢。"老头讪讪地收起书，去找下一个目标了。', exp: 15, fate: 1 } },
      { text: '报告学院守卫', result: { text: '守卫把骗子老头赶跑了，还夸你机警。晚上食堂给你加了个鸡腿！', hp: 20, exp: 20, fate: 1 } }
    ]
  },
  {
    id: 'night_patrol', name: '夜间巡逻', location: '史莱克学院·校园',
    phase: 'academy', weight: 2,
    text: [
      '今晚你与唐三一组巡逻校园。月光如水，校园里静悄悄的，只有虫鸣声此起彼伏。',
      '忽然，唐三停下脚步，做了个噤声的手势——围墙边有个黑影一闪而过！'
    ],
    choices: [
      { text: '跟上去看看！', cond: { speed: 13 }, result: { text: '你们追上去一看，原来是隔壁宿舍的同学偷溜出去买宵夜。虚惊一场！唐三教育了他一顿，然后……你们三个人一起分享了那份宵夜。', speed: 1, exp: 25, fate: 1 } },
      { text: '守在这里等唐三发号施令', result: { text: '唐三让你原地待命，自己追了过去。片刻后他回来了："没事，是只夜猫。"他拍拍你的肩，"稳重，很好。"', defense: 1, exp: 20 } }
    ]
  },
  {
    id: 'festival', name: '学院庆典', location: '史莱克学院·广场',
    phase: 'academy', weight: 2,
    text: [
      '一年一度的学院庆典到了！广场上张灯结彩，有舞龙、杂耍、还有各种好吃的摊位。',
      '胖虎学长拉着你："走走走！套圈游戏，赢了我们平分奖品！"'
    ],
    choices: [
      { text: '玩套圈！', result: { text: '你手感火热，十个圈套中了六个！赢到了一只布老虎和一包糖果，你和胖虎学长笑成一团。', gold: 20, exp: 25, fate: 1 } },
      { text: '去看舞龙表演', result: { text: '金色的巨龙在火光中翻腾起舞，你看得如痴如醉，心里暗暗发誓：总有一天，我也要像这龙一样，翱翔九天！', spiritPowerGain: 3, exp: 25 } },
      { text: '帮忙摆摊卖糖葫芦', result: { text: '你帮着卖了一晚上糖葫芦，嗓子都喊哑了，但赚的钱分到了不少！', gold: 60, exp: 20 } }
    ]
  }
];

// ---------- 实战篇 ----------
EVENTS.push(
  {
    id: 'rival_challenge', name: '隔壁学院的挑战书', location: '史莱克学院·门口',
    phase: 'adventure', weight: 3,
    text: [
      '一大早，学院门口贴了一张挑战书，落款是隔壁天斗学院的"小霸王"，指名要和史莱克的学员切磋。',
      '"听说他们嘲讽我们学院没人了！"同学们义愤填膺，纷纷看向最近小有名气的{name}。'
    ],
    choices: [
      { text: '接受挑战，为学院争光！', result: { text: '你站上擂台，对方气势汹汹，但你的{spirit}更胜一筹！', battle: 'academy_rival', exp: 80, fate: 1 } },
      { text: '先摸清对方底细再说', result: { text: '你打听到对方每天午后都要睡一觉，醒来有半个时辰迷迷糊糊。你挑了这个时间应战，轻松获胜！', exp: 65, fate: 1 } },
      { text: '请唐三同学代打', result: { text: '唐三同学三个回合就结束了战斗。你在台下看得很尽兴，就是总觉得少了点什么。', exp: 30 } }
    ]
  },
  {
    id: 'soul_master_prelim', name: '魂师大赛·预赛', location: '天斗城·大赛会场',
    phase: 'master', unique: true, minLevel: 20, weight: 6,
    text: [
      '一年一度的少年魂师大赛开始了！巨大的会场座无虚席，锣鼓喧天。',
      '{name}代表史莱克学院出战预赛。站在擂台上，望着黑压压的观众，你的手心微微出汗。',
      '裁判一声令下："比赛——开始！"'
    ],
    choices: [
      { text: '亮出全部实力，一鸣惊人！', result: { text: '你毫无保留，{spirit}的光芒照亮了整座擂台！', battle: 'prelim_fighter', exp: 120, gold: 150, fate: 1 } },
      { text: '稳扎稳打，节省魂力', result: { text: '你且战且退，耐心消耗对手的魂力，最后抓住对方力竭的瞬间漂亮反击！观众席响起阵阵喝彩。', exp: 100, gold: 100, mp: 20 } }
    ]
  },
  {
    id: 'soul_master_final', name: '魂师大赛·决赛', location: '天斗城·大赛主会场',
    phase: 'master', unique: true, minLevel: 36, weight: 6,
    text: [
      '一路过关斩将，{name}杀进了魂师大赛的决赛！',
      '对手是夺冠大热门——来自武魂殿学院的天才少年，据说他的武魂从未在人前展露过。',
      '全场寂静，只听见战鼓般的脚步声。决赛，开始！'
    ],
    choices: [
      { text: '拼尽全力，不留遗憾！', result: { text: '这是你有生以来最艰难的一战！双方你来我往，斗魂场的地面都被震出了裂痕——', battle: 'final_fighter', exp: 200, gold: 400, fate: 2 } },
      { text: '以智取胜，诱敌深入', cond: { speed: 30 }, result: { text: '你故意露出破绽，引诱对手全力进攻，再以极限身法绕到他身后——一招定胜负！', battle: 'final_fighter', exp: 180, gold: 350, fate: 1 } }
    ]
  },
  {
    id: 'spirit_hall_exam', name: '武魂殿考核', location: '武魂殿·分殿',
    phase: 'master', unique: true, minLevel: 25, weight: 5,
    text: [
      '武魂殿的执事来到学院，选拔有潜力的年轻魂师。考核分两部分：笔试与实战。',
      '执事面无表情地翻开名册："下一位，{name}。"',
      '你深吸一口气，走进了庄严的考核大厅。'
    ],
    choices: [
      { text: '沉着应对，展现实力', result: { text: '笔试你对答如流，实战你游刃有余。执事难得露出一丝笑意："记录：优等。"', exp: 110, gold: 120, fate: 1 } },
      { text: '故意藏拙，低调通过', result: { text: '你只展露出七成实力，刚好踩线通过。大师事后问你为什么，你挠挠头说想保留点底牌。', exp: 70, fate: -1 } }
    ]
  },
  {
    id: 'mysterious_elder', name: '遇见神秘老人', location: '星斗大森林深处',
    phase: 'master', unique: true, minLevel: 28, weight: 5,
    text: [
      '你在森林深处迷了路，正着急时，看见溪边坐着一位钓鱼的白胡子老爷爷。奇怪的是，他的鱼钩是直的。',
      '"小家伙，过来坐坐。"老人头也不回地招呼你，"老朽的鱼，只钓有缘人。"',
      '你总觉得这位老人不简单——他周围的空气，似乎都在微微发光。'
    ],
    choices: [
      { text: '恭敬地行礼请教', result: { text: '老人哈哈大笑，随手在你额头点了一下。一股暖流瞬间流遍全身，你的{spirit}发出了前所未有的光芒！等你回过神，老人已经不见了。', evolve: true, exp: 100, fate: 2 } },
      { text: '陪他聊聊天', result: { text: '你们聊了一个下午。老人讲了许多魂师界的奇闻轶事，临走时塞给你一个小瓷瓶："拿着，关键时刻能救命。"', item: { name: '回魂丹', type: 'heal', value: 120, count: 3 }, exp: 80, fate: 2 } },
      { text: '留个心眼，远远离开', result: { text: '你礼貌地告辞了。走出老远回头再看，溪边空空如也，仿佛从未有人来过。', exp: 30 } }
    ]
  },
  {
    id: 'beast_riot', name: '魂兽暴动·保卫村庄', location: '星斗大森林外围·小村庄',
    phase: 'master', unique: true, minLevel: 32, weight: 6,
    text: [
      '深夜，急促的钟声划破夜空——森林里的魂兽不知为何躁动起来，成群结队地冲向村庄！',
      '{name}赶到现场时，一头狂暴的岩蟒正在村口横冲直撞，村民们惊恐地四散奔逃。',
      '"别怕！我来挡住它！"你大喊一声冲了上去。'
    ],
    image: 'assets/beasts/rock_python.jpg',
    choices: [
      { text: '正面拦截，保护村民撤离！', result: { text: '你死死挡住岩蟒的去路，{spirit}的光芒成了村民们最安心的灯塔。', battle: 'rock_python', exp: 150, fate: 3, damage:30 } },
      { text: '指挥村民先撤，且战且退', cond: { defense: 20 }, result: { text: '你组织村民有序撤离，自己断后掩护。零伤亡！村长握着你的手久久不放。', exp: 130, fate: 2, defense: 2 } },
      { text: '去森林查探暴动的原因', cond: { speed: 22 }, result: { text: '你身形如电掠过战场，潜入森林深处——原来是一伙偷猎者惊扰了兽群！你把消息带回，魂师们联手平息了骚动。', exp: 140, fate: 3, speed: 2 } }
    ]
  },
  {
    id: 'meet_partner', name: '遇见伙伴', location: '落日森林·山道',
    phase: 'adventure', weight: 3,
    text: [
      '山道上，一个背着药篓的小姑娘正被一只独眼狼追得团团转，药草撒了一地。',
      '"救命啊——"她带着哭腔大喊。{name}想都没想就冲了上去！'
    ],
    choices: [
      { text: '英雄救美，赶走独眼狼！', result: { text: '你三拳两脚赶跑了独眼狼。小姑娘红着脸道谢，原来她是药师世家的传人，叫小药。她坚持送你两瓶特制的回魂丹。', battle: 'one_eye_wolf', item: { name: '回魂丹', type: 'heal', value: 80, count: 2 }, exp: 70, fate: 2 } },
      { text: '喊她一起跑', result: { text: '你拉起小姑娘的手撒腿就跑，一口气跑出三里地。两个人气喘吁吁地瘫在地上，对视一眼，都笑了。她分了你一半采到的灵草。', hp: 30, exp: 50, fate: 1 } }
    ]
  },
  {
    id: 'ancient_ruins', name: '古代遗迹', location: '落日森林·地下遗迹',
    phase: 'adventure', weight: 2,
    text: [
      '你在探险时发现了一处坍塌半埋的古代遗迹，石门上刻满了看不懂的符文。',
      '石门的缝隙里透出幽幽的蓝光，似乎在召唤着你。'
    ],
    choices: [
      { text: '进去一探究竟', result: { text: '遗迹深处有一座小小的祭坛，祭坛上的宝珠感应到你的{spirit}，化作一道流光融入你的体内！', spiritPowerGain: 10, exp: 90, fate: 1 } },
      { text: '在门外打坐感悟', result: { text: '你没有贸然进入，而是在门外静坐。符文的韵律渐渐与你的呼吸相合，竟然也悟到了一丝上古魂力的奥秘。', spiritPowerGain: 5, exp: 60 } },
      { text: '标记位置，回去报告大师', result: { text: '大师听完你的描述，眼睛一亮："这可能是上古魂师的传承之地！"你作为发现者获得了一大笔奖励。', gold: 200, exp: 60, fate: 1 } }
    ]
  },
  {
    id: 'bottleneck', name: '修炼瓶颈', location: '史莱克学院·静室',
    phase: 'master', unique: true, minLevel: 35, weight: 5,
    text: [
      '最近{name}的修炼遇到了瓶颈，无论怎么努力，魂力都停滞不前，像被一层看不见的墙挡住了。',
      '大师看出你的焦躁，递给你一杯清茶："突破瓶颈，有时候需要的不是苦练，而是机缘。你想怎么做？"'
    ],
    choices: [
      { text: '闭关苦修，水滴石穿', result: { text: '你在静室闭关了七天七夜。第七天黎明，体内的魂力终于冲破了那层壁障，如江河奔涌！', attack: 3, defense: 3, exp: 100 } },
      { text: '外出游历，寻找灵感', result: { text: '你走遍山川湖海，看云卷云舒。某天清晨看日出时忽然顿悟——瓶颈应声而破。', speed: 3, spiritPowerGain: 6, exp: 100, fate: 1 } },
      { text: '用丹药辅助突破（50金币）', cond: { gold: 50 }, cost: { gold: 50 }, result: { text: '你买来一颗"破障丹"，药力化开的瞬间，瓶颈轰然碎裂！', spiritPowerGain: 8, exp: 100 } }
    ]
  },
  {
    id: 'treasure_map', name: '藏宝图', location: '天斗城·旧货市场',
    phase: 'adventure', weight: 2,
    text: [
      '你在旧货市场淘到一张泛黄的羊皮卷，摊开后发现竟然是一张藏宝图，标记的宝藏在落日森林深处。',
      '摊主摆摆手："捡来的玩意儿，十个铜板卖你了。"'
    ],
    choices: [
      { text: '按图索骥，去寻宝！', result: { text: '你按图找到一棵千年古树，在树根下挖出一个陶罐——里面装满了金币！虽然手被划了几道口子，但值了！', gold: 300, exp: 60, damage:10, fate: 1 } },
      { text: '把藏宝图转手卖掉', result: { text: '你把藏宝图卖给了一个大腹便便的商人，净赚一百金币。至于宝藏……万一是假的呢？', gold: 100, exp: 20 } }
    ]
  },
  {
    id: 'arena_streak', name: '竞技场连胜', location: '天斗城·大斗魂场',
    phase: 'adventure', weight: 3,
    text: [
      '大斗魂场人声鼎沸。你已经在这里连胜了四场，再赢一场就能拿到"五连胜"的额外奖金！',
      '第五场的对手走上台来——一个使双刀的精瘦汉子，一看就不好对付。'
    ],
    choices: [
      { text: '战！为了五连胜！', result: { text: '刀光与武魂的光芒交织成一片！五十回合后，你以一记漂亮的魂技终结了比赛。', battle: 'arena_fighter', exp: 110, gold: 250, fate: 1 } },
      { text: '见好就收，领奖走人', result: { text: '你揣着四连胜的奖金潇洒离场。留得青山在，不怕没柴烧。', gold: 120, exp: 40 } }
    ]
  },
  {
    id: 'wolf_king_den', name: '幽冥谷的狼嚎', location: '星斗大森林外围·幽冥谷',
    phase: 'master', minLevel: 30, weight: 3,
    text: [
      '深夜的幽冥谷传来阵阵狼嚎，凄厉而威严。猎人们说，谷里住着一头千年幽冥狼王。',
      '你握着{spirit}，站在谷口。进，还是不进？'
    ],
    image: 'assets/beasts/nether_wolf_king.jpg',
    choices: [
      { text: '进谷一探！', cond: { level: 30 }, result: { text: '你点亮武魂走进幽冥谷，一双双幽绿的眼睛在黑暗中亮起——狼王缓缓走出了阴影。', battle: 'nether_wolf_king', exp: 150, fate: 1 } },
      { text: '在谷口修炼一晚', result: { text: '狼嚎声让你心神震荡，却也磨砺了你的意志。天亮时，你感觉精神力更加凝练了。', spiritPowerGain: 4, exp: 50 } }
    ]
  },
  {
    id: 'herb_valley', name: '灵药谷的馈赠', location: '落日森林·灵药谷',
    phase: 'adventure', weight: 2,
    text: [
      '你发现了一处隐秘的山谷，谷中长满了各色灵药，空气中都飘着药香。',
      '谷中央，一株灵草正在月光下舒展叶片，叶片上滚动着晶莹的露珠。'
    ],
    choices: [
      { text: '采些灵药回去', result: { text: '你采了满满一兜灵药，换回了不少金币，还留了几株自用。', gold: 150, item: { name: '回魂丹', type: 'heal', value: 70, count: 2 }, exp: 50 } },
      { text: '在谷中闭关三日', result: { text: '谷中灵气浓郁，你闭关三日，修为大进！', spiritPowerGain: 8, exp: 80 } }
    ]
  },
  {
    id: 'blacksmith', name: '铁匠铺的委托', location: '天斗城·铁匠铺',
    phase: 'adventure', weight: 2,
    text: [
      '城里的铁匠大叔愁眉苦脸：他定做的一块稀有铁料被山贼抢走了，那可是他准备打一把好剑的材料。',
      '"小魂师，你要是能帮我把铁料夺回来，我免费帮你强化武器！"'
    ],
    choices: [
      { text: '帮他夺回铁料！', result: { text: '你找到山贼的老巢，三下五除二解决了他们。铁匠大叔信守承诺，把你的武器强化得闪闪发光！', attack: 4, exp: 70, fate: 1 } },
      { text: '出金币帮他买新的（80金币）', cond: { gold: 80 }, cost: { gold: 80 }, result: { text: '铁匠大叔感动得热泪盈眶，连夜帮你打造了一件护心甲。', defense: 4, exp: 50, fate: 2 } }
    ]
  },
  {
    id: 'caravan', name: '商队随行', location: '天斗帝国·官道',
    phase: 'adventure', weight: 2,
    text: [
      '一支商队正在招募护卫，报酬丰厚。商队老板是个笑呵呵的胖子："小魂师，有没有兴趣赚点外快？"',
      '这一路要经过黑风山，据说那里山贼出没。'
    ],
    choices: [
      { text: '接下委托！', result: { text: '途中果然遇到了山贼！你护着商队且战且退，最终安全抵达。老板爽快地付了双倍酬金！', gold: 250, exp: 80, damage:15 } },
      { text: '太危险，婉拒了', result: { text: '你婉拒了委托。后来听说那支商队有惊无险地到了目的地，你松了口气。', exp: 15 } }
    ]
  },
  {
    id: 'hot_spring', name: '山中的温泉', location: '落日森林·山坳',
    phase: 'adventure', weight: 2,
    text: [
      '翻山越岭一整天，你意外发现了一处天然温泉，热气腾腾，周围开满了野花。',
      '疲惫的你看着这一池清泉，眼睛都亮了。'
    ],
    choices: [
      { text: '泡个痛快！', result: { text: '温热的泉水洗去了一身疲惫，你感觉每个毛孔都在欢呼。泡完澡，连魂力运转都顺畅了许多。', hp: 60, mp: 30, exp: 30 } },
      { text: '泡完再练一会儿功', result: { text: '温泉活血之后修炼，事半功倍！你在池边打坐到月上中天。', hp: 40, spiritPowerGain: 5, exp: 45 } }
    ]
  }
);

// ---------- 封号篇 ----------
EVENTS.push(
  {
    id: 'title_douluo_trial', name: '封号斗罗的考验', location: '武魂殿·试炼场',
    phase: 'god', unique: true, minLevel: 50, weight: 6,
    text: [
      '你的名声传到了一位封号斗罗的耳中。这位前辈放出话来：想见他可以，先通过他的考验。',
      '试炼场上，封号斗罗负手而立，连武魂都懒得亮出来："小家伙，接我三招不倒，就算你过关。"',
      '恐怖的气势扑面而来，你的双腿开始不受控制地发抖。'
    ],
    choices: [
      { text: '全力以赴，接下三招！', cond: { defense: 60 }, result: { text: '第一招，你后退七步；第二招，你单膝跪地；第三招——你咬紧牙关，硬生生站住了！封号斗罗收起气势，朗声大笑："好！好一个倔强的小家伙！"', exp: 300, fate: 3, attack: 5 } },
      { text: '以巧破力，不求硬接', cond: { speed: 60 }, result: { text: '你没有硬接，而是以极限的身法在三招之间游走闪避。三招过后，你毫发无伤。封号斗罗眼前一亮："身法不错，脑子更不错！"', exp: 280, fate: 2, speed: 5 } },
      { text: '坦然认输，虚心求教', result: { text: '你深吸一口气，拱手认输。封号斗罗微微颔首："明知不敌而不逞匹夫之勇，难得。"他破例指点了你三天。', exp: 200, spiritPowerGain: 10 } }
    ]
  },
  {
    id: 'spirit_hall_secret', name: '武魂殿的秘密', location: '武魂殿·藏书阁',
    phase: 'god', unique: true, minLevel: 55, weight: 5,
    text: [
      '深夜，你奉命整理武魂殿藏书阁的旧档案，无意间翻到一卷尘封的密档——上面记载着一个惊人的计划：武魂殿正在暗中捕捉高年限魂兽，图谋不轨！',
      '烛火摇曳，{name}的心跳得厉害。这个秘密，该怎么办？'
    ],
    choices: [
      { text: '秘密通知学院和各大宗门', result: { text: '你冒险抄录了密档，连夜送出。几天后，各大势力联手施压，武魂殿被迫收敛。大师拍着你的肩膀："你做了正确的事。"', fate: 4, exp: 250 } },
      { text: '先隐忍，收集更多证据', result: { text: '你把密档放回原处，假装什么都不知道。从此你留了个心眼，暗中收集证据——要扳倒庞然大物，需要万全的准备。', fate: 2, exp: 220, speed: 3 } },
      { text: '事不关己，当作没看见', result: { text: '你默默合上了密档。有些浑水，还是不蹚为好。只是那晚之后，你总会想起档案里那些魂兽的名字。', fate: -3, exp: 150, gold: 200 } }
    ]
  },
  {
    id: 'shapeshift_beast', name: '十万年魂兽的邂逅', location: '星斗大森林深处·核心湖畔',
    phase: 'god', unique: true, minLevel: 75, weight: 6,
    text: [
      '湖边，你看见一个白衣少女正在戏水，她的身边，安静地卧着一只小山般的天青牛蟒——十万年魂兽！',
      '少女转过头，冲你甜甜一笑："别怕，大明天青不会伤害你的。我叫小舞，你也是来湖边玩的吗？"',
      '你的直觉告诉你，眼前的一切绝不像表面那么简单。'
    ],
    image: 'assets/beasts/sky_blue_bull_python.jpg',
    choices: [
      { text: '友善地坐下来和她们聊天', result: { text: '你们聊了很久很久。分别时，小舞摘下一朵湖边的花别在你耳边："大明天青说，你的心很干净。这个送你，危急时刻能保你一命哦。"', fate: 4, item: { name: '十万年祝福', type: 'heal', value: 999, count: 1 }, exp: 260 } },
      { text: '保持警惕，礼貌告辞', result: { text: '你拱手告辞。走出很远后回头望去，湖面上升起淡淡的雾气，少女和巨蟒的身影都已消失不见，仿佛一场梦。', exp: 150, fate: 1 } },
      { text: '偷偷记下位置，报告武魂殿', result: { text: '你把消息卖给了武魂殿，换来一袋沉甸甸的金币。只是从那以后，每次路过湖畔，你都会莫名地心虚。', gold: 800, fate: -4, exp: 100 } }
    ]
  },
  {
    id: 'partner_farewell', name: '伙伴的离别', location: '史莱克学院·大门口',
    phase: 'god', unique: true, minLevel: 45, weight: 4,
    text: [
      '小药要走了。她的家族来信，让她回去继承药堂。学院门口，她背着行囊，眼睛红红的。',
      '"{name}，谢谢你一直照顾我。"她吸了吸鼻子，"这个给你——我炼了三个月的丹药，不许嫌少！"'
    ],
    choices: [
      { text: '郑重收下，约定以后再见', result: { text: '你们击掌为誓：等她成为一代药师，你成为封号斗罗，再一起去星斗大森林外围探险！看着她远去的背影，你在心里默默说了声：保重。', item: { name: '回魂丹', type: 'heal', value: 150, count: 3 }, fate: 2, exp: 120 } },
      { text: '把攒的金币分她一半当盘缠', cond: { gold: 100 }, cost: { gold: 100 }, result: { text: '小药推辞不过，眼泪终于掉了下来。她塞给你一个护身香囊："带着它，就像我陪着你一样。"香囊里，藏着三颗她最珍贵的保命丹。', item: { name: '保命丹', type: 'heal', value: 200, count: 3 }, fate: 3, exp: 130 } }
    ]
  },
  {
    id: 'evil_spirit_master', name: '邪魂师的踪迹', location: '天斗帝国·边境小镇',
    phase: 'master', weight: 3,
    text: [
      '边境小镇接连有魂师失踪，传言是邪魂师所为。你奉命前来调查，在废弃的祠堂里发现了诡异的黑色符文。',
      '阴风阵阵，一个黑袍人缓缓从阴影中走出："多管闲事的小鬼，既然来了，就留下吧。"'
    ],
    choices: [
      { text: '为民除害，战！', result: { text: '黑袍人的邪术阴狠毒辣，但你的{spirit}光明磊落！', battle: 'evil_master', exp: 220, fate: 2, gold: 180 } },
      { text: '佯装不敌，暗中跟随', cond: { speed: 45 }, result: { text: '你且战且退，暗中缀上了黑袍人，顺藤摸瓜端掉了整个邪教据点！这一票，干得漂亮！', exp: 240, fate: 3, gold: 250 } }
    ]
  },
  {
    id: 'sea_trial', name: '海神岛的试炼', location: '海神岛·海滩',
    phase: 'master', weight: 2,
    text: [
      '你乘船来到传说中的海神岛。刚踏上沙滩，一道水幕冲天而起，化作一位蓝衣使者。',
      '"远方的魂师，想获得海神的祝福吗？那就接受浪之试炼吧——在巨浪中坚持一炷香！"'
    ],
    choices: [
      { text: '接受试炼！', cond: { defense: 55 }, result: { text: '巨浪如山般压下，你咬紧牙关扎稳马步，{spirit}在身后闪耀。一炷香后，水幕散去，使者微笑着按了按你的肩膀："海神祝福你，勇敢的魂师。"', spiritPowerGain: 15, exp: 200, fate: 2 } },
      { text: '在岸边观摩学习', result: { text: '你看着其他挑战者在浪中翻腾，默默记下了他们借力卸力的技巧，收获也不小。', exp: 90, defense: 3 } }
    ]
  },
  {
    id: 'bandit_king', name: '山贼王的宝藏', location: '天斗帝国·黑风山',
    phase: 'master', weight: 2,
    text: [
      '你单枪匹马端了黑风山的山贼窝。山贼王跪地求饶，说山寨的密室里藏着二十年搜刮来的财宝。',
      '"大侠饶命！财宝都给您！"'
    ],
    choices: [
      { text: '取走财宝，分给山下百姓', result: { text: '你把财宝分给了饱受山贼欺压的村民。万家生佛，功德无量！村民们非要拉着你吃了三天流水席。', fate: 3, exp: 180, gold: 150 } },
      { text: '全部收入囊中', result: { text: '沉甸甸的金币装满了你的行囊。发财了发财了！', gold: 600, exp: 120, fate: -1 } }
    ]
  },
  {
    id: 'titan_encounter', name: '泰坦巨猿的领地', location: '星斗大森林深处·核心区',
    phase: 'god', minLevel: 75, weight: 2,
    text: [
      '大地在颤抖。前方，一座"小山"缓缓转过身来——泰坦巨猿，万年魂兽中的霸主！',
      '它居高临下地打量着你这个闯入者，鼻孔里喷出灼热的气流。'
    ],
    image: 'assets/beasts/titan_giant_ape.jpg',
    choices: [
      { text: '挑战它！', cond: { level: 75 }, requirementHint: '等级达到 Lv.75', result: { text: '你明知山有虎，偏向虎山行！这一战，惊天动地！', battle: 'titan_giant_ape', exp: 300, fate: 1 } },
      { text: '恭敬退走，不扰霸主', result: { text: '你缓缓后退，退出了它的领地。泰坦巨猿注视你片刻，转身离去。懂得敬畏，也是强者的素养。', exp: 100, fate: 1 } }
    ]
  },
  {
    id: 'auction', name: '地下拍卖会', location: '天斗城·地下会场',
    phase: 'master', weight: 2,
    text: [
      '你混进了一场神秘的地下拍卖会。台上的拍卖师敲响小锤："下一件——千年灵药「还魂草」，起拍价三百金币！"',
      '你摸了摸鼓鼓的钱袋，有点心动。'
    ],
    choices: [
      { text: '举牌竞拍（300金币）', cond: { gold: 300 }, cost: { gold: 300 }, result: { text: '经过几轮激烈竞价，还魂草归你了！药师说，这株草炼出的丹药能生死人肉白骨。', item: { name: '保命丹', type: 'heal', value: 250, count: 2 }, exp: 60 } },
      { text: '看看就好', result: { text: '你大开眼界，见识了许多闻所未闻的奇珍异宝。虽然没买东西，但长了不少见识。', exp: 40 } }
    ]
  },
  {
    id: 'master_teaching', name: '大师的私教课', location: '史莱克学院·书房',
    phase: 'god', unique: true, minLevel: 48, weight: 3,
    text: [
      '大师把你叫到书房，桌上摊着你这些年的战斗记录。',
      '"{name}，你已经不是当年的小学员了。"大师推了推眼镜，"今天，我教你最后一课——如何成为一个真正的强者。"'
    ],
    choices: [
      { text: '洗耳恭听', result: { text: '那一课，从黄昏讲到深夜。大师说："真正的强者，不是没有恐惧，而是带着恐惧依然向前。"你把这句话刻在了心里。', spiritPowerGain: 12, exp: 180, fate: 2 } }
    ]
  }
);

// ---------- 成神篇 ----------
EVENTS.push(
  {
    id: 'god_trial_sea', name: '神位传承·海神九考', location: '海神岛·圣殿',
    phase: 'god', unique: true, minLevel: 75, weight: 6,
    text: [
      '海神圣殿之中，湛蓝的神光自穹顶洒落，照亮了你前行的路。',
      '一个威严而温和的声音在天地间响起："传承者{name}，你历经百战，心怀赤诚。今日，可敢接受神之试炼？"',
      '你深吸一口气，向前踏出一步。'
    ],
    choices: [
      { text: '我愿接受试炼！', result: { text: '神光将你笼罩。你看到了自己的一生：村庄的炊烟、学院的灯火、战斗的汗水、伙伴的笑脸……当你再次睁开眼时，眸中已多了一份神性的光辉。', exp: 400, spiritPowerGain: 30, fate: 3 } },
      { text: '我还需要再磨砺自己', result: { text: '神的声音带着笑意："不急不躁，难能可贵。去吧，当你准备好时，神位自会等你。"', exp: 200, fate: 1 } }
    ]
  },
  {
    id: 'angel_vs_sea', name: '双神之约', location: '武魂城·上空',
    phase: 'god', unique: true, minLevel: 90, weight: 5,
    text: [
      '你已成为封号斗罗中的顶尖存在。这一日，另一位神位传承者向你发来战书——巅峰之约，胜者留下传说。',
      '云海之上，两道身影遥遥相对。狂风猎猎，吹动你的衣袍。'
    ],
    choices: [
      { text: '迎战！巅峰之战！', result: { text: '那一战打得天昏地暗，日月无光！', battle: 'god_rival', exp: 500, fate: 2 } },
      { text: '化干戈为玉帛，结为知己', result: { text: '你收起武魂，朗声道："与其争个高下，不如把酒言欢！"对方愣了愣，随即大笑应允。从此斗罗大陆多了一段双神携手的佳话。', fate: 4, exp: 300 } }
    ]
  },
  {
    id: 'final_evil', name: '最终决战·讨伐武魂殿', location: '武魂城·教皇殿',
    phase: 'god', unique: true, minLevel: 95, weight: 10,
    text: [
      '武魂城的上空阴云密布。武魂殿倾巢而出，教皇殿前，供奉们列阵以待——这是魂师界与武魂殿的最终对决。',
      '大师、唐三、小舞、小药……所有人的面孔在你脑海中闪过。你与魂师联军并肩而立，号角声划破长空。',
      '{name}握紧了拳头，{spirit}绽放出前所未有的光芒。这一战，为了所有你在乎的人！'
    ],
    image: 'assets/beasts/deep_sea_demon_whale_king.jpg',
    choices: [
      { text: '决战！为了斗罗大陆！', result: { text: '你燃烧全部魂力冲向了武魂殿圣殿大供奉！天地间只剩下你与他碰撞的光芒——', battle: 'holy_lord', exp: 999, fate: 5 } }
    ]
  },
  {
    id: 'hermit_life', name: '隐士的邀请', location: '云雾山·草庐',
    phase: 'god', minLevel: 90, weight: 2,
    text: [
      '云雾山顶的草庐里，住着一位避世百年的老前辈。他邀你品茶，慢悠悠地说："小家伙，你如今功成名就，可曾想过，停下来看看云？"',
      '茶香袅袅，山风徐来。你忽然觉得，这样的时光也很美好。'
    ],
    choices: [
      { text: '陪老前辈住上几日', result: { text: '你们日出而耕，日落而息。几天后下山时，你只觉得心如明镜，魂力竟又精纯了几分。', spiritPowerGain: 10, hp: 100, exp: 150, fate: 2 } },
      { text: '婉拒，我的路还在前方', result: { text: '老前辈抚须而笑："去吧去吧，年轻人就该有年轻人的锐气。"他送你一罐云雾茶，说困了累了就泡一杯。', item: { name: '聚魂丹', type: 'mp', value: 80, count: 2 }, exp: 100 } }
    ]
  },
  {
    id: 'whale_king_sea', name: '深海魔鲸王', location: '深海·魔鲸海域',
    phase: 'god', minLevel: 80, weight: 3,
    text: [
      '深海之上，乌云蔽日。海底传来的威压让整支船队都在颤抖——深海魔鲸王，十万年海洋霸主，苏醒了。',
      '它巨大的眼睛穿透海水，直直地望向你。'
    ],
    image: 'assets/beasts/deep_sea_demon_whale_king.jpg',
    choices: [
      { text: '与霸主一战！', cond: { level: 80 }, result: { text: '你纵身跃入波涛！这一战，海浪滔天！', battle: 'deep_sea_demon_whale_king', exp: 600, fate: 1 } },
      { text: '行礼致意，绕道而行', result: { text: '你站在船头，向深海遥遥一礼。魔鲸王注视你良久，喷出一道冲天水柱，算是回礼。', exp: 150, fate: 1 } }
    ]
  },
  {
    id: 'mortal_world', name: '红尘历练', location: '天斗帝国·民间',
    phase: 'god', minLevel: 90, weight: 2,
    text: [
      '成神之路上，你忽然想明白一件事：不懂人间疾苦，何以成神？',
      '于是你封印修为，像一个普通人一样，在市井中生活了一个月：挑水、劈柴、卖菜、修屋顶……'
    ],
    choices: [
      { text: '继续感悟红尘', result: { text: '一个月后，你解开封印。魂力没有增长，但你的心境，已经完全不同了。原来平凡，也是一种伟大。', fate: 3, exp: 250, spiritPowerGain: 20 } },
      { text: '帮助街坊邻里', result: { text: '你帮张大娘挑了一个月的水，帮李大叔修好了漏雨的屋顶，还教隔壁的小孩认字。他们不知道你是封号斗罗，只知道你是个好小伙。', fate: 4, exp: 200 } }
    ]
  },
  {
    id: 'thunder_tribulation', name: '九天雷劫', location: '苍穹之巅',
    phase: 'god', unique: true, minLevel: 92, weight: 5,
    text: [
      '你的修为触动了天地法则，九天雷劫不期而至！',
      '漆黑的劫云中，紫色的雷电如巨龙般游走。渡过去，海阔天空；渡不过去，前功尽弃。'
    ],
    choices: [
      { text: '直面雷劫！', cond: { defense: 150 }, result: { text: '一道、两道、三道……九道天雷劈落，你的衣衫尽碎，但脊梁始终挺直！雷云散去，霞光万丈！', exp: 500, fate: 2, attack: 10 } },
      { text: '以武魂护体，稳扎稳打', result: { text: '你将{spirit}的力量运转到极致，硬扛了九道天雷。虽然狼狈，但你撑过来了！', exp: 400, damage:100, fate: 1 } }
    ]
  },
  {
    id: 'world_peace', name: '大陆和平会议', location: '天斗城·皇宫',
    phase: 'god', weight: 2,
    text: [
      '两大帝国邀请你参加大陆和平会议，商讨如何共同防范魂兽潮与邪魂师。',
      '作为大陆最年轻的顶尖强者，你的意见举足轻重。'
    ],
    choices: [
      { text: '提议建立联合防线', result: { text: '你的提议得到了两大帝国的一致赞同。会后，皇帝亲自为你斟酒："有你在，是大陆之福。"', fate: 3, exp: 200, gold: 300 } },
      { text: '保持中立，不介入政事', result: { text: '你婉拒了所有职位，只说："若有战事，我必到。"转身飘然离去。', exp: 120, fate: 1 } }
    ]
  }
);

// ==================== 魂环获取事件（由引擎在对应等级强制触发） ====================
EVENTS.push(
  {
    id: 'ring_hunt_10', name: '第一魂环·年限抉择', location: '星斗大森林外围',
    phase: 'adventure', unique: true, minLevel: 10, ring: 'ten', weight: 0,
    text: [
      '你的魂力已经到了十级，可以吸收第一个魂环了！大师亲自带队，陪你来到星斗大森林外围。',
      '"十年魂环最稳妥，但根基出众者也可以尝试百年魂兽。"大师神色严肃，"年限、武魂方向与承受风险，都由你自己决定。"'
    ],
    choices: [
      {
        text: '十年灵鹿 · 稳妥生存路线', ringTier: 'ten', ringYear: 10, beastId: '灵鹿', beastName: '灵鹿',
        strategy: { year: '十年白环', risk: '低风险', reward: '基础属性 · 生命恢复', fit: '适合求稳、辅助与生存方向' },
        result: { text: '灵鹿的白色魂环泛着淡绿色微光，你平稳地将其吸收。第一魂环带来扎实的生命力，身体仿佛被清风拂过。', battle: 'spirit_deer_ten', heal: 20, exp: 50, fate: 1 }
      },
      {
        text: '百年疾风兔 · 速度成长路线', ringTier: 'hundred', ringYear: 100, beastId: '野兔', beastName: '疾风兔',
        strategy: { year: '百年黄环', risk: '中风险', reward: '更高属性 · 速度强化', fit: '适合敏攻、追击与先手方向', recommendedInnate: 70 },
        result: { text: '百年疾风兔远比预想中难缠。你在高速追逐中抓住唯一破绽，黄色魂环融入体内，双腿与反应得到明显强化。', battle: 'wind_rabbit_hundred', damage: 5, speed: 2, exp: 90, fate: 1 }
      },
      {
        text: '百年毒蛛 · 强攻控制路线', ringTier: 'hundred', ringYear: 100, beastId: '毒蛛', beastName: '毒蛛',
        strategy: { year: '百年黄环', risk: '高风险', reward: '更高属性 · 攻击与毒性', fit: '适合强攻、控制与持续压制', recommendedInnate: 90 },
        result: { text: '百年毒蛛的毒丝数次逼近要害，你带伤完成猎杀。黄色魂环在经脉中掀起冲击，熬过刺痛后，武魂多了一股危险的压制力。', battle: 'poison_spider_hundred', damage: 15, attack: 2, exp: 110, fate: 2 }
      }
    ]
  },
  {
    id: 'ring_hunt_20', name: '第二魂环·百年之证', location: '星斗大森林外围·中层',
    phase: 'master', unique: true, minLevel: 20, ring: 'hundred', weight: 0,
    text: [
      '二十级！你已经是小有名气的魂师了。这一次，你要猎杀的是百年魂兽——难度提升了十倍不止。',
      '森林中层的光线暗了下来，空气里弥漫着危险的气息。三只百年魂兽的气息，从不同方向传来。'
    ],
    choices: [
      { text: '猎杀百年独眼狼——凶悍肉食系，考验战力', result: { text: '独眼狼的独眼中闪烁着狡黠的光芒，它绕着你不停游走，寻找破绽。你沉着应对，以武魂之力正面硬撼，最终将利刃刺入它的要害。百年黄色魂环升起，你的攻击力得到了显著提升。', battle: '独眼狼', attack: 2, exp: 100, fate: 1 } },
      { text: '猎杀百年烈焰虎——火属性猛兽，炽热对决', result: { text: '烈焰虎周身燃烧着炽热的火焰，周围的草木都被热浪烤得焦黄。你与它缠斗了数十回合，每一拳都带着融金化铁的温度。虎啸声中，你终于找到破绽一击制胜，吸收魂环后体内仿佛燃起了一团不灭的火焰。', battle: '烈焰虎', heal: 15, exp: 120, fate: 1 } },
      { text: '猎杀百年风灵燕——速度如电，考验身法', result: { text: '风灵燕在空中划出一道道残影，快得几乎让人看不清它的轨迹。你屏息凝神，以静制动，在它俯冲的瞬间侧身闪避，反手一击将其击落。淡黄色魂环融入体内，你感觉双腿轻盈了许多，速度更上一层楼。', battle: '风灵燕', speed: 2, exp: 80, fate: 1 } }
    ]
  },
  {
    id: 'ring_hunt_30', name: '第三魂环·千年之约', location: '星斗大森林深处',
    phase: 'master', unique: true, minLevel: 30, ring: 'thousand', weight: 0,
    text: [
      '三十级，魂尊之境。千年魂兽的威压即便隔着老远也令人心悸。',
      '大师的神色前所未有的凝重："千年魂兽已开灵智，切勿大意。选一个，我们为你护法。"'
    ],
    choices: [
      { text: '猎杀千年人面魔蛛——剧毒蛛王，极度危险', result: { text: '人面魔蛛那酷似人脸的背甲让人不寒而栗，八条蛛腿如长矛般刺来。你险之又险地避开毒液喷吐，趁它转身的刹那突入近身，武魂全力爆发！蛛网漫天飞舞，但最终倒下的是它。千年紫色魂环带着磅礴的力量涌入体内，你的攻击力暴涨。', battle: '人面魔蛛', attack: 4, exp: 200, fate: 1 } },
      { text: '猎杀千年岩蟒——岩石般坚韧，皮糙肉厚', result: { text: '千年岩蟒盘踞在巨石之上，鳞片泛起金属般的光泽，寻常攻击难以伤其分毫。你耐心游走，不断攻击它的七寸要害，终于在数百次交锋后将其击溃。紫色魂环融入体内，你感觉皮肤仿佛也变得坚韧如石，防御力大幅提升。', battle: '岩蟒', defense: 3, heal: 20, exp: 150, fate: 1 } },
      { text: '猎杀千年雷鸟——雷霆之翼，快若闪电', result: { text: '雷鸟振翅间电光四溅，每一次俯冲都带着雷霆万钧之势。你在雷光中穿梭，身上被电弧擦出道道焦痕，但你的眼神始终锁定着它的飞行轨迹。终于，在它转向的瞬间你一跃而起，武魂击中它的翅膀！千年魂环化作紫光融入体内，你的速度与反应得到了质的飞跃。', battle: '雷鸟', speed: 4, exp: 180, fate: 1 } }
    ]
  },
  {
    id: 'ring_hunt_40', name: '第四魂环·万年之威', location: '星斗大森林深处·核心圈',
    phase: 'master', unique: true, minLevel: 40, ring: 'ten_thousand', weight: 0,
    text: [
      '四十级！你站在了无数魂师一生都无法企及的高度。而万年魂兽，是一方霸主级别的存在。',
      '森林核心圈的古木遮天蔽日，两头万年魂兽的领地就在前方。大地的震颤提醒着你：这里，是它们的世界。'
    ],
    choices: [
      { text: '猎杀万年大地之熊——大地震怒，万钧之力', result: { text: '万年大地之熊人立而起，双掌拍下，大地裂开数道深沟！你稳住身形，迎着崩裂的碎石逆势而上。这场战斗持续了整整一个时辰，方圆百丈的森林化为焦土。当最后一丝魂力耗尽时，你终于将武魂轰入它的胸膛。万年黑色魂环带着大地的厚重之力融入体内，你的攻击力达到了全新的高度。', battle: '大地之熊', attack: 6, damage:30, exp: 350, fate: 2 } },
      { text: '猎杀万年幽冥狼王——暗夜猎手，魅影重重', result: { text: '万年幽冥狼王在月光下化为一道道残影，它的每一次攻击都从你最意想不到的角度袭来。你闭上眼睛，以魂力感知取代视觉，在黑暗中与它展开了一场无声的较量。当你的武魂精准地击中它咽喉的瞬间，狼王发出一声不甘的嚎叫，黑色魂环缓缓升起。吸收魂环后，你的速度已经快到令人难以捕捉的境界。', battle: '幽冥狼王', speed: 5, damage:20, exp: 280, fate: 2 } }
    ]
  },
  {
    id: 'ring_hunt_50', name: '第五魂环·万年再临', location: '落日森林·最深处',
    phase: 'god', unique: true, minLevel: 50, ring: 'ten_thousand', weight: 0,
    text: [
      '五十级，魂王之境。你需要第二个万年魂环来稳固修为。',
      '落日森林的深处，夕阳的余晖把一切都染成了金色。两头万年魂兽的气息在山谷中回荡。'
    ],
    choices: [
      { text: '猎杀万年暗金恐爪熊——撕裂一切，绝对力量', result: { text: '暗金恐爪熊的利爪泛着暗金色的寒光，每一爪挥下都带着撕裂空间的力量。你全神贯注，在它狂暴的连击中寻找那一闪而逝的破绽。战斗的余波将周围的山壁都削平了一层，当你的武魂最终贯穿它的防御时，这头森林霸主轰然倒下。第二个万年魂环融入体内，你的攻击力达到了魂王境界的巅峰。', battle: '暗金恐爪熊', attack: 8, damage:40, exp: 350, fate: 2 } },
      { text: '猎杀万年冰帝蝎——极寒霸主，冰封千里', result: { text: '冰帝蝎的出现让整个山谷的气温骤降，空气中凝结出细密的冰晶。它的蝎尾每一次刺出都带着足以冻结魂力的极寒之气。你咬紧牙关，以武魂之力对抗寒气侵蚀，终于在它释放出最强一击后的虚弱间隙，给予致命一击！万年冰帝蝎的魂环带着极寒之力融入体内，你的防御力得到了冰属性的锤炼，变得坚不可摧。', battle: '冰帝蝎', defense: 6, damage:30, exp: 300, fate: 2 } }
    ]
  },
  {
    id: 'ring_hunt_60', name: '第六魂环·天赐之礼', location: '武魂城·圣殿',
    phase: 'god', unique: true, minLevel: 60, ring: 'special60', weight: 0,
    text: [
      '六十级这一天，异象突生——一道金光自天而降，落在你的面前。',
      '大师的呼吸都急促起来："这是……传说中的特殊魂环！上天赠予有缘人的礼物！"'
    ],
    choices: [
      { text: '吸收天赐神赐魂环——神界恩泽，根基蜕变', result: { text: '你伸出双手，那道金色光芒化作一枚璀璨的魂环缓缓飘落。这不是凡间的魂环，而是来自神界的恩赐！魂环融入体内的一刻，你仿佛听到了天界的钟声，全身的魂力如江河般奔涌不息。你的武魂在金光中蜕变，所有属性都得到了均衡而强大的提升。大师热泪盈眶："天赐魂环，老夫活了一辈子也只见过这一次！"', exp: 600, attack: 3, defense: 3, speed: 3, heal: 30, fate: 3 } },
      { text: '引导天赐之力淬炼武魂——脱胎换骨，品质飞跃', result: { text: '你放弃了直接吸收魂环，而是引导这股天赐之力淬炼武魂本身。金光渗透进武魂的每一丝纹理，它开始发生不可思议的变化——形态变得更加凝实，光芒更加璀璨夺目。武魂品质的飞跃让你感觉天地间的魂力与你的联系更加紧密了，每一次呼吸都能感受到力量的涌动。虽然魂环的吸收被延迟，但你的根基已经不可同日而语。', exp: 400, attack: 5, defense: 2, fate: 2 } }
    ]
  },
  {
    id: 'ring_hunt_70', name: '第七魂环·武魂真身', location: '星斗大森林深处·核心湖畔',
    phase: 'god', unique: true, minLevel: 70, ring: 'choice', weight: 0,
    text: [
      '七十级，魂圣之境，武魂真身觉醒的前夜。你来到了传说中的核心湖畔。',
      '森林霸主的气息自湖畔升起。你可以稳妥寻找万年魂环，也可以冒险追寻只存在于传说中的十万年红环。'
    ],
    choices: [
      { text: '挑战泰坦巨猿——森林之王，力量巅峰', result: { text: '泰坦巨猿双拳捶胸，发出的咆哮让整个星斗大森林外围都在颤抖。森林之王的力量足以开山裂石，你每接它一拳都感觉五脏六腑在翻腾。但你燃烧全部魂力，在极限中突破自我，最终以最强一击贯穿了它的防御。{ringLabel}融入体内的瞬间，你的力量越过了新的界线。', battle: '泰坦巨猿', attack: 10, damage:50, exp: 1000, fate: 3 } },
      { text: '挑战天青牛蟒——上古异种，生生不息', result: { text: '天青牛蟒那庞大的身躯从湖中探出，青色的鳞片在月光下反射出幽暗的光芒。它的生命力仿佛无穷无尽，每次你以为快要击败它，它又恢复如初。你改变策略，以绵绵不绝的攻击消耗它的恢复力。当晨曦初露时，你终于击溃它的防御。{ringLabel}融入体内，你感受到了前所未有的生命力与防御力。', battle: '天青牛蟒', defense: 8, heal: 40, exp: 800, fate: 3 } }
    ]
  },
  {
    id: 'ring_hunt_80', name: '第八魂环·深海争锋', location: '深海·魔鲸海域',
    phase: 'god', unique: true, minLevel: 80, ring: 'choice', weight: 0,
    text: [
      '八十级，魂斗罗。你扬帆出海，来到深海魔鲸出没的海域。',
      '狂风巨浪中，海洋霸主露出山岳般的背脊。你必须在魂环年份、风险与自身承受力之间作出选择。'
    ],
    choices: [
      { text: '挑战深海魔鲸王——海洋至尊，吞噬万物', result: { text: '深海魔鲸王张开巨口，仿佛要把整片海域吞入腹中。巨浪滔天之中，你宛如一叶扁舟，但你的武魂之光比太阳还要耀眼！你潜入深海，在它的领域内展开惊天动地的大战。当武魂贯穿它的要害时，整片海域都为之震颤。{ringLabel}在深海中绽放光芒，你的力量再次跨越极限。', battle: '深海魔鲸王', attack: 12, damage:60, exp: 1000, fate: 3 } },
      { text: '挑战邪魔虎鲨——深海猎手，杀戮机器', result: { text: '邪魔虎鲨同时拥有鲨鱼的凶残与猛虎的灵巧，在深海中来去如电，每一次攻击都精准瞄准你的要害。你在血色海水中与它周旋，最终以凝聚全身魂力的一击将其斩杀。{ringLabel}融入体内，你的速度与反应抵达了新的境界。', battle: '邪魔虎鲨', speed: 10, damage:40, exp: 800, fate: 3 } }
    ]
  },
  {
    id: 'ring_hunt_90', name: '第九魂环·百万年传说', location: '神界之门',
    phase: 'god', unique: true, minLevel: 90, ring: 'special90', weight: 0,
    text: [
      '九十级，封号斗罗之巅。神界之门在你面前缓缓开启，金色的光芒沐浴全身。',
      '传说中的百万年金色魂环与神赐魂环，同时出现在你面前——只能选择一个。'
    ],
    choices: [
      { text: '吸收百万年金色魂环——传说之力，逆转乾坤', result: { text: '你伸出手，那枚百万年金色魂环缓缓飘落，带着远古洪荒的气息。它比任何魂环都要沉重，仿佛承载着整个世界的重量。你咬紧牙关，以全部魂力接纳这股力量，刹那间你看到了宇宙的诞生与毁灭，看到了无数位面在时间长河中起落。金色魂环最终融入体内，你的武魂绽放出前所未有的光芒！你的命运从此与这片大陆紧紧相连，成为了永恒的传说。', exp: 2000, attack: 10, defense: 10, heal: 50, fate: 5 } },
      { text: '选择神赐魂环——稳扎稳打，厚积薄发', result: { text: '你放弃了百万年魂环的诱惑，转而选择了更为稳妥的神赐魂环。神界之门中飘落的神赐魂环虽然没有百万年魂环那般惊天动地，但它与你的武魂完美契合，毫无排斥地融入了你的身体。你感受着体内魂力安稳而扎实的增长，知道这条路虽然不够惊艳，但每一步都走得无比坚实。你的命运，将由你自己一步步书写，而非依赖传说。', exp: 1500, attack: 6, defense: 6, speed: 6, heal: 30, fate: 4 } }
    ]
  }
);

// ==================== 结局库 ====================
export const ENDINGS = [
  {
    id: 'god_of_sea', title: '海神传承者', minFate: 10, req:(G)=> G._bossKilled === true,
    text: [
      '武魂殿倒台的那一刻，漫天神光为你加冕。',
      '你站在海神岛的圣殿前，回望来路：从那个小村庄里懵懂的少年，到学院里努力的学员，再到如今万人敬仰的神明。一路走来，你从未忘记为什么出发。',
      '多年后，斗罗大陆上流传着新的传说：有一位神明，最喜欢变成普通人的样子，坐在小村庄的食堂里，和孩子们抢红烧肉吃。'
    ]
  },
  {
    id: 'tower_conqueror', title: '二十层之主', minFate: 8, req:(G)=> (G._towerFloor || 0) >= 20,
    text: [
      '挑战塔顶，你击败了最后的守护者，塔身发出万丈金光。',
      '从第一层到第二十层，每一步都是对自我的超越。你的名字被刻在了塔顶的石碑上，与历代最强者并列。',
      '后来，无数魂师慕名而来，只为在挑战塔中追寻你的足迹。而你，早已踏上了新的征途。'
    ]
  },
  {
    id: 'master_of_arts', title: '武道宗师', minFate: 6, req:(G)=> G._skillTree && Object.values(G._skillTree).filter(Boolean).length >= 20,
    text: [
      '你将技能树的每一条分支都走到了尽头，开创了属于自己的武道。',
      '史莱克学院为你设立了专属的修炼室，无数学生慕名而来，只为聆听你的教诲。',
      '你常说："武道无穷，唯有不断前行。"这句话，后来被刻在了学院的大门上。'
    ]
  },
  {
    id: 'guardian_douluo', title: '守护斗罗', minFate: 4,
    text: [
      '大战结束后，你谢绝了所有封赏，回到了最初的小镇。',
      '你建起了一座新的魂师学院，亲自教孩子们读书、修炼。每天清晨，操场上都能听到你中气十足的声音："记住！魂师的强大，是为了守护！"',
      '夕阳下，看着孩子们奔跑的身影，你摸了摸已经长出白发的鬓角，笑得无比满足。这，就是你想要的结局。'
    ]
  },
  {
    id: 'forge_legend', title: '锻造传说', minFate: 3, req:(G)=> (G._craftedBones || []).length >= 5,
    text: [
      '你锻造出的魂骨，品质之高连海神岛的匠人都自叹不如。',
      '你开设了一家锻造铺，专门为年轻的魂师打造装备。每一件出自你手的魂骨，都带着独特的灵性。',
      '多年后，"锻造传说"的名号传遍了大陆，而你依然每天准时打开铺门，笑呵呵地迎接每一位客人。'
    ]
  },
  {
    id: 'free_traveler', title: '逍遥游侠', minFate: 0,
    text: [
      '你没有接受任何势力的招揽，背起行囊，继续踏上了旅途。',
      '有人说在北境的冰原见过你，有人在海神岛的渔村见过你，还有人发誓在星斗大森林深处，看见你和一只十万年魂兽一起烤鱼。',
      '斗罗大陆的地图上，到处都是你的脚印。你的故事，成了酒馆里最受欢迎的下酒菜。'
    ]
  },
  {
    id: 'shadow_legend', title: '暗影传说', minFate: -999,
    text: [
      '你选择了自己的路——一条不被世人理解的路。',
      '你游走在光明与黑暗之间，用自己的方式守护着这片大陆。没有人知道你的名字，但每个作恶者都听说过那个"夜里的影子"的传说。',
      '偶尔，你会站在高处望着万家灯火，想起很多年前，那个在觉醒台上紧张得手心出汗的自己。你笑了笑，转身消失在夜色里。'
    ]
  },
  {
    id: 'beast_king', title: '万兽之王', minFate: 5, req:(G)=> (G.battleStats?.kills||0) >= 100,
    text: [
      '你猎杀的魂兽数量，已经多到连武魂殿的记录官都数不清了。',
      '星斗大森林深处，你的名字就是最强的威慑。魂兽们听到你的脚步声，不是臣服就是逃窜。',
      '但你心中始终记得，每一只魂兽都是一条生命。你在森林深处建了一座石碑，上面刻着每一只被你击败的魂兽的名字。',
      '"愿来生，不再有猎人与猎物之分。"你轻声说道，转身走进了月光下的森林。'
    ]
  },
  {
    id: 'wealth_lord', title: '富甲天下', minFate: 2, req:(G)=> G.gold >= 50000,
    text: [
      '你的财富已经多到可以买下半座城池。',
      '但你没有沉溺于享乐。你用这些金币建起了学堂、医院和孤儿院，让每一个有天赋的孩子都能走上魂师之路。',
      '多年后，人们提起你时，不会先想到你有多少金币，而是会说："那个人啊，用财富改变了无数人的命运。"'
    ]
  },
  {
    id: 'codex_master', title: '万象全知', minFate: 3, req:(G)=> (G._achievementList||[]).length >= 20,
    text: [
      '你走遍了斗罗大陆的每一个角落，记录下了所有已知的武魂、魂兽、魂环、魂骨和地名。',
      '你的图鉴被武魂殿奉为至宝，成为了每一个新晋魂师必读的百科全书。',
      '你常说："知识是比武魂更强大的力量。"这句话被刻在了武魂殿图书馆的门口。',
      '后来，你的名字被列入"大陆百位最具影响力魂师"之首。'
    ]
  },
  {
    id: 'dragon_soul', title: '龙魂传承者', minFate: 7, req:(G)=> G.spirit && G.spirit.name && G.spirit.name.includes('龙'),
    text: [
      '当你的龙系武魂觉醒到极致时，天空中出现了一条金色的虚影——那是远古龙神的残念。',
      '"你已证明了自己的价值。"龙神的声音在脑海中回荡，"接受我的传承，成为新的龙魂之主吧。"',
      '金色的龙纹爬上你的双臂，你感受到了前所未有的力量。从这一天起，你就是龙魂传承者，斗罗大陆上唯一与龙神有联系的人。',
      '你仰天长啸，龙吟声响彻云霄，整个大陆都为之震颤。'
    ]
  },
  {
    id: 'hermit_sage', title: '隐世高人', minFate: 4, req:(G)=> G.level >= 80,
    text: [
      '当你的实力达到巅峰之后，你反而选择了隐退。',
      '你来到了一座无人知晓的山峰，搭了一间竹屋，种了几亩灵田。每天清晨打坐修炼，午后看书品茶，傍晚看着夕阳染红天际。',
      '偶尔有年轻的魂师寻上山来求教，你也不吝指点。但你从不收徒，只是说："道在心中，不在师门。"',
      '多年后，那座山峰被世人称为"仙人峰"，而你早已不知去向。'
    ]
  },
  {
    id: 'abyss_lord', title: '武魂殿的爪牙', minFate: -999, req:(G)=> (G.fatePoints||0) < 0 && (G._storyPath||[]).includes('dark'),
    text: [
      '对力量的渴望吞噬了你的一切——善良、信念、以及曾经那个纯真的自己。',
      '你站在武魂殿的高台上，俯瞰着脚下匍匐的殿卫。你拥有了无上的力量，却也失去了所有珍视的东西。',
      '风吹过你漆黑的斗篷，你想起了很久以前，有人对你说过："力量本身没有善恶，关键在于使用它的人。"',
      '你闭上了眼睛。殿外的寒风刺骨，却远不及心中的空洞。这就是你要的结局吗？你不知道。但已经没有回头路了。'
    ]
  },
  {
    id: 'ordinary_happiness', title: '平凡的幸福', minFate: 0, req:(G)=> (G._storyPath || []).includes('prudent'),
    text: [
      '你没有成为封号斗罗，也没有什么惊天动地的壮举。',
      '你回到了家乡的小镇，开了一家小小的面馆。每天和街坊邻居聊天，看着孩子们在街上嬉闹，偶尔给路过的魂师免费加个蛋。',
      '有人问你："你也是魂师吧？怎么不开个学院赚大钱？"',
      '你笑着摇摇头："人这一辈子，能过上自己喜欢的日子，就是最大的成功了。"',
      '面馆的招牌上写着你的名字，而那个名字，只有你自己知道曾经意味着什么。'
    ]
  },
  {
    id: 'mentor_legend', title: '传奇导师', minFate: 6, req:(G)=> Object.keys(G._npcRelations || {}).length >= 5,
    text: [
      '你与大陆上众多强者建立了深厚的友谊，他们纷纷将子女托付给你教导。',
      '你在史莱克学院开设了"传奇导师班"，亲自培养下一代魂师。你的学生中，有人成为了封号斗罗，有人成为了神匠，有人守护着一方安宁。',
      '毕业典礼上，你的学生们齐声喊道："师父，谢谢您！"',
      '你看着这些年轻的面孔，眼中泛起了泪光。这一刻，你觉得自己比击败任何强敌都更加骄傲。'
    ]
  },
  {
    id: 'element_sage', title: '元素圣者', minFate: 7, req:(G)=> (G._reactionCount||0) >= 30,
    text: [
      '你对元素之力的理解已经超越了所有凡人魂师。',
      '三十次元素共鸣在你体内留下了永恒的印记——火、水、风、土、雷、冰、光、暗，八种元素在你周围和谐共舞，形成了一道绚丽的元素光环。',
      '元素峡谷的精灵们尊你为"元素圣者"，在你的指引下，元素魂兽与人类魂师建立了前所未有的和平协议。',
      '你站在峡谷之巅，伸出手掌，八色光芒在指尖交汇。"万物归一，元素归心。"你的声音回荡在整个峡谷。'
    ]
  },
  {
    id: 'fusion_avatar', title: '融合化身', minFate: 8, req:(G)=> G._fusionUsed === true && G.level >= 60,
    text: [
      '当武魂融合的极致被你掌握后，你的身体已经能与武魂完全合一。',
      '不再是"释放武魂"，而是"成为武魂"。你的血脉中流淌着武魂的力量，每一次呼吸都是魂技的蓄势。',
      '史莱克学院为你建造了一座专属的融合殿，供你研究和传承这门至高的技艺。',
      '你站在融合殿中央，身形在人与武魂之间不断切换，宛如一尊活着的神像。'
    ]
  },
  {
    id: 'formation_grandmaster', title: '阵法宗师', minFate: 6, req:(G)=> G._formationsUsed && G._formationsUsed.length >= 4,
    text: [
      '你将阵法之道推演到了前人未至的境界。',
      '五种以上的阵法在你手中融会贯通，你甚至开创了属于自己的独创阵法——"星罗万象阵"。',
      '天斗帝国的将军们慕名求教，武魂殿的战略师也对你敬佩不已。你用阵法改变了战争的走向，拯救了无数生命。',
      '你常说："一人之力有限，阵法之力无穷。"这句话后来成为了天斗皇家军校的校训。'
    ]
  },
  {
    id: 'soulmate_eternal', title: '永恒挚爱', minFate: 5, req:(G)=> { if(!G._npcRelations) return false; return Object.values(G._npcRelations).some(v => v >= 500); },
    text: [
      '你与挚爱之人的羁绊已经超越了生死的界限。',
      '在最后一次大战中，当你的力量即将耗尽时，是那份深沉的爱意让你重新站了起来。你们的力量交织在一起，绽放出了超越神级的光芒。',
      '战后，你们选择远离纷争，在一座宁静的小镇上安度余生。每天清晨，你们并肩看日出；每个黄昏，你们携手散步在林间小道。',
      '"有你在身边，就是最好的结局。"你握着对方的手，微笑着说。'
    ]
  },
  {
    id: 'conqueror_supreme', title: '无敌战神', minFate: 9, req:(G)=> G.battleStats && G.battleStats.wins >= 200,
    text: [
      '两百场胜利，铸就了你的不败传说。',
      '从星斗大森林外围的低级魂兽到武魂殿的大供奉，没有人能在你的面前坚持超过三招。你的名字成为了大陆上最强战斗力的代名词。',
      '武魂殿为你颁发了"无敌战神"勋章——这是有史以来第一枚。',
      '但你并不在意这些虚名。你擦拭着手中的武器，望向远方更强大的对手。"还有谁？"你轻声问道，语气平静却充满自信。'
    ]
  },
  {
    id: 'master_forger', title: '神匠之魂', minFate: 5, req:(G)=> (G._craftedBones||[]).length >= 10,
    text: [
      '你锻造出的魂骨数量已经突破了十件，每一件都是传世之作。',
      '钢铁之城的楼高大师亲自登门拜访，称你为"百年一遇的锻造天才"。你的锻造铺前排起了长龙，来自大陆各地的魂师都渴望得到你亲手打造的装备。',
      '但你从不为权贵开方便之门。你只锻造给真正需要的人——那些有梦想、有勇气的年轻魂师。',
      '炉火映照着你的脸庞，你举起锤子，又一次敲响了铁砧。叮——清脆的声音回荡在夜空中。'
    ]
  },
  {
    id: 'explorer_supreme', title: '万象探险家', minFate: 6, req:(G)=> (G._visitedLocations||[]).length >= 15 && (G._discoveredHidden||[]).length >= 3,
    text: [
      '你的足迹遍布了斗罗大陆的每一个角落——从极北冰原到死亡沙漠，从天空之城到武魂城。',
      '你发现了三处以上的隐藏秘境，每一处都蕴含着远古的秘密。你的探险笔记被武魂殿图书馆珍藏，成为了后来者最宝贵的地图。',
      '有人问你："走遍大陆是什么感觉？"',
      '你想了想，回答说："世界很大，但真正重要的，是旅途中遇到的那些人和那些故事。"',
      '说完，你又背起行囊，踏上了下一段旅程。因为对你来说，探索本身就是最好的结局。'
    ]
  },
  {
    id: 'rebel_hero', title: '叛逆英雄', minFate: 4, req:(G)=> G.fatePoints >= 3 && G.fatePoints <= 7 && (G._storyPath||[]).includes('rebel'),
    text: [
      '你从不按常理出牌，也从不服从所谓的命运安排。',
      '当所有人都选择顺从时，你站了出来；当规则不公时，你亲手改写了规则。你不是一个传统意义上的英雄，但你是人民心中真正的英雄。',
      '武魂殿通缉过你，天斗帝国忌惮过你，但最终，他们都不得不承认——没有你，大陆不会是现在的样子。',
      '你站在城墙上，看着夕阳下自由呼吸的人们，嘴角微微上扬。"这，才是我想要的。"'
    ]
  },
  {
    id: 'dark_redemption', title: '暗夜救赎', minFate: -999, req:(G)=> G.fatePoints < 0 && (G._storyPath||[]).includes('redemption'),
    text: [
      '你曾坠入黑暗，但最终选择了光明。',
      '那段黑暗的日子如同噩梦——你伤害过无辜，背叛过信任，迷失过自我。但在最关键的时刻，有人向你伸出了手。',
      '你握住了那只手，用尽全力爬出了泥沼。从那以后，你将自己余生的力量都用于弥补曾经的过错。',
      '你建立了一座收容所，专门收留那些曾经和你一样迷失的灵魂。你告诉他们："黑暗不是终点，只要你愿意，随时可以回头。"',
      '多年后，人们不再提起你曾经的黑暗过往，只记得你是那个"给迷途者点灯的人"。'
    ]
  },
  {
    id: 'scholar_supreme', title: '博学圣人', minFate: 5, req:(G)=> (G._achievementList||[]).length >= 30,
    text: [
      '你的成就数量之多，已经创造了斗罗大陆的历史记录。',
      '三十项成就——涵盖战斗、探索、锻造、社交、修炼……你证明了一个人可以全面发展，不必局限于一条道路。',
      '天斗皇家学院授予你"博学圣人"的荣誉称号，你的画像被挂在了学院大厅最显眼的位置。',
      '你站在画像前，看着年轻的自己，喃喃道："原来，我已经走了这么远。"'
    ]
  },
  {
    id: 'spirit_evolution', title: '武魂进化者', minFate: 7, req:(G)=> G.spirit && G.level >= 70 && G.rings.length >= 7,
    text: [
      '你的武魂在你的不懈修炼下，完成了前所未有的进化。',
      '当第七个魂环镶嵌完成的那一刻，你的武魂绽放出了神级的光芒。它不再是当初觉醒时的模样，而是蜕变为了一种全新的、更强大的形态。',
      '玉小刚大师亲笔为你写下了《武魂进化论》的续篇，将你的经历作为最核心的案例。',
      '"武魂不是固定的，它会随着主人的成长而进化。"你站在觉醒台上，对着台下一群紧张的新魂师说道，"所以，不要害怕弱小，因为那只是开始。"'
    ]
  },
  {
    id: 'tower_legend', title: '挑战塔传奇', minFate: 8, req:(G)=> (G._towerFloor||0) >= 20,
    text: [
      '你征服了挑战塔的全部二十层，成为了有史以来第一个登顶的人。',
      '塔顶的石碑上刻下了你的名字，与远古的传说并列。你的壮举激励了无数魂师前来挑战，但至今无人能复制你的奇迹。',
      '你站在塔顶，俯瞰着脚下的云海。风吹过你的衣袂，带走了曾经的疲惫与伤痛。',
      '"这座塔教会了我一件事，"你对后来者说，"真正的敌人从来不是塔中的守护者，而是那个想要放弃的自己。"'
    ]
  }
];

// ==================== 剧情分支系统 ====================
export const STORY_BRANCHES = {
  // 关键决策点
  decisions: {
    'first_blood': {
      desc: '第一次战斗后的选择',
      options: {
        'spare': { text: '放过受伤的魂兽', fateChange: 1, path: 'merciful' },
        'kill': { text: '果断终结魂兽', fateChange: 0, path: 'pragmatic' },
        'help': { text: '救治魂兽并放归森林', fateChange: 2, path: 'saint' }
      }
    },
    'power_choice': {
      desc: '面对力量的诱惑',
      options: {
        'resist': { text: '拒绝黑暗力量', fateChange: 2, path: 'light' },
        'accept': { text: '吸收黑暗力量', fateChange: -3, path: 'dark' },
        'study': { text: '研究但不吸收', fateChange: 1, path: 'scholar' }
      }
    },
    'authority_clash': {
      desc: '与权威的冲突',
      options: {
        'obey': { text: '服从权威安排', fateChange: 0, path: 'loyal' },
        'rebel': { text: '坚持自己的立场', fateChange: 1, path: 'rebel' },
        'negotiate': { text: '寻求折中方案', fateChange: 1, path: 'diplomat' }
      }
    },
    'friend_crisis': {
      desc: '朋友陷入危机',
      options: {
        'rescue': { text: '不顾一切去救', fateChange: 2, path: 'loyal' },
        'plan': { text: '制定周密计划再行动', fateChange: 1, path: 'tactician' },
        'sacrifice': { text: '牺牲自己换取朋友安全', fateChange: 3, path: 'saint' }
      }
    },
    'wealth_test': {
      desc: '面对巨额财富',
      options: {
        'share': { text: '分给需要的人', fateChange: 2, path: 'generous' },
        'save': { text: '储存以备不时之需', fateChange: 0, path: 'prudent' },
        'invest': { text: '投资于修炼资源', fateChange: 1, path: 'ambitious' }
      }
    },
    'redemption_choice': {
      desc: '黑暗中的救赎',
      options: {
        'embrace_light': { text: '拥抱光明，赎罪前行', fateChange: 3, path: 'redemption' },
        'linger_dark': { text: '继续在黑暗中徘徊', fateChange: -2, path: 'dark' },
        'neutral': { text: '在光暗之间寻找平衡', fateChange: 0, path: 'balanced' }
      }
    }
  },

  // 根据剧情路径获取描述
  getPathDesc: function(path){
    const descs = {
      merciful: '仁慈之心',
      pragmatic: '务实果决',
      saint: '圣者之心',
      light: '光明之路',
      dark: '暗夜之行',
      scholar: '求知若渴',
      loyal: '忠诚不渝',
      rebel: '叛逆之心',
      diplomat: '圆融之道',
      tactician: '运筹帷幄',
      generous: '慷慨大方',
      prudent: '审慎持重',
      ambitious: '雄心壮志',
      redemption: '浪子回头',
      balanced: '中庸之道'
    };
    return descs[path] || path;
  },

  // 获取主导剧情路径
  getDominantPath: function(storyPath){
    if(!storyPath || storyPath.length === 0) return null;
    const counts = {};
    storyPath.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
  }
};

// ==================== 挑战塔 ====================
export const CHALLENGE_TOWER = {
  name: '魂师挑战塔',
  desc: '传说中的试炼之地，每层都有强大的守护者。越往上走，奖励越丰厚，但危险也成倍增长。',
  floors: [
    { floor:1,  name:'试炼之门',  minLv:5,  enemy:{name:'石像守卫',hp:120,attack:18,defense:10,speed:8,element:'土'}, reward:{gold:80,exp:60} },
    { floor:2,  name:'风之回廊',  minLv:8,  enemy:{name:'风灵刺客',hp:160,attack:25,defense:8,speed:18,element:'风'}, reward:{gold:120,exp:90} },
    { floor:3,  name:'烈焰殿',    minLv:12, enemy:{name:'焰魔战士',hp:220,attack:35,defense:15,speed:12,element:'火'}, reward:{gold:180,exp:140} },
    { floor:4,  name:'寒冰牢笼',  minLv:16, enemy:{name:'冰霜巨人',hp:300,attack:40,defense:25,speed:6,element:'冰'}, reward:{gold:250,exp:200} },
    { floor:5,  name:'雷电祭坛',  minLv:20, enemy:{name:'雷兽领主',hp:380,attack:55,defense:20,speed:22,element:'雷'}, reward:{gold:350,exp:280} },
    { floor:6,  name:'暗影深渊',  minLv:25, enemy:{name:'暗影刺杀者',hp:450,attack:70,defense:18,speed:28,element:'暗'}, reward:{gold:500,exp:380} },
    { floor:7,  name:'神圣殿堂',  minLv:30, enemy:{name:'圣光骑士',hp:550,attack:80,defense:35,speed:15,element:'光'}, reward:{gold:700,exp:500} },
    { floor:8,  name:'毒雾瘴林',  minLv:35, enemy:{name:'万毒蛛后',hp:680,attack:95,defense:30,speed:20,element:'毒'}, reward:{gold:900,exp:650} },
    { floor:9,  name:'钢铁要塞',  minLv:40, enemy:{name:'铁甲暴君',hp:820,attack:110,defense:55,speed:10,element:'金'}, reward:{gold:1200,exp:820} },
    { floor:10, name:'龙之试炼',  minLv:45, enemy:{name:'亚龙守护者',hp:1000,attack:130,defense:50,speed:25,element:'龙'}, reward:{gold:1600,exp:1100} },
    { floor:11, name:'幻境迷宫',  minLv:50, enemy:{name:'幻影妖姬',hp:1150,attack:150,defense:35,speed:35,element:'幻'}, reward:{gold:2000,exp:1400} },
    { floor:12, name:'血色战场',  minLv:55, enemy:{name:'血魔将军',hp:1350,attack:175,defense:45,speed:22,element:'血'}, reward:{gold:2500,exp:1800} },
    { floor:13, name:'灵魂试炼',  minLv:60, enemy:{name:'噬魂者',hp:1600,attack:200,defense:40,speed:30,element:'暗'}, reward:{gold:3200,exp:2300} },
    { floor:14, name:'混沌之门',  minLv:65, enemy:{name:'混沌巨兽',hp:1900,attack:230,defense:60,speed:18,element:'混沌'}, reward:{gold:4000,exp:3000} },
    { floor:15, name:'封号台',    minLv:70, enemy:{name:'封号斗罗之影',hp:2300,attack:270,defense:70,speed:28,element:'无'}, reward:{gold:5000,exp:4000} },
    { floor:16, name:'神兽殿',    minLv:75, enemy:{name:'远古神兽',hp:2800,attack:320,defense:80,speed:25,element:'神'}, reward:{gold:6500,exp:5200} },
    { floor:17, name:'极限试炼',  minLv:80, enemy:{name:'极限斗罗',hp:3400,attack:380,defense:90,speed:32,element:'无'}, reward:{gold:8000,exp:6800} },
    { floor:18, name:'半神之境',  minLv:85, enemy:{name:'半神守护者',hp:4200,attack:450,defense:100,speed:30,element:'神'}, reward:{gold:10000,exp:9000} },
    { floor:19, name:'神之走廊',  minLv:90, enemy:{name:'神将分身',hp:5200,attack:540,defense:120,speed:35,element:'光'}, reward:{gold:13000,exp:12000} },
    { floor:20, name:'塔顶·神座', minLv:95, enemy:{name:'二十层之主',hp:6500,attack:650,defense:150,speed:40,element:'混沌'}, reward:{gold:18000,exp:18000,title:'tower_conqueror'} }
  ]
};

// ==================== 每日签到 ====================
export const DAILY_REWARDS = [
  { day:1, name:'初见之礼',   reward:{gold:100} },
  { day:2, name:'修炼之助',   reward:{gold:150,exp:50} },
  { day:3, name:'魂力丹药',   reward:{gold:200,exp:80} },
  { day:4, name:'财力支援',   reward:{gold:300} },
  { day:5, name:'冒险补给',   reward:{gold:350,exp:120} },
  { day:6, name:'精英奖赏',   reward:{gold:500,exp:200} },
  { day:7, name:'周签大礼',   reward:{gold:800,exp:400,fatePoint:1} }
];

// ==================== 魂骨锻造 ====================
export const FORGE_RECIPES = [
  { id:'forge_attack_1', name:'锋锐之骨', desc:'将两块低级魂骨锻造为攻击型魂骨',
    materials:[{type:'any',count:2,minTier:1}], result:{name:'锋锐之骨',type:'attack',attack:8,defense:0,hp:0,speed:0,tier:2}, goldCost:200 },
  { id:'forge_defense_1', name:'坚韧之骨', desc:'将两块低级魂骨锻造为防御型魂骨',
    materials:[{type:'any',count:2,minTier:1}], result:{name:'坚韧之骨',type:'defense',attack:0,defense:8,hp:30,speed:0,tier:2}, goldCost:200 },
  { id:'forge_speed_1', name:'疾风之骨', desc:'将两块低级魂骨锻造为速度型魂骨',
    materials:[{type:'any',count:2,minTier:1}], result:{name:'疾风之骨',type:'speed',attack:3,defense:0,hp:0,speed:6,tier:2}, goldCost:200 },
  { id:'forge_hp_1', name:'生命之骨', desc:'将两块低级魂骨锻造为生命型魂骨',
    materials:[{type:'any',count:2,minTier:1}], result:{name:'生命之骨',type:'hp',attack:0,defense:3,hp:60,speed:0,tier:2}, goldCost:200 },
  { id:'forge_attack_2', name:'破军之骨', desc:'融合三块中级魂骨，铸造强力攻击骨',
    materials:[{type:'any',count:3,minTier:2}], result:{name:'破军之骨',type:'attack',attack:18,defense:2,hp:20,speed:2,tier:3}, goldCost:600 },
  { id:'forge_defense_2', name:'铁壁之骨', desc:'融合三块中级魂骨，铸造强力防御骨',
    materials:[{type:'any',count:3,minTier:2}], result:{name:'铁壁之骨',type:'defense',attack:2,defense:18,hp:60,speed:0,tier:3}, goldCost:600 },
  { id:'forge_all_2', name:'均衡之骨', desc:'融合三块中级魂骨，铸造全属性骨',
    materials:[{type:'any',count:3,minTier:2}], result:{name:'均衡之骨',type:'balanced',attack:8,defense:8,hp:40,speed:4,tier:3}, goldCost:800 },
  { id:'forge_supreme', name:'至尊之骨', desc:'需要五块高级魂骨，有概率锻造出至尊魂骨',
    materials:[{type:'any',count:5,minTier:3}], result:{name:'至尊魂骨',type:'supreme',attack:25,defense:20,hp:100,speed:10,tier:4}, goldCost:2000, successRate:0.7 }
];

// ==================== 支线任务 ====================
export const QUESTS = [
  { id:'q_hunt_10', name:'初猎试炼', desc:'猎杀10只魂兽', type:'hunt', target:10, reward:{gold:200,exp:100} },
  { id:'q_hunt_30', name:'老练猎人', desc:'猎杀30只魂兽', type:'hunt', target:30, reward:{gold:500,exp:300} },
  { id:'q_hunt_100', name:'百兽之敌', desc:'猎杀100只魂兽', type:'hunt', target:100, reward:{gold:2000,exp:1500} },
  { id:'q_win_10', name:'初战成名', desc:'赢得10场战斗', type:'win', target:10, reward:{gold:200,exp:100} },
  { id:'q_win_50', name:'百战之将', desc:'赢得50场战斗', type:'win', target:50, reward:{gold:1000,exp:800} },
  { id:'q_lv_20', name:'魂师之路', desc:'达到20级', type:'level', target:20, reward:{gold:500,exp:300} },
  { id:'q_lv_40', name:'魂王之境', desc:'达到40级', type:'level', target:40, reward:{gold:2000,exp:1500} },
  { id:'q_lv_60', name:'魂帝之威', desc:'达到60级', type:'level', target:60, reward:{gold:5000,exp:4000} },
  { id:'q_gold_5000', name:'富甲一方', desc:'累计获得5000金币', type:'gold', target:5000, reward:{gold:1000,exp:500} },
  { id:'q_explore_5', name:'足迹遍布', desc:'探索5个不同地点', type:'explore', target:5, reward:{gold:300,exp:200} },
  { id:'q_explore_15', name:'大陆行者', desc:'探索15个不同地点', type:'explore', target:15, reward:{gold:1000,exp:800} },
  { id:'q_tower_5', name:'塔之挑战者', desc:'通过挑战塔第5层', type:'tower', target:5, reward:{gold:800,exp:600} },
  { id:'q_tower_10', name:'塔之征服者', desc:'通过挑战塔第10层', type:'tower', target:10, reward:{gold:2000,exp:1500} },
  { id:'q_ring_5', name:'五环魂师', desc:'获得5个魂环', type:'rings', target:5, reward:{gold:500,exp:400} },
  { id:'q_ring_7', name:'七环魂圣', desc:'获得7个魂环', type:'rings', target:7, reward:{gold:1500,exp:1200} }
];

// ==================== NPC好感度系统 ====================
export const NPC_RELATION_LEVELS = [
  { min:0,   name:'陌路人',   color:'#a89a7c' },
  { min:20,  name:'相识',     color:'#c9a84c' },
  { min:50,  name:'友善',     color:'#7fc48c' },
  { min:100, name:'信赖',     color:'#5a8fc4' },
  { min:200, name:'挚友',     color:'#a78bfa' },
  { min:350, name:'生死之交', color:'#e6c878' },
  { min:500, name:'灵魂伴侣', color:'#ff8ab8' }
];

// ==================== 新手引导 ====================
export const TUTORIAL_STEPS = [
  { id:'welcome', title:'欢迎来到斗罗大陆！', text:'这是一段可实际操作的引导。高亮区域仍然可以点击；你也可以随时按 Esc 跳过，并在设置中重新查看。', btn:'开始引导', target:'#scene-area' },
  { id:'panel', title:'状态与成长', text:'这里显示等级、生命、魂力、经验、属性与魂环。移动端可先展开状态栏再查看。', btn:'下一步', target:'.status-panel' },
  { id:'events', title:'剧情选项', text:'中央叙事区会呈现故事与选择。选项会真实改变属性、关系、路线或后续事件，无法选择时会显示条件。', btn:'下一步', target:'#scene-area' },
  { id:'battle', title:'亲自完成一次战斗操作', text:'现在进入无奖励的教学试战。请点击“普通攻击”击中训练木偶；正式战斗还可使用魂技、防御、道具、自动与倍速。', btn:'开始试战', target:'#scene-area', action:'battle' },
  { id:'rings', title:'魂环与魂技', text:'魂环卡显示序号、年份、魂技和来源。已获得的魂环可以点击查看详情；每10级会解锁新的猎魂机会。', btn:'下一步', target:'#rings-row' },
  { id:'bag', title:'打开正式背包', text:'请点击高亮的“背包”。所有背包入口都使用同一库存与使用规则；战斗专用道具会明确说明使用场景。', btn:'请点击高亮目标', target:'#btn-bag', action:'click' },
  { id:'save', title:'保存冒险', text:'请点击“存档”。游戏会先写入本地，再等待服务器结果；服务器离线时会明确提示仅本地成功。', btn:'请点击高亮目标', target:'#btn-save', action:'click' },
  { id:'end', title:'准备就绪！', text:'魂环、背包和存档都已亲自看过。现在继续第一段正式剧情；日后可从设置重新查看引导。', btn:'开始冒险！', target:'#scene-area' }
];

// ==================== 商店系统 ====================
export const SHOP_ITEMS = [
  { id:'heal_small', name:'回魂丹', desc:'恢复60点生命', type:'heal', value:60, price:30, icon:'💊' },
  { id:'heal_large', name:'大还丹', desc:'恢复200点生命', type:'heal', value:200, price:80, icon:'❤️', reqLevel:10 },
  { id:'heal_full', name:'九转还魂丹', desc:'恢复全部生命', type:'healFull', value:9999, price:300, icon:'✨', reqLevel:25 },
  { id:'mp_small', name:'聚魂丹', desc:'恢复40点魂力', type:'mp', value:40, price:40, icon:'🔮' },
  { id:'mp_large', name:'凝魂丹', desc:'恢复120点魂力', type:'mp', value:120, price:100, icon:'🔷', reqLevel:10 },
  { id:'buff_atk', name:'狂暴丹', desc:'战斗中攻击力提升20%（3回合）', type:'buffAtk', value:0.2, price:150, icon:'⚔', reqLevel:15 },
  { id:'buff_def', name:'铁骨丹', desc:'战斗中防御力提升20%（3回合）', type:'buffDef', value:0.2, price:150, icon:'🛡', reqLevel:15 },
  { id:'buff_spd', name:'疾风丹', desc:'战斗中速度提升20%（3回合）', type:'buffSpd', value:0.2, price:150, icon:'💨', reqLevel:15 },
  { id:'exp_pill', name:'经验丹', desc:'立即获得500经验', type:'exp', value:500, price:200, icon:'📚', reqLevel:5 },
  { id:'fate_pill', name:'命运丹', desc:'命运值+1', type:'fate', value:1, price:500, icon:'☆', reqLevel:20 },
  { id:'antidote', name:'解毒丹', desc:'解除中毒状态', type:'cure', value:'poison', price:50, icon:'🌿' },
  { id:'cleanser', name:'净化符', desc:'解除所有负面状态', type:'cureAll', value:0, price:120, icon:'🔱', reqLevel:10 }
];

// ==================== 修炼系统 ====================
export const TRAINING_OPTIONS = [
  { id:'train_basic', name:'基础修炼', desc:'花费少量金币进行基础修炼，获得少量经验',
    goldCost:50, expGain:30, time:'半天' },
  { id:'train_intensive', name:'高强度修炼', desc:'花费较多金币进行高强度修炼，获得大量经验',
    goldCost:200, expGain:450, time:'一天' },
  { id:'train_meditation', name:'冥想感悟', desc:'花费金币冥想感悟，获得经验并恢复魂力',
    goldCost:150, expGain:80, mpRestore:30, time:'半天' },
  { id:'train_spar', name:'切磋武艺', desc:'与同学切磋，有概率获得额外属性提升',
    goldCost:100, expGain:60, statChance:0.3, time:'半天' },
  { id:'train_secret', name:'秘境修炼', desc:'在特殊秘境中修炼，经验丰厚但有风险',
    goldCost:500, expGain:400, risk:0.15, time:'一天' }
];

// ==================== 动态事件系统 ====================
// 根据游戏状态(HP、金币、连击等)触发的特殊事件
export const DYNAMIC_EVENTS = [
  {
    id: 'dyn_low_hp',
    name: '濒死顿悟',
    condition: (G) => G.hp > 0 && G.hp < G.finalStats.maxHp * 0.15,
    weight: 5,
    once: true,
    text: '你在生死边缘徘徊，意识逐渐模糊。就在这千钧一发之际，一股奇异的力量从体内涌出——这是武魂的共鸣！',
    choices: [
      {
        text: '拥抱这股力量',
        req: (G) => G.level >= 5,
        requirementHint: '等级达到 Lv.5',
        effect: (G) => {
          G.hp = Math.round(G.finalStats.maxHp * 0.5);
          G.fatePoints = (G.fatePoints || 0) + 1;
          G._dynSurvived = true;
          return '武魂在绝境中觉醒！恢复了50%生命，命运值+1！';
        }
      },
      {
        text: '谨慎对待',
        effect: (G) => {
          G.hp = Math.round(G.finalStats.maxHp * 0.3);
          return '你克制住了冲动，缓缓恢复了一些生命。';
        }
      }
    ]
  },
  {
    id: 'dyn_rich',
    name: '神秘商人',
    condition: (G) => G.gold >= 5000,
    weight: 3,
    once: true,
    text: '一位戴着斗笠的神秘商人出现在你面前，他从怀中取出一个散发着幽光的锦盒："客人，这件宝物只卖给有缘人——五千金币，要不要？"',
    choices: [
      {
        text: '购买（5000金币）',
        req: (G) => G.gold >= 5000,
        requirementHint: '持有 5000 金币',
        effect: (G) => {
          G.gold -= 5000;
          G._dynMerchant = true;
          const luck = Math.random();
          if(luck < 0.3){
            G.fatePoints = (G.fatePoints || 0) + 2;
            return '锦盒中是一枚远古命运之石！命运值+2！';
          } else if(luck < 0.7){
            G.bonus.attack = (G.bonus.attack || 0) + 10;
            if(!G._forgeBones) G._forgeBones = [];
            G._forgeBones.push({ source:'神秘商人', tier:2, obtainedAt:Date.now() });
            return '锦盒中是一块魂骨精华！攻击永久+10，并获得一块锻造材料！';
          } else {
            G.gold += 3000;
            G._totalGoldEarned = (G._totalGoldEarned || 0) + 3000;
            return '锦盒中是三千金币！虽然没赚多少，但也不亏。';
          }
        }
      },
      {
        text: '拒绝',
        effect: () => '你摇了摇头。商人笑了笑，消失在人群中。'
      }
    ]
  },
  {
    id: 'dyn_combo_master',
    name: '连击大师',
    condition: (G, ctx) => ctx && ctx.combo >= 5,
    weight: 8,
    once: false,
    cooldown: 10,
    text: '你的连续攻击引起了周围魂师的注意。一位老者走上前来："年轻人，你的攻势凌厉，但缺乏变化。要不要学一招？"',
    choices: [
      {
        text: '请教老者',
        effect: (G) => {
          if(Math.random() < 0.5){
            G.bonus.attack = (G.bonus.attack || 0) + 5;
            return '老者传授了你一套连击心法，攻击力永久+5！';
          } else {
            G.spiritPower = Math.min(G.maxSpiritPower, G.spiritPower + 20);
            return '老者指点你调整呼吸，魂力恢复20点！';
          }
        }
      },
      {
        text: '婉言谢绝',
        effect: () => '你向老者道谢，但他只是微微一笑便离开了。'
      }
    ]
  },
  {
    id: 'dyn_night',
    name: '月夜修炼',
    condition: (G, ctx) => ctx && ctx.timeOfDay === 'night',
    weight: 5,
    once: false,
    cooldown: 5,
    text: '月光如水洒落，你感到体内的灵力在月光的浸润下变得格外活跃。这是一个修炼的良机。',
    choices: [
      {
        text: '盘膝修炼',
        effect: (G) => {
          const exp = 30 + G.level * 5;
          G._nightTraining = true;
          G.exp += exp;
          return `月光修炼效果显著！获得${exp}点经验！`;
        }
      },
      {
        text: '欣赏月色',
        effect: (G) => {
          G.fatePoints = (G.fatePoints || 0) + 1;
          return '宁静的月夜让你心境提升，命运值+1！';
        }
      }
    ]
  },
  {
    id: 'dyn_lucky',
    name: '意外之财',
    condition: (G) => G.gold < 200,
    weight: 6,
    once: false,
    cooldown: 8,
    text: '你在路边发现了一个布包，打开一看，里面竟然有一些金币和一张泛黄的纸条。',
    choices: [
      {
        text: '收下金币',
        effect: (G) => {
          const gold = 100 + Math.floor(Math.random() * 200);
          G.gold += gold;
          G._dynLucky = true;
          return `你获得了${gold}金币！纸条上写着："有缘人，愿这小小帮助能助你一臂之力。"`;
        }
      },
      {
        text: '寻找失主',
        req: (G) => G.level >= 10,
        requirementHint: '等级达到 Lv.10',
        effect: (G) => {
          G.fatePoints = (G.fatePoints || 0) + 2;
          G.gold += 50;
          return '你找到了失主，他感激不尽，给了你50金币作为酬谢。命运值+2！';
        }
      }
    ]
  }
];

// ==================== 连锁事件系统 ====================
// 前一个事件的选择会影响后续事件的触发
export const CHAINED_EVENTS = {
  // 师徒线
  mentor_1: {
    id: 'mentor_1',
    name: '路边的老者',
    phase: 'academy',
    minLevel: 5,
    weight: 3,
    tags: ['social', 'wisdom'],
    text: '你在路边看到一位老者坐在树下喝茶，他向你招了招手："年轻人，过来坐坐？"',
    choices: [
      {
        text: '坐下聊天',
        next: 'mentor_2',
        effect: (G) => { G._mentorMet = true; return '老者和你聊了许多关于魂师修炼的心得，你受益匪浅。'; }
      },
      {
        text: '匆忙离开',
        effect: () => '你向老者点头致意，继续赶路。'
      }
    ]
  },
  mentor_2: {
    id: 'mentor_2',
    name: '老者的考验',
    phase: 'academy',
    minLevel: 8,
    weight: 5,
    requires: (G) => G._mentorMet,
    tags: ['social', 'wisdom', 'test'],
    text: '你又遇到了那位老者，这次他站起身来："上次聊得投机，今天想试试你的身手。来，接我一招！"',
    choices: [
      {
        text: '全力迎战',
        next: 'mentor_3_good',
        req: (G) => G.level >= 8,
        requirementHint: '等级达到 Lv.8',
        effect: (G) => { G._mentorTested = true; return '你与老者过招，虽然差距明显，但他满意地点了点头。'; }
      },
      {
        text: '谦让推辞',
        next: 'mentor_3_neutral',
        effect: (G) => { G._mentorTested = true; return '老者笑了笑："谨慎也是好事。"'; }
      }
    ]
  },
  mentor_3_good: {
    id: 'mentor_3_good',
    name: '师徒之缘',
    phase: 'adventure',
    minLevel: 15,
    weight: 5,
    requires: (G) => G._mentorTested,
    tags: ['social', 'wisdom', 'mentor'],
    text: '那位老者再次出现在你面前，这次他的表情十分认真："孩子，我观察你很久了。你愿意做我的弟子吗？"',
    choices: [
      {
        text: '拜师',
        effect: (G) => {
          G.fatePoints = (G.fatePoints || 0) + 3;
          G._mentorAccepted = true;
          if(!G._npcRelations || Array.isArray(G._npcRelations)) G._npcRelations = {};
          G._npcRelations['神秘老者'] = Math.max(G._npcRelations['神秘老者'] || 0, 100);
          G.bonus.attack = (G.bonus.attack || 0) + 5;
          G.bonus.defense = (G.bonus.defense || 0) + 5;
          return '老者露出欣慰的笑容，传授了你一门独特功法。命运值+3，攻击与防御各+5！';
        }
      },
      {
        text: '婉拒',
        effect: (G) => {
          G.fatePoints = (G.fatePoints || 0) + 1;
          return '老者并不介意，反而赞赏你的独立。命运值+1。';
        }
      }
    ]
  },
  mentor_3_neutral: {
    id: 'mentor_3_neutral',
    name: '再次相遇',
    phase: 'adventure',
    minLevel: 15,
    weight: 5,
    requires: (G) => G._mentorTested,
    tags: ['social', 'wisdom'],
    text: '你在旅途中再次遇到了那位老者。他递给你一本书："这本修炼心得送给你，算是缘分。"',
    choices: [
      {
        text: '感谢收下',
        effect: (G) => {
          G.fatePoints = (G.fatePoints || 0) + 2;
          return '你获得了老者的修炼心得，命运值+2！';
        }
      }
    ]
  }
};

// ==================== 时间/天气系统 ====================
export const TIME_PERIODS = [
  { id: 'dawn',    name: '清晨', icon: '🌅', desc: '万物苏醒，修炼效率提升', mod: { expMult: 1.2 } },
  { id: 'day',     name: '白昼', icon: '☀️', desc: '适合冒险和探索',     mod: { encounterMult: 1.0 } },
  { id: 'dusk',    name: '黄昏', icon: '🌇', desc: '魂兽活跃，遭遇率提升', mod: { encounterMult: 1.3 } },
  { id: 'night',   name: '夜晚', icon: '🌙', desc: '修炼良机，但危险增加', mod: { expMult: 1.5, dangerMult: 1.5 } }
];

export const WEATHER_TYPES = [
  { id: 'clear',   name: '晴朗', icon: '☀️',  desc: '天气晴好',          mod: {} },
  { id: 'cloudy',  name: '多云', icon: '☁️',  desc: '云层遮挡阳光',      mod: {} },
  { id: 'rain',    name: '小雨', icon: '🌧️', desc: '雨水冲刷大地',      mod: { encounterMult: 0.8 } },
  { id: 'storm',   name: '暴雨', icon: '⛈️',  desc: '电闪雷鸣，不宜外出', mod: { dangerMult: 2.0, encounterMult: 0.5 } },
  { id: 'fog',     name: '迷雾', icon: '🌫️', desc: '能见度低，神秘感增强', mod: { mysteryMult: 1.5 } },
  { id: 'snow',    name: '降雪', icon: '❄️',  desc: '雪花纷飞，万物寂静', mod: { expMult: 1.1 } }
];
