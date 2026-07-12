import { inject, reactive, type InjectionKey, type UnwrapNestedRefs } from 'vue';
import type { useTuner } from '../composables/useTuner';

type TunerRoot = ReturnType<typeof useTuner>;

function createLiveTunerPort(root: TunerRoot) {
  return reactive({
    a4: root.a4,
    allTunings: root.allTunings,
    audioBackend: root.audioBackend,
    cents: root.cents,
    currentNoteDisplay: root.currentNoteDisplay,
    currentTuning: root.currentTuning,
    hasDetection: root.hasDetection,
    detectionFrame: root.detectionFrame,
    displayMode: root.displayMode,
    error: root.error,
    formatFreq: root.formatFreq,
    getNoteDisplay: root.getNoteDisplay,
    inputDevices: root.inputDevices,
    isInTune: root.isInTune,
    isListening: root.isListening,
    leftHanded: root.leftHanded,
    nativeAudioAvailable: root.nativeAudioAvailable,
    referencePlaying: root.referencePlaying,
    selectedInputDeviceId: root.selectedInputDeviceId,
    selectedString: root.selectedString,
    selectedStringIndex: root.selectedStringIndex,
    sessionStatus: root.sessionStatus,
    strings: root.strings,
    targetNote: root.targetNote,
    usingNativeAudio: root.usingNativeAudio,
    volume: root.volume,
    clearError: root.clearError,
    refreshInputDevices: root.refreshInputDevices,
    setA4: root.setA4,
    setAudioBackend: root.setAudioBackend,
    setDisplayMode: root.setDisplayMode,
    setInputDevice: root.setInputDevice,
    setTuning: root.setTuning,
    start: root.start,
    stop: root.stop,
    toggleReferenceTone: root.toggleReferenceTone,
    toggleString: root.toggleString,
  });
}

function createLibraryPort(root: TunerRoot) {
  return reactive({
    activeInstrument: root.activeInstrument,
    activeStringOffsets: root.activeStringOffsets,
    allTunings: root.allTunings,
    capo: root.capo,
    currentTuning: root.currentTuning,
    customInstruments: root.customInstruments,
    customTemperaments: root.customTemperaments,
    customTunings: root.customTunings,
    formatFreq: root.formatFreq,
    getNoteDisplay: root.getNoteDisplay,
    instrumentOptions: root.instrumentOptions,
    leftHanded: root.leftHanded,
    selectedString: root.selectedString,
    selectedStringIndex: root.selectedStringIndex,
    strings: root.strings,
    sweeteningProfile: root.sweeteningProfile,
    temperament: root.temperament,
    temperamentOffsets: root.temperamentOffsets,
    temperamentOptions: root.temperamentOptions,
    temperamentRoot: root.temperamentRoot,
    transpose: root.transpose,
    exportUserProfile: root.exportUserProfile,
    importUserProfile: root.importUserProfile,
    deleteCustomTemperament: root.deleteCustomTemperament,
    deleteCustomTuning: root.deleteCustomTuning,
    deleteInstrumentProfile: root.deleteInstrumentProfile,
    importCustomTunings: root.importCustomTunings,
    saveCustomTemperament: root.saveCustomTemperament,
    saveCustomTuning: root.saveCustomTuning,
    saveInstrumentProfile: root.saveInstrumentProfile,
    setCapo: root.setCapo,
    setInstrument: root.setInstrument,
    setStringOffset: root.setStringOffset,
    setSweeteningProfile: root.setSweeteningProfile,
    setTemperament: root.setTemperament,
    setTemperamentRoot: root.setTemperamentRoot,
    setTranspose: root.setTranspose,
    setTuning: root.setTuning,
    toggleString: root.toggleString,
  });
}

function createPracticePort(root: TunerRoot) {
  return reactive({
    earTrainingAccuracy: root.earTrainingAccuracy,
    earTrainingAttempts: root.earTrainingAttempts,
    earTrainingCorrect: root.earTrainingCorrect,
    earTrainingRevealed: root.earTrainingRevealed,
    earTrainingStreak: root.earTrainingStreak,
    earTrainingTarget: root.earTrainingTarget,
    getNoteDisplay: root.getNoteDisplay,
    metronomeBeat: root.metronomeBeat,
    metronomeBeats: root.metronomeBeats,
    metronomeBpm: root.metronomeBpm,
    metronomeRunning: root.metronomeRunning,
    metronomeSubdivision: root.metronomeSubdivision,
    metronomeSubdivisionStep: root.metronomeSubdivisionStep,
    practiceHistory: root.practiceHistory,
    practiceSummary: root.practiceSummary,
    clearPracticeHistory: root.clearPracticeHistory,
    exportPracticeStats: root.exportPracticeStats,
    markEarTraining: root.markEarTraining,
    nextEarTraining: root.nextEarTraining,
    playEarTraining: root.playEarTraining,
    resetEarTraining: root.resetEarTraining,
    revealEarTraining: root.revealEarTraining,
    setMetronomeBeats: root.setMetronomeBeats,
    setMetronomeBpm: root.setMetronomeBpm,
    setMetronomeSubdivision: root.setMetronomeSubdivision,
    tapMetronome: root.tapMetronome,
    toggleMetronome: root.toggleMetronome,
  });
}

function createAnalysisPort(root: TunerRoot) {
  return reactive({
    centsHistory: root.centsHistory,
    displayMode: root.displayMode,
    formatFreq: root.formatFreq,
    isListening: root.isListening,
    layoutMode: root.layoutMode,
    leftHanded: root.leftHanded,
    showSpectrogram: root.showSpectrogram,
    showSpectrum: root.showSpectrum,
    showWaveform: root.showWaveform,
    smoothedFrequency: root.smoothedFrequency,
    spectrumFrame: root.spectrumFrame,
    targetNote: root.targetNote,
    themeMode: root.themeMode,
    usingNativeAudio: root.usingNativeAudio,
    waveformFrame: root.waveformFrame,
    setDisplayMode: root.setDisplayMode,
    setLayoutMode: root.setLayoutMode,
    setLeftHanded: root.setLeftHanded,
    setThemeMode: root.setThemeMode,
    start: root.start,
    toggleFullscreen: root.toggleFullscreen,
  });
}

export type LiveTunerPort = UnwrapNestedRefs<ReturnType<typeof createLiveTunerPort>>;
export type LibraryPort = UnwrapNestedRefs<ReturnType<typeof createLibraryPort>>;
export type PracticePort = UnwrapNestedRefs<ReturnType<typeof createPracticePort>>;
export type AnalysisPort = UnwrapNestedRefs<ReturnType<typeof createAnalysisPort>>;

const liveTunerKey: InjectionKey<LiveTunerPort> = Symbol('live-tuner-port');
const libraryKey: InjectionKey<LibraryPort> = Symbol('library-port');
const practiceKey: InjectionKey<PracticePort> = Symbol('practice-port');
const analysisKey: InjectionKey<AnalysisPort> = Symbol('analysis-port');

export function createFeaturePorts(root: TunerRoot) {
  return {
    live: createLiveTunerPort(root),
    library: createLibraryPort(root),
    practice: createPracticePort(root),
    analysis: createAnalysisPort(root),
  };
}

export const featurePortKeys = {
  live: liveTunerKey,
  library: libraryKey,
  practice: practiceKey,
  analysis: analysisKey,
};

export function useLiveTunerPort() {
  return injectRequired(liveTunerKey, 'live tuner');
}

export function useLibraryPort() {
  return injectRequired(libraryKey, 'library');
}

export function usePracticePort() {
  return injectRequired(practiceKey, 'practice');
}

export function useAnalysisPort() {
  return injectRequired(analysisKey, 'analysis');
}

function injectRequired<T>(key: InjectionKey<T>, name: string) {
  const port = inject(key);
  if (!port) throw new Error(`${name} feature port was not provided`);
  return port;
}
