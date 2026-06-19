<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../stores/l10n'
import type { CentsHistoryPoint } from '../composables/useCentsHistory'

const props = defineProps<{
  points: CentsHistoryPoint[]
}>()

const { t } = useL10n()

const polyline = computed(() => {
  if (props.points.length < 2) return ''
  const maxIndex = Math.max(1, props.points.length - 1)
  return props.points
    .map((point, index) => {
      const x = (index / maxIndex) * 100
      const y = 20 - (point.cents / 50) * 18
      return `${x.toFixed(2)},${Math.max(2, Math.min(38, y)).toFixed(2)}`
    })
    .join(' ')
})
</script>

<template>
  <div class="w-full max-w-[420px]">
    <div class="mb-1 flex items-center justify-between px-1 text-[10px] text-slate-500">
      <span>{{ t('history') }}</span>
      <span>{{ points.length ? `${points[points.length - 1].cents.toFixed(0)}¢` : '—' }}</span>
    </div>
    <svg viewBox="0 0 100 40" class="h-14 w-full rounded-lg border border-slate-800 bg-[#0f1319]" preserveAspectRatio="none">
      <line x1="0" y1="20" x2="100" y2="20" stroke="#334155" stroke-width="0.7" />
      <line x1="0" y1="11" x2="100" y2="11" stroke="#1f2937" stroke-width="0.5" />
      <line x1="0" y1="29" x2="100" y2="29" stroke="#1f2937" stroke-width="0.5" />
      <polyline
        v-if="polyline"
        :points="polyline"
        fill="none"
        stroke="#4ade80"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.4"
      />
    </svg>
  </div>
</template>
