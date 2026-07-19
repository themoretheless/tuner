import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { createMetronomeScheduler } from '../application/services/metronomeScheduler';
import {
  bpmFromTempoTaps,
  clampBeats,
  clampBpm,
  clampSubdivision,
  recentTempoTaps,
} from '../domain/metronome';
import type { AudioOutputPort } from '../ports/audioOutput';

export interface MetronomeClockPort {
  nowMs(): number;
}

const systemClock: MetronomeClockPort = { nowMs: () => Date.now() };

export function useMetronome(
  bpm: Ref<number>,
  beatsPerBar: Ref<number>,
  subdivision: Ref<number>,
  output: AudioOutputPort,
  clock: MetronomeClockPort = systemClock,
) {
  const isRunning = ref(false);
  const beat = ref(0);
  const subdivisionStep = ref(0);
  const scheduler = createMetronomeScheduler({
    config: () => ({
      beats: beatsPerBar.value,
      bpm: bpm.value,
      subdivision: subdivision.value,
    }),
    onStep(position) {
      beat.value = position.beat;
      subdivisionStep.value = position.step;
    },
    playback: output.createScope(),
  });
  let commandRevision = 0;
  let tapTimes: number[] = [];

  async function start() {
    if (isRunning.value) return true;
    const revision = ++commandRevision;
    isRunning.value = true;
    beat.value = 0;
    subdivisionStep.value = 0;
    const started = await scheduler.start();
    if (revision !== commandRevision) return false;
    if (!started) isRunning.value = false;
    return started;
  }

  function stop() {
    commandRevision += 1;
    isRunning.value = false;
    scheduler.stop();
  }

  async function toggle() {
    if (isRunning.value) {
      stop();
      return false;
    }
    return start();
  }

  function setBpm(nextBpm: number) {
    bpm.value = clampBpm(nextBpm);
  }

  function setBeats(nextBeats: number) {
    beatsPerBar.value = clampBeats(nextBeats);
    beat.value = 0;
  }

  function setSubdivision(nextSubdivision: number) {
    subdivision.value = clampSubdivision(nextSubdivision);
    subdivisionStep.value = 0;
  }

  function tapTempo() {
    tapTimes = recentTempoTaps(tapTimes, clock.nowMs());
    const nextBpm = bpmFromTempoTaps(tapTimes);
    if (nextBpm != null) setBpm(nextBpm);
  }

  async function restartIfRunning() {
    if (!isRunning.value) return;
    const revision = ++commandRevision;
    const restarted = await scheduler.restart();
    if (revision === commandRevision) isRunning.value = restarted;
  }

  function cleanup() {
    commandRevision += 1;
    isRunning.value = false;
    scheduler.dispose();
  }

  watch([bpm, beatsPerBar, subdivision], () => { void restartIfRunning(); });
  onScopeDispose(cleanup);

  return {
    beat,
    isRunning,
    setBeats,
    setBpm,
    setSubdivision,
    start,
    stop,
    subdivisionStep,
    tapTempo,
    toggle,
  };
}
