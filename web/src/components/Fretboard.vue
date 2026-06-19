<script setup lang="ts">
import { computed } from 'vue'
import type { Note } from '../utils/notes'

const props = defineProps<{
  strings: Note[]
  targetFreq: number
  selectedString?: Note | null
}>()

const emit = defineEmits<{
  (e: 'select', string: Note): void
}>()

const NUM_FRETS = 12

const highlightedFrets = computed(() => {
  return props.strings.map((s) => {
    if (!props.targetFreq) return -1
    const ratio = props.targetFreq / s.frequency
    const semitones = 12 * Math.log2(ratio)
    return Math.round(semitones)
  })
})
</script>

<template>
  <div class="w-full bg-[#1f2937] rounded-lg p-2 text-xs">
    <div class="mb-1 text-slate-400">Guitar Fretboard (target highlight)</div>
    <svg width="100%" height="90" viewBox="0 0 520 90" class="mx-auto" preserveAspectRatio="xMidYMid meet">
      <!-- Neck background -->
      <rect x="0" y="10" width="520" height="70" fill="#3f2a1f" rx="4" />

      <!-- Frets -->
      <g v-for="f in NUM_FRETS" :key="f">
        <line
          :x1="30 + (f * 38)"
          y1="10"
          :x2="30 + (f * 38)"
          y2="80"
          stroke="#d1d5db"
          stroke-width="2"
        />
        <!-- Fret number -->
        <text
          :x="30 + (f * 38) + 10"
          y="95"
          font-size="9"
          fill="#9ca3af"
        >{{ f }}</text>
      </g>

      <!-- Nut -->
      <line x1="20" y1="10" x2="20" y2="80" stroke="#111827" stroke-width="6" />

      <!-- Strings -->
      <g v-for="(s, i) in strings" :key="i" @click="emit('select', s)" style="cursor: pointer;">
        <line
          x1="20"
          :y1="15 + i * 12"
          x2="510"
          :y2="15 + i * 12"
          stroke="#d1d5db"
          :stroke-width="1.5 + i * 0.3"
        />
        <!-- Highlight on fret -->
        <circle
          v-if="highlightedFrets[i] >= 0 && highlightedFrets[i] <= NUM_FRETS"
          :cx="30 + (highlightedFrets[i] * 38)"
          :cy="15 + i * 12"
          r="6"
          fill="#22c55e"
          :opacity="selectedString && selectedString.frequency === s.frequency ? 1 : 0.6"
        />
        <text
          :x="8"
          :y="19 + i * 12"
          font-size="9"
          fill="#e5e7eb"
        >{{ s.name }}</text>
      </g>
    </svg>
  </div>
</template>
