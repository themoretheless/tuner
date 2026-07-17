import type { Note } from '../utils/notes';
import type { PipelineTelemetry } from '../domain/pipelineTelemetry';

export interface DetectionFrame {
  freq: number | null;
  /** The detector's own per-frame estimate before any suppression,
   * smoothing, or hold logic - diagnostic, shown in the ?debug=1 overlay. */
  rawFreq: number | null;
  confidence: number;
  rms: number;
  level: number;
  cents: number;
  note: string;
  target: Note | null;
  inTune: boolean;
  isPower: boolean;
  pipeline: PipelineTelemetry;
}

export interface FrameContext {
  a4: number;
  displayTargets: Note[];
  idleTarget: Note | null;
  inTuneEnterCents: number;
  inTuneExitCents: number;
  selectedTarget: Note | null;
  tuningTargets: Note[];
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
