<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutMode, ThemeMode } from '../utils/settingsStorage'
import { nearestStabilityPreset, READOUT_STABILITY_PRESETS } from '../utils/inTuneFeedback'
import { useL10n } from '../stores/l10n'

const props = defineProps<{
  layoutMode: LayoutMode
  leftHanded: boolean
  themeMode: ThemeMode
  feedbackFlash?: boolean
  feedbackSound?: boolean
  feedbackVibrate?: boolean
  readoutStability?: number
}>()

const emit = defineEmits<{
  (e: 'layout-change', value: LayoutMode): void
  (e: 'left-handed-change', value: boolean): void
  (e: 'theme-change', value: ThemeMode): void
  (e: 'fullscreen'): void
  (e: 'feedback-flash-change', value: boolean): void
  (e: 'feedback-sound-change', value: boolean): void
  (e: 'feedback-vibrate-change', value: boolean): void
  (e: 'readout-stability-change', value: number): void
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

// M62: segmented "needle steadiness" control mapped onto the persisted
// 0..1 readoutStability ratio (see utils/inTuneFeedback.ts).
const stabilityOptions = [
  { id: 'low' as const, labelKey: 'feedback.stability.low' },
  { id: 'medium' as const, labelKey: 'feedback.stability.medium' },
  { id: 'high' as const, labelKey: 'feedback.stability.high' },
]
const activeStability = computed(() => nearestStabilityPreset(props.readoutStability ?? 0.5))
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

    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-xs text-slate-500" id="readout-stability-label">
        {{ t('feedback.stability') }}
      </span>
      <div class="segmented" role="group" aria-labelledby="readout-stability-label">
        <button
          v-for="option in stabilityOptions"
          :key="option.id"
          type="button"
          :class="{ active: activeStability === option.id }"
          @click="emit('readout-stability-change', READOUT_STABILITY_PRESETS[option.id])"
        >
          {{ t(option.labelKey) }}
        </button>
      </div>
    </div>
    <p class="-mt-2 text-[11px] text-slate-600">{{ t('feedback.stability.hint') }}</p>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span class="text-xs text-slate-500">{{ t('feedback.confirm') }}</span>
      <label class="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          class="accent-emerald-500"
          :checked="feedbackFlash ?? true"
          @change="emit('feedback-flash-change', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('feedback.flash') }}</span>
      </label>
      <label class="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          class="accent-emerald-500"
          :checked="feedbackSound ?? false"
          @change="emit('feedback-sound-change', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('feedback.sound') }}</span>
      </label>
      <label class="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          class="accent-emerald-500"
          :checked="feedbackVibrate ?? false"
          @change="emit('feedback-vibrate-change', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('feedback.vibrate') }}</span>
      </label>
    </div>
  </div>
</template>
