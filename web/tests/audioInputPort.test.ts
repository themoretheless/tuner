import { describe, expect, it } from 'vitest';
import { useSyntheticAudioInput } from '../src/composables/useSyntheticAudioInput';
import {
  isDeviceSelectableAudioInputPort,
  type AudioInputPort,
} from '../src/ports/audioInput';
import { resolveSyntheticAudioFixture } from '../src/utils/syntheticAudio';

describe('AudioInputPort contract', () => {
  it('runs the common lifecycle for audio-frame ports', async () => {
    const synthetic = useSyntheticAudioInput(resolveSyntheticAudioFixture('E2'));

    await expectPortLifecycle(synthetic);
  });

  it('keeps device selection as an optional input capability', () => {
    const synthetic: AudioInputPort = useSyntheticAudioInput(resolveSyntheticAudioFixture('E2'));
    expect(isDeviceSelectableAudioInputPort(synthetic)).toBe(false);
  });

  it('reports an unavailable adapter through the shared contract', async () => {
    const synthetic: AudioInputPort = useSyntheticAudioInput(null);

    expect(synthetic.available.value).toBe(false);
    expect(await synthetic.start()).toBe(false);
    expect(synthetic.isListening.value).toBe(false);
    expect(synthetic.error.value).toBe('No synthetic audio fixture selected');

    synthetic.clearError();
    expect(synthetic.error.value).toBeNull();
  });
});

async function expectPortLifecycle(port: AudioInputPort) {
  expect(port.available.value).toBe(true);
  expect(port.isListening.value).toBe(false);

  expect(await port.start()).toBe(true);
  expect(port.isListening.value).toBe(true);
  const frame = port.readFrame();
  expect(frame).not.toBeNull();
  expect(frame?.timebase?.endSample).toBeGreaterThan(frame?.timebase?.startSample ?? -1);

  await port.stop();
  expect(port.isListening.value).toBe(false);
}
