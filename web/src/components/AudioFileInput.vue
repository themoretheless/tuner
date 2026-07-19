<script setup lang="ts">
import { FileAudio, Mic, Upload } from '@lucide/vue';
import { ref } from 'vue';
import { useL10n } from '../stores/l10n';

const props = defineProps<{
  active: boolean;
  duration: number;
  fileName: string | null;
  progress: number;
}>();

const emit = defineEmits<{
  (event: 'microphone'): void;
  (event: 'select', file: File): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const { t } = useL10n();

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) emit('select', file);
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
</script>

<template>
  <div class="grid min-w-0 gap-2 text-xs text-slate-400" data-control="audio-file-input">
    <input
      ref="fileInput"
      class="hidden"
      type="file"
      accept=".wav,audio/wav,audio/x-wav"
      @change="selectFile"
    />
    <div class="flex min-w-0 gap-2">
      <button type="button" class="btn btn-ghost min-w-0 flex-1 px-3 py-2" @click="fileInput?.click()">
        <Upload :size="15" aria-hidden="true" />
        <span>{{ active ? t('audio.file.replace') : t('audio.file.open') }}</span>
      </button>
      <button
        v-if="active"
        type="button"
        class="btn btn-ghost shrink-0 px-3 py-2"
        :title="t('audio.file.microphone')"
        :aria-label="t('audio.file.microphone')"
        @click="emit('microphone')"
      >
        <Mic :size="16" aria-hidden="true" />
      </button>
    </div>
    <div v-if="active" class="min-w-0 rounded-md border border-slate-700 bg-[#11151b] px-3 py-2">
      <div class="flex min-w-0 items-center gap-2 text-slate-300">
        <FileAudio :size="15" class="shrink-0 text-emerald-400" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate" :title="props.fileName ?? ''">{{ props.fileName }}</span>
        <span class="shrink-0 font-mono tabular-nums text-slate-500">{{ formatDuration(duration) }}</span>
      </div>
      <div class="mt-2 h-1 overflow-hidden rounded bg-slate-800" aria-hidden="true">
        <div
          class="h-full bg-emerald-500 transition-[width] duration-100"
          :style="{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }"
        />
      </div>
    </div>
  </div>
</template>
