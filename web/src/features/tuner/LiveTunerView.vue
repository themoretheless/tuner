<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useLiveTunerPort } from '../../app/featurePorts';
import { useL10n } from '../../stores/l10n';
import { TuneAnnouncer, snapshotOf, type TuneSnapshot } from '../../utils/tuneA11y';
import {
  CentsStabilizer,
  InTuneConfirmation,
  fireInTuneFeedback,
} from '../../utils/inTuneFeedback';
import { parseA4Input } from '../../utils/a4Input';
import CentsGauge from '../../components/CentsGauge.vue';
import AudioFileInput from '../../components/AudioFileInput.vue';
import DebugOverlay from '../../components/DebugOverlay.vue';
import DisplayModeSelector from '../../components/DisplayModeSelector.vue';
import FreqReadout from '../../components/FreqReadout.vue';
import HzGauge from '../../components/HzGauge.vue';
import InputDeviceSelector from '../../components/InputDeviceSelector.vue';
import LevelMeter from '../../components/LevelMeter.vue';
import MicButton from '../../components/MicButton.vue';
import NoteDisplay from '../../components/NoteDisplay.vue';
import StringSelector from '../../components/StringSelector.vue';
import TuningSelector from '../../components/TuningSelector.vue';

const tuner = useLiveTunerPort();
const { t } = useL10n();

// M63: A4 принимает точку или запятую как десятичный разделитель.
// Мусор отклоняется, поле откатывается к текущему значению;
// кламп диапазона 420–460 остаётся на стороне tuner.setA4.
function onA4Change(event: Event) {
  const input = event.target as HTMLInputElement;
  const parsed = parseA4Input(input.value);
  if (parsed === null) {
    input.value = String(tuner.a4);
    return;
  }
  tuner.setA4(parsed);
  input.value = String(tuner.a4);
}

// Diagnostic overlay (raw vs smoothed detector output + signal recorder),
// enabled with ?debug=1 so it never shows up in normal use.
const debugEnabled = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('debug');

// Single polite live region for the tuner readout. The TuneAnnouncer
// throttles to at most ~1 announcement/second and only speaks up on a note
// change or a meaningful tune-state transition (incl. an explicit "in tune").
const announcer = new TuneAnnouncer({ intervalMs: 1000 });
const liveAnnouncement = ref('');

const tuneSnapshot = computed(() => snapshotOf({
  note: tuner.currentNoteDisplay,
  cents: tuner.cents,
  isInTune: tuner.isInTune,
  isDetected: tuner.hasDetection,
}));

function formatAnnouncement(s: TuneSnapshot): string {
  const note = s.note ?? '';
  switch (s.state) {
    case 'in-tune': return t('a11y.announce.inTune').replace('{note}', note);
    case 'near': return t(s.direction === 'sharp' ? 'a11y.announce.nearSharp' : 'a11y.announce.nearFlat')
      .replace('{note}', note);
    case 'out': return t(s.direction === 'sharp' ? 'a11y.announce.sharp' : 'a11y.announce.flat')
      .replace('{note}', note);
    default: return t('waiting.signal');
  }
}

watch(tuneSnapshot, (snapshot) => {
  const accepted = announcer.push(snapshot);
  if (accepted) liveAnnouncement.value = formatAnnouncement(accepted);
});

// M73: one-shot "in tune" confirmation. Fires only on the transition INTO
// in-tune (re-arms after the note leaves the tolerance band), never per
// frame. Channels are user-toggleable in display preferences; the flash is
// additionally suppressed by prefers-reduced-motion inside fireInTuneFeedback.
const confirmation = new InTuneConfirmation();
const inTuneFlash = ref(false);
let flashTimer: ReturnType<typeof setTimeout> | null = null;

watch(tuneSnapshot, (snapshot) => {
  if (!confirmation.push(snapshot.state)) return;
  const fired = fireInTuneFeedback({
    sound: tuner.feedbackSound,
    vibrate: tuner.feedbackVibrate,
    flash: tuner.feedbackFlash,
  });
  if (!fired.flashed) return;
  if (flashTimer != null) clearTimeout(flashTimer);
  inTuneFlash.value = true;
  flashTimer = setTimeout(() => {
    flashTimer = null;
    inTuneFlash.value = false;
  }, 450);
});

// M62: readout stability ("needle steadiness") — display-only EMA on the
// cents value shown on the gauge. The detection pipeline, in-tune hysteresis
// and announcements are untouched; null detection resets the filter.
const stabilizer = new CentsStabilizer();
const displayCents = ref(tuner.cents);

watch(() => tuner.readoutStability, (stability) => {
  stabilizer.setStability(stability);
}, { immediate: true });

watch(() => [tuner.cents, tuner.hasDetection] as const, ([cents, detected]) => {
  if (!detected) {
    stabilizer.reset();
    displayCents.value = cents;
    return;
  }
  displayCents.value = stabilizer.add(cents) ?? cents;
});
</script>

<template>
  <section class="live-workspace" aria-labelledby="live-tuner-heading">
    <DebugOverlay
      v-if="debugEnabled"
      :frame="tuner.diagnosticFrame"
      :backend="tuner.detectorBackend"
      :is-listening="tuner.isListening"
      :selected-input-device-id="tuner.selectedInputDeviceId"
      :frame-timebase="tuner.detectionFrameTimebase"
      :can-capture-pcm="tuner.exactPcmCaptureAvailable"
      :begin-capture="tuner.beginExactPcmCapture"
      :finish-capture="tuner.finishExactPcmCapture"
    />
    <div class="live-panel card">
      <div class="sr-only" id="live-tuner-heading">{{ t('nav.tuner') }}</div>
      <span
        class="sr-only"
        data-testid="tune-announcer"
        aria-live="polite"
        aria-atomic="true"
      >{{ liveAnnouncement }}</span>
      <MicButton
        :is-listening="tuner.isListening"
        :status="tuner.sessionStatus"
        @toggle="tuner.toggle"
      />
      <LevelMeter :level="tuner.volume" :active="tuner.isListening" />

      <div v-if="tuner.error" class="error-banner" role="alert">
        <span>{{ tuner.error }}</span>
        <button type="button" @click="tuner.clearError()">{{ t('dismiss') }}</button>
      </div>

      <div
        v-if="tuner.isListening && tuner.detectorBackend === 'typescript'"
        class="degraded-banner"
        role="status"
      >
        {{ t('detector.degraded') }}
      </div>

      <NoteDisplay
        :confidence="tuner.detectionFrame.confidence"
        :display="tuner.currentNoteDisplay"
        :is-power-chord="tuner.detectionFrame.isPower"
        :is-detected="tuner.hasDetection"
        :target-name="tuner.getNoteDisplay(tuner.targetNote)"
        :target-freq="tuner.targetNote.frequency"
        :format-freq="tuner.formatFreq"
      />
      <div
        class="gauge-stage"
        :class="{ 'in-tune-flash': inTuneFlash }"
        data-testid="gauge-stage"
      >
        <CentsGauge
          :cents="displayCents"
          :mode="tuner.displayMode"
          :is-in-tune="tuner.isInTune"
          :is-detected="tuner.hasDetection"
        />
      </div>
      <HzGauge
        :detected="tuner.detectionFrame.freq"
        :target="tuner.targetNote.frequency"
        :is-in-tune="tuner.isInTune"
      />
      <DisplayModeSelector :mode="tuner.displayMode" @change="tuner.setDisplayMode" />
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
            type="text"
            inputmode="decimal"
            :value="tuner.a4"
            @change="onA4Change($event)"
          />
        </label>
      </div>

      <InputDeviceSelector
        v-if="!tuner.usingFileAudio && !tuner.usingSyntheticAudio"
        :devices="tuner.inputDevices"
        :selected-device-id="tuner.selectedInputDeviceId"
        @refresh="tuner.refreshInputDevices"
        @select="tuner.setInputDevice"
      />

      <AudioFileInput
        :active="tuner.usingFileAudio"
        :duration="tuner.fileAudioDuration"
        :file-name="tuner.fileAudioName"
        :progress="tuner.fileAudioProgress"
        @select="tuner.loadAudioFile"
        @microphone="tuner.useMicrophoneInput"
      />

      <FreqReadout
        :detected="tuner.detectionFrame.freq"
        :target="tuner.targetNote.frequency"
        :format-freq="tuner.formatFreq"
      />

      <div class="command-row">
        <button type="button" class="btn btn-ghost" @click="tuner.toggleReferenceTone">
          <span aria-hidden="true">{{ tuner.referencePlaying ? '■' : '▶' }}</span>
          <span>{{ t('play.reference') }}</span>
        </button>
        <button type="button" class="btn btn-primary" @click="tuner.toggle">
          {{ tuner.usingFileAudio
            ? (tuner.isListening ? t('audio.file.stop') : t('audio.file.replay'))
            : (tuner.isListening ? t('stop.mic') : t('start.mic')) }}
        </button>
      </div>
    </aside>
  </section>
</template>

<style scoped>
/* M73: brief halo pulse on the gauge when the note locks into tune. The
   pulse is purely visual; screen readers already get the polite announcement
   via the live region, and fireInTuneFeedback skips the flash entirely when
   the user prefers reduced motion. */
.gauge-stage {
  border-radius: 12px;
}

.gauge-stage.in-tune-flash {
  animation: in-tune-confirm-pulse 450ms ease-out;
}

@keyframes in-tune-confirm-pulse {
  0% {
    box-shadow: 0 0 0 0 rgb(16 185 129 / 0.55);
  }
  100% {
    box-shadow: 0 0 0 22px rgb(16 185 129 / 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gauge-stage.in-tune-flash {
    animation: none;
  }
}
</style>
