<template>
  <div class="bar-row">
    <div class="bar-label">
      <span>{{ label }}</span>
      <span>{{ displayValue }}</span>
    </div>
    <div class="bar">
      <div class="bar-fill" :class="type" :style="{ width: percentage + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  type: { type: String, default: 'exp' },
  current: { type: Number, default: 0 },
  max: { type: Number, default: 100 }
})

const percentage = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.current / props.max) * 100))
})

const displayValue = computed(() => {
  return `${Math.round(props.current)} / ${Math.round(props.max)}`
})
</script>

<style scoped>
.bar-row {
  margin-bottom: 4px;
}
.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--ink-dim);
  margin-bottom: 4px;
  letter-spacing: 1px;
}
.bar {
  height: 14px;
  background: #14100a;
  border: 1px solid var(--line);
  border-radius: 7px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 7px;
  transition: width 0.4s ease;
}
.bar-fill.hp {
  background: linear-gradient(90deg, #3f7a4c, var(--hp));
}
.bar-fill.mp {
  background: linear-gradient(90deg, #3a6491, var(--mp));
}
.bar-fill.exp {
  background: linear-gradient(90deg, #96762e, var(--exp));
}
</style>
