import type { Ref } from 'vue';
import type {
  PipelineBlockId,
  PipelineConfig,
  PipelinePresetId,
  ResolvedPipelinePresetId,
} from '../../../domain/pipelineConfig';

export interface PipelineCapability {
  applyPreset(preset: PipelinePresetId): void;
  config: Ref<PipelineConfig>;
  preset: Readonly<Ref<ResolvedPipelinePresetId>>;
  setBlock(block: PipelineBlockId, enabled: boolean): void;
}
