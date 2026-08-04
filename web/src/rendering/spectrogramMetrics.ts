const DURATION_BOUNDS_MS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 33, Number.POSITIVE_INFINITY];
const INTERVAL_BOUNDS_MS = [8, 12, 17, 25, 34, 50, 100, 250, Number.POSITIVE_INFINITY];
let nextMetricsSessionId = 1;

export interface SpectrogramMetricsSnapshot {
  activeDraws: number;
  clearRuns: number;
  columnUpdates: number;
  cpuDispatchBuckets: number[];
  cpuDispatchMaxMs: number;
  cpuDispatchP50Ms: number;
  cpuDispatchP95Ms: number;
  cpuDispatchP99Ms: number;
  cpuDispatchTotalMs: number;
  drawDispatches: number;
  duplicateDraws: number;
  historyResets: number;
  lifecycle: 'active' | 'disposed';
  drawDispatchIntervalBuckets: number[];
  sequenceGaps: number;
  sessionId: number;
}

declare global {
  interface Window {
    __TUNER_SPECTROGRAM_METRICS__?: SpectrogramMetricsSnapshot;
  }
}

/** Opt-in CPU dispatch telemetry; it does not measure browser/GPU presentation. */
export class SpectrogramMetrics {
  readonly enabled: boolean;
  readonly snapshot: SpectrogramMetricsSnapshot;
  private lastDispatchAt: number | null = null;
  private lastSequence: number | null = null;

  constructor(enabled = spectrogramMetricsEnabled()) {
    this.enabled = enabled;
    this.snapshot = {
      activeDraws: 0,
      clearRuns: 0,
      columnUpdates: 0,
      cpuDispatchBuckets: Array(DURATION_BOUNDS_MS.length).fill(0) as number[],
      cpuDispatchMaxMs: 0,
      cpuDispatchP50Ms: 0,
      cpuDispatchP95Ms: 0,
      cpuDispatchP99Ms: 0,
      cpuDispatchTotalMs: 0,
      drawDispatches: 0,
      duplicateDraws: 0,
      historyResets: 0,
      lifecycle: 'active',
      drawDispatchIntervalBuckets: Array(INTERVAL_BOUNDS_MS.length).fill(0) as number[],
      sequenceGaps: 0,
      sessionId: nextMetricsSessionId,
    };
    nextMetricsSessionId += 1;
    if (enabled && typeof window !== 'undefined') {
      window.__TUNER_SPECTROGRAM_METRICS__ = this.snapshot;
    }
  }

  beginDraw(active: boolean, sequence: number | null) {
    if (!this.enabled) return 0;
    const now = performance.now();
    this.snapshot.drawDispatches += 1;
    if (active) this.snapshot.activeDraws += 1;
    if (this.lastDispatchAt != null) {
      incrementBucket(
        this.snapshot.drawDispatchIntervalBuckets,
        INTERVAL_BOUNDS_MS,
        now - this.lastDispatchAt,
      );
    }
    this.lastDispatchAt = now;
    if (sequence != null) {
      if (sequence === this.lastSequence) this.snapshot.duplicateDraws += 1;
      else if (this.lastSequence != null && sequence > this.lastSequence + 1) {
        this.snapshot.sequenceGaps += sequence - this.lastSequence - 1;
      }
      this.lastSequence = sequence;
    }
    return now;
  }

  endDraw(startedAt: number) {
    if (!this.enabled) return;
    const duration = performance.now() - startedAt;
    this.snapshot.cpuDispatchTotalMs += duration;
    this.snapshot.cpuDispatchMaxMs = Math.max(this.snapshot.cpuDispatchMaxMs, duration);
    incrementBucket(this.snapshot.cpuDispatchBuckets, DURATION_BOUNDS_MS, duration);
  }

  /** Computes percentile bounds explicitly, outside the per-draw hot path. */
  refreshSummary() {
    if (!this.enabled) return;
    this.snapshot.cpuDispatchP50Ms = percentileBound(this.snapshot.cpuDispatchBuckets, DURATION_BOUNDS_MS, 0.5);
    this.snapshot.cpuDispatchP95Ms = percentileBound(this.snapshot.cpuDispatchBuckets, DURATION_BOUNDS_MS, 0.95);
    this.snapshot.cpuDispatchP99Ms = percentileBound(this.snapshot.cpuDispatchBuckets, DURATION_BOUNDS_MS, 0.99);
  }

  columnUpdated() { if (this.enabled) this.snapshot.columnUpdates += 1; }
  clearRun() {
    if (this.enabled) this.snapshot.clearRuns += 1;
    this.endRun();
  }
  historyReset() { if (this.enabled) this.snapshot.historyResets += 1; }

  /** Ends one active run so pauses cannot become sequence gaps or dispatch intervals. */
  endRun() {
    this.lastDispatchAt = null;
    this.lastSequence = null;
  }

  dispose() {
    this.refreshSummary();
    this.snapshot.lifecycle = 'disposed';
    this.endRun();
  }
}

function incrementBucket(buckets: number[], bounds: number[], value: number) {
  for (let index = 0; index < bounds.length; index += 1) {
    if (value <= bounds[index]) {
      buckets[index] += 1;
      return;
    }
  }
}

function percentileBound(buckets: number[], bounds: number[], percentile: number) {
  const total = buckets.reduce((sum, count) => sum + count, 0);
  const target = Math.max(1, Math.ceil(total * percentile));
  let seen = 0;
  for (let index = 0; index < buckets.length; index += 1) {
    seen += buckets[index];
    if (seen >= target) {
      const bound = bounds[index];
      return Number.isFinite(bound) ? bound : (index > 0 ? bounds[index - 1] : 0);
    }
  }
  return 0;
}

function spectrogramMetricsEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('spectrogramMetrics') === '1';
  } catch {
    return false;
  }
}
