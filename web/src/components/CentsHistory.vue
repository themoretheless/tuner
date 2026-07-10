<script setup lang="ts">
import { useCanvasRenderer } from '../composables/useCanvasRenderer'
import type { CanvasFrame } from '../composables/useHiDpiCanvas'
import { canvasPalette } from '../utils/canvasPalette'

const props = defineProps<{
  history: number[]
  isListening: boolean
}>()

const { canvas } = useCanvasRenderer({
  cssHeight: 60,
  fallbackWidth: 400,
  source: () => [props.isListening, props.history.length, props.history[props.history.length - 1]],
  draw,
})
void canvas

function draw(frame: CanvasFrame) {
  const { ctx, w, h } = frame
  const palette = canvasPalette(frame)

  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, w, h)

  if (!props.isListening) return

  const history = props.history
  if (history.length < 2) return

  // Draw center line (0 cents)
  ctx.strokeStyle = palette.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()

  // Draw history line
  ctx.strokeStyle = palette.accent
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
  ctx.strokeStyle = palette.warning
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2 - (50/50)*(h/2))
  ctx.lineTo(w, h / 2 - (50/50)*(h/2))
  ctx.moveTo(0, h / 2 + (50/50)*(h/2))
  ctx.lineTo(w, h / 2 + (50/50)*(h/2))
  ctx.stroke()
}
</script>

<template>
  <div class="w-full">
    <canvas
      ref="canvas"
      class="visual-canvas block w-full rounded-lg border"
      :class="{ 'opacity-40': !isListening }"
    />
  </div>
</template>
