/**
 * 战斗系统 composable（编排层）
 * 回合流程 / store 写入 / 定时器调度；纯逻辑（元素克制 / 状态 / 伤害公式 /
 * 敌人构建）在 engine/battle-core.js，调参与直测改那里。
 * 交互契约见 engine/battle-contract.js（战斗不理解事件语义）。
 */
import { ref, reactive, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useCombatStore } from '@/stores/combat'
import { useUiStore } from '@/stores/ui'
import { useGameStore } from '@/stores/game'
import { resolveAssetPath } from '@/utils/asset-resolver'
import {
  ELEMENT_ICONS, ELEMENT_NAMES, STATUS_INFO, clamp,
  normalizeElement, elementMultiplier, statusDamageModifier, statusHtml,
  buildEnemy, addStatus, damageFormula, maybeApplyElementStatus, skillElement, scaleEnemyToPlayer
} from '@/engine/battle-core'
import { resolveConsumable } from '@/engine/item-effects'
import { applyExpGain } from '@/engine/settlement'
import { useGameData } from '@/composables/useGameData'
import { useGameRules } from '@/composables/useGameRules'


// ==================== 战斗状态 ====================

let battleState = null
const battleActive = ref(false)
let battleGeneration = 0

// 自动战斗调度：模块级单例定时器，多个组件实例共享同一句柄，避免重复 timer
let autoTimer = null
const AUTO_ACTION_DELAY = 900

function isCurrentBattleInstance(state, generation) {
  return battleState === state && battleGeneration === generation
}

function isCurrentBattleRunning(state, generation) {
  return isCurrentBattleInstance(state, generation) && !state.ended
}

function createState() {
  return reactive({
    enemy: null,
    options: {},
    round: 1,
    turn: 'player',
    logs: [],
    combo: 0,
    cooldowns: [],
    playerStatuses: [],
    enemyStatuses: [],
    defending: false,
    busy: false,
    ended: false,
    auto: false,
    speed: 1,
    showItems: false,
    bossPhase: 1,
    lastStandUsed: false,
    limitBreakUsed: false,
    lastFinisherCombo: 0,
    lastSkillElement: 'none',
    fusionUsed: false,
    feedback: null,
    phaseNotice: ''
  })
}

// ==================== Composable ====================

export function useBattleSystem() {
  const player = usePlayerStore()
  const combat = useCombatStore()
  const ui = useUiStore()
  const gameStore = useGameStore()
  const { data } = useGameData()
  const { finalStats, getMaxSpiritPower } = useGameRules()
  // 儿童版：战斗默认自动出招；玩家切到手动后记住选择（gameStore._autoBattleDefault）。
  const autoBattleDefault = computed(() => gameStore._autoBattleDefault !== false)

  const enemy = computed(() => battleState?.enemy || null)
  const logs = computed(() => battleState?.logs || [])
  const active = computed(() => battleActive.value && battleState && !battleState.ended)
  const turn = computed(() => battleState?.turn || 'player')
  const combo = computed(() => battleState?.combo || 0)
  const round = computed(() => battleState?.round || 1)
  const bossPhase = computed(() => battleState?.bossPhase || 1)
  const phaseNotice = computed(() => battleState?.phaseNotice || '')
  const feedback = computed(() => battleState?.feedback || null)
  const playerStatuses = computed(() => battleState ? battleState.playerStatuses : [])
  const enemyStatuses = computed(() => battleState ? battleState.enemyStatuses : [])
  const playerStatusDisplay = computed(() => statusHtml(battleState?.playerStatuses))
  const enemyStatusDisplay = computed(() => statusHtml(battleState?.enemyStatuses))
  const showItems = computed(() => battleState?.showItems || false)
  const autoMode = computed(() => battleState?.auto || false)
  const speedLabel = computed(() => (battleState?.speed || 1) + '×')
  const fusionUsed = computed(() => battleState?.fusionUsed || false)
  const allowFlee = computed(() => battleState?.options?.allowFlee !== false)
  const isBoss = computed(() => battleState?.enemy?.isBoss || false)

  const playerHpPct = computed(() => {
    if (!battleState) return 100
    const fs = finalStats()
    return clamp(player.hp / fs.maxHp * 100, 0, 100)
  })
  const enemyHpPct = computed(() => {
    if (!battleState?.enemy) return 100
    return clamp(battleState.enemy.hp / battleState.enemy.maxHp * 100, 0, 100)
  })
  const mpPct = computed(() => {
    if (!battleState) return 100
    const mpMax = getMaxSpiritPower()
    return clamp(player.spiritPower / mpMax * 100, 0, 100)
  })

  const playerElement = computed(() => normalizeElement(getSpiritElementStr()))
  const enemyElement = computed(() => battleState?.enemy ? normalizeElement(battleState.enemy.element) : 'none')

  const skills = computed(() => {
    if (!battleState) return []
    const sb = player._skillBonuses || {}
    return (player.skills || []).map((skill, index) => {
      const cost = Math.max(1, Math.round((skill.cost || 15) * (1 - (sb.mpCostReduction || 0))))
      const cooldown = battleState.cooldowns[index] || 0
      const disabled = battleState.turn !== 'player' || battleState.ended || battleState.busy || cooldown > 0 || player.spiritPower < cost
      return { skill, index, cost, cooldown, disabled, element: skillElement(index, skill) }
    })
  })

  const usableItems = computed(() => {
    if (!battleState) return []
    return (player.inventory || [])
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.count > 0 && ['heal', 'healFull', 'mp', 'buffAtk', 'buffDef', 'buffSpd', 'cure', 'cureAll'].includes(item.type))
  })

  // ==================== 辅助 ====================

  function getSpiritElementStr() {
    if (!player.spirit) return 'none'
    return `${player.spirit.id || ''} ${player.spirit.name || ''} ${player.spirit.type || ''} ${player.spirit.subtype || ''}`
  }

  function playerMaxSpirit() { return getMaxSpiritPower() }

  function addLog(text, type) {
    if (!battleState) return
    battleState.logs.push({ text: String(text), type: type || 'normal' })
    if (battleState.logs.length > 12) battleState.logs.shift()
  }

  function setFeedback(actor, target, text, type, skillName) {
    if (!battleState) return
    battleState.feedback = { actor, target, text: String(text || ''), type: type || 'damage', skillName: skillName || '' }
  }

  function tickStatuses(target) {
    const isPlayer = target === 'player'
    const list = isPlayer ? battleState.playerStatuses : battleState.enemyStatuses
    let skip = false
    for (const s of list) {
      const maxHp = isPlayer ? finalStats().maxHp : battleState.enemy.maxHp
      if (s.id === 'burn') {
        const dmg = Math.max(1, Math.round(maxHp * 0.035))
        if (isPlayer) player.damage(dmg); else battleState.enemy.hp -= dmg
        addLog(`${isPlayer ? player.name : battleState.enemy.name}受到燃烧伤害 ${dmg}。`, 'damage')
      } else if (s.id === 'poison') {
        const dmg = Math.max(1, Math.round(maxHp * 0.025 + (s.power || 0)))
        if (isPlayer) player.damage(dmg); else battleState.enemy.hp -= dmg
        addLog(`${isPlayer ? player.name : battleState.enemy.name}受到中毒伤害 ${dmg}。`, 'damage')
      } else if (s.id === 'regen') {
        const heal = Math.max(1, Math.round(maxHp * Math.max(0.03, s.power || 0.03)))
        if (isPlayer) player.heal(heal); else battleState.enemy.hp = Math.min(battleState.enemy.maxHp, battleState.enemy.hp + heal)
        addLog(`${isPlayer ? player.name : battleState.enemy.name}恢复了 ${heal} 点生命。`, 'heal')
      } else if (s.id === 'freeze' || s.id === 'stun') {
        skip = true
      }
    }
    list.forEach(s => s.turns--)
    const alive = list.filter(s => s.turns > 0)
    if (isPlayer) battleState.playerStatuses = alive; else battleState.enemyStatuses = alive
    return skip
  }

  function triggerElementReaction(element) {
    element = normalizeElement(element)
    const previous = battleState.lastSkillElement
    battleState.lastSkillElement = element
    if (element === 'none' || previous === 'none' || !previous || previous === element) return null
    const pair = [previous, element].sort().join('+')
    const names = {
      'fire+water': '蒸汽爆发', 'fire+wind': '烈焰风暴', 'ice+thunder': '超导反应',
      'thunder+water': '感电连锁', 'earth+wind': '沙暴肆虐', 'dark+light': '审判之光',
      'fire+ice': '融冰爆发', 'ice+water': '冻结反应', 'fire+wood': '燃烧蔓延'
    }
    const name = names[pair] || '元素共鸣'
    const damage = Math.max(1, Math.round(finalStats().attack * 0.42))
    battleState.enemy.hp = Math.max(0, battleState.enemy.hp - damage)
    combat._reactionTriggered = true
    combat._reactionCount = (Number(combat._reactionCount) || 0) + 1
    addLog(`${name}触发，额外造成 ${damage} 点伤害！`, 'crit')
    return { name, damage }
  }

  function updateBossPhase() {
    if (!battleState.enemy.isBoss) return
    const ratio = battleState.enemy.hp / battleState.enemy.maxHp
    const phase = ratio <= 0.3 ? 3 : (ratio <= 0.6 ? 2 : 1)
    if (phase <= battleState.bossPhase) return
    battleState.bossPhase = phase
    if (phase === 2) {
      battleState.enemy.attack = Math.round(battleState.enemy.attack * 1.18)
      addStatus(battleState.enemyStatuses, 'rage', 99)
      addLog(`${battleState.enemy.name}进入第二阶段，气息骤然暴涨！`, 'boss')
    } else {
      battleState.enemy.attack = Math.round(battleState.enemy.attack * 1.22)
      battleState.enemy.defense = Math.round(battleState.enemy.defense * 1.12)
      addStatus(battleState.enemyStatuses, 'shield', 2)
      addLog(`${battleState.enemy.name}进入最终阶段，释放了护体领域！`, 'boss')
    }
    battleState.phaseNotice = `${battleState.enemy.name} · 阶段 ${phase}`
  }

  function applyComboFinisher() {
    if (!battleState || battleState.enemy.hp <= 0 || battleState.combo < 5 || battleState.combo % 5 !== 0 || battleState.lastFinisherCombo === battleState.combo) return
    battleState.lastFinisherCombo = battleState.combo
    const bonus = Math.max(1, Math.round(finalStats().attack * (0.35 + battleState.combo * 0.025)))
    battleState.enemy.hp = Math.max(0, battleState.enemy.hp - bonus)
    combat._maxComboFinisher = Math.max(Number(combat._maxComboFinisher) || 0, battleState.combo)
    addLog(`${battleState.combo}连击触发连携终结，额外造成 ${bonus} 点伤害！`, 'crit')
  }

  function decrementCooldowns() {
    battleState.cooldowns = battleState.cooldowns.map(v => Math.max(0, v - 1))
  }

  // ==================== 玩家行动 ====================

  function performAttack() {
    if (!battleState || battleState.turn !== 'player' || battleState.busy || battleState.ended) return
    battleState.busy = true
    const fs = finalStats()
    const sb = player._skillBonuses || {}
    battleState.combo++
    combat._maxCombo = Math.max(Number(combat._maxCombo) || 0, battleState.combo)
    const comboMult = 1 + Math.min(0.6, Math.floor(battleState.combo / 5) * 0.1 + battleState.combo * 0.015 + (sb.comboBonus || 0))
    const critRate = clamp(0.05 + (sb.critRate || 0) + Math.max(0, fs.speed - battleState.enemy.speed) * 0.002 + battleState.combo * 0.005, 0.05, 0.65)
    const crit = Math.random() < critRate
    const element = normalizeElement(getSpiritElementStr())
    const elemental = elementMultiplier(element, battleState.enemy.element)
    const critMult = crit ? 1.5 + (sb.critDmg || 0) : 1
    let damage = damageFormula(fs.attack, battleState.enemy.defense, {
      penetration: sb.defPenetration || 0,
      multiplier: comboMult * elemental * critMult * statusDamageModifier(battleState.playerStatuses, true) * statusDamageModifier(battleState.enemyStatuses, false)
    })
    const shield = battleState.enemyStatuses.find(s => s.id === 'shield')
    if (shield) damage = Math.max(1, Math.round(damage * 0.55))
    battleState.enemy.hp = Math.max(0, battleState.enemy.hp - damage)
    setFeedback('player', 'enemy', `-${damage}`, crit ? 'crit' : 'damage')
    let line = `${player.name}发动普通攻击，造成 ${damage} 点伤害`
    if (crit) line += '（暴击）'
    if (elemental > 1) line += '（元素克制）'
    if (elemental < 1) line += '（元素受阻）'
    line += `，当前 ${battleState.combo} 连击。`
    addLog(line, crit ? 'crit' : 'player')
    const extraAttackChance = clamp(Number(sb.extraAttack) || 0, 0, 1)
    if (battleState.enemy.hp > 0 && extraAttackChance > 0 && Math.random() < extraAttackChance) {
      const extraDamage = Math.min(damage, battleState.enemy.hp)
      battleState.enemy.hp = Math.max(0, battleState.enemy.hp - damage)
      setFeedback('player', 'enemy', `-${extraDamage}`, 'damage', '影分身')
      addLog(`影分身触发，追加一次等额攻击，造成 ${extraDamage} 点伤害。`, 'player')
    }
    player.spiritPower = Math.min(playerMaxSpirit(), player.spiritPower + (sb.mpRecovery || 2))
    if (sb.alwaysStatus) {
      const applied = maybeApplyElementStatus(element, battleState.enemyStatuses, true)
      if (applied) addLog(`${battleState.enemy.name}陷入${applied}状态。`, 'status')
    }
    applyComboFinisher()
    battleState.busy = false
    afterPlayerAction()
  }

  function performSkill(index) {
    if (!battleState || battleState.turn !== 'player' || battleState.busy || battleState.ended) return
    const skill = (player.skills || [])[index]
    if (!skill) return
    const sb = player._skillBonuses || {}
    const cost = Math.max(1, Math.round((skill.cost || 15) * (1 - (sb.mpCostReduction || 0))))
    if (player.spiritPower < cost) { addLog('魂力不足，无法释放该魂技。', 'warning'); return }
    if ((battleState.cooldowns[index] || 0) > 0) { addLog(`「${skill.name}」仍在冷却。`, 'warning'); return }
    battleState.busy = true
    player.spiritPower -= cost
    battleState.cooldowns[index] = Math.max(1, (skill.cooldown || 3) - (sb.cdReduction || 0))
    const fs = finalStats()
    const type = String(skill.type || '攻击')
    const desc = String(skill.desc || '')
    const isHeal = /治疗|恢复|回春|甘露/.test(type + desc)
    const isDefense = /防御|护|增益|复活|闪避/.test(type + desc)
    const element = skillElement(index, skill)
    if (element !== 'none' && !combat._usedElements.includes(element)) combat._usedElements.push(element)

    if (isHeal) {
      const heal = Math.max(10, Math.round((skill.damage || 20) * 0.8 + fs.maxHp * 0.14))
      player.heal(heal)
      addStatus(battleState.playerStatuses, 'regen', 2, 0.04)
      addLog(`${player.name}释放「${skill.name}」，恢复 ${heal} 点生命并获得再生。`, 'heal')
      setFeedback('player', 'player', `+${heal}`, 'heal', skill.name)
      battleState.combo = 0
    } else if (isDefense) {
      addStatus(battleState.playerStatuses, 'shield', 2)
      if (/增益|狂暴/.test(type + desc)) addStatus(battleState.playerStatuses, 'rage', 2)
      addLog(`${player.name}释放「${skill.name}」，获得护盾与战斗增益。`, 'player')
      setFeedback('player', 'player', '护盾', 'heal', skill.name)
      battleState.combo = 0
    } else {
      battleState.combo++
      combat._maxCombo = Math.max(Number(combat._maxCombo) || 0, battleState.combo)
      const elemental = elementMultiplier(element, battleState.enemy.element)
      const critRate = clamp(0.08 + (sb.critRate || 0) + battleState.combo * 0.006, 0.08, 0.7)
      const crit = Math.random() < critRate
      const critMult = crit ? 1.5 + (sb.critDmg || 0) : 1
      const skillMult = 1 + (sb.skillDmgBonus || 0) + Math.min(0.5, battleState.combo * 0.02 + (sb.comboBonus || 0))
      let damage = damageFormula(fs.attack + (skill.damage || 20) * 0.7, battleState.enemy.defense, {
        penetration: sb.defPenetration || 0,
        multiplier: elemental * critMult * skillMult * statusDamageModifier(battleState.playerStatuses, true) * statusDamageModifier(battleState.enemyStatuses, false)
      })
      const shield = battleState.enemyStatuses.find(s => s.id === 'shield')
      if (shield) damage = Math.max(1, Math.round(damage * 0.55))
      battleState.enemy.hp = Math.max(0, battleState.enemy.hp - damage)
      setFeedback('player', 'enemy', `-${damage}`, crit ? 'crit' : 'damage', skill.name)
      let line = `${player.name}释放「${skill.name}」，造成 ${damage} 点伤害`
      if (crit) line += '（暴击）'
      if (elemental > 1) line += '（元素克制）'
      line += '。'
      addLog(line, crit ? 'crit' : 'player')
      triggerElementReaction(element)
      const applied = maybeApplyElementStatus(element, battleState.enemyStatuses, Boolean(sb.alwaysStatus))
      if (applied) addLog(`${battleState.enemy.name}陷入${applied}状态。`, 'status')
      applyComboFinisher()
    }
    battleState.busy = false
    afterPlayerAction()
  }

  function performFusion() {
    if (!battleState || battleState.turn !== 'player' || battleState.busy || battleState.ended || battleState.fusionUsed) return
    const cost = 40
    if ((player.rings || []).length < 3) { addLog('至少获得三个魂环后才能施展武魂融合。', 'warning'); return }
    if (player.spiritPower < cost) { addLog('魂力不足，武魂融合需要40点魂力。', 'warning'); return }
    battleState.busy = true
    battleState.fusionUsed = true
    combat._fusionUsed = true
    player.spiritPower -= cost
    const damage = damageFormula(finalStats().attack * 1.65, battleState.enemy.defense, { multiplier: 1.65 * statusDamageModifier(battleState.enemyStatuses, false), penetration: 0.25 })
    battleState.enemy.hp = Math.max(0, battleState.enemy.hp - damage)
    setFeedback('player', 'enemy', `-${damage}`, 'crit', '武魂融合')
    addStatus(battleState.playerStatuses, 'shield', 2)
    addStatus(battleState.playerStatuses, 'rage', 2)
    addLog(`人魂合一！${player.name}施展武魂融合，造成 ${damage} 点伤害并获得护盾。`, 'crit')
    battleState.busy = false
    afterPlayerAction()
  }

  function performDefend() {
    if (!battleState || battleState.turn !== 'player' || battleState.busy || battleState.ended) return
    battleState.defending = true
    battleState.combo = 0
    const restore = Math.max(5, Math.round(playerMaxSpirit() * 0.12))
    player.spiritPower = Math.min(playerMaxSpirit(), player.spiritPower + restore)
    addStatus(battleState.playerStatuses, 'shield', 1)
    addLog(`${player.name}凝神防御，并恢复 ${restore} 点魂力。`, 'player')
    afterPlayerAction()
  }

  function toggleItems() {
    if (!battleState || battleState.ended) return
    battleState.showItems = !battleState.showItems
  }

  function useItem(index) {
    if (!battleState || battleState.turn !== 'player' || battleState.busy || battleState.ended) return
    const item = player.inventory[index]
    if (!item || item.count <= 0) return
    // 效果数学统一走 engine/item-effects.js（与非战斗使用同一份规则）
    const outcome = resolveConsumable(item, {
      hp: player.hp,
      maxHp: finalStats().maxHp,
      spiritPower: player.spiritPower,
      maxSpiritPower: playerMaxSpirit(),
      statuses: battleState.playerStatuses
    }, 'battle')
    if (!outcome.ok) { addLog(outcome.message, 'warning'); return }
    const { effect } = outcome
    if (effect.heal) player.heal(effect.heal)
    if (effect.mp) player.spiritPower = Math.min(playerMaxSpirit(), player.spiritPower + effect.mp)
    if (effect.status) addStatus(battleState.playerStatuses, effect.status.id, effect.status.turns, effect.status.power)
    if (effect.statuses) battleState.playerStatuses = effect.statuses
    item.count--
    player.inventory = player.inventory.filter(it => it.count > 0)
    battleState.combo = 0
    battleState.showItems = false
    addLog(`${player.name}使用「${item.name}」，${outcome.message}。`, 'heal')
    afterPlayerAction()
  }

  function attemptFlee() {
    if (!battleState || battleState.turn !== 'player' || battleState.busy || battleState.ended) return
    if (battleState.enemy.isBoss || battleState.options.allowFlee === false) {
      addLog('这场战斗无法逃跑。', 'warning'); return
    }
    const chance = clamp(0.45 + (finalStats().speed - battleState.enemy.speed) * 0.012, 0.2, 0.9)
    if (Math.random() < chance) {
      battleState.ended = true
      clearAutoTimer()
      battleActive.value = false
      combat._battleActive = false
      addLog('你成功脱离了战斗。', 'warning')
      combat.recordHuntingOutcome(battleState.enemy, 'escape', {
        ringHunt: Boolean(battleState.options.huntingMeta?.ringHunt),
        eventName: battleState.options.huntingMeta?.eventName || ''
      })
      // 契约（engine/battle-contract.js）：逃跑后挂起猎环/主线的剧情处理由事件层完成。
      const escapeText = battleState.options.huntingMeta?.ringHunt
        ? '你摆脱了魂兽追击；魂环尚未获得，再历练两次后可重新搜寻。'
        : '你避开敌人的追击，重新整理行装。'
      _callOnEnd('escape', escapeText)
    } else {
      addLog('逃跑失败，敌人抓住了破绽！', 'damage')
      battleState.combo = 0
      afterPlayerAction()
    }
  }

  // ==================== 敌方行动 ====================

  function enemyAction() {
    if (!battleState || battleState.ended) return
    if (battleState.enemy.hp <= 0) { finishVictory(); return }
    const skip = tickStatuses('enemy')
    if (battleState.enemy.hp <= 0) { finishVictory(); return }
    if (skip) {
      addLog(`${battleState.enemy.name}受到控制，本回合无法行动。`, 'status')
      endRound(); return
    }
    const fs = finalStats()
    const sb = player._skillBonuses || {}
    const haste = battleState.playerStatuses.find(s => s.id === 'haste')
    const dodgeChance = clamp((sb.dodge || 0) + (haste ? Math.max(0.15, haste.power || 0) : 0) + Math.max(0, fs.speed - battleState.enemy.speed) * 0.002, 0, 0.65)
    if (Math.random() < dodgeChance) {
      addLog(`${player.name}闪开了${battleState.enemy.name}的攻击。`, 'player')
      endRound(); return
    }
    let multiplier = statusDamageModifier(battleState.enemyStatuses, true)
    let specialName = ''
    if (battleState.enemy.isBoss && Math.random() < 0.24) {
      multiplier *= 1.45 + battleState.bossPhase * 0.08
      specialName = battleState.bossPhase >= 3 ? '灭世冲击' : '狂暴重击'
    }
    if (battleState.defending) multiplier *= 0.48
    const shield = battleState.playerStatuses.find(s => s.id === 'shield')
    if (shield) multiplier *= 0.62
    const antiCrit = sb.antiCrit || 0
    const crit = Math.random() < Math.max(0.03, 0.1 - antiCrit)
    if (crit) multiplier *= 1.5
    let damage = damageFormula(battleState.enemy.attack, fs.defense, {
      multiplier: multiplier * statusDamageModifier(battleState.playerStatuses, false)
    })
    player.damage(damage)
    setFeedback('enemy', 'player', `-${damage}`, crit ? 'crit' : 'damage', specialName)
    addLog(`${battleState.enemy.name}${specialName ? '施展「' + specialName + '」' : '发动攻击'}，造成 ${damage} 点伤害${crit ? '（暴击）' : ''}。`, 'damage')
    // 极限突破
    if (player.hp > 0 && player.hp <= fs.maxHp * 0.2 && !battleState.limitBreakUsed) {
      battleState.limitBreakUsed = true
      const heal = Math.round(fs.maxHp * 0.3)
      player.heal(heal)
      addStatus(battleState.playerStatuses, 'rage', 3)
      addStatus(battleState.playerStatuses, 'regen', 3, 0.05)
      addLog(`极限突破！${player.name}恢复 ${heal} 点生命并获得狂暴与再生。`, 'crit')
    }
    if (Math.random() < 0.2) {
      const applied = maybeApplyElementStatus(battleState.enemy.element, battleState.playerStatuses, false)
      if (applied) addLog(`${player.name}陷入${applied}状态。`, 'status')
    }
    if (player.hp <= 0) {
      if (sb.lastStand && !battleState.lastStandUsed) {
        battleState.lastStandUsed = true
        player.setHp(Math.max(1, Math.round(fs.maxHp * 0.25)))
        addLog('金身不灭发动！你在致命伤害下坚持了下来。', 'heal')
      } else {
        finishDefeat(); return
      }
    }
    endRound()
  }

  function endRound() {
    if (!battleState || battleState.ended) return
    battleState.round++
    battleState.defending = false
    decrementCooldowns()
    const playerSkip = tickStatuses('player')
    if (player.hp <= 0) { finishDefeat(); return }
    const regen = (player._skillBonuses || {}).regen || 0
    if (regen > 0 && !battleState.playerStatuses.some(s => s.id === 'regen')) addStatus(battleState.playerStatuses, 'regen', 1, regen)
    battleState.turn = 'player'
    battleState.busy = false
    if (playerSkip) {
      addLog(`${player.name}受到控制，本回合无法行动。`, 'status')
      battleState.turn = 'enemy'
      const currentState = battleState
      const generation = battleGeneration
      setTimeout(() => { if (isCurrentBattleRunning(currentState, generation)) enemyAction() }, 480)
    } else {
      scheduleAutoAction()
    }
  }

  function afterPlayerAction() {
    if (!battleState || battleState.ended) return
    if (battleState.enemy.hp <= 0) {
      battleState.busy = true
      const currentState = battleState
      const generation = battleGeneration
      setTimeout(() => { if (isCurrentBattleRunning(currentState, generation)) finishVictory() }, 360)
      return
    }
    updateBossPhase()
    battleState.turn = 'enemy'
    const currentState = battleState
    const generation = battleGeneration
    setTimeout(() => { if (isCurrentBattleRunning(currentState, generation)) enemyAction() }, 480)
  }

  // ==================== 胜负结算 ====================

  function finishVictory() {
    if (!battleState || battleState.ended) return
    battleState.ended = true
    clearAutoTimer()
    battleActive.value = false
    combat._battleActive = false
    // 训练模式
    if (battleState.options.training) {
      const callback = battleState.options.onVictory
      const enemy = battleState.enemy
      const currentState = battleState
      const generation = battleGeneration
      _callOnEnd('victory', `你击败了训练木偶，获得了一些战斗经验。`)
      if (typeof callback === 'function') {
        setTimeout(() => {
          if (isCurrentBattleInstance(currentState, generation)) callback(enemy)
        }, 40)
      }
      return
    }
    // 统计
    combat.recordWin()
    if (!battleState.enemy.isNpc && battleState.options.countKill !== false) combat.recordKill()
    if (battleState.enemy.isBoss) {
      player._bossKills = (player._bossKills || 0) + 1
    }
    // 奖励
    let gains = []
    let rewardExp = 0
    let rewardGold = 0
    if (battleState.options.rewardResult && !battleState.options.deferResult) {
      const reward = _applyResultRewards(battleState.options.rewardResult)
      gains = reward.list
      rewardExp += reward.exp || 0
      rewardGold += reward.gold || 0
    }
    if (battleState.enemy.exp && !battleState.options.rewardResult) {
      const reward = _applyResultRewards({ exp: battleState.enemy.exp, gold: battleState.enemy.gold || 0 })
      gains.push(...reward.list)
      rewardExp += reward.exp || 0
      rewardGold += reward.gold || 0
    }
    const huntingRecord = combat.recordHuntingOutcome(battleState.enemy, 'victory', {
      ringHunt: Boolean(battleState.options.huntingMeta?.ringHunt),
      eventName: battleState.options.huntingMeta?.eventName || ''
    })
    if (huntingRecord.gain > 0) gains.push(`猎魂历练+${huntingRecord.gain}`)
    // 儿童版不提供锻造入口，战斗不再掉落用不上的魂骨碎片。
    // 剧情战斗的奖励由事件层在结果页统一展示（deferResult），这里只在真有经验时提示，避免"经验+0"。
    if (rewardExp > 0) ui.notify(`战斗胜利！经验+${rewardExp}`, 'success', 3000)
    const onVictory = battleState.options.onVictory
    if (typeof onVictory === 'function') {
      const currentState = battleState
      const generation = battleGeneration
      _callOnEnd('victory', `你击败了${battleState.enemy.name}。`, gains, rewardExp, rewardGold)
      setTimeout(() => {
        if (isCurrentBattleInstance(currentState, generation)) onVictory(currentState.enemy, gains)
      }, 40)
    } else {
      const resultText = battleState.options.rewardResult && battleState.options.rewardResult.text
        ? battleState.options.rewardResult.text
        : `你击败了${battleState.enemy.name}。`
      _callOnEnd('victory', resultText, gains, rewardExp, rewardGold)
    }
  }

  function finishDefeat() {
    if (!battleState || battleState.ended) return
    battleState.ended = true
    clearAutoTimer()
    battleActive.value = false
    combat._battleActive = false
    combat.recordLoss()
    combat.recordHuntingOutcome(battleState.enemy, 'defeat', {
      ringHunt: Boolean(battleState.options.huntingMeta?.ringHunt),
      eventName: battleState.options.huntingMeta?.eventName || ''
    })
    // T9 判例5：战败轻微代价——损失 5% 金币（四舍五入后至少 0），
    // 打破"零成本无限重试"，但不构成挫败性惩罚。
    const goldLoss = Math.floor((player.gold || 0) * 0.05)
    if (goldLoss > 0) {
      player.gold = Math.max(0, (player.gold || 0) - goldLoss)
      addLog(`战斗失利，损失 ${goldLoss} 金币。`, 'damage')
    }
    // 契约（engine/battle-contract.js）：战败后挂起猎环/主线的剧情处理由事件层完成。
    player.setHp(Math.max(1, Math.round(finalStats().maxHp * 0.3)))
    battleState.combo = 0
    const onDefeat = battleState.options.onDefeat
    // 猎环战败时告诉小朋友下一步怎么办，而不是只说"没能战胜"。
    const defeatTip = battleState.options.huntingMeta?.ringHunt
      ? '先在地点行动里点「休息恢复」把生命补满，或者下次选一只更稳妥的魂兽。'
      : ''
    if (typeof onDefeat === 'function') {
      const currentState = battleState
      const generation = battleGeneration
      _callOnEnd('defeat', `你没能战胜${battleState.enemy.name}。同伴将你带到安全处，生命恢复至30%${goldLoss > 0 ? `，损失${goldLoss}金币` : ''}。${defeatTip}`)
      setTimeout(() => {
        if (isCurrentBattleInstance(currentState, generation)) onDefeat(currentState.enemy)
      }, 80)
    } else {
      _callOnEnd('defeat', `你没能战胜${battleState.enemy.name}。同伴将你带到安全处，生命恢复至30%${goldLoss > 0 ? `，损失${goldLoss}金币` : ''}。${defeatTip}`)
    }
  }

  // 简化版奖励应用
  function _applyResultRewards(result) {
    const gains = []
    let exp = 0, gold = 0
    if (result.exp) {
      // 统一走 T14 判例16 规则(settlement.applyExpGain):满级转金币,未满级入经验
      const outcome = applyExpGain(player, result.exp)
      if (outcome.kind === 'gold') {
        gold = outcome.value
        gains.push(`满级经验转化为金币+${outcome.value}`)
      } else {
        exp = outcome.value
        gains.push(`经验+${outcome.value}`)
      }
    }
    if (result.gold) {
      gold = Math.round(result.gold)
      player.addGold(gold)
      gains.push(`金币+${gold}`)
    }
    if (result.heal) { player.heal(result.heal); gains.push(`生命恢复+${result.heal}`) }
    if (result.fate) { player.fatePoints += result.fate; gains.push(`命运值+${result.fate}`) }
    if (result.spiritPowerGain) {
      player.spiritPowerMax += result.spiritPowerGain
      player.spiritPower = Math.min(player.spiritPower + result.spiritPowerGain, playerMaxSpirit())
      gains.push(`魂力上限+${result.spiritPowerGain}`)
    }
    return { list: gains, exp, gold }
  }

  // 结束回调：按 engine/battle-contract.js 发布标准化结果
  function _callOnEnd(type, text, gains, exp, gold) {
    if (typeof battleState.options.onEnd === 'function') {
      battleState.options.onEnd({
        type,
        text,
        gains: gains || [],
        exp: exp || 0,
        gold: gold || 0,
        enemy: battleState.enemy,
        rounds: battleState.round
      })
    }
  }

  // ==================== 启动战斗 ====================

  function start(rawEnemy, options = {}) {
    // 新战斗必须显式结束旧的模块级状态，避免旧的延迟行动落到新战斗上。
    // 这是启动路径的生命周期清理，不走 nextEvent 的静默兜底。
    resetBattle()
    const fs = finalStats()
    const source = rawEnemy && typeof rawEnemy === 'object' ? rawEnemy : {}
    const hp = Number(source.hp || source.maxHp) || Math.max(60, Math.round(fs.maxHp * 0.75))
    const normalized = {
      id: source.id || ('enemy_' + Date.now()),
      beastId: source.beastId || source.id || '',
      name: source.name || '未知对手',
      icon: source.icon || (source.isNpc ? '⚔️' : '🐾'),
      image: resolveAssetPath(source.image || ''),
      attack: Math.max(1, Number(source.attack) || Math.round(fs.attack * 0.7)),
      defense: Math.max(0, Number(source.defense) || Math.round(fs.defense * 0.55)),
      speed: Math.max(1, Number(source.speed) || Math.round(fs.speed * 0.8)),
      hp, maxHp: Number(source.maxHp) || hp,
      element: normalizeElement(source.element || source.sub || source.type || source.name),
      tier: source.tier || '',
      isBeast: source.isBeast === true,
      isNpc: Boolean(source.isNpc),
      isBoss: Boolean(source.isBoss || /boss|lord|king|主|王|神|最终/i.test(String(source.id || '') + source.name)),
      special: source.special || '',
      exp: Number(source.exp) || 0,
      gold: Number(source.gold) || 0
    }

    battleState = createState()
    battleState.enemy = normalized
    battleState.options = options
    battleState.cooldowns = (player.skills || []).map(() => 0)
    battleActive.value = true
    combat._battleActive = true
    // 默认自动战斗：小朋友可以先看战斗怎么打，想自己指挥随时点招式接管。
    if (autoBattleDefault.value && !options.training) {
      battleState.auto = true
      scheduleAutoAction()
    }

    // 初始化技能加成
    const sb = player._skillBonuses || {}
    if (sb.regen) addStatus(battleState.playerStatuses, 'regen', 99, sb.regen)
    if (player._tempAtkBuff) { addStatus(battleState.playerStatuses, 'rage', 3, player._tempAtkBuff); player._tempAtkBuff = 0 }
    if (player._tempDefBuff) { addStatus(battleState.playerStatuses, 'shield', 3, player._tempDefBuff); player._tempDefBuff = 0 }
    if (player._tempSpdBuff) { addStatus(battleState.playerStatuses, 'haste', 3, player._tempSpdBuff); player._tempSpdBuff = 0 }

    player.setHp(clamp(player.hp || fs.maxHp, 1, fs.maxHp))

    addLog(`${normalized.name}出现了！战斗开始。`, normalized.isBoss ? 'boss' : 'normal')

    // 敌人速度更快时先手
    if (normalized.speed > fs.speed && !sb.firstStrike) {
      battleState.turn = 'enemy'
      addLog(`${normalized.name}速度更快，抢先发动攻击。`, 'warning')
      const currentState = battleState
      const generation = battleGeneration
      setTimeout(() => { if (isCurrentBattleRunning(currentState, generation)) enemyAction() }, 480)
    }

    return battleState
  }

  // 事件战斗入口：只接收 engine/battle-contract.js 的请求单，不理解事件语义。
  // 奖励结算（deferResult）与战败/逃跑的剧情处理都由事件层完成。
  function startEventBattle(request, onEnd) {
    const built = buildEnemy(request.enemyRef, player.level, finalStats, data.value.beasts)
    // 儿童版：敌人按难度档位换算到玩家当前强度（预构建的特殊敌人对象保持原样）。
    const enemyData = request.difficulty && !(request.enemyRef && typeof request.enemyRef === 'object')
      ? scaleEnemyToPlayer(built, finalStats(), request.difficulty, Math.random, player.skills || [])
      : built
    return start(enemyData, {
      rewardResult: request.rewardResult,
      finalBoss: Boolean(request.finalBoss),
      deferResult: true,
      allowFlee: request.allowFlee !== false,
      huntingMeta: request.huntingMeta || { ringHunt: false, eventName: '' },
      onEnd
    })
  }

  function startTraining(enemyData, onVictory) {
    return start(enemyData, { training: true, onVictory, allowFlee: false })
  }

  function isActive() {
    return Boolean(battleActive.value && battleState && !battleState.ended)
  }

  function cancelTraining() {
    if (!battleState || !battleState.options || !battleState.options.training) return false
    resetBattle()
    return true
  }

  // 强制复位战斗：页面被强制卸载时的兜底清理。
  // - 清除自动战斗计时器
  // - 将残留战斗标记为已结束，并清空模块级 battleState
  // - 统一把 battleActive / combat._battleActive 复位为 false
  // - 不发放胜负奖励、不调用旧页面留下的 onEnd/onVictory/onDefeat 回调
  // - 多次调用幂等（battleState 为 null 时同样安全）
  function resetBattle() {
    battleGeneration++
    clearAutoTimer()
    if (battleState) {
      battleState.ended = true
      battleState.auto = false
    }
    battleState = null
    battleActive.value = false
    combat._battleActive = false
  }

  // ==================== 自动战斗 ====================

  function clearAutoTimer() {
    if (autoTimer) {
      clearTimeout(autoTimer)
      autoTimer = null
    }
  }

  function pickAutoSkill() {
    const sb = player._skillBonuses || {}
    const list = player.skills || []
    for (let i = 0; i < list.length; i++) {
      const skill = list[i]
      if (!skill) continue
      const cost = Math.max(1, Math.round((skill.cost || 15) * (1 - (sb.mpCostReduction || 0))))
      if (player.spiritPower < cost) continue
      if ((battleState.cooldowns[i] || 0) > 0) continue
      return i
    }
    return -1
  }

  function autoPerformAction() {
    if (!battleState || battleState.ended || !battleState.auto) return
    if (battleState.turn !== 'player' || battleState.busy) return
    const index = pickAutoSkill()
    if (index >= 0) performSkill(index)
    else performAttack()
    // 魂力不足/技能冷却导致行动未执行时，安全回退到普通攻击
    if (battleState && !battleState.ended && battleState.auto && battleState.turn === 'player' && !battleState.busy) {
      performAttack()
    }
  }

  function scheduleAutoAction() {
    if (!battleState || battleState.ended || !battleState.auto) return
    if (battleState.turn !== 'player' || battleState.busy) return
    clearAutoTimer()
    const delay = Math.max(140, Math.round(AUTO_ACTION_DELAY / (battleState.speed || 1)))
    const currentState = battleState
    const generation = battleGeneration
    autoTimer = setTimeout(() => {
      autoTimer = null
      // 执行前二次校验：结束/关闭/非玩家回合均不得触发
      if (!isCurrentBattleRunning(currentState, generation) || !currentState.auto) return
      autoPerformAction()
    }, delay)
  }

  function toggleAuto() {
    if (!battleState || battleState.ended) return
    battleState.auto = !battleState.auto
    gameStore.setAutoBattleDefault(battleState.auto)
    if (battleState.auto) {
      addLog('已开启自动战斗，魂师将自动出击。', 'status')
      scheduleAutoAction()
    } else {
      clearAutoTimer()
      addLog('已切换回手动操作。', 'status')
    }
  }

  function cycleSpeed() {
    if (!battleState || battleState.ended) return
    battleState.speed = battleState.speed === 1 ? 2 : (battleState.speed === 2 ? 3 : 1)
    if (battleState.auto) scheduleAutoAction()
  }

  function stopAuto() {
    clearAutoTimer()
    if (battleState) battleState.auto = false
  }

  return {
    // 状态
    active, enemy, logs, turn, combo, round, bossPhase, phaseNotice, feedback,
    playerStatuses, enemyStatuses, playerStatusDisplay, enemyStatusDisplay,
    playerHpPct, enemyHpPct, mpPct, playerElement, enemyElement,
    skills, usableItems, showItems, autoMode, speedLabel, fusionUsed, allowFlee, isBoss,
    // 行动
    performAttack, performSkill, performFusion, performDefend,
    toggleItems, useItem, attemptFlee, toggleAuto, cycleSpeed, stopAuto,
    // 系统
    start, startEventBattle, startTraining, isActive, cancelTraining, resetBattle,
    buildEnemy, normalizeElement, elementMultiplier,
    ELEMENT_ICONS, ELEMENT_NAMES, STATUS_INFO,
    autoBattleDefault
  }
}
