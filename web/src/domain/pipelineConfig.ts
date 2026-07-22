export interface PipelineConfig {
  adaptiveGateEnabled: boolean;
  dcRemovalEnabled: boolean;
  fixedGateEnabled: boolean;
  harmonicEnabled: boolean;
  holdEnabled: boolean;
  octaveEnabled: boolean;
  powerChordEnabled: boolean;
  secondaryDetectorEnabled: boolean;
  trackingEnabled: boolean;
  yinEnabled: boolean;
}

export type PipelineBlockId = keyof PipelineConfig;
export type PipelinePresetId = 'stable' | 'balanced' | 'fast' | 'raw';
export type ResolvedPipelinePresetId = PipelinePresetId | 'custom';

export const DEFAULT_PIPELINE_CONFIG: Readonly<PipelineConfig> = Object.freeze({
  adaptiveGateEnabled: true,
  dcRemovalEnabled: true,
  fixedGateEnabled: true,
  harmonicEnabled: true,
  holdEnabled: true,
  octaveEnabled: true,
  powerChordEnabled: true,
  secondaryDetectorEnabled: true,
  trackingEnabled: true,
  yinEnabled: true,
});

export const PIPELINE_PRESETS: Readonly<Record<PipelinePresetId, Readonly<PipelineConfig>>> = Object.freeze({
  stable: DEFAULT_PIPELINE_CONFIG,
  balanced: Object.freeze({
    ...DEFAULT_PIPELINE_CONFIG,
    harmonicEnabled: false,
    powerChordEnabled: false,
  }),
  fast: Object.freeze({
    ...DEFAULT_PIPELINE_CONFIG,
    harmonicEnabled: false,
    holdEnabled: false,
    powerChordEnabled: false,
    secondaryDetectorEnabled: false,
  }),
  raw: Object.freeze({
    ...DEFAULT_PIPELINE_CONFIG,
    adaptiveGateEnabled: false,
    dcRemovalEnabled: false,
    fixedGateEnabled: false,
    harmonicEnabled: false,
    holdEnabled: false,
    octaveEnabled: false,
    powerChordEnabled: false,
    trackingEnabled: false,
  }),
});

export function createDefaultPipelineConfig(): PipelineConfig {
  return { ...DEFAULT_PIPELINE_CONFIG };
}

export function normalizePipelineConfig(value: unknown): PipelineConfig {
  const candidate = value && typeof value === 'object'
    ? value as Partial<Record<PipelineBlockId, unknown>>
    : {};
  const normalized: PipelineConfig = {
    adaptiveGateEnabled: booleanOr(candidate.adaptiveGateEnabled, DEFAULT_PIPELINE_CONFIG.adaptiveGateEnabled),
    dcRemovalEnabled: booleanOr(candidate.dcRemovalEnabled, DEFAULT_PIPELINE_CONFIG.dcRemovalEnabled),
    fixedGateEnabled: booleanOr(candidate.fixedGateEnabled, DEFAULT_PIPELINE_CONFIG.fixedGateEnabled),
    harmonicEnabled: booleanOr(candidate.harmonicEnabled, DEFAULT_PIPELINE_CONFIG.harmonicEnabled),
    holdEnabled: booleanOr(candidate.holdEnabled, DEFAULT_PIPELINE_CONFIG.holdEnabled),
    octaveEnabled: booleanOr(candidate.octaveEnabled, DEFAULT_PIPELINE_CONFIG.octaveEnabled),
    powerChordEnabled: booleanOr(candidate.powerChordEnabled, DEFAULT_PIPELINE_CONFIG.powerChordEnabled),
    secondaryDetectorEnabled: booleanOr(
      candidate.secondaryDetectorEnabled,
      DEFAULT_PIPELINE_CONFIG.secondaryDetectorEnabled,
    ),
    trackingEnabled: booleanOr(candidate.trackingEnabled, DEFAULT_PIPELINE_CONFIG.trackingEnabled),
    yinEnabled: booleanOr(candidate.yinEnabled, DEFAULT_PIPELINE_CONFIG.yinEnabled),
  };
  if (!normalized.yinEnabled && !normalized.secondaryDetectorEnabled) {
    normalized.yinEnabled = true;
  }
  return normalized;
}

export function pipelinePresetConfig(preset: PipelinePresetId): PipelineConfig {
  return { ...PIPELINE_PRESETS[preset] };
}

// The TypeScript fallback deliberately runs a reduced pipeline. Its secondary
// detector is a plain autocorrelation whose frequency errors and confidence
// scale differ from the Rust engine's MPM, so keeping it enabled makes the
// fallback silently disagree with the primary path. Degraded mode keeps only
// the YIN detector, which is held to the shared parity fixtures.
export function degradedFallbackPipelineConfig(value: PipelineConfig): PipelineConfig {
  return normalizePipelineConfig({
    ...value,
    secondaryDetectorEnabled: false,
    yinEnabled: true,
  });
}

export function resolvePipelinePreset(config: PipelineConfig): ResolvedPipelinePresetId {
  for (const preset of Object.keys(PIPELINE_PRESETS) as PipelinePresetId[]) {
    if (pipelineConfigsEqual(config, PIPELINE_PRESETS[preset])) return preset;
  }
  return 'custom';
}

export function updatePipelineBlock(
  config: PipelineConfig,
  block: PipelineBlockId,
  enabled: boolean,
): PipelineConfig {
  return normalizePipelineConfig({ ...config, [block]: enabled });
}

export function pipelineConfigsEqual(
  left: PipelineConfig,
  right: Readonly<PipelineConfig>,
) {
  return (Object.keys(DEFAULT_PIPELINE_CONFIG) as PipelineBlockId[])
    .every((key) => left[key] === right[key]);
}

/** FNV-1a provenance id; keep byte order aligned with Rust PipelineConfig. */
export function pipelineConfigFingerprint(value: PipelineConfig) {
  const config = normalizePipelineConfig(value);
  const bytes = [
    1,
    config.adaptiveGateEnabled ? 1 : 0,
    config.dcRemovalEnabled ? 1 : 0,
    config.fixedGateEnabled ? 1 : 0,
    config.harmonicEnabled ? 1 : 0,
    config.holdEnabled ? 1 : 0,
    config.octaveEnabled ? 1 : 0,
    config.powerChordEnabled ? 1 : 0,
    config.secondaryDetectorEnabled ? 1 : 0,
    config.trackingEnabled ? 1 : 0,
    config.yinEnabled ? 1 : 0,
  ];
  return bytes.reduce(
    (hash, byte) => Math.imul((hash ^ byte) >>> 0, 16_777_619) >>> 0,
    2_166_136_261,
  );
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}
