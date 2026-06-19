import { computed } from 'vue';
import { useAudioInput } from './useAudioInput';
import { useCentsHistory } from './useCentsHistory';
import { useEarTraining } from './useEarTraining';
import { useMetronome } from './useMetronome';
import { usePitchLoop } from './usePitchLoop';
import { useReferenceTone } from './useReferenceTone';
import { useSettings } from './useSettings';
import { useTuningState } from './useTuningState';
import type { DisplayMode } from '../utils/settingsStorage';

export function useTuner() {
  const settings = useSettings();
  const audio = useAudioInput(settings.selectedInputDeviceId);
  const pitch = usePitchLoop(audio.readFrame);
  const tuning = useTuningState(pitch.smoothedFrequency, {
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

  async function start() {
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
    referenceTone.stopReferenceTone();
  }

  function playRandomString() {
    earTraining.nextChallenge();
  }

  function setDisplayMode(mode: DisplayMode) {
    settings.displayMode.value = mode;
  }

  return {
    // state
    isListening: audio.isListening,
    currentFrequency: pitch.currentFrequency,
    smoothedFrequency: pitch.smoothedFrequency,
    volume: pitch.volume,
    error: audio.error,
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
    displayMode: settings.displayMode,
    temperament: tuning.temperament,
    transpose: tuning.transpose,
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
    sweeteningProfile: tuning.sweeteningProfile,

    // computed
    detectedNote: tuning.detectedNote,
    targetNote: tuning.targetNote,
    cents: tuning.cents,
    isInTune: tuning.isInTune,
    currentNoteDisplay: tuning.currentNoteDisplay,
    strings: tuning.strings,
    isChromaticMode: tuning.isChromaticMode,

    // visualizers / persisted UI settings
    analyser: audio.analyser,
    showWaveform: settings.showWaveform,
    showSpectrum: settings.showSpectrum,

    // actions
    start,
    stop,
    toggleString: tuning.toggleString,
    toggleReferenceTone: referenceTone.toggleReferenceTone,
    clearError: audio.clearError,
    clearCentsHistory: centsHistory.clear,
    refreshInputDevices: audio.refreshInputDevices,
    setA4: tuning.setA4,
    setCapo: tuning.setCapo,
    setDisplayMode,
    setInputDevice: audio.setInputDevice,
    setMetronomeBeats: metronome.setBeats,
    setMetronomeBpm: metronome.setBpm,
    setMetronomeSubdivision: metronome.setSubdivision,
    setInstrument: tuning.setInstrument,
    setStringOffset: tuning.setStringOffset,
    setSweeteningProfile: tuning.setSweeteningProfile,
    setTemperament: tuning.setTemperament,
    setTranspose: tuning.setTranspose,
    setTuning: tuning.setTuning,
    playRandomString,
    saveCustomTuning: tuning.saveCustomTuning,
    deleteCustomTuning: tuning.deleteCustomTuning,
    exportCustomTunings: tuning.exportCustomTunings,
    importCustomTunings: tuning.importCustomTunings,
    markEarTraining: earTraining.mark,
    nextEarTraining: earTraining.nextChallenge,
    playEarTraining: earTraining.playTarget,
    resetEarTraining: earTraining.reset,
    revealEarTraining: earTraining.reveal,
    tapMetronome: metronome.tapTempo,
    toggleMetronome: metronome.toggle,

    // data / helpers
    allTunings: tuning.allTunings,
    formatFreq: tuning.formatFreq,
    getNoteDisplay: tuning.getNoteDisplay,
  };
}
