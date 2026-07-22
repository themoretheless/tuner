import { onUnmounted, ref, watch, type Ref } from 'vue';
import type { AudioFrame } from './useAudioInput';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  detectPitchWithConfidence,
  FrequencySmoother,
  computeSignalStats,
  normalizeLevel,
  type PitchDetectionResult,
  type PitchDetectionRange,
  type SignalStats,
} from '../utils/pitch';
import type { PitchWorkerRequest, PitchWorkerResponse } from '../types/pitchWorker';

const DETECTION_MISS_LIMIT = 12;
const PITCH_DETECT_INTERVAL_MS = 33;

interface DetectionJob {
  buffer: Float32Array<ArrayBuffer>;
  epoch: number;
  range: PitchDetectionRange;
  sampleRate: number;
  stats: SignalStats;
}

interface PendingDetection {
  id: number;
  job: DetectionJob;
}

export function usePitchLoop(
  readFrame: () => AudioFrame | null,
  detectionRange: Ref<PitchDetectionRange> = ref(DEFAULT_PITCH_DETECTION_RANGE),
) {
  const currentFrequency = ref<number | null>(null);
  const smoothedFrequency = ref<number | null>(null);
  const confidence = ref(0);
  const rms = ref(0);
  const volume = ref(0);

  let rafId: number | null = null;
  let missedFrames = 0;
  let lastPitchDetectAt = 0;
  let pitchWorker: Worker | null = null;
  let workerDisabled = false;
  let pendingDetection: PendingDetection | null = null;
  let queuedDetection: DetectionJob | null = null;
  let nextPitchRequestId = 0;
  let detectionEpoch = 0;
  const smoother = new FrequencySmoother();

  function ensurePitchWorker() {
    if (typeof Worker === 'undefined') return null;
    if (workerDisabled) return null;
    if (pitchWorker) return pitchWorker;

    try {
      pitchWorker = new Worker(new URL('../workers/pitchWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerDisabled = true;
      return null;
    }

    const worker = pitchWorker;
    worker.onmessage = (event) => {
      if (pitchWorker === worker) handleWorkerMessage(event);
    };
    worker.onerror = (event) => {
      if (pitchWorker !== worker) return;
      event.preventDefault?.();
      handleWorkerFailure();
    };
    worker.onmessageerror = () => {
      if (pitchWorker === worker) handleWorkerFailure();
    };
    return worker;
  }

  function disposePitchWorker() {
    if (pitchWorker) {
      pitchWorker.onmessage = null;
      pitchWorker.onerror = null;
      pitchWorker.onmessageerror = null;
      pitchWorker.terminate();
    }
    pitchWorker = null;
    pendingDetection = null;
    queuedDetection = null;
    detectionEpoch += 1;
  }

  function reset() {
    currentFrequency.value = null;
    smoothedFrequency.value = null;
    volume.value = 0;
    confidence.value = 0;
    rms.value = 0;
    missedFrames = 0;
    lastPitchDetectAt = 0;
    queuedDetection = null;
    detectionEpoch += 1;
    smoother.reset();
  }

  function applyDetectedFrequency(detection: PitchDetectionResult | null) {
    const freq = detection?.frequency ?? null;
    currentFrequency.value = freq;
    confidence.value = detection?.confidence ?? 0;

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
    rms.value = stats.rms;
    volume.value = normalizeLevel(stats.rms);

    const now = performance.now();
    const signalTooQuiet = stats.rms < 0.002 || stats.maxAbs < 0.01;
    if (signalTooQuiet) {
      detectionEpoch += 1;
      queuedDetection = null;
      applyDetectedFrequency(null);
    } else if (now - lastPitchDetectAt >= PITCH_DETECT_INTERVAL_MS) {
      lastPitchDetectAt = now;
      requestPitchDetection(frame, stats);
    }

    rafId = requestAnimationFrame(tick);
  }

  function requestPitchDetection(frame: AudioFrame, stats: SignalStats) {
    const worker = ensurePitchWorker();
    const range = {
      minFrequency: detectionRange.value.minFrequency,
      maxFrequency: detectionRange.value.maxFrequency,
    };
    if (!worker) {
      applyDetectedFrequency(detectPitchWithConfidence(frame.buffer, frame.sampleRate, stats, range));
      return;
    }

    const job: DetectionJob = {
      buffer: new Float32Array(frame.buffer) as Float32Array<ArrayBuffer>,
      epoch: detectionEpoch,
      range,
      sampleRate: frame.sampleRate,
      stats,
    };

    if (pendingDetection) {
      // At most one item waits behind the in-flight job. Replacing it makes
      // backpressure latest-wins without growing the worker queue.
      queuedDetection = job;
      return;
    }

    dispatchWorkerJob(worker, job);
  }

  function dispatchWorkerJob(worker: Worker, job: DetectionJob) {
    const id = ++nextPitchRequestId;
    pendingDetection = { id, job };
    const request: PitchWorkerRequest = {
      id,
      buffer: job.buffer.buffer,
      range: job.range,
      sampleRate: job.sampleRate,
      stats: job.stats,
    };

    try {
      // Do not transfer the buffer: retaining it lets the main thread perform
      // the same detection if the worker reports or throws an error.
      worker.postMessage(request);
    } catch {
      handleWorkerFailure();
    }
  }

  function handleWorkerMessage(event: MessageEvent<PitchWorkerResponse>) {
    const pending = pendingDetection;
    if (!pending || event.data.id !== pending.id) return;

    pendingDetection = null;
    if (pending.job.epoch === detectionEpoch) {
      const detection = event.data.error
        ? detectPitchWithConfidence(
            pending.job.buffer,
            pending.job.sampleRate,
            pending.job.stats,
            pending.job.range,
          )
        : event.data.detection;
      applyDetectedFrequency(detection);
    }
    dispatchQueuedDetection();
  }

  function handleWorkerFailure() {
    const pending = pendingDetection;
    const queued = queuedDetection;
    pitchWorker?.terminate();
    pitchWorker = null;
    workerDisabled = true;
    pendingDetection = null;
    queuedDetection = null;

    const latest = queued && queued.epoch === detectionEpoch ? queued : pending;
    const job = latest && 'job' in latest ? latest.job : latest;
    if (job && job.epoch === detectionEpoch) {
      applyDetectedFrequency(detectPitchWithConfidence(
        job.buffer,
        job.sampleRate,
        job.stats,
        job.range,
      ));
    }
  }

  function dispatchQueuedDetection() {
    const job = queuedDetection;
    queuedDetection = null;
    if (!job || job.epoch !== detectionEpoch) return;

    const worker = ensurePitchWorker();
    if (worker) {
      dispatchWorkerJob(worker, job);
    } else {
      applyDetectedFrequency(detectPitchWithConfidence(
        job.buffer,
        job.sampleRate,
        job.stats,
        job.range,
      ));
    }
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
    disposePitchWorker();
  }

  onUnmounted(() => {
    stop();
    disposePitchWorker();
  });
  watch(detectionRange, reset, { deep: true });

  return {
    confidence,
    currentFrequency,
    rms,
    smoothedFrequency,
    start,
    stop,
    reset,
    volume,
  };
}
