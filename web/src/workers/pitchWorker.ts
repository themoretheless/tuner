import {
  computeSignalStats,
  detectPitch,
  type PitchDetectionRange,
  type SignalStats,
} from '../utils/pitch';
import {
  PitchCoreAdapter,
  type PitchCoreWasmModule,
  type WorkerPitchDetection,
} from './pitchCoreAdapter';

interface PitchRequest {
  id: number;
  buffer: ArrayBuffer;
  range: PitchDetectionRange;
  sampleRate: number;
  stats?: SignalStats;
  wasmModuleUrl: string;
}

interface PitchResponse extends WorkerPitchDetection {
  buffer: ArrayBuffer;
  id: number;
}

let adapter: PitchCoreAdapter | null = null;
let adapterModuleUrl = '';

self.onmessage = async (event: MessageEvent<PitchRequest>) => {
  const { id, buffer, range, sampleRate, stats, wasmModuleUrl } = event.data;
  const frame = new Float32Array(buffer);
  const signalStats = stats ?? computeSignalStats(frame);
  let detection: WorkerPitchDetection;
  try {
    detection = await getAdapter(wasmModuleUrl).detect(frame, sampleRate, signalStats, range);
  } catch {
    detection = { backend: 'typescript', confidence: 0, frequency: null };
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
    (buffer, sampleRate, stats, range) => detectPitch(buffer, sampleRate, stats, range),
  );
  return adapter;
}

async function loadPitchCore(moduleUrl: string): Promise<PitchCoreWasmModule> {
  return await import(/* @vite-ignore */ moduleUrl) as PitchCoreWasmModule;
}

export {};
