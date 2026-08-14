/**
 * 战斗状态 Store
 * 对应 G 对象中的战斗相关字段
 */
import { defineStore } from 'pinia'
import { recordBeastOutcome } from '@/utils/beast-knowledge'

export const useCombatStore = defineStore('combat', {
  state: () => ({
    battleStats: { wins: 0, losses: 0, kills: 0 },
    _battleActive: false,
    _formationsUsed: [],
    _usedElements: [],
    _maxCombo: 0,
    _maxComboFinisher: 0,
    _reactionCount: 0,
    _reactionTriggered: false,
    _fusionUsed: false,
    huntingKnowledge: { experience: 0, beasts: {}, history: [] }
  }),
  getters: {
    totalBattles: (state) => state.battleStats.wins + state.battleStats.losses
  },
  actions: {
    recordWin() {
      this.battleStats.wins++
    },
    recordLoss() {
      this.battleStats.losses++
    },
    recordKill() {
      this.battleStats.kills++
    },
    recordHuntingOutcome(enemy, outcome, context) {
      const result = recordBeastOutcome(this.huntingKnowledge, enemy, outcome, context)
      this.huntingKnowledge = result.knowledge
      return result
    }
  }
})
