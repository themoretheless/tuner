/**
 * Accessibility logic for the tuner readout.
 *
 * Pure, framework-free helpers so the throttling and state classification
 * can be unit-tested without mounting Vue components.
 */

export type TuneState = 'silent' | 'in-tune' | 'near' | 'out';
export type TuneDirection = 'flat' | 'sharp' | null;

/**
 * Display-only "almost in tune" band width in cents. Does NOT affect the
 * detection pipeline or the in-tune tolerance — it only drives the
 * non-color "near" indicator and the screen-reader announcements.
 */
export const NEAR_TUNE_CENTS = 15;

export interface TuneSnapshot {
  note: string | null;
  state: TuneState;
  direction: TuneDirection;
  /** Cents deviation rounded to a coarse bucket so tiny jitter stays silent. */
  centsBucket: number;
}

export function classifyTuneState(cents: number, isInTune: boolean, isDetected: boolean): TuneState {
  if (!isDetected) return 'silent';
  if (isInTune) return 'in-tune';
  return Math.abs(cents) <= NEAR_TUNE_CENTS ? 'near' : 'out';
}

export function directionOf(cents: number, state: TuneState): TuneDirection {
  if (state === 'silent' || state === 'in-tune') return null;
  return cents > 0 ? 'sharp' : 'flat';
}

/** Bucket cents in 5-cent steps so sub-threshold drift never re-announces. */
export function centsBucketOf(cents: number): number {
  return Math.round(cents / 5);
}

export function snapshotOf(input: {
  note: string | null;
  cents: number;
  isInTune: boolean;
  isDetected: boolean;
}): TuneSnapshot {
  const state = classifyTuneState(input.cents, input.isInTune, input.isDetected);
  return {
    note: input.isDetected ? input.note : null,
    state,
    direction: directionOf(input.cents, state),
    centsBucket: centsBucketOf(input.cents),
  };
}

export function snapshotKey(s: TuneSnapshot): string {
  return `${s.note ?? ''}|${s.state}|${s.direction ?? ''}|${s.centsBucket}`;
}

export interface TuneAnnouncerOptions {
  /** Minimum milliseconds between announcements. Default 1000 (≈1/s). */
  intervalMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

/**
 * Decides WHEN a new snapshot deserves a polite aria-live announcement.
 *
 * Rules:
 *  - identical snapshot key → never re-announces (visual jitter stays silent);
 *  - transition INTO 'in-tune' or a note change → announce immediately
 *    (state feedback the user is actively waiting for);
 *  - any other change → announce only if at least `intervalMs` passed since
 *    the last announcement.
 *
 * `push` returns the snapshot to announce, or null when it must stay silent.
 * The caller is responsible for formatting the spoken text (l10n).
 */
export class TuneAnnouncer {
  private readonly intervalMs: number;
  private readonly now: () => number;
  private lastKey: string | null = null;
  private lastNote: string | null = null;
  private lastEmitAt = Number.NEGATIVE_INFINITY;

  constructor(options: TuneAnnouncerOptions = {}) {
    this.intervalMs = options.intervalMs ?? 1000;
    this.now = options.now ?? (() => Date.now());
  }

  push(snapshot: TuneSnapshot): TuneSnapshot | null {
    const key = snapshotKey(snapshot);
    if (key === this.lastKey) return null;

    const time = this.now();
    const noteChanged = snapshot.note !== null && snapshot.note !== this.lastNote;
    const isImportant = snapshot.state === 'in-tune' || noteChanged;

    if (!isImportant && time - this.lastEmitAt < this.intervalMs) {
      // Suppressed by throttle: remember the key so we don't re-evaluate
      // the same change every frame, but do not announce it.
      this.lastKey = key;
      this.lastNote = snapshot.note;
      return null;
    }

    this.lastKey = key;
    this.lastNote = snapshot.note;
    this.lastEmitAt = time;
    return snapshot;
  }

  reset() {
    this.lastKey = null;
    this.lastNote = null;
    this.lastEmitAt = Number.NEGATIVE_INFINITY;
  }
}
