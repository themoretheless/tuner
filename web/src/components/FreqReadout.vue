<script setup lang="ts">
defineProps<{
  detected: number | null
  target: number
  formatFreq: (n: number) => string
}>()
</script>

<template>
  <div class="flex items-center gap-6 text-sm tabular-nums font-mono text-slate-400">
    <div>
      DETECTED<br>
      <span class="text-xl text-slate-200">{{ detected ? formatFreq(detected) : '—' }}</span> Hz
    </div>
    <div class="h-3 w-px bg-slate-800"></div>
    <div>
      TARGET<br>
      <span class="text-xl text-slate-200">{{ formatFreq(target) }}</span> Hz
    </div>
  </div>
</template>