import { levelCapForRings } from './rules'

export const ACHIEVEMENT_REWARD = Object.freeze({ gold:50, exp:20 })

export function itemPurchaseAvailability(item, player) {
  if (!item || !player) return { ok: false, reason: '商品不可用' }
  if (item.reqLevel && player.level < item.reqLevel) return { ok: false, reason: `需要${item.reqLevel}级` }
  if (item.type === 'exp') {
    const level = Number(player.level) || 1
    if (level >= 100) return { ok: false, reason: '已达100级，经验丹不可购买' }
    const cap = levelCapForRings(player.rings?.length || 0)
    if (level >= cap) return { ok: false, reason: `当前魂环上限为${cap}级，获得下一魂环后可购买` }
  }
  if ((Number(player.gold) || 0) < (Number(item.price) || 0)) return { ok: false, reason: '金币不足' }
  return { ok: true, reason: '' }
}
