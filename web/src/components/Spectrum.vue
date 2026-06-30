<script setup lang="ts">
import { useCanvasRenderer } from '../composables/useCanvasRenderer'
import type { CanvasFrame } from '../composables/useHiDpiCanvas'
import type { SpectrumFrame } from '../composables/useVisualizationFrames'

const props = defineProps<{
  frame: SpectrumFrame | null
  isListening: boolean
  currentFreq?: number | null
}>()

const { canvas } = useCanvasRenderer({
  cssHeight: 130,
  fallbackWidth: 400,
  source: () => [props.isListening, props.frame?.sequence, props.currentFreq],
  draw: drawFrame,
})
void canvas

function clearCanvas(frame: CanvasFrame) {
  frame.ctx.fillStyle = '#11151b'
  frame.ctx.fillRect(0, 0, frame.w, frame.h)
}

function drawFrame(frame: CanvasFrame) {
  if (!props.isListening || !props.frame) {
    clearCanvas(frame)
    return
  }

  const { ctx, w, h } = frame
  const data = props.frame.bins
  const binCount = data.length

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  const sr = props.frame.sampleRate || 48000
  const nyquist = sr / 2

  // Logarithmic frequency range good for guitar (50Hz-6kHz covers fundamentals + early harmonics)
  const MIN_FREQ = 50
  const MAX_FREQ = 6000

  // Slightly fewer wider bars look cleaner on log scale
  const displayBins = Math.max(36, Math.min(160, Math.floor(w / 3.6)))
  const barWidth = w / displayBins

  // Per-frame max normalize (keeps quiet signals visible)
  let maxV = 0
  for (let i = 0; i < displayBins; i++) {
    const t = i / Math.max(1, displayBins - 1)
    const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, t)
    let bin = Math.floor((freq / nyquist) * binCount)
    bin = Math.max(0, Math.min(binCount - 1, bin))
    if (data[bin] > maxV) maxV = data[bin]
  }
  if (maxV < 1) maxV = 1

  for (let i = 0; i < displayBins; i++) {
    const t = i / Math.max(1, displayBins - 1)
    const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, t)
    let bin = Math.floor((freq / nyquist) * binCount)
    bin = Math.max(0, Math.min(binCount - 1, bin))

    // Take max of a couple neighboring bins at high freq for stability
    const vRaw = Math.max(
      data[bin] || 0,
      data[Math.min(binCount - 1, bin + 1)] || 0
    )
    const v = vRaw / maxV
    const barH = Math.max(1, v * h)
    const x = i * barWidth

    // Pixel-snapped for crisp edges + small gap
    const x1 = Math.floor(x)
    const bw = Math.max(1, Math.floor(barWidth - 0.85))

    // Nice vertical gradient (brighter on top)
    const grad = ctx.createLinearGradient(0, h - barH, 0, h)
    grad.addColorStop(0, '#4ade80')
    grad.addColorStop(0.65, '#22c55e')
    grad.addColorStop(1, '#166534')
    ctx.fillStyle = grad
    ctx.fillRect(x1, h - barH, bw, barH)
  }

  // Highlight harmonics at correct log positions (crisp lines)
  if (props.currentFreq && props.currentFreq > 40) {
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1
    for (let harm = 2; harm <= 5; harm++) {
      const harmFreq = props.currentFreq * harm
      if (harmFreq > MAX_FREQ) break
      // map freq -> log t -> screen x
      const t = Math.log(harmFreq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)
      if (t >= 0 && t <= 1) {
        const x = t * w + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
    }
  }
}
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
