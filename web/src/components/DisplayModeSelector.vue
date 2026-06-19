<script setup lang="ts">
import type { DisplayMode } from '../utils/settingsStorage'
import { useL10n } from '../stores/l10n'

defineProps<{
  mode: DisplayMode
}>()

const emit = defineEmits<{
  (e: 'change', mode: DisplayMode): void
}>()

const { t } = useL10n()

const modes: DisplayMode[] = ['gauge', 'needle', 'strobe']
</script>

<template>
  <div class="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0f1319] p-1 text-xs">
    <button
      v-for="item in modes"
      :key="item"
      type="button"
      class="rounded-md px-2 py-1 transition-colors"
      :class="mode === item ? 'bg-emerald-500 text-[#052e16]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'"
      :aria-pressed="mode === item ? 'true' : 'false'"
      :data-display-mode="item"
      @click="emit('change', item)"
    >
      {{ t(`display.${item}`) }}
    </button>
  </div>
</template>
