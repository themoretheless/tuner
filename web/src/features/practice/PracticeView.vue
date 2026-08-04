<script setup lang="ts">
import { usePracticePort } from '../../app/featurePorts';
import { useL10n } from '../../stores/l10n';
import EarTrainingPanel from '../../components/EarTrainingPanel.vue';
import MetronomePanel from '../../components/MetronomePanel.vue';
import PracticeStatsPanel from '../../components/PracticeStatsPanel.vue';

const practice = usePracticePort();
const { t } = useL10n();
</script>

<template>
  <section class="workspace-stack" aria-labelledby="practice-heading">
    <header class="workspace-heading">
      <h2 id="practice-heading">{{ t('nav.practice') }}</h2>
      <p>{{ t('practice.subtitle') }}</p>
    </header>
    <div class="practice-grid">
      <EarTrainingPanel
        :accuracy="practice.earTrainingAccuracy"
        :attempts="practice.earTrainingAttempts"
        :can-mark="practice.earTrainingCanMark"
        :correct="practice.earTrainingCorrect"
        :get-note-display="practice.getNoteDisplay"
        :revealed="practice.earTrainingRevealed"
        :streak="practice.earTrainingStreak"
        :target="practice.earTrainingTarget"
        @mark="practice.markEarTraining"
        @next="practice.nextEarTraining"
        @play="practice.playEarTraining"
        @reset="practice.resetEarTraining"
        @reveal="practice.revealEarTraining"
      />
      <MetronomePanel
        :beat="practice.metronomeBeat"
        :beats="practice.metronomeBeats"
        :bpm="practice.metronomeBpm"
        :is-running="practice.metronomeRunning"
        :subdivision="practice.metronomeSubdivision"
        :subdivision-step="practice.metronomeSubdivisionStep"
        @beats-change="practice.setMetronomeBeats"
        @bpm-change="practice.setMetronomeBpm"
        @subdivision-change="practice.setMetronomeSubdivision"
        @tap="practice.tapMetronome"
        @toggle="practice.toggleMetronome"
      />
    </div>
    <PracticeStatsPanel
      :export-stats="practice.exportPracticeStats"
      :history="practice.practiceHistory"
      :summary="practice.practiceSummary"
      @clear="practice.clearPracticeHistory"
    />
  </section>
</template>
