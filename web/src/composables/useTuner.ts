import { computed, watch } from 'vue';
import { useCentsHistory } from './useCentsHistory';
import { useEarTraining } from './useEarTraining';
import { useMetronome } from './useMetronome';
import { useReferenceTone } from './useReferenceTone';
import { useSettings } from './useSettings';
import { useTunerSession } from './useTunerSession';
import { useTuningState } from './useTuningState';
import { useVisualizationFrames } from './useVisualizationFrames';
import type { DetectionFrame } from '../types/frames';
import type { AudioBackend, DisplayMode, LayoutMode, PracticeHistoryEntry, ThemeMode } from '../utils/settingsStorage';

export function useTuner() {
  const settings = useSettings();
  const session = useTunerSession({
    audioBackend: settings.audioBackend,
    selectedInputDeviceId: settings.selectedInputDeviceId,
  });
  const detectedFrequency = computed(() => session.detectionFrame.value.freq);
  const tuning = useTuningState(detectedFrequency, {
    onResetDetection: session.resetDetection,
  });
  const referenceTone = useReferenceTone(() => tuning.targetNote.value);
  const centsHistory = useCentsHistory(tuning.cents, computed(() => !!tuning.detectedNote.value));
  const earTraining = useEarTraining(tuning.getRandomPracticeNote, referenceTone.playTimedTone);
  const metronome = useMetronome(
    settings.metronomeBpm,
    settings.metronomeBeats,
    settings.metronomeSubdivision,
  );
  const practiceSummary = computed(() => summarizePractice(settings.practiceHistory.value));
  const shouldCaptureVisualizationFrames = computed(() => (
    !session.usingNativeAudio.value &&
    !session.usingSyntheticAudio.value &&
    session.webAudioListening.value &&
    (settings.showWaveform.value || settings.showSpectrum.value || settings.showSpectrogram.value)
  ));
  const visualization = useVisualizationFrames(
    session.analyser,
    session.audioSampleRate,
    shouldCaptureVisualizationFrames,
  );
  const detectionFrame = computed<DetectionFrame>(() => {
    const baseFrame = session.detectionFrame.value;
    return {
      ...baseFrame,
      cents: tuning.detectedNote.value ? tuning.cents.value : 0,
      note: tuning.currentNoteDisplay.value ?? baseFrame.note,
      target: tuning.targetNote.value,
      inTune: tuning.isInTune.value,
    };
  });

  watch(tuning.detectionRange, (range) => {
    session.setDetectionRange(range);
  }, { immediate: true });

  async function start() {
    referenceTone.stopAllTones();
    metronome.stop();
    centsHistory.clear();
    await session.start(tuning.detectionRange.value);
  }

  function stop() {
    session.stop();
    referenceTone.stopAllTones();
    metronome.stop();
  }

  function playRandomString() {
    session.stop();
    metronome.stop();
    earTraining.nextChallenge();
  }

  function playEarTraining() {
    session.stop();
    metronome.stop();
    earTraining.playTarget();
  }

  function nextEarTraining() {
    playRandomString();
  }

  function toggleReferenceTone() {
    if (!referenceTone.referencePlaying.value) {
      session.stop();
      metronome.stop();
    }
    referenceTone.toggleReferenceTone();
  }

  function toggleMetronome() {
    if (!metronome.isRunning.value) {
      session.stop();
      referenceTone.stopAllTones();
    }
    metronome.toggle();
  }

  function setDisplayMode(mode: DisplayMode) {
    settings.displayMode.value = mode;
  }

  function setThemeMode(mode: ThemeMode) {
    if (mode !== 'dark' && mode !== 'light' && mode !== 'colorblind') return;
    settings.themeMode.value = mode;
  }

  function setLayoutMode(mode: LayoutMode) {
    if (mode !== 'default' && mode !== 'stage' && mode !== 'compact') return;
    settings.layoutMode.value = mode;
  }

  function setLeftHanded(enabled: boolean) {
    settings.leftHanded.value = enabled;
  }

  function setAudioBackend(backend: AudioBackend) {
    if (backend !== 'web' && backend !== 'native') return;
    const shouldRestart = session.isListening.value || session.isStarting.value;
    if (shouldRestart) stop();
    settings.audioBackend.value = backend;
    if (shouldRestart) void start();
  }

  function clearError() {
    session.clearError();
  }

  async function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  }

  function markEarTraining(isCorrect: boolean) {
    if (!earTraining.mark(isCorrect)) return false;
    const target = earTraining.target.value;
    const nextEntry: PracticeHistoryEntry = {
      at: Date.now(),
      correct: isCorrect,
      note: target ? tuning.getNoteDisplay(target) : '',
    };
    settings.practiceHistory.value = [
      ...settings.practiceHistory.value.slice(-499),
      nextEntry,
    ];
    return true;
  }

  function clearPracticeHistory() {
    settings.practiceHistory.value = [];
  }

  function exportPracticeStats() {
    return JSON.stringify({
      summary: practiceSummary.value,
      history: settings.practiceHistory.value,
    }, null, 2);
  }

  return {
    // state
    isListening: session.isListening,
    isStarting: session.isStarting,
    currentFrequency: session.currentFrequency,
    detectionFrame,
    smoothedFrequency: computed(() => detectionFrame.value.freq),
    volume: computed(() => detectionFrame.value.level),
    error: session.error,
    settingsLoaded: settings.loaded,
    settingsLoading: settings.isLoading,
    settingsLoadError: settings.loadError,
    settingsSaveError: settings.saveError,
    audioBackend: settings.audioBackend,
    inputDevices: session.inputDevices,
    selectedString: tuning.selectedString,
    selectedInputDeviceId: session.selectedInputDeviceId,
    selectedStringIndex: tuning.selectedStringIndex,
    referencePlaying: referenceTone.referencePlaying,
    a4: tuning.a4,
    activeInstrument: tuning.activeInstrument,
    activeStringOffsets: tuning.activeStringOffsets,
    capo: tuning.capo,
    currentTuning: tuning.currentTuning,
    customTunings: tuning.customTunings,
    customInstruments: tuning.customInstruments,
    customTemperaments: tuning.customTemperaments,
    displayMode: settings.displayMode,
    layoutMode: settings.layoutMode,
    leftHanded: settings.leftHanded,
    temperament: tuning.temperament,
    temperamentRoot: tuning.temperamentRoot,
    temperamentOffsets: tuning.temperamentOffsets,
    transpose: tuning.transpose,
    themeMode: settings.themeMode,
    centsHistory: centsHistory.history,
    earTrainingAccuracy: earTraining.accuracy,
    earTrainingAnswered: earTraining.answered,
    earTrainingAttempts: earTraining.attempts,
    earTrainingCanMark: earTraining.canMark,
    earTrainingCorrect: earTraining.correct,
    earTrainingRevealed: earTraining.revealed,
    earTrainingStreak: earTraining.streak,
    earTrainingTarget: earTraining.target,
    metronomeBeat: metronome.beat,
    metronomeBeats: settings.metronomeBeats,
    metronomeBpm: settings.metronomeBpm,
    metronomeRunning: metronome.isRunning,
    metronomeSubdivision: settings.metronomeSubdivision,
    metronomeSubdivisionStep: metronome.subdivisionStep,
    practiceHistory: settings.practiceHistory,
    practiceSummary,
    sweeteningProfile: tuning.sweeteningProfile,
    nativeAudioAvailable: session.nativeAudioAvailable,
    syntheticAudioFixture: session.syntheticAudioFixture,
    usingNativeAudio: session.usingNativeAudio,
    usingSyntheticAudio: session.usingSyntheticAudio,

    // computed
    detectedNote: tuning.detectedNote,
    detectionRange: session.detectionRange,
    targetNote: tuning.targetNote,
    cents: tuning.cents,
    isInTune: tuning.isInTune,
    currentNoteDisplay: tuning.currentNoteDisplay,
    strings: tuning.strings,
    isChromaticMode: tuning.isChromaticMode,

    // visualizers / persisted UI settings
    spectrumFrame: visualization.spectrumFrame,
    waveformFrame: visualization.waveformFrame,
    showSpectrogram: settings.showSpectrogram,
    showWaveform: settings.showWaveform,
    showSpectrum: settings.showSpectrum,

    // actions
    start,
    stop,
    toggleString: tuning.toggleString,
    toggleReferenceTone,
    clearError,
    retrySettingsLoad: settings.retryLoad,
    retrySettingsSave: settings.save,
    clearCentsHistory: centsHistory.clear,
    refreshInputDevices: session.refreshInputDevices,
    setA4: tuning.setA4,
    setAudioBackend,
    setCapo: tuning.setCapo,
    setDisplayMode,
    setInputDevice: session.setInputDevice,
    setLayoutMode,
    setLeftHanded,
    setMetronomeBeats: metronome.setBeats,
    setMetronomeBpm: metronome.setBpm,
    setMetronomeSubdivision: metronome.setSubdivision,
    setInstrument: tuning.setInstrument,
    setStringOffset: tuning.setStringOffset,
    setSweeteningProfile: tuning.setSweeteningProfile,
    setTemperament: tuning.setTemperament,
    setTemperamentRoot: tuning.setTemperamentRoot,
    setThemeMode,
    setTranspose: tuning.setTranspose,
    setTuning: tuning.setTuning,
    toggleFullscreen,
    playRandomString,
    saveCustomTemperament: tuning.saveCustomTemperament,
    saveCustomTuning: tuning.saveCustomTuning,
    saveInstrumentProfile: tuning.saveInstrumentProfile,
    deleteCustomTemperament: tuning.deleteCustomTemperament,
    deleteCustomTuning: tuning.deleteCustomTuning,
    deleteInstrumentProfile: tuning.deleteInstrumentProfile,
    exportCustomTunings: tuning.exportCustomTunings,
    exportCustomTuningDocument: tuning.exportCustomTuningDocument,
    exportPracticeStats,
    importCustomTunings: tuning.importCustomTunings,
    clearPracticeHistory,
    markEarTraining,
    nextEarTraining,
    playEarTraining,
    resetEarTraining: earTraining.reset,
    revealEarTraining: earTraining.reveal,
    tapMetronome: metronome.tapTempo,
    toggleMetronome,

    // data / helpers
    allTunings: tuning.allTunings,
    instrumentOptions: tuning.instrumentOptions,
    temperamentOptions: tuning.temperamentOptions,
    formatFreq: tuning.formatFreq,
    getNoteDisplay: tuning.getNoteDisplay,
  };
}

function summarizePractice(history: PracticeHistoryEntry[]) {
  const todayKey = localDateKey(Date.now());
  const todayEntries = history.filter((entry) => localDateKey(entry.at) === todayKey);
  const totalCorrect = history.filter((entry) => entry.correct).length;
  const todayCorrect = todayEntries.filter((entry) => entry.correct).length;

  return {
    totalAttempts: history.length,
    totalAccuracy: history.length ? Math.round((totalCorrect / history.length) * 100) : 0,
    todayAttempts: todayEntries.length,
    todayAccuracy: todayEntries.length ? Math.round((todayCorrect / todayEntries.length) * 100) : 0,
    dailyStreak: calculateDailyStreak(history),
  };
}

function calculateDailyStreak(history: PracticeHistoryEntry[]) {
  const days = new Set(history.map((entry) => dayNumber(entry.at)));
  if (!days.size) return 0;

  const today = dayNumber(Date.now());
  let cursor = today;
  if (!days.has(cursor) && days.has(cursor - 1)) {
    cursor -= 1;
  }

  let streak = 0;
  while (days.has(cursor - streak)) {
    streak += 1;
  }
  return streak;
}

function dayNumber(timestamp: number) {
  const date = new Date(timestamp);
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000);
}

function localDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
