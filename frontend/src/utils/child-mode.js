import { MAIN_STORY_REQUIREMENTS } from '@/engine/event-rules'

export const CHILD_STORY_MILESTONES = [
  { id: 'first_hunt', label: '去森林打赢第一只怪', minLevel: 5, targetId: 'star_duo_outer' },
  { id: 'reach_lv10', label: '升到 10 级', minLevel: 10, requires: ['first_hunt'] },
  { id: 'soul_master_prelim', label: '参加大赛预赛', minLevel: 30, targetId: 'tian_dou_city', requires: MAIN_STORY_REQUIREMENTS.soul_master_prelim },
  { id: 'spirit_hall_exam', label: '通过武魂殿考验', minLevel: 30, targetId: 'spirit_hall', requires: MAIN_STORY_REQUIREMENTS.spirit_hall_exam },
  { id: 'soul_master_final', label: '参加大赛决赛', minLevel: 40, targetId: 'tian_dou_city', requires: MAIN_STORY_REQUIREMENTS.soul_master_final },
  { id: 'god_trial_sea', label: '去海神岛闯关', minLevel: 50, targetId: 'sea_god_island', requires: MAIN_STORY_REQUIREMENTS.god_trial_sea },
  { id: 'ml_bibi_omen', label: '调查教皇的秘密', minLevel: 60, targetId: 'wuhun_city', requires: MAIN_STORY_REQUIREMENTS.ml_bibi_omen },
  { id: 'ml_bibi_hunt', label: '冲破森林封锁', minLevel: 72, targetId: 'star_duo_deep', requires: MAIN_STORY_REQUIREMENTS.ml_bibi_hunt },
  { id: 'final_evil', label: '打赢最后一战', minLevel: 95, targetId: 'wuhun_city', requires: MAIN_STORY_REQUIREMENTS.final_evil }
]

export const CHILD_LOCATION_NAMES = {
  holy_soul_village: '圣魂村',
  shrek_academy: '史莱克学院',
  star_duo_outer: '星斗森林外围',
  star_duo_deep: '星斗森林深处',
  wuhun_city: '武魂城',
  spirit_hall: '武魂殿',
  tian_dou_city: '天斗城',
  east_sea_port: '东海港口',
  sunset_forest: '落日森林',
  sea_god_island: '海神岛',
  ice_forest: '冰封森林',
  slaughter_city: '杀戮之都',
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
  seven_treasure_glaze: '七宝琉璃宗'
}

const CHILD_WORDS = [
  [/武魂真身/g, '变身'],
  [/魂环年限|年限/g, '强度'],
  [/生命值|生命/g, '体力'],
  [/魂力/g, '能量'],
  [/冷却/g, '等一下'],
  [/阶段/g, '小步'],
  [/命运值|命运点|命运/g, '好运'],
  [/权重/g, '机会'],
  [/元素克制|克制/g, '更占优势'],
  [/猎杀魂兽/g, '去打怪'],
  [/万象地图/g, '地图'],
  [/万象图鉴/g, '图鉴'],
  [/修炼至\s*Lv\.?\s*/gi, '升到 '],
  [/Lv\.?\s*/gi, '等级 '],
  [/经验值/g, '升级进度'],
  [/经验/g, '升级点数'],
  [/金币/g, '金魂币']
]

export function stripRichText(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '。')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function childCopy(value = '') {
  let text = stripRichText(value)
  for (const [pattern, replacement] of CHILD_WORDS) text = text.replace(pattern, replacement)
  return text
    .replace(/\s*([，。！？；：])\s*/g, '$1')
    .replace(/。{2,}/g, '。')
    .trim()
}

export function shortChildStory(value, maxSentences = 3, maxChars = 150) {
  const source = Array.isArray(value) ? value.join('。') : value
  const text = childCopy(source)
  if (!text) return ''
  const sentences = text.match(/[^。！？；]+[。！？；]?/g) || [text]
  let result = sentences.slice(0, Math.max(1, maxSentences)).join('').trim()
  if (result.length > maxChars) result = `${result.slice(0, Math.max(1, maxChars - 1)).replace(/[，、；：\s]+$/g, '')}…`
  return result
}

export function shortChildChoice(value = '') {
  const text = childCopy(value).replace(/^[A-DＡ-Ｄ][.、：:]\s*/i, '')
  return text.length > 34 ? `${text.slice(0, 33).replace(/[，、；：\s]+$/g, '')}…` : text
}

export function childRewardLine(rewards = [], fallbackText = '') {
  const visible = (Array.isArray(rewards) ? rewards : [])
    .map(childCopy)
    .filter(Boolean)
    .slice(0, 4)
  if (visible.length) return `拿到：${visible.join('、')}`
  const fallback = shortChildStory(fallbackText, 1, 72)
  return fallback || '奖励已经自动收好。'
}

export function nextChildMilestone(eventStore = {}) {
  const done = Array.isArray(eventStore.doneEvents) ? eventStore.doneEvents : []
  if (Number(eventStore._mainStoryVersion) < 1) {
    return done.includes('final_evil') ? null : CHILD_STORY_MILESTONES[CHILD_STORY_MILESTONES.length - 1]
  }
  return CHILD_STORY_MILESTONES.find(item => {
    if (done.includes(item.id)) return false
    return (item.requires || []).every(id => done.includes(id))
  }) || null
}

export function buildChildGuide({ player = {}, eventStore = {}, gameStore = {}, sceneState = 'idle', currentEvent = null } = {}) {
  if (player.finished || sceneState === 'ending') {
    return { icon: '★', text: '你的冒险完成了！', action: '', button: '' }
  }
  if (sceneState === 'battle') {
    return { icon: '⚔', text: '正在自动打怪。想自己出招，也可以点下面的大按钮。', action: '', button: '' }
  }
  if (sceneState === 'event') {
    return { icon: '➜', text: '选一个你喜欢的办法，故事就会继续。', action: 'choose', button: '选一个办法' }
  }
  if (sceneState === 'continue') {
    return { icon: '✓', text: '奖励收好了。继续出发吧！', action: 'continue', button: '继续出发' }
  }

  const currentLocation = gameStore._currentLocation || ''
  const pendingRing = Number(eventStore.pendingRingLv) || 0
  const ringTarget = eventStore._ringTargetId || ''
  if (pendingRing) {
    if (ringTarget && currentLocation !== ringTarget) {
      const place = CHILD_LOCATION_NAMES[ringTarget] || eventStore._ringTargetName || '目标地点'
      return { icon: '🗺', text: `下一步：去${place}拿新魂环。`, action: 'map', button: '带我去' }
    }
    return { icon: '⚔', text: '下一步：打赢目标，拿到新魂环。', action: 'hunt', button: '去打怪' }
  }

  const milestone = nextChildMilestone(eventStore)
  if (!milestone) return { icon: '✦', text: '继续探索，看看还会遇到什么。', action: 'explore', button: '去探索' }
  if ((Number(player.level) || 1) < milestone.minLevel) {
    return {
      icon: '⬆',
      text: `下一步：继续探索，升到 ${milestone.minLevel} 级。`,
      action: sceneState === 'location' ? 'location-primary' : 'explore',
      button: sceneState === 'location' ? '开始探索' : '去探索'
    }
  }
  if (milestone.targetId && currentLocation !== milestone.targetId) {
    const place = CHILD_LOCATION_NAMES[milestone.targetId] || '目标地点'
    return { icon: '🗺', text: `下一步：去${place}，${milestone.label}。`, action: 'map', button: '带我去' }
  }
  return {
    icon: '★',
    text: `下一步：${milestone.label}。`,
    action: sceneState === 'location' ? 'location-primary' : 'explore',
    button: sceneState === 'location' ? '现在开始' : '去探索'
  }
}
