import type { Note } from '../utils/notes';

export interface DetectionFrame {
  freq: number | null;
  confidence: number;
  rms: number;
  level: number;
  cents: number;
  note: string;
  target: Note | null;
  inTune: boolean;
  isPower: boolean;
}

export interface WaveformFrame {
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
  sequence: number;
}

export interface SpectrumFrame {
  bins: Uint8Array<ArrayBuffer>;
  sampleRate: number;
  sequence: number;
}
