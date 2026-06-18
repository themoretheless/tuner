<script setup lang="ts">
const props = defineProps<{
  cents: number
  isInTune: boolean
}>()

const clamped = (c: number) => Math.max(-50, Math.min(50, c))
const offset = (c: number) => (clamped(c) / 100) * 50   // -50..50 cents → -25..25 in % of half-width
</script>

<template>
  <div class="w-full max-w-[420px]">
    <div class="flex justify-between text-[10px] text-slate-500 mb-1 px-1 font-mono">
      <div>-50¢</div>
      <div :class="{ 'text-emerald-400 font-medium': isInTune }">{{ cents.toFixed(0) }}¢</div>
      <div>+50¢</div>
    </div>

    <!-- SVG gauge: fully scalable, no magic px offsets -->
    <svg viewBox="0 0 100 12" class="w-full h-3" preserveAspectRatio="none">
      <!-- background track -->
      <rect x="0" y="4" width="100" height="4" rx="2" fill="#1f2937" />

      <!-- center target -->
      <rect x="48.5" y="2.5" width="3" height="7" rx="1" fill="#64748b" />

      <!-- in-tune zone -->
      <rect x="45" y="3" width="10" height="6" rx="2" fill="#22c55e" opacity="0.25" />

      <!-- needle -->
      <g :transform="`translate(${50 + offset(cents)}, 0)`">
        <rect x="-1.2" y="1" width="2.4" height="10" rx="1" :fill="isInTune ? '#22c55e' : '#f59e0b'" />
      </g>
    </svg>

    <div class="flex justify-center mt-1.5">
      <div
        class="text-xs px-3 py-0.5 rounded-full inline-flex items-center gap-1.5"
        :class="isInTune ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/10 text-amber-400'"
      >
        <span v-if="isInTune">IN TUNE</span>
        <span v-else>
          {{ cents > 0 ? 'SHARP — loosen' : 'FLAT — tighten' }}
        </span>
      </div>
    </div>
  </div>
</template>