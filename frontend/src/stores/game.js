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
    // 低龄化：默认简单模式——隐藏技能树/商店/挑战塔等复杂系统，只留
    // "看故事 → 选选项 → 打怪 → 升级拿魂环"主循环。老玩家可在顶栏切回完整模式。
    _simpleMode: true
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
    advanceTime() {
      this._gameTime++
    },
    setSimpleMode(value) {
      this._simpleMode = value !== false
    }
  }
})
