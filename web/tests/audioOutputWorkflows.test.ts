import { effectScope, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMetronome } from '../src/composables/useMetronome';
import { useReferenceTone } from '../src/composables/useReferenceTone';
import type {
  AudioOutputPort,
  AudioPlaybackScope,
  ToneRequest,
} from '../src/ports/audioOutput';

afterEach(() => vi.useRealTimers());

describe('output-audio workflows', () => {
  it('replaces a timed tone instead of leaving the previous oscillator alive', async () => {
    const fake = createFakeAudioOutput();
    const scope = effectScope();
    const tones = scope.run(() => useReferenceTone(
      () => ({ name: 'E', octave: 2, frequency: 82.4069 }),
      fake.output,
    ))!;

    await tones.playTimedTone({ name: 'A', octave: 2, frequency: 110 }, 500);
    await tones.playTimedTone({ name: 'B', octave: 2, frequency: 123.47 }, 750);

    expect(fake.playTone).toHaveBeenCalledTimes(2);
    expect(fake.stopAll).toHaveBeenCalledTimes(2);
    expect(fake.playTone.mock.calls[1][0]).toMatchObject({
      durationSeconds: 0.75,
      frequency: 123.47,
    });
    scope.stop();
    expect(fake.disposeScope).toHaveBeenCalledOnce();
  });

  it('keeps only the newest tone request when audio resume is pending', async () => {
    let releaseResume!: () => void;
    const resumePromise = new Promise<void>((resolve) => { releaseResume = resolve; });
    const fake = createFakeAudioOutput(() => resumePromise);
    const scope = effectScope();
    const tones = scope.run(() => useReferenceTone(
      () => ({ name: 'E', octave: 2, frequency: 82.4069 }),
      fake.output,
    ))!;

    const first = tones.playTimedTone({ name: 'A', octave: 2, frequency: 110 });
    const second = tones.playTimedTone({ name: 'B', octave: 2, frequency: 123.47 });
    releaseResume();
    await Promise.all([first, second]);

    expect(fake.playTone).toHaveBeenCalledOnce();
    expect(fake.playTone.mock.calls[0][0].frequency).toBe(123.47);
    scope.stop();
  });

  it('does not publish a playing state when audio node creation fails', async () => {
    const fake = createFakeAudioOutput();
    fake.playTone.mockImplementation(() => { throw new Error('output unavailable'); });
    const scope = effectScope();
    const tones = scope.run(() => useReferenceTone(
      () => ({ name: 'E', octave: 2, frequency: 82.4069 }),
      fake.output,
    ))!;

    await tones.toggleReferenceTone();

    expect(tones.referencePlaying.value).toBe(false);
    scope.stop();
  });

  it('schedules metronome clicks on the audio clock and cancels the queue', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fake = createFakeAudioOutput(undefined, () => Date.now() / 1000);
    const scope = effectScope();
    const metronome = scope.run(() => useMetronome(
      ref(120),
      ref(4),
      ref(1),
      fake.output,
    ))!;

    expect(await metronome.start()).toBe(true);
    expect(fake.playTone).toHaveBeenCalledTimes(1);
    expect(fake.playTone.mock.calls[0][0].startAt).toBe(0);

    await vi.advanceTimersByTimeAsync(425);
    expect(fake.playTone).toHaveBeenCalledTimes(2);
    expect(fake.playTone.mock.calls[1][0].startAt).toBeCloseTo(0.5, 6);

    metronome.stop();
    const countAfterStop = fake.playTone.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.playTone).toHaveBeenCalledTimes(countAfterStop);
    expect(fake.stopAll).toHaveBeenCalledOnce();
    scope.stop();
  });

  it('derives tap tempo from the injected wall clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const bpm = ref(96);
    const fake = createFakeAudioOutput(undefined, () => Date.now() / 1000);
    const scope = effectScope();
    const metronome = scope.run(() => useMetronome(
      bpm,
      ref(4),
      ref(1),
      fake.output,
    ))!;

    metronome.tapTempo();
    vi.setSystemTime(1500);
    metronome.tapTempo();
    expect(bpm.value).toBe(120);
    scope.stop();
  });

  it('restarts the audio-clock grid when the meter changes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const beats = ref(4);
    const fake = createFakeAudioOutput(undefined, () => Date.now() / 1000);
    const scope = effectScope();
    const metronome = scope.run(() => useMetronome(
      ref(120),
      beats,
      ref(1),
      fake.output,
    ))!;

    await metronome.start();
    beats.value = 3;
    await nextTick();
    await Promise.resolve();

    expect(fake.stopAll).toHaveBeenCalledOnce();
    expect(fake.playTone).toHaveBeenCalledTimes(2);
    expect(fake.playTone.mock.calls[1][0].startAt).toBe(0);
    scope.stop();
  });

  it('lets only the newest delayed metronome restart update running state', async () => {
    const resumes = [deferred(), deferred()];
    let resumeCall = 0;
    const fake = createFakeAudioOutput(() => (
      resumeCall++ === 0 ? Promise.resolve() : resumes[resumeCall - 2].promise
    ));
    const bpm = ref(120);
    const beats = ref(4);
    const scope = effectScope();
    const metronome = scope.run(() => useMetronome(
      bpm,
      beats,
      ref(1),
      fake.output,
    ))!;

    await metronome.start();
    beats.value = 3;
    await nextTick();
    bpm.value = 100;
    await nextTick();

    resumes[0].resolve();
    await Promise.resolve();
    expect(metronome.isRunning.value).toBe(true);

    resumes[1].resolve();
    await Promise.resolve();
    expect(metronome.isRunning.value).toBe(true);
    scope.stop();
  });
});

function createFakeAudioOutput(
  resumeImpl: () => Promise<void> = async () => {},
  currentTime: () => number = () => 0,
) {
  const playTone = vi.fn<(request: ToneRequest) => void>();
  const stopAll = vi.fn<() => void>();
  const disposeScope = vi.fn<() => void>();
  const playback: AudioPlaybackScope = {
    currentTime,
    dispose: disposeScope,
    playTone,
    resume: vi.fn(resumeImpl),
    stopAll,
  };
  const output: AudioOutputPort = {
    createScope: () => playback,
    dispose: async () => {},
  };
  return { disposeScope, output, playTone, stopAll };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
