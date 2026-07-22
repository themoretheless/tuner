import {
  computeSignalStats,
  detectPitchWithConfidence,
} from '../utils/pitch';
import type { PitchWorkerRequest, PitchWorkerResponse } from '../types/pitchWorker';

self.onmessage = (event: MessageEvent<PitchWorkerRequest>) => {
  const { id, buffer, range, sampleRate, stats } = event.data;
  try {
    const frame = new Float32Array(buffer);
    const detection = detectPitchWithConfidence(
      frame,
      sampleRate,
      stats ?? computeSignalStats(frame),
      range,
    );
    self.postMessage({ id, detection } satisfies PitchWorkerResponse);
  } catch (error: unknown) {
    self.postMessage({
      id,
      detection: null,
      error: error instanceof Error ? error.message : 'Pitch worker failed',
    } satisfies PitchWorkerResponse);
  }
};

export {};
