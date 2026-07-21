import { readFileSync } from 'node:fs';

export function decodePcmWav(path: string, maximumSamples: number) {
  const bytes = readFileSync(path);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path} is not a RIFF/WAVE file`);
  }

  let formatOffset = -1;
  let formatSize = 0;
  let dataOffset = -1;
  let dataSize = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    if (id === 'fmt ') {
      formatOffset = payloadOffset;
      formatSize = size;
    } else if (id === 'data') {
      dataOffset = payloadOffset;
      dataSize = size;
    }
    offset = payloadOffset + size + (size % 2);
  }
  if (formatOffset < 0 || formatSize < 16 || dataOffset < 0) {
    throw new Error(`${path} is missing a PCM fmt/data chunk`);
  }

  const audioFormat = bytes.readUInt16LE(formatOffset);
  const channels = bytes.readUInt16LE(formatOffset + 2);
  const sampleRate = bytes.readUInt32LE(formatOffset + 4);
  const blockAlign = bytes.readUInt16LE(formatOffset + 12);
  const bitsPerSample = bytes.readUInt16LE(formatOffset + 14);
  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1) {
    throw new Error(`${path} must be PCM16 WAV`);
  }

  const frameCount = Math.min(Math.floor(dataSize / blockAlign), maximumSamples);
  const samples = new Array<number>(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    const frameOffset = dataOffset + frame * blockAlign;
    for (let channel = 0; channel < channels; channel += 1) {
      sum += bytes.readInt16LE(frameOffset + channel * 2) / 32_768;
    }
    samples[frame] = sum / channels;
  }
  if (samples.length < maximumSamples) {
    throw new Error(`${path} is shorter than the replay contract`);
  }
  return { sampleRate, samples };
}
