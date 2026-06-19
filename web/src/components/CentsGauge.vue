<script setup lang="ts">
import type { DisplayMode } from '../utils/settingsStorage'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  cents: number
  mode: DisplayMode
  isInTune: boolean
  isDetected: boolean
}>()

const { t } = useL10n()
const clamped = (c: number) => Math.max(-50, Math.min(50, c))
const offset = (c: number) => (clamped(c) / 100) * 50   // -50..50 cents → -25..25 in % of half-width
const needleAngle = (c: number) => (clamped(c) / 50) * 42
const strobeShift = (c: number) => Math.max(-18, Math.min(18, c / 2))
</script>

<template>
  <div class="w-full max-w-[420px]">
    <div class="flex justify-between text-[10px] text-slate-500 mb-1 px-1 font-mono">
      <div>-50¢</div>
      <div :class="{ 'text-emerald-400 font-medium': isInTune }">{{ cents.toFixed(0) }}¢</div>
      <div>+50¢</div>
    </div>

    <svg v-if="mode === 'gauge'" viewBox="0 0 100 12" class="w-full h-3" preserveAspectRatio="none">
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

    <svg v-else-if="mode === 'needle'" viewBox="0 0 100 44" class="h-20 w-full" preserveAspectRatio="none">
      <path d="M12 36 Q50 4 88 36" fill="none" stroke="#1f2937" stroke-width="5" stroke-linecap="round" />
      <path d="M43 10 Q50 6 57 10" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" opacity="0.55" />
      <line x1="50" y1="36" x2="50" y2="8" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" :transform="`rotate(${needleAngle(cents)} 50 36)`" />
      <circle cx="50" cy="36" r="3.6" fill="#64748b" />
      <text x="12" y="42" fill="#64748b" font-size="5">-50</text>
      <text x="47" y="42" fill="#64748b" font-size="5">0</text>
      <text x="84" y="42" fill="#64748b" font-size="5">+50</text>
    </svg>

    <svg v-else viewBox="0 0 100 24" class="h-10 w-full rounded-lg border border-slate-800 bg-[#0f1319]" preserveAspectRatio="none">
      <defs>
        <pattern id="strobe-stripes" patternUnits="userSpaceOnUse" width="8" height="24" :patternTransform="`translate(${strobeShift(cents)} 0)`">
          <rect x="0" y="0" width="3" height="24" fill="#22c55e" :opacity="isInTune ? 0.75 : 0.35" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100" height="24" fill="url(#strobe-stripes)" />
      <rect x="49" y="0" width="2" height="24" fill="#e2e8f0" opacity="0.5" />
    </svg>

    <div class="flex justify-center mt-1.5">
      <div
        class="text-xs px-3 py-0.5 rounded-full inline-flex items-center gap-1.5"
        role="status"
        aria-live="polite"
        :class="isInTune ? 'bg-emerald-500/15 text-emerald-400' : isDetected ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'"
      >
        <span v-if="isInTune">{{ t('in.tune') }}</span>
        <span v-else-if="!isDetected">{{ t('waiting.signal') }}</span>
        <span v-else>
          {{ cents > 0 ? t('adjust.sharp') : t('adjust.flat') }}
        </span>
      </div>
    </div>
  </div>
</template>
