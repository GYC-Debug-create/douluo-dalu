/**
 * 游戏全局状态 Store
 * 对应 G 对象中的地点、NPC、时间、签到等全局字段
 */
import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    gameMode: 'text-rpg',
    _currentLocation: '',
    _visitedLocations: [],
    _discoveredHidden: [],
    _metNpcs: [],
    _npcRelations: {},
    _npcCooldowns: {},
    _dailySign: {},
    _towerFloor: 0,
    _gameTime: 0,
    _weather: 0,
    _totalGoldEarned: 0,
    _progressionRulesVersion: 2,
    _saveVersion: 10,
    _locationProgress: {},
    _saveIntegrityWarnings: [],
    _legacyRingOverflow: [],
    _orphanedSkills: [],
    _forgeBonesMigrated: false,
    // 旧版简单/完整模式开关。儿童版（8~12 岁）只有一种模式，此字段仅为旧存档兼容保留。
    _simpleMode: false,
    // 战斗默认自动出招；玩家在战斗里切到手动后会记住这个选择。
    _autoBattleDefault: true
  }),
  getters: {
    currentLocation: (state) => state._currentLocation,
    visitedCount: (state) => state._visitedLocations.length,
    npcCount: (state) => state._metNpcs.length
  },
  actions: {
    setLocation(locationId) {
      if (!this._visitedLocations.includes(locationId)) {
        this._visitedLocations.push(locationId)
      }
      this._currentLocation = locationId
    },
    meetNpc(npcId) {
      if (!this._metNpcs.includes(npcId)) {
        this._metNpcs.push(npcId)
      }
    },
    setNpcRelation(npcId, level) {
      this._npcRelations[npcId] = Math.max(this._npcRelations[npcId] || 0, level)
    },
    advanceTime(ticks = 1) {
      const amount = Number(ticks)
      if (!Number.isFinite(amount) || amount <= 0) return
      this._gameTime += Math.floor(amount)
    },
    setAutoBattleDefault(value) {
      this._autoBattleDefault = value !== false
    }
  }
})
