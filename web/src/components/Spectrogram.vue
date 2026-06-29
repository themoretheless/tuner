<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { SpectrumFrame } from '../composables/useVisualizationFrames'

const props = defineProps<{
  frame: SpectrumFrame | null
  isListening: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const history: Uint8Array[] = []
const MAX_HISTORY = 150 // time steps
let historyCount = 0
let lastSequence = 0
let writeIndex = 0

// Logical CSS sizes (ctx is scaled by dpr)
const displayW = ref(400)
const displayH = ref(120)

function getDpr(): number {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1
}

function resizeCanvas() {
  if (!canvas.value) return
  const parent = canvas.value.parentElement
  if (!parent) return

  const dpr = getDpr()
  const cssW = Math.max(260, Math.floor(parent.clientWidth))
  const cssH = 120

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

function resetHistory() {
  history.length = 0
  historyCount = 0
  lastSequence = 0
  writeIndex = 0
}

function ensureHistoryBuffers(binCount: number) {
  if (history.length && history[0].length === binCount) return
  resetHistory()
  for (let i = 0; i < MAX_HISTORY; i++) {
    history.push(new Uint8Array(binCount))
  }
}

function addFrame(frame: SpectrumFrame) {
  if (frame.sequence === lastSequence) return
  ensureHistoryBuffers(frame.bins.length)
  history[writeIndex].set(frame.bins)
  writeIndex = (writeIndex + 1) % MAX_HISTORY
  historyCount = Math.min(MAX_HISTORY, historyCount + 1)
  lastSequence = frame.sequence
}

function getHistoryFrame(index: number) {
  const start = historyCount === MAX_HISTORY ? writeIndex : 0
  return history[(start + index) % MAX_HISTORY]
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
  const binCount = props.frame.bins.length
  addFrame(props.frame)

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  if (historyCount < 2) {
    return
  }

  const timeSteps = historyCount
  const timeStepW = w / timeSteps
  const freqBins = Math.min(128, binCount) // limit for perf

  for (let t = 0; t < timeSteps; t++) {
    const data = getHistoryFrame(t)
    const x = t * timeStepW
    for (let f = 0; f < freqBins; f++) {
      const val = data[f] / 255
      const y = h - ((f / freqBins) * h)
      const barH = (h / freqBins)

      // Color: black -> green -> yellow -> red based on intensity
      let r = 0, g = 0, b = 0
      if (val > 0.7) {
        r = 255; g = 255 * (1 - (val - 0.7) / 0.3); b = 0
      } else if (val > 0.3) {
        r = 0; g = 255; b = 0
      } else {
        r = 0; g = val * 255 * 0.8; b = 0
      }

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fillRect(x, y, timeStepW + 0.5, barH + 0.5)
    }
  }
}

function startDraw() {
  drawFrame()
}

function stopDraw() {
  resetHistory()
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
