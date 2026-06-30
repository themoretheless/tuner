import { onUnmounted, ref, watch, type Ref } from 'vue';
import type { SpectrumFrame, WaveformFrame } from '../types/frames';

export type { SpectrumFrame, WaveformFrame } from '../types/frames';

export function useVisualizationFrames(
  analyser: Ref<AnalyserNode | null>,
  sampleRate: Ref<number>,
  active: Ref<boolean>,
) {
  const waveformFrame = ref<WaveformFrame | null>(null);
  const spectrumFrame = ref<SpectrumFrame | null>(null);

  let rafId: number | null = null;
  let sequence = 0;
  let waveformBuffer: Float32Array<ArrayBuffer> | null = null;
  let spectrumBuffer: Uint8Array<ArrayBuffer> | null = null;

  function capture() {
    const activeAnalyser = analyser.value;
    if (!active.value || !activeAnalyser) {
      stop();
      return;
    }

    if (!waveformBuffer || waveformBuffer.length !== activeAnalyser.fftSize) {
      waveformBuffer = new Float32Array(activeAnalyser.fftSize) as Float32Array<ArrayBuffer>;
    }
    if (!spectrumBuffer || spectrumBuffer.length !== activeAnalyser.frequencyBinCount) {
      spectrumBuffer = new Uint8Array(activeAnalyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    }

    activeAnalyser.getFloatTimeDomainData(waveformBuffer);
    activeAnalyser.getByteFrequencyData(spectrumBuffer);

    sequence += 1;
    waveformFrame.value = {
      samples: waveformBuffer,
      sampleRate: sampleRate.value,
      sequence,
    };
    spectrumFrame.value = {
      bins: spectrumBuffer,
      sampleRate: sampleRate.value,
      sequence,
    };

    rafId = requestAnimationFrame(capture);
  }

  function start() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(capture);
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    waveformFrame.value = null;
    spectrumFrame.value = null;
  }

  watch([active, analyser], ([isActive, activeAnalyser]) => {
    if (isActive && activeAnalyser) start();
    else stop();
  }, { immediate: true });

  onUnmounted(stop);

  return {
    spectrumFrame,
    start,
    stop,
    waveformFrame,
  };
}
