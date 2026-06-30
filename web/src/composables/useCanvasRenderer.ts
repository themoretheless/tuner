import { onMounted, onUnmounted, watch, type WatchSource } from 'vue';
import { useHiDpiCanvas, type CanvasFrame } from './useHiDpiCanvas';

interface CanvasRendererOptions {
  cssHeight: number;
  draw: (frame: CanvasFrame) => void;
  fallbackWidth?: number;
  minWidth?: number;
  source: WatchSource<unknown> | WatchSource<unknown>[];
  deep?: boolean;
}

export function useCanvasRenderer(options: CanvasRendererOptions) {
  const canvasTools = useHiDpiCanvas(options.cssHeight, options.fallbackWidth, options.minWidth);

  let rafId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let hasWindowResizeFallback = false;

  function cancelScheduledDraw() {
    if (rafId == null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function drawNow() {
    rafId = null;
    const frame = canvasTools.resize();
    if (frame) options.draw(frame);
  }

  function scheduleDraw() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(drawNow);
  }

  function attachResizeListener() {
    const parent = canvasTools.canvas.value?.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleDraw);
      resizeObserver.observe(parent);
      return;
    }

    window.addEventListener('resize', scheduleDraw);
    hasWindowResizeFallback = true;
  }

  watch(options.source, scheduleDraw, {
    deep: options.deep,
    immediate: true,
  });

  onMounted(() => {
    canvasTools.setup();
    attachResizeListener();
    scheduleDraw();
  });

  onUnmounted(() => {
    cancelScheduledDraw();
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (hasWindowResizeFallback) {
      window.removeEventListener('resize', scheduleDraw);
      hasWindowResizeFallback = false;
    }
  });

  return {
    ...canvasTools,
    cancelScheduledDraw,
    drawNow,
    scheduleDraw,
  };
}
