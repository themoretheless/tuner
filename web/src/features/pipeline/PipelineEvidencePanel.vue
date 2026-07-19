<script setup lang="ts">
import { computed } from 'vue';
import type { AudioInputDiagnostics } from '../../domain/audioInputDiagnostics';
import { useL10n } from '../../stores/l10n';
import type { DetectionFrame } from '../../types/frames';

const props = defineProps<{
  frame: DetectionFrame;
  inputDiagnostics: AudioInputDiagnostics | null;
  isListening: boolean;
}>();

const { t } = useL10n();

const confidenceRows = computed(() => [
  { id: 'periodicity', value: props.frame.pipeline.confidence.periodicity },
  { id: 'agreement', value: props.frame.pipeline.confidence.agreement },
  { id: 'stability', value: props.frame.pipeline.confidence.stability },
  { id: 'signal', value: props.frame.pipeline.confidence.signal },
]);
const fingerprint = computed(() => props.frame.pipeline.configFingerprint
  ? props.frame.pipeline.configFingerprint.toString(16).padStart(8, '0').toUpperCase()
  : '--------');
const confidencePercent = computed(() => (
  props.isListening
    ? `${Math.round(props.frame.pipeline.confidence.calibrated * 100)}%`
    : '—'
));
const uncertainty = computed(() => (
  props.isListening
    ? `±${props.frame.pipeline.confidence.uncertaintyCents.toFixed(1)} ct`
    : '—'
));

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function booleanValue(value: boolean | null) {
  if (value == null) return t('pipeline.evidence.unknown');
  return value ? t('pipeline.evidence.on') : t('pipeline.evidence.off');
}

function numberValue(value: number | null, suffix = '') {
  return value == null ? t('pipeline.evidence.unknown') : `${value}${suffix}`;
}
</script>

<template>
  <section class="pipeline-evidence card" data-testid="pipeline-evidence" aria-labelledby="pipeline-evidence-title">
    <header>
      <div>
        <h3 id="pipeline-evidence-title">{{ t('pipeline.evidence.title') }}</h3>
        <span>{{ t('pipeline.evidence.detail') }}</span>
      </div>
      <code :title="t('pipeline.evidence.fingerprint')">{{ fingerprint }}</code>
    </header>

    <div class="pipeline-evidence-grid">
      <section aria-labelledby="pipeline-confidence-title">
        <div class="pipeline-evidence-section-title">
          <h4 id="pipeline-confidence-title">{{ t('pipeline.evidence.confidence') }}</h4>
          <strong>{{ confidencePercent }}</strong>
        </div>
        <div class="pipeline-evidence-bars">
          <div v-for="row in confidenceRows" :key="row.id" class="pipeline-evidence-row">
            <span>{{ t(`pipeline.evidence.${row.id}`) }}</span>
            <i aria-hidden="true"><b :style="{ width: percent(row.value) }"></b></i>
            <strong>{{ percent(row.value) }}</strong>
          </div>
        </div>
        <div class="pipeline-evidence-summary">
          <span>{{ t('pipeline.evidence.uncertainty') }}</span>
          <strong>{{ uncertainty }}</strong>
        </div>
      </section>

      <section aria-labelledby="pipeline-input-title">
        <div class="pipeline-evidence-section-title">
          <h4 id="pipeline-input-title">{{ t('pipeline.evidence.input') }}</h4>
          <strong v-if="inputDiagnostics" :data-state="inputDiagnostics.status">
            {{ t(`pipeline.evidence.status.${inputDiagnostics.status}`) }}
          </strong>
        </div>
        <div v-if="inputDiagnostics" class="pipeline-input-settings">
          <span>{{ t('pipeline.evidence.autoGainControl') }}</span><strong>{{ booleanValue(inputDiagnostics.actual.autoGainControl) }}</strong>
          <span>{{ t('pipeline.evidence.noiseSuppression') }}</span><strong>{{ booleanValue(inputDiagnostics.actual.noiseSuppression) }}</strong>
          <span>{{ t('pipeline.evidence.echoCancellation') }}</span><strong>{{ booleanValue(inputDiagnostics.actual.echoCancellation) }}</strong>
          <span>{{ t('pipeline.evidence.channels') }}</span><strong>{{ numberValue(inputDiagnostics.actual.channelCount) }}</strong>
          <span>{{ t('pipeline.evidence.trackRate') }}</span><strong>{{ numberValue(inputDiagnostics.actual.sampleRate, ' Hz') }}</strong>
          <span>{{ t('pipeline.evidence.contextRate') }}</span><strong>{{ numberValue(inputDiagnostics.contextSampleRate, ' Hz') }}</strong>
        </div>
        <p v-else class="pipeline-evidence-empty">{{ t('pipeline.evidence.input.empty') }}</p>
        <ul v-if="inputDiagnostics?.warnings.length" class="pipeline-input-warnings">
          <li v-for="warning in inputDiagnostics.warnings" :key="warning">
            {{ t(`pipeline.evidence.warning.${warning}`) }}
          </li>
        </ul>
        <p v-if="frame.pipeline.interference" class="pipeline-interference" data-testid="pipeline-interference">
          {{ t('pipeline.evidence.interference') }}
          {{ frame.pipeline.interference.candidateFrequency.toFixed(1) }} Hz
          → {{ frame.pipeline.interference.competingTargetFrequency.toFixed(1) }} Hz
        </p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.pipeline-evidence {
  overflow: hidden;
}

.pipeline-evidence > header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.pipeline-evidence h3,
.pipeline-evidence h4 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 650;
}

.pipeline-evidence header span,
.pipeline-evidence-empty {
  color: var(--text-dim);
  font-size: 0.7rem;
}

.pipeline-evidence code {
  color: var(--accent);
  font: 0.72rem var(--mono);
}

.pipeline-evidence-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pipeline-evidence-grid > section {
  min-width: 0;
  padding: 14px;
}

.pipeline-evidence-grid > section + section {
  border-left: 1px solid var(--border);
}

.pipeline-evidence-section-title,
.pipeline-evidence-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pipeline-evidence-section-title > strong,
.pipeline-evidence-summary strong {
  color: var(--accent);
  font: 0.72rem var(--mono);
}

.pipeline-evidence-section-title > strong[data-state='warning'] {
  color: var(--warning);
}

.pipeline-evidence-section-title > strong[data-state='unavailable'] {
  color: var(--text-dim);
}

.pipeline-evidence-bars {
  display: grid;
  gap: 8px;
  margin-top: 13px;
}

.pipeline-evidence-row {
  display: grid;
  grid-template-columns: minmax(88px, 0.8fr) minmax(80px, 1fr) 36px;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.pipeline-evidence-row > i {
  height: 4px;
  overflow: hidden;
  background: var(--border);
}

.pipeline-evidence-row > i > b {
  display: block;
  height: 100%;
  background: var(--accent-strong);
}

.pipeline-evidence-row > strong {
  font: 0.66rem var(--mono);
  text-align: right;
}

.pipeline-evidence-summary {
  margin-top: 13px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.7rem;
}

.pipeline-input-settings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 14px;
  margin-top: 13px;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.pipeline-input-settings strong {
  color: var(--text);
  font: 0.68rem var(--mono);
  text-align: right;
}

.pipeline-input-warnings {
  display: grid;
  gap: 5px;
  margin: 12px 0 0;
  padding: 9px 10px 9px 25px;
  border-left: 2px solid var(--warning);
  background: color-mix(in srgb, var(--warning) 7%, transparent);
  color: var(--text-muted);
  font-size: 0.68rem;
}

.pipeline-interference {
  margin: 12px 0 0;
  padding: 9px 10px;
  border-left: 2px solid var(--warning);
  background: color-mix(in srgb, var(--warning) 7%, transparent);
  color: var(--warning);
  font-size: 0.68rem;
  line-height: 1.4;
}

@media (max-width: 720px) {
  .pipeline-evidence-grid {
    grid-template-columns: 1fr;
  }

  .pipeline-evidence-grid > section + section {
    border-top: 1px solid var(--border);
    border-left: 0;
  }
}
</style>
