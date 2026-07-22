import type {
  PitchDetectionRange,
  PitchDetectionResult,
  SignalStats,
} from '../utils/pitch';

export interface PitchWorkerRequest {
  id: number;
  buffer: ArrayBuffer;
  range: PitchDetectionRange;
  sampleRate: number;
  stats: SignalStats;
}

export interface PitchWorkerResponse {
  id: number;
  detection: PitchDetectionResult | null;
  error?: string;
}
