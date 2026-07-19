export type AudioInputDiagnosticStatus = 'clean' | 'unavailable' | 'warning';
export type AudioInputWarning =
  | 'auto-gain-control-active'
  | 'echo-cancellation-active'
  | 'multi-channel-input'
  | 'noise-suppression-active'
  | 'resampled-input'
  | 'settings-unavailable';

export interface AudioInputProcessingSettings {
  autoGainControl: boolean | null;
  channelCount: number | null;
  echoCancellation: boolean | null;
  latency: number | null;
  noiseSuppression: boolean | null;
  sampleRate: number | null;
}

export interface AudioInputDiagnostics {
  actual: AudioInputProcessingSettings;
  contextSampleRate: number;
  requested: Readonly<{
    autoGainControl: false;
    channelCount: 1;
    echoCancellation: false;
    noiseSuppression: false;
  }>;
  status: AudioInputDiagnosticStatus;
  warnings: AudioInputWarning[];
}

export const REQUESTED_AUDIO_PROCESSING = Object.freeze({
  autoGainControl: false,
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
} as const);

export function createAudioInputDiagnostics(
  settings: Partial<Record<keyof AudioInputProcessingSettings, unknown>>,
  contextSampleRate: number,
): AudioInputDiagnostics {
  const actual: AudioInputProcessingSettings = {
    autoGainControl: nullableBoolean(settings.autoGainControl),
    channelCount: positiveIntegerOrNull(settings.channelCount),
    echoCancellation: nullableBoolean(settings.echoCancellation),
    latency: nonNegativeNumberOrNull(settings.latency),
    noiseSuppression: nullableBoolean(settings.noiseSuppression),
    sampleRate: positiveIntegerOrNull(settings.sampleRate),
  };
  const normalizedContextRate = positiveIntegerOrNull(contextSampleRate) ?? 0;
  const hasSettings = Object.values(actual).some((value) => value != null);
  const processingKnown = actual.autoGainControl != null
    && actual.echoCancellation != null
    && actual.noiseSuppression != null;
  const warnings: AudioInputWarning[] = [];
  if (!hasSettings || !processingKnown) warnings.push('settings-unavailable');
  if (actual.autoGainControl === true) warnings.push('auto-gain-control-active');
  if (actual.echoCancellation === true) warnings.push('echo-cancellation-active');
  if (actual.channelCount != null && actual.channelCount > 1) {
    warnings.push('multi-channel-input');
  }
  if (actual.noiseSuppression === true) warnings.push('noise-suppression-active');
  if (
    actual.sampleRate != null
    && normalizedContextRate > 0
    && actual.sampleRate !== normalizedContextRate
  ) warnings.push('resampled-input');

  return {
    actual,
    contextSampleRate: normalizedContextRate,
    requested: REQUESTED_AUDIO_PROCESSING,
    status: !hasSettings ? 'unavailable' : warnings.length ? 'warning' : 'clean',
    warnings,
  };
}

function nullableBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function positiveIntegerOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function nonNegativeNumberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
