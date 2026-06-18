<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  analyser: AnalyserNode | null
  isListening: boolean
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

  // Show first 200 bins (~4.3 kHz at 44.1k), similar to egui
  const displayBins = Math.min(200, binCount)
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

onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d', { alpha: true })
    canvas.value.width = 520
    canvas.value.height = 100
  }
  watch(() => [props.isListening, props.analyser], () => {
    if (props.isListening) startDraw()
    else stopDraw()
  }, { immediate: true })
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="w-full flex justify-center">
    <canvas
      ref="canvas"
      class="rounded-lg bg-[#11151b] border border-slate-800"
      :class="{ 'opacity-40': !isListening }"
    />
  </div>
</template>
