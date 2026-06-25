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

// Logical CSS pixel size
const displayW = ref(400)
const displayH = ref(80)

function getDpr(): number {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1
}

function resizeCanvas() {
  if (!canvas.value) return
  const parent = canvas.value.parentElement
  if (!parent) return

  const dpr = getDpr()
  const cssW = Math.max(260, Math.floor(parent.clientWidth))
  const cssH = 82

  canvas.value.style.width = cssW + 'px'
  canvas.value.style.height = cssH + 'px'

  const pxW = Math.floor(cssW * dpr)
  const pxH = Math.floor(cssH * dpr)
  if (canvas.value.width !== pxW || canvas.value.height !== pxH) {
    canvas.value.width = pxW
    canvas.value.height = pxH
  }

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  displayW.value = cssW
  displayH.value = cssH
}

function draw() {
  if (!props.analyser || !ctx || !canvas.value) return

  resizeCanvas()

  const w = displayW.value
  const h = displayH.value

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
    const y = (v * 0.5 + 0.5) * h

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