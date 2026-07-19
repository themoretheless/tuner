import { computed, onScopeDispose } from 'vue';
import type { TunerApplication } from '../../app/tunerApplication';
import { useCentsHistory } from '../../composables/useCentsHistory';
import { useReferenceTone } from '../../composables/useReferenceTone';
import { useSettings } from '../../composables/useSettings';
import { useTunerSession } from '../../composables/useTunerSession';
import { useTuningState } from '../../composables/useTuningState';
import { createDisplayController } from '../../application/controllers/displayController';
import { createListeningController } from '../../application/controllers/listeningController';
import { createProfileController } from '../../application/controllers/profileController';
import { browserFullscreenPort } from '../../ports/fullscreen';
import { createWebAudioOutputPort } from '../../platform/webAudioOutput';
import { useDetectionController } from './controllers/detectionController';
import { usePipelineController } from './controllers/pipelineController';
import { usePracticeController } from './controllers/practiceController';
import { useVisualizationController } from './controllers/visualizationController';
import { createAnalysisPort } from './ports/analysisPort';
import { createLibraryPort } from './ports/libraryPort';
import { createLiveTunerPort } from './ports/liveTunerPort';
import { createPipelinePort } from './ports/pipelinePort';
import { createPracticePort } from './ports/practicePort';
import { createShellPort } from './ports/shellPort';

export function useTunerApplication(): TunerApplication {
  const audioOutput = createWebAudioOutputPort();
  onScopeDispose(() => { void audioOutput.dispose().catch(() => {}); });
  const settings = useSettings();
  const session = useTunerSession({
    audioBackend: settings.audioBackend,
    pipelineConfig: settings.pipelineConfig,
    selectedInputDeviceId: settings.selectedInputDeviceId,
  });
  const tuning = useTuningState(
    computed(() => session.detectionFrame.value.freq),
    { settings, onResetDetection: session.resetDetection },
  );
  const detection = useDetectionController(session, tuning);
  const referenceTone = useReferenceTone(() => detection.targetNote.value, audioOutput);
  const history = useCentsHistory(detection.cents, detection.hasDetection);
  const listening = createListeningController({
    clearHistory: history.clear,
    detectionRange: tuning.detectionRange,
    session,
    stopReferenceTone: referenceTone.stopReferenceTone,
  });
  const displayCommands = createDisplayController({
    displayMode: settings.displayMode,
    fullscreen: browserFullscreenPort,
    layoutMode: settings.layoutMode,
    leftHanded: settings.leftHanded,
    themeMode: settings.themeMode,
  });
  const display = {
    displayMode: settings.displayMode,
    layoutMode: settings.layoutMode,
    leftHanded: settings.leftHanded,
    themeMode: settings.themeMode,
    ...displayCommands,
  };
  const pipeline = usePipelineController(settings.pipelineConfig);
  const practice = usePracticeController({
    beats: settings.metronomeBeats,
    bpm: settings.metronomeBpm,
    formatNote: tuning.getNoteDisplay,
    history: settings.practiceHistory,
    output: audioOutput,
    pickNote: tuning.getRandomPracticeNote,
    playNote: referenceTone.playTimedTone,
    subdivision: settings.metronomeSubdivision,
  });
  const visualization = useVisualizationController({
    analyser: session.analyser,
    isWebAudioListening: session.webAudioListening,
    sampleRate: session.audioSampleRate,
    showSpectrogram: settings.showSpectrogram,
    showSpectrum: settings.showSpectrum,
    showWaveform: settings.showWaveform,
    usingNativeAudio: session.usingNativeAudio,
    usingSyntheticAudio: session.usingSyntheticAudio,
  });
  const profile = createProfileController({
    exportProfile: settings.exportUserProfile,
    importProfile: settings.importUserProfile,
    sessionStatus: session.status,
    start: listening.start,
    stop: session.stop,
    stopReferenceTone: referenceTone.stopReferenceTone,
  });
  return {
    featurePorts: {
      analysis: createAnalysisPort({
        detection,
        display,
        history,
        listening,
        session,
        settings,
        tuning,
        visualization,
      }),
      library: createLibraryPort({ display, profile, tuning }),
      live: createLiveTunerPort({
        detection,
        display,
        listening,
        referenceTone,
        session,
        settings,
        tuning,
      }),
      pipeline: createPipelinePort({ detection, listening, pipeline, session, tuning }),
      practice: createPracticePort({ practice, tuning }),
    },
    shell: createShellPort({ display, listening, referenceTone, session, tuning }),
  };
}
