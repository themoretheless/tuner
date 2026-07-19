import { reactive } from 'vue';
import type { LibraryPort } from '../../../app/ports/library';
import type { DisplayCapability } from '../capabilities/display';
import type { ProfileCapability } from '../capabilities/session';
import type { TuningCapability } from '../capabilities/tuning';

interface Dependencies {
  display: Pick<DisplayCapability, 'leftHanded'>;
  profile: ProfileCapability;
  tuning: TuningCapability;
}

export function createLibraryPort({ display, profile, tuning }: Dependencies): LibraryPort {
  return reactive({
    activeInstrument: tuning.activeInstrument,
    activeStringOffsets: tuning.activeStringOffsets,
    allTunings: tuning.allTunings,
    capo: tuning.capo,
    currentTuning: tuning.currentTuning,
    customInstruments: tuning.customInstruments,
    customTemperaments: tuning.customTemperaments,
    customTunings: tuning.customTunings,
    formatFreq: tuning.formatFreq,
    getNoteDisplay: tuning.getNoteDisplay,
    instrumentOptions: tuning.instrumentOptions,
    leftHanded: display.leftHanded,
    selectedString: tuning.selectedString,
    selectedStringIndex: tuning.selectedStringIndex,
    strings: tuning.strings,
    sweeteningProfile: tuning.sweeteningProfile,
    temperament: tuning.temperament,
    temperamentOffsets: tuning.temperamentOffsets,
    temperamentOptions: tuning.temperamentOptions,
    temperamentRoot: tuning.temperamentRoot,
    transpose: tuning.transpose,
    deleteCustomTemperament: tuning.deleteCustomTemperament,
    deleteCustomTuning: tuning.deleteCustomTuning,
    deleteInstrumentProfile: tuning.deleteInstrumentProfile,
    exportUserProfile: profile.exportProfile,
    importCustomTunings: tuning.importCustomTunings,
    importUserProfile: profile.importProfile,
    saveCustomTemperament: tuning.saveCustomTemperament,
    saveCustomTuning: tuning.saveCustomTuning,
    saveInstrumentProfile: tuning.saveInstrumentProfile,
    setCapo: tuning.setCapo,
    setInstrument: tuning.setInstrument,
    setStringOffset: tuning.setStringOffset,
    setSweeteningProfile: tuning.setSweeteningProfile,
    setTemperament: tuning.setTemperament,
    setTemperamentRoot: tuning.setTemperamentRoot,
    setTranspose: tuning.setTranspose,
    setTuning: tuning.setTuning,
    toggleString: tuning.toggleString,
  });
}
