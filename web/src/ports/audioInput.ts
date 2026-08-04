import type { AudioInputDiagnostics } from '../domain/audioInputDiagnostics';
import type { ReadableValue } from '../application/ports/value';

export type { ReadableValue } from '../application/ports/value';
export type AudioInputId = 'web' | 'synthetic' | 'file';

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

export interface DiagnosableAudioInputPort extends AudioFrameInputPort {
  readonly inputDiagnostics: ReadableValue<AudioInputDiagnostics | null>;
}

export type AudioInputPort = AudioFrameInputPort;
export type AudioInputPortRegistry = Readonly<Record<AudioInputId, AudioInputPort>>;

export function isExactPcmCaptureInputPort(
  port: AudioInputPort,
): port is ExactPcmCaptureInputPort {
  return 'beginExactPcmCapture' in port
    && 'finishExactPcmCapture' in port
    && 'exactPcmCaptureAvailable' in port;
}

export function isDeviceSelectableAudioInputPort(
  port: AudioInputPort,
): port is DeviceSelectableAudioInputPort {
  return 'inputDevices' in port
    && 'refreshInputDevices' in port
    && 'selectInputDevice' in port
    && 'selectedInputDeviceId' in port;
}

export function isDiagnosableAudioInputPort(
  port: AudioInputPort,
): port is DiagnosableAudioInputPort {
  return 'inputDiagnostics' in port;
}
