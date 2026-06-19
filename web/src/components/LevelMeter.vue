<script setup lang="ts">
import { useL10n } from '../stores/l10n'

defineProps<{ level: number; active: boolean }>()

const { t } = useL10n()
</script>

<template>
  <div v-if="active" class="w-full">
    <div class="flex justify-between text-[10px] mb-1 text-slate-500">
      <div>{{ t('input.level') }}</div>
      <div class="font-mono">{{ (level * 100).toFixed(0) }}%</div>
    </div>
    <div class="h-1 bg-[#1f2937] rounded-full relative overflow-hidden">
      <!-- Solid green up to 80% -->
      <div
        class="absolute top-0 left-0 h-full bg-[#22c55e] transition-[width] duration-[60ms] ease-linear"
        :class="{ 'rounded-r-full': level <= 0.8 }"
        :style="{ width: Math.min(80, level * 100) + '%' }"
      ></div>
      <!-- Gradient from 80% onward -->
      <div
        v-if="level > 0.8"
        class="absolute top-0 h-full transition-[width] duration-[60ms] ease-linear rounded-r-full"
        :style="{
          left: '80%',
          width: (level * 100 - 80) + '%',
          background: 'linear-gradient(to right, #eab308, #ef4444)'
        }"
      ></div>
    </div>
  </div>
  <div v-else class="h-1" />
</template>