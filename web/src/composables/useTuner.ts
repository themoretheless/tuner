import { computed, ref, watch } from 'vue';
import { useAudioInput } from './useAudioInput';
import { useCentsHistory } from './useCentsHistory';
import { useEarTraining } from './useEarTraining';
import { useMetronome } from './useMetronome';
import { useNativeAudioInput } from './useNativeAudioInput';
import { usePitchLoop } from './usePitchLoop';
import { useReferenceTone } from './useReferenceTone';
import { useSettings } from './useSettings';
import { useTuningState } from './useTuningState';
import { DEFAULT_PITCH_DETECTION_RANGE, type PitchDetectionRange } from '../utils/pitch';
import type { AudioBackend, DisplayMode, LayoutMode, PracticeHistoryEntry, ThemeMode } from '../utils/settingsStorage';

export function useTuner() {
  const settings = useSettings();
  const audio = useAudioInput(settings.selectedInputDeviceId);
  const nativeAudio = useNativeAudioInput();
  const detectionRange = ref<PitchDetectionRange>({ ...DEFAULT_PITCH_DETECTION_RANGE });
  const pitch = usePitchLoop(audio.readFrame, detectionRange);
  const usingNativeAudio = computed(() => settings.audioBackend.value === 'native' && nativeAudio.available.value);
  const detectedFrequencySource = computed(() => (
    usingNativeAudio.value ? nativeAudio.frequency.value : pitch.smoothedFrequency.value
  ));
  const tuning = useTuningState(detectedFrequencySource, {
    onResetDetection: pitch.reset,
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

  watch(tuning.detectionRange, (range) => {
    detectionRange.value = range;
    void nativeAudio.setRange(range);
  }, { immediate: true });

  async function start() {
    if (usingNativeAudio.value) {
      centsHistory.clear();
      pitch.reset();
      await nativeAudio.start(tuning.detectionRange.value);
      return;
    }

    await audio.start();
    if (audio.isListening.value) {
      centsHistory.clear();
      pitch.reset();
      pitch.start();
    }
  }

  function stop() {
    pitch.stop();
    audio.stop();
    void nativeAudio.stop();
    referenceTone.stopReferenceTone();
  }

  function playRandomString() {
    earTraining.nextChallenge();
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
    const shouldRestart = audio.isListening.value || nativeAudio.isListening.value;
    if (shouldRestart) stop();
    settings.audioBackend.value = backend;
    if (shouldRestart) void start();
  }

  function clearError() {
    audio.clearError();
    nativeAudio.clearError();
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
    earTraining.mark(isCorrect);
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
    isListening: computed(() => usingNativeAudio.value ? nativeAudio.isListening.value : audio.isListening.value),
    currentFrequency: computed(() => usingNativeAudio.value ? nativeAudio.frequency.value : pitch.currentFrequency.value),
    smoothedFrequency: detectedFrequencySource,
    volume: computed(() => usingNativeAudio.value ? nativeAudio.level.value : pitch.volume.value),
    error: computed(() => usingNativeAudio.value ? nativeAudio.error.value : audio.error.value),
    audioBackend: settings.audioBackend,
    inputDevices: audio.inputDevices,
    selectedString: tuning.selectedString,
    selectedInputDeviceId: audio.selectedInputDeviceId,
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
    earTrainingAttempts: earTraining.attempts,
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
    nativeAudioAvailable: nativeAudio.available,
    usingNativeAudio,

    // computed
    detectedNote: tuning.detectedNote,
    detectionRange,
    targetNote: tuning.targetNote,
    cents: tuning.cents,
    isInTune: tuning.isInTune,
    currentNoteDisplay: tuning.currentNoteDisplay,
    strings: tuning.strings,
    isChromaticMode: tuning.isChromaticMode,

    // visualizers / persisted UI settings
    analyser: computed(() => usingNativeAudio.value ? null : audio.analyser.value),
    showWaveform: settings.showWaveform,
    showSpectrum: settings.showSpectrum,

    // actions
    start,
    stop,
    toggleString: tuning.toggleString,
    toggleReferenceTone: referenceTone.toggleReferenceTone,
    clearError,
    clearCentsHistory: centsHistory.clear,
    refreshInputDevices: audio.refreshInputDevices,
    setA4: tuning.setA4,
    setAudioBackend,
    setCapo: tuning.setCapo,
    setDisplayMode,
    setInputDevice: audio.setInputDevice,
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
    exportPracticeStats,
    importCustomTunings: tuning.importCustomTunings,
    clearPracticeHistory,
    markEarTraining,
    nextEarTraining: earTraining.nextChallenge,
    playEarTraining: earTraining.playTarget,
    resetEarTraining: earTraining.reset,
    revealEarTraining: earTraining.reveal,
    tapMetronome: metronome.tapTempo,
    toggleMetronome: metronome.toggle,

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
