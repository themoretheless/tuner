<script setup lang="ts">
import type { Note } from '../utils/notes'

defineProps<{
  stringsWithCents: Array<Note & { cents: number | null }>
}>()
</script>

<template>
  <div class="w-full text-xs text-slate-400 mt-2">
    <div class="mb-1">Per string:</div>
    <div class="flex gap-2 flex-wrap">
      <span
        v-for="(s, i) in stringsWithCents"
        :key="i"
        class="px-1.5 py-0.5 rounded bg-[#1f2937]"
      >
        {{ s.name }}{{ s.octave }}:
        <span :class="Math.abs(s.cents || 0) < 5 ? 'text-emerald-400' : ''">
          {{ s.cents !== null ? s.cents.toFixed(0) + '¢' : '—' }}
        </span>
      </span>
    </div>
  </div>
</template>
