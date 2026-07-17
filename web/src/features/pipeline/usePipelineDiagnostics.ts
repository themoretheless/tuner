import { computed, ref, watch, type Ref } from 'vue';
import {
  cloneDiagnosticSample,
  createPipelineDiagnosticSample,
  type PipelineDiagnosticSample,
  type PipelineRuntimeBackend,
} from '../../domain/pipelineDiagnostics';
import type {
  PipelineConfig,
  ResolvedPipelinePresetId,
} from '../../domain/pipelineConfig';
import type { DetectionFrame } from '../../types/frames';

const HISTORY_LIMIT = 120;

interface PipelineDiagnosticsOptions {
  backend: Ref<PipelineRuntimeBackend>;
  config: Ref<PipelineConfig>;
  frame: Ref<DetectionFrame>;
  isListening: Ref<boolean>;
  preset: Ref<ResolvedPipelinePresetId>;
  targetFrequency: Ref<number>;
}

export function usePipelineDiagnostics(options: PipelineDiagnosticsOptions) {
  const baseline = ref<PipelineDiagnosticSample | null>(null);
  const frozen = ref<PipelineDiagnosticSample | null>(null);
  const samples = ref<PipelineDiagnosticSample[]>([]);
  let nextId = 1;

  const latest = computed(() => samples.value.at(-1) ?? null);
  const selected = computed(() => frozen.value ?? latest.value);
  const isLive = computed(() => frozen.value == null);

  watch(options.frame, (frame) => {
    if (!options.isListening.value || frozen.value) return;
    const now = performance.now();
    const previous = samples.value.at(-1);
    const sample = createPipelineDiagnosticSample({
      backend: options.backend.value,
      config: options.config.value,
      frame,
      id: nextId,
      now,
      preset: options.preset.value,
      previousAt: previous?.at,
      targetFrequency: options.targetFrequency.value,
    });
    nextId += 1;
    samples.value = [...samples.value.slice(-(HISTORY_LIMIT - 1)), sample];
  });

  watch(options.isListening, (listening, wasListening) => {
    if (listening && !wasListening) clearHistory();
  });

  watch(options.targetFrequency, () => clearHistory());

  function selectSample(sample: PipelineDiagnosticSample) {
    frozen.value = cloneDiagnosticSample(sample);
  }

  function selectLatest() {
    frozen.value = null;
  }

  function toggleFreeze() {
    if (frozen.value) selectLatest();
    else if (latest.value) frozen.value = cloneDiagnosticSample(latest.value);
  }

  function step(offset: -1 | 1) {
    const current = selected.value;
    if (!current || samples.value.length === 0) return;
    const index = samples.value.findIndex((sample) => sample.id === current.id);
    const fallbackIndex = samples.value.length - 1;
    const nextIndex = Math.max(0, Math.min(
      samples.value.length - 1,
      (index < 0 ? fallbackIndex : index) + offset,
    ));
    frozen.value = cloneDiagnosticSample(samples.value[nextIndex]);
  }

  function captureBaseline() {
    if (selected.value) baseline.value = cloneDiagnosticSample(selected.value);
  }

  function clearBaseline() {
    baseline.value = null;
  }

  function clearHistory() {
    samples.value = [];
    frozen.value = null;
  }

  return {
    baseline,
    captureBaseline,
    clearBaseline,
    clearHistory,
    frozen,
    isLive,
    latest,
    samples,
    selected,
    selectLatest,
    selectSample,
    step,
    toggleFreeze,
  };
}
