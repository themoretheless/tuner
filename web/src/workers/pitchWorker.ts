import {
  analyzePitchFrame,
  computeSignalStats,
  normalizeLevel,
} from '../utils/pitch';
import { createUnresolvedDetectionFrame } from '../domain/detectionFrame';
import {
  PitchCoreAdapter,
  type PitchCoreWasmModule,
  type WorkerPitchFrame,
} from './pitchCoreAdapter';
import type { PitchWorkerRequest, PitchWorkerResponse } from './pitchWorkerProtocol';

let adapter: PitchCoreAdapter | null = null;
let adapterModuleUrl = '';

self.onmessage = async (event: MessageEvent<PitchWorkerRequest>) => {
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
    timebase,
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
  self.postMessage(
    { id, buffer, timebase, ...detection } satisfies PitchWorkerResponse,
    { transfer: [buffer] },
  );
};

function getAdapter(moduleUrl: string) {
  if (adapter && adapterModuleUrl === moduleUrl) return adapter;
  if (adapter) void adapter.dispose();
  adapterModuleUrl = moduleUrl;
  adapter = new PitchCoreAdapter(
    moduleUrl,
    loadPitchCore,
    (buffer, sampleRate, stats, range, guidance, pipelineConfig) => (
      analyzePitchFrame(buffer, sampleRate, stats, range, guidance, pipelineConfig)
    ),
  );
  return adapter;
}

async function loadPitchCore(moduleUrl: string): Promise<PitchCoreWasmModule> {
  return await import(/* @vite-ignore */ moduleUrl) as PitchCoreWasmModule;
}

export {};
