import {
  computeSignalStats,
  detectPitch,
  type PitchDetectionRange,
  type SignalStats,
} from '../utils/pitch';

interface PitchRequest {
  id: number;
  buffer: ArrayBuffer;
  range: PitchDetectionRange;
  sampleRate: number;
  stats?: SignalStats;
}

interface PitchResponse {
  buffer: ArrayBuffer;
  id: number;
  frequency: number | null;
}

self.onmessage = (event: MessageEvent<PitchRequest>) => {
  const { id, buffer, range, sampleRate, stats } = event.data;
  const frame = new Float32Array(buffer);
  const frequency = detectPitch(frame, sampleRate, stats ?? computeSignalStats(frame), range);
  self.postMessage({ id, frequency, buffer } satisfies PitchResponse, { transfer: [buffer] });
};

export {};
