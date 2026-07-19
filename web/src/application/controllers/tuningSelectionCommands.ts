import { chromaticPracticeNotes } from '../../domain/tuningCalculations';
import { noteId, type InstrumentId, type Note, type Tuning } from '../../utils/notes';
import type { TuningCommandDependencies } from './tuningCommandPorts';

export function createTuningSelectionCommands({
  model,
  random = Math.random,
  resetDetection,
  resetInTune,
  settings,
}: TuningCommandDependencies) {
  function setTuning(tuning: Tuning) {
    model.currentTuning.value = tuning;
    settings.lastTuningId.value = tuning.id;
    model.selectedStringIndex.value = null;
    resetDetection();
  }

  function setInstrument(instrument: InstrumentId) {
    if (!model.instrumentOptions.value.some((item) => item.id === instrument)) return;
    settings.activeInstrument.value = instrument;
    setTuning(model.resolveDefaultTuning(instrument));
  }

  function toggleString(note: Note, index?: number) {
    const nextIndex = Number.isInteger(index)
      ? index as number
      : model.strings.value.findIndex((string) => noteId(string) === noteId(note));
    if (nextIndex < 0) return;
    model.selectedStringIndex.value = model.selectedStringIndex.value === nextIndex ? null : nextIndex;
    resetInTune();
  }

  function getRandomPracticeNote() {
    const notes = model.strings.value.length ? model.strings.value : chromaticPracticeNotes(
      settings.activeInstrument.value,
      settings.a4.value,
      settings.temperament.value,
      settings.transpose.value,
      settings.temperamentRoot.value,
      model.temperamentOptions.value,
    );
    return notes[Math.floor(random() * notes.length)];
  }

  return { getRandomPracticeNote, setInstrument, setTuning, toggleString };
}
