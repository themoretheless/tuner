import { onUnmounted, ref, watch, type Ref } from 'vue';
import type { AudioFrame } from '../ports/audioInput';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  detectPitch,
  FrequencySmoother,
  computeSignalStats,
  normalizeLevel,
  type PitchDetectionRange,
} from '../utils/pitch';
import type { PitchDetectorBackend } from '../workers/pitchCoreAdapter';

const DETECTION_MISS_LIMIT = 12;
const PITCH_DETECT_INTERVAL_MS = 33;

export function usePitchLoop(
  readFrame: () => AudioFrame | null,
  detectionRange: Ref<PitchDetectionRange> = ref(DEFAULT_PITCH_DETECTION_RANGE),
) {
  const currentFrequency = ref<number | null>(null);
  const confidence = ref(0);
  const detectorBackend = ref<PitchDetectorBackend>('typescript');
  const smoothedFrequency = ref<number | null>(null);
  const volume = ref(0);

  let rafId: number | null = null;
  let missedFrames = 0;
  let lastPitchDetectAt = 0;
  let pitchWorker: Worker | null = null;
  let pendingPitchRequestId: number | null = null;
  let workerTransferBuffer: ArrayBuffer | null = null;
  let pitchRequestId = 0;
  const smoother = new FrequencySmoother();
  const wasmModuleUrl = resolvePitchCoreModuleUrl();

  function ensurePitchWorker() {
    if (typeof Worker === 'undefined') return null;
    if (pitchWorker) return pitchWorker;

    pitchWorker = new Worker(new URL('../workers/pitchWorker.ts', import.meta.url), { type: 'module' });
    pitchWorker.onmessage = (event: MessageEvent<{
      backend: PitchDetectorBackend;
      buffer: ArrayBuffer;
      confidence: number;
      id: number;
      frequency: number | null;
    }>) => {
      workerTransferBuffer = event.data.buffer;
      if (event.data.id !== pendingPitchRequestId) return;
      pendingPitchRequestId = null;
      if (event.data.id !== pitchRequestId) return;
      detectorBackend.value = event.data.backend;
      applyDetectedFrequency(event.data.frequency, event.data.confidence);
    };
    pitchWorker.onerror = () => {
      pendingPitchRequestId = null;
      detectorBackend.value = 'typescript';
      pitchWorker?.terminate();
      pitchWorker = null;
    };
    return pitchWorker;
  }

  function disposePitchWorker() {
    pitchWorker?.terminate();
    pitchWorker = null;
    pendingPitchRequestId = null;
    workerTransferBuffer = null;
    pitchRequestId += 1;
  }

  function reset() {
    confidence.value = 0;
    currentFrequency.value = null;
    smoothedFrequency.value = null;
    volume.value = 0;
    missedFrames = 0;
    lastPitchDetectAt = 0;
    pitchRequestId += 1;
    smoother.reset();
  }

  function applyDetectedFrequency(freq: number | null, nextConfidence = freq == null ? 0 : 1) {
    confidence.value = freq == null ? 0 : Math.max(0, Math.min(1, nextConfidence));
    currentFrequency.value = freq;

    if (freq == null) {
      missedFrames += 1;
      if (missedFrames >= DETECTION_MISS_LIMIT) {
        smoother.reset();
        smoothedFrequency.value = null;
      } else {
        smoothedFrequency.value = smoother.add(freq);
      }
      return;
    }

    missedFrames = 0;
    smoothedFrequency.value = smoother.add(freq);
  }

  function tick() {
    const frame = readFrame();
    if (!frame) {
      stop();
      return;
    }

    const stats = computeSignalStats(frame.buffer);
    volume.value = normalizeLevel(stats.rms);

    const now = performance.now();
    const signalTooQuiet = stats.rms < 0.002 || stats.maxAbs < 0.01;
    if (signalTooQuiet) {
      pitchRequestId += 1;
      applyDetectedFrequency(null);
    } else if (now - lastPitchDetectAt >= PITCH_DETECT_INTERVAL_MS) {
      lastPitchDetectAt = now;
      requestPitchDetection(frame, stats);
    }

    rafId = requestAnimationFrame(tick);
  }

  function requestPitchDetection(frame: AudioFrame, stats: ReturnType<typeof computeSignalStats>) {
    const worker = ensurePitchWorker();
    const range = {
      minFrequency: detectionRange.value.minFrequency,
      maxFrequency: detectionRange.value.maxFrequency,
    };
    if (!worker) {
      detectorBackend.value = 'typescript';
      applyDetectedFrequency(detectPitch(frame.buffer, frame.sampleRate, stats, range));
      return;
    }
    if (pendingPitchRequestId != null) return;

    pitchRequestId += 1;
    pendingPitchRequestId = pitchRequestId;
    const byteLength = frame.buffer.byteLength;
    const buffer = workerTransferBuffer?.byteLength === byteLength
      ? workerTransferBuffer
      : new ArrayBuffer(byteLength);
    new Float32Array(buffer).set(frame.buffer);
    workerTransferBuffer = null;
    worker.postMessage({
      id: pitchRequestId,
      buffer,
      range,
      sampleRate: frame.sampleRate,
      stats: {
        rms: stats.rms,
        maxAbs: stats.maxAbs,
      },
      wasmModuleUrl,
    }, [buffer]);
  }

  function start() {
    if (rafId != null) return;
    missedFrames = 0;
    lastPitchDetectAt = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    reset();
  }

  onUnmounted(() => {
    stop();
    disposePitchWorker();
  });
  watch(detectionRange, reset, { deep: true });

  return {
    confidence,
    currentFrequency,
    detectorBackend,
    smoothedFrequency,
    start,
    stop,
    reset,
    volume,
  };
}

function resolvePitchCoreModuleUrl() {
  if (typeof document === 'undefined') return '';
  return new URL(`${import.meta.env.BASE_URL}wasm/pitch_core.js`, document.baseURI).href;
}
