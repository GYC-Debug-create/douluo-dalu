import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, watch } from 'vue'
import { ORIGINS, SKILL_TREE } from '@/data/game-data'
import '@/data/events-expanded.js'
import { MAIN_STORY_MILESTONES } from '@/engine/event-rules'
import { useEventEngine } from '@/composables/useEventEngine'
import { useBattleSystem } from '@/composables/useBattleSystem'
import { useGameFeatures } from '@/composables/useGameFeatures'
import { initNewCharacter } from '@/stores/serializer'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useCombatStore } from '@/stores/combat'
import { findShortestRoute, performMapTravel } from '@/utils/mapBridge'
import { useGameRules } from '@/composables/useGameRules'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(String(key)) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(String(key)) }
  clear() { this.values.clear() }
}

function seedRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function readPublicJson(url) {
  const name = url.split('/').at(-1)
  return JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8'))
}

let storage
let restoreRandom
let fetchMock

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  storage = new MemoryStorage()
  globalThis.localStorage = storage
  globalThis.sessionStorage = new MemoryStorage()
  let random = seedRandom(20481020)
  restoreRandom = vi.spyOn(Math, 'random').mockImplementation(() => random())
  fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => ({
    ok: true,
    json: async () => readPublicJson(String(url))
  }))
})

afterEach(() => {
  fetchMock?.mockRestore()
  restoreRandom?.mockRestore()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('真实运行时生命周期回归', () => {
  it('用图鉴中的真实中级与神级武魂各走完九环、15 个主线节点和结局', async () => {
    const { data, loadAll } = await import('@/composables/useGameData').then(m => m.useGameData())
    expect(await loadAll()).toBe(true)
    const sampleSpecs = [
      { id: '木剑', tier: 'mid', power: 50, seed: 20481020 },
      { id: '海神三叉戟', tier: 'god', power: 100, seed: 20481021 }
    ]
    const sampleReports = []
    const map = data.value.mapData

    for (const sample of sampleSpecs) {
      const spirit = data.value.spirits.find(item => item.id === sample.id)
      expect(spirit, `spirit codex entry ${sample.id}`).toBeTruthy()
      expect(spirit.tier).toBe(sample.tier)
      let random = seedRandom(sample.seed)
      restoreRandom.mockImplementation(() => random())
      initNewCharacter({ name: `全程回归旅人·${sample.tier}`, origin: ORIGINS[0], spirit, innatePower: sample.power })
      const playerAtCreation = usePlayerStore()
      expect(playerAtCreation.level).toBe(Math.floor(sample.power / 10))
      expect(playerAtCreation.gold).toBe(100)
      expect(playerAtCreation.rings).toHaveLength(0)

      const engine = useEventEngine()
      const battle = useBattleSystem()
      const player = usePlayerStore()
      const events = useEventStore()
      const game = useGameStore()
      const combat = useCombatStore()
      const features = useGameFeatures()
      const { finalStats, getMaxSpiritPower } = useGameRules()

      const created = { level: player.level, exp: player.exp, gold: player.gold, rings: player.rings.length, location: game._currentLocation }
      let achievementChecks = 0
      const achievementWatch = watch(() => events._eventCount, () => {
        features.checkAchievements(true)
        achievementChecks++
      })
      const dailySign = features.dailySign('2026-10-20', { silent: true })
      achievementChecks++ // dailySign invokes checkAchievements internally, as GamePage.runDailyWelcome does.

    const checkpoints = []
    const actionLog = []
    const maxActions = 4000
    let battleCount = 0
    let lastRings = player.rings.length
    let lastStories = events.doneEvents.filter(id => MAIN_STORY_MILESTONES.some(m => m.id === id)).length

    function recordCheckpoint(source) {
      const stories = events.doneEvents.filter(id => MAIN_STORY_MILESTONES.some(m => m.id === id)).length
      if (player.rings.length === lastRings && stories === lastStories) return
      checkpoints.push({ source, level: player.level, exp: player.exp, gold: player.gold, rings: player.rings.length, storyMilestones: stories, eventCount: events._eventCount || 0, actions: actionLog.length })
      lastRings = player.rings.length
      lastStories = stories
    }

    async function travelTo(targetId) {
      const route = findShortestRoute(map, game._currentLocation, targetId)
      expect(route.length, `map route ${game._currentLocation} -> ${targetId}`).toBeGreaterThan(0)
      if (route.slice(1).some(id => (Number(map.find(location => location.id === id)?.unlockedLevel) || 1) > player.level)) return false
      for (const id of route.slice(1)) {
        const result = performMapTravel({ locations: map, locationId: id, fast: true, player, game, eventStore: events })
        if (!result.ok) return false
        actionLog.push({ type: 'travel', to: id, gold: player.gold })
        await nextTick()
      }
      return true
    }

    function learnAvailableSkills() {
      const nodes = Object.values(SKILL_TREE).flatMap(branch => branch.nodes)
      const available = Math.floor(player.level / 5) * 2 - nodes
        .filter(node => player._skillTree[node.id])
        .reduce((sum, node) => sum + node.cost, 0)
      const node = nodes.find(item => !player._skillTree[item.id] && item.req.every(id => player._skillTree[id]) && item.cost <= available)
      if (node) features.learnSkill(node)
    }

    learnAvailableSkills()
    expect(Object.values(player._skillTree).some(Boolean), `${sample.id}: spend earned skill points through the feature API`).toBe(true)

    async function settleBattle() {
      expect(battle.isActive()).toBe(true)
      battleCount++
      if (!battle.autoMode.value) battle.toggleAuto()
      let ticks = 0
      while (battle.isActive() && ticks++ < 240) await vi.advanceTimersByTimeAsync(900)
      expect(battle.isActive(), 'actual auto battle should terminate').toBe(false)
      recordCheckpoint('battle-settlement')
    }

    function chooseEvent(ev) {
      expect(ev?.choices?.length, `event choice: ${ev?.id}`).toBeGreaterThan(0)
      const valid = ev.choices.map((choice, idx) => ({ choice, idx }))
        .filter(({ choice }) => !choice.cond || engine.checkCond(choice.cond))
      expect(valid.length, `valid choice: ${ev.id}`).toBeGreaterThan(0)
      valid.sort((a, b) => (b.choice.result?.exp || 0) - (a.choice.result?.exp || 0))
      const { choice, idx } = valid[0]
      actionLog.push({ type: ev.ring ? 'ring' : ev._mainStory ? 'story' : 'event', id: ev.id, level: player.level })
      engine.applyChoice(ev, choice, idx)
      recordCheckpoint(ev._mainStory ? `story:${ev.id}` : ev.ring ? `ring:${ev.id}` : `event:${ev.id}`)
    }

    for (let step = 0; step < maxActions; step++) {
      // Flush the same queued Vue watcher GamePage installs after each world action.
      await nextTick()
      if (events.doneEvents.includes('final_evil') && player.finished) break

      if (battle.isActive()) {
        await settleBattle()
        continue
      }

      if (!player.finished && (player.hp < finalStats().maxHp * 0.7 || player.spiritPower < getMaxSpiritPower() * 0.25)) {
        engine.rest()
        actionLog.push({ type: 'rest', level: player.level, finished: player.finished })
        continue
      }

      learnAvailableSkills()

      const ev = engine.currentEvent.value
      if (ev?._travelGuideType) {
        if (await travelTo(ev.targetId)) {
          if (ev._travelGuideType === 'ring') engine.hunt()
          else engine.startMainStory()
        }
        else engine.nextEvent()
        continue
      }
      if (engine.sceneState.value === 'continue' && engine.currentEvent.value) {
        engine.continueAction()
        continue
      }
      if (ev?.choices?.length) {
        chooseEvent(ev)
        continue
      }

      const status = engine.mainStoryStatus()
      if (status.milestone && status.due) {
        if (await travelTo(status.targetId)) {
          engine.startMainStory()
          continue
        }
      }

      if (events.pendingRingLv) {
        engine.hunt?.()
        continue
      }

      engine.nextEvent()
      if (!engine.currentEvent.value) {
        engine.rest()
        actionLog.push({ type: 'rest', level: player.level, finished: player.finished })
      }
    }

    expect(player.rings, `${sample.id}: all nine rings must be naturally absorbed`).toHaveLength(9)
    const completedStories = events.doneEvents.filter(id => MAIN_STORY_MILESTONES.some(m => m.id === id))
    expect(completedStories).toHaveLength(15)
    expect(player.finished).toBe(true)
    expect(events.doneEvents).toContain('final_evil')
    expect(battle.isActive()).toBe(false)
    expect(battleCount).toBeGreaterThan(0)
    expect(combat.battleStats.wins + combat.battleStats.losses).toBeGreaterThan(0)
    expect(actionLog.some(action => action.type === 'rest' && !action.finished)).toBe(true)
    for (let index = 1; index < checkpoints.length; index++) {
      expect(checkpoints[index].rings).toBeGreaterThanOrEqual(checkpoints[index - 1].rings)
      expect(checkpoints[index].storyMilestones).toBeGreaterThanOrEqual(checkpoints[index - 1].storyMilestones)
    }
    expect(player.gold).toBeGreaterThanOrEqual(0)
    expect(actionLog.some(action => action.type === 'travel')).toBe(true)
    expect(sampleSpecs.find(spec => spec.id === spirit.id)).toBeTruthy()

    const sampleAchievementCount = player._achievementList.length
    expect(dailySign.changed).toBe(true)
    expect(achievementWatch).toBeTruthy()

      sampleReports.push({
        sample: sample.id,
        tier: spirit.tier,
        seed: sample.seed,
        dailySign: { date: '2026-10-20', changed: dailySign.changed, rewardDay: dailySign.rewardDay },
        created,
        outcome: { level: player.level, exp: player.exp, gold: player.gold, rings: player.rings.length, wins: combat.battleStats.wins, losses: combat.battleStats.losses, learnedSkills: Object.keys(player._skillTree).filter(id => player._skillTree[id]), achievementsUnlocked: sampleAchievementCount, achievementChecks, storyMilestones: completedStories, finished: player.finished, eventCount: events._eventCount || 0 },
        checkpoints,
        actionCounts: { logRecords: actionLog.length, battlesStarted: battleCount, travelEdges: actionLog.filter(action => action.type === 'travel').length, rests: actionLog.filter(action => action.type === 'rest').length, storyChoices: actionLog.filter(action => action.type === 'story').length, ringChoices: actionLog.filter(action => action.type === 'ring').length, otherChoices: actionLog.filter(action => action.type === 'event').length },
        actions: actionLog
      })
      achievementWatch()
    }

    if (process.env.REGENERATE_LIFECYCLE_REPORT !== '1') {
      const fixture = JSON.parse(readFileSync(new URL('../src/data/lifecycle-runtime-report.json', import.meta.url), 'utf8'))
      const stableFields = sample => ({ seed: sample.seed, outcome: sample.outcome, checkpoints: sample.checkpoints, actionCounts: sample.actionCounts })
      expect(fixture.samples.map(stableFields)).toEqual(sampleReports.map(stableFields))
    } else {
      const report = {
        synthetic: true,
        seedCount: sampleReports.length,
        assumptions: { source: 'real Pinia stores/composables and repository spirit/map/event JSON; isolated MemoryStorage; seeded Math.random per sample; no post-creation level, ring, or gold injection; GamePage daily sign simulated once per sample with fixed date 2026-10-20; event-count achievement watcher flushed with nextTick after each loop action; skill points spent through useGameFeatures; rest triggered by low HP or spirit power before ending; battles use real useBattleSystem auto-actions with fake timers; MapPage travel random encounter roll is not replayed' },
        samples: sampleReports
      }
      const { writeFileSync } = await import('node:fs')
      writeFileSync(new URL('../src/data/lifecycle-runtime-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`)
    }
  }, 120000)
})
