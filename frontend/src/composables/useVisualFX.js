/**
 * 视觉特效系统 composable
 * 提供全屏闪烁、震动、粒子等视觉效果
 * 从原游戏 VisualFX 对象迁移
 */
import { ref, onUnmounted } from 'vue'

const flashColor = ref('')
const flashOpacity = ref(0)
const shakeActive = ref(false)
const shakeIntensity = ref(0)

let flashTimer = null
let shakeTimer = null

function flash(color = 'gold', duration = 200) {
  const colorMap = {
    gold: 'rgba(201, 168, 76, 0.3)',
    red: 'rgba(208, 106, 90, 0.4)',
    blue: 'rgba(90, 143, 196, 0.3)',
    green: 'rgba(95, 174, 110, 0.3)',
    white: 'rgba(255, 255, 255, 0.4)'
  }
  flashColor.value = colorMap[color] || color
  flashOpacity.value = 1

  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashOpacity.value = 0
  }, duration)
}

function shake(intensity = 5, duration = 300) {
  shakeActive.value = true
  shakeIntensity.value = intensity

  if (shakeTimer) clearTimeout(shakeTimer)
  shakeTimer = setTimeout(() => {
    shakeActive.value = false
  }, duration)
}

function pulse(element) {
  if (!element) return
  element.classList.remove('fx-pulse')
  void element.offsetWidth
  element.classList.add('fx-pulse')
  setTimeout(() => element.classList.remove('fx-pulse'), 600)
}

export function useVisualFX() {
  onUnmounted(() => {
    if (flashTimer) clearTimeout(flashTimer)
    if (shakeTimer) clearTimeout(shakeTimer)
  })

  return {
    flashColor,
    flashOpacity,
    shakeActive,
    shakeIntensity,
    flash,
    shake,
    pulse
  }
}
