<script setup lang="ts">
import { useL10n } from '../stores/l10n'

defineProps<{
  isListening: boolean
  referencePlaying: boolean
  canPlayRef: boolean
}>()

defineEmits<{
  (e: 'toggleMic'): void
  (e: 'toggleRef'): void
}>()

const { t } = useL10n()
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-3 justify-center">
    <button
      class="btn btn-ghost flex-1 sm:flex-none"
      :disabled="!canPlayRef"
      @click="$emit('toggleRef')"
    >
      <span>{{ referencePlaying ? '■' : '▶' }}</span>
      <span>{{ t('play.reference') }}</span>
    </button>

    <button class="btn btn-primary flex-1 sm:flex-none" @click="$emit('toggleMic')">
      {{ isListening ? t('stop.mic') : t('start.mic') }}
    </button>
  </div>
</template>