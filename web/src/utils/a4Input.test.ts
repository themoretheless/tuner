import { describe, expect, it } from 'vitest';

import { parseA4Input } from './a4Input';

describe('parseA4Input (M63)', () => {
  it('принимает целое число', () => {
    expect(parseA4Input('442')).toBe(442);
    expect(parseA4Input('440')).toBe(440);
  });

  it('принимает точку как десятичный разделитель', () => {
    expect(parseA4Input('442.5')).toBe(442.5);
  });

  it('принимает запятую как десятичный разделитель', () => {
    expect(parseA4Input('442,5')).toBe(442.5);
  });

  it('игнорирует ведущие и концевые пробелы', () => {
    expect(parseA4Input('  442  ')).toBe(442);
    expect(parseA4Input(' 442,5 ')).toBe(442.5);
  });

  it('отклоняет мусор', () => {
    expect(parseA4Input('')).toBeNull();
    expect(parseA4Input('   ')).toBeNull();
    expect(parseA4Input('abc')).toBeNull();
    expect(parseA4Input('44a2')).toBeNull();
    expect(parseA4Input('442.5.1')).toBeNull();
    expect(parseA4Input('442,5,1')).toBeNull();
    expect(parseA4Input('442,5.1')).toBeNull();
    expect(parseA4Input('-442')).toBeNull();
    expect(parseA4Input('NaN')).toBeNull();
    expect(parseA4Input('Infinity')).toBeNull();
  });

  it('граничные значения парсятся как числа (кламп диапазона — не здесь)', () => {
    expect(parseA4Input('420')).toBe(420);
    expect(parseA4Input('460')).toBe(460);
    expect(parseA4Input('0')).toBe(0);
    expect(parseA4Input('999')).toBe(999);
  });
});
