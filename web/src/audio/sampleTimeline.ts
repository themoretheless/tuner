import type { AudioFrame, ExactPcmCapture } from '../ports/audioInput';

interface CaptureState {
  chunks: Float32Array<ArrayBuffer>[];
  droppedSamples: number;
  sampleCount: number;
  startSample: number | null;
}

export class SampleTimeline {
  private readonly frameBuffer: Float32Array<ArrayBuffer>;
  private readonly ring: Float32Array<ArrayBuffer>;
  private availableSamples = 0;
  private capture: CaptureState | null = null;
  private expectedSample: number | null = null;
  private readonly frameSize: number;
  private readonly sampleRate: number;
  private writeOffset = 0;

  constructor(frameSize: number, sampleRate: number) {
    if (!Number.isInteger(frameSize) || frameSize <= 0) {
      throw new RangeError('frameSize must be a positive integer');
    }
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new RangeError('sampleRate must be positive');
    }
    this.frameSize = frameSize;
    this.sampleRate = sampleRate;
    this.frameBuffer = new Float32Array(frameSize) as Float32Array<ArrayBuffer>;
    this.ring = new Float32Array(frameSize) as Float32Array<ArrayBuffer>;
  }

  append(startSample: number, input: Float32Array<ArrayBufferLike>) {
    if (!Number.isSafeInteger(startSample) || startSample < 0 || input.length === 0) return;

    let samples = input;
    let nextStart = startSample;
    if (this.expectedSample != null && nextStart < this.expectedSample) {
      const overlap = this.expectedSample - nextStart;
      if (overlap >= samples.length) return;
      samples = samples.subarray(overlap);
      nextStart = this.expectedSample;
    }

    if (this.expectedSample != null && nextStart > this.expectedSample) {
      const gap = nextStart - this.expectedSample;
      this.appendSilence(gap);
      if (this.capture) this.capture.droppedSamples += gap;
    }

    if (this.expectedSample == null) this.expectedSample = nextStart;
    this.appendSamples(samples);
  }

  beginCapture() {
    if (this.capture) return false;
    this.capture = {
      chunks: [],
      droppedSamples: 0,
      sampleCount: 0,
      startSample: this.expectedSample,
    };
    return true;
  }

  finishCapture(): ExactPcmCapture | null {
    const capture = this.capture;
    this.capture = null;
    if (!capture || capture.startSample == null || capture.sampleCount === 0) return null;

    const samples = new Float32Array(capture.sampleCount) as Float32Array<ArrayBuffer>;
    let offset = 0;
    for (const chunk of capture.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    return {
      droppedSamples: capture.droppedSamples,
      endSample: capture.startSample + samples.length,
      sampleRate: this.sampleRate,
      samples,
      startSample: capture.startSample,
    };
  }

  latestFrame(): AudioFrame | null {
    if (this.expectedSample == null || this.availableSamples < this.frameSize) return null;
    const tailLength = this.frameSize - this.writeOffset;
    this.frameBuffer.set(this.ring.subarray(this.writeOffset), 0);
    this.frameBuffer.set(this.ring.subarray(0, this.writeOffset), tailLength);
    return {
      buffer: this.frameBuffer,
      sampleRate: this.sampleRate,
      timebase: {
        endSample: this.expectedSample,
        source: 'worklet',
        startSample: this.expectedSample - this.frameSize,
      },
    };
  }

  reset() {
    this.availableSamples = 0;
    this.capture = null;
    this.expectedSample = null;
    this.writeOffset = 0;
    this.ring.fill(0);
  }

  private appendSilence(length: number) {
    let remaining = length;
    const zeroes = new Float32Array(Math.min(this.frameSize, length));
    while (remaining > 0) {
      const count = Math.min(remaining, zeroes.length);
      this.appendSamples(zeroes.subarray(0, count));
      remaining -= count;
    }
  }

  private appendSamples(input: Float32Array<ArrayBufferLike>) {
    if (input.length === 0) return;
    let readOffset = 0;
    while (readOffset < input.length) {
      const count = Math.min(input.length - readOffset, this.frameSize - this.writeOffset);
      this.ring.set(input.subarray(readOffset, readOffset + count), this.writeOffset);
      this.writeOffset = (this.writeOffset + count) % this.frameSize;
      readOffset += count;
    }
    this.availableSamples = Math.min(this.frameSize, this.availableSamples + input.length);
    this.expectedSample = (this.expectedSample ?? 0) + input.length;

    if (!this.capture) return;
    if (this.capture.startSample == null) {
      this.capture.startSample = this.expectedSample - input.length;
    }
    const copy = new Float32Array(input.length) as Float32Array<ArrayBuffer>;
    copy.set(input);
    this.capture.chunks.push(copy);
    this.capture.sampleCount += copy.length;
  }
}
