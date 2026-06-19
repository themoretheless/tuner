<script setup lang="ts">
defineProps<{
  display: string | null
  isDetected: boolean
  targetName: string
  targetFreq: number
  formatFreq: (n: number) => string
  confidence: number
}>()
</script>

<template>
  <div class="text-center pt-2 pb-1 select-none">
    <div v-if="isDetected" class="flex flex-col items-center">
      <span class="note-letter text-emerald-400">{{ display }}</span>
      <div class="text-sm text-slate-400 tracking-[2px] mt-0.5">DETECTED</div>
      <div class="mt-1 text-[10px] text-slate-500">
        conf {{ (confidence * 100).toFixed(0) }}%
      </div>
    </div>
    <div v-else class="text-6xl text-slate-700 font-light tracking-[-2px] py-6">—</div>

    <div class="mt-6">
      <div class="uppercase text-xs text-slate-500 tracking-[1.5px]">TARGET</div>
      <div class="text-4xl font-semibold tabular-nums mt-1 text-slate-100">
        {{ targetName }}
        <span class="text-lg align-super ml-0.5 text-slate-400">{{ formatFreq(targetFreq) }} Hz</span>
      </div>
    </div>
  </div>
</template>