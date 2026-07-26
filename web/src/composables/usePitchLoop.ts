import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { FallbackPitchProcessor } from '../application/services/fallbackPitchProcessor';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import { cloneFrameContext } from '../domain/frameContext';
import {
  createDefaultPipelineConfig,
  degradedFallbackPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import {
  measureSignalHealth,
  type SignalHealthMeasurement,
} from '../domain/diagnostics';
import type { AudioFrame, AudioFrameTimebase } from '../ports/audioInput';
import type { DetectionFrame, FrameContext } from '../types/frames';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../types/detectorBackend';
import type {
  PitchWorkerRequest,
  PitchWorkerResponse,
} from '../workers/pitchWorkerProtocol';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  analyzePitchFrame,
  computeSignalStats,
  isBelowPitchDetectionGate,
  normalizeLevel,
  type PitchDetectionRange,
  type PitchAnalysis,
  type SignalStats,
} from '../utils/pitch';
const PITCH_DETECT_INTERVAL_MS = 33;
const PITCH_WORKER_TIMEOUT_MS = 1_500;

// Signal-health (silent/clipping/DC/hum) is computed at a low cadence: the
// measurement is statistical, not per-frame, and a 2 Hz refresh keeps the
// watchdog cheap while still reacting within half a second.
const SIGNAL_HEALTH_INTERVAL_MS = 500;

// How many consecutive too-quiet rAF ticks to ride out before clearing the
// readout. A decaying string hovers around the gate thresholds, and clearing
// on the first quiet tick makes the display flicker between a value and a
// dash at frame rate. ~8 ticks is roughly 130ms at 60fps; true silence still
// clears quickly, a mid-decay dip does not.
const QUIET_TICKS_BEFORE_CLEAR = 8;

// How many consecutive too-quiet rAF ticks before the worker-side processor
// (smoother/tracker) is reset. This is intentionally much earlier than
// QUIET_TICKS_BEFORE_CLEAR: the UI hold only affects what is on screen, while
// the worker keeps blending state internally. Without an early reset, a pause
// shorter than QUIET_TICKS_BEFORE_CLEAR followed by a new note makes the
// worker smoother "glue" the two notes together and the readout shows
// transitional garbage between them. ~3 ticks is roughly 50ms at 60fps —
// long enough to survive a single dropped/gated frame mid-note, short enough
// to cover any perceptible inter-note pause.
const QUIET_TICKS_BEFORE_WORKER_RESET = 3;

export function usePitchLoop(
  readFrame: () => AudioFrame | null,
  detectionRange: Ref<PitchDetectionRange> = ref(DEFAULT_PITCH_DETECTION_RANGE),
  frameContext?: Ref<FrameContext>,
  pipelineConfig: Ref<PipelineConfig> = ref(createDefaultPipelineConfig()),
) {
  const detectionFrame = ref<DetectionFrame>(createUnresolvedDetectionFrame());
  const detectorBackend = ref<PitchDetectorBackend>('typescript');
  const frameSemantics = ref<DetectionFrameSemantics>('unresolved');
  const frameTimebase = ref<AudioFrameTimebase | null>(null);
  const volume = ref(0);
  const signalHealth = ref<SignalHealthMeasurement | null>(null);
  const confidence = computed(() => detectionFrame.value.confidence);
  const currentFrequency = computed(() => detectionFrame.value.freq);
  const smoothedFrequency = currentFrequency;

  let contextRevision = 0;
  let rafId: number | null = null;
  let lastPitchDetectAt = 0;
  let pitchWorker: Worker | null = null;
  let workerDisabled = false;
  let pendingPitchRequestId: number | null = null;
  let pendingPitchStartedAt: number | null = null;
  let pipelineRevision = 0;
  let sentContextRevision = -1;
  let sentPipelineRevision = -1;
  let workerTransferBuffer: ArrayBuffer | null = null;
  let pitchRequestId = 0;
  let quietTicks = 0;
  let lastSignalHealthAt = 0;
  const fallbackProcessor = new FallbackPitchProcessor();
  fallbackProcessor.setPipelineConfig(
    degradedFallbackPipelineConfig(pipelineConfig.value),
  );
  fallbackProcessor.setDetectionRange(detectionRange.value);
  fallbackProcessor.setContext(frameContext?.value);
  const wasmModuleUrl = resolvePitchCoreModuleUrl();

  function ensurePitchWorker() {
    if (workerDisabled || typeof Worker === 'undefined') return null;
    if (pitchWorker) return pitchWorker;

    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/pitchWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerDisabled = true;
      return null;
    }
    pitchWorker = worker;
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    worker.onmessage = (event: MessageEvent<PitchWorkerResponse>) => {
      workerTransferBuffer = event.data.buffer;
      if (event.data.id !== pendingPitchRequestId) return;
      pendingPitchRequestId = null;
      const roundTripMs = pendingPitchStartedAt == null
        ? 0
        : Math.max(0, performance.now() - pendingPitchStartedAt);
      pendingPitchStartedAt = null;
      if (event.data.id !== pitchRequestId) return;
      detectorBackend.value = event.data.backend;
      frameSemantics.value = event.data.semantics;
      frameTimebase.value = event.data.timebase;
      fallbackProcessor.reset();
      detectionFrame.value = {
        ...event.data.frame,
        pipeline: {
          ...event.data.frame.pipeline,
          roundTripMs,
        },
      };
      volume.value = event.data.frame.level;
    };
    const handleWorkerFailure = () => {
      if (pitchWorker !== worker) return;
      disablePitchWorker();
      detectionFrame.value = createUnresolvedDetectionFrame({ level: volume.value });
      fallbackProcessor.reset();
    };
    worker.onerror = handleWorkerFailure;
    worker.onmessageerror = handleWorkerFailure;
    return worker;
  }

  function disablePitchWorker() {
    workerDisabled = true;
    pitchWorker?.terminate();
    pitchWorker = null;
    pendingPitchRequestId = null;
    pendingPitchStartedAt = null;
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    workerTransferBuffer = null;
    detectorBackend.value = 'typescript';
    frameSemantics.value = 'unresolved';
    pitchRequestId += 1;
  }

  function disposePitchWorker() {
    pitchWorker?.terminate();
    pitchWorker = null;
    pendingPitchRequestId = null;
    pendingPitchStartedAt = null;
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    workerTransferBuffer = null;
    pitchRequestId += 1;
  }

  function reset() {
    detectionFrame.value = createUnresolvedDetectionFrame();
    frameSemantics.value = 'unresolved';
    frameTimebase.value = null;
    volume.value = 0;
    signalHealth.value = null;
    lastSignalHealthAt = 0;
    lastPitchDetectAt = Number.NEGATIVE_INFINITY;
    pitchRequestId += 1;
    pendingPitchRequestId = null;
    pendingPitchStartedAt = null;
    quietTicks = 0;
    fallbackProcessor.reset();
    resetWorkerProcessor();
  }

  function resetWorkerProcessor() {
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    if (!pitchWorker) return;
    try {
      pitchWorker.postMessage({ type: 'reset' } satisfies PitchWorkerRequest);
    } catch {
      disablePitchWorker();
    }
  }

  function applyFallbackAnalysis(
    analysis: PitchAnalysis | null,
    stats: SignalStats,
    audioFrame?: AudioFrame,
    startedAt = performance.now(),
  ) {
    const nextFrame = fallbackProcessor.process({
      analysis,
      buffer: audioFrame?.buffer,
      range: detectionRange.value,
      sampleRate: audioFrame?.sampleRate ?? 0,
      startedAt,
      stats,
    });
    frameSemantics.value = 'unresolved';
    frameTimebase.value = audioFrame?.timebase ?? null;
    detectionFrame.value = nextFrame;
  }

  function tick() {
    const frame = readFrame();
    if (!frame) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const stats = computeSignalStats(frame.buffer);
    volume.value = normalizeLevel(stats.rms);

    const now = performance.now();
    if (now - lastSignalHealthAt >= SIGNAL_HEALTH_INTERVAL_MS) {
      lastSignalHealthAt = now;
      signalHealth.value = measureSignalHealth(frame.buffer, frame.sampleRate);
    }
    const signalTooQuiet = pipelineConfig.value.fixedGateEnabled
      && isBelowPitchDetectionGate(stats);
    if (signalTooQuiet) {
      // Two independent thresholds while the signal is quiet:
      // 1) Processor reset (early): the worker smoother/tracker must forget
      //    the ending note quickly, otherwise a new note after a short pause
      //    (< QUIET_TICKS_BEFORE_CLEAR) blends with it and the readout shows
      //    transitional garbage between the notes.
      // 2) UI clear (late): the display holds the last reading through brief
      //    dips so a decaying string does not flicker between a value and a
      //    dash; only sustained quiet clears the screen.
      quietTicks += 1;
      const resetAt = pipelineConfig.value.holdEnabled
        ? QUIET_TICKS_BEFORE_WORKER_RESET
        : 1;
      if (quietTicks === resetAt) resetWorkerProcessor();
      const shouldClear = !pipelineConfig.value.holdEnabled
        || quietTicks >= QUIET_TICKS_BEFORE_CLEAR;
      if (shouldClear) {
        pitchRequestId += 1;
        applyFallbackAnalysis(null, stats, frame);
      }
    } else {
      quietTicks = 0;
      if (now - lastPitchDetectAt >= PITCH_DETECT_INTERVAL_MS) {
        lastPitchDetectAt = now;
        requestPitchDetection(frame, stats);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function requestPitchDetection(frame: AudioFrame, stats: SignalStats) {
    const range = {
      minFrequency: detectionRange.value.minFrequency,
      maxFrequency: detectionRange.value.maxFrequency,
    };
    if (pendingPitchRequestId != null) {
      const pendingFor = pendingPitchStartedAt == null
        ? 0
        : performance.now() - pendingPitchStartedAt;
      if (pendingFor < PITCH_WORKER_TIMEOUT_MS) return;
      disablePitchWorker();
    }
    const worker = ensurePitchWorker();
    if (!worker) {
      const startedAt = performance.now();
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      const analysis = analyzePitchFrame(
          frame.buffer,
          frame.sampleRate,
          stats,
          range,
          fallbackProcessor.pitchGuidance,
          degradedFallbackPipelineConfig(pipelineConfig.value),
        );
      applyFallbackAnalysis(analysis, stats, frame, startedAt);
      return;
    }
    pitchRequestId += 1;
    pendingPitchRequestId = pitchRequestId;
    pendingPitchStartedAt = performance.now();
    const byteLength = frame.buffer.byteLength;
    const buffer = workerTransferBuffer?.byteLength === byteLength
      ? workerTransferBuffer
      : new ArrayBuffer(byteLength);
    new Float32Array(buffer).set(frame.buffer);
    workerTransferBuffer = null;
    const shouldSendContext = frameContext && sentContextRevision !== contextRevision;
    const shouldSendPipeline = sentPipelineRevision !== pipelineRevision;
    try {
      worker.postMessage({
        type: 'process',
        id: pitchRequestId,
        buffer,
        frameContext: shouldSendContext ? cloneFrameContext(frameContext.value) : undefined,
        pipelineConfig: shouldSendPipeline
          ? normalizePipelineConfig(pipelineConfig.value)
          : undefined,
        range,
        sampleRate: frame.sampleRate,
        stats: {
          rms: stats.rms,
          maxAbs: stats.maxAbs,
        },
        timebase: frame.timebase,
        wasmModuleUrl,
      } satisfies PitchWorkerRequest, [buffer]);
      if (shouldSendContext) sentContextRevision = contextRevision;
      if (shouldSendPipeline) sentPipelineRevision = pipelineRevision;
    } catch {
      disablePitchWorker();
      const startedAt = performance.now();
      const analysis = analyzePitchFrame(
          frame.buffer,
          frame.sampleRate,
          stats,
          range,
          fallbackProcessor.pitchGuidance,
          degradedFallbackPipelineConfig(pipelineConfig.value),
        );
      applyFallbackAnalysis(analysis, stats, frame, startedAt);
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
  watch(detectionRange, (range) => {
    fallbackProcessor.setDetectionRange(range);
    reset();
  }, { deep: true });
  if (frameContext) {
    watch(frameContext, (context) => {
      fallbackProcessor.setContext(context);
      contextRevision += 1;
      reset();
    }, { deep: true });
  }
  watch(pipelineConfig, (config) => {
    fallbackProcessor.setPipelineConfig(degradedFallbackPipelineConfig(config));
    pipelineRevision += 1;
    reset();
  }, { deep: true });

  return {
    confidence,
    currentFrequency,
    detectionFrame,
    detectorBackend,
    frameSemantics,
    frameTimebase,
    smoothedFrequency,
    start,
    stop,
    reset,
    signalHealth,
    volume,
  };
}

function resolvePitchCoreModuleUrl() {
  if (typeof document === 'undefined') return '';
  return new URL(`${import.meta.env.BASE_URL}wasm/pitch_core.js`, document.baseURI).href;
}
