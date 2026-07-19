import { effectScope, ref, watch } from 'vue';
import { decodeUserProfile, encodeUserProfile } from '../settings/profileCodec';
import { createSettingsState } from '../settings/settingsState';
import {
  loadPersistedSettings,
  savePersistedSettings,
  type PersistedSettings,
} from '../utils/settingsStorage';

export interface SettingsStoragePort {
  load(): Promise<Partial<PersistedSettings>>;
  save(settings: PersistedSettings): Promise<void>;
}

const defaultStorage: SettingsStoragePort = {
  load: loadPersistedSettings,
  save: savePersistedSettings,
};

export function createSettingsStore(storage: SettingsStoragePort = defaultStorage) {
  const state = createSettingsState();
  const loaded = ref(false);
  const scope = effectScope(true);
  let disposed = false;
  let isLoading = false;
  let loadPromise: Promise<void> | null = null;
  let saveTail: Promise<void> = Promise.resolve();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      isLoading = true;
      try {
        state.apply(await storage.load());
      } catch {
        state.apply({});
      } finally {
        isLoading = false;
        loaded.value = true;
      }
    })();
    return loadPromise;
  }

  function save() {
    if (disposed || !loaded.value || isLoading) return Promise.resolve();
    const snapshot = state.snapshot();
    const operation = saveTail
      .catch(() => {})
      .then(() => storage.save(snapshot));
    saveTail = operation;
    return operation;
  }

  async function importUserProfile(payload: string) {
    await load();
    const profile = decodeUserProfile(payload);
    if (!profile) return false;
    isLoading = true;
    try {
      state.apply(profile.settings);
    } finally {
      isLoading = false;
    }
    await save();
    return true;
  }

  function scheduleSave() {
    if (disposed || !loaded.value || isLoading) return;
    if (saveTimer != null) globalThis.clearTimeout(saveTimer);
    saveTimer = globalThis.setTimeout(() => {
      saveTimer = null;
      void save().catch(() => {});
    }, 150);
  }

  function dispose() {
    disposed = true;
    if (saveTimer != null) globalThis.clearTimeout(saveTimer);
    saveTimer = null;
    scope.stop();
  }

  scope.run(() => watch(Object.values(state.refs), scheduleSave));
  void load();

  return {
    ...state.refs,
    dispose,
    exportUserProfile: () => encodeUserProfile(state.snapshot()),
    importUserProfile,
    loaded,
    load,
    save,
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

let defaultStore: SettingsStore | null = null;

export function useSettings() {
  defaultStore ??= createSettingsStore();
  return defaultStore;
}
