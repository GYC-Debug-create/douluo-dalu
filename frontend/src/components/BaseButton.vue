<template>
  <button
    :class="['btn', variantClass, sizeClass]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'normal' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['click'])

const variantClass = computed(() => ({
  default: '',
  gold: 'btn-gold',
  danger: 'btn-danger',
  ghost: 'btn-ghost'
}[props.variant] || ''))

const sizeClass = computed(() => ({
  normal: '',
  big: 'btn-big',
  small: 'btn-small'
}[props.size] || ''))
</script>

<style scoped>
.btn {
  display: inline-block;
  min-height: 48px;
  padding: 12px 30px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: linear-gradient(180deg, #33291a, #241c0e);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 17px;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.25s;
}
.btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-hi);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.btn:disabled {
  opacity: 0.5;
  color: #8f8778;
  border-color: #4a4438;
  background: #26231d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.btn-gold {
  border-color: var(--gold);
  color: var(--gold-hi);
}
.btn-gold:hover:not(:disabled) {
  box-shadow: 0 4px 18px rgba(201, 168, 76, 0.3);
}
.btn-danger {
  border-color: var(--danger);
  color: var(--danger);
}
.btn-ghost {
  background: transparent;
  border-color: transparent;
}
.btn-ghost:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.08);
}
.btn-big {
  font-size: 20px;
  padding: 16px 44px;
  letter-spacing: 4px;
}
.btn-small {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 13px;
  letter-spacing: 1px;
}
</style>
