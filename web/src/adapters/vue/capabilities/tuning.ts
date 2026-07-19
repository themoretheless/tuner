import type { Ref } from 'vue';
import type {
  CustomTemperamentPayload,
  CustomTuningPayload,
} from '../../../domain/customLibrary';
import type {
  InstrumentId,
  InstrumentPreset,
  Note,
  NoteName,
  SweeteningProfileId,
  Temperament,
  TemperamentId,
  Tuning,
} from '../../../utils/notes';

export interface TuningCapability {
  a4: Ref<number>;
  activeInstrument: Ref<InstrumentId>;
  activeStringOffsets: Readonly<Ref<number[]>>;
  allTunings: Readonly<Ref<Tuning[]>>;
  capo: Ref<number>;
  currentTuning: Ref<Tuning>;
  customInstruments: Ref<InstrumentPreset[]>;
  customTemperaments: Ref<Temperament[]>;
  customTunings: Ref<Tuning[]>;
  deleteCustomTemperament(id: string): void;
  deleteCustomTuning(id: string): void;
  deleteInstrumentProfile(id: string): void;
  formatFreq(frequency: number): string;
  getNoteDisplay(note: Pick<Note, 'name' | 'octave'>): string;
  importCustomTunings(tunings: Tuning[]): number;
  instrumentOptions: Readonly<Ref<InstrumentPreset[]>>;
  selectedString: Readonly<Ref<Note | null>>;
  selectedStringIndex: Ref<number | null>;
  saveCustomTemperament(payload: CustomTemperamentPayload): void;
  saveCustomTuning(payload: CustomTuningPayload): void;
  saveInstrumentProfile(name: string): InstrumentPreset | null;
  setA4(value: number): void;
  setCapo(value: number): void;
  setInstrument(instrument: InstrumentId): void;
  setStringOffset(index: number, cents: number): void;
  setSweeteningProfile(profile: SweeteningProfileId): void;
  setTemperament(value: TemperamentId): void;
  setTemperamentRoot(value: NoteName): void;
  setTranspose(value: number): void;
  setTuning(tuning: Tuning): void;
  strings: Readonly<Ref<Note[]>>;
  sweeteningProfile: Ref<SweeteningProfileId>;
  temperament: Ref<TemperamentId>;
  temperamentOffsets: Readonly<Ref<Record<NoteName, number>>>;
  temperamentOptions: Readonly<Ref<Temperament[]>>;
  temperamentRoot: Ref<NoteName>;
  toggleString(note: Note, index?: number): void;
  transpose: Ref<number>;
}
