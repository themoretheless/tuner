<script setup lang="ts">
import { computed } from 'vue';
import {
  octaveHypotheses,
  type PipelineDiagnosticSample,
} from '../../domain/pipelineDiagnostics';
import { useL10n } from '../../stores/l10n';

const props = defineProps<{
  formatFreq: (frequency: number) => string;
  sample: PipelineDiagnosticSample | null;
  samples: PipelineDiagnosticSample[];
}>();

const { t } = useL10n();
const CHART_WIDTH = 640;
const CHART_HEIGHT = 112;
const HISTORY_LIMIT = 90;
const hypotheses = computed(() => octaveHypotheses(props.sample));
const spectral = computed(() => props.sample?.frame.pipeline.spectral ?? null);
const harmonics = computed(() => spectral.value?.harmonics ?? [0, 0, 0, 0, 0]);
const noiseSamples = computed(() => props.samples.slice(-HISTORY_LIMIT));
const signalPath = computed(() => noisePath((sample) => sample.frame.rms));
const floorPath = computed(() => noisePath((sample) => sample.frame.pipeline.noiseFloor));
const thresholdPath = computed(() => noisePath((sample) => sample.frame.pipeline.gateThreshold));

function scoreWidth(score: number) {
  return `${Math.round(score * 100)}%`;
}

function shiftLabel(shift: -1 | 0 | 1) {
  if (shift === -1) return 'f / 2';
  if (shift === 1) return '2f';
  return 'f';
}

function stateLabel(state: 'active' | 'candidate' | 'pending') {
  return t(`pipeline.diagnostics.octave.${state}`);
}

function harmonicFrequency(index: number) {
  const base = spectral.value?.baseFrequency;
  return base ? `${props.formatFreq(base * (index + 1))} Hz` : '\u2014';
}

function noisePath(value: (sample: PipelineDiagnosticSample) => number) {
  const points = noiseSamples.value;
  if (!points.length) return '';
  const step = CHART_WIDTH / (HISTORY_LIMIT - 1);
  return points.map((sample, index) => {
    const x = CHART_WIDTH - (points.length - 1 - index) * step;
    return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${dbY(value(sample)).toFixed(1)}`;
  }).join(' ');
}

function dbY(value: number) {
  const db = Math.max(-72, Math.min(0, 20 * Math.log10(Math.max(value, 0.000001))));
  return ((0 - db) / 72) * CHART_HEIGHT;
}
</script>

<template>
  <section class="spectral-panel card" data-testid="pipeline-spectral-panel" aria-labelledby="spectral-panel-title">
    <header>
      <div>
        <h3 id="spectral-panel-title">{{ t('pipeline.diagnostics.spectral') }}</h3>
        <span>{{ t('pipeline.diagnostics.spectral.detail') }}</span>
      </div>
      <strong :data-available="spectral != null">
        {{ spectral ? t('pipeline.diagnostics.measured') : t('pipeline.diagnostics.unavailable') }}
      </strong>
    </header>

    <div class="spectral-layout">
      <section class="octave-ladder" aria-labelledby="octave-ladder-title">
        <h4 id="octave-ladder-title">{{ t('pipeline.diagnostics.octave') }}</h4>
        <div v-if="hypotheses.length" class="octave-rows">
          <div
            v-for="hypothesis in hypotheses"
            :key="hypothesis.shift"
            class="octave-row"
            :data-state="hypothesis.state"
            :data-testid="`pipeline-octave-${hypothesis.shift}`"
          >
            <b>{{ shiftLabel(hypothesis.shift) }}</b>
            <span>{{ formatFreq(hypothesis.frequency) }} Hz</span>
            <span class="spectral-meter" aria-hidden="true"><i :style="{ width: scoreWidth(hypothesis.score) }"></i></span>
            <strong>{{ Math.round(hypothesis.score * 100) }}%</strong>
            <em>{{ stateLabel(hypothesis.state) }}</em>
          </div>
        </div>
        <p v-else>{{ t('pipeline.diagnostics.spectral.empty') }}</p>
      </section>

      <section class="harmonic-fingerprint" aria-labelledby="harmonic-title">
        <h4 id="harmonic-title">{{ t('pipeline.diagnostics.harmonics') }}</h4>
        <div class="harmonic-bars" :data-available="spectral != null">
          <div v-for="(strength, index) in harmonics" :key="index">
            <span class="harmonic-bar" aria-hidden="true"><i :style="{ height: scoreWidth(strength) }"></i></span>
            <b>H{{ index + 1 }}</b>
            <small>{{ harmonicFrequency(index) }}</small>
            <strong>{{ spectral ? Math.round(strength * 100) : 0 }}%</strong>
          </div>
        </div>
      </section>

      <section class="noise-map" aria-labelledby="noise-map-title">
        <header>
          <h4 id="noise-map-title">{{ t('pipeline.diagnostics.noise') }}</h4>
          <div aria-hidden="true">
            <span class="noise-signal">{{ t('pipeline.diagnostics.noise.signal') }}</span>
            <span class="noise-floor">{{ t('pipeline.diagnostics.noise.floor') }}</span>
            <span class="noise-threshold">{{ t('pipeline.diagnostics.noise.threshold') }}</span>
          </div>
        </header>
        <div class="noise-chart">
          <svg :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`" role="img" :aria-label="t('pipeline.diagnostics.noise')" preserveAspectRatio="none">
            <line v-for="y in [0, 37.3, 74.7, 112]" :key="y" x1="0" :y1="y" :x2="CHART_WIDTH" :y2="y" />
            <path v-if="floorPath" class="noise-path-floor" :d="floorPath" />
            <path v-if="thresholdPath" class="noise-path-threshold" :d="thresholdPath" />
            <path v-if="signalPath" data-testid="pipeline-noise-signal" class="noise-path-signal" :d="signalPath" />
          </svg>
          <span class="noise-db noise-db-top">0</span>
          <span class="noise-db noise-db-middle">-36</span>
          <span class="noise-db noise-db-bottom">-72 dB</span>
          <p v-if="!signalPath">{{ t('pipeline.diagnostics.noise.empty') }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.spectral-panel {
  overflow: hidden;
}

.spectral-panel > header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.spectral-panel h3,
.spectral-panel h4 {
  margin: 0;
  color: var(--text);
  font-size: 0.78rem;
}

.spectral-panel > header span,
.spectral-panel p {
  margin: 3px 0 0;
  color: var(--text-dim);
  font-size: 0.65rem;
}

.spectral-panel > header strong {
  padding: 5px 8px;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
  color: var(--text-dim);
  font-size: 0.6rem;
}

.spectral-panel > header strong[data-available='true'] {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

.spectral-layout {
  display: grid;
  grid-template-columns: minmax(340px, 1.2fr) minmax(260px, 0.8fr);
}

.octave-ladder,
.harmonic-fingerprint,
.noise-map {
  min-width: 0;
  padding: 14px;
}

.octave-ladder {
  border-right: 1px solid var(--border);
}

.octave-rows {
  display: grid;
  margin-top: 10px;
}

.octave-row {
  min-height: 42px;
  display: grid;
  grid-template-columns: 34px 82px minmax(54px, 1fr) 34px 68px;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.64rem;
}

.octave-row:last-child {
  border-bottom: 1px solid var(--border);
}

.octave-row b,
.octave-row strong,
.octave-row span {
  font-family: var(--mono);
  font-style: normal;
}

.octave-row b {
  white-space: nowrap;
}

.octave-row em {
  color: var(--text-dim);
  font-size: 0.58rem;
  font-style: normal;
  text-align: right;
}

.octave-row[data-state='active'] b,
.octave-row[data-state='active'] em {
  color: var(--accent);
  font-weight: 700;
}

.octave-row[data-state='pending'] {
  border-left: 2px dashed var(--warning);
  padding-left: 6px;
}

.octave-row[data-state='pending'] em {
  color: var(--warning);
}

.spectral-meter {
  height: 4px;
  overflow: hidden;
  background: var(--border);
}

.spectral-meter i {
  display: block;
  height: 100%;
  background: var(--text-muted);
}

.octave-row[data-state='active'] .spectral-meter i { background: var(--accent); }
.octave-row[data-state='pending'] .spectral-meter i { background: var(--warning); }

.harmonic-bars {
  height: 136px;
  display: grid;
  grid-template-columns: repeat(5, minmax(38px, 1fr));
  align-items: end;
  gap: 7px;
  margin-top: 10px;
}

.harmonic-bars > div {
  min-width: 0;
  display: grid;
  grid-template-rows: 76px auto auto auto;
  justify-items: center;
  gap: 2px;
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 0.55rem;
}

.harmonic-bar {
  width: 18px;
  height: 76px;
  display: flex;
  align-items: end;
  border: 1px solid var(--border);
  background: repeating-linear-gradient(0deg, transparent 0 8px, var(--border) 8px 9px);
}

.harmonic-bar i {
  width: 100%;
  min-height: 1px;
  background: var(--accent);
}

.harmonic-bars small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.harmonic-bars[data-available='false'] {
  opacity: 0.45;
}

.noise-map {
  grid-column: 1 / -1;
  border-top: 1px solid var(--border);
}

.noise-map > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.noise-map header div {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.58rem;
}

.noise-map header span::before {
  content: '';
  width: 13px;
  display: inline-block;
  margin-right: 5px;
  border-top: 2px solid currentColor;
  vertical-align: middle;
}

.noise-signal { color: var(--accent); }
.noise-floor { color: var(--warning); }
.noise-floor::before { border-top-style: dashed !important; }
.noise-threshold { color: var(--text-muted); }
.noise-threshold::before { border-top-style: dotted !important; }

.noise-chart {
  position: relative;
  height: 112px;
  margin-top: 9px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-muted);
}

.noise-chart svg {
  width: 100%;
  height: 100%;
}

.noise-chart line {
  stroke: var(--border);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.noise-chart path {
  fill: none;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.noise-path-signal { stroke: var(--accent); }
.noise-path-floor { stroke: var(--warning); stroke-dasharray: 5 4; }
.noise-path-threshold { stroke: var(--text-muted); stroke-dasharray: 1 4; }

.noise-chart > p {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.noise-db {
  position: absolute;
  left: 4px;
  padding: 1px 3px;
  color: var(--text-dim);
  background: var(--surface-muted);
  font-family: var(--mono);
  font-size: 0.52rem;
}

.noise-db-top { top: 3px; }
.noise-db-middle { top: 50%; transform: translateY(-50%); }
.noise-db-bottom { bottom: 3px; }

@media (max-width: 760px) {
  .spectral-layout {
    grid-template-columns: 1fr;
  }

  .octave-ladder {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .noise-map {
    grid-column: auto;
  }
}

@media (max-width: 480px) {
  .octave-row {
    grid-template-columns: 38px 72px minmax(40px, 1fr) 32px;
  }

  .octave-row em {
    grid-column: 1 / -1;
    padding-bottom: 5px;
    text-align: left;
  }

  .noise-map > header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
