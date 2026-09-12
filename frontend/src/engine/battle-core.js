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
