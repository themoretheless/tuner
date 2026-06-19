<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  analyser: AnalyserNode | null
  isListening: boolean
  currentFreq?: number | null
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ctx: CanvasRenderingContext2D | null = null
const dataArray = ref<Uint8Array | null>(null)

function draw() {
  if (!props.analyser || !ctx || !canvas.value) return

  // Ensure canvas size (so height change takes effect even without remount)
  const targetWidth = 520
  const targetHeight = 100
  if (canvas.value.width !== targetWidth || canvas.value.height !== targetHeight) {
    canvas.value.width = targetWidth
    canvas.value.height = targetHeight
  }

  const w = canvas.value.width
  const h = canvas.value.height

  const binCount = props.analyser.frequencyBinCount
  if (!dataArray.value || dataArray.value.length !== binCount) {
    dataArray.value = new Uint8Array(binCount)
  }
  props.analyser.getByteFrequencyData(dataArray.value as any)

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  // Dynamic bins for full width, keep reasonable density
  const displayBins = Math.max(50, Math.min(300, Math.floor(w / 2.5)))
  const barWidth = w / displayBins

  // Per-frame normalize so quiet signals still show full height spectrum (like egui)
  let maxV = 0
  for (let i = 0; i < displayBins; i++) {
    if (dataArray.value[i] > maxV) maxV = dataArray.value[i]
  }
  if (maxV < 1) maxV = 1

  ctx.fillStyle = '#4ade80'

  for (let i = 0; i < displayBins; i++) {
    const v = dataArray.value[i] / maxV
    const barH = v * h
    const x = i * barWidth
    ctx.fillRect(x, h - barH, Math.max(1, barWidth - 0.6), barH)

    // Simple fake 3D extrusion for "3D visualization"
    ctx.fillStyle = '#166534'
    ctx.fillRect(x + 2, h - barH - 4, Math.max(1, barWidth - 0.6), 4)
    ctx.fillStyle = '#4ade80'
  }

  // Highlight harmonics if currentFreq provided (simple visual)
  if (props.currentFreq && props.currentFreq > 40) {
    const nyquist = 22050 // approx for 44.1/48k
    const binCount = props.analyser.frequencyBinCount
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1
    for (let harm = 2; harm <= 5; harm++) {
      const harmFreq = props.currentFreq * harm
      if (harmFreq > nyquist) break
      const bin = Math.floor((harmFreq / nyquist) * binCount)
      if (bin < displayBins) {
        const x = bin * barWidth
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
    ctx.fillStyle = '#11151b'
    ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
  }
}

function resizeCanvas() {
  if (!canvas.value) return
  const parent = canvas.value.parentElement
  if (parent) {
    canvas.value.width = parent.clientWidth
    canvas.value.height = 100
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
