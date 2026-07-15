<script setup lang="ts">
import { Mic, Square } from '@lucide/vue';
import { computed } from 'vue';
import { useL10n } from '../../stores/l10n';
import type { DetectionFrame } from '../../types/frames';
import type { SessionStatus } from '../../session/sessionLifecycle';

const props = defineProps<{
  error: string | null;
  formatFreq: (frequency: number) => string;
  frame: DetectionFrame;
  hasDetection: boolean;
  isListening: boolean;
  sessionStatus: SessionStatus;
  targetFrequency: number;
  targetName: string;
}>();

defineEmits<{
  dismissError: [];
  toggleMicrophone: [];
}>();

const { t } = useL10n();
const offersStop = computed(() => (
  props.isListening
  || props.sessionStatus === 'starting'
  || props.sessionStatus === 'stopping'
));
const levelPercent = computed(() => Math.round(clamp(props.frame.level, 0, 1) * 100));
const confidencePercent = computed(() => (
  props.hasDetection ? Math.round(clamp(props.frame.confidence, 0, 1) * 100) : null
));
const centsPosition = computed(() => (
  props.hasDetection ? clamp(props.frame.cents + 50, 0, 100) : 50
));
const statusState = computed(() => {
  if (props.error || props.sessionStatus === 'error') return 'error';
  if (props.sessionStatus === 'starting' || props.sessionStatus === 'stopping') return 'pending';
  if (props.hasDetection) return props.frame.inTune ? 'in-tune' : 'detected';
  if (props.isListening) return 'listening';
  return 'idle';
});
const statusLabel = computed(() => {
  if (props.error || props.sessionStatus === 'error') return t('session.error');
  if (props.sessionStatus === 'starting') return t('requesting');
  if (props.sessionStatus === 'stopping') return t('stopping');
  if (props.hasDetection) return props.frame.inTune
    ? t('in.tune')
    : t('pipeline.live.detected');
  return props.isListening ? t('waiting.signal') : t('pipeline.live.idle');
});
const noteText = computed(() => (
  props.hasDetection && props.frame.note ? props.frame.note : '—'
));
const frequencyText = computed(() => formatNullableFrequency(props.frame.freq));
const rawFrequencyText = computed(() => formatNullableFrequency(props.frame.rawFreq));
const centsText = computed(() => {
  if (!props.hasDetection) return '—';
  const cents = Math.abs(props.frame.cents) < 0.05 ? 0 : props.frame.cents;
  return `${cents > 0 ? '+' : ''}${cents.toFixed(1)}¢`;
});
const rmsText = computed(() => (
  props.isListening ? Math.max(0, props.frame.rms).toFixed(4) : '—'
));
const inputKindText = computed(() => {
  if (!props.hasDetection) return '—';
  return props.frame.isPower ? t('pipeline.live.power') : t('pipeline.live.singleTone');
});

function formatNullableFrequency(frequency: number | null) {
  return frequency == null ? '—' : `${props.formatFreq(frequency)} Hz`;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
</script>

<template>
  <section class="pipeline-live card" aria-labelledby="pipeline-live-heading">
    <header class="pipeline-live-header">
      <div>
        <h3 id="pipeline-live-heading">{{ t('pipeline.live.title') }}</h3>
        <div class="pipeline-live-status" :data-state="statusState" aria-live="polite">
          <span aria-hidden="true"></span>
          {{ statusLabel }}
        </div>
      </div>
      <button
        type="button"
        class="btn pipeline-live-action"
        :class="offersStop ? 'btn-ghost' : 'btn-primary'"
        :disabled="sessionStatus === 'stopping'"
        @click="$emit('toggleMicrophone')"
      >
        <Square v-if="offersStop" :size="15" :stroke-width="2" aria-hidden="true" />
        <Mic v-else :size="16" :stroke-width="2" aria-hidden="true" />
        {{ offersStop ? t('stop.mic') : t('start.mic') }}
      </button>
    </header>

    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="$emit('dismissError')">{{ t('dismiss') }}</button>
    </div>

    <div class="pipeline-live-grid">
      <div class="pipeline-live-primary" :data-state="statusState">
        <span class="pipeline-live-label">{{ t('pipeline.live.output') }}</span>
        <div class="pipeline-live-note-row">
          <strong data-testid="pipeline-live-note">{{ noteText }}</strong>
          <span v-if="hasDetection && frame.isPower" class="pipeline-live-power">
            {{ t('pipeline.live.power') }}
          </span>
        </div>
        <span class="pipeline-live-target">
          {{ t('target') }}: {{ targetName }} · {{ formatFreq(targetFrequency) }} Hz
        </span>
      </div>

      <div class="pipeline-live-stat">
        <span class="pipeline-live-label">{{ t('pipeline.live.frequency') }}</span>
        <strong data-testid="pipeline-live-frequency">{{ frequencyText }}</strong>
        <span>{{ t('pipeline.live.raw') }}: {{ rawFrequencyText }}</span>
      </div>

      <div class="pipeline-live-stat">
        <span class="pipeline-live-label">{{ t('pipeline.live.cents') }}</span>
        <strong data-testid="pipeline-live-cents">{{ centsText }}</strong>
        <div class="pipeline-live-cents-track" aria-hidden="true">
          <span class="pipeline-live-cents-center"></span>
          <span
            v-if="hasDetection"
            class="pipeline-live-cents-marker"
            :class="{ 'pipeline-live-cents-marker-in-tune': frame.inTune && hasDetection }"
            :style="{ left: `${centsPosition}%` }"
          ></span>
        </div>
      </div>

      <div class="pipeline-live-stat">
        <span class="pipeline-live-label">{{ t('pipeline.live.confidence') }}</span>
        <strong data-testid="pipeline-live-confidence">
          {{ confidencePercent == null ? '—' : `${confidencePercent}%` }}
        </strong>
        <span>{{ inputKindText }}</span>
      </div>

      <div class="pipeline-live-stat pipeline-live-signal">
        <span class="pipeline-live-label">{{ t('pipeline.live.signal') }}</span>
        <strong data-testid="pipeline-live-level">
          {{ isListening ? `${levelPercent}%` : '—' }}
        </strong>
        <span>RMS {{ rmsText }}</span>
        <div class="pipeline-live-level-track" aria-hidden="true">
          <span :style="{ width: `${levelPercent}%` }"></span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pipeline-live {
  display: grid;
  gap: 13px;
  padding: 14px;
}

.pipeline-live-header {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pipeline-live-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 650;
}

.pipeline-live-status {
  min-height: 18px;
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 3px;
  color: var(--text-dim);
  font-size: 0.66rem;
  text-transform: uppercase;
}

.pipeline-live-status > span {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--text-dim);
}

.pipeline-live-status[data-state='pending'] > span,
.pipeline-live-status[data-state='detected'] > span {
  background: var(--warning);
}

.pipeline-live-status[data-state='listening'] > span {
  background: var(--text-muted);
}

.pipeline-live-status[data-state='in-tune'] > span {
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

.pipeline-live-status[data-state='error'] > span {
  background: var(--danger);
}

.pipeline-live-action {
  min-width: 194px;
  min-height: 36px;
  padding: 8px 12px;
  font-size: 0.7rem;
}

.pipeline-live-grid {
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) repeat(4, minmax(112px, 1fr));
  border-top: 1px solid var(--border);
}

.pipeline-live-primary,
.pipeline-live-stat {
  min-width: 0;
  min-height: 90px;
  padding: 12px 14px;
  border-right: 1px solid var(--border);
}

.pipeline-live-stat:last-child {
  border-right: 0;
}

.pipeline-live-primary,
.pipeline-live-stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
}

.pipeline-live-label {
  color: var(--text-dim);
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
}

.pipeline-live-note-row {
  min-height: 33px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pipeline-live-note-row strong {
  min-width: 0;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 1.65rem;
  line-height: 1;
  overflow-wrap: anywhere;
}

.pipeline-live-primary[data-state='in-tune'] .pipeline-live-note-row strong {
  color: var(--accent);
}

.pipeline-live-primary[data-state='detected'] .pipeline-live-note-row strong {
  color: var(--warning);
}

.pipeline-live-power {
  padding: 2px 5px;
  border: 1px solid color-mix(in srgb, var(--warning) 50%, var(--border));
  border-radius: 4px;
  color: var(--warning);
  font-size: 0.58rem;
  text-transform: uppercase;
}

.pipeline-live-target,
.pipeline-live-stat > span:not(.pipeline-live-label) {
  min-height: 16px;
  color: var(--text-dim);
  font-size: 0.64rem;
  line-height: 1.3;
}

.pipeline-live-stat > strong {
  min-height: 22px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.98rem;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.pipeline-live-cents-track,
.pipeline-live-level-track {
  position: relative;
  width: 100%;
  height: 4px;
  margin-top: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--border);
}

.pipeline-live-cents-center {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: var(--text-muted);
}

.pipeline-live-cents-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 2px;
  background: var(--warning);
  transform: translateX(-50%);
  transition: left 80ms linear;
}

.pipeline-live-cents-marker-in-tune {
  background: var(--accent);
}

.pipeline-live-level-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 60ms linear;
}

@media (max-width: 900px) {
  .pipeline-live-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pipeline-live-primary {
    grid-column: 1 / -1;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .pipeline-live-stat:nth-child(3) {
    border-right: 0;
  }

  .pipeline-live-stat:nth-child(2),
  .pipeline-live-stat:nth-child(3) {
    border-bottom: 1px solid var(--border);
  }
}

@media (max-width: 560px) {
  .pipeline-live-header {
    align-items: stretch;
    flex-direction: column;
  }

  .pipeline-live-action {
    width: 100%;
  }

  .pipeline-live-primary,
  .pipeline-live-stat {
    padding: 11px 10px;
  }
}
</style>
