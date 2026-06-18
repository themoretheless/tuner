<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  analyser: AnalyserNode | null
  isListening: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ctx: CanvasRenderingContext2D | null = null
const dataArray = ref<Float32Array | null>(null)

function draw() {
  if (!props.analyser || !ctx || !canvas.value) return

  const w = canvas.value.width
  const h = canvas.value.height

  const bufferLength = props.analyser.fftSize
  if (!dataArray.value || dataArray.value.length !== bufferLength) {
    dataArray.value = new Float32Array(bufferLength)
  }
  props.analyser.getFloatTimeDomainData(dataArray.value as any)

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
  if (ctx && canvas.value) {
    ctx.fillStyle = '#11151b'
    ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
  }
}

onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d', { alpha: true })
    canvas.value.width = 520
    canvas.value.height = 52
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