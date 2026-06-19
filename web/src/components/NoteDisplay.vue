<script setup lang="ts">
import { useL10n } from '../stores/l10n'

defineProps<{
  display: string | null
  isDetected: boolean
  targetName: string
  targetFreq: number
  formatFreq: (n: number) => string
}>()

const { t } = useL10n()
</script>

<template>
  <div class="text-center pt-2 pb-1 select-none" aria-live="polite">
    <div v-if="isDetected" class="flex flex-col items-center">
      <span class="note-letter text-emerald-400">{{ display }}</span>
      <div class="text-sm text-slate-400 mt-0.5">{{ t('detected') }}</div>
    </div>
    <div v-else class="text-6xl text-slate-700 font-light py-6">—</div>

    <div class="mt-6">
      <div class="uppercase text-xs text-slate-500">{{ t('target') }}</div>
      <div class="text-4xl font-semibold tabular-nums mt-1 text-slate-100">
        {{ targetName }}
        <span class="text-lg align-super ml-0.5 text-slate-400">{{ formatFreq(targetFreq) }} Hz</span>
      </div>
    </div>
  </div>
</template>
