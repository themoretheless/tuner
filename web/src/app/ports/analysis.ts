import type { CentsHistoryPoint } from '../../domain/centsHistory';
import type { DetectionFrame, SpectrumFrame, WaveformFrame } from '../../types/frames';
import type { Note } from '../../utils/notes';
import type { DisplayMode, LayoutMode, ThemeMode } from '../../utils/settingsStorage';
import type { SessionStatus } from '../../session/sessionLifecycle';

export interface AnalysisPort {
  activate(): void;
  centsHistory: CentsHistoryPoint[];
  clearError(): void;
  deactivate(): void;
  detectionFrame: DetectionFrame;
  displayMode: DisplayMode;
  error: string | null;
  formatFreq(frequency: number): string;
  isListening: boolean;
  layoutMode: LayoutMode;
  leftHanded: boolean;
  sessionStatus: SessionStatus;
  setDisplayMode(value: unknown): void;
  setLayoutMode(value: unknown): void;
  setLeftHanded(value: boolean): void;
  setThemeMode(value: unknown): void;
  showSpectrogram: boolean;
  showSpectrum: boolean;
  showWaveform: boolean;
  smoothedFrequency: number | null;
  spectrumFrame: SpectrumFrame | null;
  start(): Promise<void>;
  stop(): Promise<void>;
  targetNote: Note;
  themeMode: ThemeMode;
  toggleFullscreen(): Promise<void>;
  usingNativeAudio: boolean;
  waveformFrame: WaveformFrame | null;
}
