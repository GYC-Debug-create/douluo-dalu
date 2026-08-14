<template>
  <div class="particle-bg" aria-hidden="true">
    <div
      v-for="particle in particles"
      :key="particle.id"
      class="particle"
      :style="particle.style"
    >{{ particle.char }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const CHARS = ['魂', '力', '环', '骨', '师', '神', '灵', '气']
const PARTICLE_COUNT = 12
const particles = ref([])
let animFrame = null

function createParticle(id) {
  const char = CHARS[Math.floor(Math.random() * CHARS.length)]
  const size = 16 + Math.random() * 20
  const startX = Math.random() * 100
  const duration = 15 + Math.random() * 20
  const delay = -Math.random() * duration
  const opacity = 0.03 + Math.random() * 0.07

  return {
    id,
    char,
    style: {
      left: `${startX}%`,
      fontSize: `${size}px`,
      animationDuration: `${duration}s`,
      animationDelay: `${delay}s`,
      opacity
    }
  }
}

onMounted(() => {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.value.push(createParticle(i))
  }
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
})
</script>

<style scoped>
.particle-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.particle {
  position: absolute;
  bottom: -40px;
  font-family: var(--font-display);
  color: var(--gold);
  text-shadow: 0 0 10px rgba(201, 168, 76, 0.3);
  animation: particleRise linear infinite;
  white-space: nowrap;
}
@keyframes particleRise {
  0% {
    bottom: -40px;
    transform: translateX(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: var(--opacity, 0.05);
  }
  90% {
    opacity: var(--opacity, 0.05);
  }
  100% {
    bottom: 110%;
    transform: translateX(20px) rotate(15deg);
    opacity: 0;
  }
}
</style>
