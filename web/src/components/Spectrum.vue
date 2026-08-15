<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasRenderer } from '../composables/useCanvasRenderer'
import type { CanvasFrame } from '../composables/useHiDpiCanvas'
import type { SpectrumFrame } from '../composables/useVisualizationFrames'
import { canvasPalette, type CanvasPalette } from '../utils/canvasPalette'
import { harmonicMarkers } from '../utils/harmonicMarkers'
import {
  SPECTRAL_PEAK_MAX_FREQ,
  SPECTRAL_PEAK_MIN_FREQ,
  spectralPeakFrequency,
} from '../utils/spectralPeak'
import { useL10n } from '../stores/l10n'

// Logarithmic frequency range good for guitar (50Hz-6kHz covers fundamentals + early harmonics)
const MIN_FREQ = SPECTRAL_PEAK_MIN_FREQ
const MAX_FREQ = SPECTRAL_PEAK_MAX_FREQ

const props = defineProps<{
  frame: SpectrumFrame | null
  isListening: boolean
  currentFreq?: number | null
}>()

const { t } = useL10n()

const { canvas } = useCanvasRenderer({
  cssHeight: 130,
  fallbackWidth: 400,
  source: () => [props.isListening, props.frame?.sequence, props.currentFreq],
  draw: drawFrame,
})
void canvas

// Frequency (Hz) of the tallest bin within [MIN_FREQ, MAX_FREQ], independent
// of the coarser display-bar resolution, so the label reflects the true FFT peak.
const peakFrequency = computed(() => {
  if (!props.isListening) return null
  return spectralPeakFrequency(props.frame)
})

const markers = computed(() =>
  props.isListening ? harmonicMarkers(props.currentFreq) : [],
)

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
  const data = props.frame.bins
  const binCount = data.length

  const palette = canvasPalette(frame)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, w, h)

  const sr = props.frame.sampleRate || 48000
  const nyquist = sr / 2

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
    grad.addColorStop(0, palette.accent)
    grad.addColorStop(0.65, palette.accent)
    grad.addColorStop(1, palette.accentStrong)
    ctx.fillStyle = grad
    ctx.fillRect(x1, h - barH, bw, barH)
  }

  drawHarmonicMarkers(frame, palette)
}

// The fundamental and its overtones, so the peaks of one plucked string read
// as a single note rather than as several unexplained tones. The fundamental
// is solid, overtones are dashed and dimmer, and every line carries its
// multiple so the overlay explains itself.
function drawHarmonicMarkers(frame: CanvasFrame, palette: CanvasPalette) {
  const { ctx, w, h } = frame
  if (!markers.value.length) return

  ctx.save()
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 1

  for (const marker of markers.value) {
    const isFundamental = marker.harmonic === 1
    // Pixel-snapped so a 1px line stays crisp instead of straddling two pixels,
    // and held inside the canvas: a partial landing exactly on MAX_FREQ maps to
    // w, one pixel past the last drawable column, which would hide the line
    // while its label still showed.
    const x = Math.min(Math.floor(marker.position * w), w - 1) + 0.5
    ctx.globalAlpha = isFundamental ? 0.75 : 0.4
    ctx.strokeStyle = palette.warning
    ctx.setLineDash(isFundamental ? [] : [3, 3])
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()

    const label = `×${marker.harmonic}`
    // Flip the label inside the canvas when the line sits at the right edge.
    const labelWidth = ctx.measureText(label).width
    const flip = x + labelWidth + 3 > w
    ctx.globalAlpha = isFundamental ? 0.95 : 0.65
    ctx.fillStyle = palette.warning
    ctx.fillText(label, flip ? x - labelWidth - 2 : x + 2, 2)
  }

  ctx.restore()
}
</script>

<template>
  <div class="w-full">
    <div class="flex justify-between text-[10px] mb-1 text-slate-500">
      <div>{{ t('spectrum') }}</div>
      <div v-if="peakFrequency != null" class="font-mono">
        {{ t('spectrum.peak') }}: {{ peakFrequency.toFixed(1) }} Hz
      </div>
    </div>
    <canvas
      ref="canvas"
      class="visual-canvas block w-full rounded-lg border"
      :class="{ 'opacity-40': !isListening }"
    />
    <div class="flex justify-between items-center gap-2 text-[10px] mt-1 text-slate-500 font-mono">
      <div>{{ MIN_FREQ }} Hz</div>
      <div v-if="markers.length" class="spectrum-legend truncate">
        {{ t('spectrum.harmonics') }}
      </div>
      <div>{{ MAX_FREQ }} Hz</div>
    </div>
  </div>
</template>
