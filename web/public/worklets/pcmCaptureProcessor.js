const BATCH_SIZE = 1024;

class TunerPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.batch = new Float32Array(BATCH_SIZE);
    this.batchLength = 0;
    this.batchStartSample = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    const sampleCount = channels?.[0]?.length ?? 0;
    if (sampleCount === 0) return true;

    let readOffset = 0;
    while (readOffset < sampleCount) {
      if (this.batchLength === 0) this.batchStartSample = currentFrame + readOffset;
      const count = Math.min(sampleCount - readOffset, BATCH_SIZE - this.batchLength);
      for (let index = 0; index < count; index += 1) {
        let mixed = 0;
        for (const channel of channels) mixed += channel[readOffset + index];
        this.batch[this.batchLength + index] = mixed / channels.length;
      }
      this.batchLength += count;
      readOffset += count;

      if (this.batchLength === BATCH_SIZE) {
        const completedBatch = this.batch;
        this.port.postMessage({
          samples: completedBatch,
          startSample: this.batchStartSample,
        }, [completedBatch.buffer]);
        this.batch = new Float32Array(BATCH_SIZE);
        this.batchLength = 0;
      }
    }
    return true;
  }
}

registerProcessor('tuner-pcm-capture', TunerPcmCaptureProcessor);
