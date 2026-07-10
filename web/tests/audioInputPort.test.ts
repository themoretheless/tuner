import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useSyntheticAudioInput } from '../src/composables/useSyntheticAudioInput';
import {
  isAudioFrameInputPort,
  isDetectionFrameInputPort,
  type AudioInputPort,
  type AudioInputStartOptions,
  type DetectionFrameInputPort,
} from '../src/ports/audioInput';
import { resolveSyntheticAudioFixture } from '../src/utils/syntheticAudio';

const START_OPTIONS: AudioInputStartOptions = {
  range: { minFrequency: 60, maxFrequency: 120 },
};

describe('AudioInputPort contract', () => {
  it('runs the common lifecycle for raw and detection-frame ports', async () => {
    const synthetic = useSyntheticAudioInput(resolveSyntheticAudioFixture('E2'));
    const native = createDetectionPort();

    await expectPortLifecycle(synthetic);
    await expectPortLifecycle(native);
  });

  it('narrows output capabilities without backend-name checks', () => {
    const synthetic: AudioInputPort = useSyntheticAudioInput(resolveSyntheticAudioFixture('E2'));
    const native: AudioInputPort = createDetectionPort();

    expect(isAudioFrameInputPort(synthetic)).toBe(true);
    expect(isDetectionFrameInputPort(synthetic)).toBe(false);
    expect(isDetectionFrameInputPort(native)).toBe(true);
    expect(isAudioFrameInputPort(native)).toBe(false);
  });

  it('reports an unavailable adapter through the shared contract', async () => {
    const synthetic: AudioInputPort = useSyntheticAudioInput(null);

    expect(synthetic.available.value).toBe(false);
    expect(await synthetic.start(START_OPTIONS)).toBe(false);
    expect(synthetic.isListening.value).toBe(false);
    expect(synthetic.error.value).toBe('No synthetic audio fixture selected');

    synthetic.clearError();
    expect(synthetic.error.value).toBeNull();
  });
});

async function expectPortLifecycle(port: AudioInputPort) {
  expect(port.available.value).toBe(true);
  expect(port.isListening.value).toBe(false);

  expect(await port.start(START_OPTIONS)).toBe(true);
  expect(port.isListening.value).toBe(true);
  if (isAudioFrameInputPort(port)) expect(port.readFrame()).not.toBeNull();
  if (isDetectionFrameInputPort(port)) expect(port.frame.value).not.toBeNull();

  await port.stop();
  expect(port.isListening.value).toBe(false);
}

function createDetectionPort(): DetectionFrameInputPort {
  const error = ref<string | null>(null);
  const frame = ref({
    freq: 82.4069,
    confidence: 0.9,
    rms: 0.1,
    level: 0.5,
    cents: 0,
    note: 'E2',
    target: null,
    inTune: true,
    isPower: false,
  });
  const isListening = ref(false);

  return {
    available: ref(true),
    clearError() {
      error.value = null;
    },
    error,
    frame,
    id: 'native',
    isListening,
    output: 'detection-frame',
    async setDetectionRange() {},
    async start() {
      isListening.value = true;
      return true;
    },
    async stop() {
      isListening.value = false;
    },
  };
}
