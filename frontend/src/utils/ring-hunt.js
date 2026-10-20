import { beastKnowledgeSummary } from './beast-knowledge.js'

const RING_IDS = Object.freeze({
  ten: 'white_ring',
  hundred: 'yellow_ring',
  thousand: 'purple_ring',
  ten_thousand: 'black_ring',
  choice: 'red_ring'
})

export const RING_DESTINATIONS = Object.freeze({
  10: { id: 'star_duo_outer', name: '星斗大森林·外围' },
  20: { id: 'star_duo_outer', name: '星斗大森林·外围' },
  30: { id: 'star_duo_deep', name: '星斗大森林·深处' },
  40: { id: 'star_duo_deep', name: '星斗大森林·深处' },
  // 第五环的猎物（暗金恐爪熊、人面魔蛛）生活在星斗大森林深处，与事件文本一致
  50: { id: 'star_duo_deep', name: '星斗大森林·深处' },
  60: { id: 'wuhun_city', name: '武魂城' },
  70: { id: 'star_duo_deep', name: '星斗大森林·深处' },
  80: { id: 'sea_god_island', name: '海神岛' },
  90: { id: 'sky_city', name: '天空之城' }
})

export function ringDestination(level) {
  return RING_DESTINATIONS[Math.floor(Number(level) || 0)] || null
}

export function buildRingHuntMeta({
  pendingRingLv,
  ringLevel = pendingRingLv,
  ringCount = 0,
  targetId = '',
  targetName = ''
} = {}) {
  const level = Math.max(0, Math.floor(Number(ringLevel) || Number(pendingRingLv) || 0))
  const destination = ringDestination(level)
  return {
    ringOrdinal: Math.max(1, Math.min(9, Math.floor(Number(ringCount) || 0) + 1)),
    ringLevel: level || null,
    ringTargetId: targetId || destination?.id || null,
    ringTargetName: targetName || destination?.name || ''
  }
}

export function buildRingCompletionMessage({
  ringLevel,
  ringOrdinal,
  ringTargetName
} = {}) {
  const ordinal = Math.max(1, Math.min(9, Math.floor(Number(ringOrdinal) || 1)))
  const level = Math.max(0, Math.floor(Number(ringLevel) || 0))
  const target = ringTargetName || ringDestination(level)?.name || '目标区域'
  return `第${ordinal}魂环猎取已完成。目标区域「${target}」的猎魂记录已经归档，你可以继续探索当地或返回万象地图。`
}

export function buildRingObjective({
  pendingRingLv,
  ringCount = 0,
  playerLevel = 1,
  currentLocation = '',
  eventCount = 0,
  deferredUntil = 0
} = {}) {
  const requiredLevel = Math.floor(Number(pendingRingLv) || 0)
  if (!requiredLevel || ringCount >= 9) return null
  const destination = ringDestination(requiredLevel)
  const deferredActions = Math.max(0, Math.floor(Number(deferredUntil) || 0) - Math.floor(Number(eventCount) || 0))
  const atDestination = Boolean(destination && destination.id === currentLocation)
  const eligible = Number(playerLevel) >= requiredLevel
  const meta = buildRingHuntMeta({ pendingRingLv: requiredLevel, ringCount })
  let status = eligible ? '魂环位已解锁' : `还需提升至 Lv.${requiredLevel}`
  if (deferredActions > 0) status = `已挂起 · ${deferredActions} 次行动后自动提醒`
  else if (eligible && atDestination) status = '已抵达猎环区域 · 可以继续'
  else if (eligible && destination) status = `待出发 · 前往${destination.name}`
  return {
    ...meta,
    ordinal: meta.ringOrdinal,
    title: `第${meta.ringOrdinal}魂环`,
    requiredLevel,
    playerLevel: Math.max(1, Math.floor(Number(playerLevel) || 1)),
    eligible,
    destination,
    atDestination,
    deferredActions,
    status
  }
}

export function ringDefinitionIdForChoice(event, choice, choiceIndex) {
  if (event?.id === 'ring_hunt_60') return choiceIndex === 0 ? 'god_given_ring' : null
  if (event?.id === 'ring_hunt_90') return choiceIndex === 0 ? 'million_gold_ring' : 'god_given_ring'
  return RING_IDS[choice?.ringTier || event?.ring] || null
}

export function beastTierForEncounter(key, playerLevel) {
  const explicit = String(key || '').match(/_(ten|hundred|thousand|ten_thousand|hundred_thousand)$/)?.[1]
  if (explicit) return explicit
  if (playerLevel >= 75) return 'hundred_thousand'
  if (playerLevel >= 50) return 'ten_thousand'
  if (playerLevel >= 28) return 'thousand'
  if (playerLevel >= 10) return 'hundred'
  return 'ten'
}

export function buildFirstHuntStatus({ level = 1, ringCount = 0 } = {}) {
  const currentLevel = Math.max(1, Math.floor(Number(level) || 1))
  const currentRings = Math.max(0, Math.min(9, Math.floor(Number(ringCount) || 0)))
  if (currentRings > 0) {
    const nextLevel = currentRings < 9 ? (currentRings + 1) * 10 : null
    const owned = currentRings === 1 ? '已经拥有第1魂环' : `已经拥有${currentRings}个魂环`
    const nextText = !nextLevel
      ? ''
      : currentLevel >= nextLevel
        ? `第${currentRings + 1}魂环的猎取资格已经解锁。`
        : `第${currentRings + 1}魂环将在 Lv.${nextLevel} 解锁。`
    return {
      state: 'ring-owned',
      intro: `你当前 Lv.${currentLevel}，${owned}。这是补上的学院实战课，不会重复授予魂环。`,
      result: nextLevel
        ? `✦ 实战训练完成。你${owned}，本次训练不会重复授环；${nextText}`
        : '✦ 实战训练完成。你已拥有全部九个魂环，本次训练不会重复授环。'
    }
  }
  if (currentLevel >= 10) {
    return {
      state: 'eligible',
      intro: `你当前 Lv.${currentLevel}，第一魂环猎取资格已经解锁。这堂课仍是实战训练，不会在这里直接授环。`,
      result: '✦ 实战训练完成。本次训练不授环；第一魂环目标已解锁，请按侧边猎环目标前往正式猎环。'
    }
  }
  const remaining = 10 - currentLevel
  return {
    state: 'training',
    intro: `你当前 Lv.${currentLevel}，距离第一魂环资格 Lv.10 还差 ${remaining} 级。这堂课只积累实战经验，不会授予魂环。`,
    result: `✦ 实战训练完成。当前 Lv.${currentLevel}，距离 Lv.10 还差 ${remaining} 级；达到后可按猎环目标正式获取第一魂环。`
  }
}

export function prepareFirstHuntEvent(event, player) {
  if (event?.id !== 'first_hunt') return event
  const status = buildFirstHuntStatus({ level: player?.level, ringCount: player?.rings?.length })
  const text = Array.isArray(event.text) ? event.text : [event.text].filter(Boolean)
  const choices = (event.choices || []).map(choice => {
    const result = { ...(choice.result || {}) }
    const rawText = String(result.text || '')
    const legacyMarker = '<br><br><span style="color:#7fc48c">✦ 实战训练完成。'
    const markerIndex = rawText.indexOf(legacyMarker)
    const baseText = markerIndex >= 0 ? rawText.slice(0, markerIndex) : rawText
    result.text = `${baseText}<br><br><span style="color:#7fc48c">${status.result}</span>`
    return { ...choice, result }
  })
  return {
    ...event,
    text: [text[0], status.intro, ...text.slice(2)].filter(Boolean),
    choices,
    trainingStatus: status.state
  }
}

export function prepareFirstRingEvent(event, player, stats = {}, huntingKnowledge = null) {
  if (event?.id !== 'ring_hunt_10') return event
  const innatePower = Math.max(0, Number(player?.innatePower) || 0)
  const maxHp = Math.max(1, Number(stats.maxHp) || Number(player?.hp) || 1)
  const hpRatio = Math.min(1, Math.max(0, Number(player?.hp) || 0) / maxHp)
  const choices = (event.choices || []).map(choice => {
    const strategy = { ...(choice.strategy || {}) }
    let assessment = '稳妥推荐'
    if (hpRatio < 0.75) assessment = '当前状态不佳，建议谨慎'
    else if (choice.ringTier === 'hundred') {
      assessment = innatePower >= (Number(strategy.recommendedInnate) || 70)
        ? '当前根基匹配'
        : '越级挑战，失败风险较高'
    }
    const knowledge = beastKnowledgeSummary(huntingKnowledge, choice.beastId)
    return { ...choice, strategy: { ...strategy, assessment, knowledge: knowledge.label } }
  })
  return {
    ...event,
    choices,
    text: [
      ...(Array.isArray(event.text) ? event.text : []),
      `当前评估：觉醒资质 ${innatePower}/100，生命状态 ${Math.round(hpRatio * 100)}%。年限越高，魂兽更强、吸收收益也更高；战败不会获得魂环，需历练两次后重新搜寻。`
    ]
  }
}
