export type MicrophoneStartFailureCode =
  | 'device-busy'
  | 'device-unavailable'
  | 'permission-denied'
  | 'unknown';

export interface MicrophoneStartFailure {
  code: MicrophoneStartFailureCode;
  message: string;
}

export function classifyMicrophoneStartFailure(
  cause: unknown,
  selectedDevice: boolean,
): MicrophoneStartFailure {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      code: 'permission-denied',
      message: 'Microphone permission denied. Allow microphone access and try again.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      code: 'device-unavailable',
      message: selectedDevice
        ? 'The selected microphone is unavailable. Reconnect it or choose another input.'
        : 'No microphone is available. Connect one and try again.',
    };
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return {
      code: 'device-busy',
      message: 'The microphone could not be opened. Close other audio apps and try again.',
    };
  }
  return {
    code: 'unknown',
    message: cause instanceof Error
      ? cause.message
      : 'Microphone access denied or unavailable',
  };
}
