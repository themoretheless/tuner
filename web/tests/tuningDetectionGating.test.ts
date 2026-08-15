import { effectScope, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useTuningDetection } from '../src/composables/useTuningDetection';
import { TEMPERAMENTS, TUNINGS, type Note } from '../src/utils/notes';

const strings = TUNINGS.find((tuning) => tuning.id === 'standard')!.strings;

function setup(frameResolved: ReturnType<typeof ref<boolean>>) {
  const detectedFrequency = ref<number | null>(null);
  const scope = effectScope();
  const detection = scope.run(() => useTuningDetection({
    a4: ref(440),
    activeInstrument: ref('guitar' as const),
    detectedFrequency,
    frameResolved,
    isChromaticMode: ref(false),
    selectedString: ref<Note | null>(null),
    strings: ref(strings),
    temperament: ref('equal' as const),
    temperamentOptions: ref(TEMPERAMENTS),
    temperamentRoot: ref('A' as const),
    transpose: ref(0),
  }))!;
  return { detectedFrequency, detection, scope };
}

describe('useTuningDetection resolved-frame gating', () => {
  it('keeps the TypeScript machine idle while frames are resolved by the engine', () => {
    const frameResolved = ref(true);
    const { detectedFrequency, detection, scope } = setup(frameResolved);

    detectedFrequency.value = 95;
    detectedFrequency.value = 95.5;
    expect(detection.detectedNote.value).toBeNull();
    expect(detection.currentNoteDisplay.value).toBeNull();

    scope.stop();
  });

  it('resumes fallback resolution from a clean state when frames stop being resolved', () => {
    const frameResolved = ref(false);
    const { detectedFrequency, detection, scope } = setup(frameResolved);

    detectedFrequency.value = 95;
    expect(detection.targetNote.value.name).toBe('E');
    expect(detection.detectedNote.value).not.toBeNull();

    frameResolved.value = true;
    expect(detection.detectedNote.value).toBeNull();

    frameResolved.value = false;
    detectedFrequency.value = 104;
    expect(detection.targetNote.value.name).toBe('A');

    scope.stop();
  });
});
