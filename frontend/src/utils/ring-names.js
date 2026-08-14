export const BEAST_NAME_ALIASES = Object.freeze({
  spirit_deer_ten: '灵鹿',
  wind_rabbit_ten: '疾风兔',
  wind_rabbit_hundred: '疾风兔',
  wild_rabbit: '疾风兔',
  poison_spider_ten: '毒蛛',
  poison_spider_hundred: '毒蛛',
  poison_spider: '毒蛛',
  one_eye_wolf: '独眼狼',
  flower_snake: '花蛇',
  rock_python: '岩蟒',
  nether_wolf_king: '幽冥狼王',
  titan_giant_ape: '泰坦巨猿',
  titan_giant_ape_king: '泰坦巨猿王',
  black_water_dragon: '黑水蛟龙',
  dark_gold_terrorclaw_bear: '暗金恐爪熊',
  deep_sea_demon_whale_king: '深海魔鲸王',
  flame_tiger: '烈焰虎',
  human_faced_spider: '人面魔蛛',
  ice_emperor_scorpion: '冰帝蝎',
  ice_wolf: '冰狼',
  iron_armor_bear: '铁甲熊',
  iron_horn_sheep: '铁角羊',
  thousand_eye_centipede: '千眼蜈蚣',
  thunder_bird: '雷鸟',
  wind_butterfly: '风蝶',
  wind_spirit_swallow: '风灵燕'
})

const INTERNAL_ID_RE = /^[a-z][a-z0-9_:-]*$/i

function cleanSource(value) {
  return String(value || '')
    .trim()
    .replace(/魂技$/, '')
    .replace(/^(猎杀|挑战|吸收|选择)/, '')
    .replace(/[·—].*$/, '')
    .trim()
}

export function isInternalRingLabel(value) {
  const cleaned = cleanSource(value)
  return Boolean(cleaned && (BEAST_NAME_ALIASES[cleaned] || INTERNAL_ID_RE.test(cleaned)))
}

export function playerFacingBeastName(value, fallback = '未知魂兽') {
  const cleaned = cleanSource(value)
  if (!cleaned) return fallback
  if (BEAST_NAME_ALIASES[cleaned]) return BEAST_NAME_ALIASES[cleaned]
  if (INTERNAL_ID_RE.test(cleaned)) return fallback
  return cleaned
}

export function ringSourceForChoice(choice, fallback = '魂环') {
  const candidate = choice?.beastName || choice?.beastId || choice?.result?.battle || choice?.text
  return playerFacingBeastName(candidate, fallback)
}

export function normalizeRingPresentation(ring, index = 0, legacySkill = {}) {
  const next = ring && typeof ring === 'object' ? { ...ring } : {}
  const internalSkillSource = isInternalRingLabel(next.skill || legacySkill?.name)
    ? cleanSource(next.skill || legacySkill?.name)
    : ''
  const sourceCandidate = next.source || next.beastId || internalSkillSource
  const source = playerFacingBeastName(sourceCandidate, next.name || '未知魂兽')
  const rawSkill = String(next.skill || legacySkill?.name || `第${index + 1}魂技`).trim()

  next.source = source
  if (isInternalRingLabel(rawSkill)) {
    next.skill = `${playerFacingBeastName(rawSkill, source)}魂技`
  } else {
    next.skill = rawSkill || `第${index + 1}魂技`
  }
  if (next.beastId && BEAST_NAME_ALIASES[next.beastId]) next.beastId = BEAST_NAME_ALIASES[next.beastId]
  return next
}
