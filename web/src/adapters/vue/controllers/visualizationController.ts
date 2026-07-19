import { computed, ref, type Ref } from 'vue';
import { useVisualizationFrames } from '../../../composables/useVisualizationFrames';
import type { ReadableValue } from '../../../ports/audioInput';

export interface VisualizationControllerDependencies {
  analyser: Ref<AnalyserNode | null>;
  isWebAudioListening: ReadableValue<boolean>;
  sampleRate: Ref<number>;
  showSpectrogram: Readonly<Ref<boolean>>;
  showSpectrum: Readonly<Ref<boolean>>;
  showWaveform: Readonly<Ref<boolean>>;
  usingNativeAudio: Readonly<Ref<boolean>>;
  usingSyntheticAudio: Readonly<Ref<boolean>>;
}

export function useVisualizationController(dependencies: VisualizationControllerDependencies) {
  const featureActive = ref(false);
  const active = computed(() => (
    featureActive.value
    && !dependencies.usingNativeAudio.value
    && !dependencies.usingSyntheticAudio.value
    && dependencies.isWebAudioListening.value
    && (
      dependencies.showWaveform.value
      || dependencies.showSpectrum.value
      || dependencies.showSpectrogram.value
    )
  ));
  const frames = useVisualizationFrames(dependencies.analyser, dependencies.sampleRate, active);
  return {
    ...frames,
    activate: () => { featureActive.value = true; },
    deactivate: () => { featureActive.value = false; },
  };
}
