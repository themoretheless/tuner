<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useHiDpiCanvas } from '../composables/useHiDpiCanvas'
import type { WaveformFrame } from '../composables/useVisualizationFrames'

const props = defineProps<{
  frame: WaveformFrame | null
  isListening: boolean
}>()

const { canvas, clear, resize, setup } = useHiDpiCanvas(82, 400)

function clearCanvas() {
  clear('#11151b')
}

function drawFrame() {
  const frame = resize()
  if (!frame) return
  if (!props.isListening || !props.frame) {
    clearCanvas()
    return
  }

  const { ctx, w, h } = frame
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
  if (!canvas.value) return
  setup()
  window.addEventListener('resize', handleResize)
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
