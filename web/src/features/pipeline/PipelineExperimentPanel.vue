<script setup lang="ts">
import { BookmarkPlus, X } from '@lucide/vue';
import { computed, ref } from 'vue';
import {
  compareDiagnosticSamples,
  DIAGNOSTIC_BYPASSES,
  simulatePipelineBypass,
  type DiagnosticBypass,
  type PipelineDiagnosticSample,
} from '../../domain/pipelineDiagnostics';
import type { PipelineBlockId } from '../../domain/pipelineConfig';
import { useL10n } from '../../stores/l10n';

const props = defineProps<{
  baseline: PipelineDiagnosticSample | null;
  formatFreq: (frequency: number) => string;
  sample: PipelineDiagnosticSample | null;
}>();

const emit = defineEmits<{
  captureBaseline: [];
  clearBaseline: [];
}>();

const { t } = useL10n();
const bypass = ref<DiagnosticBypass>('trackingEnabled');
const whatIf = computed(() => simulatePipelineBypass(props.sample, bypass.value));
const comparison = computed(() => compareDiagnosticSamples(props.sample, props.baseline));

const blockTranslationIds: Record<PipelineBlockId, string> = {
  adaptiveGateEnabled: 'adaptive',
  dcRemovalEnabled: 'dcRemoval',
  fixedGateEnabled: 'fixedGate',
  harmonicEnabled: 'harmonic',
  holdEnabled: 'hold',
  octaveEnabled: 'octave',
  powerChordEnabled: 'power',
  secondaryDetectorEnabled: 'secondary',
  trackingEnabled: 'tracker',
  yinEnabled: 'yin',
};

function blockLabel(block: PipelineBlockId) {
  return t(`pipeline.block.${blockTranslationIds[block]}`);
}

function formatFrequency(value: number | null) {
  return value == null ? '\u2014' : `${props.formatFreq(value)} Hz`;
}

function signed(value: number | null, suffix = '') {
  if (value == null) return '\u2014';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}${suffix}`;
}
</script>

<template>
  <section class="experiment-panel card" data-testid="pipeline-experiment-panel" aria-labelledby="experiment-panel-title">
    <header>
      <div>
        <h3 id="experiment-panel-title">{{ t('pipeline.diagnostics.experiment') }}</h3>
        <span>{{ t('pipeline.diagnostics.experiment.detail') }}</span>
      </div>
    </header>

    <section class="what-if" aria-labelledby="what-if-title">
      <header>
        <div>
          <h4 id="what-if-title">{{ t('pipeline.diagnostics.whatif') }}</h4>
          <span>{{ t('pipeline.diagnostics.whatif.detail') }}</span>
        </div>
        <label>
          <span class="sr-only">{{ t('pipeline.diagnostics.whatif.block') }}</span>
          <select v-model="bypass" :disabled="!sample">
            <option v-for="block in DIAGNOSTIC_BYPASSES" :key="block" :value="block">
              {{ blockLabel(block) }}
            </option>
          </select>
        </label>
      </header>
      <div class="what-if-result" :data-kind="whatIf.kind">
        <span>{{ t(`pipeline.diagnostics.whatif.${whatIf.kind}`) }}</span>
        <strong data-testid="pipeline-what-if-frequency">{{ formatFrequency(whatIf.frequency) }}</strong>
        <em>{{ whatIf.decision ? t(`pipeline.telemetry.decision.${whatIf.decision}`) : '\u2014' }}</em>
        <p>{{ t(`pipeline.diagnostics.whatif.reason.${whatIf.reason}`) }}</p>
      </div>
    </section>

    <section class="baseline" aria-labelledby="baseline-title">
      <header>
        <div>
          <h4 id="baseline-title">{{ t('pipeline.diagnostics.baseline') }}</h4>
          <span>{{ t('pipeline.diagnostics.baseline.detail') }}</span>
        </div>
        <div class="baseline-actions">
          <button type="button" data-testid="pipeline-baseline-capture" :disabled="!sample" @click="emit('captureBaseline')">
            <BookmarkPlus :size="14" aria-hidden="true" />
            {{ t('pipeline.diagnostics.baseline.capture') }}
          </button>
          <button
            v-if="baseline"
            type="button"
            class="baseline-clear"
            :aria-label="t('pipeline.diagnostics.baseline.clear')"
            :title="t('pipeline.diagnostics.baseline.clear')"
            @click="emit('clearBaseline')"
          >
            <X :size="14" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div v-if="baseline && comparison && sample" class="comparison-grid" data-testid="pipeline-baseline-comparison">
        <div>
          <span>{{ t('pipeline.diagnostics.baseline.profile') }}</span>
          <strong>{{ baseline.preset }} / {{ baseline.backend }}</strong>
          <em>{{ sample.preset }} / {{ sample.backend }}</em>
        </div>
        <div>
          <span>Δ Hz</span>
          <strong>{{ signed(comparison.frequencyDelta, ' Hz') }}</strong>
          <em>{{ formatFrequency(sample.frame.freq) }}</em>
        </div>
        <div>
          <span>Δ cents</span>
          <strong>{{ signed(comparison.stableCentsDelta, '¢') }}</strong>
          <em>{{ comparison.decisionChanged ? t('pipeline.diagnostics.baseline.decisionChanged') : t('pipeline.diagnostics.baseline.decisionSame') }}</em>
        </div>
        <div>
          <span>Δ confidence</span>
          <strong>{{ signed(comparison.confidenceDelta * 100, '%') }}</strong>
          <em>{{ comparison.configChanges.length }} {{ t('pipeline.diagnostics.baseline.blocks') }}</em>
        </div>
        <p v-if="comparison.configChanges.length">
          {{ comparison.configChanges.map(blockLabel).join(' · ') }}
        </p>
      </div>
      <p v-else class="baseline-empty">{{ t('pipeline.diagnostics.baseline.empty') }}</p>
    </section>
  </section>
</template>

<style scoped>
.experiment-panel {
  overflow: hidden;
}

.experiment-panel > header,
.what-if,
.baseline {
  padding: 12px 14px;
}

.experiment-panel > header,
.what-if {
  border-bottom: 1px solid var(--border);
}

.experiment-panel h3,
.experiment-panel h4 {
  margin: 0;
  color: var(--text);
  font-size: 0.78rem;
}

.experiment-panel header span,
.baseline-empty {
  margin: 3px 0 0;
  color: var(--text-dim);
  font-size: 0.62rem;
}

.what-if > header,
.baseline > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.what-if select {
  max-width: 170px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  background: var(--surface-muted);
  font-size: 0.62rem;
}

.what-if-result {
  min-height: 78px;
  display: grid;
  grid-template-columns: minmax(80px, auto) minmax(80px, 1fr) auto;
  align-items: center;
  gap: 8px 12px;
  margin-top: 12px;
  padding: 10px;
  border: 1px dashed var(--border-strong);
  background: var(--surface-muted);
}

.what-if-result > span,
.what-if-result em {
  color: var(--text-dim);
  font-size: 0.6rem;
  font-style: normal;
}

.what-if-result strong {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 0.72rem;
}

.what-if-result p {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--text-dim);
  font-size: 0.6rem;
}

.what-if-result[data-kind='changed'] {
  border-style: solid;
  border-color: var(--accent);
}

.what-if-result[data-kind='unavailable'] {
  border-color: var(--warning);
}

.baseline-actions {
  display: flex;
  gap: 5px;
}

.baseline-actions button {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  background: var(--surface-muted);
  font-size: 0.58rem;
}

.baseline-actions .baseline-clear {
  width: 30px;
  padding: 0;
}

.baseline-actions button:disabled {
  opacity: 0.35;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 12px;
  border-top: 1px solid var(--border);
}

.comparison-grid > div {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 9px 8px 9px 0;
  border-bottom: 1px solid var(--border);
}

.comparison-grid > div:nth-child(even) {
  padding-right: 0;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}

.comparison-grid span,
.comparison-grid em {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 0.56rem;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comparison-grid strong {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 0.65rem;
}

.comparison-grid > p {
  grid-column: 1 / -1;
  margin: 8px 0 0;
  color: var(--text-dim);
  font-size: 0.58rem;
}

.baseline-empty {
  min-height: 115px;
  display: grid;
  place-items: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 480px) {
  .what-if > header,
  .baseline > header {
    align-items: flex-start;
    flex-direction: column;
  }

  .what-if select {
    max-width: none;
    width: 100%;
  }

  .what-if label,
  .baseline-actions {
    width: 100%;
  }

  .baseline-actions button:first-child {
    flex: 1;
  }
}
</style>
