import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useCombatStore } from '@/stores/combat'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useGameData } from '@/composables/useGameData'
import { useGameRules } from '@/composables/useGameRules'
import { useBattleSystem } from '@/composables/useBattleSystem'
import { saveToLocal } from '@/stores/serializer'
import { advanceExperience, previewDailySign, recordDailySign } from '@/engine/rules'
import {
  ACHIEVEMENTS, CHALLENGE_TOWER, DAILY_REWARDS, FORGE_RECIPES,
  NPC_RELATION_LEVELS, QUESTS, SHOP_ITEMS, SKILL_TREE, TITLES, TRAINING_OPTIONS
} from '@/data/game-data'

export const FORMATIONS = [
  { id: 'none', name: '无阵法', desc: '自由战斗', bonus: '无加成' },
  { id: 'attack', name: '冲锋阵', desc: '集中力量强攻', bonus: '攻击+15%，防御-10%' },
  { id: 'defense', name: '铁桶阵', desc: '稳扎稳打', bonus: '防御+20%，攻击-5%' },
  { id: 'speed', name: '疾风阵', desc: '抢占先机', bonus: '速度+25%' },
  { id: 'spirit', name: '聚灵阵', desc: '凝聚魂力', bonus: '最大魂力与恢复+30%' }
]

const NPC_INTERACTIONS = [
  { id: 'talk', name: '闲谈', cost: 0, affinity: 3, cooldown: 3 },
  { id: 'gift_small', name: '赠送小礼', cost: 100, affinity: 8, cooldown: 2 },
  { id: 'gift_big', name: '赠送重礼', cost: 500, affinity: 20, cooldown: 5 },
  { id: 'spar', name: '切磋武艺', cost: 0, affinity: 15, cooldown: 5, type: 'battle' },
  { id: 'help', name: '协助事务', cost: 0, affinity: 10, cooldown: 4, reqLevel: 10 },
  { id: 'feast', name: '设宴款待', cost: 1000, affinity: 35, cooldown: 10, reqLevel: 15 }
]

function localDateKey() {
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function useGameFeatures() {
  const player = usePlayerStore()
  const combat = useCombatStore()
  const eventStore = useEventStore()
  const gameStore = useGameStore()
  const ui = useUiStore()
  const { data } = useGameData()
  const { expNeeded, finalStats, getMaxSpiritPower } = useGameRules()
  const battle = useBattleSystem()

  const flags = computed(() => eventStore._dynamicFlags || (eventStore._dynamicFlags = {}))
  const snapshot = computed(() => ({
    ...flags.value,
    ...player.$state,
    ...combat.$state,
    ...eventStore.$state,
    ...gameStore.$state,
    _diary: eventStore._diary,
    _activeTitle: flags.value._activeTitle,
    _activeFormation: flags.value._activeFormation,
    _quests: flags.value._quests
  }))

  function persist(message, type = 'success') {
    try {
      saveToLocal()
    } catch (error) {
      ui.notify(`进度未能写入本地：${error.message}`, 'error', 5000)
      return false
    }
    if (message) ui.notify(message, type)
    return true
  }

  function addDiary(text, type = 'event') {
    eventStore.addDiaryEntry({ text, type, time: Date.now() })
  }

  function awardExp(amount) {
    // 满级后所有经验来源统一转化为金币（T14，判例 16）：事件路径同款逻辑，
    // 避免训练/塔/签到/经验丹在满级后静默清零让玩家白亏。
    if (player.level >= 100) {
      const converted = Math.max(0, Math.round(Number(amount) || 0))
      if (converted > 0) {
        player.gold += converted
        gameStore._totalGoldEarned += converted
        ui.notify(`已满级，${converted} 点经验转化为金币`, 'info')
      }
      return converted
    }
    const beforeLevel = player.level
    const next = advanceExperience({
      level: player.level,
      exp: player.exp,
      overflowExp: player.overflowExp,
      ringCount: player.rings?.length || 0
    }, amount, expNeeded)
    player.level = next.level
    player.exp = next.exp
    player.overflowExp = next.overflowExp
    if (next.capped) eventStore.pendingRingLv = player.level
    if (player.level > beforeLevel) {
      const fs = finalStats()
      player.hp = Math.min(fs.maxHp, player.hp + Math.round(fs.maxHp * 0.5))
    }
    return Math.max(0, Math.round(Number(amount) || 0))
  }

  function addGold(amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0))
    player.gold += value
    gameStore._totalGoldEarned += value
    return value
  }

  function useInventoryItem(index) {
    if (combat._battleActive) return ui.notify('战斗中请使用战斗界面的“道具”按钮', 'warning')
    const item = player.inventory[index]
    if (!item || item.count <= 0) return
    const maxHp = finalStats().maxHp
    let message = ''
    if (item.type === 'heal' || item.type === 'healFull') {
      const before = player.hp
      player.hp = item.type === 'healFull' ? maxHp : Math.min(maxHp, player.hp + Number(item.value || 0))
      if (player.hp === before) return ui.notify('当前生命已满', 'info')
      message = `恢复 ${player.hp - before} 点生命`
    } else if (item.type === 'mp') {
      const before = player.spiritPower
      player.spiritPower = Math.min(getMaxSpiritPower(), player.spiritPower + Number(item.value || 0))
      if (player.spiritPower === before) return ui.notify('当前魂力已满', 'info')
      message = `恢复 ${player.spiritPower - before} 点魂力`
    } else if (item.type === 'buffAtk') {
      player._tempAtkBuff = Number(item.value || 0.2); message = '下场战斗获得3回合攻击增益'
    } else if (item.type === 'buffDef') {
      player._tempDefBuff = Number(item.value || 0.2); message = '下场战斗获得3回合防御增益'
    } else if (item.type === 'buffSpd') {
      player._tempSpdBuff = Number(item.value || 0.2); message = '下场战斗获得3回合速度增益'
    } else if (item.type === 'cure' || item.type === 'cureAll') {
      return ui.notify('净化类道具只能在战斗中使用', 'info')
    } else {
      return ui.notify('该物品当前不能直接使用', 'info')
    }
    item.count--
    player.inventory = player.inventory.filter(entry => entry.count > 0)
    addDiary(`使用「${item.name}」，${message}。`)
    persist(`已使用「${item.name}」：${message}`)
  }

  function buyItem(itemId) {
    const item = SHOP_ITEMS.find(entry => entry.id === itemId)
    if (!item || (item.reqLevel && player.level < item.reqLevel)) return
    if (player.gold < item.price) return ui.notify('金币不足', 'warning')
    player.gold -= item.price
    if (item.type === 'exp') awardExp(item.value)
    else if (item.type === 'fate') player.fatePoints += item.value
    else {
      const owned = player.inventory.find(entry => entry.id === item.id || entry.name === item.name)
      if (owned) owned.count = (owned.count || 0) + 1
      else player.inventory.push({ id: item.id, name: item.name, desc: item.desc, type: item.type, value: item.value, count: 1 })
    }
    addDiary(`在商店购买「${item.name}」，花费${item.price}金币。`)
    persist(`购买成功：${item.name}`)
  }

  function signPreview(todayKey) {
    const today = todayKey || localDateKey()
    return { ...previewDailySign(gameStore._dailySign, today), today }
  }

  function dailySign(todayKey) {
    const today = todayKey || localDateKey()
    const recorded = recordDailySign(gameStore._dailySign, today)
    if (!recorded.changed) return ui.notify('今日已经签到', 'info')
    gameStore._dailySign = recorded.sign
    const reward = DAILY_REWARDS[recorded.rewardDay - 1]?.reward || {}
    const items = [`第${recorded.rewardDay}天奖励`]
    if (reward.gold) items.push(`金币+${addGold(reward.gold)}`)
    if (reward.exp) items.push(`经验+${awardExp(reward.exp)}`)
    if (reward.fatePoint) {
      player.fatePoints += reward.fatePoint
      items.push(`命运值+${reward.fatePoint}`)
    }
    addDiary(`每日签到第${recorded.rewardDay}档，连续${recorded.nextStreak}天。`)
    // 成就解锁必须在签到后单独提示，其 50 金币/20 经验不能静默混入签到奖励。
    checkAchievements(true)
    persist(`签到成功，领取${items.join('，')}`)
  }

  function totalSkillPoints() { return Math.floor(player.level / 5) * 2 }
  function usedSkillPoints() {
    return Object.values(SKILL_TREE).flatMap(branch => branch.nodes)
      .filter(node => player._skillTree[node.id]).reduce((sum, node) => sum + node.cost, 0)
  }
  function applySkillBonuses() {
    const result = {}
    for (const branch of Object.values(SKILL_TREE)) for (const node of branch.nodes) {
      if (!player._skillTree[node.id]) continue
      for (const [key, value] of Object.entries(node.effect || {})) {
        result[key] = typeof value === 'boolean' ? value : (result[key] || 0) + value
      }
    }
    player._skillBonuses = result
  }
  function learnSkill(node) {
    if (!node || player._skillTree[node.id]) return
    if (!node.req.every(id => player._skillTree[id])) return ui.notify('请先学习前置节点', 'warning')
    if (totalSkillPoints() - usedSkillPoints() < node.cost) return ui.notify('技能点不足', 'warning')
    player._skillTree[node.id] = true
    applySkillBonuses()
    persist(`习得技能树节点「${node.name}」`)
  }
  function resetSkills() {
    if (combat._battleActive) return ui.notify('战斗中不能重置技能树', 'warning')
    player._skillTree = {}
    applySkillBonuses()
    persist('技能树已重置')
  }

  function forge(recipeId) {
    const recipe = FORGE_RECIPES.find(entry => entry.id === recipeId)
    if (!recipe) return
    const material = recipe.materials[0]
    const eligible = player._forgeBones.map((bone, index) => ({ bone, index }))
      .filter(entry => (Number(entry.bone.tier) || 1) >= material.minTier).slice(0, material.count)
    if (player.gold < recipe.goldCost || eligible.length < material.count) return ui.notify('锻造材料或金币不足', 'warning')
    eligible.map(entry => entry.index).sort((a, b) => b - a).forEach(index => player._forgeBones.splice(index, 1))
    player.gold -= recipe.goldCost
    if (recipe.successRate && Math.random() > recipe.successRate) {
      const refund = Math.max(1, Math.floor(material.count / 2))
      for (let i = 0; i < refund; i++) player._forgeBones.push({ source: `锻造返还·${recipe.name}`, tier: material.minTier, refunded: true })
      addDiary(`锻造「${recipe.name}」失败。`)
      persist(`锻造失败，返还${refund}块材料`, 'warning')
      return
    }
    player._craftedBones.push({ ...recipe.result, craftedAt: Date.now() })
    addDiary(`成功锻造「${recipe.result.name}」。`, 'discovery')
    checkAchievements(false)
    persist(`锻造成功：${recipe.result.name}`)
  }

  function train(optionId) {
    const option = TRAINING_OPTIONS.find(entry => entry.id === optionId)
    if (!option || player.gold < option.goldCost) return ui.notify('金币不足', 'warning')
    player.gold -= option.goldCost
    let exp = option.expGain
    let extra = ''
    if (option.risk && Math.random() < option.risk) {
      const damage = Math.max(1, Math.round(finalStats().maxHp * 0.2))
      player.hp = Math.max(1, player.hp - damage)
      exp = Math.round(exp * 0.5)
      extra = `，遭遇反噬损失${damage}生命`
    }
    awardExp(exp)
    if (option.mpRestore) player.spiritPower = Math.min(getMaxSpiritPower(), player.spiritPower + option.mpRestore)
    if (option.statChance && Math.random() < option.statChance) {
      const keys = ['attack', 'defense', 'speed']
      const key = keys[Math.floor(Math.random() * keys.length)]
      player.bonus[key] = (player.bonus[key] || 0) + 1
      extra += `，${{ attack: '攻击', defense: '防御', speed: '速度' }[key]}永久+1`
    }
    gameStore.advanceTime()
    addDiary(`完成「${option.name}」，获得${exp}经验${extra}。`)
    persist(`修炼完成：经验+${exp}${extra}`)
  }

  function questProgress(type) {
    return ({
      hunt: combat.battleStats.kills, win: combat.battleStats.wins, level: player.level,
      gold: gameStore._totalGoldEarned, explore: gameStore._visitedLocations.length,
      tower: gameStore._towerFloor, rings: player.rings.length
    })[type] || 0
  }
  function claimQuest(questId) {
    const quest = QUESTS.find(entry => entry.id === questId)
    const quests = flags.value._quests || (flags.value._quests = {})
    if (!quest || quests[`${questId}_claimed`] || questProgress(quest.type) < quest.target) return
    quests[`${questId}_claimed`] = true
    if (quest.reward.gold) addGold(quest.reward.gold)
    if (quest.reward.exp) awardExp(quest.reward.exp)
    addDiary(`完成任务「${quest.name}」。`)
    persist(`任务奖励已领取：${quest.name}`)
  }

  function combatPower() {
    const fs = finalStats()
    return Math.round(fs.attack * 35 + fs.defense * 28 + fs.maxHp * 3 + fs.speed * 22 + player.level * 80)
  }
  function checkAchievements(notify = true) {
    const unlocked = player._achievementList || (player._achievementList = [])
    const G = snapshot.value
    for (const achievement of ACHIEVEMENTS) {
      if (unlocked.includes(achievement.id)) continue
      if (achievement.id === 'power_10k' && combatPower() < 10000) continue
      if (achievement.id === 'power_30k' && combatPower() < 30000) continue
      if (achievement.id === 'power_50k' && combatPower() < 50000) continue
      let met = false
      try { met = Boolean(achievement.cond(G)) } catch { met = false }
      if (!met) continue
      unlocked.push(achievement.id)
      addGold(50); awardExp(20)
      if (notify) ui.notify(`解锁成就「${achievement.name}」，奖励金币+50、经验+20`, 'gold')
    }
    try { saveToLocal() } catch (error) { ui.notify(`成就进度保存失败：${error.message}`, 'error', 5000) }
  }

  function unlockedTitles() {
    const G = snapshot.value
    const power = combatPower()
    return TITLES.filter(title => {
      if (title.id === 'power_elite' && power < 10000) return false
      if (title.id === 'power_epic' && power < 30000) return false
      if (title.id === 'power_god' && power < 50000) return false
      try { return Boolean(title.cond(G)) } catch { return false }
    })
  }
  function equipTitle(titleId) {
    if (!unlockedTitles().some(title => title.id === titleId)) return
    flags.value._activeTitle = titleId
    if (!player._titles.includes(titleId)) player._titles.push(titleId)
    persist(`已佩戴称号「${TITLES.find(title => title.id === titleId)?.name}」`)
  }

  function selectFormation(id) {
    const formation = FORMATIONS.find(entry => entry.id === id)
    if (!formation) return
    flags.value._activeFormation = id
    if (id !== 'none' && !combat._formationsUsed.includes(id)) combat._formationsUsed.push(id)
    persist(`已切换至「${formation.name}」`)
  }

  function relationLevel(value) {
    return [...NPC_RELATION_LEVELS].reverse().find(level => value >= level.min) || NPC_RELATION_LEVELS[0]
  }
  function canInteract(npcId, interaction) {
    if (!gameStore._metNpcs.includes(npcId)) return { ok: false, reason: '尚未结识' }
    if (interaction.reqLevel && player.level < interaction.reqLevel) return { ok: false, reason: `需要${interaction.reqLevel}级` }
    if (player.gold < interaction.cost) return { ok: false, reason: '金币不足' }
    const key = `${npcId}_${interaction.id}`
    if (Object.hasOwn(gameStore._npcCooldowns, key)) {
      const remaining = interaction.cooldown - (gameStore._gameTime - gameStore._npcCooldowns[key])
      if (remaining > 0) return { ok: false, reason: `冷却${remaining}次行动` }
    }
    return { ok: true }
  }
  function interactNpc(npcId, interactionId) {
    const interaction = NPC_INTERACTIONS.find(entry => entry.id === interactionId)
    const npc = data.value.npcData.find(entry => entry.id === npcId)
    const check = interaction && canInteract(npcId, interaction)
    if (!interaction || !npc || !check.ok) return ui.notify(check?.reason || '无法互动', 'warning')
    player.gold -= interaction.cost
    let gain = interaction.affinity
    let extra = ''
    if (interaction.id === 'help') { const exp = 20 + player.level * 3; awardExp(exp); extra = `，经验+${exp}` }
    if (interaction.id === 'feast') { const heal = Math.round(finalStats().maxHp * 0.3); player.hp = Math.min(finalStats().maxHp, player.hp + heal); extra = `，生命+${heal}` }
    if (interaction.id === 'gift_big' && Math.random() < 0.3) { const back = 100 + Math.floor(Math.random() * 201); addGold(back); extra = `，获赠${back}金币` }
    gameStore.setNpcRelation(npcId, (gameStore._npcRelations[npcId] || 0) + gain)
    gameStore._npcCooldowns[`${npcId}_${interaction.id}`] = gameStore._gameTime
    gameStore.advanceTime()
    addDiary(`与「${npc.name}」进行「${interaction.name}」，好感+${gain}。`, 'npc')
    persist(`与${npc.name}互动成功：好感+${gain}${extra}`)
  }

  function startNpcSpar(npcId, hooks = {}) {
    const interaction = NPC_INTERACTIONS.find(entry => entry.id === 'spar')
    const npc = data.value.npcData.find(entry => entry.id === npcId)
    const check = interaction && canInteract(npcId, interaction)
    if (!interaction || !npc || !check.ok || battle.isActive()) {
      ui.notify(check?.reason || '当前无法发起切磋', 'warning')
      return false
    }

    const relation = Number(gameStore._npcRelations[npcId]) || 0
    const scale = Math.min(1.08, 0.78 + player.level * 0.002 + relation * 0.00035)
    const stats = finalStats()
    const enemy = {
      id: `npc_spar_${npcId}`,
      name: npc.name,
      icon: '🤺',
      image: npc.image || null,
      isNpc: true,
      isBoss: false,
      attack: Math.max(1, Math.round(stats.attack * scale * 0.72)),
      defense: Math.max(0, Math.round(stats.defense * scale * 0.55)),
      hp: Math.max(20, Math.round(stats.maxHp * scale * 0.85)),
      maxHp: Math.max(20, Math.round(stats.maxHp * scale * 0.85)),
      speed: Math.max(1, Math.round(stats.speed * scale * 0.8))
    }
    const cooldownKey = `${npcId}_spar`
    const expGain = 30 + player.level * 5
    addDiary(`向「${npc.name}」发起正式切磋。`, 'npc')

    battle.start(enemy, {
      allowFlee: false,
      countKill: false,
      onVictory: () => {
        const affinityGain = interaction.affinity + Math.floor(Math.random() * 6)
        awardExp(expGain)
        gameStore.setNpcRelation(npcId, relation + affinityGain)
        gameStore.advanceTime()
        gameStore._npcCooldowns[cooldownKey] = gameStore._gameTime
        flags.value._npcSparDone = true
        addDiary(`切磋战胜「${npc.name}」，获得${expGain}经验，好感提升${affinityGain}点。`, 'npc')
        checkAchievements(false)
        persist(`切磋胜利：经验+${expGain}，好感+${affinityGain}`)
        hooks.onVictory?.({ npc, expGain, affinityGain })
      },
      onDefeat: () => {
        const affinityGain = 2
        gameStore.setNpcRelation(npcId, relation + affinityGain)
        gameStore.advanceTime()
        gameStore._npcCooldowns[cooldownKey] = gameStore._gameTime
        addDiary(`切磋败给「${npc.name}」，但从中学到了不少。`, 'npc')
        persist(`切磋落败，但${npc.name}认可了你的勇气：好感+${affinityGain}`, 'warning')
        hooks.onDefeat?.({ npc, affinityGain })
      }
    })
    return true
  }

  function startTower(floorNumber, hooks = {}) {
    const floor = CHALLENGE_TOWER.floors.find(entry => entry.floor === floorNumber)
    if (!floor || floor.floor !== gameStore._towerFloor + 1 || player.level < floor.minLv || battle.isActive()) return false
    const enemy = { ...floor.enemy, maxHp: floor.enemy.hp, level: floor.minLv, id: `tower_${floor.floor}`, icon: '🏰', isNpc: true, isBoss: floor.floor % 5 === 0 }
    addDiary(`挑战塔第${floor.floor}层「${floor.name}」。`, 'battle')
    battle.start(enemy, {
      allowFlee: false,
      countKill: false,
      onVictory: () => {
        const isFirstClear = gameStore._towerFloor < floor.floor
        gameStore._towerFloor = floor.floor
        addGold(floor.reward.gold || 0)
        awardExp(floor.reward.exp || 0)
        // 魂骨碎片仅首通发放（T15，判例 21）：避免每层反复通关白嫖碎片
        if (isFirstClear) {
          const tier = floor.floor >= 15 ? 3 : floor.floor >= 8 ? 2 : 1
          player._forgeBones.push({ source: `挑战塔第${floor.floor}层·首通`, tier, obtainedAt: Date.now() })
          addDiary(`首通挑战塔第${floor.floor}层，获得${tier}阶魂骨碎片。`, 'battle')
        } else {
          addDiary(`再次通关挑战塔第${floor.floor}层，获得金币与经验。`, 'battle')
        }
        persist(`挑战塔第${floor.floor}层通关`)
        hooks.onVictory?.(floor)
      },
      onDefeat: () => {
        try { saveToLocal() } catch (error) { ui.notify(`挑战结果保存失败：${error.message}`, 'error', 5000) }
        hooks.onDefeat?.(floor)
      }
    })
    return true
  }

  return {
    player, combat, eventStore, gameStore, data, flags, snapshot,
    SHOP_ITEMS, DAILY_REWARDS, SKILL_TREE, FORGE_RECIPES, TRAINING_OPTIONS,
    QUESTS, ACHIEVEMENTS, TITLES, FORMATIONS, CHALLENGE_TOWER, NPC_INTERACTIONS,
    useInventoryItem, buyItem, signPreview, dailySign,
    totalSkillPoints, usedSkillPoints, learnSkill, resetSkills,
    forge, train, questProgress, claimQuest, checkAchievements,
    combatPower, unlockedTitles, equipTitle, selectFormation,
    relationLevel, canInteract, interactNpc, startNpcSpar, startTower
  }
}
