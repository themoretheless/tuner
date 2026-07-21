import type { PipelineConfig } from '../domain/pipelineConfig';
import type { AudioFrameTimebase } from '../ports/audioInput';
import type { DetectionFrame, FrameContext } from '../types/frames';
import type {
  DetectionFrameSemantics,
  PitchDetectorBackend,
} from '../types/detectorBackend';
import type { PitchDetectionRange, SignalStats } from '../utils/pitch';

export interface PitchProcessRequest {
  type: 'process';
  id: number;
  buffer: ArrayBuffer;
  frameContext?: FrameContext;
  pipelineConfig?: PipelineConfig;
  range: PitchDetectionRange;
  sampleRate: number;
  stats?: SignalStats;
  timebase: AudioFrameTimebase | null;
  wasmModuleUrl: string;
}

export interface PitchResetRequest {
  type: 'reset';
}

export type PitchWorkerRequest = PitchProcessRequest | PitchResetRequest;

export interface PitchWorkerResponse {
  backend: PitchDetectorBackend;
  buffer: ArrayBuffer;
  frame: DetectionFrame;
  id: number;
  semantics: DetectionFrameSemantics;
  timebase: AudioFrameTimebase | null;
}
