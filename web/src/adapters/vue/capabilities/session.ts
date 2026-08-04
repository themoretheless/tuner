import type { Ref } from 'vue';
import type { AudioInputDiagnostics } from '../../../domain/audioInputDiagnostics';
import type { TunerDiagnostic } from '../../../domain/diagnostics';
import type { AudioFrameTimebase, ExactPcmCapture } from '../../../ports/audioInput';
import type { SessionStatus } from '../../../session/sessionLifecycle';
import type { DetectorBackend } from '../../../types/detectorBackend';

export interface ListeningCapability {
  clearError(): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  toggle(): Promise<void>;
}

export interface ProfileCapability {
  exportProfile(): string;
  importProfile(payload: string): Promise<boolean>;
}

export interface ReferenceToneCapability {
  referencePlaying: Readonly<Ref<boolean>>;
  toggleReferenceTone(): Promise<void>;
}

export interface SessionCapability {
  beginExactPcmCapture(): boolean;
  detectionFrameTimebase: Readonly<Ref<AudioFrameTimebase | null>>;
  detectorBackend: Readonly<Ref<DetectorBackend>>;
  diagnostics: Readonly<Ref<TunerDiagnostic[]>>;
  error: Readonly<Ref<string | null>>;
  exactPcmCaptureAvailable: Readonly<Ref<boolean>>;
  fileAudioDuration: Readonly<Ref<number>>;
  fileAudioName: Readonly<Ref<string | null>>;
  fileAudioProgress: Readonly<Ref<number>>;
  finishExactPcmCapture(): ExactPcmCapture | null;
  inputDevices: Readonly<Ref<MediaDeviceInfo[]>>;
  inputDiagnostics: Readonly<Ref<AudioInputDiagnostics | null>>;
  isListening: Readonly<Ref<boolean>>;
  loadAudioFile(file: File): Promise<boolean>;
  refreshInputDevices(): Promise<void>;
  selectedInputDeviceId: Readonly<Ref<string>>;
  setInputDevice(deviceId: string): Promise<void>;
  status: Readonly<Ref<SessionStatus>>;
  useMicrophoneInput(): Promise<void>;
  usingFileAudio: Readonly<Ref<boolean>>;
  usingSyntheticAudio: Readonly<Ref<boolean>>;
}

export interface AnalysisSettingsCapability {
  showSpectrogram: Ref<boolean>;
  showSpectrum: Ref<boolean>;
  showWaveform: Ref<boolean>;
}

export interface FeedbackSettingsCapability {
  feedbackFlash: Ref<boolean>;
  feedbackSound: Ref<boolean>;
  feedbackVibrate: Ref<boolean>;
  readoutStability: Ref<number>;
}
