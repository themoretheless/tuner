import type {
  CustomTemperamentPayload,
  CustomTuningPayload,
} from '../../domain/customLibrary';
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

export interface LibraryPort {
  activeInstrument: InstrumentId;
  activeStringOffsets: number[];
  allTunings: Tuning[];
  capo: number;
  currentTuning: Tuning;
  customInstruments: InstrumentPreset[];
  customTemperaments: Temperament[];
  customTunings: Tuning[];
  deleteCustomTemperament(id: string): void;
  deleteCustomTuning(id: string): void;
  deleteInstrumentProfile(id: string): void;
  exportUserProfile(): string;
  formatFreq(frequency: number): string;
  getNoteDisplay(note: Pick<Note, 'name' | 'octave'>): string;
  importCustomTunings(tunings: Tuning[]): number;
  importUserProfile(payload: string): Promise<boolean>;
  instrumentOptions: InstrumentPreset[];
  leftHanded: boolean;
  saveCustomTemperament(payload: CustomTemperamentPayload): void;
  saveCustomTuning(payload: CustomTuningPayload): void;
  saveInstrumentProfile(name: string): InstrumentPreset | null;
  selectedString: Note | null;
  selectedStringIndex: number | null;
  setCapo(value: number): void;
  setInstrument(instrument: InstrumentId): void;
  setStringOffset(index: number, cents: number): void;
  setSweeteningProfile(profile: SweeteningProfileId): void;
  setTemperament(value: TemperamentId): void;
  setTemperamentRoot(value: NoteName): void;
  setTranspose(value: number): void;
  setTuning(tuning: Tuning): void;
  strings: Note[];
  sweeteningProfile: SweeteningProfileId;
  temperament: TemperamentId;
  temperamentOffsets: Record<NoteName, number>;
  temperamentOptions: Temperament[];
  temperamentRoot: NoteName;
  toggleString(note: Note, index?: number): void;
  transpose: number;
}
