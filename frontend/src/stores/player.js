/**
 * 玩家状态 Store
 * 对应 G 对象中的玩家核心属性字段
 */
import { defineStore } from 'pinia'
import { useGameRules } from '@/composables/useGameRules'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    playerId: '',
    name: '',
    origin: '',
    originName: '',
    spirit: null,
    spiritBase: null,
    innatePower: 0,
    level: 1,
    exp: 0,
    overflowExp: 0,
    hp: 0,
    spiritPower: 0,
    spiritPowerMax: 0,
    spiritPowerGain: 0,
    gold: 100,
    fatePoints: 0,
    rings: [],
    skills: [],
    inventory: [],
    weapon: null,
    bonus: { attack: 0, defense: 0, hp: 0, speed: 0 },
    originBonus: null,
    _personality: { traits: ['独特'], subtype: '' },
    _destiny: { name: '命运之路' },
    _bones: [],
    _forgeBones: [],
    _craftedBones: [],
    _skillTree: {},
    _titles: [],
    _achievementList: [],
    _bossKills: 0,
    _skillBonuses: {},
    _tempAtkBuff: 0,
    _tempDefBuff: 0,
    _tempSpdBuff: 0,
    finished: false,
    createdAt: 0
  }),
  getters: {
    ringCount: (state) => state.rings.length,
    isAlive: (state) => state.hp > 0
  },
  actions: {
    setHp(value) {
      this.hp = Math.max(0, value)
    },
    heal(amount) {
      const maxHp = useGameRules().finalStats().maxHp
      this.hp = Math.min(this.hp + amount, maxHp)
    },
    damage(amount) {
      this.hp = Math.max(0, this.hp - amount)
    },
    addGold(amount) {
      this.gold = Math.max(0, this.gold + amount)
    },
    addExp(amount) {
      this.exp = Math.max(0, this.exp + amount)
    }
  }
})
