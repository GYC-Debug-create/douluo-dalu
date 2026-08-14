<template>
  <svg class="landmark-icon" viewBox="0 0 48 48" aria-hidden="true">
    <g v-if="type === 'academy'">
      <path d="M7 21 24 9l17 12-4 2v15H11V23z" />
      <path d="M17 38V25h14v13M21 25v13M27 25v13" class="cut" />
    </g>
    <g v-else-if="type === 'capital' || type === 'city'">
      <path d="M6 39h36M10 39V19l7-5 7 5 7-5 7 5v20M17 14V8h7v11M31 14V7h6v12" />
      <path d="M20 39V27h8v12" class="cut" />
    </g>
    <g v-else-if="type === 'forest' || type === 'ice' || type === 'swamp'">
      <path d="m24 6-9 13h5L11 32h10v9h6v-9h10l-9-13h5z" />
      <path v-if="type === 'ice'" d="M8 10l5 5m-5 0 5-5m22 22 5 5m-5 0 5-5" class="detail" />
      <path v-if="type === 'swamp'" d="M7 40c8-4 13 4 20 0s10 1 14-1" class="detail" />
    </g>
    <g v-else-if="type === 'port'">
      <path d="M24 7v31M14 17h20M10 29c2 8 7 12 14 12s12-4 14-12l-7 4-7-5-7 5z" />
      <circle cx="24" cy="11" r="3" class="cut" />
    </g>
    <g v-else-if="type === 'island'">
      <path d="M7 38c5-4 10 3 16-1s10 2 18-2M10 42c6-3 10 2 16-1s9 1 14-1" class="detail" />
      <path d="M18 35c1-9 5-15 13-22M29 14c5 0 9 2 11 6-5 1-9 0-12-3M30 14c-3-5-7-7-12-7 0 5 3 8 8 10" />
    </g>
    <g v-else-if="type === 'mountain' || type === 'sect'">
      <path d="M5 39 18 15l6 10 7-12 12 26z" />
      <path v-if="type === 'sect'" d="M13 39v-8h22v8M17 31l7-6 7 6" class="cut" />
    </g>
    <g v-else-if="type === 'temple'">
      <path d="M8 38h32M11 34h26M14 18h20v16H14zM10 18 24 8l14 10M20 34V23h8v11" />
    </g>
    <g v-else-if="type === 'ruins'">
      <path d="M7 39h34M11 35h26M13 16h22M10 16 24 8l14 8M16 16v19M24 16v19M32 16v19" />
      <path d="m18 25 4-5 3 6 4-4" class="cut" />
    </g>
    <g v-else-if="type === 'abyss' || type === 'forbidden'">
      <path d="M8 10c7 5 11 2 16 6s8 1 16 7M12 38l7-11 5 7 5-16 7 20z" />
      <path v-if="type === 'forbidden'" d="M13 13 35 35M35 13 13 35" class="detail" />
    </g>
    <g v-else-if="type === 'sky'">
      <path d="M8 33c-3-7 3-13 10-11 2-8 15-9 18 0 9 0 10 12 2 14H11c-2 0-3-1-3-3z" />
      <path d="M17 28h14v9H17zM21 21h6v7" class="cut" />
    </g>
    <g v-else-if="type === 'desert'">
      <path d="M6 37c7-11 13-4 19-12 5-7 11-2 17 12z" />
      <path d="M31 23V9M27 13h8M28 18h6" class="detail" />
    </g>
    <g v-else-if="type === 'valley'">
      <path d="M7 38 18 16l6 14 7-16 10 24z" />
      <path d="M24 39c-2-8 0-14 5-19M28 25c4-1 7 0 9 3M27 30c-4-1-7 1-9 4" class="detail" />
    </g>
    <g v-else-if="type === 'village'">
      <path d="M8 39h32M12 39V23l12-9 12 9v16M20 39V28h8v11M30 13V7h4v10" />
    </g>
    <g v-else-if="type === 'clan'">
      <path d="M10 40V10l14 6 14-6v30M10 26l14 6 14-6" />
      <path d="M24 16v16" class="cut" />
    </g>
    <g v-else>
      <path d="M24 6 38 17l-5 18-9 7-9-7-5-18z" />
      <circle cx="24" cy="23" r="5" class="cut" />
    </g>
  </svg>
</template>

<script setup>
defineProps({ type: { type: String, default: 'site' } })
</script>

<style scoped>
.landmark-icon {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cut { fill: none; stroke: var(--map-icon-cut, #20170b); stroke-width: 2; }
.detail { fill: none; stroke-width: 2.2; }
</style>
