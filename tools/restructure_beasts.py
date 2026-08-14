#!/usr/bin/env python3
"""重构魂兽数据：合并beast-codex.json和beast-variants.json，按种类分组"""
import json

with open(r'd:\GYC\project\斗罗大陆\public\data\beast-codex.json', 'r', encoding='utf-8') as f:
    codex = json.load(f)
with open(r'd:\GYC\project\斗罗大陆\public\data\beast-variants.json', 'r', encoding='utf-8') as f:
    variants = json.load(f)

# Types for grouping
types = {}
for b in codex['beasts']:
    t = b['type']
    if t not in types:
        types[t] = []

# Merge each beast with its variants
new_beasts = []
for b in codex['beasts']:
    bvars = variants.get(b['id'], {})
    new_b = {
        'id': b['id'],
        'name': b['name'],
        'type': b['type'],
        'habitat': b['habitat'],
        'rarity': b['rarity'],
        'icon': b.get('icon', ''),
        'desc': b.get('desc', ''),
        'traits': b.get('traits', []),
        'specialAbility': b.get('specialAbility', ''),
        'image': b.get('image', ''),
        'variants': bvars.get('variants', {})
    }
    new_beasts.append(new_b)
    types[b['type']].append(new_b)

# New meta with species-based tiers
new_meta = {
    'title': '斗罗大陆·魂兽图鉴',
    'description': '收录斗罗大陆世界中已知的魂兽种族，按种类分组。每个种族均包含十年至十万年的完整年份变体',
    'tiers': {}
}

# Type → color mapping
type_colors = {
    '草食系': '#22c55e',
    '肉食系': '#ef4444',
    '飞行系': '#3b82f6',
    '水栖系': '#06b6d4',
    '虫系': '#a855f7',
    '爬行系': '#84cc16',
    '元素系': '#f59e0b',
    '龙系': '#dc2626',
    '神兽系': '#fbbf24',
    '特殊系': '#ec4899'
}

for tname in types:
    new_meta['tiers'][tname] = {
        'name': tname,
        'color': type_colors.get(tname, '#94a3b8'),
        'desc': f'共{len(types[tname])}种魂兽'
    }

output = {
    'meta': new_meta,
    'beasts': new_beasts
}

with open(r'd:\GYC\project\斗罗大陆\public\data\beast-codex.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f'Done! {len(new_beasts)} species, {len(types)} types: {list(types.keys())}')