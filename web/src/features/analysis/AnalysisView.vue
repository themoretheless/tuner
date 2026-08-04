<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useAnalysisPort } from '../../app/featurePorts';
import { useL10n } from '../../stores/l10n';
import CentsHistoryGraph from '../../components/CentsHistoryGraph.vue';
import DisplayModeSelector from '../../components/DisplayModeSelector.vue';
import DisplayPreferences from '../../components/DisplayPreferences.vue';
import FreqReadout from '../../components/FreqReadout.vue';
import IntonationSetupPanel from '../../components/IntonationSetupPanel.vue';
import Spectrogram from '../../components/Spectrogram.vue';
import Spectrum from '../../components/Spectrum.vue';
import Waveform from '../../components/Waveform.vue';

const analysis = useAnalysisPort();
const { t } = useL10n();

onMounted(analysis.activate);
onUnmounted(analysis.deactivate);
</script>

<template>
  <section class="workspace-stack" aria-labelledby="analysis-heading">
    <header class="workspace-heading workspace-heading-row">
      <div>
        <h2 id="analysis-heading">{{ t('nav.analysis') }}</h2>
        <p>{{ t('analysis.subtitle') }}</p>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="analysis.sessionStatus === 'stopping'"
        @click="analysis.toggle"
      >
        {{ analysis.isListening ? t('stop.mic') : t('start.mic') }}
      </button>
    </header>

    <div v-if="analysis.error" class="error-banner" role="alert">
      <span>{{ analysis.error }}</span>
      <button type="button" @click="analysis.clearError()">{{ t('dismiss') }}</button>
    </div>

    <div class="analysis-toolbar card">
      <label class="toggle-control">
        <input
          :checked="analysis.showWaveform"
          type="checkbox"
          @change="analysis.setShowWaveform(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('waveform') }}</span>
      </label>
      <label class="toggle-control">
        <input
          :checked="analysis.showSpectrum"
          type="checkbox"
          @change="analysis.setShowSpectrum(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('spectrum') }}</span>
      </label>
      <label class="toggle-control">
        <input
          :checked="analysis.showSpectrogram"
          type="checkbox"
          @change="analysis.setShowSpectrogram(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('spectrogram') }}</span>
      </label>
      <DisplayModeSelector :mode="analysis.displayMode" @change="analysis.setDisplayMode" />
    </div>

    <div v-if="analysis.isListening" class="analysis-grid">
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
      <strong>{{ t('analysis.idle') }}</strong>
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
          :feedback-flash="analysis.feedbackFlash"
          :feedback-sound="analysis.feedbackSound"
          :feedback-vibrate="analysis.feedbackVibrate"
          :readout-stability="analysis.readoutStability"
          @fullscreen="analysis.toggleFullscreen"
          @layout-change="analysis.setLayoutMode"
          @left-handed-change="analysis.setLeftHanded"
          @theme-change="analysis.setThemeMode"
          @feedback-flash-change="analysis.setFeedbackFlash"
          @feedback-sound-change="analysis.setFeedbackSound"
          @feedback-vibrate-change="analysis.setFeedbackVibrate"
          @readout-stability-change="analysis.setReadoutStability"
        />
      </div>
      <IntonationSetupPanel
        class="analysis-wide"
        :detected-frequency="analysis.detectionFrame.freq"
        :is-listening="analysis.isListening"
      />
    </div>
  </section>
</template>
