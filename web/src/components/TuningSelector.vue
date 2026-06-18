<script setup lang="ts">
import type { Tuning } from '../utils/notes'

defineProps<{
  tunings: Tuning[]
  current: Tuning
}>()

defineEmits<{
  (e: 'change', t: Tuning): void
}>()
</script>

<template>
  <div class="flex items-center gap-2 text-sm">
    <span class="text-slate-500">Tuning:</span>
    <select
      :value="current.id"
      class="bg-[#1f2937] border border-slate-700 text-slate-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-emerald-600"
      @change="$emit('change', tunings.find(t => t.id === ($event.target as HTMLSelectElement).value)!)"
    >
      <option v-for="t in tunings" :key="t.id" :value="t.id">
        {{ t.name }}
      </option>
    </select>
  </div>
</template>