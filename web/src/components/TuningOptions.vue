<script setup lang="ts">
import {
  INSTRUMENTS,
  TEMPERAMENTS,
  type InstrumentId,
  type TemperamentId,
} from '../utils/notes'
import { useL10n } from '../stores/l10n'

defineProps<{
  activeInstrument: InstrumentId
  capo: number
  temperament: TemperamentId
  transpose: number
}>()

const emit = defineEmits<{
  (e: 'instrument-change', value: InstrumentId): void
  (e: 'capo-change', value: number): void
  (e: 'temperament-change', value: TemperamentId): void
  (e: 'transpose-change', value: number): void
}>()

const { t } = useL10n()
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <label class="option-field">
      <span>{{ t('instrument') }}</span>
      <select
        data-control="instrument"
        :value="activeInstrument"
        @change="emit('instrument-change', ($event.target as HTMLSelectElement).value as InstrumentId)"
      >
        <option v-for="instrument in INSTRUMENTS" :key="instrument.id" :value="instrument.id">
          {{ instrument.name }}
        </option>
      </select>
    </label>

    <label class="option-field">
      <span>{{ t('temperament') }}</span>
      <select
        data-control="temperament"
        :value="temperament"
        @change="emit('temperament-change', ($event.target as HTMLSelectElement).value as TemperamentId)"
      >
        <option v-for="item in TEMPERAMENTS" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </select>
    </label>

    <label class="option-field">
      <span>{{ t('transpose') }}</span>
      <input
        data-control="transpose"
        type="number"
        :value="transpose"
        min="-12"
        max="12"
        step="1"
        @input="emit('transpose-change', Number(($event.target as HTMLInputElement).value))"
      />
    </label>

    <label class="option-field">
      <span>{{ t('capo') }}</span>
      <input
        data-control="capo"
        type="number"
        :value="capo"
        min="0"
        max="12"
        step="1"
        @input="emit('capo-change', Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </div>
</template>
