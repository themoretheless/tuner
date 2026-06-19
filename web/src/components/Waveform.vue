<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useHiDpiCanvas } from '../composables/useHiDpiCanvas'

const props = defineProps<{
  analyser: AnalyserNode | null
  isListening: boolean
}>()

let raf = 0
const dataArray = ref<Float32Array<ArrayBuffer> | null>(null)
const CSS_HEIGHT = 80
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

  const bufferLength = props.analyser.fftSize
  if (!dataArray.value || dataArray.value.length !== bufferLength) {
    dataArray.value = new Float32Array(bufferLength) as Float32Array<ArrayBuffer>
  }
  props.analyser.getFloatTimeDomainData(dataArray.value)

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 1.5
  ctx.beginPath()

  const sliceWidth = w / bufferLength
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray.value[i]
    const y = (v * 0.5 + 0.5) * h   // center the waveform

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)

    x += sliceWidth
  }

  ctx.stroke()

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
      class="w-full max-w-[520px] h-20 rounded-lg bg-[#11151b] border border-slate-800"
      :class="{ 'opacity-40': !isListening }"
    />
  </div>
</template>
