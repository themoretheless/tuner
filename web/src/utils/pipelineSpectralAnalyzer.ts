import type { PipelineSpectralTelemetry } from '../domain/pipelineTelemetry';
import type { PitchDetectionRange } from './pitch';

const HARMONIC_COUNT = 5;
const OCTAVE_HARMONIC_PROBES = 6;
const MAX_NYQUIST_FRACTION = 0.45;

/** Compact spectral diagnostics for the TypeScript fallback path. */
export class PipelineSpectralAnalyzer {
  private windowed = new Float32Array(0);

  analyze(
    buffer: Float32Array,
    sampleRate: number,
    frequency: number | null | undefined,
    range?: PitchDetectionRange,
  ): PipelineSpectralTelemetry | null {
    if (
      buffer.length < 64
      || !Number.isFinite(sampleRate)
      || sampleRate <= 0
      || !Number.isFinite(frequency)
      || (frequency ?? 0) <= 0
    ) return null;

    this.prepareWindow(buffer);
    const baseFrequency = frequency!;
    const downAvailable = !range || baseFrequency * 0.5 >= range.minFrequency;
    const upAvailable = !range || baseFrequency * 2 <= range.maxFrequency;
    const powers = this.measurePowers(sampleRate, baseFrequency, downAvailable);
    const harmonics = normalize(powers.harmonics.slice(0, HARMONIC_COUNT)) as [
      number, number, number, number, number,
    ];
    const octaveScores = normalize([
      downAvailable ? powers.halfOdd : 0,
      powers.harmonics[0] + powers.harmonics[1] + powers.harmonics[2],
      upAvailable ? powers.harmonics[1] + powers.harmonics[3] + powers.harmonics[5] : 0,
    ]) as [number, number, number];

    return {
      activeOctave: 0,
      baseFrequency,
      harmonics,
      octaveScores,
      pendingOctave: 0,
    };
  }

  private prepareWindow(buffer: Float32Array) {
    if (this.windowed.length !== buffer.length) {
      this.windowed = new Float32Array(buffer.length);
    }
    const denominator = Math.max(1, buffer.length - 1);
    for (let index = 0; index < buffer.length; index += 1) {
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / denominator);
      this.windowed[index] = buffer[index] * hann;
    }
  }

  /** Match the Rust decision evidence with nine unique Goertzel probes. */
  private measurePowers(sampleRate: number, fundamental: number, includeHalfOdd: boolean) {
    const harmonics = Array.from({ length: OCTAVE_HARMONIC_PROBES }, (_, index) => (
      this.powerIfValid(sampleRate, fundamental * (index + 1))
    ));
    const halfOdd = includeHalfOdd
      ? [0.5, 1.5, 2.5].reduce((total, multiplier) => (
        total + this.powerIfValid(sampleRate, fundamental * multiplier)
      ), 0)
      : 0;
    return { halfOdd, harmonics };
  }

  private powerIfValid(sampleRate: number, frequency: number) {
    const limit = sampleRate * MAX_NYQUIST_FRACTION;
    return frequency > 0 && frequency < limit
      ? goertzelPower(this.windowed, sampleRate, frequency)
      : 0;
  }
}

function goertzelPower(buffer: Float32Array, sampleRate: number, frequency: number) {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let previous = 0;
  let previousPrevious = 0;
  for (const sample of buffer) {
    const current = sample + coefficient * previous - previousPrevious;
    previousPrevious = previous;
    previous = current;
  }
  return Math.max(0, previousPrevious ** 2 + previous ** 2 - coefficient * previous * previousPrevious);
}

function normalize(values: number[]) {
  const maximum = Math.max(0, ...values.filter(Number.isFinite));
  return values.map((value) => maximum > Number.EPSILON
    ? Math.max(0, Math.min(1, value / maximum))
    : 0);
}
