<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { encodeMonoPcm16Wav } from '../audio/wav'
import type { AudioFrameTimebase, ExactPcmCapture } from '../ports/audioInput'
import type { DetectionFrame } from '../types/frames'
import {
  createDebugCaptureEnvelope,
  createDebugFrameSnapshot,
  sha256Hex,
  type DebugFrameSnapshot,
} from '../utils/debugCaptureEnvelope'

const props = defineProps<{
  backend: string
  beginCapture: () => boolean
  canCapturePcm: boolean
  finishCapture: () => ExactPcmCapture | null
  frame: DetectionFrame
  frameTimebase: AudioFrameTimebase | null
  isListening: boolean
  selectedInputDeviceId?: string
}>()

const RECORD_SECONDS = 5

const recording = ref(false)
const recordError = ref<string | null>(null)
const lastFileName = ref<string | null>(null)

let frameSnapshots: DebugFrameSnapshot[] = []
let recordStartedAt = ''
let recordTimer: number | null = null
let sessionAtStart = { backend: '', isListening: false, selectedInputDeviceId: '' }

function fmt(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

function record() {
  if (recording.value) return
  recordError.value = null
  lastFileName.value = null
  if (!props.isListening || !props.canCapturePcm || !props.beginCapture()) {
    recordError.value = 'Exact shared PCM capture is unavailable'
    return
  }

  frameSnapshots = []
  recordStartedAt = new Date().toISOString()
  sessionAtStart = {
    backend: props.backend,
    isListening: props.isListening,
    selectedInputDeviceId: props.selectedInputDeviceId ?? '',
  }
  recording.value = true
  recordTimer = window.setTimeout(() => void finishRecording(), RECORD_SECONDS * 1000)
}

async function finishRecording() {
  if (!recording.value) return
  recording.value = false
  clearRecordTimer()
  const capture = props.finishCapture()
  if (!capture) {
    recordError.value = 'No shared PCM samples were captured'
    return
  }

  try {
    const completedAt = new Date().toISOString()
    const base = `tuner-debug-${recordStartedAt.replace(/[:.]/g, '-')}`
    const audioName = `${base}.wav`
    const metadataName = `${base}.json`
    const wav = encodeMonoPcm16Wav(capture.samples, capture.sampleRate)
    const envelope = createDebugCaptureEnvelope({
      audioFile: audioName,
      audioSha256: await sha256Hex(wav),
      backend: sessionAtStart.backend,
      capture,
      capturedAt: recordStartedAt,
      completedAt,
      frames: frameSnapshots,
      isTunerListening: sessionAtStart.isListening,
      selectedInputDeviceId: sessionAtStart.selectedInputDeviceId,
    })
    download(new Blob([wav], { type: 'audio/wav' }), audioName)
    download(new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }), metadataName)
    lastFileName.value = `${audioName} + ${metadataName}`
  } catch (error) {
    recordError.value = error instanceof Error ? error.message : 'recording failed'
  }
}

function download(blob: Blob, name: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

function clearRecordTimer() {
  if (recordTimer != null) window.clearTimeout(recordTimer)
  recordTimer = null
}

function cancelRecording() {
  clearRecordTimer()
  if (recording.value) props.finishCapture()
  recording.value = false
}

onUnmounted(cancelRecording)

watch(() => props.frame, (frame) => {
  if (!recording.value) return
  frameSnapshots.push(createDebugFrameSnapshot(
    frameSnapshots.length,
    frame,
    props.frameTimebase,
  ))
})

watch(() => props.isListening, (isListening) => {
  if (!isListening && recording.value) void finishRecording()
})
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
        <tr><td class="pr-3 text-slate-500">sample</td><td>{{ frameTimebase?.endSample ?? '—' }}</td></tr>
      </tbody>
    </table>
    <button
      type="button"
      class="mt-2 w-full rounded border border-slate-600 px-2 py-1 text-slate-200 disabled:opacity-50"
      :disabled="recording || !isListening || !canCapturePcm"
      @click="record"
    >
      {{ recording ? `rec PCM ${RECORD_SECONDS}s…` : `record PCM ${RECORD_SECONDS}s` }}
    </button>
    <div v-if="lastFileName" class="mt-1 max-w-[180px] break-all text-emerald-400">{{ lastFileName }}</div>
    <div v-if="recordError" class="mt-1 max-w-[180px] break-all text-red-400">{{ recordError }}</div>
  </div>
</template>
