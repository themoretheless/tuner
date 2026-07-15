import {
  computeSignalStats,
  detectPitchEstimate,
  normalizeLevel,
  type PitchDetectionRange,
  type SignalStats,
} from '../utils/pitch';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import type { FrameContext } from '../types/frames';
import type { PipelineConfig } from '../domain/pipelineConfig';
import {
  PitchCoreAdapter,
  type PitchCoreWasmModule,
  type WorkerPitchFrame,
} from './pitchCoreAdapter';

interface PitchRequest {
  type: 'process';
  id: number;
  buffer: ArrayBuffer;
  frameContext?: FrameContext;
  pipelineConfig?: PipelineConfig;
  range: PitchDetectionRange;
  sampleRate: number;
  stats?: SignalStats;
  wasmModuleUrl: string;
}

interface ResetRequest {
  type: 'reset';
}

interface PitchResponse extends WorkerPitchFrame {
  buffer: ArrayBuffer;
  id: number;
}

let adapter: PitchCoreAdapter | null = null;
let adapterModuleUrl = '';

self.onmessage = async (event: MessageEvent<PitchRequest | ResetRequest>) => {
  if (event.data.type === 'reset') {
    await adapter?.reset();
    return;
  }
  const {
    id,
    buffer,
    frameContext,
    pipelineConfig,
    range,
    sampleRate,
    stats,
    wasmModuleUrl,
  } = event.data;
  const frame = new Float32Array(buffer);
  const signalStats = stats ?? computeSignalStats(frame);
  let detection: WorkerPitchFrame;
  try {
    detection = await getAdapter(wasmModuleUrl).process(
      frame,
      sampleRate,
      signalStats,
      range,
      frameContext,
      pipelineConfig,
    );
  } catch {
    detection = {
      backend: 'typescript',
      frame: createUnresolvedDetectionFrame({
        level: normalizeLevel(signalStats.rms),
        rms: signalStats.rms,
      }),
      semantics: 'unresolved',
    };
  }
  self.postMessage({ id, buffer, ...detection } satisfies PitchResponse, { transfer: [buffer] });
};

function getAdapter(moduleUrl: string) {
  if (adapter && adapterModuleUrl === moduleUrl) return adapter;
  if (adapter) void adapter.dispose();
  adapterModuleUrl = moduleUrl;
  adapter = new PitchCoreAdapter(
    moduleUrl,
    loadPitchCore,
    (buffer, sampleRate, stats, range, guidance, pipelineConfig) => (
      detectPitchEstimate(buffer, sampleRate, stats, range, guidance, pipelineConfig)
    ),
  );
  return adapter;
}

async function loadPitchCore(moduleUrl: string): Promise<PitchCoreWasmModule> {
  return await import(/* @vite-ignore */ moduleUrl) as PitchCoreWasmModule;
}

export {};
