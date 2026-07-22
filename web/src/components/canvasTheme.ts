import type { CanvasFrame } from '../composables/useHiDpiCanvas'

export interface CanvasPalette {
  accent: string
  accentBright: string
  accentDark: string
  background: string
  warning: string
  danger: string
  grid: string
}

export function canvasPalette(frame: CanvasFrame): CanvasPalette {
  const styles = getComputedStyle(frame.ctx.canvas)
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    accent: color('--viz-accent', '#22c55e'),
    accentBright: color('--viz-accent-bright', '#4ade80'),
    accentDark: color('--viz-accent-dark', '#166534'),
    background: color('--viz-background', '#11151b'),
    warning: color('--viz-warning', '#f59e0b'),
    danger: color('--viz-danger', '#ef4444'),
    grid: color('--viz-grid', '#475569'),
  }
}
