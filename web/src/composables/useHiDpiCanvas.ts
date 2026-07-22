import { ref } from 'vue';

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  h: number;
  w: number;
}

export function useHiDpiCanvas(cssHeight: number, fallbackWidth = 520, minWidth = 0) {
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

    const browserWidth = typeof window !== 'undefined' ? window.innerWidth : fallbackWidth;
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const dpr = Number.isFinite(rawDpr) && rawDpr > 0
      ? Math.max(1, Math.min(2, rawDpr))
      : 1;
    const parentWidth = canvas.value.parentElement?.clientWidth || 0;
    const measuredWidth = parentWidth || canvas.value.clientWidth || fallbackWidth;
    const w = Math.max(1, minWidth, Math.floor(Math.min(measuredWidth, browserWidth || measuredWidth)));
    const h = Math.max(1, Math.floor(cssHeight));
    const targetWidth = Math.round(w * dpr);
    const targetHeight = Math.round(h * dpr);

    canvas.value.style.width = `${w}px`;
    canvas.value.style.height = `${h}px`;

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
