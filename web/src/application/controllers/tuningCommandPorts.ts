import type {
  InstrumentId,
  InstrumentPreset,
  Note,
  NoteName,
  SweeteningProfileId,
  Temperament,
  TemperamentId,
  Tuning,
} from '../../utils/notes';
import type { ReadableValue, WritableValue } from '../ports/value';

export interface TuningCommandModel {
  currentTuning: WritableValue<Tuning>;
  instrumentOptions: ReadableValue<InstrumentPreset[]>;
  resolveDefaultTuning(instrument: InstrumentId): Tuning;
  selectedStringIndex: WritableValue<number | null>;
  strings: ReadableValue<Note[]>;
  temperamentOptions: ReadableValue<Temperament[]>;
}

export interface TuningCommandSettings {
  a4: WritableValue<number>;
  activeInstrument: WritableValue<InstrumentId>;
  capo: WritableValue<number>;
  lastTuningId: WritableValue<string>;
  stringOffsets: WritableValue<number[]>;
  sweeteningProfile: WritableValue<SweeteningProfileId>;
  temperament: WritableValue<TemperamentId>;
  temperamentRoot: WritableValue<NoteName>;
  transpose: WritableValue<number>;
}

export interface TuningCommandDependencies {
  model: TuningCommandModel;
  random?: () => number;
  resetDetection(): void;
  resetInTune(): void;
  settings: TuningCommandSettings;
}
