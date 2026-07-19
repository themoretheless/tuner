export type ToneWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface ToneRequest {
  attackSeconds?: number;
  durationSeconds?: number;
  frequency: number;
  gain: number;
  lowpassHz?: number;
  releaseSeconds?: number;
  startAt?: number;
  waveform?: ToneWaveform;
}

export interface AudioPlaybackScope {
  currentTime(): number;
  dispose(): void;
  playTone(request: ToneRequest): void;
  resume(): Promise<void>;
  stopAll(): void;
}

export interface AudioOutputPort {
  createScope(): AudioPlaybackScope;
  dispose(): Promise<void>;
}
