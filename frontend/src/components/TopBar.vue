<template>
  <div class="game-topbar">
    <div class="gt-title">斗罗大陆 · 武魂觉醒</div>
    <div class="top-btns">
      <details class="top-group">
        <summary>常用</summary>
        <div class="top-group-menu">
          <button class="top-btn" @click="$emit('action', 'bag')">背包</button>
          <button class="top-btn" @click="$emit('action', 'shop')">商店</button>
          <button class="top-btn" @click="$emit('action', 'map')">地图</button>
          <button class="top-btn" style="color:#7fc48c" @click="$emit('action', 'travel')">旅行</button>
          <button class="top-btn" @click="$emit('action', 'quests')">任务</button>
          <button class="top-btn" @click="$emit('action', 'signin')">签到</button>
        </div>
      </details>
      <details class="top-group">
        <summary>成长</summary>
        <div class="top-group-menu">
          <button class="top-btn" style="color:#e6c878" @click="$emit('action', 'skilltree')">技能树</button>
          <button class="top-btn" @click="$emit('action', 'bone')">魂骨</button>
          <button class="top-btn" @click="$emit('action', 'forge')">锻造</button>
          <button class="top-btn" @click="$emit('action', 'train')">修炼</button>
          <button class="top-btn" @click="$emit('action', 'tower')">挑战塔</button>
          <button class="top-btn" style="color:#88ccff" @click="$emit('action', 'formation')">阵法</button>
          <button class="top-btn" style="color:#e6c878" @click="$emit('action', 'achievement')">成就</button>
          <button class="top-btn" style="color:#e6c878" @click="$emit('action', 'title')">称号</button>
        </div>
      </details>
      <details class="top-group">
        <summary>人物与图鉴</summary>
        <div class="top-group-menu">
          <button class="top-btn" @click="$emit('action', 'npc')">人物</button>
          <button class="top-btn" style="color:#ff8ab8" @click="$emit('action', 'relation')">关系</button>
          <button class="top-btn" @click="$emit('action', 'codex')">万象图鉴</button>
        </div>
      </details>
      <details class="top-group">
        <summary>系统</summary>
        <div class="top-group-menu">
          <button class="top-btn" @click="$emit('action', 'save')">存档</button>
          <button class="top-btn" style="color:#a78bfa" @click="$emit('action', 'help')">帮助</button>
          <button class="top-btn" @click="$emit('action', 'home')">返回主页</button>
        </div>
      </details>
    </div>
    <div class="time-weather-display">{{ timeWeatherText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()

const TIME_PERIODS = ['黎明', '上午', '正午', '午后', '黄昏', '夜晚', '深夜', '凌晨']
const WEATHER_TYPES = ['晴朗', '多云', '小雨', '大雨', '雷暴', '雾', '雪']

const timeWeatherText = computed(() => {
  const time = TIME_PERIODS[gameStore._gameTime % TIME_PERIODS.length] || '黎明'
  const weather = WEATHER_TYPES[gameStore._weather % WEATHER_TYPES.length] || '晴朗'
  return `${time} · ${weather}`
})

defineEmits(['action'])
</script>

<style scoped>
.game-topbar {
  position: relative;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(30, 24, 14, 0.8);
  backdrop-filter: blur(8px);
  flex-wrap: wrap;
}
.gt-title {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold);
  letter-spacing: 3px;
  flex-shrink: 0;
}
.top-btns {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: center;
  flex-wrap: wrap;
}
.top-group {
  position: relative;
}
.top-group summary {
  display: inline-block;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink-dim);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  list-style: none;
}
.top-group summary::-webkit-details-marker { display: none; }
.top-group[open] summary {
  border-color: var(--gold);
  color: var(--gold-hi);
  background: rgba(201, 168, 76, 0.08);
}
.top-group summary:hover {
  border-color: var(--gold);
  color: var(--gold-hi);
}
.top-group-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--bg2);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  min-width: 120px;
}
.top-group:not([open]) > .top-group-menu {
  display: none;
}
.top-btn {
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 14px;
  letter-spacing: 1px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  text-align: left;
}
.top-btn:hover {
  background: rgba(201, 168, 76, 0.12);
  color: var(--gold-hi);
}
.time-weather-display {
  font-size: 13px;
  color: var(--ink-dim);
  letter-spacing: 1px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .game-topbar {
    flex-wrap: nowrap;
    gap: 6px;
    padding: 6px 8px;
    padding-right: max(8px, env(safe-area-inset-right));
    padding-left: max(8px, env(safe-area-inset-left));
  }
  .gt-title { display: none; }
  .top-btns {
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 4px;
    min-width: 0;
  }
  .top-group summary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 8px 10px;
    white-space: nowrap;
  }
  .top-group-menu {
    max-height: min(70dvh, 520px);
    overflow-y: auto;
  }
  .top-btn { min-height: 44px; }
}

@media (max-width: 480px) {
  .time-weather-display { display: none; }
  .top-btns { justify-content: space-between; }
}
</style>
