import { computed, watch } from 'vue';
import { useCentsHistory } from './useCentsHistory';
import { useEarTraining } from './useEarTraining';
import { useMetronome } from './useMetronome';
import { useReferenceTone } from './useReferenceTone';
import { useSettings } from './useSettings';
import { useTunerSession } from './useTunerSession';
import { useTuningState } from './useTuningState';
import { useVisualizationFrames } from './useVisualizationFrames';
import { summarizePractice } from '../domain/practice';
import { createFrameContext } from '../domain/frameContext';
import type { DetectionFrame } from '../types/frames';
import { decodeUserProfile } from '../settings/profileCodec';
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
  const nativeFrameContext = computed(() => createFrameContext({
    a4: tuning.a4.value,
    isChromaticMode: tuning.isChromaticMode.value,
    selectedString: tuning.selectedString.value,
    strings: tuning.strings.value,
    temperament: tuning.temperament.value,
    temperamentOptions: tuning.temperamentOptions.value,
    temperamentRoot: tuning.temperamentRoot.value,
    transpose: tuning.transpose.value,
  }));
  const detectionFrame = computed<DetectionFrame>(() => {
    const baseFrame = session.detectionFrame.value;
    if (session.detectionFrameResolved.value) return baseFrame;
    return {
      ...baseFrame,
      cents: tuning.detectedNote.value ? tuning.cents.value : 0,
      note: tuning.currentNoteDisplay.value ?? baseFrame.note,
      target: tuning.targetNote.value,
      inTune: tuning.isInTune.value,
    };
  });
  const targetNote = computed(() => detectionFrame.value.target ?? tuning.targetNote.value);
  const cents = computed(() => detectionFrame.value.cents);
  const isInTune = computed(() => detectionFrame.value.inTune);
  const hasDetection = computed(() => detectionFrame.value.freq != null);
  const currentNoteDisplay = computed(() => (
    hasDetection.value ? detectionFrame.value.note : null
  ));
  const referenceTone = useReferenceTone(() => targetNote.value);
  const centsHistory = useCentsHistory(cents, hasDetection);
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
  watch(tuning.detectionRange, (range) => {
    session.setDetectionRange(range);
  }, { immediate: true });
  watch(nativeFrameContext, (context) => {
    session.setFrameContext(context);
  }, { immediate: true });

  async function start() {
    centsHistory.clear();
    await session.start(tuning.detectionRange.value);
  }

  async function stop() {
    await session.stop();
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

  async function setAudioBackend(backend: AudioBackend) {
    if (backend !== 'web' && backend !== 'native') return;
    await session.setAudioBackend(backend);
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

  async function importUserProfile(payload: string) {
    if (!decodeUserProfile(payload)) return false;
    const currentStatus = session.status.value;
    const shouldRestart = currentStatus === 'starting' || currentStatus === 'listening';
    if (currentStatus !== 'idle') await session.stop();
    referenceTone.stopReferenceTone();
    const imported = await settings.importUserProfile(payload);
    if (shouldRestart) await start();
    return imported;
  }

  return {
    // state
    isListening: session.isListening,
    sessionStatus: session.status,
    detectorBackend: session.detectorBackend,
    currentFrequency: session.currentFrequency,
    detectionFrame,
    smoothedFrequency: computed(() => detectionFrame.value.freq),
    volume: computed(() => detectionFrame.value.level),
    error: session.error,
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
    nativeAudioAvailable: session.nativeAudioAvailable,
    syntheticAudioFixture: session.syntheticAudioFixture,
    usingNativeAudio: session.usingNativeAudio,
    usingSyntheticAudio: session.usingSyntheticAudio,

    // computed
    hasDetection,
    detectionRange: session.detectionRange,
    targetNote,
    cents,
    isInTune,
    currentNoteDisplay,
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
    toggleReferenceTone: referenceTone.toggleReferenceTone,
    clearError,
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
    exportUserProfile: settings.exportUserProfile,
    exportPracticeStats,
    importCustomTunings: tuning.importCustomTunings,
    importUserProfile,
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
