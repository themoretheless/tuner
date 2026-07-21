import { createUnresolvedDetectionFrame } from '../../domain/detectionFrame';
import { createDefaultFrameContext } from '../../domain/frameContext';
import {
  ConfidenceEvidenceEstimator,
  detectCompetingTarget,
  strongestCandidateFrequency,
} from '../../domain/confidenceEvidence';
import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  pipelineConfigFingerprint,
  type PipelineConfig,
} from '../../domain/pipelineConfig';
import type { DetectionFrame, FrameContext } from '../../types/frames';
import {
  normalizeLevel,
  type PitchAnalysis,
  type PitchDetectionRange,
  type PitchGuidance,
  type SignalStats,
} from '../../utils/pitch';
import { PipelineSpectralAnalyzer } from '../../utils/pipelineSpectralAnalyzer';
import { StreamingPitchTracker } from '../../utils/pitchTracking';

interface FallbackFrameInput {
  analysis: PitchAnalysis | null;
  buffer?: Float32Array;
  range: PitchDetectionRange;
  sampleRate: number;
  startedAt?: number;
  stats: SignalStats;
}

export class FallbackPitchProcessor {
  private readonly confidence = new ConfidenceEvidenceEstimator();
  private guidance: PitchGuidance | undefined;
  private lastRange: PitchDetectionRange | null = null;
  private pipelineConfig = createDefaultPipelineConfig();
  private readonly spectralAnalyzer = new PipelineSpectralAnalyzer();
  private readonly tracker = new StreamingPitchTracker();

  get pitchGuidance() {
    return this.guidance;
  }

  setContext(context?: FrameContext) {
    this.guidance = context ? guidanceFromContext(context) : undefined;
    this.tracker.setContext(context ?? createDefaultFrameContext());
    this.confidence.reset();
  }

  setDetectionRange(range: PitchDetectionRange) {
    const changed = range.minFrequency !== this.lastRange?.minFrequency
      || range.maxFrequency !== this.lastRange?.maxFrequency;
    if (!changed) return false;
    this.lastRange = { ...range };
    this.tracker.setDetectionRange(range);
    this.confidence.reset();
    return true;
  }

  setPipelineConfig(config: PipelineConfig) {
    this.pipelineConfig = normalizePipelineConfig(config);
    this.tracker.setPipelineConfig(this.pipelineConfig);
    this.confidence.reset();
  }

  reset() {
    this.tracker.reset();
    this.confidence.reset();
  }

  process({
    analysis,
    buffer,
    range,
    sampleRate,
    startedAt = nowMs(),
    stats,
  }: FallbackFrameInput): DetectionFrame {
    const tracked = this.tracker.update(analysis?.estimate ?? null, stats);
    const trackerTelemetry = this.tracker.telemetry();
    const fixedGateOpen = analysis?.fixedGateOpen ?? false;
    const decision = !fixedGateOpen && !tracked
      ? 'fixed-gate-rejected'
      : trackerTelemetry.decision;
    const confidence = this.confidence.observe({
      decision,
      noiseFloor: trackerTelemetry.noiseFloor,
      outputConfidence: tracked?.confidence ?? 0,
      rawFrequency: trackerTelemetry.selected?.frequency ?? null,
      rms: stats.rms,
      secondary: analysis?.secondary ?? null,
      yin: analysis?.yin ?? null,
    });
    const frame = createUnresolvedDetectionFrame({
      confidence: tracked ? confidence.calibrated : 0,
      freq: tracked?.frequency ?? null,
      rawFreq: trackerTelemetry.selected?.frequency ?? null,
      level: normalizeLevel(stats.rms),
      pipeline: {
        adaptiveGateOpen: trackerTelemetry.adaptiveGateOpen,
        arbitration: analysis?.arbitration ?? 'none',
        confidence,
        configFingerprint: pipelineConfigFingerprint(this.pipelineConfig),
        decision,
        fixedGateOpen,
        gateThreshold: trackerTelemetry.gateThreshold,
        held: decision === 'held',
        interference: detectCompetingTarget(
          strongestCandidateFrequency(analysis?.yin, analysis?.secondary),
          this.guidance?.selectedFrequency,
          this.guidance?.targetFrequencies ?? [],
        ),
        noiseFloor: trackerTelemetry.noiseFloor,
        sampleRate,
        secondary: analysis?.secondary ?? null,
        selected: trackerTelemetry.selected,
        spectral: this.pipelineConfig.octaveEnabled && buffer
          ? this.spectralAnalyzer.analyze(
            buffer,
            sampleRate,
            analysis?.estimate?.frequency,
            range,
          )
          : null,
        tracked: this.pipelineConfig.trackingEnabled && decision === 'published',
        windowSamples: buffer?.length ?? 0,
        yin: analysis?.yin ?? null,
      },
      rms: stats.rms,
    });
    frame.pipeline.processingMs = Math.max(0, nowMs() - startedAt);
    return frame;
  }
}

function guidanceFromContext(context: FrameContext): PitchGuidance {
  return {
    selectedFrequency: context.selectedTarget?.frequency,
    targetFrequencies: context.tuningTargets.map((target) => target.frequency),
  };
}

function nowMs() {
  return globalThis.performance?.now() ?? Date.now();
}
