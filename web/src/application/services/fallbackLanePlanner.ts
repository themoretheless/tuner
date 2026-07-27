// Lane planning for the TypeScript fallback path. Mirrors the Rust engine's
// per-frame branch (guided by the selected target, chromatic hysteresis on
// the settled track, longest lane before the first lock) using the canonical
// window set from domain/analysisWindows. Kept separate from
// FallbackPitchProcessor to stay inside the module-size budget.
import { AnalysisLaneSelector } from '../../domain/analysisWindows';
import type { FrameContext } from '../../types/frames';
import type { PitchGuidance } from '../../utils/pitch';

export interface FallbackLanePlan {
  laneIndex: number;
  longestLaneIndex: number;
  /** Lane window clamped to the frame length: analyze this tail slice. */
  windowSamples: number;
  /** Longest lane window clamped to the frame length (miss-retry window). */
  longestWindowSamples: number;
  isLongest: boolean;
}

export class FallbackLanePlanner {
  private contextKey = '';
  private guidance: PitchGuidance | undefined;
  private readonly lanes = new AnalysisLaneSelector();

  get pitchGuidance() {
    return this.guidance;
  }

  setContext(context?: FrameContext) {
    this.guidance = context ? guidanceFromContext(context) : undefined;
    // Reset the lane only on a real context change (same guard as the
    // tracker): the adapter re-sends an unchanged context every frame, and
    // resetting would flap the chromatic hysteresis back to the long lane.
    const key = contextKeyOf(context);
    if (key !== this.contextKey) {
      this.contextKey = key;
      this.lanes.reset();
    }
  }

  reset() {
    this.lanes.reset();
  }

  /**
   * Lane for the next frame. Must be called *before* the tracker consumes
   * the frame's estimate, so `trackedFrequency` is the settled track from
   * the previous frames (the Rust `PitchTracker::current` equivalent).
   */
  select(
    sampleRate: number,
    frameSamples: number,
    trackedFrequency: number | null,
  ): FallbackLanePlan {
    const laneIndex = this.lanes.selectLane(
      sampleRate,
      this.guidance?.selectedFrequency,
      trackedFrequency,
    );
    const longestLaneIndex = this.lanes.longestLaneIndex;
    return {
      laneIndex,
      longestLaneIndex,
      windowSamples: Math.min(this.lanes.windows[laneIndex], frameSamples),
      longestWindowSamples: Math.min(this.lanes.windows[longestLaneIndex], frameSamples),
      isLongest: laneIndex === longestLaneIndex,
    };
  }
}

function guidanceFromContext(context: FrameContext): PitchGuidance {
  return {
    selectedFrequency: context.selectedTarget?.frequency,
    targetFrequencies: context.tuningTargets.map((target) => target.frequency),
  };
}

// Same key shape as StreamingPitchTracker.setContext, so the lane selector
// resets exactly when the tracker does.
function contextKeyOf(context?: FrameContext): string {
  if (!context) return '';
  const selected = context.selectedTarget?.frequency;
  const targets = context.tuningTargets
    .map((target) => target.frequency)
    .filter((frequency) => Number.isFinite(frequency) && frequency > 0)
    .sort((left, right) => left - right);
  return `${Number.isFinite(selected) && (selected ?? 0) > 0 ? selected : ''}|${targets
    .map((value) => value.toFixed(3))
    .join(',')}`;
}
