import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SETTINGS_SCHEMA_VERSION,
  isTauriRuntime,
  migratePersistedSettings,
} from './settingsStorage';

describe('settings storage schema', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('migrates legacy booleans and the input device key', () => {
    expect(migratePersistedSettings({
      chromatic: 'false',
      inputDeviceId: 'mic-2',
      showWaveform: 'true',
    }, 1)).toMatchObject({
      chromatic: false,
      selectedInputDeviceId: 'mic-2',
      showWaveform: true,
    });
  });

  it('rejects non-boolean values in the current schema', () => {
    const migrated = migratePersistedSettings({
      chromatic: 'true',
      leftHanded: 1,
      showSpectrum: true,
    }, SETTINGS_SCHEMA_VERSION);
    expect(migrated.chromatic).toBeUndefined();
    expect(migrated.leftHanded).toBeUndefined();
    expect(migrated.showSpectrum).toBe(true);
  });

  it('recognizes the Tauri v2 runtime marker', () => {
    vi.stubGlobal('__TAURI_INTERNALS__', {});
    expect(isTauriRuntime()).toBe(true);
  });
});
