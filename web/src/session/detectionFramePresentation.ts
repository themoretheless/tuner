import type { DetectionFrame } from '../types/frames';

export const PRESENTATION_TRANSITION_MS = 24;

export function hasPriorityTransition(previous: DetectionFrame, next: DetectionFrame) {
  return (previous.freq == null) !== (next.freq == null)
    || previous.note !== next.note
    || previous.pipeline.configFingerprint !== next.pipeline.configFingerprint
    || previous.target?.frequency !== next.target?.frequency;
}

export function interpolateDetectionFrame(
  previous: DetectionFrame,
  next: DetectionFrame,
  progress: number,
): DetectionFrame {
  if (hasPriorityTransition(previous, next)) return next;
  const amount = clamp01(progress);
  if (amount >= 1) return next;

  return {
    ...next,
    cents: interpolateLinear(previous.cents, next.cents, amount),
    confidence: interpolateLinear(previous.confidence, next.confidence, amount),
    freq: interpolateFrequency(previous.freq, next.freq, amount),
    level: interpolateLinear(previous.level, next.level, amount),
    rms: interpolateLinear(previous.rms, next.rms, amount),
  };
}

function interpolateFrequency(previous: number | null, next: number | null, progress: number) {
  if (previous == null || next == null || previous <= 0 || next <= 0) return next;
  return 2 ** interpolateLinear(Math.log2(previous), Math.log2(next), progress);
}

function interpolateLinear(previous: number, next: number, progress: number) {
  return previous + (next - previous) * progress;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}
