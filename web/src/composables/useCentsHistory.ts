import { ref, watch, type Ref } from 'vue';

export interface CentsHistoryPoint {
  at: number;
  cents: number;
}

const MAX_HISTORY_POINTS = 96;
const HISTORY_INTERVAL_MS = 120;

export function useCentsHistory(cents: Ref<number>, isDetected: Ref<boolean>) {
  const history = ref<CentsHistoryPoint[]>([]);
  let lastRecordedAt = 0;

  function clear() {
    history.value = [];
    lastRecordedAt = 0;
  }

  watch([cents, isDetected], ([nextCents, detected]) => {
    if (!detected) return;

    const now = performance.now();
    if (now - lastRecordedAt < HISTORY_INTERVAL_MS) return;
    lastRecordedAt = now;

    history.value = [
      ...history.value.slice(-(MAX_HISTORY_POINTS - 1)),
      { at: Date.now(), cents: Math.max(-50, Math.min(50, nextCents)) },
    ];
  });

  return {
    clear,
    history,
  };
}
