<script setup lang="ts">
import type { Note } from '../utils/notes'
import { useL10n } from '../stores/l10n'

defineProps<{
  accuracy: number
  attempts: number
  correct: number
  getNoteDisplay: (note: Note) => string
  revealed: boolean
  streak: number
  target: Note | null
}>()

const emit = defineEmits<{
  (e: 'mark', value: boolean): void
  (e: 'next'): void
  (e: 'play'): void
  (e: 'reset'): void
  (e: 'reveal'): void
}>()

const { t } = useL10n()
</script>

<template>
  <div class="card p-5 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-sm font-medium text-slate-200">{{ t('ear.title') }}</div>
        <div class="font-mono text-xs text-slate-500">
          {{ correct }}/{{ attempts }} · {{ accuracy }}% · {{ t('ear.streak') }} {{ streak }}
        </div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-[#0f1319] px-4 py-2 text-center font-mono text-2xl text-emerald-300">
        {{ target && revealed ? getNoteDisplay(target) : '??' }}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <button type="button" data-ear-action="next" class="btn btn-primary" @click="emit('next')">
        {{ t('ear.next') }}
      </button>
      <button type="button" data-ear-action="play" class="btn btn-ghost" :disabled="!target" @click="emit('play')">
        {{ t('ear.play') }}
      </button>
      <button type="button" data-ear-action="reveal" class="btn btn-ghost" @click="emit('reveal')">
        {{ t('ear.reveal') }}
      </button>
      <button type="button" data-ear-action="correct" class="btn btn-ghost text-emerald-300" @click="emit('mark', true)">
        {{ t('ear.correct') }}
      </button>
      <button type="button" data-ear-action="miss" class="btn btn-ghost text-amber-300" @click="emit('mark', false)">
        {{ t('ear.miss') }}
      </button>
    </div>

    <button type="button" class="text-xs text-slate-500 hover:text-slate-300" @click="emit('reset')">
      {{ t('ear.reset') }}
    </button>
  </div>
</template>
