<template>
  <button
    type="button"
    class="location-marker"
    :class="markerClasses"
    :style="markerStyle"
    :title="known ? location.name : '未探明区域'"
    :aria-label="known ? `查看${location.name}详情` : '查看未探明区域'"
    @click="$emit('select', location.id)"
  >
    <span class="marker-hitarea" aria-hidden="true"></span>
    <span class="marker-focus" aria-hidden="true"></span>
    <span class="marker-standard" aria-hidden="true">
      <MapLandmarkIcon class="marker-icon" :type="known ? location.landmarkType : 'site'" />
    </span>
    <span v-if="known || selected" class="marker-label" :class="`label-${location.labelPosition || 'below'}`">
      {{ known ? location.name : '未探明' }}
    </span>
    <span v-if="location.current" class="marker-status current-status" :class="statusSide">当前</span>
    <span v-else-if="location.nextHop" class="marker-status next-status" :class="statusSide">下一站</span>
    <span v-else-if="location.objective" class="marker-status objective-status" :class="statusSide">猎魂目标</span>
    <span v-else-if="location.explorationInProgress" class="marker-status exploration-status" :class="statusSide">
      {{ location.explorationActive ? '进行中' : '已暂停' }}
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import MapLandmarkIcon from './MapLandmarkIcon.vue'

const props = defineProps({
  location: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

defineEmits(['select'])

const known = computed(() => props.location.known !== false)
// 状态标签放在地名的另一侧，避免"史莱[当前]克学院"这样压住地名。
const statusSide = computed(() => (props.location.labelPosition === 'above' ? 'status-below' : 'status-above'))
const markerStyle = computed(() => ({
  left: `${props.location.mapX}%`,
  top: `${props.location.mapY}%`,
  '--marker-accent': props.location.region === 'sea' ? '#64b7bd' : props.location.objective ? '#e5bd59' : '#b89543'
}))
const markerClasses = computed(() => ({
  selected: props.selected,
  fogged: !known.value,
  current: props.location.current,
  adjacent: props.location.adjacent,
  visited: props.location.visited,
  objective: props.location.objective,
  recommended: props.location.recommended,
  'next-hop': props.location.nextHop,
  'minor-landmark': props.location.landmarkType === 'clan',
  'level-locked': !props.location.known && !props.location.adjacent,
  'exploration-active': props.location.explorationActive,
  'exploration-suspended': props.location.explorationInProgress && !props.location.explorationActive
}))
</script>

<style scoped>
.location-marker {
  position: absolute;
  z-index: 5;
  width: 42px;
  height: 50px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #5a3515;
  transform: translate(-50%, -58%);
  transition: filter 0.18s ease, transform 0.18s ease;
}
.marker-hitarea { position: absolute; inset: -10px -14px; }
.marker-focus {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 42px;
  height: 12px;
  border: 1px solid transparent;
  border-radius: 50%;
  background: rgba(38, 22, 8, 0.25);
  transform: translateX(-50%);
  transition: all 0.18s ease;
}
.marker-standard {
  position: absolute;
  inset: 0 4px 9px;
  display: grid;
  place-items: center;
  padding: 6px;
  color: var(--marker-accent);
  background: linear-gradient(145deg, rgba(45, 29, 11, 0.92), rgba(15, 10, 4, 0.94));
  border: 1px solid rgba(226, 199, 121, 0.72);
  border-radius: 4px 4px 11px 11px;
  clip-path: polygon(14% 0, 86% 0, 100% 14%, 91% 86%, 50% 100%, 9% 86%, 0 14%);
  box-shadow: 0 5px 10px rgba(24, 14, 5, 0.5), inset 0 0 10px rgba(210, 166, 73, 0.14);
}
.marker-icon { width: 27px; height: 27px; }
.marker-label {
  position: absolute;
  z-index: 2;
  width: max-content;
  max-width: 118px;
  padding: 3px 7px;
  border: 1px solid rgba(103, 70, 30, 0.64);
  border-radius: 2px;
  background: rgba(28, 17, 6, 0.88);
  color: #f0ddb0;
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0.5px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0,0,0,.38);
  pointer-events: none;
}
.label-below { left: 50%; top: calc(100% + 2px); transform: translateX(-50%); }
.label-above { left: 50%; bottom: calc(100% + 1px); transform: translateX(-50%); }
.label-left { right: calc(100% + 3px); top: 43%; transform: translateY(-50%); }
.label-right { left: calc(100% + 3px); top: 43%; transform: translateY(-50%); }
.marker-status.status-above { bottom: calc(100% + 4px); }
.marker-status.status-below { top: calc(100% + 4px); }
.marker-status {
  position: absolute;
  z-index: 3;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 5px;
  border: 1px solid currentColor;
  border-radius: 2px;
  background: rgba(18, 11, 4, 0.94);
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
}
.current-status { color: #8fd09a; }
.next-status, .objective-status { color: #ffe39a; }
.exploration-status { color: #d4b765; }
.location-marker:hover,
.location-marker:focus-visible,
.location-marker.selected { z-index: 20; filter: brightness(1.22); transform: translate(-50%, -62%); }
.location-marker:hover .marker-focus,
.location-marker:focus-visible .marker-focus,
.location-marker.selected .marker-focus { border-color: var(--marker-accent); background: rgba(213, 178, 83, 0.22); box-shadow: 0 0 12px var(--marker-accent); }
.location-marker.current .marker-standard { border-color: #8fd09a; box-shadow: 0 0 0 2px rgba(65, 135, 78, .45), 0 0 18px rgba(90, 174, 110, .55); }
.location-marker.objective .marker-standard,
.location-marker.next-hop .marker-standard { border-color: #ffe39a; box-shadow: 0 0 0 2px rgba(182, 132, 37, .48), 0 0 22px rgba(224, 179, 74, .68); }
.location-marker.fogged { opacity: .48; filter: grayscale(.75); }
.location-marker.fogged .marker-label { color: #9f9277; }
.location-marker.minor-landmark .marker-standard { inset: 6px 8px 12px; }
.location-marker.minor-landmark .marker-label { opacity: 0; }
.location-marker.minor-landmark:hover .marker-label,
.location-marker.minor-landmark:focus-visible .marker-label,
.location-marker.minor-landmark.selected .marker-label { opacity: 1; }
@media (max-width: 700px) {
  .location-marker { width: 44px; height: 44px; }
  .marker-icon { width: 22px; height: 22px; }
  .marker-label { max-width: 95px; padding: 2px 5px; font-size: 9px; }
  .location-marker:not(.current):not(.objective):not(.next-hop):not(.selected) .marker-label { opacity: 0; }
  .location-marker:hover .marker-label,
  .location-marker:focus-visible .marker-label { opacity: 1 !important; }
}
@media (prefers-reduced-motion: reduce) {
  .location-marker, .marker-focus { transition: none; }
}
</style>
