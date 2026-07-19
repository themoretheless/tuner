export type IntonationAdjustment = 'lengthen' | 'none' | 'shorten';

export interface IntonationMeasurements {
  fretted12: number | null;
  harmonic12: number | null;
  open: number | null;
}

export interface IntonationSetupResult {
  adjustment: IntonationAdjustment;
  cents: number;
  octaveReferenceErrorCents: number | null;
  referenceReliable: boolean;
}

const SETUP_TOLERANCE_CENTS = 2;
const REFERENCE_TOLERANCE_CENTS = 15;

export function evaluateIntonationSetup(
  measurements: IntonationMeasurements,
): IntonationSetupResult | null {
  const harmonic = validFrequency(measurements.harmonic12) ? measurements.harmonic12 : null;
  const fretted = validFrequency(measurements.fretted12) ? measurements.fretted12 : null;
  if (harmonic == null || fretted == null) return null;

  const cents = octaveEquivalentCents(fretted, harmonic);
  const octaveReferenceErrorCents = validFrequency(measurements.open)
    ? octaveEquivalentCents(harmonic, measurements.open)
    : null;
  return {
    adjustment: cents > SETUP_TOLERANCE_CENTS
      ? 'lengthen'
      : cents < -SETUP_TOLERANCE_CENTS
        ? 'shorten'
        : 'none',
    cents,
    octaveReferenceErrorCents,
    referenceReliable: octaveReferenceErrorCents == null
      || Math.abs(octaveReferenceErrorCents) <= REFERENCE_TOLERANCE_CENTS,
  };
}

function octaveEquivalentCents(measured: number, reference: number) {
  const cents = 1_200 * Math.log2(measured / reference);
  return cents - Math.round(cents / 1_200) * 1_200;
}

function validFrequency(value: number | null): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0;
}
