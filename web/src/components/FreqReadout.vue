<script setup lang="ts">
import { useL10n } from '../stores/l10n'

defineProps<{
  detected: number | null
  target: number
  formatFreq: (n: number) => string
}>()

const { t } = useL10n()
</script>

<template>
  <div class="flex items-center gap-6 text-sm tabular-nums font-mono text-slate-400">
    <div>
      {{ t('detected') }}<br>
      <span class="text-xl text-slate-200">{{ detected ? formatFreq(detected) : '—' }}</span> Hz
    </div>
    <div class="h-3 w-px bg-slate-800"></div>
    <div>
      {{ t('target') }}<br>
      <span class="text-xl text-slate-200">{{ formatFreq(target) }}</span> Hz
    </div>
  </div>
</template>
