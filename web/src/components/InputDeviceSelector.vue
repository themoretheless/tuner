<script setup lang="ts">
import { useL10n } from '../stores/l10n'

defineProps<{
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'select', deviceId: string): void
}>()

const { t } = useL10n()
</script>

<template>
  <div class="flex min-w-0 items-center gap-2 text-xs text-slate-400">
    <span class="shrink-0">{{ t('input.device') }}</span>
    <select
      data-control="input-device"
      class="min-w-0 max-w-[220px] flex-1 rounded-lg border border-slate-700 bg-[#1f2937] px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-emerald-600"
      :value="selectedDeviceId"
      @change="emit('select', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ t('input.default') }}</option>
      <option v-for="(device, index) in devices" :key="device.deviceId || index" :value="device.deviceId">
        {{ device.label || `${t('input.microphone')} ${index + 1}` }}
      </option>
    </select>
    <button type="button" class="btn btn-ghost px-2 py-1 text-xs" @click="emit('refresh')">
      {{ t('refresh') }}
    </button>
  </div>
</template>
