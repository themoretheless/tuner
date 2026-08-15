import type {
  AudioOutputPort,
  AudioPlaybackScope,
  ToneRequest,
} from '../ports/audioOutput';
import { createAudioContext } from '../utils/audio';

type AudioContextFactory = () => AudioContext;

interface ActiveTone {
  filter: BiquadFilterNode | null;
  gain: GainNode;
  oscillator: OscillatorNode;
}

export function createWebAudioOutputPort(
  createContext: AudioContextFactory = createAudioContext,
): AudioOutputPort {
  const scopes = new Set<Set<ActiveTone>>();
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let disposed = false;

  function getContext() {
    if (disposed) throw new Error('Audio output is disposed');
    context ??= createContext();
    if (!masterGain) {
      masterGain = context.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(context.destination);
    }
    return context;
  }

  async function resume() {
    const audioContext = getContext();
    if (audioContext.state === 'suspended') await audioContext.resume();
  }

  function createScope(): AudioPlaybackScope {
    const activeTones = new Set<ActiveTone>();
    let scopeDisposed = false;
    scopes.add(activeTones);

    function stopAll() {
      for (const tone of [...activeTones]) stopTone(tone);
    }

    return {
      currentTime: () => getContext().currentTime,
      dispose() {
        if (scopeDisposed) return;
        scopeDisposed = true;
        stopAll();
        scopes.delete(activeTones);
      },
      playTone(request) {
        if (scopeDisposed || !isValidRequest(request)) return;
        const audioContext = getContext();
        void resume().catch(() => {});
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = request.lowpassHz ? audioContext.createBiquadFilter() : null;
        const tone = { filter, gain, oscillator };
        const startAt = Math.max(audioContext.currentTime, request.startAt ?? audioContext.currentTime);

        oscillator.type = request.waveform ?? 'sine';
        oscillator.frequency.setValueAtTime(request.frequency, startAt);
        configureEnvelope(gain.gain, request, startAt);
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(request.lowpassHz!, startAt);
          oscillator.connect(filter);
          filter.connect(gain);
        } else {
          oscillator.connect(gain);
        }
        gain.connect(masterGain!);
        oscillator.onended = () => cleanupTone(tone);
        activeTones.add(tone);
        oscillator.start(startAt);
        if (request.durationSeconds) {
          oscillator.stop(startAt + request.durationSeconds + 0.005);
        }
      },
      resume,
      stopAll,
    };

    function stopTone(tone: ActiveTone) {
      try { tone.oscillator.stop(); } catch {}
      cleanupTone(tone);
    }

    function cleanupTone(tone: ActiveTone) {
      if (!activeTones.delete(tone)) return;
      tone.oscillator.disconnect();
      tone.filter?.disconnect();
      tone.gain.disconnect();
    }
  }

  async function dispose() {
    if (disposed) return;
    for (const activeTones of scopes) {
      for (const tone of [...activeTones]) {
        try { tone.oscillator.stop(); } catch {}
        tone.oscillator.disconnect();
        tone.filter?.disconnect();
        tone.gain.disconnect();
      }
      activeTones.clear();
    }
    scopes.clear();
    masterGain?.disconnect();
    masterGain = null;
    const currentContext = context;
    context = null;
    disposed = true;
    if (currentContext && currentContext.state !== 'closed') await currentContext.close();
  }

  return { createScope, dispose };
}

// A timed tone that ends at full gain clicks. When the caller sets a duration
// but no release, fade out over this window instead of cutting the oscillator.
const MIN_RELEASE_SECONDS = 0.02;

function configureEnvelope(gain: AudioParam, request: ToneRequest, startAt: number) {
  const attack = clampDuration(request.attackSeconds);
  const duration = clampDuration(request.durationSeconds);
  const requestedRelease = clampDuration(request.releaseSeconds) || MIN_RELEASE_SECONDS;
  const release = Math.min(requestedRelease, duration);
  gain.cancelScheduledValues(startAt);
  if (attack > 0) {
    gain.setValueAtTime(0.0001, startAt);
    gain.exponentialRampToValueAtTime(request.gain, startAt + attack);
  } else {
    gain.setValueAtTime(request.gain, startAt);
  }
  if (duration > 0 && release > 0) {
    const releaseAt = Math.max(startAt + attack, startAt + duration - release);
    gain.setValueAtTime(request.gain, releaseAt);
    gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  }
}

function isValidRequest(request: ToneRequest) {
  return Number.isFinite(request.frequency)
    && request.frequency > 0
    && Number.isFinite(request.gain)
    && request.gain > 0;
}

function clampDuration(value: number | undefined) {
  return Number.isFinite(value) && value! > 0 ? value! : 0;
}
