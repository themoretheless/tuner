import {
  createDefaultPipelineConfig,
  degradedFallbackPipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
} from '../domain/pipelineConfig';
import { ANALYSIS_WINDOWS } from '../generated/analysisWindows';
import { normalizeFallbackAnalysis } from '../application/services/fallbackPitchAnalysis';
import { FallbackPitchProcessor } from '../application/services/fallbackPitchProcessor';
import type { DetectionFrame, FrameContext } from '../types/frames';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../types/detectorBackend';
import {
  computeSignalStats,
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

// Canonical lane set pushed into the WASM processor right after creation.
// Generated from pitch-core/src/windows.rs (see
// scripts/generate-analysis-windows.mjs); the Rust constructor already
// defaults to the same set, so this is a belt-and-braces re-assertion that
// keeps the WASM and TypeScript fallback paths on identical lanes.
const STANDARD_ANALYSIS_WINDOWS = Uint32Array.from(ANALYSIS_WINDOWS.standardWindows);

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
      const processor = new module.TunerProcessor();
      processor.set_analysis_windows(STANDARD_ANALYSIS_WINDOWS);
      return processor;
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
    // Lane selection mirrors the Rust engine: the guided/chromatic choice
    // happens once per frame, before detection; a lane shorter than the
    // frame analyzes the frame's tail.
    const lane = this.fallbackProcessor.selectAnalysisLane(sampleRate, buffer.length);
    let analysis = this.runFallback(buffer, sampleRate, stats, range, lane.windowSamples);
    let usedWindowSamples = lane.windowSamples;
    // Short-lane miss fallback: when the chosen short lane produced no
    // estimate (a decaying note can drop below its fixed gate while the full
    // frame still holds energy), retry once on the longest lane. The active
    // lane is unchanged, so the next frame still prefers the fast lane.
    if (!analysis.estimate && !lane.isLongest) {
      const retry = this.runFallback(buffer, sampleRate, stats, range, lane.longestWindowSamples);
      if (retry.estimate) {
        analysis = retry;
        usedWindowSamples = lane.longestWindowSamples;
      }
    }
    const frame = this.fallbackProcessor.process({
      analysis,
      buffer,
      range,
      sampleRate,
      startedAt: started,
      stats,
      windowSamples: usedWindowSamples,
    });
    return {
      backend: 'typescript',
      frame,
      semantics: 'unresolved',
    };
  }

  private runFallback(
    buffer: Float32Array,
    sampleRate: number,
    stats: SignalStats,
    range: PitchDetectionRange,
    windowSamples: number,
  ) {
    const window = Math.min(windowSamples, buffer.length);
    const analysis = window === buffer.length
      ? buffer
      : buffer.subarray(buffer.length - window);
    // The fixed gate must see the lane slice's own energy, like the Rust
    // detector does; full-frame stats only apply to a full-frame lane.
    const analysisStats = analysis === buffer ? stats : computeSignalStats(analysis);
    return normalizeFallbackAnalysis(this.fallback(
      analysis,
      sampleRate,
      analysisStats,
      range,
      this.fallbackProcessor.pitchGuidance,
      degradedFallbackPipelineConfig(this.pipelineConfig),
    ));
  }

}

function nowMs() {
  return globalThis.performance?.now() ?? Date.now();
}
