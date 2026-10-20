/**
 * 战斗纯逻辑层（从 useBattleSystem.js 原样搬移，行为 1:1）
 *
 * 收录与状态无关的战斗数学与构建规则：元素克制 / 状态效果 / 伤害公式 /
 * 敌人构建。可脱离 Pinia 直接测试；回合编排、store 写入与定时器仍留在
 * useBattleSystem.js 编排层。调参只需改本文件。
 */
import { beastTierForEncounter } from '@/utils/ring-hunt'
import { resolveAssetPath } from '@/utils/asset-resolver'

// ==================== 常量 ====================

export const ELEMENT_ICONS = {
  fire: '🔥', ice: '❄️', thunder: '⚡', water: '💧', wood: '🌿', earth: '🪨',
  light: '☀️', dark: '🌑', poison: '☠️', metal: '⚔️', wind: '💨', none: '◯'
}
export const ELEMENT_NAMES = {
  fire: '火', ice: '冰', thunder: '雷', water: '水', wood: '木', earth: '土',
  light: '光', dark: '暗', poison: '毒', metal: '金', wind: '风', none: '无'
}
export const STATUS_INFO = {
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

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

export function normalizeElement(value) {
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

export function elementMultiplier(attacker, defender) {
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

export function statusDamageModifier(statuses, attacking) {
  let v = 1
  if (attacking && statuses.some(s => s.id === 'weak')) v *= 0.75
  if (attacking && statuses.some(s => s.id === 'rage')) v *= 1.3
  if (!attacking && statuses.some(s => s.id === 'armorBreak')) v *= 1.2
  return v
}

export function statusHtml(list) {
  if (!list || !list.length) return ''
  return list.map(s => {
    const info = STATUS_INFO[s.id] || { name: s.id, icon: '✦' }
    return { icon: info.icon, name: info.name, turns: s.turns, harmful: info.harmful }
  })
}

// ==================== 敌人构建 ====================

export function buildEnemy(key, playerLevel, finalStatsFn, beasts) {
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
  // 允许"one_eye_wolf_ten"这类带年限后缀的写法：后缀决定年限，前半段决定是哪种魂兽。
  const baseKey = String(key || '').replace(/_(ten|hundred|thousand|ten_thousand|hundred_thousand)$/, '')
  const beastId = aliases[key] || aliases[baseKey] || key
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
      battleRole: beast.battleRole || 'balanced',
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
    spirit_hall_guard: () => npcEnemy('武魂殿巡逻执事', 0.95, '🛡️'),
    golden_gen: () => npcEnemy('武魂殿黄金一代·守卫', 1.05, '⚔️'),
    titled_rival: () => npcEnemy('前来挑战的封号斗罗', 1.1, '⚔️'),
    // 主线名场面里的对手（属性仍由 scaleEnemyToPlayer 按玩家强度换算）。
    zhao_wuji: () => npcEnemy('赵无极·不动明王熊', 1.0, '🐻'),
    huangdou_team: () => npcEnemy('皇斗战队·玉天恒的雷龙', 1.0, '⚡'),
    golden_trio: () => npcEnemy('武魂殿黄金一代', 1.08, '🌙'),
    spirit_hall_elder: () => npcEnemy('武魂殿长老', 1.08, '🛡️'),
    god_rival: () => npcEnemy('神位传承者·宿敌', 1.15, '👑'),
    // 正典终局 Boss：教皇比比东（双生武魂 死亡蛛皇+噬魂蛛皇，斗罗1 最终决战）。
    bibi_dong: () => ({
      id: 'bibi_dong', name: '教皇比比东', isNpc: false, isBoss: true, icon: '🕷️', image: resolveAssetPath('assets/npcs/比比东.jpg'),
      attack: Math.round(fs.attack * 0.95), defense: Math.round(fs.defense * 0.9),
      hp: Math.round(fs.maxHp * 2.3), maxHp: Math.round(fs.maxHp * 2.3),
      speed: Math.round(fs.speed * 0.95), element: 'dark', sub: '最终BOSS · 武魂殿教皇', special: '双生武魂：死亡蛛皇',
      exp: 800, gold: 300
    }),
    // holy_lord 为 P0-A 换脸前的旧最终 Boss，保留以兼容旧存档/旧战斗引用。
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

// ==================== 儿童版遭遇难度 ====================

/**
 * 遭遇难度档位：按"大约几个回合打完、打完会掉多少血"来设计，而不是写死魂兽属性。
 * 原先魂兽属性写死（8 种魂兽同一套数值、两下打死），玩家一强起来战斗就失去意义；
 * 现在敌人按玩家当前属性生成，每场战斗都有适度挑战，越级挑战才真的有风险。
 *  - rounds：玩家大约需要几次出手才能打倒对手
 *  - loss  ：整场打完，玩家大约会损失多少比例的生命
 */
export const ENCOUNTER_PRESETS = Object.freeze({
  easy: { rounds: 3, loss: 0.3, speed: 0.85 },     // 普通事件、旅途遭遇
  normal: { rounds: 4, loss: 0.55, speed: 0.95 },  // 稳妥的猎环、主线战斗
  hard: { rounds: 5, loss: 0.92, speed: 1.05 },    // 越级猎环：真的可能输（约 7~8 成能赢）
  boss: { rounds: 8, loss: 0.72, speed: 1.0 }      // 最终决战（还有阶段强化；自动约 7 成能赢，手动用道具更稳）
})

// 魂兽战斗风格：坦克更耐打、迅捷更快、凶猛攻击更高。
const ROLE_MODIFIERS = Object.freeze({
  tank: { hp: 1.3, attack: 0.85, defense: 1.2, speed: 0.85 },
  swift: { hp: 0.85, attack: 0.95, defense: 0.9, speed: 1.25 },
  fierce: { hp: 0.95, attack: 1.2, defense: 1, speed: 1 },
  balanced: { hp: 1, attack: 1, defense: 1, speed: 1 }
})

/**
 * 按难度档位把敌人属性换算到玩家当前强度。只改数值，名字/元素/图片/身份保持不变。
 * @param {object} enemy buildEnemy 的结果
 * @param {object} fs 玩家 finalStats()
 * @param {string} difficulty ENCOUNTER_PRESETS 的键
 * @param {function} rand 随机数（测试可注入）
 */
export function scaleEnemyToPlayer(enemy, fs, difficulty = 'easy', rand = Math.random, skills = []) {
  const preset = ENCOUNTER_PRESETS[difficulty] || ENCOUNTER_PRESETS.easy
  const role = ROLE_MODIFIERS[enemy?.battleRole] || ROLE_MODIFIERS.balanced
  const jitter = () => 0.92 + rand() * 0.16
  const attack = Math.max(1, Number(fs?.attack) || 1)
  const defense = Math.max(0, Number(fs?.defense) || 0)
  const maxHp = Math.max(1, Number(fs?.maxHp) || 1)
  const speed = Math.max(1, Number(fs?.speed) || 1)
  // 敌方防御约为玩家攻击的 35%。玩家普通一击约造成攻击力的 83%，算上魂技、连击与暴击，
  // 实测平均每回合约 1.1 倍"攻击+魂技加成"，敌方生命按 rounds × 输出 × 1.1 设定。
  const enemyDefense = Math.round(attack * 0.35 * role.defense)
  // 魂技伤害是固定加成：约一半回合会放魂技，每次额外约 0.7×魂技伤害。算进玩家输出，
  // 否则高攻击的武魂反而显得更难打。
  const skillList = Array.isArray(skills) ? skills : []
  const avgSkill = skillList.length ? skillList.reduce((sum, s) => sum + (Number(s?.damage) || 0), 0) / skillList.length : 0
  const output = attack + avgSkill * 0.35
  const enemyHp = Math.max(20, Math.round(preset.rounds * output * 1.1 * role.hp * jitter()))
  // 敌方每次出手的伤害 = 玩家防御抵消的部分 + 目标掉血 / 回合数
  const perHit = preset.loss * maxHp / preset.rounds
  const enemyAttack = Math.max(1, Math.round((perHit + defense * 0.48) * role.attack * jitter()))
  return {
    ...enemy,
    attack: enemyAttack,
    defense: enemyDefense,
    hp: enemyHp,
    maxHp: enemyHp,
    speed: Math.max(1, Math.round(speed * preset.speed * role.speed)),
    difficulty
  }
}

// ==================== 状态与伤害 ====================

export function addStatus(list, id, turns, power) {
  const existing = list.find(s => s.id === id)
  if (existing) {
    existing.turns = Math.max(existing.turns, turns)
    existing.power = Math.max(existing.power || 0, power || 0)
  } else {
    list.push({ id, turns, power: power || 0 })
  }
}

export function damageFormula(attack, defense, options) {
  const opt = options || {}
  const penetration = clamp(opt.penetration || 0, 0, 0.8)
  const effDef = defense * (1 - penetration)
  const base = Math.max(1, attack * (0.88 + Math.random() * 0.24) - effDef * 0.48)
  return Math.max(1, Math.round(base * (opt.multiplier || 1)))
}

export function maybeApplyElementStatus(element, targetStatuses, guaranteed) {
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

export function skillElement(index, skill) {
  const explicit = normalizeElement(skill && skill.element)
  if (explicit !== 'none') return explicit
  const inferred = normalizeElement(`${skill && skill.name || ''} ${skill && skill.source || ''}`)
  if (inferred !== 'none') return inferred
  const cycle = ['fire', 'ice', 'thunder', 'water', 'wood', 'earth', 'light', 'dark', 'wind']
  return cycle[index % cycle.length]
}
