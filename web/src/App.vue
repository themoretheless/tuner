<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useTuner } from './composables/useTuner'
import { useL10n } from './stores/l10n'
import MicButton from './components/MicButton.vue'
import InputDeviceSelector from './components/InputDeviceSelector.vue'
import LevelMeter from './components/LevelMeter.vue'
import NoteDisplay from './components/NoteDisplay.vue'
import CentsGauge from './components/CentsGauge.vue'
import CentsHistoryGraph from './components/CentsHistoryGraph.vue'
import DisplayModeSelector from './components/DisplayModeSelector.vue'
import FreqReadout from './components/FreqReadout.vue'
import StringSelector from './components/StringSelector.vue'
import TunerControls from './components/TunerControls.vue'
import TuningSelector from './components/TuningSelector.vue'
import TuningOptions from './components/TuningOptions.vue'
import CustomTuningEditor from './components/CustomTuningEditor.vue'
import CustomTuningTransfer from './components/CustomTuningTransfer.vue'
import DisplayPreferences from './components/DisplayPreferences.vue'
import InstrumentProfileEditor from './components/InstrumentProfileEditor.vue'
import StringOffsetsPanel from './components/StringOffsetsPanel.vue'
import TemperamentPanel from './components/TemperamentPanel.vue'
import EarTrainingPanel from './components/EarTrainingPanel.vue'
import PracticeStatsPanel from './components/PracticeStatsPanel.vue'
import MetronomePanel from './components/MetronomePanel.vue'
import Waveform from './components/Waveform.vue'
import Spectrum from './components/Spectrum.vue'

const tuner = useTuner()
const { lang, t, toggleLang } = useL10n()
const appClasses = computed(() => [
  `theme-${tuner.themeMode.value}`,
  `layout-${tuner.layoutMode.value}`,
  { 'layout-left-handed': tuner.leftHanded.value },
])

function toggleMic() {
  if (tuner.isListening.value) tuner.stop()
  else tuner.start()
}

function handleKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('input, select, textarea, button, [contenteditable="true"]')) return

  if (e.key === ' ' || e.key.toLowerCase() === 'm') {
    e.preventDefault()
    toggleMic()
  }
  if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'p') {
    tuner.toggleReferenceTone()
  }
  // 1-9 for strings
  const num = Number.parseInt(e.key, 10)
  if (num >= 1 && num <= 9 && tuner.strings.value[num - 1]) {
    tuner.toggleString(tuner.strings.value[num - 1], num - 1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
})
</script>

<template>
  <div class="app-root min-h-screen flex flex-col items-center px-4 py-8 bg-[#0a0c10] text-slate-200" :class="appClasses">
    <!-- Header -->
    <div class="app-width w-full flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-2xl bg-emerald-500 flex items-center justify-center text-[#052e16]">
            <span class="text-2xl">♪</span>
          </div>
          <div>
            <h1 class="text-3xl font-semibold">{{ t('app.title') }}</h1>
            <p class="text-xs text-slate-500 -mt-0.5">{{ t('subtitle') }}</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <button class="px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-700 text-slate-400" @click="toggleLang" title="RU / EN">
          {{ lang === 'ru' ? 'RU' : 'EN' }}
        </button>
        <div class="px-2.5 py-1 rounded-full bg-[#11151b] border border-slate-800 text-slate-400 flex items-center gap-1.5">
          <div class="w-1.5 h-1.5 rounded-full" :class="tuner.isListening.value ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'"></div>
          <span>{{ tuner.isListening.value ? t('listening') : t('ready') }}</span>
        </div>
        <div class="text-[10px] px-2 py-1 rounded bg-slate-800/60 text-slate-500 hidden sm:block">Vue + Tauri</div>
      </div>
    </div>

    <div class="app-width w-full space-y-6">
      <!-- Main Card -->
      <div class="main-card card p-8 flex flex-col items-center gap-6">
        <MicButton :is-listening="tuner.isListening.value" @toggle="toggleMic" />

        <LevelMeter :level="tuner.volume.value" :active="tuner.isListening.value" />

        <Waveform v-if="tuner.showWaveform.value && !tuner.usingNativeAudio.value" :analyser="tuner.analyser.value" :is-listening="tuner.isListening.value" />
        <Spectrum v-if="tuner.showSpectrum.value && !tuner.usingNativeAudio.value" :analyser="tuner.analyser.value" :is-listening="tuner.isListening.value" />

        <!-- A4 + visual toggles (placed near the visualizers) -->
        <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 mt-1">
          <div class="flex items-center gap-2">
            <span>{{ t('a4.label') }}</span>
            <input
              type="number"
              class="w-16 bg-[#1f2937] border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-sm"
              :value="tuner.a4.value"
              @input="tuner.setA4(Number(($event.target as HTMLInputElement).value))"
              min="420"
              max="460"
              step="1"
            />
            <span class="text-slate-500">Hz</span>
          </div>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" v-model="tuner.showWaveform.value" class="accent-emerald-500" />
            <span>{{ t('waveform') }}</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" v-model="tuner.showSpectrum.value" class="accent-emerald-500" />
            <span>{{ t('spectrum') }}</span>
          </label>
          <label v-if="tuner.nativeAudioAvailable.value" class="flex items-center gap-2">
            <span>{{ t('audio.backend') }}</span>
            <select
              class="bg-[#1f2937] border border-slate-700 rounded px-2 py-1 text-sm"
              :value="tuner.audioBackend.value"
              @change="tuner.setAudioBackend(($event.target as HTMLSelectElement).value as 'web' | 'native')"
            >
              <option value="web">{{ t('audio.backend.web') }}</option>
              <option value="native">{{ t('audio.backend.native') }}</option>
            </select>
          </label>
          <InputDeviceSelector
            v-if="!tuner.usingNativeAudio.value"
            :devices="tuner.inputDevices.value"
            :selected-device-id="tuner.selectedInputDeviceId.value"
            @refresh="tuner.refreshInputDevices"
            @select="tuner.setInputDevice"
          />
        </div>

        <!-- Error -->
        <div v-if="tuner.error.value" class="text-red-400 text-sm bg-red-950/40 px-4 py-2 rounded-lg border border-red-900">
          {{ tuner.error.value }}
          <button @click="tuner.clearError()" class="ml-2 underline">{{ t('dismiss') }}</button>
        </div>

        <NoteDisplay
          :display="tuner.currentNoteDisplay.value"
          :is-detected="!!tuner.detectedNote.value"
          :target-name="tuner.getNoteDisplay(tuner.targetNote.value)"
          :target-freq="tuner.targetNote.value.frequency"
          :format-freq="tuner.formatFreq"
        />

        <CentsGauge
          :cents="tuner.cents.value"
          :mode="tuner.displayMode.value"
          :is-in-tune="tuner.isInTune.value"
          :is-detected="!!tuner.detectedNote.value"
        />

        <DisplayModeSelector
          :mode="tuner.displayMode.value"
          @change="tuner.setDisplayMode"
        />

        <DisplayPreferences
          :layout-mode="tuner.layoutMode.value"
          :left-handed="tuner.leftHanded.value"
          :theme-mode="tuner.themeMode.value"
          @fullscreen="tuner.toggleFullscreen"
          @layout-change="tuner.setLayoutMode"
          @left-handed-change="tuner.setLeftHanded"
          @theme-change="tuner.setThemeMode"
        />

        <CentsHistoryGraph :points="tuner.centsHistory.value" />

        <FreqReadout
          :detected="tuner.smoothedFrequency.value"
          :target="tuner.targetNote.value.frequency"
          :format-freq="tuner.formatFreq"
        />
      </div>

      <div class="card p-6 space-y-4">
        <TuningOptions
          :active-instrument="tuner.activeInstrument.value"
          :capo="tuner.capo.value"
          :instruments="tuner.instrumentOptions.value"
          :temperament="tuner.temperament.value"
          :temperaments="tuner.temperamentOptions.value"
          :transpose="tuner.transpose.value"
          @instrument-change="tuner.setInstrument"
          @capo-change="tuner.setCapo"
          @temperament-change="tuner.setTemperament"
          @transpose-change="tuner.setTranspose"
        />

        <TemperamentPanel
          :custom-temperaments="tuner.customTemperaments.value"
          :offsets="tuner.temperamentOffsets.value"
          :root="tuner.temperamentRoot.value"
          :temperament="tuner.temperament.value"
          :temperaments="tuner.temperamentOptions.value"
          @delete="tuner.deleteCustomTemperament"
          @root-change="tuner.setTemperamentRoot"
          @save="tuner.saveCustomTemperament"
        />

        <div class="flex min-w-0 items-center justify-between">
          <TuningSelector
            :tunings="tuner.allTunings.value"
            :current="tuner.currentTuning.value"
            @change="tuner.setTuning"
          />
        </div>

        <StringSelector
          v-if="tuner.strings.value.length"
          :strings="tuner.strings.value"
          :selected="tuner.selectedString.value"
          :selected-index="tuner.selectedStringIndex.value"
          :left-handed="tuner.leftHanded.value"
          :get-note-display="tuner.getNoteDisplay"
          :format-freq="tuner.formatFreq"
          @toggle="tuner.toggleString"
        />
        <div v-else class="rounded-lg border border-slate-800 bg-[#0f1319] px-4 py-3 text-sm text-slate-400">
          {{ t('chromatic') }}
        </div>

        <CustomTuningEditor
          :current="tuner.currentTuning.value"
          :strings="tuner.strings.value"
          @save="tuner.saveCustomTuning"
          @delete="tuner.deleteCustomTuning"
        />
        <StringOffsetsPanel
          v-if="tuner.strings.value.length"
          :get-note-display="tuner.getNoteDisplay"
          :offsets="tuner.activeStringOffsets.value"
          :profile="tuner.sweeteningProfile.value"
          :strings="tuner.strings.value"
          @offset-change="tuner.setStringOffset"
          @profile-change="tuner.setSweeteningProfile"
        />
        <CustomTuningTransfer
          :tunings="tuner.customTunings.value"
          @import="tuner.importCustomTunings"
        />
        <InstrumentProfileEditor
          :custom-instruments="tuner.customInstruments.value"
          @delete="tuner.deleteInstrumentProfile"
          @save="tuner.saveInstrumentProfile"
        />
      </div>

      <TunerControls
        :is-listening="tuner.isListening.value"
        :reference-playing="tuner.referencePlaying.value"
        :can-play-ref="true"
        @toggle-mic="toggleMic"
        @toggle-ref="tuner.toggleReferenceTone"
      />

      <EarTrainingPanel
        :accuracy="tuner.earTrainingAccuracy.value"
        :attempts="tuner.earTrainingAttempts.value"
        :correct="tuner.earTrainingCorrect.value"
        :get-note-display="tuner.getNoteDisplay"
        :revealed="tuner.earTrainingRevealed.value"
        :streak="tuner.earTrainingStreak.value"
        :target="tuner.earTrainingTarget.value"
        @mark="tuner.markEarTraining"
        @next="tuner.nextEarTraining"
        @play="tuner.playEarTraining"
        @reset="tuner.resetEarTraining"
        @reveal="tuner.revealEarTraining"
      />

      <PracticeStatsPanel
        :export-stats="tuner.exportPracticeStats"
        :history="tuner.practiceHistory.value"
        :summary="tuner.practiceSummary.value"
        @clear="tuner.clearPracticeHistory"
      />

      <MetronomePanel
        :beat="tuner.metronomeBeat.value"
        :beats="tuner.metronomeBeats.value"
        :bpm="tuner.metronomeBpm.value"
        :is-running="tuner.metronomeRunning.value"
        :subdivision="tuner.metronomeSubdivision.value"
        :subdivision-step="tuner.metronomeSubdivisionStep.value"
        @beats-change="tuner.setMetronomeBeats"
        @bpm-change="tuner.setMetronomeBpm"
        @subdivision-change="tuner.setMetronomeSubdivision"
        @tap="tuner.tapMetronome"
        @toggle="tuner.toggleMetronome"
      />

      <div class="text-center text-[11px] text-slate-500 max-w-sm mx-auto">
        {{ t('quiet.room') }} {{ t('keyboard.hint') }}
      </div>
    </div>

    <footer class="mt-auto pt-12 text-[10px] text-slate-600">
      {{ t('footer') }}
    </footer>
  </div>
</template>
