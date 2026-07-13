<script setup lang="ts">
import { computed } from 'vue';
import { LoaderCircle, Mic, Square } from '@lucide/vue';
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
  <div class="mic-control">
    <button
      data-testid="mic-toggle"
      type="button"
      class="mic-btn"
      :class="{ listening: isListening, pending: status === 'starting' || status === 'stopping' }"
      @click="$emit('toggle')"
      :aria-label="t('toggle.microphone')"
      :title="t('toggle.microphone')"
    >
      <LoaderCircle v-if="status === 'starting' || status === 'stopping'" :size="22" class="mic-spinner" />
      <Square v-else-if="offersStop" :size="19" fill="currentColor" />
      <Mic v-else :size="24" />
    </button>
    <div class="mic-copy">{{ actionHint }}</div>
  </div>
</template>
