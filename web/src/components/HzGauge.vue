<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  detected: number | null
  target: number
  isInTune: boolean
}>()

// Same musical width as the ±50-cent scale, expressed in Hz around the
// target: ±50 cents is a factor of 2^(50/1200), so the Hz half-range grows
// with the target (≈2.4 Hz at E2, ≈9.6 Hz at E4) and the needle position
// always matches the cents gauge above it.
const halfRange = computed(() => props.target * (Math.pow(2, 50 / 1200) - 1))

const deviation = computed(() => (
  props.detected == null ? null : props.detected - props.target
))

// Low targets get a tight Hz window, so show finer precision there.
const digits = computed(() => (halfRange.value < 5 ? 2 : 1))

const offset = computed(() => {
  if (deviation.value == null) return 0
  const clamped = Math.max(-halfRange.value, Math.min(halfRange.value, deviation.value))
  return (clamped / halfRange.value) * 50
})

function formatHz(value: number, signed = false) {
  const text = value.toFixed(digits.value)
  return signed && value >= 0 ? `+${text}` : text
}
</script>

<template>
  <div class="w-full max-w-[420px]" data-testid="hz-gauge">
    <div class="flex justify-between text-[10px] text-slate-500 mb-1 px-1 font-mono">
      <div>-{{ formatHz(halfRange) }} Hz</div>
      <div :class="{ 'text-emerald-400 font-medium': isInTune }">
        {{ deviation == null ? '—' : `${formatHz(deviation, true)} Hz` }}
      </div>
      <div>+{{ formatHz(halfRange) }} Hz</div>
    </div>

    <svg viewBox="0 0 100 12" class="w-full h-3" preserveAspectRatio="none">
      <!-- background track -->
      <rect x="0" y="4" width="100" height="4" rx="2" fill="var(--border)" />

      <!-- center target -->
      <rect x="48.5" y="2.5" width="3" height="7" rx="1" fill="var(--text-dim)" />

      <!-- in-tune zone -->
      <rect x="45" y="3" width="10" height="6" rx="2" fill="var(--accent)" opacity="0.25" />

      <!-- needle -->
      <g v-if="deviation != null" :transform="`translate(${50 + offset}, 0)`">
        <rect x="-1.2" y="1" width="2.4" height="10" rx="1" :fill="isInTune ? 'var(--accent)' : 'var(--warning)'" />
      </g>
    </svg>
  </div>
</template>
