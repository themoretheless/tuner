import { getCents } from '../generated/noteMath';

export interface FrequencyTarget {
  frequency: number;
}

export interface StickyTargetSelector<T extends FrequencyTarget> {
  reset(): void;
  select(
    frequency: number,
    candidate: T,
    canReusePrevious?: (previous: T) => boolean,
  ): T;
}

export interface InTuneLatch {
  reset(): void;
  update(hasDetection: boolean, cents: number): boolean;
}

export function createStickyTargetSelector<T extends FrequencyTarget>(
  switchMarginCents = 15,
): StickyTargetSelector<T> {
  let previous: T | null = null;

  return {
    reset() {
      previous = null;
    },
    select(frequency, candidate, canReusePrevious = () => true) {
      const reusable = previous && canReusePrevious(previous) ? previous : null;
      const selected = reusable && shouldKeepPreviousTarget(
        frequency,
        reusable,
        candidate,
        switchMarginCents,
      )
        ? reusable
        : candidate;
      previous = selected;
      return selected;
    },
  };
}

export function createInTuneLatch(enterCents: number, exitCents: number): InTuneLatch {
  let stable = false;

  return {
    reset() {
      stable = false;
    },
    update(hasDetection, cents) {
      if (!hasDetection) {
        stable = false;
        return stable;
      }
      const absoluteCents = Math.abs(cents);
      if (absoluteCents < enterCents) stable = true;
      else if (absoluteCents > exitCents) stable = false;
      return stable;
    },
  };
}

export function shouldKeepPreviousTarget<T extends FrequencyTarget>(
  frequency: number,
  previous: T,
  candidate: T,
  switchMarginCents = 15,
) {
  if (!isValidFrequency(frequency) || !isValidFrequency(previous.frequency)) return false;
  if (!isValidFrequency(candidate.frequency)) return true;
  const previousDistance = Math.abs(getCents(frequency, previous.frequency));
  const candidateDistance = Math.abs(getCents(frequency, candidate.frequency));
  return previousDistance - candidateDistance <= Math.max(0, switchMarginCents);
}

function isValidFrequency(value: number) {
  return Number.isFinite(value) && value > 0;
}
