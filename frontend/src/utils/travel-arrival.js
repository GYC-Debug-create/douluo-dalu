import { richText } from '@/engine/rules'

export function travelArrivalSummaryText(arrival = {}) {
  const plan = arrival.destinationPlan && typeof arrival.destinationPlan === 'object'
    ? arrival.destinationPlan
    : {}
  return [
    `出发地：${arrival.fromName || '旅途'}`,
    `抵达目标：${arrival.targetName || '新的地域'}`,
    `旅费：${arrival.cost || 0}金币`,
    `旅行天数：约${arrival.travelDays || 1}天`,
    plan.primary ? `抵达后的首要目标：${plan.primary}` : '',
    plan.contact ? `人物线索：${plan.contact}` : '',
    plan.fit ? `武魂适配：${plan.fit}` : '',
    plan.risk ? `区域评估：${plan.risk}` : '',
    Array.isArray(arrival.revealed) && arrival.revealed.length
      ? `途中发现：${arrival.revealed.join('、')}`
      : ''
  ].filter(Boolean).join('<br>')
}

export function buildTravelArrivalSummary(arrival = {}) {
  return richText(travelArrivalSummaryText(arrival))
}
