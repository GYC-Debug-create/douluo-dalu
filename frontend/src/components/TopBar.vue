<template>
  <div ref="barRef" class="game-topbar">
    <div class="gt-title">斗罗大陆 · 武魂觉醒</div>
    <div class="top-btns">
      <details v-for="group in GROUPS" :key="group.label" class="top-group" @toggle="onToggle">
        <summary>{{ group.label }}</summary>
        <div class="top-group-menu">
          <button
            v-for="item in group.items"
            :key="item.action"
            class="top-btn"
            :style="item.color ? { color: item.color } : null"
            @click="onAction(item.action)"
          >{{ item.label }}</button>
        </div>
      </details>
    </div>
    <div class="time-weather-display">{{ timeWeatherText }}</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()
const emit = defineEmits(['action'])
const barRef = ref(null)

// 儿童版（8~12 岁）只保留一套菜单：看得懂、用得上的入口。
// 锻造、阵法、修炼、称号、任务板这类偏数值管理的系统不再提供入口（旧存档的已有加成照常生效）。
const GROUPS = Object.freeze([
  { label: '常用', items: [
    { action: 'bag', label: '背包' },
    { action: 'shop', label: '商店' },
    { action: 'map', label: '地图', color: '#7fc48c' },
    { action: 'signin', label: '签到' }
  ] },
  { label: '成长', items: [
    { action: 'skilltree', label: '技能树', color: '#e6c878' },
    { action: 'tower', label: '挑战塔' },
    { action: 'achievement', label: '成就徽章', color: '#e6c878' }
  ] },
  { label: '伙伴与图鉴', items: [
    { action: 'npc', label: '伙伴', color: '#ff8ab8' },
    { action: 'diary', label: '冒险日记' },
    { action: 'codex', label: '万象图鉴' }
  ] },
  { label: '系统', items: [
    { action: 'save', label: '存档' },
    { action: 'help', label: '怎么玩', color: '#a78bfa' },
    { action: 'home', label: '返回主页' }
  ] }
])

const TIME_PERIODS = ['黎明', '上午', '正午', '午后', '黄昏', '夜晚', '深夜', '凌晨']
const WEATHER_TYPES = ['晴朗', '多云', '小雨', '大雨', '雷暴', '雾', '雪']

const timeWeatherText = computed(() => {
  const time = TIME_PERIODS[gameStore._gameTime % TIME_PERIODS.length] || '黎明'
  const weather = WEATHER_TYPES[gameStore._weather % WEATHER_TYPES.length] || '晴朗'
  return `${time} · ${weather}`
})

function closeAll(except = null) {
  barRef.value?.querySelectorAll('details.top-group[open]').forEach(el => {
    if (el !== except) el.open = false
  })
}

// 同一时间只展开一组菜单
function onToggle(event) {
  if (event.target.open) closeAll(event.target)
}

// 点了菜单项后收起菜单
function onAction(action) {
  closeAll()
  emit('action', action)
}

// 点菜单外面任意位置收起菜单
function onDocumentPointer(event) {
  if (barRef.value && !barRef.value.contains(event.target)) closeAll()
}
function onKeydown(event) {
  if (event.key === 'Escape') closeAll()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onKeydown)
})
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
    overscroll-behavior: contain;
  }
  .top-btn { min-height: 44px; }
}

@media (max-width: 480px) {
  .time-weather-display { display: none; }
  .top-btns { justify-content: space-between; }
}
</style>
