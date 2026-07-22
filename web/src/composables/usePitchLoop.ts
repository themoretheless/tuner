import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import { ConfidenceEvidenceEstimator } from '../domain/confidenceEvidence';
import { cloneFrameContext } from '../domain/frameContext';
import {
  createDefaultPipelineConfig,
  degradedFallbackPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import { assembleFallbackDetectionFrame } from '../application/services/fallbackFrameAssembly';
import type { AudioFrame, AudioFrameTimebase } from '../ports/audioInput';
import type { DetectionFrame, FrameContext } from '../types/frames';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../types/detectorBackend';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  analyzePitchFrame,
  computeSignalStats,
  isBelowPitchDetectionGate,
  normalizeLevel,
  type PitchDetectionRange,
  type PitchAnalysis,
  type PitchGuidance,
  type SignalStats,
} from '../utils/pitch';
import { StreamingPitchTracker } from '../utils/pitchTracking';
import { PipelineSpectralAnalyzer } from '../utils/pipelineSpectralAnalyzer';
const PITCH_DETECT_INTERVAL_MS = 33;

// How many consecutive too-quiet rAF ticks to ride out before clearing the
// readout. A decaying string hovers around the gate thresholds, and clearing
// on the first quiet tick makes the display flicker between a value and a
// dash at frame rate. ~8 ticks is roughly 130ms at 60fps; true silence still
// clears quickly, a mid-decay dip does not.
const QUIET_TICKS_BEFORE_CLEAR = 8;

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
  const confidence = computed(() => detectionFrame.value.confidence);
  const currentFrequency = computed(() => detectionFrame.value.freq);
  const smoothedFrequency = currentFrequency;

  let contextRevision = 0;
  let fallbackPitchGuidance = frameContext
    ? pitchGuidanceFromContext(frameContext.value)
    : undefined;
  let rafId: number | null = null;
  let lastPitchDetectAt = 0;
  let pitchWorker: Worker | null = null;
  let pendingPitchRequestId: number | null = null;
  let pendingPitchStartedAt: number | null = null;
  let pipelineRevision = 0;
  let sentContextRevision = -1;
  let sentPipelineRevision = -1;
  let workerTransferBuffer: ArrayBuffer | null = null;
  let pitchRequestId = 0;
  let quietTicks = 0;
  const fallbackTracker = new StreamingPitchTracker();
  const spectralAnalyzer = new PipelineSpectralAnalyzer();
  const fallbackConfidence = new ConfidenceEvidenceEstimator();
  fallbackTracker.setPipelineConfig(pipelineConfig.value);
  fallbackTracker.setDetectionRange(detectionRange.value);
  const wasmModuleUrl = resolvePitchCoreModuleUrl();

  function ensurePitchWorker() {
    if (typeof Worker === 'undefined') return null;
    if (pitchWorker) return pitchWorker;

    pitchWorker = new Worker(new URL('../workers/pitchWorker.ts', import.meta.url), { type: 'module' });
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    pitchWorker.onmessage = (event: MessageEvent<{
      backend: PitchDetectorBackend;
      buffer: ArrayBuffer;
      frame: DetectionFrame;
      id: number;
      semantics: DetectionFrameSemantics;
      timebase: AudioFrameTimebase | null;
    }>) => {
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
      fallbackTracker.reset();
      detectionFrame.value = {
        ...event.data.frame,
        pipeline: {
          ...event.data.frame.pipeline,
          roundTripMs,
        },
      };
      volume.value = event.data.frame.level;
    };
    pitchWorker.onerror = () => {
      pendingPitchRequestId = null;
      pendingPitchStartedAt = null;
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      detectionFrame.value = createUnresolvedDetectionFrame({ level: volume.value });
      fallbackTracker.reset();
      pitchRequestId += 1;
      pitchWorker?.terminate();
      pitchWorker = null;
      sentContextRevision = -1;
      sentPipelineRevision = -1;
      workerTransferBuffer = null;
    };
    return pitchWorker;
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
    lastPitchDetectAt = 0;
    pitchRequestId += 1;
    // Abandon any in-flight worker request. Its response is already stale
    // (the id was bumped above), and if it never arrives at all - a worker
    // reply lost without an onerror - a dangling pending id would block
    // every future detection request forever.
    pendingPitchRequestId = null;
    pendingPitchStartedAt = null;
    quietTicks = 0;
    fallbackTracker.reset();
    fallbackConfidence.reset();
    resetWorkerProcessor();
  }

  function resetWorkerProcessor() {
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    pitchWorker?.postMessage({ type: 'reset' });
  }

  function applyFallbackAnalysis(
    analysis: PitchAnalysis | null,
    stats: SignalStats,
    audioFrame?: AudioFrame,
    startedAt = performance.now(),
  ) {
    if (frameContext) fallbackTracker.setContext(frameContext.value);
    const nextFrame = assembleFallbackDetectionFrame(
      {
        confidence: fallbackConfidence,
        spectralAnalyzer,
        tracker: fallbackTracker,
      },
      {
        analysis,
        buffer: audioFrame?.buffer ?? null,
        fixedGateOpen: analysis?.fixedGateOpen ?? false,
        guidance: fallbackPitchGuidance,
        pipelineConfig: degradedFallbackPipelineConfig(pipelineConfig.value),
        range: detectionRange.value,
        sampleRate: audioFrame?.sampleRate ?? 0,
        stats,
      },
    );
    nextFrame.pipeline.processingMs = Math.max(0, performance.now() - startedAt);
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
    const signalTooQuiet = pipelineConfig.value.fixedGateEnabled
      && isBelowPitchDetectionGate(stats);
    if (signalTooQuiet) {
      // Hold the current reading through brief dips (a decaying string
      // crossing the gate): skip detection, keep the last frame on screen,
      // and only clear once the quiet is sustained. The one-time worker
      // reset makes sure the next note starts from a clean smoother instead
      // of blending with the note that just ended.
      quietTicks += 1;
      const shouldClear = !pipelineConfig.value.holdEnabled
        || quietTicks >= QUIET_TICKS_BEFORE_CLEAR;
      if (shouldClear) {
        const resetAt = pipelineConfig.value.holdEnabled
          ? QUIET_TICKS_BEFORE_CLEAR
          : 1;
        if (quietTicks === resetAt) resetWorkerProcessor();
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
    const worker = ensurePitchWorker();
    const range = {
      minFrequency: detectionRange.value.minFrequency,
      maxFrequency: detectionRange.value.maxFrequency,
    };
    if (!worker) {
      const startedAt = performance.now();
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      const analysis = analyzePitchFrame(
          frame.buffer,
          frame.sampleRate,
          stats,
          range,
          fallbackPitchGuidance,
          degradedFallbackPipelineConfig(pipelineConfig.value),
        );
      applyFallbackAnalysis(analysis, stats, frame, startedAt);
      return;
    }
    if (pendingPitchRequestId != null) return;

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
      }, [buffer]);
      if (shouldSendContext) sentContextRevision = contextRevision;
      if (shouldSendPipeline) sentPipelineRevision = pipelineRevision;
    } catch {
      pendingPitchRequestId = null;
      pendingPitchStartedAt = null;
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      worker.onerror = null;
      worker.terminate();
      pitchWorker = null;
      sentContextRevision = -1;
      sentPipelineRevision = -1;
      workerTransferBuffer = null;
      const startedAt = performance.now();
      const analysis = analyzePitchFrame(
          frame.buffer,
          frame.sampleRate,
          stats,
          range,
          fallbackPitchGuidance,
          degradedFallbackPipelineConfig(pipelineConfig.value),
        );
      applyFallbackAnalysis(analysis, stats, frame, startedAt);
    }
  }

  function pitchGuidanceFromContext(context: FrameContext): PitchGuidance {
    return {
      selectedFrequency: context.selectedTarget?.frequency,
      targetFrequencies: context.tuningTargets.map((target) => target.frequency),
    };
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
    fallbackTracker.setDetectionRange(range);
    reset();
  }, { deep: true });
  if (frameContext) {
    watch(frameContext, (context) => {
      fallbackPitchGuidance = pitchGuidanceFromContext(context);
      contextRevision += 1;
      reset();
    }, { deep: true });
  }
  watch(pipelineConfig, (config) => {
    fallbackTracker.setPipelineConfig(config);
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
    volume,
  };
}

function resolvePitchCoreModuleUrl() {
  if (typeof document === 'undefined') return '';
  return new URL(`${import.meta.env.BASE_URL}wasm/pitch_core.js`, document.baseURI).href;
}
