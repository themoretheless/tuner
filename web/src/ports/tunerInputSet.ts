import type { DecodedWav } from '../audio/wav';
import type { DiagnosticCode } from '../domain/diagnostics';
import type { MicrophoneStartFailure } from '../domain/microphoneStartFailure';
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
  /** Typed classification of the last start() failure (typed diagnostics). */
  readonly startFailure: ReadableValue<MicrophoneStartFailure | null>;
  /** True when the mic track ended involuntarily (unplug / OS revoke). */
  readonly trackLost: ReadableValue<boolean>;
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

export interface NativeTunerInputPort extends DetectionFrameInputPort {
  /** Signal-quality diagnostic codes reported by the native engine. */
  readonly signalDiagnostics: ReadableValue<DiagnosticCode[]>;
}

export interface TunerInputSet {
  readonly file: FileTunerInputPort;
  readonly native: NativeTunerInputPort;
  readonly synthetic: SyntheticTunerInputPort;
  readonly web: WebTunerInputPort;
}
