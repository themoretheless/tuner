<script setup lang="ts">
defineProps<{ isListening: boolean }>()
defineEmits<{ (e: 'toggle'): void }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <button
      class="mic-btn focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#11151b] focus:ring-emerald-500"
      :class="{ listening: isListening }"
      @click="$emit('toggle')"
      aria-label="Toggle microphone"
    >
      <span v-if="isListening">■</span>
      <span v-else>🎤</span>
    </button>
    <div class="text-xs text-slate-400 tracking-widest">TAP TO {{ isListening ? 'STOP' : 'START' }}</div>
  </div>
</template>