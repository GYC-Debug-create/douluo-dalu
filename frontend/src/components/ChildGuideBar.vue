<template>
  <section class="child-guide" aria-live="polite" data-testid="child-guide">
    <span class="child-guide-icon" aria-hidden="true">{{ guide.icon }}</span>
    <strong>{{ guide.text }}</strong>
    <button
      v-if="guide.action"
      type="button"
      class="child-guide-button"
      :data-guide-action="guide.action"
      @click="$emit('action', guide.action)"
    >
      {{ guide.button }} <span aria-hidden="true">→</span>
    </button>
  </section>
</template>

<script setup>
defineProps({
  guide: {
    type: Object,
    default: () => ({ icon: '➜', text: '下一步：去探索。', action: 'explore', button: '去探索' })
  }
})

defineEmits(['action'])
</script>

<style scoped>
.child-guide {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin: 10px 14px 0;
  padding: 11px 12px;
  border: 2px solid #e3b94f;
  border-radius: 12px;
  background: linear-gradient(110deg, rgba(83, 55, 12, 0.96), rgba(36, 28, 13, 0.96));
  box-shadow: 0 0 22px rgba(227, 185, 79, 0.22);
  color: #fff4c6;
}
.child-guide-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f0c75e;
  color: #2b1c06;
  font-size: 20px;
  font-weight: 900;
}
.child-guide strong { font-size: 16px; line-height: 1.45; }
.child-guide-button {
  min-height: 44px;
  padding: 9px 18px;
  border: 0;
  border-radius: 10px;
  background: #f0c75e;
  color: #241704;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}
.child-guide-button:hover,
.child-guide-button:focus-visible { background: #ffe28b; transform: translateY(-1px); }
@media (max-width: 700px) {
  .child-guide { grid-template-columns: auto minmax(0, 1fr); margin: 8px 8px 0; }
  .child-guide-button { grid-column: 1 / -1; width: 100%; }
}
</style>
