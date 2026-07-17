<script setup lang="ts">
import { computed, toRef } from 'vue';
import type {
  PipelineRuntimeBackend,
} from '../../domain/pipelineDiagnostics';
import type {
  PipelineConfig,
  ResolvedPipelinePresetId,
} from '../../domain/pipelineConfig';
import type { DetectionFrame } from '../../types/frames';
import PipelineDecisionTimeline from './PipelineDecisionTimeline.vue';
import PipelineExperimentPanel from './PipelineExperimentPanel.vue';
import PipelineFrameInspector from './PipelineFrameInspector.vue';
import PipelineSpectralPanel from './PipelineSpectralPanel.vue';
import PipelineTelemetryPanel from './PipelineTelemetryPanel.vue';
import { usePipelineDiagnostics } from './usePipelineDiagnostics';

const props = defineProps<{
  backend: PipelineRuntimeBackend;
  config: PipelineConfig;
  formatFreq: (frequency: number) => string;
  frame: DetectionFrame;
  isListening: boolean;
  preset: ResolvedPipelinePresetId;
  targetFrequency: number;
}>();

const {
  baseline,
  captureBaseline,
  clearBaseline,
  clearHistory,
  isLive,
  samples,
  selected,
  selectSample,
  step,
  toggleFreeze,
} = usePipelineDiagnostics({
  backend: toRef(props, 'backend'),
  config: toRef(props, 'config'),
  frame: toRef(props, 'frame'),
  isListening: toRef(props, 'isListening'),
  preset: toRef(props, 'preset'),
  targetFrequency: toRef(props, 'targetFrequency'),
});

const displayedFrame = computed(() => selected.value?.frame ?? props.frame);
const displayedSamples = computed(() => {
  if (isLive.value || !selected.value) return samples.value;
  const selectedIndex = samples.value.findIndex((sample) => sample.id === selected.value?.id);
  return selectedIndex < 0 ? samples.value : samples.value.slice(0, selectedIndex + 1);
});
const hasDiagnosticFrame = computed(() => props.isListening || selected.value != null);
</script>

<template>
  <div class="pipeline-diagnostics-workspace">
    <PipelineTelemetryPanel
      :baseline="baseline"
      :format-freq="formatFreq"
      :frame="displayedFrame"
      :is-listening="hasDiagnosticFrame"
      :samples="displayedSamples"
    />

    <PipelineDecisionTimeline
      :is-live="isLive"
      :samples="samples"
      :selected-id="selected?.id ?? null"
      @clear="clearHistory"
      @select="selectSample"
      @step="step"
      @toggle-freeze="toggleFreeze"
    />

    <PipelineSpectralPanel
      :format-freq="formatFreq"
      :sample="selected"
      :samples="displayedSamples"
    />

    <div class="pipeline-diagnostics-grid">
      <PipelineFrameInspector
        :format-freq="formatFreq"
        :is-live="isLive"
        :sample="selected"
        @step="step"
        @toggle-freeze="toggleFreeze"
      />
      <PipelineExperimentPanel
        :baseline="baseline"
        :format-freq="formatFreq"
        :sample="selected"
        @capture-baseline="captureBaseline"
        @clear-baseline="clearBaseline"
      />
    </div>
  </div>
</template>

<style scoped>
.pipeline-diagnostics-workspace {
  display: grid;
  gap: 10px;
}

.pipeline-diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}

@media (max-width: 860px) {
  .pipeline-diagnostics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
