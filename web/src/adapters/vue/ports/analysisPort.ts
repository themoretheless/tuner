import { reactive } from 'vue';
import type { AnalysisPort } from '../../../app/ports/analysis';
import type {
  DetectionCapability,
  HistoryCapability,
  VisualizationCapability,
} from '../capabilities/detection';
import type { DisplayCapability } from '../capabilities/display';
import type {
  AnalysisSettingsCapability,
  ListeningCapability,
  SessionCapability,
} from '../capabilities/session';
import type { TuningCapability } from '../capabilities/tuning';

interface Dependencies {
  detection: Pick<DetectionCapability, 'frame' | 'smoothedFrequency' | 'targetNote'>;
  display: DisplayCapability;
  history: HistoryCapability;
  listening: ListeningCapability;
  session: Pick<SessionCapability, 'error' | 'isListening' | 'status' | 'usingNativeAudio'>;
  settings: AnalysisSettingsCapability;
  tuning: Pick<TuningCapability, 'formatFreq'>;
  visualization: VisualizationCapability;
}

export function createAnalysisPort(services: Dependencies): AnalysisPort {
  const { detection, display, history, listening, session, settings, tuning, visualization } = services;
  return reactive({
    centsHistory: history.history,
    detectionFrame: detection.frame,
    displayMode: display.displayMode,
    error: session.error,
    formatFreq: tuning.formatFreq,
    isListening: session.isListening,
    layoutMode: display.layoutMode,
    leftHanded: display.leftHanded,
    sessionStatus: session.status,
    showSpectrogram: settings.showSpectrogram,
    showSpectrum: settings.showSpectrum,
    showWaveform: settings.showWaveform,
    smoothedFrequency: detection.smoothedFrequency,
    spectrumFrame: visualization.spectrumFrame,
    targetNote: detection.targetNote,
    themeMode: display.themeMode,
    usingNativeAudio: session.usingNativeAudio,
    waveformFrame: visualization.waveformFrame,
    activate: visualization.activate,
    clearError: listening.clearError,
    deactivate: visualization.deactivate,
    setDisplayMode: display.setDisplayMode,
    setLayoutMode: display.setLayoutMode,
    setLeftHanded: display.setLeftHanded,
    setThemeMode: display.setThemeMode,
    start: listening.start,
    stop: listening.stop,
    toggleFullscreen: display.toggleFullscreen,
  });
}
