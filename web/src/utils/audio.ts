type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export function createAudioContext() {
  const AudioContextCtor = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not available');
  }
  return new AudioContextCtor();
}

export function errorMessage(error: unknown, fallback: string) {
  if (typeof DOMException === 'undefined' || !(error instanceof DOMException)) return fallback;
  switch (error.name) {
    case 'NotAllowedError':
      return 'Microphone permission denied';
    case 'NotFoundError':
      return 'No microphone found';
    case 'NotReadableError':
    case 'AbortError':
      return 'Microphone is busy or unavailable';
    case 'OverconstrainedError':
      return 'Selected microphone is unavailable';
    case 'SecurityError':
      return 'Microphone access requires a secure context';
    default:
      return fallback;
  }
}
