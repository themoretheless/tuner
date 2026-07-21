import type { DecodedWav } from '../audio/wav';
import type { SyntheticAudioFixture } from '../utils/syntheticAudio';
import type {
  AudioFrameInputPort,
  DetectionFrameInputPort,
  DeviceSelectableAudioInputPort,
  DiagnosableAudioInputPort,
  ExactPcmCaptureInputPort,
  ReadableValue,
} from './audioInput';

export interface WebTunerInputPort
  extends ExactPcmCaptureInputPort,
  DeviceSelectableAudioInputPort,
  DiagnosableAudioInputPort {
  readonly analyser: ReadableValue<AnalyserNode | null>;
  readonly sampleRate: ReadableValue<number>;
}

export interface FileTunerInputPort extends ExactPcmCaptureInputPort {
  readonly durationSeconds: ReadableValue<number>;
  readonly fileName: ReadableValue<string | null>;
  load(decoded: DecodedWav, name: string): void;
  readonly progress: ReadableValue<number>;
}

export interface SyntheticTunerInputPort extends AudioFrameInputPort {
  readonly enabled: ReadableValue<boolean>;
  readonly fixture: SyntheticAudioFixture | null;
}

export type NativeTunerInputPort = DetectionFrameInputPort;

export interface TunerInputSet {
  readonly file: FileTunerInputPort;
  readonly native: NativeTunerInputPort;
  readonly synthetic: SyntheticTunerInputPort;
  readonly web: WebTunerInputPort;
}
