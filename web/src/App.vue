<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { createFeaturePorts, featurePortKeys } from './app/featurePorts';
import { useTuner } from './composables/useTuner';
import { useL10n } from './stores/l10n';
import LiveTunerView from './features/tuner/LiveTunerView.vue';

const AnalysisView = defineAsyncComponent(() => import('./features/analysis/AnalysisView.vue'));
const LibraryView = defineAsyncComponent(() => import('./features/library/LibraryView.vue'));
const PipelineView = defineAsyncComponent(() => import('./features/pipeline/PipelineView.vue'));
const PracticeView = defineAsyncComponent(() => import('./features/practice/PracticeView.vue'));

type AppView = 'tuner' | 'pipeline' | 'library' | 'practice' | 'analysis';

const tuner = useTuner();
const ports = createFeaturePorts(tuner);
provide(featurePortKeys.live, ports.live);
provide(featurePortKeys.library, ports.library);
provide(featurePortKeys.practice, ports.practice);
provide(featurePortKeys.analysis, ports.analysis);
provide(featurePortKeys.pipeline, ports.pipeline);

const { lang, t, toggleLang } = useL10n();
const activeView = ref<AppView>('tuner');
const views: AppView[] = ['tuner', 'pipeline', 'library', 'practice', 'analysis'];
const appClasses = computed(() => [
  `theme-${tuner.themeMode.value}`,
  `layout-${tuner.layoutMode.value}`,
  { 'layout-left-handed': tuner.leftHanded.value },
]);
const sessionLabel = computed(() => {
  if (tuner.sessionStatus.value === 'starting') return t('requesting');
  if (tuner.sessionStatus.value === 'stopping') return t('stopping');
  if (tuner.sessionStatus.value === 'error') return t('session.error');
  return tuner.isListening.value ? t('listening') : t('ready');
});

function toggleMic() {
  if (tuner.sessionStatus.value === 'starting' || tuner.sessionStatus.value === 'listening') {
    void tuner.stop();
  }
  else void tuner.start();
}

function handleKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, select, textarea, button, [contenteditable="true"]')) return;
  if (event.key === ' ' || event.key.toLowerCase() === 'm') {
    event.preventDefault();
    toggleMic();
  }
  if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'p') {
    tuner.toggleReferenceTone();
  }
  const stringNumber = Number.parseInt(event.key, 10);
  const string = tuner.strings.value[stringNumber - 1];
  if (stringNumber >= 1 && stringNumber <= 9 && string) {
    tuner.toggleString(string, stringNumber - 1);
  }
}

watch(tuner.layoutMode, (layout) => {
  if (layout === 'stage') activeView.value = 'tuner';
});

onMounted(() => window.addEventListener('keydown', handleKey));
onUnmounted(() => window.removeEventListener('keydown', handleKey));
</script>

<template>
  <div class="app-root" :class="appClasses">
    <header class="app-header app-width">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true">♪</div>
        <div>
          <h1>{{ t('app.title') }}</h1>
          <p>{{ t('subtitle') }}</p>
        </div>
      </div>
      <div class="header-actions">
        <button type="button" class="utility-button" :aria-label="t('language.toggle')" @click="toggleLang">
          {{ lang === 'ru' ? 'RU' : 'EN' }}
        </button>
        <div
          data-testid="session-status"
          class="session-pill"
          :data-detector-backend="tuner.detectorBackend.value"
          :data-state="tuner.sessionStatus.value"
        >
          <span class="status-dot" aria-hidden="true"></span>
          <span>{{ sessionLabel }}</span>
        </div>
      </div>
    </header>

    <nav class="app-tabs app-width" role="tablist" :aria-label="t('nav.label')">
      <button
        v-for="view in views"
        :key="view"
        type="button"
        role="tab"
        :aria-selected="activeView === view"
        :class="{ active: activeView === view }"
        @click="activeView = view"
      >
        {{ t(`nav.${view}`) }}
      </button>
    </nav>

    <main class="app-main app-width">
      <LiveTunerView v-if="activeView === 'tuner'" />
      <PipelineView v-else-if="activeView === 'pipeline'" />
      <LibraryView v-else-if="activeView === 'library'" />
      <PracticeView v-else-if="activeView === 'practice'" />
      <AnalysisView v-else />
    </main>

    <footer class="app-footer app-width">
      <span>{{ t('quiet.room') }}</span>
      <span>{{ t('keyboard.hint') }}</span>
    </footer>
  </div>
</template>
