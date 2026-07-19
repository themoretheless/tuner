import { describe, expect, it } from 'vitest';
import { createAudioInputDiagnostics } from '../src/domain/audioInputDiagnostics';

describe('audio input diagnostics', () => {
  it('reports an unprocessed mono track as clean', () => {
    const diagnostics = createAudioInputDiagnostics({
      autoGainControl: false,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      sampleRate: 48_000,
    }, 48_000);

    expect(diagnostics.status).toBe('clean');
    expect(diagnostics.warnings).toEqual([]);
  });

  it('makes browser processing and resampling explicit', () => {
    const diagnostics = createAudioInputDiagnostics({
      autoGainControl: true,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: true,
      sampleRate: 44_100,
    }, 48_000);

    expect(diagnostics.status).toBe('warning');
    expect(diagnostics.warnings).toEqual([
      'auto-gain-control-active',
      'noise-suppression-active',
      'resampled-input',
    ]);
  });

  it('does not pretend unknown settings were honored', () => {
    const diagnostics = createAudioInputDiagnostics({}, 48_000);

    expect(diagnostics.status).toBe('unavailable');
    expect(diagnostics.warnings).toEqual(['settings-unavailable']);
  });

  it('warns when processing flags are hidden or mono was not honored', () => {
    const diagnostics = createAudioInputDiagnostics({
      channelCount: 2,
      sampleRate: 48_000,
    }, 48_000);

    expect(diagnostics.status).toBe('warning');
    expect(diagnostics.warnings).toEqual([
      'settings-unavailable',
      'multi-channel-input',
    ]);
  });
});
