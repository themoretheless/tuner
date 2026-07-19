export interface MetronomePosition {
  beat: number;
  step: number;
}

export function clampBpm(value: number) {
  return Math.max(30, Math.min(240, Math.round(Number(value) || 96)));
}

export function clampBeats(value: number) {
  return Math.max(1, Math.min(12, Math.round(Number(value) || 4)));
}

export function clampSubdivision(value: number) {
  return Math.max(1, Math.min(8, Math.round(Number(value) || 1)));
}

export function secondsPerMetronomeStep(bpm: number, subdivision: number) {
  return 60 / clampBpm(bpm) / clampSubdivision(subdivision);
}

export function nextMetronomePosition(
  position: MetronomePosition,
  beats: number,
  subdivision: number,
): MetronomePosition {
  const step = position.step + 1;
  if (step < clampSubdivision(subdivision)) return { ...position, step };
  return { beat: (position.beat + 1) % clampBeats(beats), step: 0 };
}

export function recentTempoTaps(taps: number[], now: number, timeoutMs = 2400) {
  return [...taps.filter((time) => now - time < timeoutMs), now];
}

export function bpmFromTempoTaps(taps: number[]) {
  if (taps.length < 2) return null;
  const intervals = taps.slice(1).map((time, index) => time - taps[index]);
  const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  return clampBpm(60000 / average);
}
