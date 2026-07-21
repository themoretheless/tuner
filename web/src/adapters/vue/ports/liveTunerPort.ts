import { computed, reactive } from 'vue';
import type { LiveTunerPort } from '../../../app/ports/liveTuner';
import type { DetectionCapability } from '../capabilities/detection';
import type { DisplayCapability } from '../capabilities/display';
import type {
  AudioSettingsCapability,
  ListeningCapability,
  ReferenceToneCapability,
  SessionCapability,
} from '../capabilities/session';
import type { TuningCapability } from '../capabilities/tuning';

interface Dependencies {
  detection: DetectionCapability;
  display: Pick<DisplayCapability, 'displayMode' | 'leftHanded' | 'setDisplayMode'>;
  listening: ListeningCapability;
  referenceTone: ReferenceToneCapability;
  session: SessionCapability;
  settings: AudioSettingsCapability;
  tuning: TuningCapability;
}

export function createLiveTunerPort(services: Dependencies): LiveTunerPort {
  const { detection, display, listening, referenceTone, session, settings, tuning } = services;
  return reactive({
    a4: tuning.a4,
    allTunings: tuning.allTunings,
    audioBackend: settings.audioBackend,
    cents: computed(() => detection.presentationFrame.value.cents),
    currentNoteDisplay: computed(() => (
      detection.presentationFrame.value.freq == null
        ? null
        : detection.presentationFrame.value.note
    )),
    currentTuning: tuning.currentTuning,
    detectionFrame: detection.presentationFrame,
    detectionFrameTimebase: session.detectionFrameTimebase,
    detectorBackend: session.detectorBackend,
    diagnosticFrame: detection.frame,
    displayMode: display.displayMode,
    error: session.error,
    exactPcmCaptureAvailable: session.exactPcmCaptureAvailable,
    fileAudioDuration: session.fileAudioDuration,
    fileAudioName: session.fileAudioName,
    fileAudioProgress: session.fileAudioProgress,
    formatFreq: tuning.formatFreq,
    getNoteDisplay: tuning.getNoteDisplay,
    hasDetection: computed(() => detection.presentationFrame.value.freq != null),
    inputDevices: session.inputDevices,
    isInTune: computed(() => detection.presentationFrame.value.inTune),
    isListening: session.isListening,
    leftHanded: display.leftHanded,
    nativeAudioAvailable: session.nativeAudioAvailable,
    referencePlaying: referenceTone.referencePlaying,
    selectedInputDeviceId: session.selectedInputDeviceId,
    selectedString: tuning.selectedString,
    selectedStringIndex: tuning.selectedStringIndex,
    sessionStatus: session.status,
    strings: tuning.strings,
    targetNote: detection.targetNote,
    usingFileAudio: session.usingFileAudio,
    usingNativeAudio: session.usingNativeAudio,
    usingSyntheticAudio: session.usingSyntheticAudio,
    volume: detection.volume,
    beginExactPcmCapture: session.beginExactPcmCapture,
    clearError: listening.clearError,
    finishExactPcmCapture: session.finishExactPcmCapture,
    loadAudioFile: session.loadAudioFile,
    refreshInputDevices: session.refreshInputDevices,
    setA4: tuning.setA4,
    setAudioBackend: listening.setAudioBackend,
    setDisplayMode: display.setDisplayMode,
    setInputDevice: session.setInputDevice,
    setTuning: tuning.setTuning,
    start: listening.start,
    stop: listening.stop,
    toggle: listening.toggle,
    toggleReferenceTone: referenceTone.toggleReferenceTone,
    toggleString: tuning.toggleString,
    useMicrophoneInput: session.useMicrophoneInput,
  });
}
