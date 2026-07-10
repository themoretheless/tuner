import type {
  PitchDetectionRange,
  SignalStats,
} from '../utils/pitch';

export type PitchDetectorBackend = 'typescript' | 'wasm';

export interface WorkerPitchDetection {
  backend: PitchDetectorBackend;
  confidence: number;
  frequency: number | null;
}

interface WasmPitchDetection {
  readonly confidence: number;
  readonly freq: number;
  free(): void;
}

interface StatefulWasmPitchDetector {
  detect(buffer: Float32Array, sampleRate: number): WasmPitchDetection | undefined;
  free(): void;
  set_frequency_range(minFrequency: number, maxFrequency: number): void;
}

export interface PitchCoreWasmModule {
  default(): Promise<unknown> | unknown;
  WasmPitchDetector: new () => StatefulWasmPitchDetector;
}

export type PitchCoreModuleLoader = (moduleUrl: string) => Promise<PitchCoreWasmModule>;
export type FallbackPitchDetector = (
  buffer: Float32Array,
  sampleRate: number,
  stats: SignalStats,
  range: PitchDetectionRange,
) => number | null;

export class PitchCoreAdapter {
  private detectorPromise: Promise<StatefulWasmPitchDetector | null> | null = null;
  private readonly fallback: FallbackPitchDetector;
  private lastMaxFrequency: number | null = null;
  private lastMinFrequency: number | null = null;
  private readonly loadModule: PitchCoreModuleLoader;
  private readonly moduleUrl: string;

  constructor(
    moduleUrl: string,
    loadModule: PitchCoreModuleLoader,
    fallback: FallbackPitchDetector,
  ) {
    this.moduleUrl = moduleUrl;
    this.loadModule = loadModule;
    this.fallback = fallback;
  }

  async detect(
    buffer: Float32Array,
    sampleRate: number,
    stats: SignalStats,
    range: PitchDetectionRange,
  ): Promise<WorkerPitchDetection> {
    const detector = await this.getDetector();
    if (!detector) return this.fallbackDetection(buffer, sampleRate, stats, range);

    try {
      if (
        range.minFrequency !== this.lastMinFrequency
        || range.maxFrequency !== this.lastMaxFrequency
      ) {
        detector.set_frequency_range(range.minFrequency, range.maxFrequency);
        this.lastMinFrequency = range.minFrequency;
        this.lastMaxFrequency = range.maxFrequency;
      }

      const detection = detector.detect(buffer, sampleRate);
      if (!detection) return { backend: 'wasm', confidence: 0, frequency: null };
      try {
        const detectedFrequency = Number(detection.freq);
        const frequency = Number.isFinite(detectedFrequency) && detectedFrequency > 0
          ? detectedFrequency
          : null;
        return {
          backend: 'wasm',
          confidence: frequency == null ? 0 : clamp01(Number(detection.confidence)),
          frequency,
        };
      } finally {
        detection.free();
      }
    } catch {
      this.disableDetector(detector);
      return this.fallbackDetection(buffer, sampleRate, stats, range);
    }
  }

  async dispose(): Promise<void> {
    const pending = this.detectorPromise;
    this.detectorPromise = null;
    this.lastMinFrequency = null;
    this.lastMaxFrequency = null;
    const detector = await pending?.catch(() => null);
    detector?.free();
  }

  private getDetector() {
    if (!this.detectorPromise) this.detectorPromise = this.initializeDetector();
    return this.detectorPromise;
  }

  private async initializeDetector(): Promise<StatefulWasmPitchDetector | null> {
    if (!this.moduleUrl) return null;
    try {
      const module = await this.loadModule(this.moduleUrl);
      await module.default();
      return new module.WasmPitchDetector();
    } catch {
      return null;
    }
  }

  private disableDetector(detector: StatefulWasmPitchDetector) {
    this.detectorPromise = Promise.resolve(null);
    this.lastMinFrequency = null;
    this.lastMaxFrequency = null;
    detector.free();
  }

  private fallbackDetection(
    buffer: Float32Array,
    sampleRate: number,
    stats: SignalStats,
    range: PitchDetectionRange,
  ): WorkerPitchDetection {
    const frequency = this.fallback(buffer, sampleRate, stats, range);
    return {
      backend: 'typescript',
      confidence: frequency == null ? 0 : 1,
      frequency,
    };
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
