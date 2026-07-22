<script setup lang="ts">
import { useCanvasRenderer } from '../composables/useCanvasRenderer'
import type { CanvasFrame } from '../composables/useHiDpiCanvas'
import type { SpectrumFrame } from '../composables/useVisualizationFrames'
import { useL10n } from '../stores/l10n'
import { canvasPalette } from './canvasTheme'

const props = defineProps<{
  frame: SpectrumFrame | null
  isListening: boolean
}>()
const { t } = useL10n()

const { canvas } = useCanvasRenderer({
  cssHeight: 120,
  fallbackWidth: 400,
  source: () => [props.isListening, props.frame?.sequence],
  draw: drawFrame,
})
void canvas

let raster: HTMLCanvasElement | null = null
let rasterContext: CanvasRenderingContext2D | null = null
let lastSequence = 0

function clearCanvas(frame: CanvasFrame) {
  frame.ctx.fillStyle = canvasPalette(frame).background
  frame.ctx.fillRect(0, 0, frame.w, frame.h)
}

function resetHistory() {
  raster = null
  rasterContext = null
  lastSequence = 0
}

function ensureRaster(w: number, h: number, background: string) {
  if (raster && raster.width === w && raster.height === h && rasterContext) return rasterContext
  raster = document.createElement('canvas')
  raster.width = w
  raster.height = h
  rasterContext = raster.getContext('2d', { alpha: false })
  if (!rasterContext) return null
  rasterContext.fillStyle = background
  rasterContext.fillRect(0, 0, w, h)
  return rasterContext
}

function drawFrame(frame: CanvasFrame) {
  if (!props.isListening || !props.frame) {
    resetHistory()
    clearCanvas(frame)
    return
  }

  const { ctx, w, h } = frame
  const palette = canvasPalette(frame)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, w, h)
  const rasterCtx = ensureRaster(w, h, palette.background)
  if (!rasterCtx || !raster) return

  if (props.frame.sequence !== lastSequence) {
    rasterCtx.globalAlpha = 1
    rasterCtx.drawImage(raster, 1, 0, Math.max(1, w - 1), h, 0, 0, Math.max(1, w - 1), h)
    rasterCtx.fillStyle = palette.background
    rasterCtx.fillRect(w - 2, 0, 2, h)

    const data = props.frame.bins
    const freqBins = Math.min(96, data.length)
    const cellHeight = h / Math.max(1, freqBins)
    for (let f = 0; f < freqBins; f++) {
      const val = data[f] / 255
      rasterCtx.globalAlpha = Math.max(0.08, val)
      rasterCtx.fillStyle = val > 0.72 ? palette.warning : palette.accent
      rasterCtx.fillRect(w - 2, h - ((f + 1) * cellHeight), 2, cellHeight + 0.5)
    }
    rasterCtx.globalAlpha = 1
    lastSequence = props.frame.sequence
  }

  ctx.drawImage(raster, 0, 0, w, h)
}
</script>

<template>
  <div class="w-full">
    <canvas
      ref="canvas"
      class="rounded-lg bg-[#11151b] border border-slate-800 block w-full"
      role="img"
      :aria-label="t('visual.spectrogram.label')"
      :class="{ 'opacity-40': !isListening }"
    />
  </div>
</template>
