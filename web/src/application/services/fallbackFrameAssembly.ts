import { createUnresolvedDetectionFrame } from '../../domain/detectionFrame';
import {
  type ConfidenceEvidenceEstimator,
  detectCompetingTarget,
  strongestCandidateFrequency,
} from '../../domain/confidenceEvidence';
import {
  pipelineConfigFingerprint,
  type PipelineConfig,
} from '../../domain/pipelineConfig';
import type { DetectionFrame } from '../../types/frames';
import {
  normalizeLevel,
  type PitchAnalysis,
  type PitchDetectionRange,
  type PitchGuidance,
  type SignalStats,
} from '../../utils/pitch';
import type { StreamingPitchTracker } from '../../utils/pitchTracking';
import type { PipelineSpectralAnalyzer } from '../../utils/pipelineSpectralAnalyzer';

/// Stateful helpers owned by the caller: the tracker, confidence estimator
/// and spectral analyzer carry history across frames, so each execution
/// environment (worker adapter, main-thread loop) keeps its own instances.
export interface FallbackFrameMachinery {
  confidence: ConfidenceEvidenceEstimator;
  spectralAnalyzer: PipelineSpectralAnalyzer;
  tracker: StreamingPitchTracker;
}

export interface FallbackFrameInput {
  analysis: PitchAnalysis | null;
  buffer: Float32Array | null;
  fixedGateOpen: boolean;
  guidance: PitchGuidance | undefined;
  pipelineConfig: PipelineConfig;
  range: PitchDetectionRange;
  sampleRate: number;
  stats: SignalStats;
}

// Single assembly point for TypeScript-fallback detection frames. The worker
// adapter (WASM unavailable) and the main-thread loop (Worker unavailable)
// both build their frames here so the two environments cannot drift apart.
export function assembleFallbackDetectionFrame(
  machinery: FallbackFrameMachinery,
  input: FallbackFrameInput,
): DetectionFrame {
  const { analysis, stats } = input;
  const tracked = machinery.tracker.update(analysis?.estimate ?? null, stats);
  const trackerTelemetry = machinery.tracker.telemetry();
  const decision = !input.fixedGateOpen && !tracked
    ? 'fixed-gate-rejected'
    : trackerTelemetry.decision;
  const confidence = machinery.confidence.observe({
    decision,
    noiseFloor: trackerTelemetry.noiseFloor,
    outputConfidence: tracked?.confidence ?? 0,
    rawFrequency: trackerTelemetry.selected?.frequency ?? null,
    rms: stats.rms,
    secondary: analysis?.secondary ?? null,
    yin: analysis?.yin ?? null,
  });
  return createUnresolvedDetectionFrame({
    confidence: tracked ? confidence.calibrated : 0,
    freq: tracked?.frequency ?? null,
    rawFreq: trackerTelemetry.selected?.frequency ?? null,
    level: normalizeLevel(stats.rms),
    pipeline: {
      adaptiveGateOpen: trackerTelemetry.adaptiveGateOpen,
      arbitration: analysis?.arbitration ?? 'none',
      confidence,
      configFingerprint: pipelineConfigFingerprint(input.pipelineConfig),
      decision,
      fixedGateOpen: input.fixedGateOpen,
      gateThreshold: trackerTelemetry.gateThreshold,
      held: decision === 'held',
      interference: detectCompetingTarget(
        strongestCandidateFrequency(analysis?.yin, analysis?.secondary),
        input.guidance?.selectedFrequency,
        input.guidance?.targetFrequencies ?? [],
      ),
      noiseFloor: trackerTelemetry.noiseFloor,
      sampleRate: input.sampleRate,
      secondary: analysis?.secondary ?? null,
      selected: trackerTelemetry.selected,
      spectral: input.pipelineConfig.octaveEnabled && input.buffer
        ? machinery.spectralAnalyzer.analyze(
          input.buffer,
          input.sampleRate,
          analysis?.estimate?.frequency,
          input.range,
        )
        : null,
      tracked: input.pipelineConfig.trackingEnabled && decision === 'published',
      windowSamples: input.buffer?.length ?? 0,
      yin: analysis?.yin ?? null,
    },
    rms: stats.rms,
  });
}
