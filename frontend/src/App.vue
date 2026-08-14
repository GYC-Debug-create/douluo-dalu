<template>
  <router-view v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </router-view>

  <!-- 全屏闪烁覆盖层 -->
  <div
    class="fx-flash-overlay"
    :style="{ background: flashColor, opacity: flashOpacity }"
  ></div>
</template>

<script setup>
import { useVisualFX } from '@/composables/useVisualFX'

const { flashColor, flashOpacity } = useVisualFX()
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

/* 页面过渡 */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 全屏闪烁覆盖层 */
.fx-flash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  transition: opacity 0.15s ease-out;
}

/* 视觉特效脉冲 */
.fx-pulse {
  animation: fxPulse 0.6s ease-out;
}
@keyframes fxPulse {
  0% { transform: scale(1); filter: brightness(1); }
  30% { transform: scale(1.05); filter: brightness(1.3); }
  100% { transform: scale(1); filter: brightness(1); }
}
</style>
