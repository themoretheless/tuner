<script setup lang="ts">
import { Crosshair, RotateCcw } from '@lucide/vue';
import { computed, ref } from 'vue';
import { evaluateIntonationSetup } from '../domain/intonationSetup';
import { useL10n } from '../stores/l10n';

const props = defineProps<{
  detectedFrequency: number | null;
  isListening: boolean;
}>();

type MeasurementId = 'open' | 'harmonic12' | 'fretted12';

const { t } = useL10n();
const open = ref<number | null>(null);
const harmonic12 = ref<number | null>(null);
const fretted12 = ref<number | null>(null);
const result = computed(() => evaluateIntonationSetup({
  fretted12: fretted12.value,
  harmonic12: harmonic12.value,
  open: open.value,
}));
const rows = [
  { id: 'open' as const },
  { id: 'harmonic12' as const },
  { id: 'fretted12' as const },
];

function model(id: MeasurementId) {
  if (id === 'open') return open;
  if (id === 'harmonic12') return harmonic12;
  return fretted12;
}

function capture(id: MeasurementId) {
  if (props.detectedFrequency == null) return;
  model(id).value = Number(props.detectedFrequency.toFixed(3));
}

function reset() {
  open.value = null;
  harmonic12.value = null;
  fretted12.value = null;
}

function setValue(id: MeasurementId, event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  model(id).value = Number.isFinite(value) && value > 0 ? value : null;
}
</script>

<template>
  <section class="intonation-setup card" data-testid="intonation-setup" aria-labelledby="intonation-setup-title">
    <header>
      <div>
        <h3 id="intonation-setup-title">{{ t('intonation.title') }}</h3>
        <p>{{ t('intonation.detail') }}</p>
      </div>
      <button type="button" class="icon-button" :title="t('intonation.reset')" :aria-label="t('intonation.reset')" @click="reset">
        <RotateCcw :size="16" aria-hidden="true" />
      </button>
    </header>

    <div class="intonation-measurements">
      <label v-for="row in rows" :key="row.id">
        <span>{{ t(`intonation.${row.id}`) }}</span>
        <span class="intonation-input">
          <input
            type="number"
            min="1"
            max="5000"
            step="0.001"
            inputmode="decimal"
            :value="model(row.id).value ?? ''"
            :aria-label="t(`intonation.${row.id}`)"
            @input="setValue(row.id, $event)"
          />
          <span>Hz</span>
        </span>
        <button
          type="button"
          class="icon-button"
          :disabled="!isListening || detectedFrequency == null"
          :title="t('intonation.capture')"
          :aria-label="`${t('intonation.capture')}: ${t(`intonation.${row.id}`)}`"
          @click="capture(row.id)"
        >
          <Crosshair :size="16" aria-hidden="true" />
        </button>
      </label>
    </div>

    <div v-if="result" class="intonation-result" :data-adjustment="result.adjustment">
      <div>
        <span>{{ t('intonation.deviation') }}</span>
        <strong>{{ result.cents >= 0 ? '+' : '' }}{{ result.cents.toFixed(1) }} ct</strong>
      </div>
      <p>{{ t(`intonation.adjustment.${result.adjustment}`) }}</p>
      <p v-if="!result.referenceReliable" class="intonation-warning">
        {{ t('intonation.reference.warning') }}
      </p>
    </div>
    <p v-else class="intonation-empty">{{ t('intonation.empty') }}</p>
  </section>
</template>

<style scoped>
.intonation-setup {
  min-width: 0;
  padding: 18px;
}

.intonation-setup > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.intonation-setup h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 650;
}

.intonation-setup header p,
.intonation-empty {
  margin: 5px 0 0;
  color: var(--text-dim);
  font-size: 0.72rem;
  line-height: 1.45;
}

.intonation-measurements {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.intonation-measurements > label {
  min-height: 40px;
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 160px) 32px;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.74rem;
}

.intonation-input {
  height: 34px;
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-muted);
}

.intonation-input:focus-within {
  border-color: var(--accent-strong);
}

.intonation-input input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 0 8px;
  color: var(--text);
  font: 0.76rem var(--mono);
}

.intonation-input > span {
  padding-right: 8px;
  color: var(--text-dim);
  font: 0.64rem var(--mono);
}

.intonation-result {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  padding: 12px;
  border-left: 3px solid var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.intonation-result[data-adjustment='lengthen'],
.intonation-result[data-adjustment='shorten'] {
  border-left-color: var(--warning);
  background: color-mix(in srgb, var(--warning) 7%, transparent);
}

.intonation-result > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.intonation-result strong {
  color: var(--text);
  font: 0.74rem var(--mono);
}

.intonation-result p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

.intonation-warning {
  color: var(--warning) !important;
}

@media (max-width: 520px) {
  .intonation-measurements > label {
    grid-template-columns: minmax(0, 1fr) 32px;
  }

  .intonation-measurements > label > span:first-child {
    grid-column: 1 / -1;
  }
}
</style>
