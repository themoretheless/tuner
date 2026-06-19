<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  GUITAR_STRINGS_STANDARD,
  NOTE_NAMES,
  noteWithA4,
  type Note,
  type NoteName,
  type Tuning,
} from '../utils/notes'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  current: Tuning
  strings: Note[]
}>()

const emit = defineEmits<{
  (e: 'save', payload: { id?: string | null; name: string; strings: Note[] }): void
  (e: 'delete', id: string): void
}>()

const { t } = useL10n()

const draftName = ref('')
const draftStrings = ref<Array<{ name: NoteName; octave: number }>>([])
const isOpen = ref(false)
const octaveOptions = [1, 2, 3, 4, 5]

const isCustom = computed(() => props.current.kind === 'custom')

function resetDraft() {
  const source = props.strings.length ? props.strings : GUITAR_STRINGS_STANDARD
  draftName.value = isCustom.value ? props.current.name : `${props.current.name} ${t('custom.copy')}`
  draftStrings.value = source.map((string) => ({
    name: string.name,
    octave: string.octave,
  }))
}

function buildNotes() {
  return draftStrings.value.map((string) => noteWithA4({
    name: string.name,
    octave: Math.max(0, Math.min(8, Number(string.octave) || 4)),
  }, 440))
}

function save() {
  emit('save', {
    id: isCustom.value ? props.current.id : null,
    name: draftName.value,
    strings: buildNotes(),
  })
}

function updateOpenState(event: Event) {
  isOpen.value = (event.currentTarget as HTMLDetailsElement).open
}

watch(() => [props.current.id, props.strings.map((string) => `${string.name}${string.octave}`).join('|')], resetDraft, {
  immediate: true,
})
</script>

<template>
  <details class="border-t border-slate-800 pt-4" @toggle="updateOpenState">
    <summary class="cursor-pointer select-none text-sm text-slate-300 hover:text-slate-100">
      {{ t('custom.title') }}
    </summary>

    <div v-if="isOpen" class="mt-4 space-y-4">
      <label class="block text-xs text-slate-500">
        {{ t('custom.name') }}
        <input
          v-model="draftName"
          class="mt-1 w-full bg-[#1f2937] border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-600"
        />
      </label>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label
          v-for="(string, index) in draftStrings"
          :key="index"
          class="text-[11px] text-slate-500"
        >
          {{ t('custom.string') }} {{ index + 1 }}
          <div class="mt-1 flex gap-1">
            <select
              v-model="string.name"
              class="min-w-0 flex-1 bg-[#1f2937] border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-600"
            >
              <option v-for="name in NOTE_NAMES" :key="name" :value="name">
                {{ name }}
              </option>
            </select>
            <select
              v-model.number="string.octave"
              class="w-16 bg-[#1f2937] border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-600"
            >
              <option v-for="octave in octaveOptions" :key="octave" :value="octave">
                {{ octave }}
              </option>
            </select>
          </div>
        </label>
      </div>

      <div class="flex flex-col sm:flex-row gap-2">
        <button class="btn btn-primary flex-1" @click="save">
          {{ isCustom ? t('custom.update') : t('custom.save') }}
        </button>
        <button
          v-if="isCustom"
          class="btn btn-ghost flex-1 text-red-300 border-red-900/60"
          @click="emit('delete', current.id)"
        >
          {{ t('custom.delete') }}
        </button>
      </div>
    </div>
  </details>
</template>
