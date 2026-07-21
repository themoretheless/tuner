import { describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from '../src/composables/useSettings';
import { encodeUserProfile } from '../src/settings/profileCodec';
import { createDefaultSettings } from '../src/settings/normalizeSettings';

describe('settings store', () => {
  it('loads and saves through an injected storage port', async () => {
    const save = vi.fn(async () => {});
    const store = createSettingsStore({
      load: async () => ({ a4: 442, themeMode: 'light' }),
      save,
    });

    await store.load();
    expect(store.a4.value).toBe(442);
    expect(store.themeMode.value).toBe('light');

    store.a4.value = 443;
    await store.save();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ a4: 443 }));
    store.dispose();
  });

  it('keeps separate stores isolated', async () => {
    const first = createSettingsStore({ load: async () => ({}), save: async () => {} });
    const second = createSettingsStore({ load: async () => ({}), save: async () => {} });
    await Promise.all([first.load(), second.load()]);

    first.a4.value = 430;
    expect(second.a4.value).toBe(440);

    first.dispose();
    second.dispose();
  });

  it('preserves edits made before a slow hydration completes', async () => {
    let resolveLoad!: (settings: { a4: number; themeMode: 'light' }) => void;
    const pendingLoad = new Promise<{ a4: number; themeMode: 'light' }>((resolve) => {
      resolveLoad = resolve;
    });
    const store = createSettingsStore({ load: () => pendingLoad, save: async () => {} });
    store.a4.value = 443;

    resolveLoad({ a4: 442, themeMode: 'light' });
    await store.load();

    expect(store.a4.value).toBe(443);
    expect(store.themeMode.value).toBe('light');
    store.dispose();
  });

  it('persists edits that happened before hydration completed', async () => {
    vi.useFakeTimers();
    let resolveLoad!: (settings: { a4: number }) => void;
    const pendingLoad = new Promise<{ a4: number }>((resolve) => {
      resolveLoad = resolve;
    });
    const save = vi.fn(async () => {});
    const store = createSettingsStore({ load: () => pendingLoad, save });
    store.a4.value = 443;

    resolveLoad({ a4: 442 });
    await store.load();
    await vi.advanceTimersByTimeAsync(150);

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ a4: 443 }));
    store.dispose();
    vi.useRealTimers();
  });

  it('rolls back an imported profile when durable save fails', async () => {
    const store = createSettingsStore({
      load: async () => ({ a4: 442 }),
      save: async () => { throw new Error('quota exceeded'); },
    });
    await store.load();
    const imported = createDefaultSettings();
    imported.a4 = 430;

    expect(await store.importUserProfile(encodeUserProfile(imported))).toBe(false);
    expect(store.a4.value).toBe(442);
    store.dispose();
  });
});
