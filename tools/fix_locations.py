#!/usr/bin/env python3
"""为地点数据添加id和region字段"""
import json

with open(r'd:\GYC\project\斗罗大陆\public\data\location-codex.json', 'r', encoding='utf-8') as f:
    loc_data = json.load(f)

name_to_id = {
    '史莱克学院': 'shrek_academy', '星斗大森林': 'star_forest', '武魂城': 'spirit_city',
    '天斗城': 'heaven_dou_city', '落日森林': 'sunset_forest', '猎魂森林': 'hunt_forest',
    '星罗城': 'star_luo_city', '海神岛': 'sea_god_island', '杀戮之都': 'killing_city',
    '昊天宗': 'haotian_sect', '七宝琉璃宗': 'seven_treasure_sect', '蓝电霸王龙宗': 'blue_lightning_sect',
    '极北之地': 'north_pole', '龙谷': 'dragon_valley', '水晶森林': 'crystal_forest',
    '火焰山': 'flame_mountain', '沙漠绿洲': 'desert_oasis', '天空之城': 'sky_city',
    '地下城': 'underground_city', '鬼雾森林': 'ghost_forest', '圣域': 'sacred_land',
    '魂兽沼泽': 'soul_swamp', '神界': 'divine_realm', '鲸海': 'whale_sea',
    '古战场': 'ancient_battlefield', '天斗皇宫': 'heaven_dou_palace',
}

region_map = {
    '史莱克学院': 'central', '星斗大森林': 'central', '武魂城': 'central',
    '天斗城': 'central', '落日森林': 'central', '猎魂森林': 'central',
    '星罗城': 'south', '海神岛': 'east', '杀戮之都': 'underworld',
    '昊天宗': 'north', '七宝琉璃宗': 'central', '蓝电霸王龙宗': 'central',
    '极北之地': 'west', '龙谷': 'north', '水晶森林': 'central',
    '火焰山': 'south', '沙漠绿洲': 'south', '天空之城': 'sky',
    '地下城': 'underworld', '鬼雾森林': 'central', '圣域': 'divine',
    '魂兽沼泽': 'central', '神界': 'divine', '鲸海': 'east',
    '古战场': 'north', '天斗皇宫': 'central',
}

for loc in loc_data['locations']:
    name = loc['name']
    loc['id'] = name_to_id.get(name, name.lower().replace(' ', '_'))
    loc['region'] = region_map.get(name, 'central')

with open(r'd:\GYC\project\斗罗大陆\public\data\location-codex.json', 'w', encoding='utf-8') as f:
    json.dump(loc_data, f, ensure_ascii=False, indent=2)

print(f'Updated {len(loc_data["locations"])} locations')
for loc in loc_data['locations']:
    print(f'  {loc["name"]} → id={loc["id"]}, region={loc["region"]}')