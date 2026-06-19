<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useHiDpiCanvas } from '../composables/useHiDpiCanvas'

const props = defineProps<{
  analyser: AnalyserNode | null
  isListening: boolean
}>()

let raf = 0
const dataArray = ref<Uint8Array<ArrayBuffer> | null>(null)
const CSS_HEIGHT = 100
const canvasSurface = useHiDpiCanvas(CSS_HEIGHT)
const canvas = canvasSurface.canvas

function setCanvas(el: unknown) {
  canvas.value = el instanceof HTMLCanvasElement ? el : null
}

function draw() {
  if (!props.analyser) return

  const frame = canvasSurface.resize()
  if (!frame) return
  const { ctx, w, h } = frame

  const binCount = props.analyser.frequencyBinCount
  if (!dataArray.value || dataArray.value.length !== binCount) {
    dataArray.value = new Uint8Array(binCount) as Uint8Array<ArrayBuffer>
  }
  props.analyser.getByteFrequencyData(dataArray.value)

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
  canvasSurface.clear()
}

onMounted(() => {
  canvasSurface.setup()
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
      :ref="setCanvas"
      class="w-full max-w-[520px] h-[100px] rounded-lg bg-[#11151b] border border-slate-800"
      :class="{ 'opacity-40': !isListening }"
    />
  </div>
</template>
