/**
 * 游戏全局配置
 */
const CONFIG = {
  // 游戏世界
  WORLD: {
    WIDTH: 3200,
    HEIGHT: 3200,
    TILE_SIZE: 32,
    CHUNK_SIZE: 16
  },
  
  // 渲染
  RENDER: {
    TILE_SCALE: 2,        // 像素缩放
    CAMERA_LERP: 0.1,     // 相机跟随平滑度
    FPS: 60
  },
  
  // 玩家
  PLAYER: {
    SIZE: 28,
    BASE_SPEED: 3,
    SPRINT_MULT: 1.8,
    SPRINT_COST: 0.5,
    STAMINA_REGEN: 0.3,
    ATTACK_COOLDOWN: 400,
    ATTACK_RANGE: 50,
    ATTACK_DAMAGE: 10,
    MAX_RINGS: 9,
    REVIVE_EXP_LOSS: 0.1
  },
  
  // 魂兽
  BEAST: {
    SPAWN_MAX: 25,        // 地图最大魂兽数量
    SPAWN_INTERVAL: 3000, // 生成间隔(ms)
    DESPAWN_DIST: 1200,   // 超出此距离消失
    AGGRO_RANGE: 250,     // 仇恨范围
    ATTACK_RANGE: 40,
    RING_DROP_RATE: 0.7,  // 魂环掉落率
    MIN_SPAWN_DIST: 500,  // 最小生成距离
    SPAWN_SAFE_TIME: 5000 // 开局安全时间(ms)
  },
  
  // 魂环
  RING: {
    LIFETIME: 30000,      // 魂环存在时间(ms)
    PICKUP_RANGE: 45,     // 拾取范围
    ABSORB_TIME: 2000     // 吸收耗时(ms)
  },
  
  // 经验值
  EXP: {
    BASE: 100,            // 1级所需经验
    GROWTH: 1.4,          // 经验成长系数
    MAX_LEVEL: 99
  },
  
  // 体力
  STAMINA: {
    MAX: 100,
    SPRINT_COST: 0.5
  },
  
  // 地形类型
  TERRAIN: {
    GRASS: { id: 0, name: '草地', color: '#3a5f3a', walkable: true, speedMod: 1 },
    FOREST: { id: 1, name: '森林', color: '#1f3a1f', walkable: true, speedMod: 0.8 },
    WATER: { id: 2, name: '水域', color: '#1e40af', walkable: false, speedMod: 0 },
    SAND: { id: 3, name: '沙地', color: '#c2a060', walkable: true, speedMod: 0.9 },
    ROCK: { id: 4, name: '岩石', color: '#4a4a4a', walkable: true, speedMod: 0.7 },
    PATH: { id: 5, name: '道路', color: '#6b5a3a', walkable: true, speedMod: 1.2 }
  }
};

// 武魂配置（与spirits.json对应，作为前端缓存）
const SPIRIT_DATA = {
  blue_silver_grass: {
    name: '蓝银草', type: '控制系', color: '#4ade80',
    icon: 'assets/spirits/蓝银草.jpg',
    baseAttack: 8, baseDefense: 5, baseSpeed: 6, baseHp: 100,
    skill: { name: '缠绕', range: 200, cooldown: 1500, damage: 15, type: 'projectile' },
    passive: '韧性生长'
  },
  haotian_hammer: {
    name: '昊天锤', type: '强攻系', color: '#a16207',
    icon: 'assets/spirits/昊天锤.jpg',
    baseAttack: 20, baseDefense: 12, baseSpeed: 3, baseHp: 140,
    skill: { name: '乱披风锤法', range: 120, cooldown: 2000, damage: 35, type: 'aoe' },
    passive: '重击'
  },
  qisha_sword: {
    name: '七杀剑', type: '敏攻系', color: '#06b6d4',
    icon: 'assets/spirits/七杀剑.jpg',
    baseAttack: 15, baseDefense: 7, baseSpeed: 10, baseHp: 110,
    skill: { name: '七杀剑气', range: 250, cooldown: 1000, damage: 22, type: 'beam' },
    passive: '锋锐'
  },
  youming_cat: {
    name: '幽冥灵猫', type: '敏攻系', color: '#6366f1',
    icon: 'assets/spirits/幽冥灵猫.jpg',
    baseAttack: 13, baseDefense: 6, baseSpeed: 14, baseHp: 100,
    skill: { name: '幽冥突袭', range: 300, cooldown: 1800, damage: 28, type: 'dash' },
    passive: '敏捷'
  },
  jiubao_pagoda: {
    name: '七宝琉璃塔', type: '辅助系', color: '#3b82f6',
    icon: 'assets/spirits/七宝琉璃塔.jpg',
    baseAttack: 7, baseDefense: 10, baseSpeed: 7, baseHp: 130,
    skill: { name: '七宝神光', range: 0, cooldown: 5000, damage: 0, heal: 40, buff: 1.3, type: 'buff' },
    passive: '增幅'
  },
  tyrant_dragon: {
    name: '霸王龙', type: '强攻系', color: '#dc2626',
    icon: 'assets/spirits/霸王龙.jpg',
    baseAttack: 25, baseDefense: 18, baseSpeed: 4, baseHp: 180,
    skill: { name: '霸王咆哮', range: 200, cooldown: 3000, damage: 50, type: 'aoe' },
    passive: '龙威'
  }
};

// 魂兽配置
const BEAST_DATA = {
  wild_deer: { name: '灵鹿', age: '十年', ringColor: '#ffffff', ringLevel: 1, hp: 60, attack: 8, defense: 3, speed: 4, exp: 20, color: '#d4a574', size: 24, ai: 'passive' },
  wild_wolf: { name: '独眼狼', age: '十年', ringColor: '#fef3c7', ringLevel: 1, hp: 90, attack: 14, defense: 5, speed: 7, exp: 35, color: '#6b7280', size: 28, ai: 'aggressive' },
  flame_tiger: { name: '烈焰虎', age: '百年', ringColor: '#fbbf24', ringLevel: 2, hp: 200, attack: 28, defense: 12, speed: 8, exp: 100, color: '#ea580c', size: 34, ai: 'aggressive' },
  iron_bear: { name: '铁甲熊', age: '百年', ringColor: '#fbbf24', ringLevel: 2, hp: 320, attack: 22, defense: 25, speed: 4, exp: 120, color: '#57534e', size: 40, ai: 'aggressive' },
  jiao_dragon: { name: '黑水蛟龙', age: '千年', ringColor: '#a855f7', ringLevel: 3, hp: 800, attack: 55, defense: 30, speed: 10, exp: 500, color: '#1e3a8a', size: 50, ai: 'aggressive' }
};

// 魂环配置
const RING_DATA = {
  1: { name: '十年白环', color: '#ffffff', bonus: { attack: 3, defense: 2, hp: 20 } },
  2: { name: '百年黄环', color: '#fbbf24', bonus: { attack: 8, defense: 5, hp: 50 } },
  3: { name: '千年紫环', color: '#a855f7', bonus: { attack: 20, defense: 12, hp: 120 } },
  4: { name: '万年黑环', color: '#1f2937', bonus: { attack: 45, defense: 25, hp: 300 } },
  5: { name: '十万年红环', color: '#dc2626', bonus: { attack: 100, defense: 60, hp: 800 } }
};
