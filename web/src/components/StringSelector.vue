<script setup lang="ts">
import type { Note } from '../utils/notes'
import { useL10n } from '../stores/l10n'

defineProps<{
  strings: Note[]
  selected: Note | null
  selectedIndex: number | null
  getNoteDisplay: (n: Note) => string
  formatFreq: (n: number) => string
}>()

const emit = defineEmits<{
  (e: 'toggle', note: Note, index: number): void
}>()

const { t } = useL10n()
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3 px-1">
      <div class="text-xs text-emerald-400/80">
        {{ selected ? t('manual.mode') : t('auto.detect') }}
      </div>
      <button
        v-if="selected && selectedIndex != null"
        class="text-xs btn btn-ghost py-1 px-3 text-emerald-400"
        @click="emit('toggle', selected, selectedIndex)"
      >
        {{ t('auto') }}
      </button>
    </div>

    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
      <button
        v-for="(str, index) in strings"
        :key="`${getNoteDisplay(str)}-${index}`"
        type="button"
        :data-string-button="getNoteDisplay(str)"
        :aria-pressed="selectedIndex === index ? 'true' : 'false'"
        class="string-btn"
        :class="{ active: selectedIndex === index }"
        @click="emit('toggle', str, index)"
      >
        {{ getNoteDisplay(str) }}
        <div class="text-[10px] text-slate-500">{{ formatFreq(str.frequency) }}</div>
      </button>
    </div>
  </div>
</template>
