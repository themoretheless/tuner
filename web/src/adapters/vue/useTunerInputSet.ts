import type { Ref } from 'vue';
import { useAudioInput } from '../../composables/useAudioInput';
import { useFileAudioInput } from '../../composables/useFileAudioInput';
import { useSyntheticAudioInput } from '../../composables/useSyntheticAudioInput';
import type { TunerInputSet } from '../../ports/tunerInputSet';
import type { SyntheticAudioFixture } from '../../utils/syntheticAudio';

interface TunerInputSetOptions {
  selectedInputDeviceId: Ref<string>;
  syntheticFixture: SyntheticAudioFixture | null;
}

export function useTunerInputSet(options: TunerInputSetOptions) {
  return {
    file: useFileAudioInput(),
    synthetic: useSyntheticAudioInput(options.syntheticFixture),
    web: useAudioInput(options.selectedInputDeviceId),
  } satisfies TunerInputSet;
}
