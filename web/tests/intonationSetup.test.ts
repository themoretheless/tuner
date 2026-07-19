import { describe, expect, it } from 'vitest';
import { evaluateIntonationSetup } from '../src/domain/intonationSetup';

describe('intonation setup', () => {
  it('directs a sharp fretted octave toward a longer speaking length', () => {
    const result = evaluateIntonationSetup({
      open: 82.4069,
      harmonic12: 164.8138,
      fretted12: 166.0,
    });

    expect(result?.cents).toBeGreaterThan(10);
    expect(result?.adjustment).toBe('lengthen');
    expect(result?.referenceReliable).toBe(true);
  });

  it('directs a flat fretted octave toward a shorter speaking length', () => {
    const result = evaluateIntonationSetup({
      open: 110,
      harmonic12: 220,
      fretted12: 219,
    });

    expect(result?.adjustment).toBe('shorten');
  });

  it('flags an inconsistent open and harmonic reference', () => {
    const result = evaluateIntonationSetup({
      open: 82.4,
      harmonic12: 168,
      fretted12: 168,
    });

    expect(result?.adjustment).toBe('none');
    expect(result?.referenceReliable).toBe(false);
  });

  it('accepts detector output folded to the selected string octave', () => {
    const result = evaluateIntonationSetup({
      open: 82.4069,
      harmonic12: 82.4069,
      fretted12: 83,
    });

    expect(result?.cents).toBeGreaterThan(10);
    expect(result?.cents).toBeLessThan(20);
    expect(result?.adjustment).toBe('lengthen');
    expect(result?.referenceReliable).toBe(true);
  });
});
