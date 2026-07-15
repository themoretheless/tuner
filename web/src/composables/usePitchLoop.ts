import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import { cloneFrameContext } from '../domain/frameContext';
import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import type { AudioFrame } from '../ports/audioInput';
import type { DetectionFrame, FrameContext } from '../types/frames';
import {
  DEFAULT_PITCH_DETECTION_RANGE,
  computeSignalStats,
  detectPitchEstimate,
  isBelowPitchDetectionGate,
  normalizeLevel,
  type PitchDetectionRange,
  type PitchEstimate,
  type PitchGuidance,
  type SignalStats,
} from '../utils/pitch';
import { StreamingPitchTracker } from '../utils/pitchTracking';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../workers/pitchCoreAdapter';

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
  let pipelineRevision = 0;
  let sentContextRevision = -1;
  let sentPipelineRevision = -1;
  let workerTransferBuffer: ArrayBuffer | null = null;
  let pitchRequestId = 0;
  let quietTicks = 0;
  const fallbackTracker = new StreamingPitchTracker();
  fallbackTracker.setPipelineConfig(pipelineConfig.value);
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
    }>) => {
      workerTransferBuffer = event.data.buffer;
      if (event.data.id !== pendingPitchRequestId) return;
      pendingPitchRequestId = null;
      if (event.data.id !== pitchRequestId) return;
      detectorBackend.value = event.data.backend;
      frameSemantics.value = event.data.semantics;
      fallbackTracker.reset();
      detectionFrame.value = event.data.frame;
      volume.value = event.data.frame.level;
    };
    pitchWorker.onerror = () => {
      pendingPitchRequestId = null;
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
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    workerTransferBuffer = null;
    pitchRequestId += 1;
  }

  function reset() {
    detectionFrame.value = createUnresolvedDetectionFrame();
    frameSemantics.value = 'unresolved';
    volume.value = 0;
    lastPitchDetectAt = 0;
    pitchRequestId += 1;
    quietTicks = 0;
    fallbackTracker.reset();
    resetWorkerProcessor();
  }

  function resetWorkerProcessor() {
    sentContextRevision = -1;
    sentPipelineRevision = -1;
    pitchWorker?.postMessage({ type: 'reset' });
  }

  function applyFallbackEstimate(estimate: PitchEstimate | null, stats: SignalStats) {
    if (frameContext) fallbackTracker.setContext(frameContext.value);
    const tracked = fallbackTracker.update(estimate, stats);
    detectionFrame.value = createUnresolvedDetectionFrame({
      confidence: tracked?.confidence ?? 0,
      freq: tracked?.frequency ?? null,
      rawFreq: estimate?.frequency ?? null,
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
        applyFallbackEstimate(null, stats);
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
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      applyFallbackEstimate(
        detectPitchEstimate(
          frame.buffer,
          frame.sampleRate,
          stats,
          range,
          fallbackPitchGuidance,
          pipelineConfig.value,
        ),
        stats,
      );
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
        wasmModuleUrl,
      }, [buffer]);
      if (shouldSendContext) sentContextRevision = contextRevision;
      if (shouldSendPipeline) sentPipelineRevision = pipelineRevision;
    } catch {
      pendingPitchRequestId = null;
      detectorBackend.value = 'typescript';
      frameSemantics.value = 'unresolved';
      worker.onerror = null;
      worker.terminate();
      pitchWorker = null;
      sentContextRevision = -1;
      sentPipelineRevision = -1;
      workerTransferBuffer = null;
      applyFallbackEstimate(
        detectPitchEstimate(
          frame.buffer,
          frame.sampleRate,
          stats,
          range,
          fallbackPitchGuidance,
          pipelineConfig.value,
        ),
        stats,
      );
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
  watch(detectionRange, reset, { deep: true });
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
