<script setup lang="ts">
import type { Note } from '../utils/notes'

defineProps<{
  strings: Note[]
  selected: Note | null
  getNoteDisplay: (n: Note) => string
  formatFreq: (n: number) => string
}>()

const emit = defineEmits<{
  (e: 'toggle', note: Note): void
}>()
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3 px-1">
      <div class="text-xs text-emerald-400/80">
        {{ selected ? 'MANUAL' : 'AUTO DETECT' }}
      </div>
      <button
        v-if="selected"
        class="text-xs btn btn-ghost py-1 px-3 text-emerald-400"
        @click="emit('toggle', selected)"
      >
        AUTO
      </button>
    </div>

    <div class="grid grid-cols-6 gap-2">
      <button
        v-for="str in strings"
        :key="str.frequency"
        class="string-btn"
        :class="{ active: selected && Math.abs(selected.frequency - str.frequency) < 0.1 }"
        @click="emit('toggle', str)"
      >
        {{ getNoteDisplay(str) }}
        <div class="text-[10px] text-slate-500">{{ formatFreq(str.frequency) }}</div>
      </button>
    </div>
  </div>
</template>