<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NOTE_NAMES,
  normalizeTemperamentOffsets,
  type NoteName,
  type Temperament,
} from '../utils/notes'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  customTemperaments: Temperament[]
  offsets: Record<NoteName, number>
  root: NoteName
  temperament: string
  temperaments: Temperament[]
}>()

const emit = defineEmits<{
  (e: 'root-change', value: NoteName): void
  (e: 'save', payload: { name: string; offsets: number[] }): void
  (e: 'delete', id: string): void
}>()

const { t } = useL10n()
const draftName = ref('')
const draftOffsets = ref<number[]>([])
const isOpen = ref(false)
const intervalLabels = ['1', 'm2', 'M2', 'm3', 'M3', '4', 'TT', '5', 'm6', 'M6', 'm7', '7']

const selectedTemperament = computed(() => (
  props.temperaments.find((item) => item.id === props.temperament) || props.temperaments[0]
))
const isCustom = computed(() => props.customTemperaments.some((item) => item.id === props.temperament))
const rootRelativeNames = computed(() => {
  const rootIndex = NOTE_NAMES.indexOf(props.root)
  return NOTE_NAMES.map((_, interval) => NOTE_NAMES[(rootIndex + interval) % NOTE_NAMES.length])
})
const comparisonRows = computed(() => NOTE_NAMES.map((name) => ({
  name,
  cents: props.offsets[name] ?? 0,
})))

function resetDraft() {
  const selected = selectedTemperament.value
  draftName.value = selected ? `${selected.name} ${t('custom.copy')}` : t('temperament.custom')
  draftOffsets.value = normalizeTemperamentOffsets(selected?.offsets)
}

function save() {
  emit('save', {
    name: draftName.value,
    offsets: normalizeTemperamentOffsets(draftOffsets.value),
  })
}

function updateOpenState(event: Event) {
  isOpen.value = (event.currentTarget as HTMLDetailsElement).open
}

watch(() => [props.temperament, props.temperaments.length], resetDraft, { immediate: true })
</script>

<template>
  <details class="border-t border-slate-800 pt-4" @toggle="updateOpenState">
    <summary class="cursor-pointer select-none text-sm text-slate-300 hover:text-slate-100">
      {{ t('temperament.advanced') }}
    </summary>

    <div v-if="isOpen" class="mt-4 space-y-4">
      <label class="option-field">
        <span>{{ t('temperament.root') }}</span>
        <select
          :value="root"
          @change="emit('root-change', ($event.target as HTMLSelectElement).value as NoteName)"
        >
          <option v-for="name in NOTE_NAMES" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </label>

      <div class="rounded-lg border border-slate-800 bg-[#0f1319] p-3">
        <div class="mb-2 text-xs font-medium text-slate-300">{{ t('temperament.comparison') }}</div>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <div
            v-for="row in comparisonRows"
            :key="row.name"
            class="rounded border border-slate-800 bg-[#11151b] px-2 py-1.5 text-center"
          >
            <div class="text-xs text-slate-500">{{ row.name }}</div>
            <div class="font-mono text-sm" :class="row.cents === 0 ? 'text-slate-400' : row.cents > 0 ? 'text-emerald-300' : 'text-amber-300'">
              {{ row.cents > 0 ? '+' : '' }}{{ row.cents }}
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <input
          v-model="draftName"
          class="w-full bg-[#1f2937] border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-600"
          :placeholder="t('temperament.custom')"
        />

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label
            v-for="(_, index) in draftOffsets"
            :key="index"
            class="text-[11px] text-slate-500"
          >
            {{ intervalLabels[index] }} · {{ rootRelativeNames[index] }}
            <input
              v-model.number="draftOffsets[index]"
              type="number"
              min="-50"
              max="50"
              step="1"
              class="mt-1 w-full bg-[#1f2937] border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-600"
            />
          </label>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row">
          <button type="button" class="btn btn-primary flex-1" @click="save">
            {{ t('temperament.save') }}
          </button>
          <button
            v-if="isCustom"
            type="button"
            class="btn btn-ghost flex-1 text-red-300 border-red-900/60"
            @click="emit('delete', temperament)"
          >
            {{ t('custom.delete') }}
          </button>
        </div>
      </div>
    </div>
  </details>
</template>
