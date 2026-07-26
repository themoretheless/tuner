<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  confidence?: number
  display: string | null
  formatFreq: (n: number) => string
  isDetected: boolean
  isPowerChord?: boolean
  targetFreq: number
  targetName: string
}>()

const { t } = useL10n()
const confidencePercent = computed(() => Math.round(Math.max(0, Math.min(1, props.confidence ?? 0)) * 100))
// NOTE: no live region here — the single throttled announcer lives in
// LiveTunerView so note/state changes are spoken exactly once.

// Non-breaking space: keeps placeholder rows at their normal line height (a
// plain space collapses and the row would contribute zero height).
const NBSP = ' '
</script>

<template>
  <div class="text-center pt-2 pb-1 select-none">
    <!-- Both states render the same three rows so detection flickering on
         and off never changes the block height and shifts the layout below. -->
    <div class="flex flex-col items-center">
      <span
        v-if="isDetected"
        data-testid="detected-note"
        class="note-letter text-emerald-400"
      >{{ display }}</span>
      <span v-else class="note-letter text-slate-700">—</span>
      <div class="text-sm text-slate-400 mt-0.5">{{ isDetected ? t('detected') : NBSP }}</div>
      <div class="mt-1 text-[10px] text-slate-500">
        <template v-if="isDetected && (confidence != null || isPowerChord)">
          <span v-if="confidence != null" data-testid="note-confidence">
            {{ t('confidence.short') }} {{ confidencePercent }}%
          </span>
          <span v-if="isPowerChord" class="text-amber-400 ml-1">
            {{ t('power.short') }}
          </span>
        </template>
        <template v-else>&nbsp;</template>
      </div>
    </div>

    <div class="mt-6">
      <div class="uppercase text-xs text-slate-500">{{ t('target') }}</div>
      <div class="text-4xl font-semibold tabular-nums mt-1 text-slate-100">
        {{ targetName }}
        <span class="text-lg align-super ml-0.5 text-slate-400">{{ formatFreq(targetFreq) }} Hz</span>
      </div>
    </div>
  </div>
</template>
