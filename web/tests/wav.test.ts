import { describe, expect, it } from 'vitest';
import { decodeWav, encodeMonoPcm16Wav } from '../src/audio/wav';

describe('WAV codec', () => {
  it('round-trips mono PCM16 without changing the sample rate', () => {
    const source = Float32Array.from([-1, -0.25, 0, 0.25, 1]);
    const decoded = decodeWav(encodeMonoPcm16Wav(source, 48_000));

    expect(decoded.channels).toBe(1);
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.samples).toHaveLength(source.length);
    decoded.samples.forEach((sample, index) => {
      expect(Math.abs(sample - source[index])).toBeLessThanOrEqual(1 / 32767);
    });
  });

  it('downmixes interleaved stereo PCM16 deterministically', () => {
    const buffer = encodeStereoPcm16([
      [1, -1],
      [0.5, 0.5],
    ], 44_100);

    const decoded = decodeWav(buffer);
    expect(decoded.channels).toBe(2);
    expect(decoded.samples[0]).toBeCloseTo(0, 4);
    expect(decoded.samples[1]).toBeCloseTo(0.5, 4);
  });

  it('rejects non-WAV and truncated chunk data', () => {
    expect(() => decodeWav(new ArrayBuffer(12))).toThrow(/RIFF\/WAVE/);
    const valid = encodeMonoPcm16Wav(Float32Array.from([0, 1]), 44_100);
    expect(() => decodeWav(valid.slice(0, valid.byteLength - 1))).toThrow(/truncated data chunk/);

    const partialStereoFrame = encodeStereoPcm16([[0.25, -0.25]], 44_100);
    new DataView(partialStereoFrame).setUint32(40, 3, true);
    expect(() => decodeWav(partialStereoFrame.slice(0, 47))).toThrow(/inside a sample frame/);
  });
});

function encodeStereoPcm16(frames: number[][], sampleRate: number) {
  const dataLength = frames.length * 4;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  frames.flat().forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, Math.round(clamped < 0 ? clamped * 32768 : clamped * 32767), true);
  });
  return buffer;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
