<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  analyser: AnalyserNode | null
  isListening: boolean
  currentFreq?: number | null
  sampleRate?: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ctx: CanvasRenderingContext2D | null = null
const dataArray = ref<Uint8Array | null>(null)

// Logical (CSS px) size we draw in. Actual backing store = this * dpr
const displayW = ref(400)
const displayH = ref(100)

function getDpr(): number {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1
}

function resizeCanvas() {
  if (!canvas.value) return
  const parent = canvas.value.parentElement
  if (!parent) return

  const dpr = getDpr()
  // Take the real available width from layout (flex-1 + w-full parent)
  const cssW = Math.max(260, Math.floor(parent.clientWidth))
  const cssH = 130 // taller for better looking bars

  // Display size (CSS)
  canvas.value.style.width = cssW + 'px'
  canvas.value.style.height = cssH + 'px'

  // Real pixel backing store for sharp rendering
  const pxW = Math.floor(cssW * dpr)
  const pxH = Math.floor(cssH * dpr)
  if (canvas.value.width !== pxW || canvas.value.height !== pxH) {
    canvas.value.width = pxW
    canvas.value.height = pxH
  }

  if (ctx) {
    // Reset and scale so all drawing commands below use CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  displayW.value = cssW
  displayH.value = cssH
}

function draw() {
  if (!props.analyser || !ctx || !canvas.value) return

  // Keep size in sync (handles container width changes from sidebar etc.)
  resizeCanvas()

  const w = displayW.value
  const h = displayH.value

  const binCount = props.analyser.frequencyBinCount
  if (!dataArray.value || dataArray.value.length !== binCount) {
    dataArray.value = new Uint8Array(binCount)
  }
  props.analyser.getByteFrequencyData(dataArray.value as any)

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  const sr = props.sampleRate || 48000
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
    if (dataArray.value[bin] > maxV) maxV = dataArray.value[bin]
  }
  if (maxV < 1) maxV = 1

  for (let i = 0; i < displayBins; i++) {
    const t = i / Math.max(1, displayBins - 1)
    const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, t)
    let bin = Math.floor((freq / nyquist) * binCount)
    bin = Math.max(0, Math.min(binCount - 1, bin))

    // Take max of a couple neighboring bins at high freq for stability
    const vRaw = Math.max(
      dataArray.value[bin] || 0,
      dataArray.value[Math.min(binCount - 1, bin + 1)] || 0
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

  raf = requestAnimationFrame(draw)
}

function startDraw() {
  if (raf) cancelAnimationFrame(raf)
  if (props.isListening && props.analyser) {
    raf = requestAnimationFrame(draw)
  }
}

function stopDraw() {
  cancelAnimationFrame(raf)
  if (ctx && canvas.value) {
    // Use logical size for clear
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#11151b'
    ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
  }
}

onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d', { alpha: true })
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
  }
  watch(() => [props.isListening, props.analyser], () => {
    if (props.isListening) startDraw()
    else stopDraw()
  }, { immediate: true })
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
