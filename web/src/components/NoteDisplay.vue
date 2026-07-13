<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  confidence?: number
  detectedFreq: number | null
  display: string | null
  formatFreq: (n: number) => string
  isDetected: boolean
  isPowerChord?: boolean
  targetFreq: number
  targetName: string
}>()

const { t } = useL10n()
const confidencePercent = computed(() => Math.round(Math.max(0, Math.min(1, props.confidence ?? 0)) * 100))

</script>

<template>
  <div
    class="tuner-note select-none"
    aria-live="polite"
    :data-confidence="confidencePercent"
  >
    <div class="tuner-note-kicker">{{ isDetected ? t('detected') : t('target') }}</div>
    <div
      :data-testid="isDetected ? 'detected-note' : 'target-note'"
      class="note-letter"
      :class="{ detected: isDetected }"
    >
      {{ isDetected ? display : targetName }}
    </div>
    <div class="tuner-primary-frequency tabular-nums">
      {{ formatFreq(isDetected && detectedFreq ? detectedFreq : targetFreq) }} Hz
    </div>
    <div class="tuner-note-meta">
      <template v-if="isDetected">
        <span>{{ t('target') }} {{ targetName }} · {{ formatFreq(targetFreq) }} Hz</span>
        <span v-if="isPowerChord" class="power-indicator">{{ t('power.chord') }}</span>
      </template>
    </div>
  </div>
</template>
