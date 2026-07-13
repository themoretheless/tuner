<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import type { DetectionFrame } from '../types/frames'

const props = defineProps<{
  frame: DetectionFrame
  backend: string
  isListening: boolean
  selectedInputDeviceId?: string
}>()

const RECORD_SECONDS = 5

const recording = ref(false)
const recordError = ref<string | null>(null)
const lastFileName = ref<string | null>(null)

let recorder: MediaRecorder | null = null
let recorderStream: MediaStream | null = null

function fmt(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

// Records its own capture of the same input device so the debug tool works
// regardless of the tuner session's internal audio plumbing. The processing
// constraints mirror the tuner's, so the recording is what the detector hears.
async function record() {
  if (recording.value) return
  recordError.value = null
  lastFileName.value = null
  try {
    recorderStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(props.selectedInputDeviceId ? { deviceId: { exact: props.selectedInputDeviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    })
    const chunks: BlobPart[] = []
    recorder = new MediaRecorder(recorderStream)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
      const name = `tuner-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = name
      link.click()
      URL.revokeObjectURL(link.href)
      lastFileName.value = name
      cleanup()
    }
    recorder.start()
    recording.value = true
    window.setTimeout(() => recorder?.state === 'recording' && recorder.stop(), RECORD_SECONDS * 1000)
  } catch (error) {
    recordError.value = error instanceof Error ? error.message : 'recording failed'
    cleanup()
  }
}

function cleanup() {
  recording.value = false
  recorder = null
  recorderStream?.getTracks().forEach((track) => track.stop())
  recorderStream = null
}

onUnmounted(cleanup)
</script>

<template>
  <div
    class="fixed bottom-3 right-3 z-50 rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-[11px] font-mono tabular-nums text-slate-300 shadow-lg"
    data-testid="debug-overlay"
  >
    <div class="mb-1 flex items-center justify-between gap-4">
      <span class="uppercase text-slate-500">debug</span>
      <span :class="backend === 'wasm' ? 'text-emerald-400' : 'text-amber-400'">{{ backend }}</span>
    </div>
    <table>
      <tbody>
        <tr><td class="pr-3 text-slate-500">raw</td><td>{{ fmt(frame.rawFreq) }} Hz</td></tr>
        <tr><td class="pr-3 text-slate-500">smooth</td><td>{{ fmt(frame.freq) }} Hz</td></tr>
        <tr><td class="pr-3 text-slate-500">cents</td><td>{{ fmt(frame.cents) }}</td></tr>
        <tr><td class="pr-3 text-slate-500">conf</td><td>{{ fmt(frame.confidence, 2) }}</td></tr>
        <tr><td class="pr-3 text-slate-500">rms</td><td>{{ fmt(frame.rms, 4) }}</td></tr>
      </tbody>
    </table>
    <button
      type="button"
      class="mt-2 w-full rounded border border-slate-600 px-2 py-1 text-slate-200 disabled:opacity-50"
      :disabled="recording"
      @click="record"
    >
      {{ recording ? `rec ${RECORD_SECONDS}s…` : `record ${RECORD_SECONDS}s` }}
    </button>
    <div v-if="lastFileName" class="mt-1 max-w-[180px] break-all text-emerald-400">{{ lastFileName }}</div>
    <div v-if="recordError" class="mt-1 max-w-[180px] break-all text-red-400">{{ recordError }}</div>
  </div>
</template>
