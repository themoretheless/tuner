import { ref, watch } from 'vue';
import { Store } from '@tauri-apps/plugin-store';

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

let store: Store | null = null;

async function getStore() {
  if (!isTauri) return null;
  if (!store) {
    store = await Store.load('settings.dat');
  }
  return store;
}

export function useSettings() {
  const a4 = ref(440);
  const lastTuningId = ref('standard');
  const showWaveform = ref(true);
  const showSpectrum = ref(false);

  async function load() {
    if (isTauri) {
      const s = await getStore();
      if (s) {
        const savedA4 = await s.get<number>('a4');
        if (savedA4 != null) a4.value = savedA4;
        const savedTuning = await s.get<string>('lastTuningId');
        if (savedTuning) lastTuningId.value = savedTuning;
        const savedWave = await s.get<boolean>('showWaveform');
        if (savedWave != null) showWaveform.value = savedWave;
        const savedSpec = await s.get<boolean>('showSpectrum');
        if (savedSpec != null) showSpectrum.value = savedSpec;
      }
    } else {
      const savedA4 = localStorage.getItem('a4');
      if (savedA4) a4.value = parseInt(savedA4);
      const savedTuning = localStorage.getItem('lastTuningId');
      if (savedTuning) lastTuningId.value = savedTuning;
      const savedWave = localStorage.getItem('showWaveform');
      if (savedWave !== null) showWaveform.value = savedWave === 'true';
      const savedSpec = localStorage.getItem('showSpectrum');
      if (savedSpec !== null) showSpectrum.value = savedSpec === 'true';
    }
  }

  async function save() {
    if (isTauri) {
      const s = await getStore();
      if (s) {
        await s.set('a4', a4.value);
        await s.set('lastTuningId', lastTuningId.value);
        await s.set('showWaveform', showWaveform.value);
        await s.set('showSpectrum', showSpectrum.value);
        await s.save();
      }
    } else {
      localStorage.setItem('a4', a4.value.toString());
      localStorage.setItem('lastTuningId', lastTuningId.value);
      localStorage.setItem('showWaveform', showWaveform.value.toString());
      localStorage.setItem('showSpectrum', showSpectrum.value.toString());
    }
  }

  // Auto save on change
  watch([a4, lastTuningId, showWaveform, showSpectrum], () => {
    save();
  }, { deep: true });

  // Load async, but initial values are fine for first render
  load();

  return {
    a4,
    lastTuningId,
    showWaveform,
    showSpectrum,
    load,
    save,
  };
}