import type { Ref } from 'vue';
import { useAudioInput } from '../../composables/useAudioInput';
import { useFileAudioInput } from '../../composables/useFileAudioInput';
import { useNativeAudioInput } from '../../composables/useNativeAudioInput';
import { useSyntheticAudioInput } from '../../composables/useSyntheticAudioInput';
import type { TunerInputSet } from '../../ports/tunerInputSet';
import type { SyntheticAudioFixture } from '../../utils/syntheticAudio';
import type { NativeAudioApiLoader } from '../../platform/nativeAudioApi';

interface TunerInputSetOptions {
  nativeAudioApiLoader?: NativeAudioApiLoader;
  selectedInputDeviceId: Ref<string>;
  syntheticFixture: SyntheticAudioFixture | null;
}

export function useTunerInputSet(options: TunerInputSetOptions) {
  return {
    file: useFileAudioInput(),
    native: useNativeAudioInput(options.nativeAudioApiLoader),
    synthetic: useSyntheticAudioInput(options.syntheticFixture),
    web: useAudioInput(options.selectedInputDeviceId),
  } satisfies TunerInputSet;
}
