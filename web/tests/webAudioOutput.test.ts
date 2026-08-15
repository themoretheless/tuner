import { describe, expect, it, vi } from 'vitest';
import { createWebAudioOutputPort } from '../src/platform/webAudioOutput';

describe('web audio output adapter', () => {
  it('shares one resumed context while keeping playback scopes isolated', async () => {
    const fake = createFakeAudioContext();
    const createContext = vi.fn(() => fake.context);
    const output = createWebAudioOutputPort(createContext);
    const reference = output.createScope();
    const metronome = output.createScope();

    await reference.resume();
    await metronome.resume();
    reference.playTone({ frequency: 110, gain: 0.15 });
    metronome.playTone({ durationSeconds: 0.07, frequency: 980, gain: 0.13 });

    expect(createContext).toHaveBeenCalledOnce();
    expect(fake.resume).toHaveBeenCalledOnce();
    expect(fake.oscillators).toHaveLength(2);

    reference.stopAll();
    expect(fake.oscillators[0].stop).toHaveBeenCalledOnce();
    expect(fake.oscillators[1].stop).toHaveBeenCalledOnce();

    await output.dispose();
    expect(fake.oscillators[1].stop).toHaveBeenCalledTimes(2);
    expect(fake.close).toHaveBeenCalledOnce();
  });

  it('fades a timed tone out even when the caller sets no release', async () => {
    const fake = createFakeAudioContext();
    const output = createWebAudioOutputPort(() => fake.context);
    const scope = output.createScope();
    await scope.resume();
    scope.playTone({ durationSeconds: 0.5, frequency: 440, gain: 0.2 });

    // Ending a tone at full gain clicks; the envelope must ramp down to the
    // scheduled end (currentTime 1 + 0.5 s).
    const envelope = fake.gains.at(-1)!.gain;
    expect(envelope.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 1.5);
    expect(envelope.setValueAtTime).toHaveBeenCalledWith(0.2, 1.48);

    await output.dispose();
  });
});

function createFakeAudioContext() {
  const gains: Array<ReturnType<typeof createGainNode>> = [];
  const oscillators: Array<ReturnType<typeof createOscillator>> = [];
  const resume = vi.fn(async () => { context.state = 'running'; });
  const close = vi.fn(async () => { context.state = 'closed'; });
  const context = {
    close,
    createBiquadFilter: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      frequency: createAudioParam(),
      type: 'lowpass',
    }),
    createGain: () => {
      const gain = createGainNode();
      gains.push(gain);
      return gain;
    },
    createOscillator: () => {
      const oscillator = createOscillator();
      oscillators.push(oscillator);
      return oscillator;
    },
    currentTime: 1,
    destination: {},
    resume,
    state: 'suspended',
  } as unknown as AudioContext & { state: AudioContextState };
  return { close, context, gains, oscillators, resume };
}

function createGainNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: createAudioParam(),
  };
}

function createOscillator() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: createAudioParam(),
    onended: null as (() => void) | null,
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine',
  };
}

function createAudioParam() {
  return {
    cancelScheduledValues: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    value: 0,
  };
}
