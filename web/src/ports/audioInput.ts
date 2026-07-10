import type { DetectionFrame } from '../types/frames';
import type { PitchDetectionRange } from '../utils/pitch';

export type AudioInputId = 'web' | 'native' | 'synthetic';

export interface ReadableValue<T> {
  readonly value: T;
}

export interface AudioFrame {
  buffer: Float32Array<ArrayBuffer>;
  sampleRate: number;
}

export interface AudioInputStartOptions {
  range: PitchDetectionRange;
}

interface AudioInputPortBase {
  readonly available: ReadableValue<boolean>;
  readonly error: ReadableValue<string | null>;
  readonly id: AudioInputId;
  readonly isListening: ReadableValue<boolean>;
  clearError(): void;
  start(options: AudioInputStartOptions): Promise<boolean>;
  stop(): Promise<void>;
}

export interface AudioFrameInputPort extends AudioInputPortBase {
  readonly output: 'audio-frame';
  readFrame(): AudioFrame | null;
}

export interface DetectionFrameInputPort extends AudioInputPortBase {
  readonly frame: ReadableValue<DetectionFrame | null>;
  readonly output: 'detection-frame';
  setDetectionRange(range: PitchDetectionRange): Promise<void>;
}

export type AudioInputPort = AudioFrameInputPort | DetectionFrameInputPort;
export type AudioInputPortRegistry = Readonly<Record<AudioInputId, AudioInputPort>>;

export function isAudioFrameInputPort(port: AudioInputPort): port is AudioFrameInputPort {
  return port.output === 'audio-frame';
}

export function isDetectionFrameInputPort(port: AudioInputPort): port is DetectionFrameInputPort {
  return port.output === 'detection-frame';
}
