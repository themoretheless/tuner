<script setup lang="ts">
import { useCanvasRenderer } from '../composables/useCanvasRenderer'
import type { CanvasFrame } from '../composables/useHiDpiCanvas'
import type { WaveformFrame } from '../composables/useVisualizationFrames'
import { canvasPalette } from '../utils/canvasPalette'

const props = defineProps<{
  frame: WaveformFrame | null
  isListening: boolean
}>()

const { canvas } = useCanvasRenderer({
  cssHeight: 82,
  fallbackWidth: 400,
  source: () => [props.isListening, props.frame?.sequence],
  draw: drawFrame,
})
void canvas

function clearCanvas(frame: CanvasFrame) {
  frame.ctx.fillStyle = canvasPalette(frame).background
  frame.ctx.fillRect(0, 0, frame.w, frame.h)
}

function drawFrame(frame: CanvasFrame) {
  if (!props.isListening || !props.frame) {
    clearCanvas(frame)
    return
  }

  const { ctx, w, h } = frame
  const data = props.frame.samples
  const bufferLength = data.length

  const palette = canvasPalette(frame)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = palette.accent
  ctx.lineWidth = 1.5
  ctx.beginPath()

  const sliceWidth = w / bufferLength
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    const v = data[i]
    const y = (v * 0.5 + 0.5) * h

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)

    x += sliceWidth
  }

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
