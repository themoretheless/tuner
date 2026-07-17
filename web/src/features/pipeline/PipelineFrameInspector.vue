<script setup lang="ts">
import { ChevronLeft, ChevronRight, Pause, Radio } from '@lucide/vue';
import { computed } from 'vue';
import {
  analysisWindowMs,
  type PipelineDiagnosticSample,
} from '../../domain/pipelineDiagnostics';
import { useL10n } from '../../stores/l10n';

const props = defineProps<{
  formatFreq: (frequency: number) => string;
  isLive: boolean;
  sample: PipelineDiagnosticSample | null;
}>();

const emit = defineEmits<{
  step: [offset: -1 | 1];
  toggleFreeze: [];
}>();

const { t } = useL10n();
const latency = computed(() => {
  const telemetry = props.sample?.frame.pipeline;
  if (!telemetry) return [];
  const transport = Math.max(0, telemetry.roundTripMs - telemetry.processingMs);
  return [
    { id: 'window', label: t('pipeline.diagnostics.latency.window'), value: analysisWindowMs(telemetry), scale: 220 },
    { id: 'processing', label: t('pipeline.diagnostics.latency.processing'), value: telemetry.processingMs, scale: 40 },
    { id: 'transport', label: t('pipeline.diagnostics.latency.transport'), value: transport, scale: 80 },
    { id: 'cadence', label: t('pipeline.diagnostics.latency.cadence'), value: props.sample?.cadenceMs ?? 0, scale: 80 },
  ];
});

const details = computed(() => {
  const sample = props.sample;
  if (!sample) return [];
  const frame = sample.frame;
  return [
    { label: t('pipeline.diagnostics.frame.id'), value: `#${sample.id}` },
    { label: t('pipeline.backend'), value: sample.backend.toUpperCase() },
    { label: t('pipeline.preset'), value: t(`pipeline.preset.${sample.preset}`) },
    { label: t('pipeline.diagnostics.frame.decision'), value: t(`pipeline.telemetry.decision.${frame.pipeline.decision}`) },
    { label: t('pipeline.diagnostics.frame.arbitration'), value: t(`pipeline.telemetry.arbitration.${frame.pipeline.arbitration}`) },
    { label: 'Raw', value: frequency(frame.rawFreq) },
    { label: 'Stable', value: frequency(frame.freq) },
    { label: t('pipeline.diagnostics.frame.confidence'), value: `${Math.round(frame.confidence * 100)}%` },
    { label: t('pipeline.diagnostics.uncertainty'), value: `±${sample.uncertaintyCents.toFixed(1)}¢` },
    { label: 'RMS', value: frame.rms.toFixed(5) },
  ];
});

function frequency(value: number | null) {
  return value == null ? '\u2014' : `${props.formatFreq(value)} Hz`;
}

function latencyWidth(value: number, scale: number) {
  return `${Math.max(1, Math.min(100, (value / scale) * 100))}%`;
}
</script>

<template>
  <section class="frame-inspector card" data-testid="pipeline-frame-inspector" aria-labelledby="frame-inspector-title">
    <header>
      <div>
        <h3 id="frame-inspector-title">{{ t('pipeline.diagnostics.inspector') }}</h3>
        <span>{{ isLive ? t('pipeline.diagnostics.inspector.live') : t('pipeline.diagnostics.inspector.frozen') }}</span>
      </div>
      <div class="inspector-actions">
        <button
          type="button"
          :aria-label="t('pipeline.diagnostics.previous')"
          :title="t('pipeline.diagnostics.previous')"
          :disabled="!sample"
          @click="emit('step', -1)"
        >
          <ChevronLeft :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          :aria-label="isLive ? t('pipeline.diagnostics.freeze') : t('pipeline.diagnostics.live')"
          :title="isLive ? t('pipeline.diagnostics.freeze') : t('pipeline.diagnostics.live')"
          :aria-pressed="!isLive"
          :disabled="!sample"
          @click="emit('toggleFreeze')"
        >
          <Pause v-if="isLive" :size="15" aria-hidden="true" />
          <Radio v-else :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          :aria-label="t('pipeline.diagnostics.next')"
          :title="t('pipeline.diagnostics.next')"
          :disabled="!sample"
          @click="emit('step', 1)"
        >
          <ChevronRight :size="15" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="sample" class="inspector-body">
      <dl class="frame-detail-grid">
        <div v-for="detail in details" :key="detail.label">
          <dt>{{ detail.label }}</dt>
          <dd>{{ detail.value }}</dd>
        </div>
      </dl>

      <section class="latency-budget" aria-labelledby="latency-budget-title">
        <header>
          <h4 id="latency-budget-title">{{ t('pipeline.diagnostics.latency') }}</h4>
          <span>{{ t('pipeline.diagnostics.latency.note') }}</span>
        </header>
        <div class="latency-rows">
          <div v-for="metric in latency" :key="metric.id" :data-metric="metric.id">
            <span>{{ metric.label }}</span>
            <span class="latency-track" aria-hidden="true"><i :style="{ width: latencyWidth(metric.value, metric.scale) }"></i></span>
            <strong>{{ metric.value.toFixed(1) }} ms</strong>
          </div>
        </div>
      </section>
    </div>
    <p v-else class="inspector-empty">{{ t('pipeline.diagnostics.inspector.empty') }}</p>
  </section>
</template>

<style scoped>
.frame-inspector {
  overflow: hidden;
}

.frame-inspector > header,
.latency-budget > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.frame-inspector > header {
  min-height: 58px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.frame-inspector h3,
.frame-inspector h4 {
  margin: 0;
  color: var(--text);
  font-size: 0.78rem;
}

.frame-inspector header span,
.inspector-empty {
  color: var(--text-dim);
  font-size: 0.63rem;
}

.inspector-actions {
  display: flex;
  gap: 5px;
}

.inspector-actions button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  background: var(--surface-muted);
}

.inspector-actions button[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--accent);
}

.inspector-actions button:disabled {
  opacity: 0.35;
}

.inspector-body {
  display: grid;
}

.frame-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 6px 14px 12px;
}

.frame-detail-grid > div {
  min-width: 0;
  min-height: 43px;
  padding: 9px 8px 7px 0;
  border-bottom: 1px solid var(--border);
}

.frame-detail-grid > div:nth-child(even) {
  padding-right: 0;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}

.frame-detail-grid dt {
  color: var(--text-dim);
  font-size: 0.56rem;
}

.frame-detail-grid dd {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 0.65rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.latency-budget {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--border);
}

.latency-budget > header span {
  max-width: 58%;
  text-align: right;
}

.latency-rows {
  display: grid;
  gap: 9px;
  margin-top: 12px;
}

.latency-rows > div {
  display: grid;
  grid-template-columns: minmax(92px, 0.7fr) minmax(80px, 1fr) 62px;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 0.62rem;
}

.latency-rows strong {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 0.61rem;
  text-align: right;
}

.latency-track {
  height: 4px;
  overflow: hidden;
  background: var(--border);
}

.latency-track i {
  display: block;
  height: 100%;
  background: var(--text-muted);
}

.latency-rows [data-metric='processing'] i { background: var(--accent); }
.latency-rows [data-metric='transport'] i { background: var(--warning); }

.inspector-empty {
  min-height: 350px;
  display: grid;
  place-items: center;
  margin: 0;
}

@media (max-width: 480px) {
  .latency-budget > header {
    align-items: flex-start;
    flex-direction: column;
  }

  .latency-budget > header span {
    max-width: none;
    text-align: left;
  }
}
</style>
