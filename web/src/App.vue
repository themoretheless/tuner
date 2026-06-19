<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useTuner } from './composables/useTuner'
import { useL10n } from './stores/l10n'
import MicButton from './components/MicButton.vue'
import LevelMeter from './components/LevelMeter.vue'
import NoteDisplay from './components/NoteDisplay.vue'
import CentsGauge from './components/CentsGauge.vue'
import FreqReadout from './components/FreqReadout.vue'
import StringSelector from './components/StringSelector.vue'
import TunerControls from './components/TunerControls.vue'
import TuningSelector from './components/TuningSelector.vue'
import Waveform from './components/Waveform.vue'
import Spectrum from './components/Spectrum.vue'
import PerStringCents from './components/PerStringCents.vue'
import CentsHistory from './components/CentsHistory.vue'
import Spectrogram from './components/Spectrogram.vue'
import Fretboard from './components/Fretboard.vue'

const tuner = useTuner()
const { lang, t, toggleLang } = useL10n()



function toggleMic() {
  if (tuner.isListening.value) tuner.stop()
  else tuner.start()
}

function handleKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key.toLowerCase() === 'm') {
    e.preventDefault()
    toggleMic()
  }
  if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'p') {
    tuner.toggleReferenceTone()
  }
  // 1-6 for strings
  const num = parseInt(e.key)
  if (num >= 1 && num <= 6 && tuner.strings.value[num-1]) {
    tuner.toggleString(tuner.strings.value[num-1])
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
  <div class="min-h-screen flex flex-col items-center px-4 py-8 bg-[#0a0c10] text-slate-200">
    <!-- Header -->
    <div class="w-full max-w-[620px] flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-2xl bg-emerald-500 flex items-center justify-center text-[#052e16]">
            <span class="text-2xl">♪</span>
          </div>
          <div>
            <h1 class="text-3xl font-semibold tracking-tighter">{{ t('app.title') }}</h1>
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

    <div class="w-full max-w-[620px] space-y-6">
      <!-- Main Card -->
      <div class="card p-8 flex flex-col items-center gap-6">
        <MicButton :is-listening="tuner.isListening.value" @toggle="toggleMic" />

        <LevelMeter :level="tuner.volume.value" :active="tuner.isListening.value" />

        <Waveform v-if="tuner.showWaveform.value" :analyser="tuner.analyser.value" :is-listening="tuner.isListening.value" />
        <Spectrogram v-if="tuner.showSpectrogram.value" :analyser="tuner.analyser.value" :is-listening="tuner.isListening.value" />
        <Spectrum v-if="tuner.showSpectrum.value" :analyser="tuner.analyser.value" :is-listening="tuner.isListening.value" :current-freq="tuner.currentFrequency.value" />

        <!-- A4 + visual toggles (placed near the visualizers) -->
        <div class="flex items-center gap-3 text-xs text-slate-400 mt-1">
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
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" v-model="tuner.showSpectrogram.value" class="accent-emerald-500" />
            <span>{{ t('spectrogram') }}</span>
          </label>
        </div>

        <!-- Error -->
        <div v-if="tuner.error.value" class="text-red-400 text-sm bg-red-950/40 px-4 py-2 rounded-xl border border-red-900">
          {{ tuner.error.value }}
          <button @click="tuner.clearError()" class="ml-2 underline">dismiss</button>
        </div>

        <NoteDisplay
          :display="tuner.currentNoteDisplay.value"
          :is-detected="!!tuner.detectedNote.value"
          :target-name="tuner.getNoteDisplay(tuner.targetNote.value)"
          :target-freq="tuner.targetNote.value.frequency"
          :format-freq="tuner.formatFreq"
          :confidence="tuner.confidence.value"
          :is-power-chord="tuner.isPowerChord.value"
        />

        <CentsGauge :cents="tuner.cents.value" :is-in-tune="tuner.isInTune.value" />

        <CentsHistory
          v-if="tuner.isListening.value"
          :history="tuner.centsHistory.value"
          :is-listening="tuner.isListening.value"
        />

        <FreqReadout
          :detected="tuner.smoothedFrequency.value"
          :target="tuner.targetNote.value.frequency"
          :format-freq="tuner.formatFreq"
        />
      </div>

      <div class="card p-6 space-y-4">
        <div class="flex items-center justify-between">
          <TuningSelector
            :tunings="tuner.allTunings"
            :current="tuner.currentTuning.value"
            @change="tuner.setTuning"
          />
        </div>

        <StringSelector
          :strings="tuner.strings.value"
          :selected="tuner.selectedString.value"
          :get-note-display="tuner.getNoteDisplay"
          :format-freq="tuner.formatFreq"
          @toggle="tuner.toggleString"
        />

        <PerStringCents
          v-if="tuner.isListening.value"
          :strings-with-cents="tuner.stringsWithCents.value"
        />

        <Fretboard
          v-if="tuner.isListening.value"
          :strings="tuner.strings.value"
          :target-freq="tuner.targetNote.value.frequency"
          :selected-string="tuner.selectedString.value"
          @select="tuner.toggleString"
        />
      </div>

      <TunerControls
        :is-listening="tuner.isListening.value"
        :reference-playing="tuner.referencePlaying.value"
        :can-play-ref="true"
        @toggle-mic="toggleMic"
        @toggle-ref="tuner.toggleReferenceTone"
      />

      <button @click="tuner.playRandomString()" class="btn btn-ghost mx-auto block">
        {{ t('random.note') }}
      </button>

      <div class="text-center text-[11px] text-slate-500 max-w-sm mx-auto">
        {{ t('quiet.room') }} {{ t('keyboard.hint') }}
      </div>
    </div>

    <footer class="mt-auto pt-12 text-[10px] text-slate-600">
      {{ t('footer') }}
    </footer>
  </div>
</template>
