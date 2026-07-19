import { describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from '../src/composables/useSettings';

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
});
