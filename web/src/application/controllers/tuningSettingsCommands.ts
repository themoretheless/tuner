import {
  NOTE_NAMES,
  SWEETENING_PROFILES,
  type NoteName,
  type SweeteningProfileId,
  type TemperamentId,
} from '../../utils/notes';
import type { TuningCommandDependencies } from './tuningCommandPorts';

export function createTuningSettingsCommands({
  model,
  resetDetection,
  settings,
}: TuningCommandDependencies) {
  function setA4(value: number) {
    if (!Number.isFinite(value)) return;
    settings.a4.value = Math.max(420, Math.min(460, Math.round(value)));
    resetDetection();
  }

  function setCapo(value: number) {
    if (!Number.isFinite(value)) return;
    settings.capo.value = Math.max(0, Math.min(12, Math.round(value)));
    resetDetection();
  }

  function setTemperament(value: TemperamentId) {
    if (!model.temperamentOptions.value.some((item) => item.id === value)) return;
    settings.temperament.value = value;
    resetDetection();
  }

  function setTemperamentRoot(value: NoteName) {
    if (!NOTE_NAMES.includes(value)) return;
    settings.temperamentRoot.value = value;
    resetDetection();
  }

  function setTranspose(value: number) {
    if (!Number.isFinite(value)) return;
    settings.transpose.value = Math.max(-12, Math.min(12, Math.round(value)));
    resetDetection();
  }

  function setStringOffset(index: number, cents: number) {
    if (!Number.isInteger(index) || index < 0) return;
    const offsets = [...settings.stringOffsets.value];
    offsets[index] = Math.max(-25, Math.min(25, Math.round(Number(cents) || 0)));
    settings.stringOffsets.value = offsets;
    settings.sweeteningProfile.value = 'custom';
    resetDetection();
  }

  function setSweeteningProfile(profile: SweeteningProfileId) {
    if (!SWEETENING_PROFILES.some((item) => item.id === profile)) return;
    settings.sweeteningProfile.value = profile;
    resetDetection();
  }

  return {
    setA4,
    setCapo,
    setStringOffset,
    setSweeteningProfile,
    setTemperament,
    setTemperamentRoot,
    setTranspose,
  };
}
