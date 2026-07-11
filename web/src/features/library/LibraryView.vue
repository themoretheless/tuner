<script setup lang="ts">
import { ref } from 'vue';
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

type LibrarySection = 'setup' | 'temperament' | 'custom';

const activeSection = ref<LibrarySection>('setup');
const sections: LibrarySection[] = ['setup', 'temperament', 'custom'];

function handleSectionKey(event: KeyboardEvent, index: number) {
  let nextIndex = index;
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % sections.length;
  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + sections.length) % sections.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = sections.length - 1;
  else return;

  event.preventDefault();
  activeSection.value = sections[nextIndex];
  const tabs = (event.currentTarget as HTMLElement).parentElement
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  tabs?.[nextIndex]?.focus();
}
</script>

<template>
  <section class="workspace-stack" aria-labelledby="library-heading">
    <header class="workspace-heading">
      <h2 id="library-heading">{{ t('nav.library') }}</h2>
      <p>{{ t('library.subtitle') }}</p>
    </header>

    <div class="segmented library-tabs" role="tablist" :aria-label="t('library.sections')">
      <button
        v-for="(section, index) in sections"
        :id="`library-tab-${section}`"
        :key="section"
        type="button"
        role="tab"
        :aria-controls="`library-panel-${section}`"
        :aria-selected="activeSection === section"
        :class="{ active: activeSection === section }"
        :data-testid="`library-tab-${section}`"
        :tabindex="activeSection === section ? 0 : -1"
        @click="activeSection = section"
        @keydown="handleSectionKey($event, index)"
      >
        {{ t(`library.tab.${section}`) }}
      </button>
    </div>

    <div
      v-show="activeSection === 'setup'"
      id="library-panel-setup"
      class="library-tab-content"
      role="tabpanel"
      aria-labelledby="library-tab-setup"
      data-testid="library-panel-setup"
      tabindex="0"
    >
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
      <div v-if="library.strings.length" class="workspace-panel card">
        <StringOffsetsPanel
          :get-note-display="library.getNoteDisplay"
          :offsets="library.activeStringOffsets"
          :profile="library.sweeteningProfile"
          :strings="library.strings"
          @offset-change="library.setStringOffset"
          @profile-change="library.setSweeteningProfile"
        />
      </div>
    </div>

    <div
      v-show="activeSection === 'temperament'"
      id="library-panel-temperament"
      class="library-tab-content"
      role="tabpanel"
      aria-labelledby="library-tab-temperament"
      data-testid="library-panel-temperament"
      tabindex="0"
    >
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
    </div>

    <div
      v-show="activeSection === 'custom'"
      id="library-panel-custom"
      class="library-tab-content"
      role="tabpanel"
      aria-labelledby="library-tab-custom"
      data-testid="library-panel-custom"
      tabindex="0"
    >
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
    </div>
  </section>
</template>
