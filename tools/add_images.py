#!/usr/bin/env python3
"""为NPC、魂骨、地点数据添加图片字段"""
import json

# NPC 图片
with open(r'd:\GYC\project\斗罗大陆\public\data\npc-codex.json', 'r', encoding='utf-8') as f:
    npc_data = json.load(f)

npc_images = {
    'tang_san': 'assets/npcs/tang_san.jpg',
    'xiao_wu': 'assets/npcs/xiao_wu.jpg',
    'dai_mubai': 'assets/npcs/dai_mubai.jpg',
    'oscar': 'assets/npcs/oscar.jpg',
    'ma_hongjun': 'assets/npcs/ma_hongjun.jpg',
    'ning_rongrong': 'assets/npcs/ning_rongrong.jpg',
    'zhu_zhuqing': 'assets/npcs/zhu_zhuqing.jpg',
    'bai_chenxiang': 'assets/npcs/bai_chenxiang.jpg',
    'yu_xiaogang': 'assets/npcs/yu_xiaogang.jpg',
    'zhao_wuji': 'assets/npcs/zhao_wuji.jpg',
    'liu_erlong': 'assets/npcs/liu_erlong.jpg',
    'flender': 'assets/npcs/flender.jpg',
    'tang_hao': 'assets/npcs/tang_hao.jpg',
    'tang_chen': 'assets/npcs/tang_chen.jpg',
    'tang_xiao': 'assets/npcs/tang_xiao.jpg',
    'ning_fengzhi': 'assets/npcs/ning_fengzhi.jpg',
    'ning_rongrong_jb': 'assets/npcs/ning_rongrong.jpg',
    'jian_douluo': 'assets/npcs/jian_douluo.jpg',
    'bi_bidong': 'assets/npcs/bi_bidong.jpg',
    'qian_renxue': 'assets/npcs/qian_renxue.jpg',
    'hu_liena': 'assets/npcs/hu_liena.jpg',
    'xie_yue': 'assets/npcs/xie_yue.jpg',
    'xue_beng': 'assets/npcs/xue_beng.jpg',
    'xue_xing': 'assets/npcs/xue_xing.jpg',
    'xue_qinghe': 'assets/npcs/xue_qinghe.jpg',
    'sea_god': 'assets/npcs/sea_god.jpg',
    'angel_god': 'assets/npcs/angel_god.jpg',
    'asura_god': 'assets/npcs/asura_god.jpg',
    'rakasha_god': 'assets/npcs/rakasha_god.jpg',
    'po_seidon': 'assets/npcs/po_seidon.jpg',
    'life_goddess': 'assets/npcs/life_goddess.jpg',
    'destruction_god': 'assets/npcs/destruction_god.jpg',
    'dragon_god': 'assets/npcs/dragon_god.jpg',
}

for npc in npc_data['npcs']:
    npc['image'] = npc_images.get(npc['id'], '')

with open(r'd:\GYC\project\斗罗大陆\public\data\npc-codex.json', 'w', encoding='utf-8') as f:
    json.dump(npc_data, f, ensure_ascii=False, indent=2)
print(f'NPC images added: {sum(1 for n in npc_data["npcs"] if n["image"])} / {len(npc_data["npcs"])}')

# 魂骨图片
with open(r'd:\GYC\project\斗罗大陆\public\data\bone-codex.json', 'r', encoding='utf-8') as f:
    bone_data = json.load(f)

bone_images = {}
for bone in bone_data['bones']:
    bone['image'] = f'assets/bones/{bone["id"]}.jpg'

with open(r'd:\GYC\project\斗罗大陆\public\data\bone-codex.json', 'w', encoding='utf-8') as f:
    json.dump(bone_data, f, ensure_ascii=False, indent=2)
print(f'Bone images added: {len(bone_data["bones"])}')

# 地点图片
with open(r'd:\GYC\project\斗罗大陆\public\data\location-codex.json', 'r', encoding='utf-8') as f:
    loc_data = json.load(f)

loc_images = {
    '史莱克学院': 'assets/locations/shrek_academy.jpg',
    '星斗大森林': 'assets/locations/star_forest.jpg',
    '落日森林': 'assets/locations/sunset_forest.jpg',
    '武魂城': 'assets/locations/spirit_hall.jpg',
    '天斗城': 'assets/locations/heaven_dou_city.jpg',
    '星罗城': 'assets/locations/star_luo_city.jpg',
    '海神岛': 'assets/locations/sea_god_island.jpg',
    '杀戮之都': 'assets/locations/killing_city.jpg',
    '昊天宗': 'assets/locations/haotian_sect.jpg',
    '七宝琉璃宗': 'assets/locations/seven_treasure_sect.jpg',
    '蓝电霸王龙宗': 'assets/locations/blue_lightning_sect.jpg',
    '猎魂森林': 'assets/locations/spirit_beast_forest.jpg',
    '极北之地': 'assets/locations/north_pole.jpg',
    '龙谷': 'assets/locations/dragon_valley.jpg',
    '水晶森林': 'assets/locations/crystal_forest.jpg',
    '火焰山': 'assets/locations/flame_mountain.jpg',
    '沙漠绿洲': 'assets/locations/desert_oasis.jpg',
    '天空之城': 'assets/locations/sky_city.jpg',
    '地下城': 'assets/locations/underground_city.jpg',
    '鬼雾森林': 'assets/locations/ghost_forest.jpg',
    '圣域': 'assets/locations/sacred_land.jpg',
    '魂兽沼泽': 'assets/locations/soul_swamp.jpg',
    '神界': 'assets/locations/divine_realm.jpg',
    '鲸海': 'assets/locations/whale_sea.jpg',
    '古战场': 'assets/locations/ancient_battlefield.jpg',
}

for loc in loc_data['locations']:
    loc['image'] = loc_images.get(loc.get('name', ''), f'assets/locations/{loc.get("name","")}.jpg')

with open(r'd:\GYC\project\斗罗大陆\public\data\location-codex.json', 'w', encoding='utf-8') as f:
    json.dump(loc_data, f, ensure_ascii=False, indent=2)
print(f'Location images added: {len(loc_data["locations"])}')
print('Done!')