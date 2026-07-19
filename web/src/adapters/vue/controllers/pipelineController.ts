import { computed, type Ref } from 'vue';
import {
  pipelinePresetConfig,
  resolvePipelinePreset,
  updatePipelineBlock,
  type PipelineBlockId,
  type PipelineConfig,
  type PipelinePresetId,
} from '../../../domain/pipelineConfig';

export function usePipelineController(config: Ref<PipelineConfig>) {
  return {
    applyPreset(preset: PipelinePresetId) {
      config.value = pipelinePresetConfig(preset);
    },
    config,
    preset: computed(() => resolvePipelinePreset(config.value)),
    setBlock(block: PipelineBlockId, enabled: boolean) {
      config.value = updatePipelineBlock(config.value, block, enabled);
    },
  };
}
