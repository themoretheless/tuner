<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { WaveformFrame } from '../composables/useVisualizationFrames'

const props = defineProps<{
  frame: WaveformFrame | null
  isListening: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

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

function clearCanvas() {
  if (!ctx || !canvas.value) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)
}

function drawFrame() {
  if (!ctx || !canvas.value) return

  resizeCanvas()
  if (!props.isListening || !props.frame) {
    clearCanvas()
    return
  }

  const w = displayW.value
  const h = displayH.value
  const data = props.frame.samples
  const bufferLength = data.length

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 1.5
  ctx.beginPath()

  const sliceWidth = w / bufferLength
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    const v = data[i]
    const y = (v * 0.5 + 0.5) * h

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)

    x += sliceWidth
  }

  ctx.stroke()
}

function startDraw() {
  drawFrame()
}

function stopDraw() {
  clearCanvas()
}

function handleResize() {
  drawFrame()
}

onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d', { alpha: true })
    resizeCanvas()
    window.addEventListener('resize', handleResize)
  }
  watch(() => [props.isListening, props.frame?.sequence], () => {
    if (props.isListening && props.frame) startDraw()
    else stopDraw()
  }, { immediate: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
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
