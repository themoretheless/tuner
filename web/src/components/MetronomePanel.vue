<script setup lang="ts">
import { computed } from 'vue'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  beat: number
  beats: number
  bpm: number
  isRunning: boolean
  subdivision: number
  subdivisionStep: number
}>()

const emit = defineEmits<{
  (e: 'beats-change', value: number): void
  (e: 'bpm-change', value: number): void
  (e: 'subdivision-change', value: number): void
  (e: 'tap'): void
  (e: 'toggle'): void
}>()

const { t } = useL10n()
const beatDots = computed(() => Array.from({ length: props.beats }, (_, index) => index))
</script>

<template>
  <div class="card p-5 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-sm font-medium text-slate-200">{{ t('metronome') }}</div>
        <div class="font-mono text-xs text-slate-500">{{ bpm }} BPM · {{ beats }}/4 · x{{ subdivision }}</div>
      </div>
      <div class="flex items-center gap-1">
        <span
          v-for="dot in beatDots"
          :key="dot"
          class="h-2.5 w-2.5 rounded-full border border-slate-700"
          :class="isRunning && beat === dot && subdivisionStep === 0 ? 'bg-emerald-400 border-emerald-300' : 'bg-slate-900'"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <button type="button" data-metronome-action="toggle" class="btn btn-primary" @click="emit('toggle')">
        {{ isRunning ? t('stop') : t('start') }}
      </button>
      <button type="button" data-metronome-action="tap" class="btn btn-ghost" @click="emit('tap')">
        {{ t('tap') }}
      </button>
      <label class="option-field">
        <span>BPM</span>
        <input
          data-control="metronome-bpm"
          type="number"
          min="30"
          max="240"
          step="1"
          :value="bpm"
          @input="emit('bpm-change', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="option-field">
        <span>{{ t('beats') }}</span>
        <input
          data-control="metronome-beats"
          type="number"
          min="1"
          max="12"
          step="1"
          :value="beats"
          @input="emit('beats-change', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="option-field">
        <span>{{ t('subdivision') }}</span>
        <select
          data-control="metronome-subdivision"
          :value="subdivision"
          @change="emit('subdivision-change', Number(($event.target as HTMLSelectElement).value))"
        >
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
        </select>
      </label>
    </div>
  </div>
</template>
