import type {
  PitchAnalysis,
  PitchEstimate,
} from '../../utils/pitch';

export function normalizeFallbackAnalysis(
  result: PitchAnalysis | PitchEstimate | null,
): PitchAnalysis {
  if (result && 'estimate' in result) return result;
  return {
    arbitration: result ? 'yin-only' : 'none',
    estimate: result,
    fixedGateOpen: true,
    secondary: null,
    yin: result,
  };
}
