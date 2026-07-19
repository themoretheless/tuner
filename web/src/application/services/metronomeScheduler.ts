import {
  nextMetronomePosition,
  secondsPerMetronomeStep,
  type MetronomePosition,
} from '../../domain/metronome';
import type { AudioPlaybackScope } from '../../ports/audioOutput';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;
type TimerId = ReturnType<typeof globalThis.setTimeout>;

export interface MetronomeSchedulerTimer {
  clearTimeout(id: TimerId): void;
  setTimeout(callback: () => void, delayMs: number): TimerId;
}

export interface MetronomeSchedulerDependencies {
  config(): { beats: number; bpm: number; subdivision: number };
  onStep(position: MetronomePosition): void;
  playback: AudioPlaybackScope;
  timer?: MetronomeSchedulerTimer;
}

const systemTimer: MetronomeSchedulerTimer = {
  clearTimeout: (id) => globalThis.clearTimeout(id),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
};

export function createMetronomeScheduler(dependencies: MetronomeSchedulerDependencies) {
  const timer = dependencies.timer ?? systemTimer;
  const displayTimers = new Set<TimerId>();
  let schedulerTimer: TimerId | null = null;
  let nextPosition: MetronomePosition = { beat: 0, step: 0 };
  let nextStepTime = 0;
  let revision = 0;
  let running = false;

  async function start() {
    if (running) return true;
    running = true;
    const startedRevision = ++revision;
    nextPosition = { beat: 0, step: 0 };
    try {
      await dependencies.playback.resume();
    } catch {
      if (startedRevision === revision) running = false;
      return false;
    }
    if (!running || startedRevision !== revision) return false;
    nextStepTime = dependencies.playback.currentTime();
    scheduleAhead();
    return true;
  }

  function stop() {
    revision += 1;
    running = false;
    if (schedulerTimer != null) timer.clearTimeout(schedulerTimer);
    schedulerTimer = null;
    for (const id of displayTimers) timer.clearTimeout(id);
    displayTimers.clear();
    dependencies.playback.stopAll();
  }

  async function restart() {
    if (!running) return false;
    stop();
    return start();
  }

  function scheduleAhead() {
    schedulerTimer = null;
    if (!running) return;
    const now = dependencies.playback.currentTime();
    const config = dependencies.config();
    const stepSeconds = secondsPerMetronomeStep(config.bpm, config.subdivision);
    if (nextStepTime < now - stepSeconds) nextStepTime = now;
    const horizon = now + SCHEDULE_AHEAD_SECONDS;
    let scheduled = 0;
    while (nextStepTime <= horizon && scheduled < 32) {
      scheduleStep(nextStepTime, nextPosition);
      nextPosition = nextMetronomePosition(nextPosition, config.beats, config.subdivision);
      nextStepTime += stepSeconds;
      scheduled += 1;
    }
    schedulerTimer = timer.setTimeout(scheduleAhead, LOOKAHEAD_MS);
  }

  function scheduleStep(at: number, position: MetronomePosition) {
    const accent = position.beat === 0 && position.step === 0;
    dependencies.playback.playTone({
      attackSeconds: 0.005,
      durationSeconds: 0.07,
      frequency: accent ? 1480 : 980,
      gain: accent ? 0.22 : 0.13,
      releaseSeconds: 0.015,
      startAt: at,
      waveform: 'square',
    });
    const delayMs = Math.max(0, (at - dependencies.playback.currentTime()) * 1000);
    const timerId = timer.setTimeout(() => {
      displayTimers.delete(timerId);
      if (running) dependencies.onStep(position);
    }, delayMs);
    displayTimers.add(timerId);
  }

  function dispose() {
    stop();
    dependencies.playback.dispose();
  }

  return { dispose, restart, start, stop };
}
