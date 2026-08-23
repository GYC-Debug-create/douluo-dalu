/**
 * 事件与剧情状态 Store
 * 对应 G 对象中的事件、剧情、选择、日记字段
 */
import { defineStore } from 'pinia'
import { appendDiaryEntry } from '@/engine/save'

export const useEventStore = defineStore('event', {
  state: () => ({
    choices: {},
    doneEvents: [],
    completedEvents: [],
    _recentEvents: [],
    // 洗牌袋抽取队列（经济规格 v2）：同批候选耗尽前不重复；键=当前地点|阶段
    _drawQueue: [],
    _drawQueueKey: '',
    _eventCount: 0,
    _storyPath: [],
    _storyDecisions: {},
    _dynCooldowns: {},
    _pendingChain: null,
    // 兼容旧版事件脚本运行时创建的顶层 G._* 标记。
    // 序列化时仍会展开为旧版顶层字段，保证新旧存档互通。
    _dynamicFlags: {},
    _introPendingEvent: null,
    _mainStoryVersion: 0,
    _storyMilestoneDeferredUntil: 0,
    _prologueDone: false,
    _spiritAwakeningStoryDone: false,
    _earlyLifeDone: false,
    _registeredAtHall: false,
    _enrollmentComplete: false,
    _firstClassDone: false,
    _tutorialPostponed: false,
    _academyRecommendation: null,
    _ringHuntDeferredUntil: 0,
    pendingRingLv: null,
    _ringHuntLevel: null,
    _ringOrdinal: null,
    _ringTargetId: null,
    _ringTargetName: '',
    _lastRingHuntLevel: null,
    _lastRingOrdinal: null,
    _lastRingTargetId: null,
    _lastRingTargetName: '',
    _diary: [],
    // 地点探索按地点归档：旅行只会暂停离开的地点，不再全局锁死新的地点行动。
    locationExplorationsByLocation: {},
    // 旧版脚本/旧存档兼容镜像；业务读取以 locationExplorationsByLocation 为准。
    locationExploration: null
  }),
  getters: {
    hasEvent: (state) => (eventId) => state.doneEvents.includes(eventId)
  },
  actions: {
    markEventDone(eventId) {
      if (!this.doneEvents.includes(eventId)) {
        this.doneEvents.push(eventId)
        this.completedEvents.push(eventId)
      }
    },
    recordChoice(eventId, choiceIndex) {
      this.choices[eventId] = choiceIndex
    },
    addDiaryEntry(entry) {
      if (!Array.isArray(this._diary)) this._diary = []
      appendDiaryEntry(this._diary, entry)
    }
  }
})
