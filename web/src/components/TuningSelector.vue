<script setup lang="ts">
import type { Tuning } from '../utils/notes'
import { useL10n } from '../stores/l10n'

defineProps<{
  tunings: Tuning[]
  current: Tuning
}>()

const emit = defineEmits<{
  (e: 'change', t: Tuning): void
}>()

const { t } = useL10n()

function changeTuning(tunings: Tuning[], id: string) {
  const next = tunings.find((tuning) => tuning.id === id)
  if (next) emit('change', next)
}
</script>

<template>
  <div class="flex w-full min-w-0 items-center gap-2 text-sm">
    <span class="shrink-0 text-slate-500">{{ t('tuning') }}:</span>
    <select
      data-control="tuning"
      :value="current.id"
      class="min-w-0 flex-1 bg-[#1f2937] border border-slate-700 text-slate-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-emerald-600"
      @change="changeTuning(tunings, ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="t in tunings" :key="t.id" :value="t.id">
        {{ t.name }}
      </option>
    </select>
  </div>
</template>
