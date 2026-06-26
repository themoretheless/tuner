<script setup lang="ts">
import { computed } from 'vue'
import type { Note } from '../utils/notes'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  strings: Note[]
  selected: Note | null
  selectedIndex: number | null
  leftHanded: boolean
  getNoteDisplay: (n: Note) => string
  formatFreq: (n: number) => string
}>()

const emit = defineEmits<{
  (e: 'toggle', note: Note, index: number): void
}>()

const { t } = useL10n()

const displayStrings = computed(() => {
  const items = props.strings.map((string, index) => ({ string, index }))
  return props.leftHanded ? [...items].reverse() : items
})
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

    <div class="string-grid grid grid-cols-3 sm:grid-cols-6 gap-2">
      <button
        v-for="item in displayStrings"
        :key="`${getNoteDisplay(item.string)}-${item.index}`"
        type="button"
        :data-string-button="getNoteDisplay(item.string)"
        :aria-pressed="selectedIndex === item.index ? 'true' : 'false'"
        class="string-btn"
        :class="{ active: selectedIndex === item.index }"
        @click="emit('toggle', item.string, item.index)"
      >
        {{ getNoteDisplay(item.string) }}
        <div class="text-[10px] text-slate-500">{{ formatFreq(item.string.frequency) }}</div>
      </button>
    </div>
  </div>
</template>
