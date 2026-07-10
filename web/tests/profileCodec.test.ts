import { describe, expect, it } from 'vitest';

import { createDefaultSettings, normalizePersistedSettings } from '../src/settings/normalizeSettings';
import { decodeUserProfile, encodeUserProfile } from '../src/settings/profileCodec';

describe('versioned user profile', () => {
  it('roundtrips the complete settings payload', () => {
    const settings = createDefaultSettings();
    settings.a4 = 442;
    settings.themeMode = 'colorblind';
    settings.practiceHistory = [{ at: 1_700_000_000_000, correct: true, note: 'A4' }];

    const decoded = decodeUserProfile(encodeUserProfile(settings));

    expect(decoded?.schemaVersion).toBe(1);
    expect(normalizePersistedSettings(decoded?.settings ?? {})).toEqual(settings);
  });

  it('rejects malformed and future schemas', () => {
    expect(decodeUserProfile('{bad json')).toBeNull();
    expect(decodeUserProfile({ schemaVersion: 2, settings: {} })).toBeNull();
    expect(decodeUserProfile({ schemaVersion: 1 })).toBeNull();
  });

  it('normalizes unsafe imported values', () => {
    const normalized = normalizePersistedSettings({
      a4: 900,
      metronomeBpm: -2,
      practiceHistory: [{ at: Number.NaN, correct: true, note: 'A4' }],
      showSpectrogram: 'yes' as unknown as boolean,
      themeMode: 'unknown' as 'dark',
    });

    expect(normalized.a4).toBe(460);
    expect(normalized.metronomeBpm).toBe(30);
    expect(normalized.practiceHistory).toEqual([]);
    expect(normalized.showSpectrogram).toBe(false);
    expect(normalized.themeMode).toBe('dark');
  });

  it('removes reserved, dangling, and cross-linked custom profile data', () => {
    const note = { name: 'E' as const, octave: 2, frequency: 82.41 };
    const normalized = normalizePersistedSettings({
      activeInstrument: 'travel',
      lastTuningId: 'missing',
      stringOffsets: Array.from({ length: 300 }, () => 99),
      customTunings: [
        { id: 'standard', name: 'Collision', strings: [note], instrument: 'guitar' },
        { id: 'travel-default', name: 'Travel', strings: [note], instrument: 'travel' },
        { id: 'orphan', name: 'Orphan', strings: [note], instrument: 'missing' },
      ],
      customInstruments: [
        { id: 'guitar', name: 'Collision', defaultTuningId: 'travel-default' },
        { id: 'travel', name: 'Travel', defaultTuningId: 'travel-default' },
        { id: 'dangling', name: 'Dangling', defaultTuningId: 'missing' },
      ],
    });

    expect(normalized.customTunings.map((tuning) => tuning.id)).toEqual(['travel-default']);
    expect(normalized.customInstruments.map((instrument) => instrument.id)).toEqual(['travel']);
    expect(normalized.activeInstrument).toBe('travel');
    expect(normalized.lastTuningId).toBe('travel-default');
    expect(normalized.stringOffsets).toHaveLength(128);
    expect(normalized.stringOffsets.every((offset) => offset === 25)).toBe(true);
  });
});
