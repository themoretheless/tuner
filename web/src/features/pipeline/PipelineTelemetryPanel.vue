<script setup lang="ts">
import { computed } from 'vue';
import type { PipelineDiagnosticSample } from '../../domain/pipelineDiagnostics';
import type { PipelineCandidateTelemetry } from '../../domain/pipelineTelemetry';
import { useL10n } from '../../stores/l10n';
import type { DetectionFrame } from '../../types/frames';

type FlowState = 'active' | 'held' | 'idle' | 'rejected';

const props = defineProps<{
  baseline: PipelineDiagnosticSample | null;
  formatFreq: (frequency: number) => string;
  frame: DetectionFrame;
  isListening: boolean;
  samples: PipelineDiagnosticSample[];
}>();

const { t } = useL10n();
const HISTORY_LIMIT = 90;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 150;
const CHART_PADDING = 12;
const CHART_CENTS = 100;

const decisionLabel = computed(() => props.isListening
  ? t(`pipeline.telemetry.decision.${props.frame.pipeline.decision}`)
  : t('pipeline.telemetry.idle'));
const arbitrationLabel = computed(() => t(
  `pipeline.telemetry.arbitration.${props.frame.pipeline.arbitration}`,
));
const decisionState = computed<FlowState>(() => {
  if (!props.isListening) return 'idle';
  if (props.frame.pipeline.decision === 'published') return 'active';
  if (props.frame.pipeline.decision === 'held') return 'held';
  if (props.frame.pipeline.decision === 'tracking-acquiring') return 'active';
  return 'rejected';
});
const flowSteps = computed(() => [
  {
    id: 'input',
    index: 'A',
    label: t('pipeline.stage.input'),
    state: inputState(),
  },
  {
    id: 'candidates',
    index: 'B',
    label: t('pipeline.stage.candidates'),
    state: candidateStageState(),
  },
  {
    id: 'stability',
    index: 'C',
    label: t('pipeline.stage.stability'),
    state: stabilityState(),
  },
  {
    id: 'output',
    index: 'D',
    label: t('pipeline.stage.output'),
    state: outputState(),
  },
]);
const candidates = computed(() => [
  {
    id: 'yin',
    label: 'YIN',
    value: props.frame.pipeline.yin,
    state: candidateState('yin'),
  },
  {
    id: 'secondary',
    label: 'MPM',
    value: props.frame.pipeline.secondary,
    state: candidateState('secondary'),
  },
  {
    id: 'selected',
    label: t('pipeline.telemetry.selected'),
    value: props.frame.pipeline.selected,
    state: props.frame.pipeline.selected ? 'active' : 'idle',
  },
]);
const chartSamples = computed(() => props.samples.slice(-HISTORY_LIMIT));
const rawPath = computed(() => historyPath('rawCents'));
const stablePath = computed(() => historyPath('stableCents'));
const uncertaintyPath = computed(() => uncertaintyAreaPath());
const baselineY = computed(() => props.baseline?.stableCents == null
  ? null
  : chartY(props.baseline.stableCents));
const chartGuides = [50, 0, -50].map((cents) => ({ cents, y: chartY(cents) }));
const hasHistory = computed(() => chartSamples.value.some((point) => (
  point.rawCents != null || point.stableCents != null
)));

function inputState(): FlowState {
  if (!props.isListening) return 'idle';
  return props.frame.pipeline.fixedGateOpen ? 'active' : 'rejected';
}

function candidateStageState(): FlowState {
  if (!props.isListening || !props.frame.pipeline.fixedGateOpen) return 'idle';
  return props.frame.pipeline.selected ? 'active' : 'rejected';
}

function stabilityState(): FlowState {
  if (!props.isListening) return 'idle';
  const decision = props.frame.pipeline.decision;
  if (decision === 'held') return 'held';
  if (decision === 'published' || decision === 'tracking-acquiring') return 'active';
  if (decision === 'adaptive-gate-rejected') return 'rejected';
  return props.frame.pipeline.selected ? 'active' : 'idle';
}

function outputState(): FlowState {
  if (!props.isListening) return 'idle';
  if (props.frame.pipeline.decision === 'published') return 'active';
  if (props.frame.pipeline.decision === 'held') return 'held';
  return 'idle';
}

function candidateState(id: 'yin' | 'secondary'): FlowState {
  if (!props.isListening) return 'idle';
  const value = props.frame.pipeline[id];
  if (!value) return 'idle';
  const arbitration = props.frame.pipeline.arbitration;
  if (arbitration === 'rejected-disagreement') return 'rejected';
  if (arbitration === 'fused') return 'active';
  if (id === 'yin' && ['yin-only', 'guided-yin', 'confidence-yin'].includes(arbitration)) {
    return 'active';
  }
  if (id === 'secondary' && [
    'secondary-only',
    'guided-secondary',
    'confidence-secondary',
  ].includes(arbitration)) return 'active';
  return 'idle';
}

function candidateFrequency(candidate: PipelineCandidateTelemetry | null) {
  return candidate ? `${props.formatFreq(candidate.frequency)} Hz` : '\u2014';
}

function candidateConfidence(candidate: PipelineCandidateTelemetry | null) {
  return candidate ? `${Math.round(candidate.confidence * 100)}%` : '\u2014';
}

function confidenceWidth(candidate: PipelineCandidateTelemetry | null) {
  return `${Math.round((candidate?.confidence ?? 0) * 100)}%`;
}

function historyPath(key: 'rawCents' | 'stableCents') {
  const points = chartSamples.value;
  if (!points.length) return '';
  const step = CHART_WIDTH / (HISTORY_LIMIT - 1);
  let path = '';
  let drawing = false;
  for (let index = 0; index < points.length; index += 1) {
    const cents = points[index][key];
    if (cents == null) {
      drawing = false;
      continue;
    }
    const x = CHART_WIDTH - (points.length - 1 - index) * step;
    const y = chartY(cents);
    path += `${drawing ? ' L' : ' M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    drawing = true;
  }
  return path;
}

function uncertaintyAreaPath() {
  const points = chartSamples.value;
  const segments: Array<Array<{ cents: number; uncertainty: number; x: number }>> = [];
  let segment: Array<{ cents: number; uncertainty: number; x: number }> = [];
  for (let index = 0; index < points.length; index += 1) {
    const cents = points[index].rawCents;
    if (cents == null) {
      if (segment.length) segments.push(segment);
      segment = [];
      continue;
    }
    segment.push({
      cents,
      uncertainty: points[index].uncertaintyCents,
      x: CHART_WIDTH - (points.length - 1 - index) * (CHART_WIDTH / (HISTORY_LIMIT - 1)),
    });
  }
  if (segment.length) segments.push(segment);
  return segments.map((values) => {
    const upper = values.map((point, index) => (
      `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${chartY(point.cents + point.uncertainty).toFixed(1)}`
    )).join(' ');
    const lower = [...values].reverse().map((point) => (
      `L ${point.x.toFixed(1)} ${chartY(point.cents - point.uncertainty).toFixed(1)}`
    )).join(' ');
    return `${upper} ${lower} Z`;
  }).join(' ');
}

function chartY(cents: number) {
  const bounded = Math.max(-CHART_CENTS, Math.min(CHART_CENTS, cents));
  const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  return CHART_PADDING + ((CHART_CENTS - bounded) / (CHART_CENTS * 2)) * usableHeight;
}
</script>

<template>
  <section class="pipeline-telemetry card" data-testid="pipeline-telemetry" aria-labelledby="pipeline-telemetry-title">
    <header class="pipeline-telemetry-header">
      <div>
        <h3 id="pipeline-telemetry-title">{{ t('pipeline.telemetry.title') }}</h3>
        <span>{{ arbitrationLabel }}</span>
      </div>
      <strong
        class="pipeline-decision"
        data-testid="pipeline-decision"
        :data-decision="frame.pipeline.decision"
        :data-state="decisionState"
        aria-live="polite"
      >
        {{ decisionLabel }}
      </strong>
    </header>

    <div class="pipeline-live-flow" :aria-label="t('pipeline.telemetry.flow')">
      <template v-for="(step, index) in flowSteps" :key="step.id">
        <div
          class="pipeline-live-step"
          :data-testid="`pipeline-flow-${step.id}`"
          :data-state="step.state"
          :aria-label="`${step.label}: ${t(`pipeline.telemetry.state.${step.state}`)}`"
        >
          <span class="pipeline-live-marker">{{ step.index }}</span>
          <span>{{ step.label }}</span>
        </div>
        <span
          v-if="index < flowSteps.length - 1"
          class="pipeline-live-connector"
          :data-state="flowSteps[index + 1].state"
          aria-hidden="true"
        ></span>
      </template>
    </div>

    <div class="pipeline-telemetry-grid">
      <section class="pipeline-candidates" aria-labelledby="pipeline-candidates-title">
        <h4 id="pipeline-candidates-title">{{ t('pipeline.telemetry.candidates') }}</h4>
        <div class="pipeline-candidate-table">
          <div
            v-for="candidate in candidates"
            :key="candidate.id"
            class="pipeline-candidate-row"
            :data-testid="`pipeline-candidate-${candidate.id}`"
            :data-present="candidate.value != null"
            :data-state="candidate.state"
          >
            <span class="pipeline-candidate-source">
              <i aria-hidden="true"></i>
              {{ candidate.label }}
            </span>
            <strong>{{ candidateFrequency(candidate.value) }}</strong>
            <span class="pipeline-candidate-confidence">
              <span class="pipeline-confidence-track" aria-hidden="true">
                <i :style="{ width: confidenceWidth(candidate.value) }"></i>
              </span>
              {{ candidateConfidence(candidate.value) }}
            </span>
          </div>
        </div>
      </section>

      <section class="pipeline-history" data-testid="pipeline-history" aria-labelledby="pipeline-history-title">
        <header>
          <h4 id="pipeline-history-title">{{ t('pipeline.telemetry.history') }}</h4>
          <div class="pipeline-history-legend" aria-hidden="true">
            <span class="pipeline-legend-uncertainty">{{ t('pipeline.diagnostics.uncertainty') }}</span>
            <span class="pipeline-legend-raw">{{ t('pipeline.telemetry.raw') }}</span>
            <span class="pipeline-legend-stable">{{ t('pipeline.telemetry.stable') }}</span>
          </div>
        </header>
        <div class="pipeline-chart">
          <svg
            :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
            role="img"
            :aria-label="t('pipeline.telemetry.history')"
            preserveAspectRatio="none"
          >
            <g class="pipeline-chart-grid">
              <line
                v-for="guide in chartGuides"
                :key="guide.cents"
                x1="0"
                :y1="guide.y"
                :x2="CHART_WIDTH"
                :y2="guide.y"
              />
            </g>
            <path
              v-if="uncertaintyPath"
              data-testid="pipeline-chart-uncertainty"
              class="pipeline-chart-uncertainty"
              :d="uncertaintyPath"
            />
            <path v-if="stablePath" data-testid="pipeline-chart-stable" class="pipeline-chart-stable" :d="stablePath" />
            <path v-if="rawPath" data-testid="pipeline-chart-raw" class="pipeline-chart-raw" :d="rawPath" />
            <line
              v-if="baselineY != null"
              data-testid="pipeline-chart-baseline"
              class="pipeline-chart-baseline"
              x1="0"
              :y1="baselineY"
              :x2="CHART_WIDTH"
              :y2="baselineY"
            />
            <text
              v-if="baselineY != null"
              class="pipeline-chart-baseline-label"
              :x="CHART_WIDTH - 16"
              :y="Math.max(10, baselineY - 5)"
            >B</text>
          </svg>
          <span class="pipeline-chart-label pipeline-chart-label-high">+50</span>
          <span class="pipeline-chart-label pipeline-chart-label-center">0</span>
          <span class="pipeline-chart-label pipeline-chart-label-low">-50</span>
          <span v-if="!hasHistory" class="pipeline-chart-empty">
            {{ t('pipeline.telemetry.history.empty') }}
          </span>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.pipeline-telemetry {
  display: grid;
  gap: 0;
  overflow: hidden;
}

.pipeline-telemetry-header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.pipeline-telemetry-header > div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.pipeline-telemetry h3,
.pipeline-telemetry h4 {
  margin: 0;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 680;
}

.pipeline-telemetry-header span {
  overflow: hidden;
  color: var(--text-dim);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pipeline-decision {
  flex: 0 0 auto;
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  color: var(--text-muted);
  background: var(--surface-muted);
  font-size: 0.65rem;
  font-weight: 650;
}

.pipeline-decision[data-state='active'] {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--border));
  color: var(--accent);
}

.pipeline-decision[data-state='held'] {
  border-color: color-mix(in srgb, var(--warning) 58%, var(--border));
  color: var(--warning);
}

.pipeline-decision[data-state='rejected'] {
  border-color: color-mix(in srgb, var(--danger) 48%, var(--border));
  color: var(--danger);
}

.pipeline-live-flow {
  display: grid;
  grid-template-columns: auto minmax(24px, 1fr) auto minmax(24px, 1fr) auto minmax(24px, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 14px;
  border-bottom: 1px solid var(--border);
}

.pipeline-live-step {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-dim);
  font-size: 0.68rem;
  font-weight: 620;
}

.pipeline-live-marker {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  color: var(--text-dim);
  background: var(--surface);
  font-family: var(--mono);
  font-size: 0.62rem;
}

.pipeline-live-step[data-state='active'] {
  color: var(--text);
}

.pipeline-live-step[data-state='active'] .pipeline-live-marker {
  border-color: var(--accent);
  color: var(--accent);
}

.pipeline-live-step[data-state='held'] .pipeline-live-marker {
  border-color: var(--warning);
  border-radius: 4px;
  color: var(--warning);
}

.pipeline-live-step[data-state='rejected'] .pipeline-live-marker {
  border-color: var(--danger);
  color: var(--danger);
}

.pipeline-live-connector {
  position: relative;
  height: 10px;
}

.pipeline-live-connector::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 4px;
  left: 0;
  height: 1px;
  background: var(--border-strong);
}

.pipeline-live-connector::after {
  content: '';
  position: absolute;
  top: calc(50% - 3px);
  right: 0;
  width: 6px;
  height: 6px;
  border-top: 1px solid var(--border-strong);
  border-right: 1px solid var(--border-strong);
  transform: rotate(45deg);
}

.pipeline-live-connector[data-state='active']::before {
  background: var(--accent);
  animation: pipeline-flow-pulse 900ms ease-in-out infinite alternate;
}

.pipeline-live-connector[data-state='active']::after {
  border-color: var(--accent);
}

.pipeline-live-connector[data-state='held']::before {
  background: var(--warning);
}

.pipeline-live-connector[data-state='held']::after {
  border-color: var(--warning);
}

.pipeline-live-connector[data-state='rejected']::before {
  background: var(--danger);
}

.pipeline-live-connector[data-state='rejected']::after {
  border-color: var(--danger);
}

@keyframes pipeline-flow-pulse {
  from { opacity: 0.48; }
  to { opacity: 1; }
}

.pipeline-telemetry-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.3fr);
}

.pipeline-candidates,
.pipeline-history {
  min-width: 0;
  padding: 14px;
}

.pipeline-candidates {
  border-right: 1px solid var(--border);
}

.pipeline-candidate-table {
  display: grid;
  margin-top: 10px;
}

.pipeline-candidate-row {
  min-height: 40px;
  display: grid;
  grid-template-columns: minmax(72px, 0.8fr) minmax(84px, 1fr) minmax(100px, 1.1fr);
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.68rem;
}

.pipeline-candidate-row:last-child {
  border-bottom: 1px solid var(--border);
}

.pipeline-candidate-row strong {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 600;
}

.pipeline-candidate-source {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  font-weight: 650;
}

.pipeline-candidate-source i {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border: 1px solid var(--text-dim);
  border-radius: 50%;
}

.pipeline-candidate-row[data-state='active'] .pipeline-candidate-source i {
  border-color: var(--accent);
  background: var(--accent);
}

.pipeline-candidate-row[data-state='rejected'] .pipeline-candidate-source i {
  border-color: var(--danger);
  border-radius: 1px;
  background: var(--danger);
  transform: rotate(45deg);
}

.pipeline-candidate-confidence {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(42px, 1fr) 34px;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  text-align: right;
}

.pipeline-confidence-track {
  height: 3px;
  overflow: hidden;
  background: var(--border);
}

.pipeline-confidence-track i {
  display: block;
  height: 100%;
  background: var(--text-dim);
}

.pipeline-candidate-row[data-state='active'] .pipeline-confidence-track i {
  background: var(--accent);
}

.pipeline-candidate-row[data-state='rejected'] .pipeline-confidence-track i {
  background: var(--danger);
}

.pipeline-history > header {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pipeline-history-legend {
  display: flex;
  gap: 12px;
  color: var(--text-dim);
  font-size: 0.62rem;
}

.pipeline-history-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pipeline-history-legend span::before {
  content: '';
  width: 14px;
  height: 0;
  border-top: 2px solid currentColor;
}

.pipeline-legend-raw {
  color: var(--warning);
}

.pipeline-legend-raw::before {
  border-top-style: dashed !important;
}

.pipeline-legend-stable {
  color: var(--accent);
}

.pipeline-legend-uncertainty {
  color: var(--text-dim);
}

.pipeline-legend-uncertainty::before {
  height: 5px !important;
  border: 1px dotted currentColor !important;
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}

.pipeline-chart {
  position: relative;
  height: 142px;
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-muted);
}

.pipeline-chart svg {
  width: 100%;
  height: 100%;
}

.pipeline-chart-grid line {
  stroke: var(--border);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.pipeline-chart-raw,
.pipeline-chart-stable {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.pipeline-chart-uncertainty {
  fill: color-mix(in srgb, var(--warning) 12%, transparent);
  stroke: color-mix(in srgb, var(--warning) 38%, transparent);
  stroke-dasharray: 1 4;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.pipeline-chart-baseline {
  stroke: var(--text);
  stroke-dasharray: 2 5;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.pipeline-chart-baseline-label {
  fill: var(--text);
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 700;
}

.pipeline-chart-raw {
  stroke: var(--warning);
  stroke-dasharray: 4 4;
}

.pipeline-chart-stable {
  stroke: var(--accent);
}

.pipeline-chart-label {
  position: absolute;
  left: 5px;
  padding: 1px 3px;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--surface-muted) 86%, transparent);
  font-family: var(--mono);
  font-size: 0.55rem;
  line-height: 1;
}

.pipeline-chart-label-high {
  top: 24%;
}

.pipeline-chart-label-center {
  top: 50%;
  transform: translateY(-50%);
}

.pipeline-chart-label-low {
  bottom: 24%;
}

.pipeline-chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-size: 0.68rem;
}

@media (max-width: 760px) {
  .pipeline-telemetry-grid {
    grid-template-columns: 1fr;
  }

  .pipeline-candidates {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
}

@media (max-width: 560px) {
  .pipeline-telemetry-header {
    align-items: flex-start;
  }

  .pipeline-decision {
    max-width: 52%;
    text-align: right;
  }

  .pipeline-live-flow {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .pipeline-live-step {
    min-height: 34px;
  }

  .pipeline-live-connector {
    width: 24px;
    height: 20px;
  }

  .pipeline-live-connector::before {
    top: 0;
    bottom: 4px;
    left: 50%;
    width: 1px;
    height: auto;
  }

  .pipeline-live-connector::after {
    top: auto;
    right: auto;
    bottom: 1px;
    left: calc(50% - 3px);
    transform: rotate(135deg);
  }

  .pipeline-candidate-row {
    grid-template-columns: minmax(64px, 0.7fr) minmax(78px, 1fr) minmax(90px, 1fr);
    gap: 7px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pipeline-live-connector[data-state='active']::before {
    animation: none;
  }
}
</style>
