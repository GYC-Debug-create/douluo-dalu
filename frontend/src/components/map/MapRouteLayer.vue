<template>
  <svg class="route-layer" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <filter id="routeGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <marker id="objectiveArrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
        <path d="M0 0 10 5 0 10z" fill="#ffe39a" />
      </marker>
      <linearGradient id="seaRoute" x1="0" x2="1">
        <stop offset="0" stop-color="#69b9bf" />
        <stop offset="1" stop-color="#b9e7e1" />
      </linearGradient>
    </defs>

    <g class="region-washes">
      <path class="region-wash north" d="M310 70C490 20 850 25 1040 155L980 300 620 270 370 315 220 210Z" />
      <path class="region-wash heartland" d="M250 270C470 210 870 235 1140 330L1070 610 710 650 360 570 190 420Z" />
      <path class="region-wash south" d="M180 520C440 555 820 570 1110 510L1250 795 690 850 225 760Z" />
      <path class="region-wash sea" d="M1030 185C1260 180 1480 235 1540 390L1490 735 1185 730 1070 565Z" />
      <text class="region-name" x="530" y="125">北境群山</text>
      <text class="region-name" x="650" y="415">大陆腹地</text>
      <text class="region-name" x="570" y="748">南境荒原</text>
      <text class="region-name sea-name" x="1260" y="430">东方海域</text>
    </g>

    <g class="route-network">
      <path
        v-for="edge in edges"
        :key="edge.key"
        :d="edge.path"
        class="world-route"
        :class="edge.sea ? 'sea-route' : 'land-route'"
      />
    </g>

    <g v-if="objectivePath" class="objective-route" filter="url(#routeGlow)">
      <polyline class="objective-route-shadow" :points="objectivePath" />
      <polyline class="objective-route-line" :points="objectivePath" marker-end="url(#objectiveArrow)" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  locations: { type: Array, default: () => [] },
  routeIds: { type: Array, default: () => [] }
})

const byId = computed(() => new Map(props.locations.map(location => [location.id, location])))

function point(location) {
  return { x: Number(location?.mapX || 50) * 16, y: Number(location?.mapY || 50) * 9 }
}

const edges = computed(() => {
  const seen = new Set()
  const result = []
  for (const location of props.locations) {
    for (const targetId of location.connectedTo || []) {
      const target = byId.value.get(targetId)
      if (!target) continue
      const key = [location.id, target.id].sort().join('::')
      if (seen.has(key)) continue
      seen.add(key)
      const start = point(location)
      const end = point(target)
      const dx = end.x - start.x
      const dy = end.y - start.y
      const curve = Math.min(42, Math.max(12, Math.hypot(dx, dy) * 0.06))
      const cx = (start.x + end.x) / 2 - Math.sign(dy || 1) * curve
      const cy = (start.y + end.y) / 2 + Math.sign(dx || 1) * curve
      result.push({
        key,
        sea: location.region === 'sea' && target.region === 'sea',
        path: `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`
      })
    }
  }
  return result
})

const objectivePath = computed(() => props.routeIds
  .map(id => byId.value.get(id))
  .filter(Boolean)
  .map(location => {
    const p = point(location)
    return `${p.x},${p.y}`
  })
  .join(' '))
</script>

<style scoped>
.route-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.region-wash { fill: rgba(157, 108, 44, 0.08); stroke: rgba(122, 83, 32, 0.26); stroke-width: 2; stroke-dasharray: 12 16; }
.region-wash.north { fill: rgba(134, 166, 172, 0.08); }
.region-wash.south { fill: rgba(161, 90, 35, 0.08); }
.region-wash.sea { fill: rgba(47, 133, 143, 0.13); stroke: rgba(80, 173, 178, 0.38); }
.region-name { fill: rgba(87, 57, 23, 0.55); font-size: 27px; letter-spacing: 10px; font-family: var(--font-display); }
.sea-name { fill: rgba(21, 91, 102, 0.58); }
.world-route { fill: none; stroke-linecap: round; }
.land-route { stroke: rgba(99, 65, 31, 0.53); stroke-width: 4; stroke-dasharray: 4 13; }
.sea-route { stroke: url(#seaRoute); stroke-width: 5; stroke-dasharray: 2 15; }
.objective-route-shadow { fill: none; stroke: rgba(42, 24, 7, 0.82); stroke-width: 14; stroke-linecap: round; stroke-linejoin: round; }
.objective-route-line { fill: none; stroke: #ffe39a; stroke-width: 6; stroke-dasharray: 14 9; stroke-linecap: round; stroke-linejoin: round; }
</style>
