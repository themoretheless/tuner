import { computed, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { createCustomLibraryController } from '../src/application/controllers/customLibraryController';
import {
  INSTRUMENTS,
  TUNINGS,
  noteWithA4,
  type Temperament,
  type Tuning,
} from '../src/utils/notes';

describe('custom library controller', () => {
  it('coordinates tuning, instrument and temperament CRUD through injected refs', () => {
    let timestamp = 42;
    const activeInstrument = ref('guitar');
    const currentTuning = ref<Tuning>(TUNINGS.find((tuning) => tuning.id === 'standard')!);
    const customInstruments = ref([]);
    const customTemperaments = ref<Temperament[]>([]);
    const customTunings = ref<Tuning[]>([]);
    const strings = ref([noteWithA4({ name: 'E', octave: 2 }, 440)]);
    const temperament = ref('equal');
    const resetDetection = vi.fn();
    const setTuning = vi.fn((tuning: Tuning) => {
      currentTuning.value = tuning;
    });
    const standard = currentTuning.value;
    const controller = createCustomLibraryController({
      activeInstrument,
      currentTuning,
      customInstruments,
      customTemperaments,
      customTunings,
      instrumentOptions: computed(() => [...INSTRUMENTS, ...customInstruments.value]),
      now: () => timestamp++,
      resetDetection,
      resolveDefaultTuning: () => standard,
      setTuning,
      strings,
      temperament,
    });

    controller.saveCustomTuning({ name: 'Studio', strings: strings.value });
    expect(customTunings.value[0].id).toBe('custom-16');
    expect(setTuning).toHaveBeenLastCalledWith(customTunings.value[0]);

    const profile = controller.saveInstrumentProfile('Travel');
    expect(profile?.id).toBe('instrument-17');
    expect(activeInstrument.value).toBe('instrument-17');

    controller.saveCustomTemperament({ name: 'Pure', offsets: [1, 2] });
    expect(temperament.value).toBe('temperament-18');
    expect(resetDetection).toHaveBeenCalledOnce();

    controller.deleteInstrumentProfile('instrument-17');
    expect(activeInstrument.value).toBe('guitar');
    expect(customTunings.value.some((tuning) => tuning.instrument === 'instrument-17')).toBe(false);
  });

  it('normalizes imports against the current instrument registry', () => {
    const customTunings = ref<Tuning[]>([]);
    const standard = TUNINGS.find((tuning) => tuning.id === 'standard')!;
    const controller = createCustomLibraryController({
      activeInstrument: ref('bass'),
      currentTuning: ref(standard),
      customInstruments: ref([]),
      customTemperaments: ref([]),
      customTunings,
      instrumentOptions: ref(INSTRUMENTS),
      now: () => 42,
      resetDetection() {},
      resolveDefaultTuning: () => standard,
      setTuning() {},
      strings: ref(standard.strings),
      temperament: ref('equal'),
    });

    expect(controller.importCustomTunings([{
      id: 'shared',
      name: 'Shared',
      strings: standard.strings,
      instrument: 'missing',
    }])).toBe(1);
    expect(customTunings.value[0].instrument).toBe('bass');
  });
});
