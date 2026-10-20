/** Shared game clock units. */
export const ACTIONS_PER_DAY = 8
export const ACTIONS_PER_SEASON = ACTIONS_PER_DAY * 4

export function travelDurationDays(days) {
  const value = Number(days)
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
}

export function travelDurationTicks(days) {
  return travelDurationDays(days) * ACTIONS_PER_DAY
}
