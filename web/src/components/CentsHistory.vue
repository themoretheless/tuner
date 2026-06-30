<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useHiDpiCanvas } from '../composables/useHiDpiCanvas'

const props = defineProps<{
  history: number[]
  isListening: boolean
}>()

const { canvas, resize, setup } = useHiDpiCanvas(60, 400)
let raf = 0

function draw() {
  const frame = resize()
  if (!frame) return

  const { ctx, w, h } = frame

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  const history = props.history
  if (history.length < 2) return

  // Draw center line (0 cents)
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()

  // Draw history line
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 2
  ctx.beginPath()

  const len = history.length
  const step = w / (len - 1)

  for (let i = 0; i < len; i++) {
    const cents = history[i]
    const clamped = Math.max(-50, Math.min(50, cents))
    const y = (h / 2) - (clamped / 50) * (h / 2)
    const x = i * step

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Draw bounds
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2 - (50/50)*(h/2))
  ctx.lineTo(w, h / 2 - (50/50)*(h/2))
  ctx.moveTo(0, h / 2 + (50/50)*(h/2))
  ctx.lineTo(w, h / 2 + (50/50)*(h/2))
  ctx.stroke()

  raf = requestAnimationFrame(draw)
}

function handleResize() {
  if (raf) cancelAnimationFrame(raf)
  if (props.isListening) draw()
  else resize()
}

onMounted(() => {
  if (!canvas.value) return
  setup()
  window.addEventListener('resize', handleResize)
  watch(() => props.history, () => {
    if (props.isListening) {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
  }, { deep: true })
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="w-full">
    <canvas
      ref="canvas"
      class="rounded-lg bg-[#11151b] border border-slate-800 block w-full"
      :class="{ 'opacity-40': !isListening }"
    />
  </div>
</template>
