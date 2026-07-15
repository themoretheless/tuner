import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import {
  createDefaultPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import type { DetectionFrame, FrameContext } from '../types/frames';
import {
  normalizeLevel,
  type PitchDetectionRange,
  type PitchEstimate,
  type PitchGuidance,
  type SignalStats,
} from '../utils/pitch';
import { StreamingPitchTracker } from '../utils/pitchTracking';
import {
  applyFrameContext,
  applyPipelineConfig,
  readWasmFrame,
  type StatefulWasmTunerProcessor,
} from './pitchFrameCodec';

export type PitchDetectorBackend = 'typescript' | 'wasm';
export type DetectionFrameSemantics = 'resolved' | 'unresolved';

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
) => PitchEstimate | null;

export class PitchCoreAdapter {
  private readonly fallback: FallbackPitchDetector;
  private fallbackGuidance: PitchGuidance | undefined;
  private readonly fallbackTracker = new StreamingPitchTracker();
  private lastMaxFrequency: number | null = null;
  private lastMinFrequency: number | null = null;
  private readonly loadModule: PitchCoreModuleLoader;
  private readonly moduleUrl: string;
  private pipelineConfig = createDefaultPipelineConfig();
  private processorPromise: Promise<StatefulWasmTunerProcessor | null> | null = null;

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
    const pipelineChanged = pipelineConfig != null;
    if (pipelineConfig) {
      this.pipelineConfig = normalizePipelineConfig(pipelineConfig);
      this.fallbackTracker.setPipelineConfig(this.pipelineConfig);
    }
    if (frameContext) {
      this.fallbackGuidance = guidanceFromContext(frameContext);
      this.fallbackTracker.setContext(frameContext);
    }
    const processor = await this.getProcessor();
    if (!processor) return this.fallbackFrame(buffer, sampleRate, stats, range);

    try {
      if (rangeChanged) {
        processor.set_frequency_range(range.minFrequency, range.maxFrequency);
      }
      if (frameContext) applyFrameContext(processor, frameContext);
      if (pipelineChanged) applyPipelineConfig(processor, this.pipelineConfig);

      const wasmFrame = processor.process(buffer, sampleRate);
      try {
        this.fallbackTracker.reset();
        return {
          backend: 'wasm',
          frame: readWasmFrame(wasmFrame),
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
    const processor = await pending?.catch(() => null);
    processor?.free();
  }

  async reset(): Promise<void> {
    this.fallbackTracker.reset();
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
    processor.free();
  }

  private fallbackFrame(
    buffer: Float32Array,
    sampleRate: number,
    stats: SignalStats,
    range: PitchDetectionRange,
  ): WorkerPitchFrame {
    const estimate = this.fallback(
      buffer,
      sampleRate,
      stats,
      range,
      this.fallbackGuidance,
      this.pipelineConfig,
    );
    const tracked = this.fallbackTracker.update(estimate, stats);
    return {
      backend: 'typescript',
      frame: createUnresolvedDetectionFrame({
        confidence: tracked?.confidence ?? 0,
        freq: tracked?.frequency ?? null,
        rawFreq: estimate?.frequency ?? null,
        level: normalizeLevel(stats.rms),
        rms: stats.rms,
      }),
      semantics: 'unresolved',
    };
  }

  private updateRange(range: PitchDetectionRange) {
    const changed = range.minFrequency !== this.lastMinFrequency
      || range.maxFrequency !== this.lastMaxFrequency;
    if (changed) {
      this.lastMinFrequency = range.minFrequency;
      this.lastMaxFrequency = range.maxFrequency;
      this.fallbackTracker.reset();
    }
    return changed;
  }
}

function guidanceFromContext(context: FrameContext): PitchGuidance {
  return {
    selectedFrequency: context.selectedTarget?.frequency,
    targetFrequencies: context.tuningTargets.map((target) => target.frequency),
  };
}
