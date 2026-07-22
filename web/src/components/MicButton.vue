<script setup lang="ts">
import { useL10n } from '../stores/l10n'

defineProps<{ isListening: boolean; isStarting?: boolean; isReady?: boolean }>()
defineEmits<{ (e: 'toggle'): void }>()

const { t } = useL10n()
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <button
      data-testid="mic-toggle"
      class="mic-btn focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#11151b] focus:ring-emerald-500"
      :class="{ listening: isListening, starting: isStarting }"
      :disabled="isStarting || isReady === false"
      @click="$emit('toggle')"
      :aria-label="t('toggle.microphone')"
    >
      <span v-if="isStarting" aria-hidden="true">…</span>
      <span v-else-if="isListening">■</span>
      <span v-else>🎤</span>
    </button>
    <div class="text-xs text-slate-400">
      {{ isReady === false ? t('loading.settings') : isStarting ? t('tap.to.request') : isListening ? t('tap.to.stop') : t('tap.to.start') }}
    </div>
  </div>
</template>
