<template>
  <section class="world-map" aria-label="斗罗大陆万象地图">
    <div id="objectiveBanner" v-if="mapState.objective" class="objective-banner">
      <span class="objective-seal">魂</span>
      <div>
        <strong>第{{ mapState.objective.ordinal }}魂环目标：{{ mapState.objectiveLocationName }}</strong>
        <p>{{ objectiveRouteNames.join(' → ') }}　·　下一站：{{ nextHopName || mapState.objectiveLocationName }}</p>
      </div>
    </div>

    <div id="mapStateTip" class="map-state-tip">
      <span>当前位置：{{ currentName || '尚未定位' }}</span>
      <span>金币：{{ mapState.gold || 0 }}</span>
      <span>{{ nextHopName ? `任务下一站：${nextHopName}` : '选择地标查看当地行动' }}</span>
    </div>

    <div class="map-viewport">
      <div class="map-board-shell" :style="{ '--map-zoom': zoom }">
        <div class="map-board">
          <img class="map-parchment" src="/assets/map_bg_v2.webp" alt="斗罗大陆地形图" draggable="false" />
          <div class="map-ink-wash" aria-hidden="true"></div>
          <MapRouteLayer :locations="mapState.locations" :route-ids="mapState.routeIds" />
          <MapLocationMarker
            v-for="location in mapState.locations"
            :key="location.id"
            :location="location"
            :selected="selectedId === location.id"
            @select="selectLocation"
          />
        </div>
      </div>

      <MapDetailPanel
        v-if="selectedLocation"
        :location="selectedLocation"
        :player-level="mapState.level"
        :player-gold="mapState.gold"
        :busy="busy"
        @close="selectedId = ''"
        @travel="$emit('travel', $event)"
        @glimpse="$emit('glimpse', $event)"
      />

      <div class="map-controls" aria-label="地图缩放">
        <button type="button" aria-label="放大地图" @click="changeZoom(0.12)">＋</button>
        <button type="button" aria-label="缩小地图" @click="changeZoom(-0.12)">－</button>
        <button type="button" aria-label="复原地图" @click="zoom = 1">归</button>
      </div>

      <div class="map-legend" aria-label="地图图例">
        <span><i class="legend-landmark"></i>地标</span>
        <span><i class="legend-land"></i>陆路</span>
        <span><i class="legend-sea"></i>海路</span>
        <span><i class="legend-objective"></i>任务路线</span>
      </div>

      <button id="rumorToggle" class="rumor-toggle" type="button" @click="rumorOpen = true">
        秘境传闻 {{ discoveredRumors }}/{{ mapState.hiddenClues?.length || 0 }}
      </button>
      <aside id="rumorPanel" class="rumor-panel" :class="{ open: rumorOpen }" aria-label="秘境传闻">
        <div class="rumor-head">
          <div><strong>秘境传闻</strong><span>已发现 {{ discoveredRumors }}/{{ mapState.hiddenClues?.length || 0 }}</span></div>
          <button id="rumorClose" type="button" aria-label="关闭秘境传闻" @click="rumorOpen = false">×</button>
        </div>
        <div class="rumor-list">
          <article v-for="clue in mapState.hiddenClues || []" :key="clue.id" class="rumor-card">
            <header><strong>{{ clue.name }}</strong><span>{{ clue.statusLabel }}</span></header>
            <p>{{ clue.clue }}</p>
            <ul><li v-for="progress in clue.progress" :key="progress.label" :class="{ done: progress.done }">{{ progress.label }}</li></ul>
            <footer>下一步：{{ clue.nextStep }}</footer>
          </article>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import MapDetailPanel from './MapDetailPanel.vue'
import MapLocationMarker from './MapLocationMarker.vue'
import MapRouteLayer from './MapRouteLayer.vue'

const props = defineProps({
  mapState: { type: Object, required: true },
  focusId: { type: String, default: '' },
  busy: { type: Boolean, default: false }
})

defineEmits(['travel', 'glimpse'])

const selectedId = ref('')
const rumorOpen = ref(false)
const zoom = ref(1)
const locationsById = computed(() => new Map((props.mapState.locations || []).map(location => [location.id, location])))
const selectedLocation = computed(() => locationsById.value.get(selectedId.value) || null)
const currentName = computed(() => locationsById.value.get(props.mapState.currentId)?.name || '')
const nextHopName = computed(() => locationsById.value.get(props.mapState.nextHopId)?.name || '')
const objectiveRouteNames = computed(() => (props.mapState.routeIds || []).map(id => locationsById.value.get(id)?.name || id))
const discoveredRumors = computed(() => (props.mapState.hiddenClues || []).filter(clue => clue.discovered).length)

function selectLocation(id) {
  selectedId.value = id
}

function changeZoom(delta) {
  zoom.value = Math.min(1.48, Math.max(0.84, Number((zoom.value + delta).toFixed(2))))
}

watch(
  () => [props.focusId, props.mapState.currentId, props.mapState.locations?.length],
  () => {
    if (props.focusId && locationsById.value.has(props.focusId)) {
      selectedId.value = props.focusId
    } else if (selectedId.value && !locationsById.value.has(selectedId.value)) {
      selectedId.value = ''
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.world-map { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 7px; padding: 8px 12px 12px; overflow: hidden; background: radial-gradient(circle at 50% 35%, rgba(62,43,17,.42), transparent 52%); }
.objective-banner { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 7px 14px; border: 1px solid rgba(201,168,76,.64); border-left: 4px solid var(--gold); background: linear-gradient(90deg, rgba(64,47,20,.85), rgba(25,18,8,.75)); }
.objective-seal { display: grid; place-items: center; flex: 0 0 30px; width: 30px; height: 30px; border: 1px solid var(--gold); color: var(--gold-hi); transform: rotate(45deg); }
.objective-banner strong { color: var(--gold-hi); font-size: 13px; letter-spacing: 1px; }
.objective-banner p { margin-top: 2px; color: var(--ink-dim); font-size: 11px; }
.map-state-tip { display: flex; justify-content: center; gap: 22px; color: var(--ink-dim); font-size: 11px; letter-spacing: .5px; }
.map-viewport { position: relative; display: grid; place-items: center; flex: 1; min-height: 0; overflow: hidden; border: 1px solid rgba(201,168,76,.38); border-radius: 6px; background: #080603; box-shadow: inset 0 0 70px rgba(0,0,0,.84); }
.map-board-shell { position: relative; width: min(100%, calc((100vh - 150px) * 1.7778)); aspect-ratio: 16 / 9; transform: scale(var(--map-zoom)); transition: transform .25s ease; }
.map-board { position: absolute; inset: 0; overflow: visible; }
.map-parchment { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; filter: saturate(.92) contrast(1.02) brightness(.88); user-select: none; }
.map-ink-wash { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 42%, rgba(35,20,7,.22) 78%, rgba(11,7,3,.5)), linear-gradient(rgba(229,197,122,.05), rgba(44,28,9,.08)); pointer-events: none; }
.map-controls { position: absolute; right: 12px; bottom: 12px; z-index: 30; display: grid; gap: 5px; }
.map-controls button { width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 50%; background: rgba(27,20,9,.92); color: var(--gold); }
.map-controls button:hover { border-color: var(--gold); color: var(--gold-hi); }
.map-legend { position: absolute; left: 12px; bottom: 12px; z-index: 22; display: flex; flex-wrap: wrap; gap: 10px; max-width: calc(100% - 65px); padding: 7px 10px; border: 1px solid rgba(105,78,35,.74); border-radius: 3px; background: rgba(22,14,5,.88); color: var(--ink-dim); font-size: 9px; }
.map-legend span { display: flex; align-items: center; gap: 5px; }
.map-legend i { display: inline-block; width: 18px; height: 3px; }
.legend-landmark { width: 8px !important; height: 11px !important; border: 1px solid var(--gold); background: #35230f; clip-path: polygon(50% 0,100% 30%,85% 100%,15% 100%,0 30%); }
.legend-land { border-top: 2px dashed #84623c; }
.legend-sea { border-top: 2px dotted #6abdc2; }
.legend-objective { border-top: 3px dashed #ffe39a; }
.rumor-toggle { position: absolute; z-index: 25; left: 12px; top: 12px; padding: 7px 11px; border: 1px solid var(--gold-dim); border-radius: 3px; background: rgba(29,20,8,.92); color: var(--gold-hi); font-size: 11px; letter-spacing: 1px; }
.rumor-panel { position: absolute; z-index: 45; top: 10px; left: 10px; width: min(420px, calc(100% - 20px)); max-height: calc(100% - 20px); display: none; flex-direction: column; overflow: hidden; border: 1px solid var(--gold); border-radius: 5px; background: rgba(22,15,7,.98); box-shadow: 0 18px 50px rgba(0,0,0,.62); }
.rumor-panel.open { display: flex; }
.rumor-head { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; border-bottom: 1px solid var(--line); }
.rumor-head strong { color: var(--gold-hi); letter-spacing: 2px; }
.rumor-head span { margin-left: 10px; color: var(--ink-dim); font-size: 10px; }
.rumor-head button { width: 28px; height: 28px; border: 0; background: transparent; color: var(--ink-dim); font-size: 22px; }
.rumor-list { overflow-y: auto; overscroll-behavior: contain; padding: 9px; }
.rumor-card { margin-bottom: 8px; padding: 9px 10px; border: 1px solid rgba(101,75,34,.72); background: rgba(201,168,76,.035); }
.rumor-card header { display: flex; justify-content: space-between; gap: 8px; }
.rumor-card header strong { color: var(--ink); font-size: 12px; }
.rumor-card header span { color: var(--gold); font-size: 10px; }
.rumor-card p, .rumor-card footer { margin-top: 5px; color: var(--ink-dim); font-size: 10px; line-height: 1.5; }
.rumor-card ul { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; list-style: none; }
.rumor-card li { padding: 2px 5px; border: 1px solid var(--line); color: var(--ink-faint); font-size: 9px; }
.rumor-card li.done { border-color: rgba(83,145,94,.65); color: #9bd1a4; }
@media (max-width: 700px) {
  .world-map { padding: 6px; gap: 5px; }
  .objective-banner { min-height: 42px; padding: 5px 8px; }
  .objective-banner p { max-width: 285px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .map-state-tip { justify-content: flex-start; gap: 10px; overflow: hidden; white-space: nowrap; }
  .map-state-tip span:nth-child(2) { display: none; }
  .map-board-shell { width: 100%; }
  .map-legend { display: none; }
  .rumor-toggle { top: 6px; left: 6px; padding: 5px 7px; font-size: 9px; }
  .map-controls { right: 7px; bottom: 7px; }
  .map-controls button { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .map-board-shell { transition: none; } }
</style>
