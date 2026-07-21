import { describe, expect, it } from 'vitest';

import { classifyMicrophoneStartFailure } from '../src/domain/microphoneStartFailure';

describe('classifyMicrophoneStartFailure', () => {
  it('maps browser failures to stable recovery guidance', () => {
    expect(classifyMicrophoneStartFailure(
      new DOMException('browser-specific detail', 'NotAllowedError'),
      false,
    )).toEqual({
      code: 'permission-denied',
      message: 'Microphone permission denied. Allow microphone access and try again.',
    });
    expect(classifyMicrophoneStartFailure(
      new DOMException('browser-specific detail', 'NotFoundError'),
      true,
    ).message).toContain('selected microphone is unavailable');
    expect(classifyMicrophoneStartFailure(
      new DOMException('browser-specific detail', 'NotReadableError'),
      false,
    ).message).toContain('Close other audio apps');
  });

  it('preserves an actionable unknown error', () => {
    expect(classifyMicrophoneStartFailure(new Error('Audio service failed'), false))
      .toEqual({ code: 'unknown', message: 'Audio service failed' });
  });
});
