/**
 * 战斗系统 composable
 * 从 game-combat.js 移植核心回合制战斗引擎
 * 包含：普通攻击/魂技/防御/道具/逃跑/武魂融合
 *       元素克制/暴击/连击/状态效果/Boss阶段
 */
import { ref, reactive, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useCombatStore } from '@/stores/combat'
import { useUiStore } from '@/stores/ui'
import { beastTierForEncounter } from '@/utils/ring-hunt'
import { resolveAssetPath } from '@/utils/asset-resolver'
import { useGameData } from '@/composables/useGameData'
import { useGameRules } from '@/composables/useGameRules'

// ==================== 常量 ====================

const ELEMENT_ICONS = {
  fire: '🔥', ice: '❄️', thunder: '⚡', water: '💧', wood: '🌿', earth: '🪨',
  light: '☀️', dark: '🌑', poison: '☠️', metal: '⚔️', wind: '💨', none: '◯'
}
const ELEMENT_NAMES = {
  fire: '火', ice: '冰', thunder: '雷', water: '水', wood: '木', earth: '土',
  light: '光', dark: '暗', poison: '毒', metal: '金', wind: '风', none: '无'
}
const STATUS_INFO = {
  burn: { name: '燃烧', icon: '🔥', harmful: true },
  poison: { name: '中毒', icon: '☠️', harmful: true },
  freeze: { name: '冻结', icon: '❄️', harmful: true },
  stun: { name: '眩晕', icon: '💫', harmful: true },
  weak: { name: '虚弱', icon: '📉', harmful: true },
  armorBreak: { name: '破甲', icon: '💔', harmful: true },
  regen: { name: '再生', icon: '🌱', harmful: false },
  rage: { name: '狂暴', icon: '🔥', harmful: false },
  shield: { name: '护盾', icon: '🛡️', harmful: false },
  haste: { name: '疾风', icon: '💨', harmful: false }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function normalizeElement(value) {
  const text = String(value || '').toLowerCase()
  if (/火|fire|焰/.test(text)) return 'fire'
  if (/冰|雪|寒|ice/.test(text)) return 'ice'
  if (/雷|电|thunder/.test(text)) return 'thunder'
  if (/水|海|water/.test(text)) return 'water'
  if (/木|草|植物|wood/.test(text)) return 'wood'
  if (/土|岩|大地|earth/.test(text)) return 'earth'
  if (/光|神圣|天使|light/.test(text)) return 'light'
  if (/暗|影|冥|深渊|dark/.test(text)) return 'dark'
  if (/毒|poison/.test(text)) return 'poison'
  if (/金|剑|刀|锤|metal/.test(text)) return 'metal'
  if (/风|wind/.test(text)) return 'wind'
  return 'none'
}

function elementMultiplier(attacker, defender) {
  attacker = normalizeElement(attacker)
  defender = normalizeElement(defender)
  if (attacker === 'none' || defender === 'none' || attacker === defender) return 1
  const strong = {
    fire: ['ice', 'metal', 'wood'], ice: ['thunder', 'water'], thunder: ['water', 'wind'],
    water: ['fire', 'earth'], wood: ['earth', 'water'], earth: ['thunder', 'water'],
    metal: ['wood', 'wind'], wind: ['earth'], light: ['dark'], dark: ['light']
  }
  if ((strong[attacker] || []).includes(defender)) return 1.35
  if ((strong[defender] || []).includes(attacker)) return 0.8
  return 1
}

function statusDamageModifier(statuses, attacking) {
  let v = 1
  if (attacking && statuses.some(s => s.id === 'weak')) v *= 0.75
  if (attacking && statuses.some(s => s.id === 'rage')) v *= 1.3
  if (!attacking && statuses.some(s => s.id === 'armorBreak')) v *= 1.2
  return v
}

function statusHtml(list) {
  if (!list || !list.length) return ''
  return list.map(s => {
    const info = STATUS_INFO[s.id] || { name: s.id, icon: '✦' }
    return { icon: info.icon, name: info.name, turns: s.turns, harmful: info.harmful }
  })
}

// ==================== 敌人构建 ====================

function buildEnemy(key, playerLevel, finalStatsFn, beasts) {
  if (key && typeof key === 'object') return { ...key, maxHp: key.maxHp || key.hp }
  const aliases = {
    one_eye_wolf: '独眼狼', flower_snake: '花蛇', rock_python: '岩蟒', nether_wolf_king: '幽冥狼王',
    titan_giant_ape: '泰坦巨猿', titan_giant_ape_king: '泰坦巨猿王', spirit_deer_ten: '灵鹿',
    poison_spider_ten: '毒蛛', poison_spider_hundred: '毒蛛', poison_spider: '毒蛛',
    wind_rabbit_ten: '野兔', wind_rabbit_hundred: '野兔', wild_rabbit: '野兔',
    black_water_dragon: '黑水蛟龙', dark_gold_terrorclaw_bear: '暗金恐爪熊',
    deep_sea_demon_whale_king: '深海魔鲸王', flame_tiger: '烈焰虎', human_faced_spider: '人面魔蛛',
    ice_emperor_scorpion: '冰帝蝎', ice_wolf: '冰狼', iron_armor_bear: '铁甲熊', iron_horn_sheep: '铁角羊',
    thousand_eye_centipede: '千眼蜈蚣', thunder_bird: '雷鸟', wind_butterfly: '风蝶', wind_spirit_swallow: '风灵燕'
  }
  const beastId = aliases[key] || key
  const beast = (beasts || []).find(b => b.id === beastId || b.name === beastId)
  const fs = finalStatsFn()

  if (beast) {
    const tier = beastTierForEncounter(key, playerLevel)
    const v = (beast.variants && (beast.variants[tier] || beast.variants.ten || beast.variants[Object.keys(beast.variants)[0]])) || {}
    const boss = /王|皇|帝/.test(v.name || beast.name) || ['泰坦巨猿王', '深海魔鲸王'].includes(beast.id)
    return {
      id: beast.id, beastId: beast.id, name: v.name || beast.name, tier, isBeast: true, isNpc: false, isBoss: boss,
      icon: beast.icon || '🐾', image: resolveAssetPath(beast.image),
      attack: Number(v.attack) || 10, defense: Number(v.defense) || 5,
      hp: Number(v.hp) || 50, maxHp: Number(v.hp) || 50, speed: Number(v.speed) || 10,
      element: beast.element || beast.type || beast.specialAbility,
      sub: `${beast.type} · ${beast.habitat}`, special: beast.specialAbility,
      exp: Number(v.exp) || 0, gold: Number(v.gold) || 0
    }
  }

  // NPC 敌人
  function npcEnemy(name, mult, icon) {
    return {
      id: name, name, isNpc: true, isBoss: false, icon: icon || '⚔️', image: null,
      attack: Math.round(fs.attack * mult * 0.72), defense: Math.round(fs.defense * mult * 0.55),
      hp: Math.round(fs.maxHp * mult * 0.85), maxHp: Math.round(fs.maxHp * mult * 0.85),
      speed: Math.round(fs.speed * mult * 0.8), element: 'none', sub: '', special: '',
      exp: Math.round(30 * mult), gold: Math.round(15 * mult)
    }
  }
  const table = {
    academy_rival: () => npcEnemy('天斗学院·小霸王', 0.85),
    prelim_fighter: () => npcEnemy('预赛对手·疾风剑士', 0.92),
    final_fighter: () => npcEnemy('决赛对手·武魂殿天才', 1.08, '⚔️'),
    arena_fighter: () => npcEnemy('竞技场·双刀客', 0.98),
    evil_master: () => npcEnemy('邪魂师·黑袍人', 1.03, '☠️'),
    god_rival: () => npcEnemy('神位传承者·宿敌', 1.15, '👑'),
    holy_lord: () => ({
      id: 'holy_lord', name: '武魂殿圣殿大供奉', isNpc: false, isBoss: true, icon: '👁️', image: null,
      attack: Math.round(fs.attack * 0.92), defense: Math.round(fs.defense * 0.88),
      hp: Math.round(fs.maxHp * 2.1), maxHp: Math.round(fs.maxHp * 2.1),
      speed: Math.round(fs.speed * 0.92), element: '暗', sub: '最终BOSS · 武魂殿巅峰', special: '',
      exp: 500, gold: 200
    })
  }
  return (table[key] || (() => npcEnemy('游历魂师', 0.82)))()
}

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
  const eventStore = useEventStore()
  const combat = useCombatStore()
  const ui = useUiStore()
  const { data } = useGameData()
  const { finalStats, getMaxSpiritPower } = useGameRules()

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

  function skillElement(index, skill) {
    const explicit = normalizeElement(skill && skill.element)
    if (explicit !== 'none') return explicit
    const inferred = normalizeElement(`${skill && skill.name || ''} ${skill && skill.source || ''}`)
    if (inferred !== 'none') return inferred
    const cycle = ['fire', 'ice', 'thunder', 'water', 'wood', 'earth', 'light', 'dark', 'wind']
    return cycle[index % cycle.length]
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

  function addStatus(list, id, turns, power) {
    const existing = list.find(s => s.id === id)
    if (existing) {
      existing.turns = Math.max(existing.turns, turns)
      existing.power = Math.max(existing.power || 0, power || 0)
    } else {
      list.push({ id, turns, power: power || 0 })
    }
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

  function damageFormula(attack, defense, options) {
    const opt = options || {}
    const penetration = clamp(opt.penetration || 0, 0, 0.8)
    const effDef = defense * (1 - penetration)
    const base = Math.max(1, attack * (0.88 + Math.random() * 0.24) - effDef * 0.48)
    return Math.max(1, Math.round(base * (opt.multiplier || 1)))
  }

  function maybeApplyElementStatus(element, targetStatuses, guaranteed) {
    const chance = guaranteed ? 1 : 0.28
    if (Math.random() > chance) return null
    const map = {
      fire: ['burn', 3], ice: ['freeze', 1], thunder: ['stun', 1], poison: ['poison', 4],
      dark: ['weak', 3], metal: ['armorBreak', 3], wood: ['poison', 3], water: ['weak', 2]
    }
    const def = map[normalizeElement(element)]
    if (!def) return null
    addStatus(targetStatuses, def[0], def[1])
    return STATUS_INFO[def[0]].name
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
    const maxHp = finalStats().maxHp
    let message = ''
    if (item.type === 'heal' || item.type === 'healFull') {
      const amount = item.type === 'healFull' ? maxHp : Math.min(maxHp, player.hp + Number(item.value || 0))
      const healed = amount - player.hp
      if (healed <= 0) { addLog('当前生命已满，无需恢复。', 'warning'); return }
      player.heal(healed)
      message = `恢复 ${healed} 点生命`
    } else if (item.type === 'mp') {
      const before = player.spiritPower
      player.spiritPower = Math.min(playerMaxSpirit(), player.spiritPower + Number(item.value || 0))
      message = `恢复 ${player.spiritPower - before} 点魂力`
    } else if (item.type === 'buffAtk') {
      addStatus(battleState.playerStatuses, 'rage', 3, Number(item.value || 0.2))
      message = '获得 3 回合狂暴'
    } else if (item.type === 'buffDef') {
      addStatus(battleState.playerStatuses, 'shield', 3, Number(item.value || 0.2))
      message = '获得 3 回合护盾'
    } else if (item.type === 'buffSpd') {
      addStatus(battleState.playerStatuses, 'haste', 3, Number(item.value || 0.2))
      message = '获得 3 回合疾风，闪避率提升'
    } else if (item.type === 'cure') {
      const before = battleState.playerStatuses.length
      battleState.playerStatuses = battleState.playerStatuses.filter(s => s.id !== String(item.value || 'poison'))
      if (before === battleState.playerStatuses.length) { addLog('当前没有中毒，无需使用解毒丹。', 'warning'); return }
      message = '解除了中毒'
    } else if (item.type === 'cureAll') {
      const before = battleState.playerStatuses.length
      battleState.playerStatuses = battleState.playerStatuses.filter(s => !(STATUS_INFO[s.id] || {}).harmful)
      if (before === battleState.playerStatuses.length) { addLog('当前没有负面状态，无需使用净化符。', 'warning'); return }
      message = '清除了所有负面状态'
    } else {
      addLog(`「${item.name}」不能在战斗中使用。`, 'warning'); return
    }
    item.count--
    player.inventory = player.inventory.filter(it => it.count > 0)
    battleState.combo = 0
    battleState.showItems = false
    addLog(`${player.name}使用「${item.name}」，${message}。`, 'heal')
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
      if (battleState.options.event && battleState.options.event.ring) {
        eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
      }
      if (battleState.options.event && battleState.options.event._mainStory) {
        eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 2
      }
      combat.recordHuntingOutcome(battleState.enemy, 'escape', {
        ringHunt: Boolean(battleState.options.event?.ring),
        eventName: battleState.options.event?.name || ''
      })
      const ringEvent = battleState.options.event && battleState.options.event.ring
      const escapeText = ringEvent ? '你摆脱了魂兽追击；魂环尚未获得，再历练两次后可重新搜寻。' : '你避开敌人的追击，重新整理行装。'
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
    if (battleState.options.result && !battleState.options.deferResult) {
      const reward = _applyResultRewards(battleState.options.result)
      gains = reward.list
      rewardExp += reward.exp || 0
      rewardGold += reward.gold || 0
    }
    if (battleState.enemy.exp && !battleState.options.result) {
      const reward = _applyResultRewards({ exp: battleState.enemy.exp, gold: battleState.enemy.gold || 0 })
      gains.push(...reward.list)
      rewardExp += reward.exp || 0
      rewardGold += reward.gold || 0
    }
    const huntingRecord = combat.recordHuntingOutcome(battleState.enemy, 'victory', {
      ringHunt: Boolean(battleState.options.event?.ring),
      eventName: battleState.options.event?.name || ''
    })
    if (huntingRecord.gain > 0) gains.push(`猎魂历练+${huntingRecord.gain}`)
    // 魂骨碎片掉落（T15，判例 21）：普通魂兽 3%、Boss 15%——魂骨为原著至宝，
    // 碎片不应成为日常产出；挑战塔碎片另按首通发放。
    if (!battleState.enemy.isNpc && Math.random() < (battleState.enemy.isBoss ? 0.15 : 0.03)) {
      if (!player._forgeBones) player._forgeBones = []
      player._forgeBones.push({ source: battleState.enemy.name, tier: battleState.enemy.isBoss ? 3 : 1, obtainedAt: Date.now() })
      gains.push('魂骨碎片×1')
    }
    ui.notify(`战斗胜利！经验+${rewardExp}`, 'success', 3000)
    const onVictory = battleState.options.onVictory
    if (typeof onVictory === 'function') {
      const currentState = battleState
      const generation = battleGeneration
      _callOnEnd('victory', `你击败了${battleState.enemy.name}。`, gains, rewardExp, rewardGold)
      setTimeout(() => {
        if (isCurrentBattleInstance(currentState, generation)) onVictory(currentState.enemy, gains)
      }, 40)
    } else {
      const resultText = battleState.options.result && battleState.options.result.text
        ? battleState.options.result.text
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
      ringHunt: Boolean(battleState.options.event?.ring),
      eventName: battleState.options.event?.name || ''
    })
    const failedEvent = battleState.options.event
    if (failedEvent?.ring) {
      eventStore._ringHuntDeferredUntil = (eventStore._eventCount || 0) + 2
    }
    if (failedEvent?._mainStory) {
      eventStore._storyMilestoneDeferredUntil = (eventStore._eventCount || 0) + 2
    }
    player.setHp(Math.max(1, Math.round(finalStats().maxHp * 0.3)))
    battleState.combo = 0
    const onDefeat = battleState.options.onDefeat
    if (typeof onDefeat === 'function') {
      const currentState = battleState
      const generation = battleGeneration
      _callOnEnd('defeat', `你没能战胜${battleState.enemy.name}。同伴将你带到安全处，生命恢复至30%。`)
      setTimeout(() => {
        if (isCurrentBattleInstance(currentState, generation)) onDefeat(currentState.enemy)
      }, 80)
    } else {
      _callOnEnd('defeat', `你没能战胜${battleState.enemy.name}。同伴将你带到安全处，生命恢复至30%。`)
    }
  }

  // 简化版奖励应用
  function _applyResultRewards(result) {
    const gains = []
    let exp = 0, gold = 0
    if (result.exp) {
      exp = Math.round(result.exp)
      player.addExp(exp)
      gains.push(`经验+${exp}`)
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

  // 结束回调
  function _callOnEnd(type, text, gains, exp, gold) {
    if (typeof battleState.options.onEnd === 'function') {
      battleState.options.onEnd({ type, text, gains: gains || [], exp: exp || 0, gold: gold || 0 })
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

  function startEventBattle(event, result, onEnd) {
    const enemyData = buildEnemy(result.battle, player.level, finalStats, data.value.beasts)
    return start(enemyData, {
      event,
      result,
      finalBoss: event && event.id === 'final_evil',
      // 事件奖励统一由 useEventEngine 在胜利回调中结算，避免战败也完成事件，
      // 同时保证物品、永久属性、武魂进化等完整字段不会被简化结算器丢失。
      deferResult: true,
      allowFlee: !(event && event.id === 'final_evil'),
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
    ELEMENT_ICONS, ELEMENT_NAMES, STATUS_INFO
  }
}
