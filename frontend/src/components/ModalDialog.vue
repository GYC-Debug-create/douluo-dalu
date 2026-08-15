<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-mask"
        role="dialog"
        aria-modal="true"
        @click.self="onMaskClick"
      >
        <div class="modal-box" :class="panelClass">
          <div class="modal-head">
            <div class="modal-title">{{ title }}</div>
            <button v-if="closable" class="modal-close" @click="close" aria-label="关闭">×</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  closable: { type: Boolean, default: true },
  // BUG-DIALOG-004：显式可选宽版能力（例如 panel-class="is-wide"）。
  // 默认空串时行为与旧版完全一致（520px）；只有显式传入的调用方才会改变面板尺寸。
  panelClass: { type: [String, Array, Object], default: '' }
})

const emit = defineEmits(['update:modelValue', 'close'])

function close() {
  if (props.closable) {
    emit('update:modelValue', false)
    emit('close')
  }
}

function onMaskClick() {
  if (props.closable) close()
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}
.modal-box {
  width: min(520px, 92vw);
  max-height: 85vh;
  max-height: 85dvh;
  background: var(--bg2);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* BUG-DIALOG-004：宽版面板只能由调用方显式指定 panel-class="is-wide" 时启用，
   默认 .modal-box 仍为 520px，其他弹窗视觉不受影响。 */
.modal-box.is-wide {
  width: min(1100px, 94vw);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
.modal-title {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--gold);
  letter-spacing: 3px;
}
.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--ink-dim);
  font-size: 24px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}
.modal-close:hover {
  color: var(--danger);
  background: rgba(208, 106, 90, 0.1);
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
  min-height: 0;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.8;
}
.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-leave-active {
  pointer-events: none;
}
.modal-enter-active .modal-box,
.modal-leave-active .modal-box {
  transition: transform 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  transform: scale(0.9) translateY(20px);
}

@media (max-width: 600px) {
  .modal-mask {
    align-items: flex-end;
    padding-top: max(12px, env(safe-area-inset-top));
  }
  .modal-box,
  .modal-box.is-wide {
    width: 100%;
    max-height: 92dvh;
    border-radius: 12px 12px 0 0;
    border-bottom: 0;
  }
  .modal-head { padding: 12px 14px; }
  .modal-title { font-size: 18px; letter-spacing: 2px; }
  .modal-close { width: 44px; height: 44px; }
  .modal-body { padding: 14px; font-size: 14px; line-height: 1.7; }
  .modal-footer {
    padding: 10px 14px max(10px, env(safe-area-inset-bottom));
    flex-wrap: wrap;
  }
  .modal-footer :deep(button) { flex: 1 1 120px; min-height: 44px; }
}
</style>
