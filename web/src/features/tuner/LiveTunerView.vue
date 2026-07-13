<script setup lang="ts">
import { useLiveTunerPort } from '../../app/featurePorts';
import { useL10n } from '../../stores/l10n';
import { Play, Square } from '@lucide/vue';
import CentsGauge from '../../components/CentsGauge.vue';
import DisplayModeSelector from '../../components/DisplayModeSelector.vue';
import FreqReadout from '../../components/FreqReadout.vue';
import InputDeviceSelector from '../../components/InputDeviceSelector.vue';
import LevelMeter from '../../components/LevelMeter.vue';
import MicButton from '../../components/MicButton.vue';
import NoteDisplay from '../../components/NoteDisplay.vue';
import StringSelector from '../../components/StringSelector.vue';
import TuningSelector from '../../components/TuningSelector.vue';

const tuner = useLiveTunerPort();
const { t } = useL10n();

function toggleMic() {
  if (tuner.sessionStatus === 'starting' || tuner.sessionStatus === 'listening') {
    void tuner.stop();
  }
  else void tuner.start();
}
</script>

<template>
  <section class="live-workspace" aria-labelledby="live-tuner-heading">
    <div class="live-panel card">
      <div class="sr-only" id="live-tuner-heading">{{ t('nav.tuner') }}</div>
      <div v-if="tuner.error" class="error-banner" role="alert">
        <span>{{ tuner.error }}</span>
        <button type="button" @click="tuner.clearError()">{{ t('dismiss') }}</button>
      </div>

      <NoteDisplay
        :confidence="tuner.detectionFrame.confidence"
        :detected-freq="tuner.detectionFrame.freq"
        :display="tuner.currentNoteDisplay"
        :is-power-chord="tuner.detectionFrame.isPower"
        :is-detected="tuner.hasDetection"
        :target-name="tuner.getNoteDisplay(tuner.targetNote)"
        :target-freq="tuner.targetNote.frequency"
        :format-freq="tuner.formatFreq"
      />
      <CentsGauge
        :cents="tuner.cents"
        :mode="tuner.displayMode"
        :is-in-tune="tuner.isInTune"
        :is-detected="tuner.hasDetection"
        :is-listening="tuner.isListening"
      />
      <div class="tuner-input-row">
        <MicButton
          :is-listening="tuner.isListening"
          :status="tuner.sessionStatus"
          @toggle="toggleMic"
        />
        <div class="tuner-input-level">
          <LevelMeter :level="tuner.volume" :active="tuner.isListening" />
        </div>
        <DisplayModeSelector :mode="tuner.displayMode" @change="tuner.setDisplayMode" />
      </div>
    </div>

    <aside class="control-rail" :aria-label="t('quick.controls')">
      <div class="control-section">
        <div class="section-label">{{ t('quick.tuning') }}</div>
        <TuningSelector
          :tunings="tuner.allTunings"
          :current="tuner.currentTuning"
          @change="tuner.setTuning"
        />
        <StringSelector
          v-if="tuner.strings.length"
          :strings="tuner.strings"
          :selected="tuner.selectedString"
          :selected-index="tuner.selectedStringIndex"
          :left-handed="tuner.leftHanded"
          :get-note-display="tuner.getNoteDisplay"
          :format-freq="tuner.formatFreq"
          @toggle="tuner.toggleString"
        />
        <p v-else class="empty-copy">{{ t('chromatic') }}</p>
      </div>

      <div class="control-section control-grid">
        <label class="option-field">
          <span>{{ t('a4.label') }}</span>
          <input
            type="number"
            :value="tuner.a4"
            min="420"
            max="460"
            step="1"
            @change="tuner.setA4(Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <label v-if="tuner.nativeAudioAvailable" class="option-field">
          <span>{{ t('audio.backend') }}</span>
          <select
            :value="tuner.audioBackend"
            @change="tuner.setAudioBackend(($event.target as HTMLSelectElement).value as 'web' | 'native')"
          >
            <option value="web">{{ t('audio.backend.web') }}</option>
            <option value="native">{{ t('audio.backend.native') }}</option>
          </select>
        </label>
      </div>

      <InputDeviceSelector
        v-if="!tuner.usingNativeAudio"
        :devices="tuner.inputDevices"
        :selected-device-id="tuner.selectedInputDeviceId"
        @refresh="tuner.refreshInputDevices"
        @select="tuner.setInputDevice"
      />

      <FreqReadout
        :detected="tuner.detectionFrame.freq"
        :target="tuner.targetNote.frequency"
        :format-freq="tuner.formatFreq"
      />

      <div class="command-row">
        <button type="button" class="btn btn-ghost" @click="tuner.toggleReferenceTone">
          <Square v-if="tuner.referencePlaying" :size="15" fill="currentColor" aria-hidden="true" />
          <Play v-else :size="16" fill="currentColor" aria-hidden="true" />
          <span>{{ t('play.reference') }}</span>
        </button>
      </div>
    </aside>
  </section>
</template>
