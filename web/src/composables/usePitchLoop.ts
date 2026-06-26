import { onUnmounted, ref, watch, type Ref } from 'vue';
import type { AudioFrame } from './useAudioInput';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  detectPitch,
  FrequencySmoother,
  computeSignalStats,
  normalizeLevel,
  type PitchDetectionRange,
} from '../utils/pitch';

const DETECTION_MISS_LIMIT = 12;
const PITCH_DETECT_INTERVAL_MS = 33;

export function usePitchLoop(
  readFrame: () => AudioFrame | null,
  detectionRange: Ref<PitchDetectionRange> = ref(DEFAULT_PITCH_DETECTION_RANGE),
) {
  const currentFrequency = ref<number | null>(null);
  const smoothedFrequency = ref<number | null>(null);
  const volume = ref(0);

  let rafId: number | null = null;
  let missedFrames = 0;
  let lastPitchDetectAt = 0;
  let pitchWorker: Worker | null = null;
  let pitchWorkerPending = false;
  let pitchRequestId = 0;
  const smoother = new FrequencySmoother();

  function ensurePitchWorker() {
    if (typeof Worker === 'undefined') return null;
    if (pitchWorker) return pitchWorker;

    pitchWorker = new Worker(new URL('../workers/pitchWorker.ts', import.meta.url), { type: 'module' });
    pitchWorker.onmessage = (event: MessageEvent<{ id: number; frequency: number | null }>) => {
      pitchWorkerPending = false;
      if (event.data.id !== pitchRequestId) return;
      applyDetectedFrequency(event.data.frequency);
    };
    pitchWorker.onerror = () => {
      pitchWorkerPending = false;
      pitchWorker?.terminate();
      pitchWorker = null;
    };
    return pitchWorker;
  }

  function disposePitchWorker() {
    pitchWorker?.terminate();
    pitchWorker = null;
    pitchWorkerPending = false;
    pitchRequestId += 1;
  }

  function reset() {
    currentFrequency.value = null;
    smoothedFrequency.value = null;
    volume.value = 0;
    missedFrames = 0;
    lastPitchDetectAt = 0;
    pitchWorkerPending = false;
    pitchRequestId += 1;
    smoother.reset();
  }

  function applyDetectedFrequency(freq: number | null) {
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
      pitchWorkerPending = false;
      applyDetectedFrequency(null);
    } else if (now - lastPitchDetectAt >= PITCH_DETECT_INTERVAL_MS) {
      lastPitchDetectAt = now;
      requestPitchDetection(frame, stats);
    }

    rafId = requestAnimationFrame(tick);
  }

  function requestPitchDetection(frame: AudioFrame, stats: ReturnType<typeof computeSignalStats>) {
    const worker = ensurePitchWorker();
    if (!worker) {
      applyDetectedFrequency(detectPitch(frame.buffer, frame.sampleRate, stats, detectionRange.value));
      return;
    }
    if (pitchWorkerPending) return;

    pitchWorkerPending = true;
    pitchRequestId += 1;
    const buffer = frame.buffer.buffer.slice(0);
    worker.postMessage({
      id: pitchRequestId,
      buffer,
      range: detectionRange.value,
      sampleRate: frame.sampleRate,
      stats,
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
    currentFrequency,
    smoothedFrequency,
    start,
    stop,
    reset,
    volume,
  };
}
