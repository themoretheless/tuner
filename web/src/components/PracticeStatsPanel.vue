<script setup lang="ts">
import type { PracticeHistoryEntry } from '../utils/settingsStorage'
import { useL10n } from '../stores/l10n'

defineProps<{
  exportStats: () => string
  history: PracticeHistoryEntry[]
  summary: {
    totalAttempts: number
    totalAccuracy: number
    todayAttempts: number
    todayAccuracy: number
    dailyStreak: number
  }
}>()

const emit = defineEmits<{
  (e: 'clear'): void
}>()

const { t } = useL10n()

function downloadStats(exportStats: () => string) {
  const blob = new Blob([exportStats()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `tuner-practice-${new Date().toISOString().slice(0, 10)}.json`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="card p-5 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-sm font-medium text-slate-200">{{ t('practice.title') }}</div>
        <div class="text-xs text-slate-500">{{ t('practice.history') }} {{ history.length }}</div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-[#0f1319] px-4 py-2 text-center">
        <div class="font-mono text-2xl text-emerald-300">{{ summary.dailyStreak }}</div>
        <div class="text-[10px] uppercase text-slate-500">{{ t('practice.streak') }}</div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div class="stat-tile">
        <div>{{ summary.todayAttempts }}</div>
        <span>{{ t('practice.today') }}</span>
      </div>
      <div class="stat-tile">
        <div>{{ summary.todayAccuracy }}%</div>
        <span>{{ t('practice.today.accuracy') }}</span>
      </div>
      <div class="stat-tile">
        <div>{{ summary.totalAttempts }}</div>
        <span>{{ t('practice.total') }}</span>
      </div>
      <div class="stat-tile">
        <div>{{ summary.totalAccuracy }}%</div>
        <span>{{ t('practice.total.accuracy') }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row">
      <button type="button" class="btn btn-ghost flex-1" :disabled="!history.length" @click="downloadStats(exportStats)">
        {{ t('practice.export') }}
      </button>
      <button type="button" class="btn btn-ghost flex-1 text-red-300 border-red-900/60" :disabled="!history.length" @click="emit('clear')">
        {{ t('practice.clear') }}
      </button>
    </div>
  </div>
</template>
