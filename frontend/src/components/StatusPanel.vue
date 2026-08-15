<template>
  <aside class="status-panel">
    <!-- 头部信息 -->
    <div class="sp-head">
      <div class="sp-spirit-img-wrap">
        <div class="spirit-aura"></div>
        <div class="sp-spirit-img">
          <img v-if="player.spirit?.image" :src="player.spirit.image" :alt="player.spirit?.name" @error="onImgError" />
          <span v-else>{{ player.spirit?.icon || '✦' }}</span>
        </div>
      </div>
      <div>
        <div class="sp-name">{{ player.name }}</div>
        <div class="sp-lv">等级 <b>{{ player.level }}</b> · <span>{{ phaseName(player.level) }}</span></div>
        <div class="sp-spirit-name">武魂：<span>{{ player.spirit?.name }}（{{ tierName }}）</span></div>
        <div class="sp-traits">
          <span v-for="trait in displayTraits" :key="trait" class="trait-tag">{{ trait }}</span>
          <span class="destiny-tag">✦ {{ player._destiny?.name || '命运之路' }}</span>
        </div>
      </div>
    </div>

    <!-- 状态条 -->
    <div>
      <StatBar label="生命" type="hp" :current="player.hp" :max="maxHp" />
      <StatBar label="魂力" type="mp" :current="player.spiritPower" :max="maxSpiritPower" />
      <StatBar label="经验" type="exp" :current="player.exp" :max="expNeed" />
    </div>

    <!-- 主线与魂环 -->
    <div>
      <div class="panel-sec-title">主线与魂环</div>
      <div class="rings-row">
        <div
          v-for="(ring, idx) in ringSlots"
          :key="idx"
          class="ring-card"
          :class="{ empty: !ring }"
          :style="ring ? ringStyle(ring) : {}"
        >
          <div class="ring-index">{{ idx + 1 }}</div>
          <div class="ring-main">
            <span class="ring-skill">{{ ring?.skill || '空位' }}</span>
            <span class="ring-source">{{ ring?.source || '' }}</span>
          </div>
          <div class="ring-year">{{ ring?.year ? ring.year + '年' : '' }}</div>
        </div>
        <section v-if="ringObjective" class="ring-objective-card" aria-label="当前猎环目标" data-testid="ring-objective">
          <div class="ro-head">
            <span class="ro-kicker">猎环目标</span>
            <span class="ro-level">Lv.{{ ringObjective.requiredLevel }} 已解锁</span>
          </div>
          <strong>{{ ringObjective.title }}</strong>
          <div class="ro-row"><span>目的地</span><b>{{ ringObjective.destination?.name || '等待线索' }}</b></div>
          <div class="ro-status" :class="{ deferred: ringObjective.deferredActions > 0 }">{{ ringObjective.status }}</div>
          <div class="ro-actions">
            <button v-if="!ringObjective.atDestination" type="button" class="ro-button" @click="emit('open-map')">查看地图</button>
            <button type="button" class="ro-button primary" :disabled="ringActionLocked" @click="emit('resume-ring-hunt')">
              {{ ringObjective.deferredActions > 0 ? '立即继续' : '继续猎环' }}
            </button>
            <button v-if="ringObjective.deferredActions === 0" type="button" class="ro-button quiet" :disabled="ringActionLocked" @click="emit('defer-ring-hunt')">暂缓提醒</button>
          </div>
        </section>
        <details v-if="huntingKnowledge.experience > 0" class="hunter-journal" data-testid="hunter-journal">
          <summary>
            <span>猎魂简记</span>
            <small>历练 {{ huntingKnowledge.experience }} · 已识 {{ knownBeastCount }} 种</small>
          </summary>
          <div class="hj-beasts">
            <div v-for="entry in journalRows" :key="entry.id" class="hj-beast">
              <div><strong>{{ entry.name }}</strong><span>{{ entry.tierLabel || '年限未记' }}</span></div>
              <div><b>{{ entry.rank }} {{ entry.knowledge }}/100</b><span>{{ entry.encounters }}战 {{ entry.victories }}胜</span></div>
            </div>
          </div>
          <div v-if="huntingKnowledge.history.length" class="hj-history">
            <div class="hj-caption">最近记录</div>
            <div v-for="(record, index) in huntingKnowledge.history.slice(0, 3)" :key="`${record.time}-${index}`">
              {{ record.ringHunt ? '猎环' : '遭遇' }} · {{ record.name }} · {{ outcomeName(record.outcome) }}
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- 属性 -->
    <div>
      <div class="panel-sec-title">属性</div>
      <div class="attr-grid2">
        <div class="attr-cell2"><span class="al">攻击</span><span class="av" style="color:#d08a6a">{{ stats.attack }}</span></div>
        <div class="attr-cell2"><span class="al">防御</span><span class="av" style="color:#8fb8d8">{{ stats.defense }}</span></div>
        <div class="attr-cell2"><span class="al">生命</span><span class="av" style="color:#7fc48c">{{ stats.maxHp }}</span></div>
        <div class="attr-cell2"><span class="al">速度</span><span class="av" style="color:#e6c878">{{ stats.speed }}</span></div>
      </div>
    </div>

    <!-- 金币与命运值 -->
    <div class="gold-row"><span>金币</span><b>{{ player.gold }}</b></div>
    <div class="gold-row"><span>命运值</span><b style="color:#c9a0d8">{{ player.fatePoints }}</b></div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useEventStore } from '@/stores/event'
import { useGameStore } from '@/stores/game'
import { useCombatStore } from '@/stores/combat'
import { useGameRules } from '@/composables/useGameRules'
import { buildRingObjective } from '@/utils/ring-hunt'
import { huntingJournalRows, normalizeHuntingKnowledge } from '@/utils/beast-knowledge'
import StatBar from './StatBar.vue'

defineProps({
  ringActionLocked: { type: Boolean, default: false }
})
const emit = defineEmits(['open-map', 'resume-ring-hunt', 'defer-ring-hunt'])
const player = usePlayerStore()
const eventStore = useEventStore()
const gameStore = useGameStore()
const combatStore = useCombatStore()
const { TIER_NAMES, phaseName, expNeeded, finalStats, getMaxSpiritPower } = useGameRules()

const tierName = computed(() => player.spirit ? TIER_NAMES[player.spirit.tier] || '' : '')
const stats = computed(() => finalStats())
const maxHp = computed(() => stats.value.maxHp)
const maxSpiritPower = computed(() => getMaxSpiritPower())
const expNeed = computed(() => expNeeded(player.level))

const displayTraits = computed(() => {
  const traits = player._personality?.traits || []
  return traits.slice(0, 3)
})

const ringSlots = computed(() => {
  const maxSlots = Math.min(9, Math.max(1, Math.ceil(player.level / 10)))
  const slots = []
  for (let i = 0; i < maxSlots; i++) {
    slots.push(player.rings[i] || null)
  }
  return slots
})

const ringObjective = computed(() => buildRingObjective({
  pendingRingLv: eventStore.pendingRingLv,
  ringCount: player.rings?.length || 0,
  playerLevel: player.level,
  currentLocation: gameStore._currentLocation,
  eventCount: eventStore._eventCount,
  deferredUntil: eventStore._ringHuntDeferredUntil
}))
const huntingKnowledge = computed(() => normalizeHuntingKnowledge(combatStore.huntingKnowledge))
const knownBeastCount = computed(() => Object.keys(huntingKnowledge.value.beasts).length)
const journalRows = computed(() => huntingJournalRows(huntingKnowledge.value, 4))

function outcomeName(outcome) {
  return ({ victory: '胜利', defeat: '战败', escape: '脱离' })[outcome] || '未记'
}

const RING_COLORS = {
  white: '#c0c0c0',
  yellow: '#c9a84c',
  purple: '#a855f7',
  black: '#4a4a4a',
  red: '#d04040',
  gold: '#fbbf24'
}

function ringStyle(ring) {
  const color = RING_COLORS[ring.color] || '#8a7a45'
  return {
    '--ring-color': color,
    '--ring-tint': 'rgba(201,168,76,0.08)'
  }
}

function onImgError(e) {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.status-panel {
  background: linear-gradient(180deg, #262012, #1c1610);
  border-right: 1px solid var(--line);
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 0;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.sp-head {
  display: flex;
  gap: 12px;
  align-items: center;
}
.sp-spirit-img-wrap {
  position: relative;
  flex-shrink: 0;
}
.spirit-aura {
  position: absolute;
  inset: -4px;
  border-radius: 8px;
  background: radial-gradient(circle, rgba(201, 168, 76, 0.2), transparent 70%);
  animation: auraPulse 3s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes auraPulse {
  from { opacity: 0.4; scale: 0.95; }
  to { opacity: 0.8; scale: 1.05; }
}
.sp-spirit-img {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--gold);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #171106;
  font-size: 30px;
  position: relative;
  z-index: 1;
}
.sp-spirit-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sp-name {
  font-family: var(--font-display);
  font-size: 23px;
  color: var(--gold-hi);
  letter-spacing: 2px;
  line-height: 1.2;
}
.sp-lv {
  font-size: 13px;
  color: var(--ink-dim);
  letter-spacing: 1px;
  margin-top: 3px;
}
.sp-lv b {
  color: var(--gold);
  font-size: 16px;
}
.sp-spirit-name {
  font-size: 13px;
  color: var(--ink-dim);
  letter-spacing: 1px;
  margin-top: 2px;
}
.sp-spirit-name span {
  color: var(--ink);
}
.sp-traits {
  margin-top: 3px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: center;
}
.trait-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(201, 168, 76, 0.15);
  color: #c9a84c;
  letter-spacing: 1px;
  border: 1px solid rgba(201, 168, 76, 0.25);
}
.destiny-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  letter-spacing: 1px;
  border: 1px solid rgba(139, 92, 246, 0.25);
  margin-left: 2px;
}

.panel-sec-title {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--gold);
  letter-spacing: 3px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 5px;
}

.rings-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
  align-items: stretch;
  min-height: 30px;
}
.ring-card {
  width: 100%;
  min-height: 42px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border: 1px solid var(--ring-color, #3a2f1a);
  border-radius: 5px;
  background: linear-gradient(90deg, var(--ring-tint, rgba(20, 16, 10, 0.72)), rgba(20, 16, 10, 0.72));
  color: var(--ink);
  text-align: left;
  transition: transform 0.2s ease-out, border-color 0.2s ease-out, background 0.2s ease-out;
}
.ring-card:hover {
  transform: translateX(4px);
  background: rgba(201, 168, 76, 0.1);
}
.ring-card .ring-index {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ring-color, #3a2f1a);
  color: var(--ring-text, #eee);
  font-size: 11px;
  font-weight: 700;
}
.ring-card .ring-skill {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--gold-hi);
}
.ring-card .ring-source {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--ink-dim);
}
.ring-card .ring-year {
  font-size: 10px;
  color: var(--ring-color, #8a7a45);
  white-space: nowrap;
}
.ring-card.empty {
  border-style: dashed;
  opacity: 0.48;
  cursor: default;
}
.ring-card.empty .ring-index {
  background: #292216;
  color: #766b54;
}
.ring-card.empty .ring-skill {
  color: #766b54;
}
.ring-objective-card {
  border: 1px solid rgba(201, 168, 76, 0.62);
  border-radius: 5px;
  background: linear-gradient(135deg, rgba(201, 168, 76, 0.13), rgba(20, 16, 10, 0.72));
  padding: 9px 10px 10px;
  color: var(--ink);
  text-align: left;
}
.ro-head, .ro-row, .ro-actions {
  display: flex;
  align-items: center;
}
.ro-head { justify-content: space-between; gap: 6px; margin-bottom: 5px; }
.ro-kicker { color: var(--gold); font-size: 10px; letter-spacing: 2px; }
.ro-level { color: #a7d9af; font-size: 10px; }
.ring-objective-card strong {
  display: block;
  font-size: 14px;
  color: var(--gold-hi);
  margin-bottom: 7px;
}
.ro-row { justify-content: space-between; gap: 8px; font-size: 11px; color: var(--ink-dim); }
.ro-row b { color: var(--ink); font-weight: 500; text-align: right; }
.ro-status {
  margin-top: 7px;
  padding: 5px 7px;
  border-left: 2px solid #7fc48c;
  background: rgba(127, 196, 140, 0.08);
  font-size: 11px;
  color: #a7d9af;
  line-height: 1.4;
}
.ro-status.deferred {
  border-left-color: var(--gold);
  color: #d7bd75;
  background: rgba(201, 168, 76, 0.08);
}
.ro-actions { gap: 5px; flex-wrap: wrap; margin-top: 8px; }
.ro-button {
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgba(20, 16, 10, 0.72);
  color: var(--ink-dim);
  padding: 4px 7px;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.ro-button.primary { border-color: rgba(201, 168, 76, 0.72); color: var(--gold-hi); }
.ro-button.quiet { margin-left: auto; }
.ro-button:hover:not(:disabled), .ro-button:focus-visible:not(:disabled) {
  background: rgba(201, 168, 76, 0.16);
  color: #fff2bd;
}
.ro-button:disabled { opacity: 0.42; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) {
  .ro-button { transition: none; }
}
.hunter-journal {
  border: 1px solid rgba(143, 184, 216, 0.42);
  border-radius: 5px;
  background: rgba(44, 66, 78, 0.12);
  color: var(--ink);
}
.hunter-journal summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px;
  cursor: pointer;
  color: #b9d7e7;
  font-size: 12px;
  letter-spacing: 1px;
}
.hunter-journal summary small { color: var(--ink-dim); font-size: 9px; letter-spacing: 0; }
.hj-beasts, .hj-history { padding: 0 8px 8px; }
.hj-beast {
  padding: 6px 0;
  border-top: 1px solid rgba(143, 184, 216, 0.18);
  font-size: 10px;
}
.hj-beast > div { display: flex; justify-content: space-between; gap: 8px; }
.hj-beast strong { color: var(--gold-hi); font-size: 11px; }
.hj-beast b { color: #a9d4f0; font-weight: 500; }
.hj-beast span { color: var(--ink-dim); }
.hj-history { border-top: 1px solid rgba(143, 184, 216, 0.22); color: var(--ink-dim); font-size: 9px; line-height: 1.6; }
.hj-caption { color: #a9d4f0; margin: 5px 0 2px; letter-spacing: 1px; }

.attr-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.attr-cell2 {
  background: rgba(20, 16, 10, 0.7);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 7px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.attr-cell2 .al {
  font-size: 13px;
  color: var(--ink-dim);
  letter-spacing: 1px;
}
.attr-cell2 .av {
  font-size: 16px;
  font-weight: 700;
}

.gold-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(20, 16, 10, 0.5);
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 14px;
  color: var(--ink-dim);
  letter-spacing: 1px;
}
.gold-row b {
  color: var(--gold-hi);
  font-size: 16px;
}
</style>
