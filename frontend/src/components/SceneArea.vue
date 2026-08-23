<template>
  <div class="scene-area">
    <!-- 事件叙事 -->
    <div v-if="sceneState === 'event' && currentEvent" class="scene-event">
      <div class="scene-location" v-if="currentEvent.location">【{{ displayLocation }}】</div>
      <div class="event-title">{{ displayTitle }}</div>
      <img
        v-if="currentEvent.image"
        :src="currentEvent.image"
        :alt="currentEvent.name"
        class="scene-img"
        decoding="async"
        @error="onImgError"
      />
      <div v-if="simpleMode" class="event-text">{{ eventText }}</div>
      <div v-else class="event-text" v-html="eventText"></div>
      <div class="event-choices">
        <button
          v-for="(choice, idx) in availableChoices"
          :key="idx"
          class="choice-btn"
          :disabled="!choiceAvailable(choice)"
          @click="chooseOption(choice, idx)"
        >
          <span class="ck">{{ String.fromCharCode(65 + idx) }}</span>
          <span class="choice-copy">
            <span class="choice-text">{{ choiceLabel(choice) }}</span>
            <span v-if="!simpleMode && choice.strategy" class="choice-strategy">
              <span>{{ choice.strategy.year }}</span>
              <span>{{ choice.strategy.risk }}</span>
              <span>{{ choice.strategy.reward }}</span>
              <span>{{ choice.strategy.fit }}</span>
              <span class="choice-assessment">当前评估：{{ choice.strategy.assessment }}</span>
              <span v-if="choice.strategy.knowledge" class="choice-knowledge">猎魂简记：{{ choice.strategy.knowledge }}</span>
            </span>
          </span>
          <span v-if="choiceHint(choice)" class="choice-hint" :class="{ ok: choiceAvailable(choice), no: !choiceAvailable(choice) }">
            {{ choiceHint(choice) }} {{ choiceAvailable(choice) ? '✓' : '✗' }}
          </span>
        </button>
      </div>
    </div>

    <!-- 地点行动：抵达后先进入这里，地点探索队列从这里开始或恢复 -->
    <div v-else-if="sceneState === 'location' && currentEvent" class="scene-location-action">
      <div class="location-action-heading">
        <div class="location-action-emblem" aria-hidden="true">✦</div>
        <div class="location-action-heading-copy">
          <div class="scene-location">【{{ currentEvent.location }}】</div>
          <div class="event-title">{{ currentEvent.name }}</div>
        </div>
        <div class="location-action-kicker">地点行动<br><span>LOCAL ACTION</span></div>
      </div>
      <div v-if="currentEvent.ringReady" class="ring-priority" data-testid="ring-hunt-priority">
        <div class="ring-priority-title">当前任务 · 第{{ currentEvent.ringOrdinal }}魂环</div>
        <div class="ring-priority-copy">{{ currentEvent.ringTargetName }}就是本次猎魂目标。正式猎魂入口已解锁，不需要等待随机事件。</div>
        <button class="btn btn-gold ring-priority-btn" @click="$emit('hunt')">✦ {{ currentEvent.ringLabel }}</button>
      </div>

      <p class="location-action-intro">{{ currentEvent.description || '这里有属于当地的线索、人物和行动。' }}</p>
      <div v-if="currentEvent.arrivalSummary" class="arrival-summary" data-testid="arrival-summary" v-html="currentEvent.arrivalSummary"></div>
      <div v-if="currentEvent.specialConditions?.length" class="location-condition">
        环境提示：{{ currentEvent.specialConditions.join('；') }}
      </div>

      <div class="location-action-context" aria-label="当地行动线索">
        <div class="location-context-item">
          <span class="context-label">当地活动</span>
          <strong>{{ currentEvent.activities?.slice(0, 3).join(' · ') || '调查当地线索' }}</strong>
        </div>
        <div class="location-context-item">
          <span class="context-label">可接触人物</span>
          <strong>{{ currentEvent.npcs?.slice(0, 3).join(' · ') || '当地向导' }}</strong>
        </div>
      </div>

      <div v-if="currentEvent.activeHere || currentEvent.suspendedHere" class="exploration-progress" :class="{ suspended: currentEvent.suspendedHere }">
        <span><i class="status-mark" aria-hidden="true"></i>{{ currentEvent.suspendedHere ? '已暂停' : '当前行动' }}：{{ currentEvent.explorationModeLabel }}</span>
        <strong>{{ currentEvent.exploration?.completedEventIds?.length || 0 }} / {{ currentEvent.exploration?.queuedEventIds?.length || currentEvent.stageCount }} 阶段</strong>
      </div>
      <p v-if="currentEvent.activeHere || currentEvent.suspendedHere" class="exploration-mode-copy">{{ currentEvent.explorationModeDescription }}</p>

      <section v-if="currentEvent.activeElsewhere" class="exploration-away" data-testid="exploration-away" aria-label="其它地点的未完成探索">
        <div class="exploration-away-heading">
          <span class="away-seal" aria-hidden="true">!</span>
          <div>
            <strong>其它地点仍有未完成探索</strong>
            <p>当前地点行动不会被锁定。你可以先处理这里的线索，也可以从下面的入口处理暂停队列。</p>
          </div>
        </div>
        <div v-for="exploration in currentEvent.explorationsElsewhere" :key="exploration.locationId" class="away-exploration-card">
          <div class="away-exploration-meta">
            <strong>{{ exploration.locationName }} · {{ exploration.modeLabel }}</strong>
            <span>{{ exploration.statusLabel }} · {{ exploration.progress.completed }}/{{ exploration.progress.total }} 阶段</span>
          </div>
          <div class="away-actions">
            <button class="btn btn-action-link" :aria-label="`返回并继续：${exploration.locationName}`" @click="$emit('return-exploration', exploration.locationId)">↩ 返回并继续</button>
            <button class="btn btn-action-link map-btn" aria-label="在地图中导航" @click="$emit('open-map')">🗺 在地图中导航</button>
            <button class="btn btn-action-link danger-link" :aria-label="`放弃上一轮并留在当前地点：${exploration.locationName}`" @click="$emit('abandon-exploration', exploration.locationId)">放弃上一轮并留在此处</button>
          </div>
        </div>
      </section>

      <div class="location-action-grid">
        <button v-if="currentEvent.activeHere || currentEvent.suspendedHere" class="btn btn-gold action-card" aria-label="继续深入" @click="$emit('resume-exploration')">
          <span class="action-glyph" aria-hidden="true">▶</span><span class="action-copy"><strong>继续深入</strong><small>{{ currentEvent.suspendedHere ? '恢复本地点的暂停进度' : '进入下一阶段事件' }}</small></span><span class="action-arrow" aria-hidden="true">→</span>
        </button>
        <button v-else class="btn btn-gold action-card" aria-label="探索当地" @click="$emit('start-exploration', 'local_exploration')">
          <span class="action-glyph" aria-hidden="true">✦</span><span class="action-copy"><strong>探索当地</strong><small>调查地形，追踪区域线索</small></span><span class="action-arrow" aria-hidden="true">→</span>
        </button>
        <button v-if="!simpleMode" class="btn action-card" aria-label="接取当地委托" @click="$emit('start-exploration', 'local_commission')">
          <span class="action-glyph" aria-hidden="true">◆</span><span class="action-copy"><strong>接取当地委托</strong><small>完成一轮当地任务与交付</small></span><span class="action-arrow" aria-hidden="true">→</span>
        </button>
        <button v-if="!simpleMode" class="btn action-card" aria-label="拜访当地人物" @click="$emit('start-exploration', 'local_contact')">
          <span class="action-glyph" aria-hidden="true">◇</span><span class="action-copy"><strong>拜访当地人物</strong><small>交换情报，建立地域关系</small></span><span class="action-arrow" aria-hidden="true">→</span>
        </button>
        <button class="btn map-btn action-card action-card-muted" aria-label="返回万象地图" @click="$emit('open-map')">
          <span class="action-glyph" aria-hidden="true">🗺</span><span class="action-copy"><strong>{{ simpleMode ? '看看地图' : '返回万象地图' }}</strong><small>{{ simpleMode ? '去别的地方走走' : '查看路线、目标与其它地点' }}</small></span><span class="action-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </div>

    <!-- 继续前行（事件结果） -->
    <div v-else-if="sceneState === 'continue'" class="scene-continue">
      <div class="scene-location" v-if="locationName">【{{ simpleMode ? childCopy(locationName) : locationName }}】</div>
      <div class="event-title">{{ currentEvent?.name ? (simpleMode ? childCopy(currentEvent.name) : currentEvent.name) : '继续旅程' }}</div>
      <div v-if="simpleMode" class="event-text">{{ resultDisplayText }}</div>
      <div v-else class="event-text" v-html="resultDisplayText"></div>
      <div class="event-choices">
        <button class="choice-btn continue-btn" @click="$emit('continue')">
          <span class="ck">▶</span>
          <span class="choice-text">{{ simpleMode ? '继续出发' : '继续前行' }}</span>
        </button>
        <button class="choice-btn map-btn" @click="$emit('open-map')">
          <span class="ck">🗺</span>
          <span class="choice-text">{{ simpleMode ? '看看地图' : '查阅万象地图' }}</span>
        </button>
      </div>
    </div>

    <!-- 最终结局 -->
    <div v-else-if="sceneState === 'ending' && currentEvent" class="scene-ending">
      <div class="ending-rune">终</div>
      <div class="event-title">{{ currentEvent.name }}</div>
      <div class="ending-sub">{{ playerName }} · {{ spiritName }} · Lv.{{ playerLevel }}</div>
      <div class="ending-text">
        <p v-for="(paragraph, index) in currentEvent.text || []" :key="index">{{ paragraph }}</p>
      </div>
      <div class="event-choices ending-actions">
        <a class="choice-btn continue-btn" href="/#/">
          <span class="ck">⌂</span>
          <span class="choice-text">返回标题</span>
        </a>
        <a class="choice-btn map-btn" href="/#/codex">
          <span class="ck">📖</span>
          <span class="choice-text">查看万象图鉴</span>
        </a>
      </div>
    </div>

    <!-- 战斗场景 -->
    <div v-else-if="sceneState === 'battle'" class="scene-battle">
      <BattleArena />
    </div>

    <!-- 空闲状态 -->
    <div v-else class="scene-idle">
      <div class="scene-idle-inner">
        <div class="scene-idle-rune">魂</div>
        <div class="scene-idle-title">{{ idleTitle }}</div>
        <div class="scene-idle-desc">{{ idleDesc }}</div>
        <div class="scene-idle-tip">{{ idleTip }}</div>
        <div class="explore-btns">
          <button class="btn btn-gold" @click="$emit('explore')">{{ simpleMode ? '✦ 去探索' : '✦ 探索四周' }}</button>
          <button class="btn" @click="$emit('rest')">{{ simpleMode ? '休息一下' : '原地休息' }}</button>
          <button class="btn" @click="$emit('hunt')" v-if="canHunt">{{ simpleMode ? '去打怪' : '猎杀魂兽' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BattleArena from './BattleArena.vue'
import { childCopy, shortChildStory, shortChildChoice } from '@/utils/child-mode'

const props = defineProps({
  sceneState: { type: String, default: 'idle' },
  currentEvent: { type: Object, default: null },
  resultText: { type: String, default: '' },
  playerName: { type: String, default: '魂师' },
  spiritName: { type: String, default: '武魂' },
  playerLevel: { type: Number, default: 1 },
  canHunt: { type: Boolean, default: false },
  locationName: { type: String, default: '' },
  checkCond: { type: Function, default: () => true },
  simpleMode: { type: Boolean, default: false }
})

const emit = defineEmits([
  'explore', 'rest', 'hunt', 'choose', 'continue', 'open-map',
  'start-exploration', 'resume-exploration', 'return-exploration', 'abandon-exploration'
])

const idleTitle = computed(() => props.simpleMode ? '准备好出发啦' : '旅途尚待展开')
const idleDesc = computed(() => props.simpleMode
  ? '点一下金色大按钮，看看会遇见什么故事。'
  : '你正站在斗罗大陆的道路上，远处城镇灯火微明，林间传来魂兽的低鸣。')
const idleTip = computed(() => props.simpleMode ? '' : '你可以探索四周、寻找魂兽，或前往附近城镇。')

// 简单模式：地点/标题去术语，正文压缩到三句以内，选项一行以内。
const displayLocation = computed(() => props.simpleMode ? childCopy(props.currentEvent?.location || props.locationName) : (props.currentEvent?.location || props.locationName))
const displayTitle = computed(() => props.simpleMode ? childCopy(props.currentEvent?.name || '') : (props.currentEvent?.name || ''))

const eventText = computed(() => {
  if (!props.currentEvent?.text) return ''
  if (props.simpleMode) return shortChildStory(props.currentEvent.text, 3, 150)
  const texts = Array.isArray(props.currentEvent.text) ? props.currentEvent.text : [props.currentEvent.text]
  return texts
    .join('<br/><br/>')
    .replace(/\{name\}/g, props.playerName)
    .replace(/\{spirit\}/g, props.spiritName)
})

const resultDisplayText = computed(() => {
  if (!props.resultText) return '你休整片刻，准备踏上新的旅程。'
  if (props.simpleMode) return shortChildStory(props.resultText, 3, 160)
  return props.resultText
    .replace(/\{name\}/g, props.playerName)
    .replace(/\{spirit\}/g, props.spiritName)
})

const availableChoices = computed(() => {
  if (!props.currentEvent?.choices) return []
  return props.currentEvent.choices
})

function choiceLabel(choice) {
  return props.simpleMode ? shortChildChoice(choice.text) : choice.text
}

function choiceAvailable(choice) {
  const cond = choice.cond || choice.req
  if (!cond) return true
  if (typeof cond === 'function') {
    return props.checkCond(cond)
  }
  return props.checkCond(cond)
}

function choiceHint(choice) {
  const cond = choice.cond || choice.req
  if (!cond) return ''
  if (typeof choice.requirementHint === 'string' && choice.requirementHint.trim()) {
    return props.simpleMode ? childCopy(choice.requirementHint.trim()) : choice.requirementHint.trim()
  }
  if (typeof cond === 'function') return props.simpleMode ? '' : '留意事件描述中的条件线索'
  const parts = []
  if (cond.attack) parts.push(`攻击≥${cond.attack}`)
  if (cond.defense) parts.push(`防御≥${cond.defense}`)
  if (cond.speed) parts.push(`速度≥${cond.speed}`)
  if (cond.level) parts.push(`等级≥${cond.level}`)
  if (cond.gold) parts.push(`金币≥${cond.gold}`)
  if (cond.fate) parts.push(`命运≥${cond.fate}`)
  if (cond.item) parts.push(`需要${cond.item}`)
  const text = parts.join('·')
  return props.simpleMode ? childCopy(text) : text
}

function chooseOption(choice, idx) {
  if (!choiceAvailable(choice)) return
  emit('choose', { choice, idx })
}

function onImgError(e) {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.scene-area {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
}

/* ============ 事件场景 ============ */
.scene-event,
.scene-continue,
.scene-ending,
.scene-location-action {
  width: 100%;
  max-width: none;
  margin: 0 auto;
}

@media (min-width: 1200px) {
  .scene-event,
  .scene-continue,
  .scene-ending,
  .scene-location-action {
    width: 88%;
    max-width: 1600px;
  }
}

.scene-location-action {
  min-height: 0;
  padding: 2px 0 28px;
}
.location-action-heading {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 0 12px;
  border-bottom: 1px solid rgba(201, 168, 76, 0.45);
}
.location-action-emblem {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--gold);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201, 168, 76, 0.22), rgba(36, 28, 14, 0.72) 68%);
  color: var(--gold-hi);
  box-shadow: 0 0 16px rgba(201, 168, 76, 0.18), inset 0 0 12px rgba(201, 168, 76, 0.12);
}
.location-action-heading-copy { min-width: 0; }
.location-action-heading .scene-location { margin-bottom: 4px; }
.location-action-heading .event-title { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
.location-action-kicker {
  color: var(--gold);
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 2px;
  line-height: 1.4;
  text-align: right;
  opacity: 0.9;
}
.location-action-kicker span {
  color: var(--ink-faint);
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 1px;
}
.location-action-context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0 14px;
}
.location-context-item {
  min-width: 0;
  padding: 9px 11px;
  border: 1px solid rgba(74, 61, 34, 0.9);
  border-left: 2px solid rgba(201, 168, 76, 0.58);
  background: linear-gradient(135deg, rgba(46, 36, 20, 0.75), rgba(23, 17, 6, 0.72));
}
.context-label {
  display: block;
  margin-bottom: 4px;
  color: var(--ink-faint);
  font-size: 10px;
  letter-spacing: 1px;
}
.location-context-item strong {
  display: block;
  overflow: hidden;
  color: var(--ink);
  font-size: 12px;
  font-weight: normal;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.location-action-intro {
  margin: 0 0 12px;
  color: var(--ink);
  line-height: 1.8;
  font-size: 15px;
}
.arrival-summary {
  max-height: 11rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid rgba(201, 168, 76, 0.58);
  border-left: 3px solid var(--gold);
  background: rgba(201, 168, 76, 0.08);
  color: var(--ink);
  font-size: 13px;
  line-height: 1.75;
}
.location-condition {
  margin-bottom: 14px;
  padding: 8px 12px;
  border-left: 2px solid var(--gold);
  background: rgba(201, 168, 76, 0.06);
  color: var(--ink-dim);
  font-size: 12px;
  line-height: 1.6;
}
.ring-priority {
  margin: 10px 0 14px;
  padding: 12px 14px;
  border: 1px solid rgba(201, 168, 76, 0.72);
  border-left: 4px solid #1abc9c;
  border-radius: 5px;
  background: linear-gradient(120deg, rgba(18, 40, 34, 0.9), rgba(52, 39, 16, 0.62));
}
.ring-priority-title {
  color: var(--gold-hi);
  font-family: var(--font-display);
  letter-spacing: 2px;
  margin-bottom: 5px;
}
.ring-priority-copy {
  color: var(--ink);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 10px;
}
.ring-priority-btn {
  width: 100%;
}
.exploration-progress,
.exploration-away {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 10px 0;
  padding: 8px 12px;
  border: 1px solid var(--line);
  color: var(--ink-dim);
  font-size: 12px;
  line-height: 1.6;
}
.exploration-progress {
  align-items: center;
  border-color: rgba(127, 196, 140, 0.48);
  background: rgba(18, 40, 34, 0.34);
}
.exploration-progress strong { color: #b9e7c0; white-space: nowrap; }
.exploration-progress.suspended {
  border-color: rgba(201, 168, 76, 0.68);
  background: rgba(52, 39, 16, 0.38);
}
.status-mark {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin: 0 7px 1px 0;
  border-radius: 50%;
  background: #9bcda3;
  box-shadow: 0 0 8px rgba(155, 205, 163, 0.8);
}
.exploration-progress.suspended .status-mark {
  background: var(--gold-hi);
  box-shadow: 0 0 8px rgba(230, 200, 120, 0.72);
}
.exploration-mode-copy {
  margin: -4px 0 10px;
  color: var(--ink-dim);
  font-size: 12px;
  line-height: 1.55;
}
.exploration-away {
  display: grid;
  gap: 10px;
  color: var(--gold);
  border-color: rgba(201, 168, 76, 0.72);
  border-left: 3px solid var(--gold);
  background: linear-gradient(135deg, rgba(52, 39, 16, 0.62), rgba(23, 17, 6, 0.74));
}
.exploration-away-heading {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.away-seal {
  display: grid;
  place-items: center;
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  border: 1px solid var(--gold-hi);
  border-radius: 50%;
  color: var(--gold-hi);
  font-weight: bold;
}
.exploration-away-heading strong { display: block; color: var(--gold-hi); font-size: 13px; letter-spacing: 1px; }
.exploration-away-heading p { margin-top: 3px; color: var(--ink-dim); font-size: 12px; line-height: 1.6; }
.away-exploration-card {
  padding: 9px 10px 10px;
  border: 1px solid rgba(138, 116, 64, 0.72);
  background: rgba(10, 8, 4, 0.28);
}
.away-exploration-meta { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.away-exploration-meta strong { color: var(--ink); font-size: 12px; font-weight: normal; }
.away-exploration-meta span { color: var(--gold); font-size: 11px; white-space: nowrap; }
.away-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
.away-actions .btn { min-height: 34px; padding: 6px 9px; font-size: 11px; letter-spacing: 0.5px; }
.btn-action-link { border-color: rgba(201, 168, 76, 0.58); background: rgba(36, 28, 14, 0.72); }
.danger-link { border-color: rgba(208, 106, 90, 0.58); color: #eaa69a; }
.location-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.location-action-grid .btn {
  min-height: 44px;
  padding: 9px 12px;
}
.scene-location-action .btn {
  display: inline-flex;
  align-items: center;
  width: 100%;
  border: 1px solid rgba(74, 61, 34, 0.95);
  border-radius: 4px;
  background: linear-gradient(180deg, rgba(51, 41, 26, 0.96), rgba(36, 28, 14, 0.98));
  color: var(--ink);
  font-family: var(--font-body);
  letter-spacing: 1px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.scene-location-action .btn:hover:not(:disabled) {
  border-color: var(--gold);
  background: linear-gradient(180deg, rgba(70, 55, 27, 0.98), rgba(43, 32, 15, 0.98));
  color: var(--gold-hi);
  transform: translateY(-1px);
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.34);
}
.scene-location-action .btn:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }
.scene-location-action .btn:disabled { opacity: 0.45; cursor: not-allowed; }
.scene-location-action .btn-gold { border-color: var(--gold); color: var(--gold-hi); }
.action-card { justify-content: flex-start; gap: 10px; text-align: left; }
.action-glyph { display: inline-grid; place-items: center; flex: 0 0 24px; color: var(--gold-hi); font-size: 16px; }
.action-copy { display: grid; flex: 1; gap: 3px; min-width: 0; }
.action-copy strong { font-size: 14px; font-weight: normal; letter-spacing: 1px; }
.action-copy small { color: var(--ink-dim); font-size: 11px; letter-spacing: 0; line-height: 1.4; }
.action-arrow { color: var(--gold); font-size: 17px; }
.action-card-muted { border-color: rgba(143, 184, 216, 0.38) !important; }
.action-card-muted .action-glyph,
.action-card-muted .action-arrow { color: var(--info); }
@media (max-width: 640px) {
  .location-action-grid { grid-template-columns: 1fr; gap: 8px; }
  .location-action-grid .btn { min-height: 44px; }
  .location-action-context { grid-template-columns: 1fr; }
  .location-action-kicker { display: none; }
  .away-exploration-meta { display: grid; gap: 3px; }
}

@media (max-width: 768px) {
  .scene-area {
    padding: 14px 12px max(18px, env(safe-area-inset-bottom));
    overscroll-behavior: contain;
  }
  .event-title { font-size: 20px; margin-bottom: 12px; }
  .event-text { font-size: 15px; line-height: 1.8; margin-bottom: 14px; }
  .choice-btn { min-height: 48px; padding: 11px 12px; }
  /* 无下滑改造：小屏压缩配图高度，让"正文+选项"更可能整段进入首屏 */
  .scene-img { max-height: min(22dvh, 180px); margin-bottom: 10px; }
  .scene-idle { min-height: 100%; padding-block: 12px 20px; }
  .scene-idle-rune { font-size: 52px; margin-bottom: 8px; }
  .scene-idle-tip { margin-bottom: 16px; }
}

.scene-ending {
  padding-top: 24px;
  text-align: center;
}

.ending-rune {
  margin-bottom: 10px;
  color: var(--gold);
  font-family: var(--font-display);
  font-size: 64px;
  opacity: 0.5;
}

.ending-sub {
  margin: -6px 0 22px;
  color: var(--ink-dim);
  letter-spacing: 2px;
}

.ending-text {
  margin-bottom: 26px;
  color: var(--ink);
  font-size: 16px;
  line-height: 2;
  text-align: left;
}

.ending-text p + p {
  margin-top: 14px;
}

.ending-actions a {
  text-decoration: none;
}

.scene-location {
  font-size: 13px;
  color: var(--ink-dim);
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.event-title {
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--gold);
  letter-spacing: 3px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.scene-img {
  width: 100%;
  aspect-ratio: 12 / 5;
  max-height: min(52vh, 580px);
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid var(--line);
}

.event-text {
  font-size: 16px;
  line-height: 2;
  color: var(--ink);
  margin-bottom: 24px;
  text-indent: 2em;
}

.event-text :deep(.hl-gold) {
  color: var(--gold);
  font-weight: bold;
}

.event-choices {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.choice-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(36, 28, 14, 0.6);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.choice-btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-hi);
  background: rgba(201, 168, 76, 0.1);
  transform: translateX(4px);
}

.choice-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ck {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--line);
  border-radius: 3px;
  font-size: 13px;
  color: var(--gold);
  flex-shrink: 0;
}

.choice-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 5px;
}
.choice-text { display: block; }
.choice-strategy { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--ink-dim); font-size: 11px; line-height: 1.5; }
.choice-strategy > span:not(.choice-assessment):not(.choice-knowledge)::before { content: '· '; color: var(--gold); }
.choice-assessment { width: 100%; color: #b9e7c0; }
.choice-knowledge { width: 100%; color: #d7bd75; }

.choice-hint {
  font-size: 12px;
  color: var(--ink-dim);
  white-space: nowrap;
}

.choice-hint.ok {
  color: var(--ok, #6b8e4e);
}

.choice-hint.no {
  color: var(--danger, #a05a5a);
}

.continue-btn {
  border-color: rgba(201, 168, 76, 0.4);
}

.continue-btn:hover {
  border-color: var(--gold) !important;
}

.map-btn {
  border-color: rgba(139, 92, 246, 0.3);
}

.map-btn:hover {
  border-color: rgba(139, 92, 246, 0.6) !important;
}

/* ============ 战斗场景 ============ */
.scene-battle {
  max-width: 900px;
  margin: 0 auto;
}

/* ============ 空闲场景 ============ */
.scene-idle {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.scene-idle-inner {
  max-width: 480px;
}

.scene-idle-rune {
  font-family: var(--font-display);
  font-size: 72px;
  color: rgba(201, 168, 76, 0.12);
  margin-bottom: 16px;
  animation: runeBreath 4s ease-in-out infinite alternate;
}

@keyframes runeBreath {
  from { opacity: 0.08; transform: scale(0.95); }
  to { opacity: 0.18; transform: scale(1.05); }
}

.scene-idle-title {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--gold);
  letter-spacing: 4px;
  margin-bottom: 12px;
}

.scene-idle-desc {
  font-size: 15px;
  color: var(--ink-dim);
  line-height: 2;
  margin-bottom: 8px;
}

.scene-idle-tip {
  font-size: 13px;
  color: #6b5e42;
  letter-spacing: 1px;
  margin-bottom: 24px;
}

.explore-btns {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.explore-btns .btn {
  display: inline-block;
  min-height: 44px;
  padding: 10px 24px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: linear-gradient(180deg, #33291a, #241c0e);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.25s;
}

.explore-btns .btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-hi);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.explore-btns .btn-gold {
  border-color: var(--gold);
  color: var(--gold-hi);
}
</style>
