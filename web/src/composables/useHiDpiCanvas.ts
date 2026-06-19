import { ref } from 'vue';

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  h: number;
  w: number;
}

export function useHiDpiCanvas(cssHeight: number, fallbackWidth = 520) {
  const canvas = ref<HTMLCanvasElement | null>(null);
  let ctx: CanvasRenderingContext2D | null = null;

  function setup() {
    if (!canvas.value) return null;
    ctx = canvas.value.getContext('2d', { alpha: true });
    resize();
    return ctx;
  }

  function resize(): CanvasFrame | null {
    if (!canvas.value || !ctx) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.value.clientWidth || fallbackWidth));
    const h = Math.max(1, Math.round(canvas.value.clientHeight || cssHeight));
    const targetWidth = Math.round(w * dpr);
    const targetHeight = Math.round(h * dpr);

    if (canvas.value.width !== targetWidth || canvas.value.height !== targetHeight) {
      canvas.value.width = targetWidth;
      canvas.value.height = targetHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function clear(fillStyle = '#11151b') {
    const frame = resize();
    if (!frame) return;
    frame.ctx.fillStyle = fillStyle;
    frame.ctx.fillRect(0, 0, frame.w, frame.h);
  }

  return {
    canvas,
    clear,
    resize,
    setup,
  };
}
