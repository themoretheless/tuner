import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import { cloneFrameContext } from '../domain/frameContext';
import type { AudioFrame } from '../ports/audioInput';
import type { DetectionFrame, FrameContext } from '../types/frames';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  FrequencySmoother,
  computeSignalStats,
  detectPitchEstimate,
  normalizeLevel,
  type PitchDetectionRange,
  type PitchEstimate,
  type SignalStats,
} from '../utils/pitch';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../workers/pitchCoreAdapter';

const PITCH_DETECT_INTERVAL_MS = 33;

export function usePitchLoop(
  readFrame: () => AudioFrame | null,
  detectionRange: Ref<PitchDetectionRange> = ref(DEFAULT_PITCH_DETECTION_RANGE),
  frameContext?: Ref<FrameContext>,
) {
  const detectionFrame = ref<DetectionFrame>(createUnresolvedDetectionFrame());
  const detectorBackend = ref<PitchDetectorBackend>('typescript');
  const frameSemantics = ref<DetectionFrameSemantics>('unresolved');
  const volume = ref(0);
  const confidence = computed(() => detectionFrame.value.confidence);
  const currentFrequency = computed(() => detectionFrame.value.freq);
  const smoothedFrequency = currentFrequency;

  let contextRevision = 0;
  let rafId: number | null = null;
  let lastPitchDetectAt = 0;
  let pitchWorker: Worker | null = null;
  let pendingPitchRequestId: number | null = null;
  let sentContextRevision = -1;
  let workerTransferBuffer: ArrayBuffer | null = null;
  let pitchRequestId = 0;
  const fallbackSmoother = new FrequencySmoother();
  const wasmModuleUrl = resolvePitchCoreModuleUrl();

  function ensurePitchWorker() {
    if (typeof Worker === 'undefined') return null;
    if (pitchWorker) return pitchWorker;

    pitchWorker = new Worker(new URL('../workers/pitchWorker.ts', import.meta.url), { type: 'module' });
    sentContextRevision = -1;
    pitchWorker.onmessage = (event: MessageEvent<{
      backend: PitchDetectorBackend;
      buffer: ArrayBuffer;
      frame: DetectionFrame;
      id: number;
      semantics: DetectionFrameSemantics;
    }>) => {
      workerTransferBuffer = event.data.buffer;
      if (event.data.id !== pendingPitchRequestId) return;
      pendingPitchRequestId = null;
      if (event.data.id !== pitchRequestId) return;
      detectorBackend.value = event.data.backend;
      frameSemantics.value = event.data.semantics;
      fallbackSmoother.reset();
      detectionFrame.value = event.data.frame;
      volume.value = event.data.frame.level;
    };
    pitchWorker.onerror = () => {
      pendingPitchRequestId = null;
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      detectionFrame.value = createUnresolvedDetectionFrame({ level: volume.value });
      fallbackSmoother.reset();
      pitchRequestId += 1;
      pitchWorker?.terminate();
      pitchWorker = null;
      sentContextRevision = -1;
      workerTransferBuffer = null;
    };
    return pitchWorker;
  }

  function disposePitchWorker() {
    pitchWorker?.terminate();
    pitchWorker = null;
    pendingPitchRequestId = null;
    sentContextRevision = -1;
    workerTransferBuffer = null;
    pitchRequestId += 1;
  }

  function reset() {
    detectionFrame.value = createUnresolvedDetectionFrame();
    frameSemantics.value = 'unresolved';
    volume.value = 0;
    lastPitchDetectAt = 0;
    pitchRequestId += 1;
    fallbackSmoother.reset();
    pitchWorker?.postMessage({ type: 'reset' });
  }

  function applyFallbackEstimate(estimate: PitchEstimate | null, stats: SignalStats) {
    const frequency = fallbackSmoother.add(estimate?.frequency ?? null);
    detectionFrame.value = createUnresolvedDetectionFrame({
      confidence: frequency == null ? 0 : estimate?.confidence,
      freq: frequency,
      level: normalizeLevel(stats.rms),
      rms: stats.rms,
    });
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
      applyFallbackEstimate(null, stats);
    }
    if (now - lastPitchDetectAt >= PITCH_DETECT_INTERVAL_MS) {
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
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      applyFallbackEstimate(detectPitchEstimate(frame.buffer, frame.sampleRate, stats, range), stats);
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
    const shouldSendContext = frameContext && sentContextRevision !== contextRevision;
    try {
      worker.postMessage({
        type: 'process',
        id: pitchRequestId,
        buffer,
        frameContext: shouldSendContext ? cloneFrameContext(frameContext.value) : undefined,
        range,
        sampleRate: frame.sampleRate,
        stats: {
          rms: stats.rms,
          maxAbs: stats.maxAbs,
        },
        wasmModuleUrl,
      }, [buffer]);
      if (shouldSendContext) sentContextRevision = contextRevision;
    } catch {
      pendingPitchRequestId = null;
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      worker.onerror = null;
      worker.terminate();
      pitchWorker = null;
      sentContextRevision = -1;
      workerTransferBuffer = null;
      applyFallbackEstimate(detectPitchEstimate(frame.buffer, frame.sampleRate, stats, range), stats);
    }
  }

  function start() {
    if (rafId != null) return;
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
  if (frameContext) {
    watch(frameContext, () => {
      contextRevision += 1;
      reset();
    }, { deep: true });
  }

  return {
    confidence,
    currentFrequency,
    detectionFrame,
    detectorBackend,
    frameSemantics,
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
