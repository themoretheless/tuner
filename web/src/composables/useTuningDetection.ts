import { computed, shallowRef, watch, type Ref } from 'vue';
import {
  createTuningDetectionMachine,
  type TuningDetectionInput,
} from '../domain/tuningDetectionMachine';
import { detectionRangeForStrings } from '../domain/tuningCalculations';
import {
  type InstrumentId,
  type Note,
  type NoteName,
  type Temperament,
  type TemperamentId,
} from '../utils/notes';

interface TuningDetectionDependencies {
  a4: Readonly<Ref<number>>;
  activeInstrument: Readonly<Ref<InstrumentId>>;
  detectedFrequency: Readonly<Ref<number | null>>;
  // True while detection frames arrive already resolved (note/cents/in-tune
  // computed by the Rust engine). The TypeScript machine then stays idle:
  // running a second hysteresis machine per frame would burn CPU in the hot
  // path only to have its result discarded, and its target could drift from
  // the one the resolved frame displays.
  frameResolved?: Readonly<Ref<boolean>>;
  isChromaticMode: Readonly<Ref<boolean>>;
  selectedString: Readonly<Ref<Note | null>>;
  strings: Readonly<Ref<Note[]>>;
  temperament: Readonly<Ref<TemperamentId>>;
  temperamentOptions: Readonly<Ref<Temperament[]>>;
  temperamentRoot: Readonly<Ref<NoteName>>;
  transpose: Readonly<Ref<number>>;
}

export function useTuningDetection(dependencies: TuningDetectionDependencies) {
  const machine = createTuningDetectionMachine();
  const snapshot = shallowRef(machine.process(readInput()));

  const detectionRange = computed(() => detectionRangeForStrings(
    dependencies.strings.value,
    dependencies.activeInstrument.value,
    dependencies.selectedString.value,
  ));

  watch(dependencies.detectedFrequency, () => {
    if (!frameResolved()) update();
  }, { flush: 'sync', immediate: true });
  if (dependencies.frameResolved) {
    // Entering resolved mode clears stale machine state; leaving it lets the
    // fallback start from a clean acquisition instead of an old latch.
    watch(dependencies.frameResolved, () => {
      machine.reset();
      update();
    }, { flush: 'sync' });
  }
  watch([
    dependencies.a4,
    dependencies.isChromaticMode,
    dependencies.selectedString,
    dependencies.strings,
    dependencies.temperament,
    dependencies.temperamentOptions,
    dependencies.temperamentRoot,
    dependencies.transpose,
  ], () => {
    machine.reset();
    update();
  }, { deep: true, flush: 'sync' });

  function frameResolved() {
    return dependencies.frameResolved?.value === true;
  }

  function readInput(): TuningDetectionInput {
    return {
      a4: dependencies.a4.value,
      frequency: frameResolved() ? null : dependencies.detectedFrequency.value,
      isChromaticMode: dependencies.isChromaticMode.value,
      selectedString: dependencies.selectedString.value,
      strings: dependencies.strings.value,
      temperament: dependencies.temperament.value,
      temperamentOptions: dependencies.temperamentOptions.value,
      temperamentRoot: dependencies.temperamentRoot.value,
      transpose: dependencies.transpose.value,
    };
  }

  function update() {
    snapshot.value = machine.process(readInput());
  }

  function resetTracking() {
    machine.reset();
    update();
  }

  function resetInTune() {
    machine.resetInTune();
    update();
  }

  return {
    cents: computed(() => snapshot.value.cents),
    currentNoteDisplay: computed(() => snapshot.value.currentNoteDisplay),
    detectedNote: computed(() => snapshot.value.detectedNote),
    detectionRange,
    isInTune: computed(() => snapshot.value.isInTune),
    resetInTune,
    resetTracking,
    targetNote: computed(() => snapshot.value.targetNote),
  };
}
