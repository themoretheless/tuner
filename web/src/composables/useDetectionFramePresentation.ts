import { onScopeDispose, ref, watch, type Ref } from 'vue';
import {
  hasPriorityTransition,
  interpolateDetectionFrame,
  PRESENTATION_TRANSITION_MS,
} from '../session/detectionFramePresentation';
import type { DetectionFrame } from '../types/frames';

export function useDetectionFramePresentation(source: Readonly<Ref<DetectionFrame>>) {
  const frame = ref<DetectionFrame>(source.value);
  let animationFrameId: number | null = null;
  let startedAt = 0;
  let transitionStart = source.value;
  let transitionTarget = source.value;

  function cancelAnimation() {
    if (animationFrameId == null) return;
    globalThis.cancelAnimationFrame?.(animationFrameId);
    animationFrameId = null;
  }

  function scheduleAnimation() {
    if (animationFrameId != null) return;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      frame.value = transitionTarget;
      return;
    }
    animationFrameId = globalThis.requestAnimationFrame(renderAnimationFrame);
  }

  function renderAnimationFrame(timestamp: number) {
    animationFrameId = null;
    const progress = Math.max(0, timestamp - startedAt) / PRESENTATION_TRANSITION_MS;
    frame.value = interpolateDetectionFrame(transitionStart, transitionTarget, progress);
    if (progress < 1) scheduleAnimation();
  }

  watch(source, (next) => {
    if (hasPriorityTransition(frame.value, next)) {
      cancelAnimation();
      transitionStart = next;
      transitionTarget = next;
      frame.value = next;
      return;
    }

    transitionStart = frame.value;
    transitionTarget = next;
    startedAt = monotonicNow();
    scheduleAnimation();
  }, { flush: 'sync' });

  onScopeDispose(cancelAnimation);
  return frame;
}

function monotonicNow() {
  return globalThis.performance?.now() ?? Date.now();
}
