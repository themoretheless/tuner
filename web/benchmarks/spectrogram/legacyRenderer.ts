import type { SpectrumFrame } from '../../src/types/frames';

export interface LegacyDrawable {
  draw(frame: SpectrumFrame): void;
  reset(): void;
}

/**
 * Frozen from source commit 57e71dcf6cd37d097e82b8110b504549d0b7fea8,
 * path web/src/components/Spectrogram.vue, original SHA-256
 * 6a6e94acdfcb535408a403a30ea22d27575c1753f766344a4fc6551e4c620633.
 * This benchmark-only extraction is separately hash-pinned by its provenance test.
 */
export function createLegacyDrawable(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): LegacyDrawable {
  const history: Uint8Array[] = [];
  const capacity = 150;
  let count = 0;
  let lastSequence = 0;
  let writeIndex = 0;

  function reset() {
    history.length = 0;
    count = 0;
    lastSequence = 0;
    writeIndex = 0;
  }

  return {
    draw(frame) {
      if (frame.sequence !== lastSequence) {
        if (!history.length || history[0].length !== frame.bins.length) {
          reset();
          for (let index = 0; index < capacity; index += 1) {
            history.push(new Uint8Array(frame.bins.length));
          }
        }
        history[writeIndex].set(frame.bins);
        writeIndex = (writeIndex + 1) % capacity;
        count = Math.min(capacity, count + 1);
        lastSequence = frame.sequence;
      }

      context.fillStyle = '#11151b';
      context.fillRect(0, 0, width, height);
      if (count < 2) return;
      const timeStepWidth = width / count;
      const frequencyBins = Math.min(128, frame.bins.length);
      const start = count === capacity ? writeIndex : 0;
      for (let time = 0; time < count; time += 1) {
        const data = history[(start + time) % capacity];
        const x = time * timeStepWidth;
        for (let frequency = 0; frequency < frequencyBins; frequency += 1) {
          const value = data[frequency] / 255;
          const y = height - ((frequency / frequencyBins) * height);
          const cellHeight = height / frequencyBins;
          let red = 0;
          let green = 0;
          if (value > 0.7) {
            red = 255;
            green = 255 * (1 - ((value - 0.7) / 0.3));
          } else if (value > 0.3) {
            green = 255;
          } else {
            green = value * 255 * 0.8;
          }
          context.fillStyle = `rgb(${red}, ${green}, 0)`;
          context.fillRect(x, y, timeStepWidth + 0.5, cellHeight + 0.5);
        }
      }
    },
    reset,
  };
}
