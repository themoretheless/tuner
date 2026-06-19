<script setup lang="ts">
import {
  SWEETENING_PROFILES,
  type Note,
  type SweeteningProfileId,
} from '../utils/notes'
import { useL10n } from '../stores/l10n'

defineProps<{
  getNoteDisplay: (note: Note) => string
  offsets: number[]
  profile: SweeteningProfileId
  strings: Note[]
}>()

const emit = defineEmits<{
  (e: 'offset-change', index: number, cents: number): void
  (e: 'profile-change', profile: SweeteningProfileId): void
}>()

const { t } = useL10n()
</script>

<template>
  <details class="border-t border-slate-800 pt-4">
    <summary class="cursor-pointer select-none text-sm text-slate-300 hover:text-slate-100">
      {{ t('sweetening') }}
    </summary>

    <div class="mt-4 space-y-3">
      <label class="option-field max-w-sm">
        <span>{{ t('profile') }}</span>
        <select
          data-control="sweetening-profile"
          :value="profile"
          @change="emit('profile-change', ($event.target as HTMLSelectElement).value as SweeteningProfileId)"
        >
          <option v-for="item in SWEETENING_PROFILES" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select>
      </label>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label
          v-for="(string, index) in strings"
          :key="`${getNoteDisplay(string)}-${index}`"
          class="text-[11px] text-slate-500"
        >
          {{ getNoteDisplay(string) }}
          <div class="mt-1 flex items-center gap-1">
            <input
              :data-string-offset="index"
              type="number"
              min="-25"
              max="25"
              step="1"
              class="w-full rounded-lg border border-slate-700 bg-[#1f2937] px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-600"
              :value="offsets[index] ?? 0"
              @input="emit('offset-change', index, Number(($event.target as HTMLInputElement).value))"
            />
            <span>¢</span>
          </div>
        </label>
      </div>
    </div>
  </details>
</template>
