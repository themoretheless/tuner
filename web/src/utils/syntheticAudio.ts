import { NOTE_NAMES, noteWithA4, type NoteName } from './notes';

const DEFAULT_SYNTHETIC_SAMPLE_RATE = 44100;
const DEFAULT_SYNTHETIC_GAIN = 0.35;

export interface SyntheticAudioFixture {
  id: string;
  label: string;
  frequency: number;
  sampleRate: number;
  gain: number;
}

function isNoteName(value: string): value is NoteName {
  return (NOTE_NAMES as readonly string[]).includes(value);
}

export function resolveSyntheticAudioFixture(rawFixture: string | null | undefined): SyntheticAudioFixture | null {
  const raw = rawFixture?.trim();
  if (!raw || raw.toLowerCase() === 'off') return null;

  const hzMatch = raw.match(/^(\d+(?:\.\d+)?)(?:hz)?$/i);
  if (hzMatch) {
    const frequency = Number(hzMatch[1]);
    if (!Number.isFinite(frequency) || frequency <= 0) return null;
    return {
      id: `${frequency}hz`,
      label: `${frequency} Hz`,
      frequency,
      sampleRate: DEFAULT_SYNTHETIC_SAMPLE_RATE,
      gain: DEFAULT_SYNTHETIC_GAIN,
    };
  }

  const noteMatch = raw.match(/^([a-gA-G])(#?)(-?\d{1,2})$/);
  if (!noteMatch) return null;

  const name = `${noteMatch[1].toUpperCase()}${noteMatch[2]}` as string;
  if (!isNoteName(name)) return null;

  const octave = Number(noteMatch[3]);
  if (!Number.isInteger(octave)) return null;

  const note = noteWithA4({ name, octave });
  return {
    id: `${name}${octave}`,
    label: `${name}${octave}`,
    frequency: note.frequency,
    sampleRate: DEFAULT_SYNTHETIC_SAMPLE_RATE,
    gain: DEFAULT_SYNTHETIC_GAIN,
  };
}

export function syntheticAudioFixtureFromLocation() {
  if (typeof window === 'undefined') return null;
  return resolveSyntheticAudioFixture(new URLSearchParams(window.location.search).get('fixture'));
}

export function fillSyntheticAudioBuffer(
  buffer: Float32Array,
  fixture: SyntheticAudioFixture,
  startSample: number,
) {
  const fundamental = 2 * Math.PI * fixture.frequency;
  for (let i = 0; i < buffer.length; i += 1) {
    const t = (startSample + i) / fixture.sampleRate;
    const root = Math.sin(fundamental * t);
    const second = Math.sin(fundamental * 2 * t) * 0.16;
    const third = Math.sin(fundamental * 3 * t) * 0.08;
    buffer[i] = (root + second + third) * fixture.gain;
  }
  return startSample + buffer.length;
}
