<script setup lang="ts">
import { useCanvasRenderer } from '../composables/useCanvasRenderer'
import type { CanvasFrame } from '../composables/useHiDpiCanvas'
import type { SpectrumFrame } from '../composables/useVisualizationFrames'
import { canvasPalette } from '../utils/canvasPalette'

const props = defineProps<{
  frame: SpectrumFrame | null
  isListening: boolean
}>()

const { canvas } = useCanvasRenderer({
  cssHeight: 120,
  fallbackWidth: 400,
  source: () => [props.isListening, props.frame?.sequence],
  draw: drawFrame,
})
void canvas

const history: Uint8Array[] = []
const MAX_HISTORY = 150 // time steps
let historyCount = 0
let lastSequence = 0
let writeIndex = 0

function clearCanvas(frame: CanvasFrame) {
  frame.ctx.fillStyle = canvasPalette(frame).background
  frame.ctx.fillRect(0, 0, frame.w, frame.h)
}

function resetHistory() {
  history.length = 0
  historyCount = 0
  lastSequence = 0
  writeIndex = 0
}

function ensureHistoryBuffers(binCount: number) {
  if (history.length && history[0].length === binCount) return
  resetHistory()
  for (let i = 0; i < MAX_HISTORY; i++) {
    history.push(new Uint8Array(binCount))
  }
}

function addFrame(frame: SpectrumFrame) {
  if (frame.sequence === lastSequence) return
  ensureHistoryBuffers(frame.bins.length)
  history[writeIndex].set(frame.bins)
  writeIndex = (writeIndex + 1) % MAX_HISTORY
  historyCount = Math.min(MAX_HISTORY, historyCount + 1)
  lastSequence = frame.sequence
}

function getHistoryFrame(index: number) {
  const start = historyCount === MAX_HISTORY ? writeIndex : 0
  return history[(start + index) % MAX_HISTORY]
}

function drawFrame(frame: CanvasFrame) {
  if (!props.isListening || !props.frame) {
    resetHistory()
    clearCanvas(frame)
    return
  }

  const { ctx, w, h } = frame
  const binCount = props.frame.bins.length
  addFrame(props.frame)

  const palette = canvasPalette(frame)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, w, h)

  if (historyCount < 2) {
    return
  }

  const timeSteps = historyCount
  const timeStepW = w / timeSteps
  const freqBins = Math.min(128, binCount) // limit for perf

  for (let t = 0; t < timeSteps; t++) {
    const data = getHistoryFrame(t)
    const x = t * timeStepW
    for (let f = 0; f < freqBins; f++) {
      const val = data[f] / 255
      const y = h - ((f / freqBins) * h)
      const barH = (h / freqBins)

      // Color: black -> green -> yellow -> red based on intensity
      let r = 0, g = 0, b = 0
      if (val > 0.7) {
        r = 255; g = 255 * (1 - (val - 0.7) / 0.3); b = 0
      } else if (val > 0.3) {
        r = 0; g = 255; b = 0
      } else {
        r = 0; g = val * 255 * 0.8; b = 0
      }

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fillRect(x, y, timeStepW + 0.5, barH + 0.5)
    }
  }
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
