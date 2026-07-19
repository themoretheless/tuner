export interface DecodedWav {
  channels: number;
  sampleRate: number;
  samples: Float32Array<ArrayBuffer>;
}

interface WavFormat {
  bitsPerSample: number;
  blockAlign: number;
  channels: number;
  formatTag: number;
  sampleRate: number;
}

export function decodeWav(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer);
  if (view.byteLength < 12 || ascii(view, 0, 4) !== 'RIFF' || ascii(view, 8, 4) !== 'WAVE') {
    throw new Error('Unsupported file: expected a RIFF/WAVE recording');
  }

  let format: WavFormat | null = null;
  let dataOffset = -1;
  let dataLength = 0;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId = ascii(view, offset, 4);
    const chunkLength = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;
    if (payloadOffset + chunkLength > view.byteLength) {
      throw new Error(`Invalid WAV: truncated ${chunkId || 'unknown'} chunk`);
    }
    if (chunkId === 'fmt ') format = readFormat(view, payloadOffset, chunkLength);
    if (chunkId === 'data' && dataOffset < 0) {
      dataOffset = payloadOffset;
      dataLength = chunkLength;
    }
    offset = payloadOffset + chunkLength + (chunkLength % 2);
  }

  if (!format) throw new Error('Invalid WAV: missing fmt chunk');
  if (dataOffset < 0) throw new Error('Invalid WAV: missing data chunk');
  validateFormat(format);
  if (dataLength % format.blockAlign !== 0) {
    throw new Error('Invalid WAV: data chunk ends inside a sample frame');
  }

  const frameCount = dataLength / format.blockAlign;
  if (frameCount === 0) throw new Error('Invalid WAV: audio data is empty');
  const bytesPerSample = format.bitsPerSample / 8;
  const samples = new Float32Array(frameCount) as Float32Array<ArrayBuffer>;
  for (let frame = 0; frame < frameCount; frame += 1) {
    let mixed = 0;
    const frameOffset = dataOffset + frame * format.blockAlign;
    for (let channel = 0; channel < format.channels; channel += 1) {
      mixed += readSample(
        view,
        frameOffset + channel * bytesPerSample,
        format.formatTag,
        format.bitsPerSample,
      );
    }
    samples[frame] = clampSample(mixed / format.channels);
  }

  return {
    channels: format.channels,
    sampleRate: format.sampleRate,
    samples,
  };
}

export function encodeMonoPcm16Wav(
  samples: Float32Array<ArrayBufferLike>,
  sampleRate: number,
): ArrayBuffer {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive integer');
  }
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = clampSample(samples[index]);
    view.setInt16(44 + index * 2, Math.round(sample < 0 ? sample * 32768 : sample * 32767), true);
  }
  return buffer;
}

function readFormat(view: DataView, offset: number, length: number): WavFormat {
  if (length < 16) throw new Error('Invalid WAV: fmt chunk is too short');
  let formatTag = view.getUint16(offset, true);
  if (formatTag === 0xfffe) {
    if (length < 40) throw new Error('Invalid WAV: extensible fmt chunk is too short');
    formatTag = view.getUint16(offset + 24, true);
  }
  return {
    bitsPerSample: view.getUint16(offset + 14, true),
    blockAlign: view.getUint16(offset + 12, true),
    channels: view.getUint16(offset + 2, true),
    formatTag,
    sampleRate: view.getUint32(offset + 4, true),
  };
}

function validateFormat(format: WavFormat) {
  if (format.channels < 1 || format.channels > 32) {
    throw new Error(`Unsupported WAV channel count: ${format.channels}`);
  }
  if (format.sampleRate < 8_000 || format.sampleRate > 384_000) {
    throw new Error(`Unsupported WAV sample rate: ${format.sampleRate}`);
  }
  const supportedBits = format.formatTag === 1
    ? [8, 16, 24, 32]
    : [32, 64];
  if ((format.formatTag !== 1 && format.formatTag !== 3)
    || !supportedBits.includes(format.bitsPerSample)) {
    throw new Error(
      `Unsupported WAV encoding: format ${format.formatTag}, ${format.bitsPerSample}-bit`,
    );
  }
  const expectedBlockAlign = format.channels * (format.bitsPerSample / 8);
  if (format.blockAlign < expectedBlockAlign) {
    throw new Error('Invalid WAV: block alignment is smaller than one sample frame');
  }
}

function readSample(view: DataView, offset: number, formatTag: number, bits: number) {
  if (formatTag === 3) {
    return bits === 32 ? view.getFloat32(offset, true) : view.getFloat64(offset, true);
  }
  switch (bits) {
    case 8:
      return (view.getUint8(offset) - 128) / 128;
    case 16:
      return view.getInt16(offset, true) / 32768;
    case 24: {
      const value = view.getUint8(offset)
        | (view.getUint8(offset + 1) << 8)
        | (view.getUint8(offset + 2) << 16);
      return ((value & 0x800000) ? value - 0x1000000 : value) / 8388608;
    }
    case 32:
      return view.getInt32(offset, true) / 2147483648;
    default:
      return 0;
  }
}

function clampSample(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function ascii(view: DataView, offset: number, length: number) {
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += String.fromCharCode(view.getUint8(offset + index));
  }
  return result;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
