<template>
  <div class="battle-shell">
    <!-- 技能横幅 -->
    <div v-if="feedback?.skillName" class="battle-skill-banner">{{ feedback.skillName }}</div>
    <!-- Boss阶段提示 -->
    <div v-if="phaseNotice" class="battle-phase-banner">{{ phaseNotice }}</div>

    <!-- 回合信息 -->
    <div class="battle-heading">
      <span>第 {{ round }} 回合</span>
      <strong>{{ enemy?.isBoss ? 'BOSS 战' : '正式战斗' }}</strong>
      <div class="battle-mini-group">
        <button class="battle-mini" :class="{ active: autoMode }" :title="autoMode ? '点击切换回手动操作' : '开启自动战斗'" @click="toggleAuto">{{ autoMode ? '自动中' : '自动' }}</button>
        <button class="battle-mini" @click="cycleSpeed">{{ speedLabel }}</button>
      </div>
    </div>

    <!-- 对战双方 -->
    <div class="battle-fighters">
      <!-- 玩家 -->
      <div class="battle-fighter player" :class="{
        acting: feedback?.actor === 'player',
        hit: feedback?.target === 'player'
      }">
        <div v-if="feedback?.target === 'player'" class="battle-float" :class="feedback.type">{{ feedback.text }}</div>
        <div class="battle-fighter-name">
          {{ player.name }}
          <span>{{ ELEMENT_ICONS[playerElement] }}{{ ELEMENT_NAMES[playerElement] }}</span>
        </div>
        <div class="battle-avatar">
          <img v-if="player.spirit?.image" :src="player.spirit.image" alt="" decoding="async" />
          <span v-else>{{ player.spirit?.icon || '✦' }}</span>
        </div>
        <div class="battle-bar hp"><i :style="{ width: playerHpPct + '%' }"></i></div>
        <div class="battle-value">生命 {{ Math.max(0, Math.round(player.hp)) }}/{{ maxHp }}</div>
        <div class="battle-bar mp"><i :style="{ width: mpPct + '%' }"></i></div>
        <div class="battle-value">魂力 {{ Math.round(player.spiritPower) }}/{{ maxMp }}</div>
        <div class="battle-statuses">
          <span v-for="s in playerStatusDisplay" :key="s.name" class="battle-status" :class="s.harmful ? 'bad' : 'good'" :title="`${s.name}，剩余${s.turns}回合`">
            {{ s.icon }}{{ s.name }} {{ s.turns }}
          </span>
          <span v-if="playerStatusDisplay.length === 0" class="battle-no-status">无状态</span>
        </div>
      </div>

      <!-- VS -->
      <div class="battle-versus">
        <span>VS</span>
        <b>{{ combo }} 连击</b>
      </div>

      <!-- 敌人 -->
      <div class="battle-fighter enemy" :class="{
        boss: enemy?.isBoss,
        acting: feedback?.actor === 'enemy',
        hit: feedback?.target === 'enemy'
      }">
        <div v-if="feedback?.target === 'enemy'" class="battle-float" :class="feedback.type">{{ feedback.text }}</div>
        <div class="battle-fighter-name">
          {{ enemy?.name }}
          <span>{{ ELEMENT_ICONS[enemyElement] }}{{ ELEMENT_NAMES[enemyElement] }}</span>
        </div>
        <div class="battle-avatar">
          <img v-if="enemy?.image" :src="enemy.image" alt="" decoding="async" />
          <span v-else>{{ enemy?.icon }}</span>
        </div>
        <div class="battle-bar hp enemy"><i :style="{ width: enemyHpPct + '%' }"></i></div>
        <div class="battle-value">生命 {{ Math.max(0, Math.round(enemy?.hp || 0)) }}/{{ enemy?.maxHp || 0 }}</div>
        <div class="battle-meta">攻 {{ enemy?.attack }} · 防 {{ enemy?.defense }} · 速 {{ enemy?.speed }}<template v-if="enemy?.isBoss"> · 阶段{{ bossPhase }}</template></div>
        <div class="battle-statuses">
          <span v-for="s in enemyStatusDisplay" :key="s.name" class="battle-status" :class="s.harmful ? 'bad' : 'good'" :title="`${s.name}，剩余${s.turns}回合`">
            {{ s.icon }}{{ s.name }} {{ s.turns }}
          </span>
          <span v-if="enemyStatusDisplay.length === 0" class="battle-no-status">无状态</span>
        </div>
      </div>
    </div>

    <!-- 战斗日志 -->
    <div class="battle-log">
      <div v-for="(log, i) in logs" :key="i" :class="log.type">{{ log.text }}</div>
    </div>

    <!-- 行动按钮：玩家亲自出手即从自动切回手动 -->
    <div class="battle-actions">
      <button class="battle-action primary" :disabled="!canAct" @click="onManualAction(performAttack)">普通攻击</button>
      <button v-for="s in skills" :key="s.index" class="battle-action skill" :disabled="s.disabled" @click="onManualAction(() => performSkill(s.index))">
        <span>{{ ELEMENT_ICONS[s.element] }} {{ s.skill.name }}</span>
        <small>{{ s.cooldown ? `还要等${s.cooldown}回合` : `${s.cost}魂力` }}</small>
      </button>
      <button class="battle-action" :disabled="!canAct || fusionUsed || ringCount < 3" :title="ringCount < 3 ? '至少获得三个魂环后才能施展武魂融合' : '武魂融合：40魂力，高额伤害并获得护盾'" @click="onManualAction(performFusion)">
        武魂融合<small>{{ fusionUsed ? '本场已使用' : (ringCount < 3 ? '需≥3魂环' : '40魂力') }}</small>
      </button>
      <button class="battle-action" :disabled="!canAct" @click="onManualAction(performDefend)">防御</button>
      <button class="battle-action" :disabled="!canAct" @click="onManualAction(toggleItems)">道具</button>
      <button class="battle-action danger" :disabled="!canAct || enemy?.isBoss || allowFlee === false" @click="attemptFlee">逃跑</button>
    </div>

    <!-- 道具列表 -->
    <div v-if="showItems" class="battle-items">
      <button v-for="ui in usableItems" :key="ui.index" class="battle-item" @click="useItem(ui.index)">
        {{ ui.item.name }} ×{{ ui.item.count }}
      </button>
      <span v-if="usableItems.length === 0">没有可在战斗中使用的道具</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameRules } from '@/composables/useGameRules'
import { useBattleSystem } from '@/composables/useBattleSystem'

const player = usePlayerStore()
const { finalStats, getMaxSpiritPower } = useGameRules()
const battle = useBattleSystem()

onBeforeUnmount(() => battle.resetBattle())

const {
  active, enemy, logs, turn, combo, round, bossPhase, phaseNotice, feedback,
  playerStatusDisplay, enemyStatusDisplay,
  playerHpPct, enemyHpPct, mpPct, playerElement, enemyElement,
  skills, usableItems, showItems, autoMode, speedLabel, fusionUsed, allowFlee, isBoss,
  ELEMENT_ICONS, ELEMENT_NAMES,
  performAttack, performSkill, performFusion, performDefend,
  toggleItems, useItem, attemptFlee, toggleAuto, cycleSpeed
} = battle

const maxHp = computed(() => finalStats().maxHp)
const maxMp = computed(() => getMaxSpiritPower())
const canAct = computed(() => turn.value === 'player' && active.value)
const ringCount = computed(() => player.rings?.length || 0)

// 玩家亲自出手（攻击/魂技/融合等）：若自动战斗进行中，先切回手动，把操作权还给玩家；
// 之后随时可以再点【自动】交还给自动战斗。
function onManualAction(fn) {
  if (autoMode.value) toggleAuto()
  fn()
}
</script>

<style scoped>
.battle-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.battle-skill-banner {
  text-align: center;
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold-hi);
  letter-spacing: 3px;
  padding: 6px;
  background: linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent);
  animation: bannerFlash 0.5s ease;
}
.battle-phase-banner {
  text-align: center;
  font-size: 14px;
  color: #ff6b6b;
  letter-spacing: 2px;
  padding: 4px;
  animation: bannerFlash 0.5s ease;
}
@keyframes bannerFlash {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.battle-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(20,16,10,0.6);
  border-radius: 6px;
  border: 1px solid var(--line);
  font-size: 13px;
  color: var(--ink-dim);
}
.battle-heading strong {
  color: var(--gold-hi);
  font-family: var(--font-display);
  letter-spacing: 2px;
}
.battle-mini-group {
  display: flex;
  gap: 4px;
}
.battle-mini {
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: rgba(30,24,16,0.8);
  color: var(--ink-dim);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.battle-mini.active {
  background: rgba(201,168,76,0.2);
  color: var(--gold-hi);
  border-color: var(--gold);
}
.battle-mini:hover {
  border-color: var(--gold);
}

.battle-fighters {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: start;
}
.battle-fighter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(20,16,10,0.5);
  position: relative;
  transition: transform 0.15s;
}
.battle-fighter.player {
  border-color: rgba(100,160,220,0.3);
}
.battle-fighter.enemy {
  border-color: rgba(200,100,100,0.3);
}
.battle-fighter.enemy.boss {
  border-color: rgba(200,50,50,0.5);
  box-shadow: 0 0 16px rgba(200,50,50,0.15);
}
.battle-fighter.acting {
  transform: translateX(-4px);
}
.battle-fighter.hit {
  animation: hitShake 0.3s ease;
}
@keyframes hitShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(4px); }
}
.battle-fighter-name {
  font-size: 14px;
  color: var(--gold-hi);
  font-family: var(--font-display);
  letter-spacing: 1px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.battle-fighter-name span {
  font-size: 12px;
  color: var(--ink-dim);
}
.battle-avatar {
  width: 100%;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #171106;
  border: 1px solid var(--line);
  font-size: 40px;
}
.battle-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.battle-bar {
  height: 12px;
  border-radius: 6px;
  background: rgba(0,0,0,0.5);
  overflow: hidden;
  border: 1px solid var(--line);
}
.battle-bar i {
  display: block;
  height: 100%;
  transition: width 0.3s ease;
}
.battle-bar.hp i {
  background: linear-gradient(90deg, #2d8a3e, #4ec05a);
}
.battle-bar.hp.enemy i {
  background: linear-gradient(90deg, #8a2d2d, #c04040);
}
.battle-bar.mp i {
  background: linear-gradient(90deg, #2d5a8a, #4080c0);
}
.battle-value {
  font-size: 11px;
  color: var(--ink-dim);
  letter-spacing: 0.5px;
}
.battle-meta {
  font-size: 10px;
  color: var(--ink-dim);
}
.battle-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  min-height: 20px;
}
.battle-status {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  border: 1px solid;
}
.battle-status.bad {
  background: rgba(200,60,60,0.15);
  color: #e07070;
  border-color: rgba(200,60,60,0.3);
}
.battle-status.good {
  background: rgba(60,200,100,0.15);
  color: #70e090;
  border-color: rgba(60,200,100,0.3);
}
.battle-no-status {
  font-size: 10px;
  color: #555;
}
.battle-float {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 18px;
  font-weight: bold;
  animation: floatUp 0.8s ease forwards;
  z-index: 5;
}
.battle-float.crit { color: #ffd700; }
.battle-float.damage { color: #ff6060; }
.battle-float.heal { color: #60ff80; }
@keyframes floatUp {
  from { opacity: 1; top: -10px; }
  to { opacity: 0; top: -40px; }
}

.battle-versus {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding-top: 20px;
}
.battle-versus span {
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--gold);
  letter-spacing: 2px;
}
.battle-versus b {
  font-size: 12px;
  color: var(--ink-dim);
}

.battle-log {
  max-height: 180px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 12px;
  background: rgba(10,8,5,0.6);
  border-radius: 6px;
  border: 1px solid var(--line);
  font-size: 12px;
  line-height: 1.7;
}
.battle-log::-webkit-scrollbar {
  width: 4px;
}
.battle-log::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 2px;
}
.battle-log > div { padding: 1px 0; }
.battle-log .normal { color: var(--ink); }
.battle-log .player { color: #8fc8e8; }
.battle-log .damage { color: #e07070; }
.battle-log .crit { color: #ffd700; font-weight: bold; }
.battle-log .heal { color: #70e090; }
.battle-log .status { color: #c0a0e0; }
.battle-log .warning { color: #e0a060; }
.battle-log .boss { color: #ff6060; font-weight: bold; }

.battle-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.battle-action {
  flex: 1;
  min-width: 80px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: rgba(30,24,16,0.8);
  color: var(--ink);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.battle-action small {
  font-size: 10px;
  color: var(--ink-dim);
}
.battle-action:hover:not(:disabled) {
  border-color: var(--gold);
  background: rgba(201,168,76,0.1);
  color: var(--gold-hi);
}
.battle-action.primary {
  background: rgba(180,80,40,0.2);
  border-color: rgba(200,100,50,0.4);
  color: #e09060;
}
.battle-action.primary:hover:not(:disabled) {
  background: rgba(200,100,50,0.3);
}
.battle-action.skill {
  background: rgba(60,100,160,0.15);
  border-color: rgba(80,120,180,0.3);
}
.battle-action.danger {
  background: rgba(120,40,40,0.15);
  border-color: rgba(160,60,60,0.3);
  color: #c07070;
}
.battle-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.battle-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  background: rgba(20,16,10,0.5);
  border-radius: 6px;
  border: 1px solid var(--line);
}
.battle-item {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(201,168,76,0.1);
  color: var(--gold-hi);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.battle-item:hover {
  background: rgba(201,168,76,0.2);
}

@media (max-width: 768px) {
  .battle-fighters {
    grid-template-columns: 1fr;
  }
  .battle-versus {
    flex-direction: row;
    padding: 4px 0;
  }
  .battle-action {
    min-height: 44px;
    min-width: 60px;
    font-size: 12px;
    padding: 6px 8px;
  }
}
</style>
