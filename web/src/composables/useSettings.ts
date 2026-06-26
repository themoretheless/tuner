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
  const showSpectrum = ref(true);
  const showSpectrogram = ref(false);
  const chromatic = ref(false); // tune to nearest of all 12 notes, not preset strings
  const inTuneTolerance = ref(5); // cents within which a note reads as in tune

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
        const savedSpecGram = await s.get<boolean>('showSpectrogram');
        if (savedSpecGram != null) showSpectrogram.value = savedSpecGram;
        const savedChromatic = await s.get<boolean>('chromatic');
        if (savedChromatic != null) chromatic.value = savedChromatic;
        const savedTol = await s.get<number>('inTuneTolerance');
        if (savedTol != null) inTuneTolerance.value = savedTol;
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
      const savedSpecGram = localStorage.getItem('showSpectrogram');
      if (savedSpecGram !== null) showSpectrogram.value = savedSpecGram === 'true';
      const savedChromatic = localStorage.getItem('chromatic');
      if (savedChromatic !== null) chromatic.value = savedChromatic === 'true';
      const savedTol = localStorage.getItem('inTuneTolerance');
      if (savedTol !== null) inTuneTolerance.value = parseInt(savedTol);
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
        await s.set('showSpectrogram', showSpectrogram.value);
        await s.set('chromatic', chromatic.value);
        await s.set('inTuneTolerance', inTuneTolerance.value);
        await s.save();
      }
    } else {
      localStorage.setItem('a4', a4.value.toString());
      localStorage.setItem('lastTuningId', lastTuningId.value);
      localStorage.setItem('showWaveform', showWaveform.value.toString());
      localStorage.setItem('showSpectrum', showSpectrum.value.toString());
      localStorage.setItem('showSpectrogram', showSpectrogram.value.toString());
      localStorage.setItem('chromatic', chromatic.value.toString());
      localStorage.setItem('inTuneTolerance', inTuneTolerance.value.toString());
    }
  }

  // Auto save on change
  watch([a4, lastTuningId, showWaveform, showSpectrum, showSpectrogram, chromatic, inTuneTolerance], () => {
    save();
  }, { deep: true });

  // Load async, but initial values are fine for first render. Expose the
  // promise so consumers can react once persisted values have been restored.
  const loaded = load();

  return {
    a4,
    lastTuningId,
    showWaveform,
    showSpectrum,
    showSpectrogram,
    chromatic,
    inTuneTolerance,
    loaded,
    load,
    save,
  };
}