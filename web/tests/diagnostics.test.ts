import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_CATALOG,
  DIAGNOSTIC_CODES,
  createDiagnostic,
  diagnosticsFromInputWarnings,
  diagnosticsFromMicrophoneFailure,
  measureSignalHealth,
  microphoneTrackLostDiagnostic,
  normalizeDiagnosticCodes,
  signalDiagnostics,
} from '../src/domain/diagnostics';
import type { AudioInputWarning } from '../src/domain/audioInputDiagnostics';
import type { MicrophoneStartFailure } from '../src/domain/microphoneStartFailure';

const SAMPLE_RATE = 48_000;

function sine(frequency: number, amplitude: number, samples = 8192) {
  const buffer = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE);
  }
  return buffer;
}

describe('signal health measurement', () => {
  it('detects silence below the detector gate', () => {
    const measurement = measureSignalHealth(new Float32Array(8192), SAMPLE_RATE);
    const diagnostics = signalDiagnostics(measurement, 'web');
    expect(diagnostics.map((d) => d.code)).toEqual(['signal-silent']);
    expect(diagnostics[0].category).toBe('signal-quality');
    expect(diagnostics[0].hintKey).toBe('diagnostics.signal-silent');
  });

  it('silence masks every other finding', () => {
    // DC offset alone (constant tiny value) is below the gate: silent wins.
    const buffer = new Float32Array(8192).fill(0.001);
    const diagnostics = signalDiagnostics(
      measureSignalHealth(buffer, SAMPLE_RATE),
      'web',
    );
    expect(diagnostics.map((d) => d.code)).toEqual(['signal-silent']);
  });

  it('detects clipping at full scale', () => {
    const buffer = sine(440, 1.4);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.max(-1, Math.min(1, buffer[i]));
    }
    const diagnostics = signalDiagnostics(
      measureSignalHealth(buffer, SAMPLE_RATE),
      'web',
    );
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('signal-clipping');
    const clipping = diagnostics.find((d) => d.code === 'signal-clipping');
    expect(clipping?.severity).toBe('warning');
    expect(clipping?.hintParams?.peak).toBeGreaterThanOrEqual(0.97);
  });

  it('detects a DC offset without clipping', () => {
    const buffer = sine(440, 0.2);
    for (let i = 0; i < buffer.length; i++) buffer[i] += 0.05;
    const diagnostics = signalDiagnostics(
      measureSignalHealth(buffer, SAMPLE_RATE),
      'web',
    );
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('signal-dc-offset');
    expect(codes).not.toContain('signal-clipping');
  });

  it.each([50, 60] as const)('detects mains hum at %s Hz', (frequency) => {
    const hum = sine(frequency, 0.1);
    const tone = sine(440, 0.01);
    const buffer = hum.map((value, index) => value + tone[index]);
    const measurement = measureSignalHealth(buffer, SAMPLE_RATE);
    expect(measurement.humFrequency).toBe(frequency);
    const diagnostics = signalDiagnostics(measurement, 'web');
    const humDiagnostic = diagnostics.find((d) => d.code === 'signal-hum');
    expect(humDiagnostic?.hintParams?.frequency).toBe(frequency);
  });

  it('does not flag hum for a clean tone', () => {
    const measurement = measureSignalHealth(sine(440, 0.3), SAMPLE_RATE);
    expect(measurement.humFrequency).toBeNull();
    expect(signalDiagnostics(measurement, 'web')).toEqual([]);
  });
});

describe('microphone failure mapping', () => {
  it.each([
    ['permission-denied', 'mic-permission-denied', 'permission', 'error'],
    ['device-unavailable', 'mic-device-unavailable', 'device', 'error'],
    ['device-busy', 'mic-device-busy', 'device', 'error'],
    ['unknown', 'mic-unknown-error', 'input', 'error'],
  ] as const)(
    'maps %s to %s',
    (failureCode, diagnosticCode, category, severity) => {
      const failure: MicrophoneStartFailure = { code: failureCode, message: 'x' };
      const diagnostics = diagnosticsFromMicrophoneFailure(failure, 'web');
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe(diagnosticCode);
      expect(diagnostics[0].category).toBe(category);
      expect(diagnostics[0].severity).toBe(severity);
      expect(diagnostics[0].hintKey).toBe(`diagnostics.${diagnosticCode}`);
    },
  );

  it('creates a typed track-loss diagnostic', () => {
    const diagnostic = microphoneTrackLostDiagnostic('web');
    expect(diagnostic.code).toBe('mic-track-lost');
    expect(diagnostic.category).toBe('device');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.hintKey).toBe('diagnostics.mic-track-lost');
  });
});

describe('input processing warning mapping', () => {
  it('maps every AudioInputWarning to a stable code', () => {
    const warnings: AudioInputWarning[] = [
      'auto-gain-control-active',
      'echo-cancellation-active',
      'multi-channel-input',
      'noise-suppression-active',
      'resampled-input',
      'settings-unavailable',
    ];
    const diagnostics = diagnosticsFromInputWarnings(warnings, 'web');
    expect(diagnostics.map((d) => d.code)).toEqual([
      'input-agc-active',
      'input-echo-cancellation-active',
      'input-multi-channel',
      'input-noise-suppression-active',
      'input-resampled',
      'input-settings-unavailable',
    ]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.category).toBe('input');
    }
  });
});

describe('diagnostic contract integrity', () => {
  it('has a catalog entry and localization key for every code', () => {
    const l10nSource = readFileSync(
      new URL('../src/stores/l10n.ts', import.meta.url),
      'utf8',
    );
    expect(new Set(DIAGNOSTIC_CODES).size).toBe(DIAGNOSTIC_CODES.length);
    for (const code of DIAGNOSTIC_CODES) {
      expect(DIAGNOSTIC_CATALOG[code], code).toBeDefined();
      expect(l10nSource, code).toContain(`'diagnostics.${code}'`);
    }
  });

  it('normalizes untrusted wire payloads to known codes only', () => {
    expect(
      normalizeDiagnosticCodes(['signal-hum', 'bogus', 'signal-hum', 42, null]),
    ).toEqual(['signal-hum']);
    expect(normalizeDiagnosticCodes(undefined)).toEqual([]);
    expect(normalizeDiagnosticCodes('signal-hum')).toEqual([]);
  });

  it('keeps the source on every created diagnostic', () => {
    expect(createDiagnostic('signal-silent', 'web').source).toBe('web');
  });
});
