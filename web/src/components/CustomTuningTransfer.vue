<script setup lang="ts">
import { ref } from 'vue'
import type { Tuning } from '../utils/notes'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  tunings: Tuning[]
}>()

const emit = defineEmits<{
  (e: 'import', tunings: Tuning[]): void
}>()

const { t } = useL10n()
const fileInput = ref<HTMLInputElement | null>(null)
const status = ref('')

function exportTunings() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tunings: props.tunings,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'custom-tunings.json'
  link.click()
  URL.revokeObjectURL(url)
  status.value = t('custom.exported')
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const parsed = JSON.parse(await file.text()) as { tunings?: Tuning[] } | Tuning[]
    const tunings = Array.isArray(parsed) ? parsed : parsed.tunings
    if (!Array.isArray(tunings)) throw new Error('Invalid tuning file')
    emit('import', tunings)
    status.value = `${tunings.length} ${t('custom.imported')}`
  } catch {
    status.value = t('custom.import.failed')
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4 text-xs">
    <button type="button" data-tuning-transfer="export" class="btn btn-ghost py-1.5 px-3" @click="exportTunings">
      {{ t('custom.export') }}
    </button>
    <button type="button" data-tuning-transfer="import" class="btn btn-ghost py-1.5 px-3" @click="fileInput?.click()">
      {{ t('custom.import') }}
    </button>
    <span class="text-slate-500">{{ status || `${tunings.length} ${t('custom.saved')}` }}</span>
    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="importFile"
    />
  </div>
</template>
