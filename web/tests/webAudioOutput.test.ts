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
});

function createFakeAudioContext() {
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
    createGain: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: createAudioParam(),
    }),
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
  return { close, context, oscillators, resume };
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
