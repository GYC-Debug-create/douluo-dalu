<template>
  <aside id="detailPanel" class="detail-panel open" aria-live="polite">
    <button class="panel-close" type="button" aria-label="关闭地点详情" @click="$emit('close')">×</button>
    <div class="panel-eyebrow">{{ regionLabel }}</div>
    <h2 id="panelTitle">{{ location.name }}</h2>
    <p class="panel-desc">{{ location.description || '此地的传闻仍待进一步查证。' }}</p>

    <div class="panel-state-row">
      <span v-if="location.current" class="state-chip current">当前位置</span>
      <span v-else-if="location.visited" class="state-chip visited">已访问</span>
      <span v-else-if="location.adjacent" class="state-chip adjacent">相邻可达</span>
      <span v-else class="state-chip">尚未踏足</span>
      <span v-if="location.explorationInProgress" class="state-chip exploration">
        {{ location.explorationModeLabel }} {{ location.explorationCompletedStages }}/{{ location.explorationStageCount }}
      </span>
    </div>

    <div v-if="location.known !== false" class="destination-plan" data-testid="destination-plan">
      <h3>抵达后可做</h3>
      <dl>
        <div><dt>首要目标</dt><dd>{{ location.destinationPlan?.primary }}</dd></div>
        <div><dt>武魂适配</dt><dd>{{ location.destinationPlan?.fit }}</dd></div>
        <div><dt>人物线索</dt><dd>{{ location.destinationPlan?.contact }}</dd></div>
        <div><dt>区域评估</dt><dd>{{ location.destinationPlan?.risk }}</dd></div>
      </dl>
    </div>

    <div class="panel-route-meta">
      <template v-if="location.current">你已经在这里，可返回游戏直接处理当地行动。</template>
      <template v-else-if="travelAllowed">
        {{ useFast ? `已访问地点可快速旅行，路程压缩至约${location.fastDays}天` : '首次抵达需沿相邻路线前往' }}；遭遇率约{{ useFast ? location.fastEncounterPercent : location.normalEncounterPercent }}%；抵达后会生成当地行动。
      </template>
      <template v-else>{{ blockedReason }}</template>
    </div>

    <button
      id="panel-travel"
      type="button"
      class="travel-button"
      :disabled="!travelAllowed || busy"
      @click="$emit('travel', { locationId: location.id, fast: useFast })"
    >
      <span>{{ travelLabel }}</span>
      <small v-if="travelAllowed">{{ travelCost }}金币 · 约{{ travelDays }}天</small>
    </button>
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  location: { type: Object, required: true },
  playerLevel: { type: Number, default: 1 },
  playerGold: { type: Number, default: 0 },
  busy: { type: Boolean, default: false }
})

defineEmits(['close', 'travel'])

const regionNames = {
  shrek: '史莱克领地', star_duo: '星斗森林', wuhun: '武魂帝国', tian_dou: '天斗帝国',
  sea: '东方海域', ice: '极北冰原', slaughter: '杀戮之地', ancient: '远古遗境',
  abyss: '深渊之地', sky: '天空领域', element: '元素领域', desert: '南境荒漠',
  valley: '灵药山谷', swamp: '暗影湿地', dragon: '龙族领地', evil: '邪魔之地'
}
const regionLabel = computed(() => regionNames[props.location.region] || '斗罗大陆')
const useFast = computed(() => Boolean(props.location.visited && !props.location.current))
const travelAllowed = computed(() => Boolean(
  !props.location.current &&
  props.location.known !== false &&
  props.playerLevel >= props.location.unlockedLevel &&
  (props.location.adjacent || props.location.visited) &&
  props.playerGold >= travelCost.value
))
const travelCost = computed(() => useFast.value ? props.location.fastCost : props.location.normalCost)
const travelDays = computed(() => useFast.value ? props.location.fastDays : props.location.normalDays)
const blockedReason = computed(() => {
  if (props.location.known === false) return '需要先从相邻地点推进路线，才能确认此地。'
  if (props.playerLevel < props.location.unlockedLevel) return `需要达到 Lv.${props.location.unlockedLevel} 才能前往。`
  if (!props.location.adjacent && !props.location.visited) return '只能先探索与当前位置相邻的地点。'
  if (props.playerGold < travelCost.value) return `旅行需要 ${travelCost.value} 金币，当前金币不足。`
  return '当前无法前往。'
})
const travelLabel = computed(() => {
  if (props.busy) return '正在结算旅程…'
  if (props.location.current) return '当前所在地点'
  if (!travelAllowed.value) return blockedReason.value
  return useFast.value ? `快速旅行至${props.location.name}` : `前往${props.location.name}`
})
</script>

<style scoped>
.detail-panel {
  position: absolute;
  z-index: 40;
  top: 18px;
  right: 18px;
  width: min(355px, calc(100% - 36px));
  max-height: calc(100% - 36px);
  overflow-y: auto;
  padding: 18px;
  border: 1px solid rgba(201, 168, 76, .74);
  border-top: 3px solid var(--gold);
  border-radius: 5px;
  background: linear-gradient(145deg, rgba(39, 29, 13, .97), rgba(14, 10, 5, .98));
  color: var(--ink);
  box-shadow: 0 18px 50px rgba(0,0,0,.62), inset 0 0 40px rgba(198,153,55,.06);
}
.panel-close { position: absolute; top: 8px; right: 9px; width: 30px; height: 30px; border: 0; background: transparent; color: var(--ink-dim); font-size: 23px; }
.panel-close:hover { color: var(--gold-hi); }
.panel-eyebrow { color: var(--gold-dim); font-size: 10px; letter-spacing: 3px; }
h2 { margin: 5px 34px 9px 0; color: var(--gold-hi); font-family: var(--font-display); font-size: 24px; letter-spacing: 2px; }
.panel-desc { color: var(--ink-dim); font-size: 12px; line-height: 1.65; }
.panel-state-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.state-chip { padding: 3px 7px; border: 1px solid var(--line); border-radius: 2px; color: var(--ink-dim); font-size: 10px; }
.state-chip.current { border-color: var(--ok); color: #aee2b6; }
.state-chip.visited, .state-chip.adjacent { border-color: var(--gold-dim); color: var(--gold-hi); }
.state-chip.exploration { border-color: #8d6fbb; color: #c9b0ec; }
.destination-plan { padding: 12px; border: 1px solid rgba(126, 99, 47, .58); background: rgba(201,168,76,.055); }
.destination-plan h3 { margin-bottom: 8px; color: var(--gold); font-size: 12px; letter-spacing: 2px; }
.destination-plan dl { display: grid; gap: 6px; }
.destination-plan dl div { display: grid; grid-template-columns: 64px 1fr; gap: 8px; font-size: 11px; line-height: 1.45; }
.destination-plan dt { color: var(--ink-faint); }
.destination-plan dd { color: var(--ink); }
.panel-route-meta { margin: 11px 0; color: var(--ink-dim); font-size: 11px; line-height: 1.6; }
.travel-button { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 43px; padding: 9px 12px; border: 1px solid var(--gold); border-radius: 3px; background: linear-gradient(180deg, #463619, #2a1e0c); color: var(--gold-hi); text-align: left; }
.travel-button small { color: var(--ink-dim); font-size: 10px; white-space: nowrap; }
.travel-button:disabled { border-color: var(--line); color: var(--ink-faint); cursor: not-allowed; }
@media (max-width: 700px) {
  .detail-panel { top: auto; right: 8px; bottom: 8px; width: calc(100% - 16px); max-height: 47%; padding: 13px; }
  h2 { font-size: 20px; }
  .panel-desc { display: none; }
  .destination-plan { padding: 8px; }
  .destination-plan dl { grid-template-columns: 1fr 1fr; }
  .destination-plan dl div { display: block; }
  .destination-plan dt { margin-bottom: 2px; }
}
</style>
