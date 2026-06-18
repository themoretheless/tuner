<script setup lang="ts">
import { useL10n } from '../stores/l10n'

defineProps<{ level: number; active: boolean }>()

const { t } = useL10n()
</script>

<template>
  <div v-if="active" class="w-full max-w-[280px]">
    <div class="flex justify-between text-[10px] mb-1 text-slate-500">
      <div>{{ t('input.level') }}</div>
      <div class="font-mono">{{ (level * 100).toFixed(0) }}%</div>
    </div>
    <div class="h-1 bg-[#1f2937] rounded-full overflow-hidden">
      <div class="level h-full" :style="{ width: Math.min(100, level * 100) + '%' }"></div>
    </div>
  </div>
  <div v-else class="h-1" />
</template>