<script setup lang="ts">
import { ChevronLeft, ChevronRight, Pause, Radio, Trash2 } from '@lucide/vue';
import { computed } from 'vue';
import type { PipelineDiagnosticSample } from '../../domain/pipelineDiagnostics';
import type { PipelineDecision } from '../../domain/pipelineTelemetry';
import { useL10n } from '../../stores/l10n';

const props = defineProps<{
  isLive: boolean;
  samples: PipelineDiagnosticSample[];
  selectedId: number | null;
}>();

const emit = defineEmits<{
  clear: [];
  select: [sample: PipelineDiagnosticSample];
  step: [offset: -1 | 1];
  toggleFreeze: [];
}>();

const { t } = useL10n();
const visibleSamples = computed(() => props.samples.slice(-90));
const publishedCount = computed(() => visibleSamples.value.filter(
  (sample) => sample.frame.pipeline.decision === 'published',
).length);

function state(decision: PipelineDecision) {
  if (decision === 'published') return 'published';
  if (decision === 'held') return 'held';
  if (decision === 'tracking-acquiring' || decision === 'octave-pending') return 'pending';
  return 'rejected';
}

function glyph(decision: PipelineDecision) {
  const value = state(decision);
  if (value === 'published') return 'P';
  if (value === 'held') return 'H';
  if (value === 'pending') return '...';
  return 'X';
}
</script>

<template>
  <section class="decision-timeline card" data-testid="pipeline-decision-timeline" aria-labelledby="decision-timeline-title">
    <header>
      <div>
        <h3 id="decision-timeline-title">{{ t('pipeline.diagnostics.timeline') }}</h3>
        <span>
          {{ samples.length }} {{ t('pipeline.diagnostics.timeline.frames') }} ·
          {{ publishedCount }} {{ t('pipeline.diagnostics.timeline.published') }}
        </span>
      </div>
      <div class="timeline-actions">
        <button
          type="button"
          data-testid="pipeline-freeze-toggle"
          :aria-label="isLive ? t('pipeline.diagnostics.freeze') : t('pipeline.diagnostics.live')"
          :title="isLive ? t('pipeline.diagnostics.freeze') : t('pipeline.diagnostics.live')"
          :aria-pressed="!isLive"
          :disabled="samples.length === 0"
          @click="emit('toggleFreeze')"
        >
          <Pause v-if="isLive" :size="15" aria-hidden="true" />
          <Radio v-else :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          :aria-label="t('pipeline.diagnostics.previous')"
          :title="t('pipeline.diagnostics.previous')"
          :disabled="samples.length === 0"
          @click="emit('step', -1)"
        >
          <ChevronLeft :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          :aria-label="t('pipeline.diagnostics.next')"
          :title="t('pipeline.diagnostics.next')"
          :disabled="samples.length === 0"
          @click="emit('step', 1)"
        >
          <ChevronRight :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          :aria-label="t('pipeline.diagnostics.clear')"
          :title="t('pipeline.diagnostics.clear')"
          :disabled="samples.length === 0"
          @click="emit('clear')"
        >
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="visibleSamples.length" class="timeline-track" role="group" :aria-label="t('pipeline.diagnostics.timeline')">
      <button
        v-for="sample in visibleSamples"
        :key="sample.id"
        type="button"
        :data-state="state(sample.frame.pipeline.decision)"
        :data-selected="sample.id === selectedId"
        :aria-label="`${sample.id}: ${t(`pipeline.telemetry.decision.${sample.frame.pipeline.decision}`)}`"
        :title="`${sample.id} · ${t(`pipeline.telemetry.decision.${sample.frame.pipeline.decision}`)}`"
        @click="emit('select', sample)"
      >
        <span aria-hidden="true">{{ glyph(sample.frame.pipeline.decision) }}</span>
      </button>
    </div>
    <div v-else class="timeline-empty">{{ t('pipeline.diagnostics.timeline.empty') }}</div>

    <footer aria-hidden="true">
      <span data-state="published">P {{ t('pipeline.diagnostics.timeline.published') }}</span>
      <span data-state="pending">... {{ t('pipeline.diagnostics.timeline.pending') }}</span>
      <span data-state="held">H {{ t('pipeline.diagnostics.timeline.held') }}</span>
      <span data-state="rejected">X {{ t('pipeline.diagnostics.timeline.rejected') }}</span>
    </footer>
  </section>
</template>

<style scoped>
.decision-timeline {
  overflow: hidden;
}

.decision-timeline > header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.decision-timeline h3 {
  margin: 0;
  color: var(--text);
  font-size: 0.78rem;
}

.decision-timeline header span,
.timeline-empty {
  color: var(--text-dim);
  font-size: 0.65rem;
}

.timeline-actions {
  display: flex;
  gap: 5px;
}

.timeline-actions button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  background: var(--surface-muted);
}

.timeline-actions button[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--accent);
}

.timeline-actions button:disabled {
  opacity: 0.35;
}

.timeline-track {
  height: 68px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(6px, 1fr);
  align-items: end;
  gap: 2px;
  padding: 13px 14px 10px;
}

.timeline-track button {
  min-width: 0;
  height: 34px;
  overflow: hidden;
  border: 0;
  border-top: 4px solid var(--border-strong);
  border-radius: 0;
  color: transparent;
  background: var(--surface-muted);
  font-size: 0.45rem;
}

.timeline-track button[data-state='published'] {
  border-top-color: var(--accent);
  background: repeating-linear-gradient(90deg, transparent 0 3px, color-mix(in srgb, var(--accent) 16%, transparent) 3px 4px);
}

.timeline-track button[data-state='pending'] {
  height: 26px;
  border-top-style: dashed;
  border-top-color: var(--warning);
}

.timeline-track button[data-state='held'] {
  height: 22px;
  border: 1px solid var(--warning);
  background: transparent;
}

.timeline-track button[data-state='rejected'] {
  height: 14px;
  border-top-color: var(--danger);
  background: repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in srgb, var(--danger) 20%, transparent) 3px 4px);
}

.timeline-track button[data-selected='true'] {
  outline: 2px solid var(--text);
  outline-offset: 1px;
}

.timeline-empty {
  height: 68px;
  display: grid;
  place-items: center;
}

.decision-timeline footer {
  min-height: 31px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 7px 14px;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 0.56rem;
}

.decision-timeline footer span[data-state='published'] { color: var(--accent); }
.decision-timeline footer span[data-state='pending'] { color: var(--warning); }
.decision-timeline footer span[data-state='rejected'] { color: var(--danger); }

@media (max-width: 560px) {
  .decision-timeline > header {
    align-items: flex-start;
  }

  .timeline-track {
    grid-auto-columns: minmax(4px, 1fr);
    gap: 1px;
  }
}
</style>
