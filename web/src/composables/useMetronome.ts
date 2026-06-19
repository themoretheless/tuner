import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { createAudioContext } from '../utils/audio';

const TAP_TIMEOUT_MS = 2400;

export function useMetronome(
  bpm: Ref<number>,
  beatsPerBar: Ref<number>,
  subdivision: Ref<number>,
) {
  const isRunning = ref(false);
  const beat = ref(0);
  const subdivisionStep = ref(0);

  let audioContext: AudioContext | null = null;
  let timerId: number | null = null;
  let tapTimes: number[] = [];

  const intervalMs = computed(() => 60000 / clampBpm(bpm.value) / clampSubdivision(subdivision.value));

  function getAudioContext() {
    if (!audioContext) {
      audioContext = createAudioContext();
    }
    return audioContext;
  }

  function click(accent = false) {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.frequency.value = accent ? 1480 : 980;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.13, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  function advance() {
    const accent = beat.value === 0 && subdivisionStep.value === 0;
    click(accent);

    subdivisionStep.value += 1;
    if (subdivisionStep.value >= clampSubdivision(subdivision.value)) {
      subdivisionStep.value = 0;
      beat.value = (beat.value + 1) % clampBeats(beatsPerBar.value);
    }
  }

  function start() {
    if (isRunning.value) return;
    isRunning.value = true;
    beat.value = 0;
    subdivisionStep.value = 0;
    advance();
    timerId = window.setInterval(advance, intervalMs.value);
  }

  function stop() {
    isRunning.value = false;
    if (timerId != null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function toggle() {
    if (isRunning.value) stop();
    else start();
  }

  function setBpm(nextBpm: number) {
    bpm.value = clampBpm(nextBpm);
    restartIfRunning();
  }

  function setBeats(nextBeats: number) {
    beatsPerBar.value = clampBeats(nextBeats);
    beat.value = 0;
  }

  function setSubdivision(nextSubdivision: number) {
    subdivision.value = clampSubdivision(nextSubdivision);
    subdivisionStep.value = 0;
    restartIfRunning();
  }

  function tapTempo() {
    const now = Date.now();
    tapTimes = tapTimes.filter((time) => now - time < TAP_TIMEOUT_MS);
    tapTimes.push(now);
    if (tapTimes.length < 2) return;

    const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    setBpm(Math.round(60000 / average));
  }

  function restartIfRunning() {
    if (!isRunning.value) return;
    stop();
    start();
  }

  function cleanup() {
    stop();
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
  }

  watch(intervalMs, () => {
    restartIfRunning();
  });

  onUnmounted(cleanup);

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

function clampBpm(value: number) {
  return Math.max(30, Math.min(240, Math.round(Number(value) || 96)));
}

function clampBeats(value: number) {
  return Math.max(1, Math.min(12, Math.round(Number(value) || 4)));
}

function clampSubdivision(value: number) {
  return Math.max(1, Math.min(8, Math.round(Number(value) || 1)));
}
