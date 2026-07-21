<script setup lang="ts">
import { computed } from 'vue';
import { useL10n } from '../stores/l10n';
import type { SessionStatus } from '../session/sessionLifecycle';

const props = defineProps<{ isListening: boolean; status: SessionStatus }>();
defineEmits<{ (e: 'toggle'): void }>();

const { t } = useL10n();
const offersStop = computed(() => props.isListening || props.status === 'starting');
const actionHint = computed(() => {
  if (props.status === 'starting') return t('requesting');
  if (props.status === 'stopping') return t('stopping');
  return props.isListening ? t('tap.to.stop') : t('tap.to.start');
});
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <button
      data-testid="mic-toggle"
      class="mic-btn focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#11151b] focus:ring-emerald-500"
      :class="{ listening: isListening, pending: status === 'starting' || status === 'stopping' }"
      :disabled="status === 'stopping'"
      @click="$emit('toggle')"
      :aria-label="t('toggle.microphone')"
    >
      <span v-if="offersStop">■</span>
      <span v-else>🎤</span>
    </button>
    <div class="text-xs text-slate-400">{{ actionHint }}</div>
  </div>
</template>
