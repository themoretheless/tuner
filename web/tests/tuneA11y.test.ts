import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  TuneAnnouncer,
  centsBucketOf,
  classifyTuneState,
  directionOf,
  snapshotOf,
} from '../src/utils/tuneA11y';

function readSrc(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
}

function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance(ms: number) { time += ms; },
  };
}

describe('classifyTuneState', () => {
  it('returns silent without detection', () => {
    expect(classifyTuneState(0, false, false)).toBe('silent');
    expect(classifyTuneState(3, true, false)).toBe('silent');
  });

  it('returns in-tune only when the detector says so', () => {
    expect(classifyTuneState(2, true, true)).toBe('in-tune');
  });

  it('returns near inside the display-only band and out beyond it', () => {
    expect(classifyTuneState(10, false, true)).toBe('near');
    expect(classifyTuneState(-15, false, true)).toBe('near');
    expect(classifyTuneState(16, false, true)).toBe('out');
    expect(classifyTuneState(-40, false, true)).toBe('out');
  });

  it('maps direction only for audible deviations', () => {
    expect(directionOf(12, 'near')).toBe('sharp');
    expect(directionOf(-12, 'out')).toBe('flat');
    expect(directionOf(0, 'in-tune')).toBeNull();
    expect(directionOf(0, 'silent')).toBeNull();
  });

  it('buckets cents so sub-5-cent jitter stays silent', () => {
    expect(centsBucketOf(11)).toBe(centsBucketOf(12));
    expect(centsBucketOf(11)).not.toBe(centsBucketOf(15));
  });
});

describe('TuneAnnouncer throttling', () => {
  const detected = (note: string, cents: number, isInTune = false) =>
    snapshotOf({ note, cents, isInTune, isDetected: true });

  it('announces the first snapshot immediately', () => {
    const clock = makeClock();
    const a = new TuneAnnouncer({ intervalMs: 1000, now: clock.now });
    expect(a.push(detected('E2', 20))).not.toBeNull();
  });

  it('never re-announces an identical snapshot', () => {
    const clock = makeClock();
    const a = new TuneAnnouncer({ intervalMs: 1000, now: clock.now });
    a.push(detected('E2', 20));
    clock.advance(5000);
    expect(a.push(detected('E2', 20))).toBeNull();
  });

  it('suppresses ordinary changes within the interval', () => {
    const clock = makeClock();
    const a = new TuneAnnouncer({ intervalMs: 1000, now: clock.now });
    expect(a.push(detected('E2', 20))).not.toBeNull();
    clock.advance(400);
    expect(a.push(detected('E2', 30))).toBeNull();
    clock.advance(400);
    expect(a.push(detected('E2', 35))).toBeNull();
  });

  it('announces ordinary changes after the interval passes', () => {
    const clock = makeClock();
    const a = new TuneAnnouncer({ intervalMs: 1000, now: clock.now });
    a.push(detected('E2', 20));
    clock.advance(1100);
    expect(a.push(detected('E2', 30))).not.toBeNull();
  });

  it('always announces transition into in-tune immediately', () => {
    const clock = makeClock();
    const a = new TuneAnnouncer({ intervalMs: 1000, now: clock.now });
    a.push(detected('E2', 20));
    clock.advance(100); // well inside the throttle window
    const accepted = a.push(detected('E2', 1, true));
    expect(accepted).not.toBeNull();
    expect(accepted?.state).toBe('in-tune');
  });

  it('always announces a note change immediately', () => {
    const clock = makeClock();
    const a = new TuneAnnouncer({ intervalMs: 1000, now: clock.now });
    a.push(detected('E2', 20));
    clock.advance(100);
    const accepted = a.push(detected('A2', 25));
    expect(accepted).not.toBeNull();
    expect(accepted?.note).toBe('A2');
  });

  it('clears the announcement when the signal is lost (after interval)', () => {
    const clock = makeClock();
    const a = new TuneAnnouncer({ intervalMs: 1000, now: clock.now });
    a.push(detected('E2', 20));
    clock.advance(1200);
    const silent = a.push(snapshotOf({ note: null, cents: 0, isInTune: false, isDetected: false }));
    expect(silent).not.toBeNull();
    expect(silent?.state).toBe('silent');
  });
});

describe('non-color indicators in tuner components', () => {
  it('CentsGauge exposes tune state as data attribute and icon, not color only', () => {
    const src = readSrc('src/components/CentsGauge.vue');
    expect(src).toContain('data-tune-state');
    expect(src).toContain('tune-status-icon');
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain('classifyTuneState');
    // near state must be distinguishable from plain out-of-tune
    expect(src).toContain("tuneState === 'near'");
  });

  it('LiveTunerView owns the single throttled polite live region', () => {
    const src = readSrc('src/features/tuner/LiveTunerView.vue');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('TuneAnnouncer');
    expect(src).toContain('tune-announcer');
  });

  it('NoteDisplay does not mount a second live region (no double speech)', () => {
    const src = readSrc('src/components/NoteDisplay.vue');
    expect(src).not.toContain('aria-live');
  });

  it('style.css carries forced-colors and prefers-contrast branches', () => {
    const css = readSrc('src/style.css');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media (prefers-contrast: more)');
    expect(css).toContain('forced-color-adjust');
    // system colors, no decorative shadows in forced-colors mode
    expect(css).toContain('ButtonFace');
    expect(css).toContain('CanvasText');
    // non-color state markers
    expect(css).toContain("[data-tune-state='in-tune']");
    expect(css).toContain("[data-tune-state='near']");
    expect(css).toContain("[data-tune-state='out']");
  });

  it('l10n provides a11y announcement keys in both languages', () => {
    const src = readSrc('src/stores/l10n.ts');
    for (const key of [
      'a11y.announce.inTune',
      'a11y.announce.nearFlat',
      'a11y.announce.nearSharp',
      'a11y.announce.flat',
      'a11y.announce.sharp',
      'a11y.near.flat',
      'a11y.near.sharp',
    ]) {
      // each key appears twice: once for ru, once for en
      const occurrences = src.split(`'${key}'`).length - 1;
      expect(occurrences, key).toBe(2);
    }
  });
});
