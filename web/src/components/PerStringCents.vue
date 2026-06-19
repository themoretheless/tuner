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
      <div
        v-for="(s, i) in stringsWithCents"
        :key="i"
        class="flex items-center gap-1 px-1 py-0.5 rounded bg-[#1f2937]"
      >
        <span class="font-mono">{{ s.name }}{{ s.octave }}</span>
        <div class="w-12 h-2 bg-[#1f2937] rounded overflow-hidden border border-slate-700">
          <div
            class="h-full transition-all"
            :style="{
              width: s.cents !== null ? Math.min(100, Math.max(0, (s.cents + 50) / 1)) + '%' : '0%',
              background: s.cents !== null && Math.abs(s.cents) < 5 ? '#22c55e' : '#ef4444'
            }"
          ></div>
        </div>
        <span :class="Math.abs(s.cents || 0) < 5 ? 'text-emerald-400' : 'text-red-400'">
          {{ s.cents !== null ? s.cents.toFixed(0) + '¢' : '—' }}
        </span>
      </div>
    </div>
  </div>
</template>
