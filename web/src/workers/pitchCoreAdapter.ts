import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import {
  ConfidenceEvidenceEstimator,
  detectCompetingTarget,
  strongestCandidateFrequency,
} from '../domain/confidenceEvidence';
import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  pipelineConfigFingerprint,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import type { DetectionFrame, FrameContext } from '../types/frames';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../types/detectorBackend';
import {
  normalizeLevel,
  type PitchAnalysis,
  type PitchDetectionRange,
  type PitchEstimate,
  type PitchGuidance,
  type SignalStats,
} from '../utils/pitch';
import { StreamingPitchTracker } from '../utils/pitchTracking';
import { PipelineSpectralAnalyzer } from '../utils/pipelineSpectralAnalyzer';
import {
  applyFrameContext,
  applyPipelineConfig,
  readWasmFrame,
  type StatefulWasmTunerProcessor,
} from './pitchFrameCodec';

export interface WorkerPitchFrame {
  backend: PitchDetectorBackend;
  frame: DetectionFrame;
  semantics: DetectionFrameSemantics;
}

export interface PitchCoreWasmModule {
  default(): Promise<unknown> | unknown;
  TunerProcessor: new () => StatefulWasmTunerProcessor;
}

export type PitchCoreModuleLoader = (moduleUrl: string) => Promise<PitchCoreWasmModule>;
export type FallbackPitchDetector = (
  buffer: Float32Array,
  sampleRate: number,
  stats: SignalStats,
  range: PitchDetectionRange,
  guidance?: PitchGuidance,
  pipelineConfig?: PipelineConfig,
) => PitchAnalysis | PitchEstimate | null;

export class PitchCoreAdapter {
  private readonly fallback: FallbackPitchDetector;
  private fallbackGuidance: PitchGuidance | undefined;
  private readonly fallbackTracker = new StreamingPitchTracker();
  private readonly fallbackConfidence = new ConfidenceEvidenceEstimator();
  private lastMaxFrequency: number | null = null;
  private lastMinFrequency: number | null = null;
  private readonly loadModule: PitchCoreModuleLoader;
  private readonly moduleUrl: string;
  private pipelineConfig = createDefaultPipelineConfig();
  private processorPromise: Promise<StatefulWasmTunerProcessor | null> | null = null;
  private readonly spectralAnalyzer = new PipelineSpectralAnalyzer();

  constructor(
    moduleUrl: string,
    loadModule: PitchCoreModuleLoader,
    fallback: FallbackPitchDetector,
  ) {
    this.moduleUrl = moduleUrl;
    this.loadModule = loadModule;
    this.fallback = fallback;
  }

  async process(
    buffer: Float32Array,
    sampleRate: number,
    stats: SignalStats,
    range: PitchDetectionRange,
    frameContext?: FrameContext,
    pipelineConfig?: PipelineConfig,
  ): Promise<WorkerPitchFrame> {
    const rangeChanged = this.updateRange(range);
    if (rangeChanged) this.fallbackConfidence.reset();
    const pipelineChanged = pipelineConfig != null;
    if (pipelineConfig) {
      this.pipelineConfig = normalizePipelineConfig(pipelineConfig);
      this.fallbackTracker.setPipelineConfig(this.pipelineConfig);
      this.fallbackConfidence.reset();
    }
    if (frameContext) {
      this.fallbackGuidance = guidanceFromContext(frameContext);
      this.fallbackTracker.setContext(frameContext);
      this.fallbackConfidence.reset();
    }
    const processor = await this.getProcessor();
    if (!processor) return this.fallbackFrame(buffer, sampleRate, stats, range);

    try {
      if (rangeChanged) {
        processor.set_frequency_range(range.minFrequency, range.maxFrequency);
      }
      if (frameContext) applyFrameContext(processor, frameContext);
      if (pipelineChanged) applyPipelineConfig(processor, this.pipelineConfig);

      const started = nowMs();
      const wasmFrame = processor.process(buffer, sampleRate);
      try {
        this.fallbackTracker.reset();
        this.fallbackConfidence.reset();
        const frame = readWasmFrame(wasmFrame);
        frame.pipeline.processingMs = nowMs() - started;
        return {
          backend: 'wasm',
          frame,
          semantics: 'resolved',
        };
      } finally {
        wasmFrame.free();
      }
    } catch {
      this.disableProcessor(processor);
      return this.fallbackFrame(buffer, sampleRate, stats, range);
    }
  }

  async dispose(): Promise<void> {
    const pending = this.processorPromise;
    this.processorPromise = null;
    this.lastMinFrequency = null;
    this.lastMaxFrequency = null;
    this.fallbackGuidance = undefined;
    this.pipelineConfig = createDefaultPipelineConfig();
    this.fallbackTracker.reset();
    this.fallbackConfidence.reset();
    const processor = await pending?.catch(() => null);
    processor?.free();
  }

  async reset(): Promise<void> {
    this.fallbackTracker.reset();
    this.fallbackConfidence.reset();
    const processor = await this.processorPromise?.catch(() => null);
    processor?.reset();
  }

  private getProcessor() {
    if (!this.processorPromise) this.processorPromise = this.initializeProcessor();
    return this.processorPromise;
  }

  private async initializeProcessor(): Promise<StatefulWasmTunerProcessor | null> {
    if (!this.moduleUrl) return null;
    try {
      const module = await this.loadModule(this.moduleUrl);
      await module.default();
      return new module.TunerProcessor();
    } catch {
      return null;
    }
  }

  private disableProcessor(processor: StatefulWasmTunerProcessor) {
    this.processorPromise = Promise.resolve(null);
    this.fallbackTracker.reset();
    this.fallbackConfidence.reset();
    processor.free();
  }

  private fallbackFrame(
    buffer: Float32Array,
    sampleRate: number,
    stats: SignalStats,
    range: PitchDetectionRange,
  ): WorkerPitchFrame {
    const started = nowMs();
    const analysis = normalizeFallbackAnalysis(this.fallback(
      buffer,
      sampleRate,
      stats,
      range,
      this.fallbackGuidance,
      this.pipelineConfig,
    ));
    const tracked = this.fallbackTracker.update(analysis.estimate, stats);
    const trackerTelemetry = this.fallbackTracker.telemetry();
    const decision = !analysis.fixedGateOpen && !tracked
      ? 'fixed-gate-rejected'
      : trackerTelemetry.decision;
    const confidence = this.fallbackConfidence.observe({
      decision,
      noiseFloor: trackerTelemetry.noiseFloor,
      outputConfidence: tracked?.confidence ?? 0,
      rawFrequency: trackerTelemetry.selected?.frequency ?? null,
      rms: stats.rms,
      secondary: analysis.secondary,
      yin: analysis.yin,
    });
    const frame = createUnresolvedDetectionFrame({
      confidence: tracked ? confidence.calibrated : 0,
      freq: tracked?.frequency ?? null,
      rawFreq: trackerTelemetry.selected?.frequency ?? null,
      level: normalizeLevel(stats.rms),
      pipeline: {
        adaptiveGateOpen: trackerTelemetry.adaptiveGateOpen,
        arbitration: analysis.arbitration,
        confidence,
        configFingerprint: pipelineConfigFingerprint(this.pipelineConfig),
        decision,
        fixedGateOpen: analysis.fixedGateOpen,
        gateThreshold: trackerTelemetry.gateThreshold,
        held: decision === 'held',
        interference: detectCompetingTarget(
          strongestCandidateFrequency(analysis.yin, analysis.secondary),
          this.fallbackGuidance?.selectedFrequency,
          this.fallbackGuidance?.targetFrequencies ?? [],
        ),
        noiseFloor: trackerTelemetry.noiseFloor,
        sampleRate,
        secondary: analysis.secondary,
        selected: trackerTelemetry.selected,
        spectral: this.pipelineConfig.octaveEnabled
          ? this.spectralAnalyzer.analyze(
            buffer,
            sampleRate,
            analysis.estimate?.frequency,
            range,
          )
          : null,
        tracked: this.pipelineConfig.trackingEnabled && decision === 'published',
        windowSamples: buffer.length,
        yin: analysis.yin,
      },
      rms: stats.rms,
    });
    frame.pipeline.processingMs = nowMs() - started;
    return {
      backend: 'typescript',
      frame,
      semantics: 'unresolved',
    };
  }

  private updateRange(range: PitchDetectionRange) {
    const changed = range.minFrequency !== this.lastMinFrequency
      || range.maxFrequency !== this.lastMaxFrequency;
    if (changed) {
      this.lastMinFrequency = range.minFrequency;
      this.lastMaxFrequency = range.maxFrequency;
      this.fallbackTracker.setDetectionRange(range);
    }
    return changed;
  }
}

function nowMs() {
  return globalThis.performance?.now() ?? Date.now();
}

function normalizeFallbackAnalysis(
  result: PitchAnalysis | PitchEstimate | null,
): PitchAnalysis {
  if (result && 'estimate' in result) return result;
  return {
    arbitration: result ? 'yin-only' : 'none',
    estimate: result,
    fixedGateOpen: true,
    secondary: null,
    yin: result,
  };
}

function guidanceFromContext(context: FrameContext): PitchGuidance {
  return {
    selectedFrequency: context.selectedTarget?.frequency,
    targetFrequencies: context.tuningTargets.map((target) => target.frequency),
  };
}
