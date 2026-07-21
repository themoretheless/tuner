import type { Ref } from 'vue';
import type { AudioInputDiagnostics } from '../../../domain/audioInputDiagnostics';
import type { AudioFrameTimebase, ExactPcmCapture } from '../../../ports/audioInput';
import type { SessionStatus } from '../../../session/sessionLifecycle';
import type { DetectorBackend } from '../../../types/detectorBackend';
import type { AudioBackend } from '../../../utils/settingsStorage';

export interface ListeningCapability {
  clearError(): void;
  setAudioBackend(backend: AudioBackend): Promise<void>;
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
  nativeAudioAvailable: Readonly<Ref<boolean>>;
  refreshInputDevices(): Promise<void>;
  selectedInputDeviceId: Readonly<Ref<string>>;
  setInputDevice(deviceId: string): Promise<void>;
  status: Readonly<Ref<SessionStatus>>;
  useMicrophoneInput(): Promise<void>;
  usingFileAudio: Readonly<Ref<boolean>>;
  usingNativeAudio: Readonly<Ref<boolean>>;
  usingSyntheticAudio: Readonly<Ref<boolean>>;
}

export interface AnalysisSettingsCapability {
  showSpectrogram: Ref<boolean>;
  showSpectrum: Ref<boolean>;
  showWaveform: Ref<boolean>;
}

export interface AudioSettingsCapability {
  audioBackend: Ref<AudioBackend>;
}
