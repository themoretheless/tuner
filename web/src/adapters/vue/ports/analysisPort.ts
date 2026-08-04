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
  FeedbackSettingsCapability,
  ListeningCapability,
  SessionCapability,
} from '../capabilities/session';
import type { TuningCapability } from '../capabilities/tuning';

interface Dependencies {
  detection: Pick<DetectionCapability, 'frame' | 'smoothedFrequency' | 'targetNote'>;
  display: DisplayCapability;
  history: HistoryCapability;
  listening: ListeningCapability;
  session: Pick<SessionCapability, 'error' | 'isListening' | 'status'>;
  settings: AnalysisSettingsCapability & FeedbackSettingsCapability;
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
    feedbackFlash: settings.feedbackFlash,
    feedbackSound: settings.feedbackSound,
    feedbackVibrate: settings.feedbackVibrate,
    formatFreq: tuning.formatFreq,
    isListening: session.isListening,
    layoutMode: display.layoutMode,
    leftHanded: display.leftHanded,
    readoutStability: settings.readoutStability,
    sessionStatus: session.status,
    showSpectrogram: settings.showSpectrogram,
    showSpectrum: settings.showSpectrum,
    showWaveform: settings.showWaveform,
    smoothedFrequency: detection.smoothedFrequency,
    spectrumFrame: visualization.spectrumFrame,
    targetNote: detection.targetNote,
    themeMode: display.themeMode,
    waveformFrame: visualization.waveformFrame,
    activate: visualization.activate,
    clearError: listening.clearError,
    deactivate: visualization.deactivate,
    setDisplayMode: display.setDisplayMode,
    setFeedbackFlash: (value: boolean) => { settings.feedbackFlash.value = value; },
    setFeedbackSound: (value: boolean) => { settings.feedbackSound.value = value; },
    setFeedbackVibrate: (value: boolean) => { settings.feedbackVibrate.value = value; },
    setLayoutMode: display.setLayoutMode,
    setLeftHanded: display.setLeftHanded,
    setReadoutStability: (value: number) => {
      if (!Number.isFinite(value)) return;
      settings.readoutStability.value = Math.max(0, Math.min(1, value));
    },
    setShowSpectrogram: (value: boolean) => { settings.showSpectrogram.value = value; },
    setShowSpectrum: (value: boolean) => { settings.showSpectrum.value = value; },
    setShowWaveform: (value: boolean) => { settings.showWaveform.value = value; },
    setThemeMode: display.setThemeMode,
    start: listening.start,
    stop: listening.stop,
    toggle: listening.toggle,
    toggleFullscreen: display.toggleFullscreen,
  });
}
