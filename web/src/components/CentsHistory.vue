<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  history: number[]
  isListening: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0

function draw() {
  if (!ctx || !canvas.value) return

  const w = canvas.value.width
  const h = canvas.value.height

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
    // Clamp to -50..50 cents for viz
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

function resizeCanvas() {
  if (!canvas.value) return
  const parent = canvas.value.parentElement
  if (parent) {
    canvas.value.width = parent.clientWidth
    canvas.value.height = 60
  }
}

onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d', { alpha: true })
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
  }
  watch(() => props.history, () => {
    if (props.isListening) {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
  }, { deep: true })
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resizeCanvas)
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
