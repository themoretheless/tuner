<script setup lang="ts">
import { useAnalysisPort } from '../../app/featurePorts';
import { useL10n } from '../../stores/l10n';
import CentsHistoryGraph from '../../components/CentsHistoryGraph.vue';
import DisplayModeSelector from '../../components/DisplayModeSelector.vue';
import DisplayPreferences from '../../components/DisplayPreferences.vue';
import FreqReadout from '../../components/FreqReadout.vue';
import Spectrogram from '../../components/Spectrogram.vue';
import Spectrum from '../../components/Spectrum.vue';
import Waveform from '../../components/Waveform.vue';

const analysis = useAnalysisPort();
const { t } = useL10n();
</script>

<template>
  <section class="workspace-stack" aria-labelledby="analysis-heading">
    <header class="workspace-heading workspace-heading-row">
      <div>
        <h2 id="analysis-heading">{{ t('nav.analysis') }}</h2>
        <p>{{ t('analysis.subtitle') }}</p>
      </div>
      <button v-if="!analysis.isListening" type="button" class="btn btn-primary" @click="analysis.start()">
        {{ t('start.mic') }}
      </button>
    </header>

    <div class="analysis-toolbar card">
      <label class="toggle-control">
        <input v-model="analysis.showWaveform" type="checkbox" />
        <span>{{ t('waveform') }}</span>
      </label>
      <label class="toggle-control">
        <input v-model="analysis.showSpectrum" type="checkbox" />
        <span>{{ t('spectrum') }}</span>
      </label>
      <label class="toggle-control">
        <input v-model="analysis.showSpectrogram" type="checkbox" />
        <span>{{ t('spectrogram') }}</span>
      </label>
      <DisplayModeSelector :mode="analysis.displayMode" @change="analysis.setDisplayMode" />
    </div>

    <div v-if="analysis.isListening && !analysis.usingNativeAudio" class="analysis-grid">
      <div v-if="analysis.showWaveform" class="visualizer-panel card">
        <Waveform :frame="analysis.waveformFrame" :is-listening="analysis.isListening" />
      </div>
      <div v-if="analysis.showSpectrum" class="visualizer-panel card">
        <Spectrum
          :frame="analysis.spectrumFrame"
          :is-listening="analysis.isListening"
          :current-freq="analysis.smoothedFrequency"
        />
      </div>
      <div v-if="analysis.showSpectrogram" class="visualizer-panel card analysis-wide">
        <Spectrogram :frame="analysis.spectrumFrame" :is-listening="analysis.isListening" />
      </div>
    </div>
    <div v-else class="analysis-empty card">
      <strong>{{ analysis.usingNativeAudio ? t('analysis.native') : t('analysis.idle') }}</strong>
      <span>{{ t('analysis.empty.detail') }}</span>
    </div>

    <div class="analysis-grid">
      <div class="workspace-panel card">
        <CentsHistoryGraph :points="analysis.centsHistory" />
        <FreqReadout
          :detected="analysis.smoothedFrequency"
          :target="analysis.targetNote.frequency"
          :format-freq="analysis.formatFreq"
        />
      </div>
      <div class="workspace-panel card">
        <DisplayPreferences
          :layout-mode="analysis.layoutMode"
          :left-handed="analysis.leftHanded"
          :theme-mode="analysis.themeMode"
          @fullscreen="analysis.toggleFullscreen"
          @layout-change="analysis.setLayoutMode"
          @left-handed-change="analysis.setLeftHanded"
          @theme-change="analysis.setThemeMode"
        />
      </div>
    </div>
  </section>
</template>
