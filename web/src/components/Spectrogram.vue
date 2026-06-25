<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  analyser: AnalyserNode | null
  isListening: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0

// History of frequency data (ring buffer)
const history: Uint8Array[] = []
const MAX_HISTORY = 150 // time steps

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

function draw() {
  if (!props.analyser || !ctx || !canvas.value) return

  resizeCanvas()

  const w = displayW.value
  const h = displayH.value

  // Get current freq data
  const binCount = props.analyser.frequencyBinCount
  const freqData = new Uint8Array(binCount)
  props.analyser.getByteFrequencyData(freqData)

  // Add to history
  history.push(freqData)
  if (history.length > MAX_HISTORY) history.shift()

  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, w, h)

  if (history.length < 2) {
    raf = requestAnimationFrame(draw)
    return
  }

  const timeSteps = history.length
  const timeStepW = w / timeSteps
  const freqBins = Math.min(128, binCount) // limit for perf

  for (let t = 0; t < timeSteps; t++) {
    const data = history[t]
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

  raf = requestAnimationFrame(draw)
}

function startDraw() {
  if (raf) cancelAnimationFrame(raf)
  if (props.isListening && props.analyser) {
    // Clear history on start
    history.length = 0
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
