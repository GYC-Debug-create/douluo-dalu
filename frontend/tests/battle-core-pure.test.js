/**
 * 战斗纯逻辑层直测（engine/battle-core.js）
 * 该模块自 useBattleSystem.js 原样搬移：本文件锁定元素克制 / 状态 / 伤害
 * 公式 / 敌人构建的行为基线，让调参与重构不必拉起 Pinia。
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  ELEMENT_ICONS, ELEMENT_NAMES, STATUS_INFO, clamp,
  normalizeElement, elementMultiplier, statusDamageModifier, statusHtml,
  buildEnemy, addStatus, damageFormula, maybeApplyElementStatus, skillElement
} from '@/engine/battle-core'

afterEach(() => { vi.restoreAllMocks() })

describe('元素解析与克制', () => {
  it('中英文别名归一到标准元素', () => {
    expect(normalizeElement('烈焰虎')).toBe('fire')
    expect(normalizeElement('冰帝蝎')).toBe('ice')
    expect(normalizeElement('Thunder Bird')).toBe('thunder')
    expect(normalizeElement('神圣天使')).toBe('light')
    expect(normalizeElement('')).toBe('none')
    expect(normalizeElement(null)).toBe('none')
  })

  it('克制 1.35 / 受阻 0.8 / 同元素与无元素 1.0', () => {
    expect(elementMultiplier('fire', 'ice')).toBe(1.35)
    expect(elementMultiplier('ice', 'fire')).toBe(0.8)
    expect(elementMultiplier('fire', 'fire')).toBe(1)
    expect(elementMultiplier('none', 'fire')).toBe(1)
    expect(elementMultiplier('wind', 'earth')).toBe(1.35)
  })

  it('常量表含全部 12 系元素', () => {
    expect(Object.keys(ELEMENT_ICONS)).toHaveLength(12)
    expect(Object.keys(ELEMENT_NAMES)).toHaveLength(12)
  })
})

describe('状态效果', () => {
  it('进攻方 weak 减伤 25%、rage 增伤 30%;防守方 armorBreak 增伤 20%', () => {
    const weak = [{ id: 'weak', turns: 1 }]
    const rage = [{ id: 'rage', turns: 1 }]
    const armor = [{ id: 'armorBreak', turns: 1 }]
    expect(statusDamageModifier(weak, true)).toBe(0.75)
    expect(statusDamageModifier(rage, true)).toBe(1.3)
    expect(statusDamageModifier(armor, false)).toBe(1.2)
    expect(statusDamageModifier([], true)).toBe(1)
  })

  it('addStatus:同名刷新取最大回合与威力,异名追加', () => {
    const list = []
    addStatus(list, 'burn', 3)
    addStatus(list, 'burn', 5, 0.5)
    expect(list).toEqual([{ id: 'burn', turns: 5, power: 0.5 }])
    addStatus(list, 'poison', 4)
    expect(list).toHaveLength(2)
  })

  it('statusHtml 映射图标与名称,未知状态兜底', () => {
    const out = statusHtml([{ id: 'burn', turns: 3 }, { id: 'mystery', turns: 1 }])
    expect(out[0]).toEqual({ icon: '🔥', name: '燃烧', turns: 3, harmful: true })
    expect(out[1].name).toBe('mystery')
    expect(out[1].icon).toBe('✦')
    expect(statusHtml([])).toBe('')
    expect(Object.keys(STATUS_INFO).length).toBeGreaterThanOrEqual(10)
  })
})

describe('伤害公式', () => {
  it('随机数固定时结果确定,且至少造成 1 点伤害', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(damageFormula(100, 10)).toBe(Math.round(100 * 0.88 - 10 * 0.48))
    expect(damageFormula(1, 99999)).toBe(1)
  })

  it('穿透收益封顶 80%', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    // 防 10000:穿透 0.9 被压到 0.8,等效防 2000 → base=max(1, 88-960)=1
    expect(damageFormula(100, 10000, { penetration: 0.9 })).toBe(1)
  })
})

describe('元素状态附加', () => {
  it('guaranteed 必中并返回状态名', () => {
    const list = []
    expect(maybeApplyElementStatus('火', list, true)).toBe('燃烧')
    expect(list.map(s => s.id)).toEqual(['burn'])
  })

  it('概率未命中返回 null;无映射元素返回 null', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const list = []
    expect(maybeApplyElementStatus('fire', list, false)).toBeNull()
    expect(maybeApplyElementStatus('none', list, true)).toBeNull()
    expect(list).toHaveLength(0)
  })
})

describe('魂技元素推断', () => {
  it('显式 element 优先,其次按名称推断,最后按槽位轮换', () => {
    expect(skillElement(0, { element: 'ice', name: '烈焰斩' })).toBe('ice')
    expect(skillElement(0, { name: '烈焰斩' })).toBe('fire')
    expect(skillElement(1, { name: '普通打击' })).toBe('ice')
  })
})

describe('敌人构建', () => {
  const finalStatsFn = () => ({ attack: 100, defense: 50, maxHp: 1000, speed: 30 })

  it('对象入参直接透传并补 maxHp', () => {
    expect(buildEnemy({ id: 'x', hp: 88 }, 10, finalStatsFn, [])).toEqual({ id: 'x', hp: 88, maxHp: 88 })
  })

  it('NPC 表按玩家最终属性缩放', () => {
    const enemy = buildEnemy('academy_rival', 10, finalStatsFn, [])
    expect(enemy.name).toBe('天斗学院·小霸王')
    expect(enemy.isNpc).toBe(true)
    expect(enemy.attack).toBe(Math.round(100 * 0.85 * 0.72))
    expect(enemy.maxHp).toBe(Math.round(1000 * 0.85 * 0.85))
  })

  it('未知 key 回落到游历魂师', () => {
    expect(buildEnemy('no_such_key', 10, finalStatsFn, []).name).toBe('游历魂师')
  })

  it('魂兽路径:别名命中、变体取阶、王/皇/帝判 Boss', () => {
    const beasts = [{
      id: '野兔', name: '野兔', type: '敏攻系', habitat: '草原', element: 'wind',
      icon: '🐰', image: 'assets/beasts/rabbit.png', specialAbility: '疾跑',
      variants: { ten: { name: '十 year 野兔王', attack: 12, defense: 4, hp: 60, speed: 25, exp: 8, gold: 5 } }
    }]
    const enemy = buildEnemy('wind_rabbit_ten', 12, finalStatsFn, beasts)
    expect(enemy.beastId).toBe('野兔')
    expect(enemy.isBeast).toBe(true)
    expect(enemy.isBoss).toBe(true)
    expect(enemy.maxHp).toBe(60)
    expect(enemy.exp).toBe(8)
  })
})
