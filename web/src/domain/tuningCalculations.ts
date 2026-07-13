import type { PitchDetectionRange } from '../utils/pitch';
import {
  NOTE_NAMES,
  SWEETENING_PROFILES,
  TUNINGS,
  noteWithA4,
  type InstrumentId,
  type InstrumentPreset,
  type Note,
  type NoteName,
  type SweeteningProfileId,
  type Temperament,
  type TemperamentId,
  type Tuning,
} from '../utils/notes';

export function tuningsForInstrument(
  instrument: InstrumentId,
  customTunings: Tuning[],
) {
  const builtIn = TUNINGS.filter((tuning) => (
    tuning.kind === 'chromatic' || tuning.instrument === instrument
  ));
  const custom = customTunings.filter((tuning) => (
    tuning.instrument === instrument || (!tuning.instrument && instrument === 'guitar')
  ));
  return [...builtIn, ...custom];
}

export function defaultTuningForInstrument(
  instrument: InstrumentId,
  instruments: InstrumentPreset[],
  storedTunings: Tuning[],
) {
  const defaultId = instruments.find((item) => item.id === instrument)?.defaultTuningId || 'standard';
  return storedTunings.find((tuning) => tuning.id === defaultId)
    || TUNINGS.find((tuning) => tuning.id === 'standard')
    || TUNINGS[0];
}

export function detectionRangeForStrings(
  strings: Note[],
  instrument: InstrumentId,
  selectedString: Note | null = null,
): PitchDetectionRange {
  const frequencies = (selectedString ? [selectedString] : strings)
    .map((string) => string.frequency)
    .filter((frequency) => Number.isFinite(frequency) && frequency > 0);
  if (!frequencies.length) {
    return instrument === 'vocal'
      ? { minFrequency: 65, maxFrequency: 1_100 }
      : { minFrequency: 24, maxFrequency: 1_200 };
  }
  return {
    minFrequency: Math.max(20, Math.floor(Math.min(...frequencies) * 0.65)),
    maxFrequency: Math.min(1_800, Math.ceil(Math.max(...frequencies) * 1.45)),
  };
}

export function offsetsForProfile(
  profile: SweeteningProfileId,
  instrument: InstrumentId,
  length: number,
  customOffsets: number[],
) {
  if (profile === 'custom') {
    return Array.from({ length }, (_, index) => customOffsets[index] ?? 0);
  }
  if (profile === 'none') return Array.from({ length }, () => 0);

  const preferred = SWEETENING_PROFILES.find((item) => item.id === profile)
    || SWEETENING_PROFILES.find((item) => item.id === `sweet-${instrument}`);
  return Array.from({ length }, (_, index) => preferred?.offsets[index] ?? 0);
}

export function chromaticPracticeNotes(
  instrument: InstrumentId,
  a4: number,
  temperament: TemperamentId,
  transpose: number,
  temperamentRoot: NoteName,
  temperamentOptions: Temperament[],
) {
  const octaves = instrument === 'vocal' ? [3, 4] : [2, 3, 4];
  return octaves.flatMap((octave) => NOTE_NAMES.map((name) => noteWithA4(
    { name, octave },
    a4,
    temperament,
    transpose,
    temperamentRoot,
    temperamentOptions,
  )));
}
