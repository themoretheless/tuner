import { reactive, toRefs } from 'vue';
import { createDefaultSettings, normalizePersistedSettings } from './normalizeSettings';
import type { PersistedSettings } from '../utils/settingsStorage';

export function createSettingsState() {
  const value = reactive<PersistedSettings>(createDefaultSettings());

  return {
    apply(input: Partial<PersistedSettings>) {
      Object.assign(value, normalizePersistedSettings(input));
    },
    refs: toRefs(value),
    snapshot() {
      return normalizePersistedSettings(value);
    },
    value,
  };
}
