import type { CanvasFrame } from '../composables/useHiDpiCanvas';

export interface CanvasPalette {
  accent: string;
  accentStrong: string;
  background: string;
  grid: string;
  warning: string;
}

export function canvasPalette(frame: CanvasFrame): CanvasPalette {
  const style = getComputedStyle(frame.canvas);
  return {
    accent: cssColor(style, '--canvas-accent', '#4ade80'),
    accentStrong: cssColor(style, '--canvas-accent-strong', '#166534'),
    background: cssColor(style, '--canvas-bg', '#11151b'),
    grid: cssColor(style, '--canvas-grid', '#334155'),
    warning: cssColor(style, '--canvas-warning', '#f59e0b'),
  };
}

function cssColor(style: CSSStyleDeclaration, name: string, fallback: string) {
  return style.getPropertyValue(name).trim() || fallback;
}
