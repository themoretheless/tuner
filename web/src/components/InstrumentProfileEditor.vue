<script setup lang="ts">
import { ref } from 'vue'
import type { InstrumentPreset } from '../utils/notes'
import { useL10n } from '../stores/l10n'

defineProps<{
  customInstruments: InstrumentPreset[]
}>()

const emit = defineEmits<{
  (e: 'save', name: string): void
  (e: 'delete', id: string): void
}>()

const { t } = useL10n()
const draftName = ref('')
const isOpen = ref(false)

function save() {
  emit('save', draftName.value)
  draftName.value = ''
}

function updateOpenState(event: Event) {
  isOpen.value = (event.currentTarget as HTMLDetailsElement).open
}
</script>

<template>
  <details class="border-t border-slate-800 pt-4" @toggle="updateOpenState">
    <summary class="cursor-pointer select-none text-sm text-slate-300 hover:text-slate-100">
      {{ t('instrument.profiles') }}
    </summary>

    <div v-if="isOpen" class="mt-4 space-y-4">
      <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          v-model="draftName"
          class="min-w-0 bg-[#1f2937] border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-600"
          :placeholder="t('instrument.profile.name')"
        />
        <button type="button" class="btn btn-primary" @click="save">
          {{ t('instrument.profile.save') }}
        </button>
      </div>

      <div v-if="customInstruments.length" class="space-y-2">
        <div
          v-for="instrument in customInstruments"
          :key="instrument.id"
          class="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#0f1319] px-3 py-2 text-sm"
        >
          <span class="min-w-0 truncate text-slate-300">{{ instrument.name }}</span>
          <button
            type="button"
            class="text-xs text-red-300 hover:text-red-200"
            @click="emit('delete', instrument.id)"
          >
            {{ t('custom.delete') }}
          </button>
        </div>
      </div>
    </div>
  </details>
</template>
