import type { DetectionFrame, FrameContext } from '../types/frames';
import type { PipelineConfig } from '../domain/pipelineConfig';
import type { PitchDetectionRange } from '../utils/pitch';

export type AudioInputId = 'web' | 'native' | 'synthetic' | 'file';

export interface ReadableValue<T> {
  readonly value: T;
}

export interface AudioFrame {
  buffer: Float32Array<ArrayBuffer>;
  sampleRate: number;
  timebase: AudioFrameTimebase | null;
}

export interface AudioFrameTimebase {
  endSample: number;
  source: 'worklet' | 'synthetic' | 'file';
  startSample: number;
}

export interface ExactPcmCapture {
  droppedSamples: number;
  endSample: number;
  sampleRate: number;
  samples: Float32Array<ArrayBuffer>;
  startSample: number;
}

interface AudioInputPortBase {
  readonly available: ReadableValue<boolean>;
  readonly error: ReadableValue<string | null>;
  readonly id: AudioInputId;
  readonly isListening: ReadableValue<boolean>;
  clearError(): void;
  start(): Promise<boolean>;
  stop(): Promise<void>;
}

export interface AudioFrameInputPort extends AudioInputPortBase {
  readonly output: 'audio-frame';
  // Null means that no complete window is ready yet. The lifecycle is ended
  // only when isListening becomes false or the adapter publishes an error.
  readFrame(): AudioFrame | null;
}

export interface ExactPcmCaptureInputPort extends AudioFrameInputPort {
  readonly exactPcmCaptureAvailable: ReadableValue<boolean>;
  beginExactPcmCapture(): boolean;
  finishExactPcmCapture(): ExactPcmCapture | null;
}

export interface DeviceSelectableAudioInputPort extends AudioFrameInputPort {
  readonly inputDevices: ReadableValue<MediaDeviceInfo[]>;
  readonly selectedInputDeviceId: ReadableValue<string>;
  refreshInputDevices(): Promise<void>;
  selectInputDevice(deviceId: string): void;
}

export interface DetectionFrameInputPort extends AudioInputPortBase {
  readonly frame: ReadableValue<DetectionFrame | null>;
  readonly output: 'detection-frame';
  setDetectionRange(range: PitchDetectionRange): Promise<void>;
  setFrameContext(context: FrameContext): Promise<void>;
  setPipelineConfig(config: PipelineConfig): Promise<void>;
}

export type AudioInputPort = AudioFrameInputPort | DetectionFrameInputPort;
export type AudioInputPortRegistry = Readonly<Record<AudioInputId, AudioInputPort>>;

export function isAudioFrameInputPort(port: AudioInputPort): port is AudioFrameInputPort {
  return port.output === 'audio-frame';
}

export function isExactPcmCaptureInputPort(
  port: AudioInputPort,
): port is ExactPcmCaptureInputPort {
  return isAudioFrameInputPort(port)
    && 'beginExactPcmCapture' in port
    && 'finishExactPcmCapture' in port
    && 'exactPcmCaptureAvailable' in port;
}

export function isDeviceSelectableAudioInputPort(
  port: AudioInputPort,
): port is DeviceSelectableAudioInputPort {
  return isAudioFrameInputPort(port)
    && 'inputDevices' in port
    && 'refreshInputDevices' in port
    && 'selectInputDevice' in port
    && 'selectedInputDeviceId' in port;
}

export function isDetectionFrameInputPort(port: AudioInputPort): port is DetectionFrameInputPort {
  return port.output === 'detection-frame';
}
