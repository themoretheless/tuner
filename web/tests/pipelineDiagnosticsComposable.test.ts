import { nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import { createUnresolvedDetectionFrame } from '../src/domain/detectionFrame';
import { pipelinePresetConfig } from '../src/domain/pipelineConfig';
import { usePipelineDiagnostics } from '../src/features/pipeline/usePipelineDiagnostics';

function frame(frequency: number) {
  return createUnresolvedDetectionFrame({
    confidence: 0.9,
    freq: frequency,
    rawFreq: frequency,
    pipeline: {
      adaptiveGateOpen: true,
      decision: 'published',
      fixedGateOpen: true,
      selected: { confidence: 0.9, frequency },
    },
  });
}

describe('pipeline diagnostics history', () => {
  it('freezes collection and resumes without replacing the inspected frame', async () => {
    const currentFrame = ref(frame(82.4));
    const diagnostics = usePipelineDiagnostics({
      backend: ref('wasm'),
      config: ref(pipelinePresetConfig('stable')),
      frame: currentFrame,
      isListening: ref(true),
      preset: ref('stable'),
      targetFrequency: ref(82.4069),
    });

    currentFrame.value = frame(82.5);
    await nextTick();
    expect(diagnostics.samples.value).toHaveLength(1);

    diagnostics.toggleFreeze();
    const frozenId = diagnostics.selected.value?.id;
    currentFrame.value = frame(90);
    await nextTick();
    expect(diagnostics.samples.value).toHaveLength(1);
    expect(diagnostics.selected.value?.id).toBe(frozenId);

    diagnostics.toggleFreeze();
    currentFrame.value = frame(82.6);
    await nextTick();
    expect(diagnostics.samples.value).toHaveLength(2);
    expect(diagnostics.selected.value?.frame.freq).toBe(82.6);
  });
});
