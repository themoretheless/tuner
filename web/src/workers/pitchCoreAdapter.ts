import {
  createDefaultPipelineConfig,
  degradedFallbackPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import { normalizeFallbackAnalysis } from '../application/services/fallbackPitchAnalysis';
import { FallbackPitchProcessor } from '../application/services/fallbackPitchProcessor';
import type { DetectionFrame, FrameContext } from '../types/frames';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../types/detectorBackend';
import {
  type PitchAnalysis,
  type PitchDetectionRange,
  type PitchEstimate,
  type PitchGuidance,
  type SignalStats,
} from '../utils/pitch';
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
  private readonly fallbackProcessor = new FallbackPitchProcessor();
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
    this.fallbackProcessor.setPipelineConfig(
      degradedFallbackPipelineConfig(this.pipelineConfig),
    );
  }

  async process(
    buffer: Float32Array,
    sampleRate: number,
    stats: SignalStats,
    range: PitchDetectionRange,
    frameContext?: FrameContext,
    pipelineConfig?: PipelineConfig,
  ): Promise<WorkerPitchFrame> {
    const rangeChanged = this.fallbackProcessor.setDetectionRange(range);
    const pipelineChanged = pipelineConfig != null;
    if (pipelineConfig) {
      this.pipelineConfig = normalizePipelineConfig(pipelineConfig);
      this.fallbackProcessor.setPipelineConfig(
        degradedFallbackPipelineConfig(this.pipelineConfig),
      );
    }
    if (frameContext) {
      this.fallbackProcessor.setContext(frameContext);
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
        this.fallbackProcessor.reset();
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
    this.fallbackProcessor.setContext(undefined);
    this.pipelineConfig = createDefaultPipelineConfig();
    this.fallbackProcessor.setPipelineConfig(
      degradedFallbackPipelineConfig(this.pipelineConfig),
    );
    this.fallbackProcessor.reset();
    const processor = await pending?.catch(() => null);
    processor?.free();
  }

  async reset(): Promise<void> {
    this.fallbackProcessor.reset();
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
    this.fallbackProcessor.reset();
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
      this.fallbackProcessor.pitchGuidance,
      degradedFallbackPipelineConfig(this.pipelineConfig),
    ));
    const frame = this.fallbackProcessor.process({
      analysis,
      buffer,
      range,
      sampleRate,
      startedAt: started,
      stats,
    });
    return {
      backend: 'typescript',
      frame,
      semantics: 'unresolved',
    };
  }

}

function nowMs() {
  return globalThis.performance?.now() ?? Date.now();
}
