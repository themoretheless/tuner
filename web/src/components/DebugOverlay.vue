<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import type { DetectionFrame } from '../types/frames'
import {
  createDebugCaptureEnvelope,
  createDebugFrameSnapshot,
  debugCaptureAudioExtension,
  type DebugFrameSnapshot,
} from '../utils/debugCaptureEnvelope'

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
let frameSnapshots: DebugFrameSnapshot[] = []
let recordStartedAt = ''
let recordStartedMs = 0
let sessionAtStart = { backend: '', isListening: false, selectedInputDeviceId: '' }

function fmt(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

// This parallel stream is intentionally marked as such in the sidecar. The
// frame trace makes field reports useful now; exact PCM time alignment belongs
// to the future shared AudioWorklet capture path.
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
    const trackSettings = recorderStream.getAudioTracks()[0]?.getSettings() ?? {}
    const chunks: BlobPart[] = []
    recorder = new MediaRecorder(recorderStream)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const completedAt = new Date().toISOString()
      const mimeType = recorder?.mimeType
        || (chunks[0] instanceof Blob ? chunks[0].type : '')
        || 'audio/webm'
      const base = `tuner-debug-${recordStartedAt.replace(/[:.]/g, '-')}`
      const audioName = `${base}${debugCaptureAudioExtension(mimeType)}`
      const metadataName = `${base}.json`
      const audioBlob = new Blob(chunks, { type: mimeType })
      const envelope = createDebugCaptureEnvelope({
        audioFile: audioName,
        backend: sessionAtStart.backend,
        capturedAt: recordStartedAt,
        completedAt,
        frames: frameSnapshots,
        isTunerListening: sessionAtStart.isListening,
        mimeType,
        selectedInputDeviceId: sessionAtStart.selectedInputDeviceId,
        trackSettings,
      })
      download(audioBlob, audioName)
      download(new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }), metadataName)
      lastFileName.value = `${audioName} + ${metadataName}`
      cleanup()
    }
    frameSnapshots = []
    recordStartedAt = new Date().toISOString()
    recordStartedMs = performance.now()
    sessionAtStart = {
      backend: props.backend,
      isListening: props.isListening,
      selectedInputDeviceId: props.selectedInputDeviceId ?? '',
    }
    recorder.start()
    recording.value = true
    window.setTimeout(() => recorder?.state === 'recording' && recorder.stop(), RECORD_SECONDS * 1000)
  } catch (error) {
    recordError.value = error instanceof Error ? error.message : 'recording failed'
    cleanup()
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

function cleanup() {
  recording.value = false
  if (recorder?.state === 'recording') {
    recorder.onstop = null
    recorder.stop()
  }
  recorder = null
  recorderStream?.getTracks().forEach((track) => track.stop())
  recorderStream = null
}

onUnmounted(cleanup)

watch(() => props.frame, (frame) => {
  if (!recording.value) return
  frameSnapshots.push(createDebugFrameSnapshot(
    frameSnapshots.length,
    performance.now() - recordStartedMs,
    frame,
  ))
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
