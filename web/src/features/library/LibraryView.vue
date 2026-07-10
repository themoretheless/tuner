<script setup lang="ts">
import { useLibraryPort } from '../../app/featurePorts';
import { useL10n } from '../../stores/l10n';
import CustomTuningEditor from '../../components/CustomTuningEditor.vue';
import CustomTuningTransfer from '../../components/CustomTuningTransfer.vue';
import InstrumentProfileEditor from '../../components/InstrumentProfileEditor.vue';
import ProfileTransferPanel from '../../components/ProfileTransferPanel.vue';
import StringOffsetsPanel from '../../components/StringOffsetsPanel.vue';
import StringSelector from '../../components/StringSelector.vue';
import TemperamentPanel from '../../components/TemperamentPanel.vue';
import TuningOptions from '../../components/TuningOptions.vue';
import TuningSelector from '../../components/TuningSelector.vue';

const library = useLibraryPort();
const { t } = useL10n();
</script>

<template>
  <section class="workspace-stack" aria-labelledby="library-heading">
    <header class="workspace-heading">
      <h2 id="library-heading">{{ t('nav.library') }}</h2>
      <p>{{ t('library.subtitle') }}</p>
    </header>

    <div class="workspace-panel card">
      <TuningOptions
        :active-instrument="library.activeInstrument"
        :capo="library.capo"
        :instruments="library.instrumentOptions"
        :temperament="library.temperament"
        :temperaments="library.temperamentOptions"
        :transpose="library.transpose"
        @instrument-change="library.setInstrument"
        @capo-change="library.setCapo"
        @temperament-change="library.setTemperament"
        @transpose-change="library.setTranspose"
      />
      <TuningSelector
        :tunings="library.allTunings"
        :current="library.currentTuning"
        @change="library.setTuning"
      />
      <StringSelector
        v-if="library.strings.length"
        :strings="library.strings"
        :selected="library.selectedString"
        :selected-index="library.selectedStringIndex"
        :left-handed="library.leftHanded"
        :get-note-display="library.getNoteDisplay"
        :format-freq="library.formatFreq"
        @toggle="library.toggleString"
      />
    </div>

    <div class="library-grid">
      <div class="workspace-panel card">
        <TemperamentPanel
          :custom-temperaments="library.customTemperaments"
          :offsets="library.temperamentOffsets"
          :root="library.temperamentRoot"
          :temperament="library.temperament"
          :temperaments="library.temperamentOptions"
          @delete="library.deleteCustomTemperament"
          @root-change="library.setTemperamentRoot"
          @save="library.saveCustomTemperament"
        />
      </div>
      <div class="workspace-panel card">
        <StringOffsetsPanel
          v-if="library.strings.length"
          :get-note-display="library.getNoteDisplay"
          :offsets="library.activeStringOffsets"
          :profile="library.sweeteningProfile"
          :strings="library.strings"
          @offset-change="library.setStringOffset"
          @profile-change="library.setSweeteningProfile"
        />
      </div>
    </div>

    <div class="library-grid">
      <div class="workspace-panel card">
        <CustomTuningEditor
          :current="library.currentTuning"
          :strings="library.strings"
          @save="library.saveCustomTuning"
          @delete="library.deleteCustomTuning"
        />
        <CustomTuningTransfer
          :tunings="library.customTunings"
          @import="library.importCustomTunings"
        />
      </div>
      <div class="workspace-panel card">
        <InstrumentProfileEditor
          :custom-instruments="library.customInstruments"
          @delete="library.deleteInstrumentProfile"
          @save="library.saveInstrumentProfile"
        />
      </div>
    </div>

    <div class="workspace-panel card">
      <ProfileTransferPanel
        :export-profile="library.exportUserProfile"
        :import-profile="library.importUserProfile"
      />
    </div>
  </section>
</template>
