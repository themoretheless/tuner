import { GATE_THRESHOLDS } from '../generated/gateThresholds';
import type { AudioInputWarning } from './audioInputDiagnostics';
import type { MicrophoneStartFailure } from './microphoneStartFailure';

// Cross-platform typed user-facing diagnostics. The stable codes below are the
// single contract shared by the web shell, the Tauri native audio stream
// (desktop/src-tauri/src/native_audio/signal_health.rs) and the egui frontend
// (egui/src/diagnostics.rs). Codes must stay stable: they travel over the
// Tauri event wire and are matched by name on every platform.

export type DiagnosticCategory =
  | 'input'
  | 'device'
  | 'permission'
  | 'signal-quality'
  | 'backend'
  | 'performance';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type DiagnosticSource = 'web' | 'tauri' | 'egui';

export type SignalDiagnosticCode =
  | 'signal-silent'
  | 'signal-clipping'
  | 'signal-dc-offset'
  | 'signal-hum';

export type MicrophoneDiagnosticCode =
  | 'mic-permission-denied'
  | 'mic-device-unavailable'
  | 'mic-device-busy'
  | 'mic-unknown-error'
  | 'mic-track-lost';

export type InputProcessingDiagnosticCode =
  | 'input-agc-active'
  | 'input-echo-cancellation-active'
  | 'input-noise-suppression-active'
  | 'input-multi-channel'
  | 'input-resampled'
  | 'input-settings-unavailable';

export type BackendDiagnosticCode =
  | 'backend-native-stream-failed'
  | 'backend-stream-lost'
  | 'backend-recovery-attempted'
  | 'backend-recovery-succeeded'
  | 'backend-recovery-failed';

export type DiagnosticCode =
  | SignalDiagnosticCode
  | MicrophoneDiagnosticCode
  | InputProcessingDiagnosticCode
  | BackendDiagnosticCode;

export const DIAGNOSTIC_CODES: readonly DiagnosticCode[] = [
  'signal-silent',
  'signal-clipping',
  'signal-dc-offset',
  'signal-hum',
  'mic-permission-denied',
  'mic-device-unavailable',
  'mic-device-busy',
  'mic-unknown-error',
  'mic-track-lost',
  'input-agc-active',
  'input-echo-cancellation-active',
  'input-noise-suppression-active',
  'input-multi-channel',
  'input-resampled',
  'input-settings-unavailable',
  'backend-native-stream-failed',
  'backend-stream-lost',
  'backend-recovery-attempted',
  'backend-recovery-succeeded',
  'backend-recovery-failed',
];

export interface TunerDiagnostic {
  code: DiagnosticCode;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  /** Localization key in the `diagnostics.*` block of web/src/stores/l10n.ts. */
  hintKey: string;
  /** Optional interpolation values referenced by the hint text. */
  hintParams?: Readonly<Record<string, number | string>>;
  source: DiagnosticSource;
}

interface DiagnosticCatalogEntry {
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
}

export const DIAGNOSTIC_CATALOG: Readonly<Record<DiagnosticCode, DiagnosticCatalogEntry>> = {
  'signal-silent': { category: 'signal-quality', severity: 'warning' },
  'signal-clipping': { category: 'signal-quality', severity: 'warning' },
  'signal-dc-offset': { category: 'signal-quality', severity: 'warning' },
  'signal-hum': { category: 'signal-quality', severity: 'info' },
  'mic-permission-denied': { category: 'permission', severity: 'error' },
  'mic-device-unavailable': { category: 'device', severity: 'error' },
  'mic-device-busy': { category: 'device', severity: 'error' },
  'mic-unknown-error': { category: 'input', severity: 'error' },
  'mic-track-lost': { category: 'device', severity: 'error' },
  'input-agc-active': { category: 'input', severity: 'warning' },
  'input-echo-cancellation-active': { category: 'input', severity: 'warning' },
  'input-noise-suppression-active': { category: 'input', severity: 'warning' },
  'input-multi-channel': { category: 'input', severity: 'info' },
  'input-resampled': { category: 'input', severity: 'info' },
  'input-settings-unavailable': { category: 'input', severity: 'info' },
  'backend-native-stream-failed': { category: 'backend', severity: 'error' },
  'backend-stream-lost': { category: 'backend', severity: 'warning' },
  'backend-recovery-attempted': { category: 'backend', severity: 'info' },
  'backend-recovery-succeeded': { category: 'backend', severity: 'info' },
  'backend-recovery-failed': { category: 'backend', severity: 'error' },
};

const HINT_PREFIX = 'diagnostics.';

export function createDiagnostic(
  code: DiagnosticCode,
  source: DiagnosticSource,
  hintParams?: Readonly<Record<string, number | string>>,
): TunerDiagnostic {
  const entry = DIAGNOSTIC_CATALOG[code];
  return {
    code,
    category: entry.category,
    severity: entry.severity,
    hintKey: `${HINT_PREFIX}${code}`,
    ...(hintParams ? { hintParams } : {}),
    source,
  };
}

export function isDiagnosticCode(value: unknown): value is DiagnosticCode {
  return typeof value === 'string'
    && (DIAGNOSTIC_CODES as readonly string[]).includes(value);
}

/** Keep only known stable codes from an untrusted wire payload. */
export function normalizeDiagnosticCodes(payload: unknown): DiagnosticCode[] {
  if (!Array.isArray(payload)) return [];
  const seen = new Set<DiagnosticCode>();
  for (const value of payload) {
    if (isDiagnosticCode(value)) seen.add(value);
  }
  return [...seen];
}

// --- Microphone start failures ---------------------------------------------

const MICROPHONE_FAILURE_CODES: Readonly<Record<MicrophoneStartFailure['code'], DiagnosticCode>> = {
  'permission-denied': 'mic-permission-denied',
  'device-unavailable': 'mic-device-unavailable',
  'device-busy': 'mic-device-busy',
  unknown: 'mic-unknown-error',
};

export function diagnosticsFromMicrophoneFailure(
  failure: MicrophoneStartFailure,
  source: DiagnosticSource,
): TunerDiagnostic[] {
  return [createDiagnostic(MICROPHONE_FAILURE_CODES[failure.code], source)];
}

export function microphoneTrackLostDiagnostic(source: DiagnosticSource): TunerDiagnostic {
  return createDiagnostic('mic-track-lost', source);
}

// --- Audio processing warnings ---------------------------------------------

const INPUT_WARNING_CODES: Readonly<Record<AudioInputWarning, DiagnosticCode>> = {
  'auto-gain-control-active': 'input-agc-active',
  'echo-cancellation-active': 'input-echo-cancellation-active',
  'noise-suppression-active': 'input-noise-suppression-active',
  'multi-channel-input': 'input-multi-channel',
  'resampled-input': 'input-resampled',
  'settings-unavailable': 'input-settings-unavailable',
};

export function diagnosticsFromInputWarnings(
  warnings: readonly AudioInputWarning[],
  source: DiagnosticSource,
): TunerDiagnostic[] {
  return warnings.map((warning) => createDiagnostic(INPUT_WARNING_CODES[warning], source));
}

export function nativeStreamFailedDiagnostic(source: DiagnosticSource): TunerDiagnostic {
  return createDiagnostic('backend-native-stream-failed', source);
}

// --- Native stream recovery -------------------------------------------------

/** Recovery telemetry codes emitted by the native audio backend
 * (desktop/src-tauri/src/native_audio/stream.rs, audio-input::recovery). */
export const BACKEND_RECOVERY_CODES: readonly BackendDiagnosticCode[] = [
  'backend-stream-lost',
  'backend-recovery-attempted',
  'backend-recovery-succeeded',
  'backend-recovery-failed',
];

export function isBackendRecoveryCode(
  code: DiagnosticCode,
): code is BackendDiagnosticCode {
  return (BACKEND_RECOVERY_CODES as readonly string[]).includes(code);
}

// --- Signal health ----------------------------------------------------------

export interface SignalHealthMeasurement {
  rms: number;
  peak: number;
  /** Mean of the samples: non-zero means a DC offset at the input. */
  dcOffset: number;
  /** Detected mains hum frequency, when it dominates the spectrum. */
  humFrequency: 50 | 60 | null;
  /** Share of the signal RMS carried by the detected hum component (0..1+). */
  humRatio: number;
}

const HUM_CANDIDATE_FREQUENCIES = [50, 60] as const;
const HUM_ANALYSIS_MAX_SAMPLES = 16384;
/** The hum component must carry at least this share of the signal RMS. */
const HUM_DOMINANCE_RATIO = 0.35;
/** Absolute amplitude floor so near-silence never reports hum. */
const HUM_MIN_AMPLITUDE = 0.005;
/** Peak at/above this fraction of full scale is treated as clipping. */
const CLIPPING_PEAK_THRESHOLD = 0.97;
/** |mean| at/above this value means a harmful DC offset. */
const DC_OFFSET_THRESHOLD = 0.02;

export function measureSignalHealth(
  samples: ArrayLike<number>,
  sampleRate: number,
): SignalHealthMeasurement {
  const length = samples.length;
  if (length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { rms: 0, peak: 0, dcOffset: 0, humFrequency: null, humRatio: 0 };
  }
  let sum = 0;
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const value = samples[i];
    sum += value;
    sumSq += value * value;
    const abs = Math.abs(value);
    if (abs > peak) peak = abs;
  }
  const dcOffset = sum / length;
  const rms = Math.sqrt(sumSq / length);
  const window = Math.min(length, HUM_ANALYSIS_MAX_SAMPLES);
  let humFrequency: 50 | 60 | null = null;
  let humAmplitude = 0;
  for (const candidate of HUM_CANDIDATE_FREQUENCIES) {
    const amplitude = goertzelAmplitude(samples, window, sampleRate, candidate);
    if (amplitude > humAmplitude) {
      humAmplitude = amplitude;
      humFrequency = candidate;
    }
  }
  const humRatio = rms > 0 ? humAmplitude / rms : 0;
  if (
    humFrequency == null
    || humRatio < HUM_DOMINANCE_RATIO
    || humAmplitude < HUM_MIN_AMPLITUDE
  ) {
    humFrequency = null;
  }
  return { rms, peak, dcOffset, humFrequency, humRatio };
}

/** Single-bin Goertzel amplitude estimate (2|G|/N) for `frequency`. */
function goertzelAmplitude(
  samples: ArrayLike<number>,
  window: number,
  sampleRate: number,
  frequency: number,
): number {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let previous = 0;
  let beforePrevious = 0;
  for (let i = 0; i < window; i++) {
    const current = samples[i] + coefficient * previous - beforePrevious;
    beforePrevious = previous;
    previous = current;
  }
  const power = beforePrevious * beforePrevious
    + previous * previous
    - coefficient * previous * beforePrevious;
  return (2 * Math.sqrt(Math.max(0, power))) / window;
}

export function signalDiagnostics(
  measurement: SignalHealthMeasurement,
  source: DiagnosticSource,
): TunerDiagnostic[] {
  const diagnostics: TunerDiagnostic[] = [];
  if (
    measurement.rms < GATE_THRESHOLDS.rmsGate
    && measurement.peak < GATE_THRESHOLDS.peakGate
  ) {
    diagnostics.push(createDiagnostic('signal-silent', source));
    // Silence masks every other signal-quality finding.
    return diagnostics;
  }
  if (measurement.peak >= CLIPPING_PEAK_THRESHOLD) {
    diagnostics.push(createDiagnostic('signal-clipping', source, {
      peak: roundTo(measurement.peak, 2),
    }));
  }
  if (Math.abs(measurement.dcOffset) >= DC_OFFSET_THRESHOLD) {
    diagnostics.push(createDiagnostic('signal-dc-offset', source, {
      offset: roundTo(measurement.dcOffset, 3),
    }));
  }
  if (measurement.humFrequency != null) {
    diagnostics.push(createDiagnostic('signal-hum', source, {
      frequency: measurement.humFrequency,
    }));
  }
  return diagnostics;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
