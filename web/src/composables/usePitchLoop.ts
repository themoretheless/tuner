import { onUnmounted, ref } from 'vue';
import type { AudioFrame } from './useAudioInput';
import { detectPitch, FrequencySmoother, computeSignalStats, normalizeLevel } from '../utils/pitch';

const DETECTION_MISS_LIMIT = 12;
const PITCH_DETECT_INTERVAL_MS = 33;

export function usePitchLoop(readFrame: () => AudioFrame | null) {
  const currentFrequency = ref<number | null>(null);
  const smoothedFrequency = ref<number | null>(null);
  const volume = ref(0);

  let rafId: number | null = null;
  let missedFrames = 0;
  let lastPitchDetectAt = 0;
  const smoother = new FrequencySmoother();

  function reset() {
    currentFrequency.value = null;
    smoothedFrequency.value = null;
    volume.value = 0;
    missedFrames = 0;
    lastPitchDetectAt = 0;
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
      applyDetectedFrequency(null);
    } else if (now - lastPitchDetectAt >= PITCH_DETECT_INTERVAL_MS) {
      lastPitchDetectAt = now;
      applyDetectedFrequency(detectPitch(frame.buffer, frame.sampleRate, stats));
    }

    rafId = requestAnimationFrame(tick);
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

  onUnmounted(stop);

  return {
    currentFrequency,
    smoothedFrequency,
    start,
    stop,
    reset,
    volume,
  };
}
