import { describe, expect, it } from 'vitest';
import {
  createSpectrogramColorLut,
  SpectrogramHistory,
  spectrogramRgb,
} from '../src/rendering/spectrogramModel';
import { SpectrogramMetrics } from '../src/rendering/spectrogramMetrics';

describe('SpectrogramHistory', () => {
  it('retains only the configured visible bins and deduplicates sequence numbers', () => {
    const history = new SpectrogramHistory(3, 2);
    const source = Uint8Array.from([1, 2, 3, 99]);

    expect(history.push(1, source)).toBe(0);
    expect(history.push(1, Uint8Array.from([8, 8, 8]))).toBe(-1);
    expect([...history.values]).toEqual([1, 2, 3, 0, 0, 0]);
    expect(history.count).toBe(1);
  });

  it('zeroes missing bins instead of leaking a previous column', () => {
    const history = new SpectrogramHistory(3, 1);
    history.push(1, Uint8Array.from([9, 8, 7]));
    history.push(2, Uint8Array.from([4]));
    expect([...history.values]).toEqual([4, 0, 0]);
  });

  it('describes wrapped storage in chronological order', () => {
    const history = new SpectrogramHistory(1, 3);
    history.push(1, Uint8Array.of(10));
    history.push(2, Uint8Array.of(20));
    expect(history.oldestIndex).toBe(0);

    history.push(3, Uint8Array.of(30));
    history.push(4, Uint8Array.of(40));
    expect([...history.values]).toEqual([40, 20, 30]);
    expect(history.oldestIndex).toBe(1);
  });

  it('accepts the same sequence again after reset', () => {
    const history = new SpectrogramHistory(1, 2);
    history.push(7, Uint8Array.of(1));
    history.reset();
    expect(history.push(7, Uint8Array.of(2))).toBe(0);
    expect(history.count).toBe(1);
  });
});

describe('spectrogram palette', () => {
  it('preserves the original dark-green, green, and hot gradient thresholds', () => {
    expect(spectrogramRgb(0)).toEqual([0, 0, 0]);
    expect(spectrogramRgb(76)).toEqual([0, 61, 0]);
    expect(spectrogramRgb(77)).toEqual([0, 255, 0]);
    expect(spectrogramRgb(178)).toEqual([0, 255, 0]);
    expect(spectrogramRgb(179)).toEqual([255, 253, 0]);
    expect(spectrogramRgb(255)).toEqual([255, 0, 0]);
  });

  it('precomputes opaque RGBA entries for every byte intensity', () => {
    const lut = createSpectrogramColorLut();
    expect(lut).toHaveLength(1024);
    expect([...lut.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...lut.slice(255 * 4, 256 * 4)]).toEqual([255, 0, 0, 255]);
  });
});

describe('SpectrogramMetrics', () => {
  it('keeps production counters cold unless explicitly enabled', () => {
    const metrics = new SpectrogramMetrics(false);
    metrics.columnUpdated();
    metrics.endDraw(0);
    metrics.historyReset();
    expect(metrics.snapshot).toEqual({
      activeDraws: 0,
      clearRuns: 0,
      columnUpdates: 0,
      cpuDispatchBuckets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      cpuDispatchMaxMs: 0,
      cpuDispatchP50Ms: 0,
      cpuDispatchP95Ms: 0,
      cpuDispatchP99Ms: 0,
      cpuDispatchTotalMs: 0,
      drawDispatches: 0,
      duplicateDraws: 0,
      historyResets: 0,
      lifecycle: 'active',
      drawDispatchIntervalBuckets: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      sequenceGaps: 0,
      sessionId: metrics.snapshot.sessionId,
    });
  });

  it('records opt-in update, presentation, and reset counters', () => {
    const metrics = new SpectrogramMetrics(true);
    const startedAt = metrics.beginDraw(true, 1);
    metrics.columnUpdated();
    metrics.endDraw(startedAt);
    metrics.historyReset();
    expect(metrics.snapshot.columnUpdates).toBe(1);
    expect(metrics.snapshot.drawDispatches).toBe(1);
    expect(metrics.snapshot.activeDraws).toBe(1);
    expect(metrics.snapshot.historyResets).toBe(1);
    expect(metrics.snapshot.cpuDispatchTotalMs).toBeGreaterThanOrEqual(0);
    expect(metrics.snapshot.cpuDispatchBuckets.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect(metrics.snapshot.cpuDispatchP50Ms).toBe(0);
    metrics.refreshSummary();
    expect(metrics.snapshot.cpuDispatchP50Ms).toBeGreaterThan(0);
    metrics.dispose();
    expect(metrics.snapshot.lifecycle).toBe('disposed');
  });

  it('uses the last finite duration bound for overflow percentiles', () => {
    const metrics = new SpectrogramMetrics(true);
    metrics.endDraw(performance.now() - 40);

    metrics.refreshSummary();

    expect(metrics.snapshot.cpuDispatchP95Ms).toBe(33);
    expect(metrics.snapshot.cpuDispatchP99Ms).toBe(33);
    expect(Number.isFinite(metrics.snapshot.cpuDispatchP95Ms)).toBe(true);
    expect(Number.isFinite(metrics.snapshot.cpuDispatchP99Ms)).toBe(true);
  });

  it('does not carry sequence gaps or dispatch intervals across an ended run', () => {
    const metrics = new SpectrogramMetrics(true);
    let startedAt = metrics.beginDraw(true, 1);
    metrics.endDraw(startedAt);
    startedAt = metrics.beginDraw(true, 4);
    metrics.endDraw(startedAt);
    expect(metrics.snapshot.sequenceGaps).toBe(2);
    const intervalsBeforeClear = metrics.snapshot.drawDispatchIntervalBuckets
      .reduce((sum, count) => sum + count, 0);

    metrics.clearRun();
    startedAt = metrics.beginDraw(true, 20);
    metrics.endDraw(startedAt);

    expect(metrics.snapshot.sequenceGaps).toBe(2);
    expect(
      metrics.snapshot.drawDispatchIntervalBuckets.reduce((sum, count) => sum + count, 0),
    ).toBe(intervalsBeforeClear);
  });
});
