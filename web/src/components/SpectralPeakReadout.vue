<script setup lang="ts">
import { computed } from 'vue'
import { getNoteDisplay } from '../generated/noteMath'
import type { SpectrumFrame } from '../types/frames'
import { frequencyToNote } from '../utils/notes'
import { spectralPeakFrequency } from '../utils/spectralPeak'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  frame: SpectrumFrame | null
  isListening: boolean
  a4: number
  formatFreq: (n: number) => string
}>()

const { t } = useL10n()

const peakFrequency = computed(() => {
  if (!props.isListening) return null
  return spectralPeakFrequency(props.frame)
})

const peakNoteDisplay = computed(() => {
  if (peakFrequency.value == null) return null
  return getNoteDisplay(frequencyToNote(peakFrequency.value, props.a4))
})
</script>

<template>
  <div
    class="flex items-center justify-center gap-2 text-[11px] font-mono tabular-nums text-slate-500"
    data-testid="spectral-peak-readout"
  >
    <span>{{ t('spectrum.readout') }}:</span>
    <template v-if="peakFrequency != null && peakNoteDisplay">
      <span class="text-slate-300">{{ formatFreq(peakFrequency) }} Hz</span>
      <span aria-hidden="true">·</span>
      <span class="text-slate-300">{{ peakNoteDisplay }}</span>
    </template>
    <span v-else>—</span>
  </div>
</template>
