import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveInitialLang, useL10n } from './l10n';

describe('resolveInitialLang (M43)', () => {
  it('ru первый в navigator.languages → ru', () => {
    expect(resolveInitialLang(null, ['ru-RU', 'en-US'])).toBe('ru');
  });

  it('en первый → en', () => {
    expect(resolveInitialLang(null, ['en-GB', 'ru'])).toBe('en');
  });

  it('неподдерживаемые языки пропускаются до первого поддерживаемого', () => {
    expect(resolveInitialLang(null, ['de-DE', 'fr', 'en-US'])).toBe('en');
  });

  it('только неподдерживаемые → fallback на дефолт (ru)', () => {
    expect(resolveInitialLang(null, ['de-DE', 'ja'])).toBe('ru');
    expect(resolveInitialLang(null, [])).toBe('ru');
  });

  it('сохранённый override имеет приоритет над navigator.languages', () => {
    expect(resolveInitialLang('en', ['ru-RU'])).toBe('en');
    expect(resolveInitialLang('ru', ['en-US'])).toBe('ru');
  });

  it('мусор в сохранённом значении игнорируется', () => {
    expect(resolveInitialLang('de', ['en'])).toBe('en');
    expect(resolveInitialLang('de', [])).toBe('ru');
  });

  it('коды с регионом матчатся по базовому языку, регистр не важен', () => {
    expect(resolveInitialLang(null, ['RU-ru'])).toBe('ru');
    expect(resolveInitialLang(null, ['EN-us'])).toBe('en');
  });
});

describe('l10n store (M43)', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    });
  });

  it('явный выбор через setLang персистится как override', () => {
    const { lang, setLang } = useL10n();
    setLang('en');
    expect(lang.value).toBe('en');
    expect(localStorage.getItem('lang')).toBe('en');
    setLang('ru');
    expect(localStorage.getItem('lang')).toBe('ru');
  });

  it('toggleLang персистит выбор', () => {
    const { lang, toggleLang } = useL10n();
    const before = lang.value;
    toggleLang();
    expect(lang.value).not.toBe(before);
    expect(localStorage.getItem('lang')).toBe(lang.value);
  });

  it('ключ i18n.auto переведён на оба языка', () => {
    const { t, setLang } = useL10n();
    setLang('ru');
    expect(t('i18n.auto')).toBe('Авто (язык браузера)');
    setLang('en');
    expect(t('i18n.auto')).toBe('Auto (browser language)');
  });
});
