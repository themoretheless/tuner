<script setup lang="ts">
import type { LayoutMode, ThemeMode } from '../utils/settingsStorage'
import { useL10n } from '../stores/l10n'

defineProps<{
  layoutMode: LayoutMode
  leftHanded: boolean
  themeMode: ThemeMode
}>()

const emit = defineEmits<{
  (e: 'layout-change', value: LayoutMode): void
  (e: 'left-handed-change', value: boolean): void
  (e: 'theme-change', value: ThemeMode): void
  (e: 'fullscreen'): void
}>()

const { t } = useL10n()
const themes: Array<{ id: ThemeMode; labelKey: string }> = [
  { id: 'dark', labelKey: 'appearance.dark' },
  { id: 'light', labelKey: 'appearance.light' },
  { id: 'colorblind', labelKey: 'appearance.colorblind' },
]
const layouts: Array<{ id: LayoutMode; labelKey: string }> = [
  { id: 'default', labelKey: 'appearance.default' },
  { id: 'stage', labelKey: 'appearance.stage' },
  { id: 'compact', labelKey: 'appearance.compact' },
]
</script>

<template>
  <div class="grid gap-3 border-t border-slate-800 pt-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-xs text-slate-500">{{ t('appearance.theme') }}</span>
      <div class="segmented">
        <button
          v-for="theme in themes"
          :key="theme.id"
          type="button"
          :class="{ active: themeMode === theme.id }"
          @click="emit('theme-change', theme.id)"
        >
          {{ t(theme.labelKey) }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-xs text-slate-500">{{ t('appearance.layout') }}</span>
      <div class="segmented">
        <button
          v-for="layout in layouts"
          :key="layout.id"
          type="button"
          :class="{ active: layoutMode === layout.id }"
          @click="emit('layout-change', layout.id)"
        >
          {{ t(layout.labelKey) }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <label class="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          class="accent-emerald-500"
          :checked="leftHanded"
          @change="emit('left-handed-change', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('appearance.left') }}</span>
      </label>
      <button type="button" class="btn btn-ghost py-1.5 text-xs" @click="emit('fullscreen')">
        {{ t('appearance.fullscreen') }}
      </button>
    </div>
  </div>
</template>
