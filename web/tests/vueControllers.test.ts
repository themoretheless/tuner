import { effectScope, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { usePipelineController } from '../src/adapters/vue/controllers/pipelineController';
import { usePracticeController } from '../src/adapters/vue/controllers/practiceController';
import { createDefaultPipelineConfig } from '../src/domain/pipelineConfig';
import type { AudioOutputPort } from '../src/ports/audioOutput';

describe('Vue application adapters', () => {
  it('owns pipeline mutations behind a narrow config ref', () => {
    const config = ref(createDefaultPipelineConfig());
    const controller = usePipelineController(config);

    controller.setBlock('harmonicEnabled', false);
    expect(config.value.harmonicEnabled).toBe(false);
    controller.applyPreset('raw');
    expect(controller.preset.value).toBe('raw');
  });

  it('keeps practice history inside the practice workflow', () => {
    const scope = effectScope();
    const history = ref<Array<{ at: number; correct: boolean; note: string }>>([]);
    const controller = scope.run(() => usePracticeController({
      beats: ref(4),
      bpm: ref(96),
      formatNote: (note) => `${note.name}${note.octave}`,
      history,
      now: () => 123,
      output: createSilentAudioOutput(),
      pickNote: () => ({ name: 'E', octave: 2, frequency: 82.4069 }),
      playNote: vi.fn(),
      subdivision: ref(1),
    }));

    controller?.nextChallenge();
    controller?.markEarTraining(true);
    expect(history.value).toEqual([{ at: 123, correct: true, note: 'E2' }]);
    expect(controller?.summary.value.totalAttempts).toBe(1);
    scope.stop();
  });
});

function createSilentAudioOutput(): AudioOutputPort {
  return {
    createScope: () => ({
      currentTime: () => 0,
      dispose: () => {},
      playTone: () => {},
      resume: async () => {},
      stopAll: () => {},
    }),
    dispose: async () => {},
  };
}
