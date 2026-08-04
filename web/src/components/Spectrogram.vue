<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useCanvasRenderer } from '../composables/useCanvasRenderer'
import type { SpectrumFrame } from '../composables/useVisualizationFrames'
import { CanvasSpectrogramRenderer } from '../rendering/canvasSpectrogramRenderer'

const props = defineProps<{
  frame: SpectrumFrame | null
  isListening: boolean
}>()

let renderer: CanvasSpectrogramRenderer | null = null

onMounted(() => { renderer = CanvasSpectrogramRenderer.create() })
onUnmounted(() => {
  renderer?.dispose()
  renderer = null
})

const { canvas } = useCanvasRenderer({
  cssHeight: 120,
  fallbackWidth: 400,
  source: () => [props.isListening, props.frame?.sequence],
  draw: (target) => renderer?.draw(target, props.frame, props.isListening),
})
void canvas
</script>

<template>
  <div class="w-full">
    <canvas
      ref="canvas"
      class="visual-canvas block w-full rounded-lg border"
      :class="{ 'opacity-40': !isListening }"
    />
  </div>
</template>
