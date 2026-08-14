/**
 * 事件与战斗资源的统一解析入口。
 * 旧事件数据使用英文文件名，实际 public/assets 使用中文资源名；所有 Vue
 * 事件、战斗和审计都必须经过这里，避免浏览器先请求一个不存在的旧路径。
 */
export const EVENT_ASSET_ALIASES = Object.freeze({
  'assets/scenes/library.jpg': 'assets/scenes/library_night.jpg',
  'assets/scenes/ruin.jpg': 'assets/scenes/temple.jpg',
  'assets/scenes/sky_city.jpg': 'assets/locations/天空之城.jpg',
  'assets/scenes/tian_dou_city.jpg': 'assets/locations/天斗城.jpg',
  'assets/beasts/black_water_dragon.jpg': 'assets/beasts/黑水蛟龙.jpg',
  'assets/beasts/blue_frog.jpg': 'assets/beasts/蓝蛙.jpg',
  'assets/beasts/dark_gold_terrorclaw_bear.jpg': 'assets/beasts/暗金恐爪熊.jpg',
  'assets/beasts/deep_sea_demon_whale_king.jpg': 'assets/beasts/深海魔鲸王.jpg',
  'assets/beasts/earth_bear.jpg': 'assets/beasts/大地之熊.jpg',
  'assets/beasts/evil_demon_tiger_shark.jpg': 'assets/beasts/邪魔虎鲨.jpg',
  'assets/beasts/flame_tiger.jpg': 'assets/beasts/烈焰虎.jpg',
  'assets/beasts/flower_snake.jpg': 'assets/beasts/花蛇.jpg',
  'assets/beasts/human_faced_spider.jpg': 'assets/beasts/人面魔蛛.jpg',
  'assets/beasts/ice_emperor_scorpion.jpg': 'assets/beasts/冰帝蝎.jpg',
  'assets/beasts/ice_wolf.jpg': 'assets/beasts/冰狼.jpg',
  'assets/beasts/iron_armor_bear.jpg': 'assets/beasts/铁甲熊.jpg',
  'assets/beasts/iron_horn_sheep.jpg': 'assets/beasts/铁角羊.jpg',
  'assets/beasts/marmot.jpg': 'assets/beasts/土拨鼠.jpg',
  'assets/beasts/nether_wolf_king.jpg': 'assets/beasts/幽冥狼王.jpg',
  'assets/beasts/one_eye_wolf.jpg': 'assets/beasts/独眼狼.jpg',
  'assets/beasts/poison_spider.jpg': 'assets/beasts/毒蛛.jpg',
  'assets/beasts/rock_python.jpg': 'assets/beasts/岩蟒.jpg',
  'assets/beasts/shadow_fox.jpg': 'assets/beasts/暗影狐.jpg',
  'assets/beasts/sky_blue_bull_python.jpg': 'assets/beasts/天青牛蟒.jpg',
  'assets/beasts/soft_bone_rabbit.jpg': 'assets/beasts/柔骨兔.jpg',
  'assets/beasts/spirit_deer.jpg': 'assets/beasts/灵鹿.jpg',
  'assets/beasts/thousand_eye_centipede.jpg': 'assets/beasts/千眼蜈蚣.jpg',
  'assets/beasts/thunder_bird.jpg': 'assets/beasts/雷鸟.jpg',
  'assets/beasts/titan_giant_ape.jpg': 'assets/beasts/泰坦巨猿.jpg',
  'assets/beasts/titan_giant_ape_king.jpg': 'assets/beasts/泰坦巨猿王.jpg',
  'assets/beasts/wild_rabbit.jpg': 'assets/beasts/野兔.jpg',
  'assets/beasts/wind_butterfly.jpg': 'assets/beasts/风蝶.jpg',
  'assets/beasts/wind_spirit_swallow.jpg': 'assets/beasts/风灵燕.jpg',
  'assets/spirits/blue_silver_grass.jpg': 'assets/spirits/蓝银草.jpg',
  'assets/spirits/haotian_hammer.jpg': 'assets/spirits/昊天锤.jpg',
  'assets/spirits/jiubao_pagoda.jpg': 'assets/spirits/九宝琉璃塔.jpg',
  'assets/spirits/qisha_sword.jpg': 'assets/spirits/七杀剑.jpg',
  'assets/spirits/tyrant_dragon.jpg': 'assets/spirits/蓝电霸王龙.jpg',
  'assets/spirits/void_eye.jpg': 'assets/spirits/虚空之眼.jpg',
  'assets/spirits/youming_cat.jpg': 'assets/spirits/幽冥灵猫.jpg'
})

export function resolveAssetPath(value) {
  if (typeof value !== 'string' || !value.trim()) return value || ''
  const normalized = value.trim().replace(/^\/+/, '')
  return EVENT_ASSET_ALIASES[normalized] || normalized
}

export function resolveEventAsset(event) {
  if (!event || typeof event !== 'object') return event
  return event.image ? { ...event, image: resolveAssetPath(event.image) } : event
}
