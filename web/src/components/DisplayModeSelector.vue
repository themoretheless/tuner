<script setup lang="ts">
import type { DisplayMode } from '../utils/settingsStorage'
import { useL10n } from '../stores/l10n'
import { Gauge, MoveUp, ScanLine } from '@lucide/vue'

defineProps<{
  mode: DisplayMode
}>()

const emit = defineEmits<{
  (e: 'change', mode: DisplayMode): void
}>()

const { t } = useL10n()

const modes: DisplayMode[] = ['gauge', 'needle', 'strobe']
const icons = { gauge: Gauge, needle: MoveUp, strobe: ScanLine }
</script>

<template>
  <div class="display-mode-selector segmented">
    <button
      v-for="item in modes"
      :key="item"
      type="button"
      :class="{ active: mode === item }"
      :aria-pressed="mode === item ? 'true' : 'false'"
      :data-display-mode="item"
      :title="t(`display.${item}`)"
      @click="emit('change', item)"
    >
      <component :is="icons[item]" :size="16" aria-hidden="true" />
      <span class="sr-only">{{ t(`display.${item}`) }}</span>
    </button>
  </div>
</template>
