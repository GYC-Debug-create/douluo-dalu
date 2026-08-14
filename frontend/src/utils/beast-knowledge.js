const OUTCOME_POINTS = Object.freeze({ victory: 20, defeat: 10, escape: 5 })
const OUTCOME_LABELS = Object.freeze({ victory: '胜利', defeat: '战败', escape: '脱离' })
const TIER_LABELS = Object.freeze({
  ten: '十年', hundred: '百年', thousand: '千年',
  ten_thousand: '万年', hundred_thousand: '十万年'
})
const TIER_RANK = Object.freeze({ ten: 1, hundred: 2, thousand: 3, ten_thousand: 4, hundred_thousand: 5 })

export const HUNTING_HISTORY_LIMIT = 12

function safeInt(value, max = Number.MAX_SAFE_INTEGER) {
  return Math.min(max, Math.max(0, Math.floor(Number(value) || 0)))
}

export function knowledgeRank(points) {
  const value = safeInt(points, 100)
  if (value >= 100) return '精通'
  if (value >= 75) return '洞悉'
  if (value >= 50) return '熟稔'
  if (value >= 25) return '熟悉'
  return value > 0 ? '初识' : '未知'
}

export function normalizeHuntingKnowledge(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const beasts = {}
  for (const [rawKey, rawEntry] of Object.entries(source.beasts || {})) {
    if (!rawEntry || typeof rawEntry !== 'object') continue
    const id = String(rawEntry.id || rawKey || '').trim()
    if (!id) continue
    beasts[id] = {
      id,
      name: String(rawEntry.name || id).trim() || id,
      knowledge: safeInt(rawEntry.knowledge, 100),
      encounters: safeInt(rawEntry.encounters),
      victories: safeInt(rawEntry.victories),
      defeats: safeInt(rawEntry.defeats),
      escapes: safeInt(rawEntry.escapes),
      highestTier: TIER_RANK[rawEntry.highestTier] ? rawEntry.highestTier : '',
      lastOutcome: OUTCOME_POINTS[rawEntry.lastOutcome] ? rawEntry.lastOutcome : '',
      lastSeen: safeInt(rawEntry.lastSeen)
    }
  }
  const history = Array.isArray(source.history) ? source.history : []
  return {
    experience: safeInt(source.experience),
    beasts,
    history: history.filter(item => item && typeof item === 'object').slice(0, HUNTING_HISTORY_LIMIT).map(item => ({
      beastId: String(item.beastId || '').trim(),
      name: String(item.name || '未知魂兽').trim() || '未知魂兽',
      outcome: OUTCOME_POINTS[item.outcome] ? item.outcome : 'escape',
      tier: TIER_RANK[item.tier] ? item.tier : '',
      ringHunt: Boolean(item.ringHunt),
      eventName: String(item.eventName || '').trim(),
      time: safeInt(item.time)
    }))
  }
}

export function recordBeastOutcome(current, enemy, outcome, context = {}) {
  const knowledge = normalizeHuntingKnowledge(current)
  if (!enemy || enemy.isBeast !== true || !OUTCOME_POINTS[outcome]) return { knowledge, gain: 0, entry: null }
  const id = String(enemy.beastId || enemy.id || enemy.name || '').trim()
  if (!id) return { knowledge, gain: 0, entry: null }
  const now = safeInt(context.time || Date.now())
  const tier = TIER_RANK[enemy.tier] ? enemy.tier : ''
  const previous = knowledge.beasts[id] || {
    id, name: String(enemy.name || id), knowledge: 0, encounters: 0,
    victories: 0, defeats: 0, escapes: 0, highestTier: '', lastOutcome: '', lastSeen: 0
  }
  const gain = OUTCOME_POINTS[outcome]
  const entry = {
    ...previous,
    name: String(enemy.name || previous.name || id).replace(/^(十年|百年|千年|万年|十万年)/, '') || id,
    knowledge: Math.min(100, previous.knowledge + gain),
    encounters: previous.encounters + 1,
    victories: previous.victories + (outcome === 'victory' ? 1 : 0),
    defeats: previous.defeats + (outcome === 'defeat' ? 1 : 0),
    escapes: previous.escapes + (outcome === 'escape' ? 1 : 0),
    highestTier: TIER_RANK[tier] > (TIER_RANK[previous.highestTier] || 0) ? tier : previous.highestTier,
    lastOutcome: outcome,
    lastSeen: now
  }
  knowledge.experience += gain
  knowledge.beasts[id] = entry
  knowledge.history.unshift({
    beastId: id,
    name: entry.name,
    outcome,
    tier,
    ringHunt: Boolean(context.ringHunt),
    eventName: String(context.eventName || '').trim(),
    time: now
  })
  knowledge.history = knowledge.history.slice(0, HUNTING_HISTORY_LIMIT)
  return { knowledge, gain, entry }
}

export function beastKnowledgeSummary(current, beastId) {
  const knowledge = normalizeHuntingKnowledge(current)
  const entry = knowledge.beasts[String(beastId || '')]
  if (!entry) return { known: false, label: '尚无实战记录', knowledge: 0, rank: '未知', encounters: 0, victories: 0 }
  return {
    known: true,
    label: `${knowledgeRank(entry.knowledge)} ${entry.knowledge}/100 · ${entry.encounters}战${entry.victories}胜`,
    ...entry,
    rank: knowledgeRank(entry.knowledge),
    tierLabel: TIER_LABELS[entry.highestTier] || ''
  }
}

export function huntingJournalRows(current, limit = 4) {
  const knowledge = normalizeHuntingKnowledge(current)
  return Object.values(knowledge.beasts)
    .sort((a, b) => b.lastSeen - a.lastSeen || b.knowledge - a.knowledge || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, Math.max(0, safeInt(limit, 12)))
    .map(entry => ({
      ...entry,
      rank: knowledgeRank(entry.knowledge),
      tierLabel: TIER_LABELS[entry.highestTier] || '',
      outcomeLabel: OUTCOME_LABELS[entry.lastOutcome] || '未记'
    }))
}
