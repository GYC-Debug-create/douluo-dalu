/**
 * 引导条（儿童版常驻）：任何时刻用一句话告诉小朋友"下一步做什么"，并给一个主按钮。
 *
 * 儿童版只保留一种模式：正文、术语与原著一致，不再做机械截断或词语替换；
 * 这里只负责"下一步"提示。主线顺序直接读取 engine/event-rules 的里程碑表（单一来源）。
 */
import { nextMainStoryMilestone } from '@/engine/event-rules'

export const LOCATION_NAMES = Object.freeze({
  holy_soul_village: '圣魂村',
  nuoding_city: '诺丁城',
  shrek_academy: '史莱克学院',
  star_duo_outer: '星斗大森林外围',
  star_duo_deep: '星斗大森林深处',
  wuhun_city: '武魂城',
  spirit_hall: '武魂殿',
  tian_dou_city: '天斗城',
  east_sea_port: '东海港口',
  sunset_forest: '落日森林',
  sea_god_island: '海神岛',
  ice_forest: '冰封森林',
  slaughter_city: '试炼之城',
  ancient_ruins: '远古遗迹',
  abyss_rift: '深渊裂缝',
  dragon_valley: '龙之谷',
  medicine_valley: '灵药谷',
  shadow_swamp: '暗影沼泽',
  element_valley: '元素峡谷',
  desert_death: '死亡沙漠',
  evil_forest: '邪魔森林',
  steel_city: '钢铁之城',
  sky_city: '天空之城',
  haotian_sect: '昊天宗',
  seven_treasure_glaze: '七宝琉璃宗',
  strength_clan: '力之一族领地',
  speed_clan: '敏之一族领地',
  defense_clan: '御之一族领地',
  breaking_clan: '破之一族领地'
})

export function buildChildGuide({ player = {}, eventStore = {}, gameStore = {}, sceneState = 'idle', currentEvent = null } = {}) {
  if (player.finished || sceneState === 'ending') {
    return { icon: '★', text: '你的冒险完成了！可以回到标题页，开始一段新的旅程。', action: '', button: '' }
  }
  if (sceneState === 'battle') {
    return { icon: '⚔', text: '战斗中：默认自动出招。想自己指挥，点下面任意一个招式就行。', action: '', button: '' }
  }
  if (sceneState === 'event') {
    return { icon: '➜', text: '读完故事，选一个你想做的选项。', action: '', button: '' }
  }
  if (sceneState === 'continue') {
    if (currentEvent?._travelGuideType && currentEvent?.targetId) {
      const place = LOCATION_NAMES[currentEvent.targetId] || '目标地点'
      return { icon: '🗺', text: `下一个目标在${place}，打开地图走过去吧。`, action: 'map', button: '打开地图' }
    }
    return { icon: '✓', text: '看完结果了吗？继续前进吧！', action: 'continue', button: '继续前行' }
  }

  const currentLocation = gameStore._currentLocation || ''
  const pendingRing = Number(eventStore.pendingRingLv) || 0
  const ringTarget = eventStore._ringTargetId || ''
  if (pendingRing) {
    if (ringTarget && currentLocation !== ringTarget) {
      const place = LOCATION_NAMES[ringTarget] || eventStore._ringTargetName || '目标地点'
      return { icon: '🗺', text: `下一步：去${place}猎取新的魂环。`, action: 'map', button: '打开地图' }
    }
    return { icon: '⚔', text: '下一步：在这里猎取新的魂环！', action: 'hunt', button: '去猎魂环' }
  }

  const milestone = nextMainStoryMilestone({ mainStoryVersion: eventStore._mainStoryVersion, doneEvents: eventStore.doneEvents })
  if (!milestone) return { icon: '✦', text: '主线都完成啦！继续探索，看看还会遇到什么。', action: 'explore', button: '去探索' }
  const label = milestone.guideLabel || milestone.name
  if ((Number(player.level) || 1) < milestone.minLevel) {
    return {
      icon: '⬆',
      text: `下一步：继续历练，升到 ${milestone.minLevel} 级就能开启主线「${label}」。`,
      action: sceneState === 'location' ? 'location-primary' : 'explore',
      button: sceneState === 'location' ? '探索当地' : '去探索'
    }
  }
  if (milestone.targetId && currentLocation !== milestone.targetId) {
    const place = LOCATION_NAMES[milestone.targetId] || '目标地点'
    return { icon: '🗺', text: `下一步：去${place}，开启主线「${label}」。`, action: 'map', button: '打开地图' }
  }
  return { icon: '★', text: `主线「${label}」已经可以开始了！`, action: 'story', button: '开始主线' }
}
