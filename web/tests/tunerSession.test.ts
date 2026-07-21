import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import { useTunerSession } from '../src/composables/useTunerSession';
import { useTunerInputSet } from '../src/adapters/vue/useTunerInputSet';
import { pipelinePresetConfig } from '../src/domain/pipelineConfig';
import { MIN_USABLE_PITCH_CONFIDENCE } from '../src/utils/pitch';
import { resolveSyntheticAudioFixture } from '../src/utils/syntheticAudio';
import { encodeMonoPcm16Wav } from '../src/audio/wav';
import type { AudioBackend } from '../src/utils/settingsStorage';

describe('useTunerSession', () => {
  let now = 0;
  let nextRafId = 1;
  let timers: Map<number, ReturnType<typeof setTimeout>>;

  beforeEach(() => {
    now = 0;
    nextRafId = 1;
    timers = new Map();
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextRafId;
      nextRafId += 1;
      const timer = setTimeout(() => {
        now += 34;
        callback(now);
      }, 0);
      timers.set(id, timer);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      const timer = timers.get(id);
      if (timer) clearTimeout(timer);
      timers.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('runs detection through the synthetic audio session path', async () => {
    const audioBackend = ref<AudioBackend>('web');
    const selectedInputDeviceId = ref('');
    const session = useTunerSession({
      audioBackend,
      inputs: useTunerInputSet({
        selectedInputDeviceId,
        syntheticFixture: resolveSyntheticAudioFixture('E2'),
      }),
      selectedInputDeviceId,
    });

    await session.start({ minFrequency: 60, maxFrequency: 120 });
    expect(session.status.value).toBe('listening');
    for (let i = 0; i < 4; i += 1) {
      await vi.runOnlyPendingTimersAsync();
      await nextTick();
    }

    expect(session.usingSyntheticAudio.value).toBe(true);
    expect(session.isListening.value).toBe(true);
    expect(session.volume.value).toBeGreaterThan(0);
    expect(session.detectionFrame.value.level).toBeGreaterThan(0);
    expect(session.detectionFrame.value.confidence).toBeGreaterThanOrEqual(MIN_USABLE_PITCH_CONFIDENCE);
    expect(session.detectionFrame.value.confidence).toBeLessThanOrEqual(1);
    expect(session.detectedFrequency.value).not.toBeNull();
    expect(session.detectionFrame.value.freq).toBe(session.detectedFrequency.value);
    expect(Math.abs(session.detectedFrequency.value! - 82.4069)).toBeLessThan(1.5);

    await session.stop();
    expect(session.status.value).toBe('idle');
    expect(session.isListening.value).toBe(false);
    expect(session.detectedFrequency.value).toBeNull();
    expect(session.detectionFrame.value.freq).toBeNull();
    expect(session.detectionFrame.value.level).toBe(0);
  });

  it('lets the raw pipeline analyze frames below the fixed signal gate', async () => {
    const selectedInputDeviceId = ref('');
    const syntheticFixture = {
      id: 'quiet-e2',
      label: 'Quiet E2',
      frequency: 82.4069,
      sampleRate: 44_100,
      gain: 0.006,
    };
    const session = useTunerSession({
      audioBackend: ref<AudioBackend>('web'),
      inputs: useTunerInputSet({ selectedInputDeviceId, syntheticFixture }),
      pipelineConfig: ref(pipelinePresetConfig('raw')),
      selectedInputDeviceId,
    });

    await session.start({ minFrequency: 60, maxFrequency: 120 });
    for (let i = 0; i < 4; i += 1) {
      await vi.runOnlyPendingTimersAsync();
      await nextTick();
    }

    expect(session.detectionFrame.value.rms).toBeGreaterThan(0.002);
    expect(session.detectionFrame.value.freq).not.toBeNull();
    expect(Math.abs(session.detectionFrame.value.freq! - 82.4069)).toBeLessThan(1.5);

    await session.stop();
  });

  it('runs an imported WAV through the same realtime session pipeline', async () => {
    const selectedInputDeviceId = ref('');
    const session = useTunerSession({
      audioBackend: ref<AudioBackend>('web'),
      inputs: useTunerInputSet({ selectedInputDeviceId, syntheticFixture: null }),
      selectedInputDeviceId,
    });
    const sampleRate = 44_100;
    const samples = Float32Array.from({ length: sampleRate }, (_, index) => (
      Math.sin(2 * Math.PI * 82.4069 * index / sampleRate) * 0.4
    ));
    const wav = encodeMonoPcm16Wav(samples, sampleRate);
    let resolveStaleFile!: (buffer: ArrayBuffer) => void;
    const staleBuffer = new Promise<ArrayBuffer>((resolve) => {
      resolveStaleFile = resolve;
    });
    const staleLoad = session.loadAudioFile({
      name: 'stale.wav',
      arrayBuffer: async () => staleBuffer,
    } as File);
    const file = {
      name: 'e2.wav',
      arrayBuffer: async () => wav,
    } as File;

    expect(await session.loadAudioFile(file)).toBe(true);
    resolveStaleFile(wav);
    expect(await staleLoad).toBe(false);
    expect(session.usingFileAudio.value).toBe(true);
    expect(session.fileAudioName.value).toBe('e2.wav');
    for (let index = 0; index < 4; index += 1) {
      await vi.runOnlyPendingTimersAsync();
      await nextTick();
    }

    expect(session.detectionFrameTimebase.value?.source).toBe('file');
    expect(session.detectedFrequency.value).not.toBeNull();
    expect(Math.abs(session.detectedFrequency.value! - 82.4069)).toBeLessThan(1.5);

    await session.stop();
    await session.useMicrophoneInput();
    expect(session.usingFileAudio.value).toBe(false);
  });

  it('restarts a pending web session when the input device changes', async () => {
    let resolveFirstStream!: (stream: MediaStream) => void;
    const firstStream = new Promise<MediaStream>((resolve) => {
      resolveFirstStream = resolve;
    });
    const getUserMedia = vi.fn()
      .mockReturnValueOnce(firstStream)
      .mockResolvedValueOnce(createMediaStream());
    installWebAudioFakes(getUserMedia);

    const selectedInputDeviceId = ref('old-device');
    const session = useTunerSession({
      audioBackend: ref<AudioBackend>('web'),
      inputs: useTunerInputSet({ selectedInputDeviceId, syntheticFixture: null }),
      selectedInputDeviceId,
    });

    const initialStart = session.start();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(session.status.value).toBe('starting');

    const switching = session.setInputDevice('new-device');
    resolveFirstStream(createMediaStream());
    await Promise.all([initialStart, switching]);

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[0][0].audio.deviceId).toEqual({ exact: 'old-device' });
    expect(getUserMedia.mock.calls[1][0].audio.deviceId).toEqual({ exact: 'new-device' });
    expect(session.selectedInputDeviceId.value).toBe('new-device');
    expect(session.status.value).toBe('listening');
    await session.stop();
  });

  it('keeps the effective backend stable when native availability arrives late', async () => {
    installWebAudioFakes(vi.fn().mockResolvedValue(createMediaStream()));
    const selectedInputDeviceId = ref('');
    const audioBackend = ref<AudioBackend>('native');
    const inputs = useTunerInputSet({ selectedInputDeviceId, syntheticFixture: null });
    await inputs.native.refreshAvailability();
    inputs.native.available.value = false;
    const session = useTunerSession({
      audioBackend,
      inputs,
      selectedInputDeviceId,
    });

    await session.start();
    expect(session.activeInputId.value).toBe('web');
    inputs.native.available.value = true;

    expect(session.requestedInputId.value).toBe('native');
    expect(session.activeInputId.value).toBe('web');
    expect(session.usingNativeAudio.value).toBe(false);
    await session.stop();
  });
});

function installWebAudioFakes(getUserMedia: ReturnType<typeof vi.fn>) {
  const mediaDevices = {
    addEventListener: vi.fn(),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getUserMedia,
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('navigator', { mediaDevices });
  vi.stubGlobal('window', {
    AudioContext: FakeAudioContext,
    setTimeout,
  });
}

function createMediaStream() {
  const track = {
    addEventListener: vi.fn(),
    stop: vi.fn(),
  };
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

class FakeAudioContext {
  onstatechange: (() => void) | null = null;
  readonly sampleRate = 44_100;
  readonly state = 'running';

  close() {
    return Promise.resolve();
  }

  createAnalyser() {
    return {
      disconnect: vi.fn(),
      fftSize: 2048,
      getFloatTimeDomainData: vi.fn(),
      smoothingTimeConstant: 0,
    };
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}
