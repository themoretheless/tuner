# Execution Plan - sequenced refactoring roadmap

**Purpose:** the ordered "what to do, in what order" plan. It turns the *problems* in
[recommendation.md](recommendation.md) and the *target design* in [ARCHITECTURE.md](ARCHITECTURE.md)
into dependency-ordered milestones with a definition of done. README.md links here.

This is the **single source of truth for execution order**. The other docs stay as references:
- [recommendation.md](recommendation.md) - stable current-problem extract (183 plan-safe `R#` items).
- [TOP-200-current.md](TOP-200-current.md) - latest grounded audit (187 detailed `C#` findings).
- [TOP-500-backlog.md](TOP-500-backlog.md) - full ranked Top 500 (`M#`).
- [ARCHITECTURE.md](ARCHITECTURE.md) - WHAT it should become (layers + Phases 0-7 + 200 ideas). Cited below as `Phase N`.
- This file - WHEN/IN WHAT ORDER, and how each step is verified.

## Sequencing principle

The refactor target (loose coupling, layered domain/dsp/audio/engine/presentation) is correct, but
the order matters. We **deliberately diverge** from recommendation.md's "pick R1-R5 first": you cannot
safely tear apart god-objects without a regression net. So the order is:

1. **Safety net first** (tests, parity, CI) - M0.
2. **Data contracts** that everything else depends on - M1.
3. **Decouple presentation** (keep viz on plain frames, split the web god-object) - M2, M3.
4. **Strengthen + unify the core** (finish layering, kill duplication) - M4, M5.
5. **Realtime safety** in native - M6.
6. **DSP accuracy** (now that tests catch regressions) - M7.
7. **Platform/PWA/a11y/release polish** - M8.

**The gate for every change:** *does this decrease coupling between audio / dsp / state / presentation?*
If not, it doesn't belong in this plan.

Each milestone is independently shippable and verified with `cargo test -p pitch-core`,
`vue-tsc --noEmit`, and `cargo check` on egui. Behavior-preserving milestones are marked **[BP]**.

---

## M0 - Safety net (do this first) **[BP]**
**Goal:** make the codebase safe to refactor. Phase 6.
**Targets:** `R31-R38`, plus parity gaps around `R14-R18`; grounded audit `C3`, `C24`, `C33`, `C37`, `C45`, `C56`, `C180`, `C184`; master `M20`, `M22`, `M24`, `M26`, `M32`, `M33`, `M35`.
- CI: `cargo test` + `cargo clippy -D warnings` + `cargo fmt --check` + `vue-tsc` on PRs; pin toolchains (`rust-toolchain.toml`, `.nvmrc`).
- Stand up **vitest** in `web/`.
- **Rust<->TS parity test**: a Rust bin dumps `get_tunings()` + note-math samples to JSON; a vitest deep-equals `notes.ts` against it (ids, names, octaves, freqs, cents). This is the net that makes M5 safe.
- Dev **synthetic-signal injector** (`?fixture=E2`) feeding a known WAV into the pipeline; commit a few synthetic guitar fixtures.
**Verify / DoD:** CI green and gating; parity test passes; one fixture drives detection headlessly.

**Status 2026-07-01:** M0 is complete for the current refactor gate: toolchain pins, Vitest core fixtures, `build-web.yml` uses `.nvmrc`, `test-core.yml` gates pitch-core fmt/clippy/tests/wasm feature check, Rust `domain_snapshot` -> Vitest parity covers built-in tunings + note/cents/closest-string math, `?fixture=E2` synthetic audio drives detection headlessly, `useTunerSession` has a synthetic-session harness, and Playwright verifies the synthetic UI flow without microphone access.

## M1 - Shared data contracts (the keystone) **[BP]**
**Goal:** one resolved frame that views render instead of recompute. Phase 0 (types).
**Targets:** `R9`, `R45`, `R58`; grounded audit `C47`, `C53`; master `M3`, `M7`, `M22`.
- Define `DetectionFrame { freq, confidence, cents, note, target, in_tune, is_power, level }`, `SpectrumFrame`, `WaveformFrame` in pitch-core (small `frames`/types module).
- `TunerEngine::process(...) -> DetectionFrame` returns the **fully resolved** readout (chromatic-vs-string, hysteresis, clear-on-silence) so web and egui stop coding those rules twice.
**Verify / DoD:** frame types exist; engine emits them; shape snapshot test; existing tests green.

**Status 2026-07-01:** first contract slices done: `pitch-core::DetectionFrame`, `SpectrumFrame`, `WaveformFrame`, TS frame types, and `TunerEngine::process -> DetectionFrame` are in place; egui consumes normalized `frame.level`; Tauri native now emits a frame-shaped event (`freq/confidence/rms/level/cents/note/...`) and the web native adapter stores it as `DetectionFrame`. Remaining M1 work: make the web session/useTuner path consume the full frame as the primary readout, pass native tuning/target context, and remove legacy frequency-only plumbing.

## M2 - Finish web visualization data boundary **[BP]**
**Goal:** complete the visualizer frame path without regressing the already-decoupled web components. Phase 3.
**Targets:** `R28`, `R69`, `R169`; grounded audit `C187`; architecture proposals 81-100 and 141-160.
- `Waveform/Spectrum/Spectrogram` already take plain frame props through `useVisualizationFrames`; keep that invariant.
- `useHiDpiCanvas` now owns DPR backing-store sizing; next extract shared draw scheduling / ResizeObserver behavior to finish the remaining canvas duplication.
- Extend the same frame contracts toward `CentsHistory`/future native-session outputs where useful.
**Verify / DoD:** `grep AnalyserNode web/src/components` is empty; `vue-tsc` green; visual parity by inspection.

**Status 2026-06-30:** shared `useCanvasRenderer` now owns draw scheduling and `ResizeObserver`; waveform/spectrum/spectrogram/legacy cents canvas use it. Remaining M2 work: visual inspection in browser and extending the same frame flow to native/session outputs where useful.

## M3 - Split the web god-composable **[BP]**
**Goal:** `useTuner` becomes a thin orchestrator. Phase 3 + Phase 5.
**Targets:** `R1`, `R6-R8`, `R10-R11`, `R49`, `R62`, `R67`, `R73`, `R170`; grounded audit `C18`, `C21-C22`, `C25-C26`, `C31`.
- Extract `useAudioInput` (mic/devices/AudioContext/rAF/mic-settings), `useReferenceTone` (output ctx + reference/random tone, decoupled via callbacks), `useTunerSession` (wraps engine, exposes the `DetectionFrame`).
- `useTuner` composes them; settings stays persistence-only.
**Verify / DoD:** `useTuner` < ~150 LOC; each new composable single-responsibility; `vue-tsc` green; behavior preserved.

**Status 2026-06-30:** first split done: `useTunerSession` owns web/native/synthetic audio backend orchestration, pitch loop, detection range and session error/volume/frequency refs. Remaining M3 work: explicit session state machine, smaller return view-model slices, and more tests around backend switching.

## M4 - Finish pitch-core layering **[BP]**
**Goal:** small focused modules + a detector trait. Phase 1.
**Targets:** `R4`, `R13`, `R16`, `R50`, `R58`, `R70`; grounded audit `C28`, `C46`, `C48`, `C60`, `C63`; master `M3`, `M11`, `M160`.
- Split `lib.rs` -> `dsp/yin.rs`, `dsp/mpm.rs`, `spectrum.rs`, `smoothing.rs`, `engine.rs`, `wasm.rs`; `lib.rs` = re-exports only. (`domain.rs` already done.)
- `trait PitchDetector { fn detect(&[f32], sr) -> Option<Detection>; }`; YIN/MPM implement it.
- `EngineConfig` value type for the scattered magic numbers (2048, 0.12, gates).
**Verify / DoD:** `cargo test` green; files < ~200 LOC; `clippy -D warnings` clean.

**Status 2026-06-30:** core layering slice done: `frames.rs`, `signal.rs`, `smoother.rs`, `engine.rs`, and `dsp.rs` extracted; `EngineConfig` added; `lib.rs` is now mostly re-exports plus tests. Remaining M4 work: split `dsp.rs` further into `dsp/yin.rs` + `dsp/mpm.rs`, extract spectrum analyzer module, add `PitchDetector` trait, and move wasm bindings into `wasm.rs`.

## M5 - Unify the domain (kill duplication)
**Goal:** pitch-core is the only source of tunings + note math. Phase 1/2.
**Targets:** `R14-R18`, `R65`, `R111`, `R112`, `R129`; grounded audit `C35-C37`, `C44`, `C50`, `C57`, `C59-C61`, `C176`; master `M3`, `M7`, `M11`.
- Generate/export the TS tunings + note math from Rust (codegen at build time or WASM-backed `notes.ts`); `notes.ts` stops hand-maintaining the table.
- Remove JS fallbacks for core DSP (R16) or fence them behind a dev flag.
**Verify / DoD:** M0 parity test passes **by construction** (one source); no second hand-written tuning table.
**Risk:** medium - touches every web consumer of `notes.ts`; the M0 parity test de-risks it.

## M6 - Native realtime safety + egui decomposition
**Goal:** no DSP/alloc/lock on the cpal callback; data-driven painters. Phase 4 (P1).
**Targets:** `R5`, `R12`, `R23-R26`, `R51`, `R59`, `R75`, `R96-R99`; grounded audit `C1`, `C4`, `C7-C8`, `C10-C17`, `C23`, `C51`, `C54`, `C62`, `C181-C183`; master `M1`, `M2`, `M6`, `M16`.
- cpal callback only copies samples into a ring buffer; a worker drains 2048-hop windows and calls `engine.process`. Remove `Arc<Mutex>` from the realtime path (use SPSC ring / channel).
- Extract `WaveformPainter/SpectrumPainter/SpectrogramPainter` that take only data slices; shrink `App::update`.
- One reusable cpal output-tone builder behind an RAII `ToneHandle`; fixes the random-tone `out.take()` drop and the TODO.
- Gate history/spectrogram pushes behind `listening` + throttle.
**Verify / DoD:** `cargo check` clean; by inspection no DSP/alloc/lock in callback; random tone audibly plays.
**Risk:** medium-high (threading) - do after M0/M1 so behavior is pinned.

## M7 - DSP accuracy hardening
**Goal:** fewer octave/jitter errors, robust gating - guarded by M0 fixtures. Phase 6 (P2).
**Targets:** `R20`, `R25-R27`, `R143`, `R150-R152`, `R154-R166`; grounded audit `C9`, `C15`, `C29-C30`, `C48-C49`, `C173`, `C185`; master `M4`, `M9`, `M10`, `M12`, `M15`, `M17`, `M30`, `M40`.
- HPS octave guard from the existing 2048 FFT; runtime DC-block + ~30-40Hz high-pass; adaptive noise-floor gate; per-string tau bounds when a string is selected; confidence-weighted fusion (YIN+MPM+HPS).
**Verify / DoD:** fixture corpus + equivalence harness pass; no regression vs M0 baselines.

## M8 - Platform / PWA / a11y / release polish
**Goal:** ship-quality cross-platform surface. Phases 5-7 (P2/P3).
**Targets:** `R36-R44`, `R175-R183`; grounded audit `C19-C20`, `C39-C42`, `C95`, `C168-C172`, `C178-C180`; master `M5`, `M8`, `M14`, `M16`, `M23`, `M31`, `M33`, `M37`, `M45`.
- Real Service Worker + offline cache (currently manifest only).
- a11y: aria-live on note/cents; colorblind + forced-colors palettes; non-color-only in-tune cue.
- Observability: "Test my mic" wizard + pipeline health strip + silent/clipping/DC/hum watchdog.
- Release: Tauri CSP; macOS notarize / Windows sign; CI "zero network in release build" proof + cargo-deny/npm-audit.
**Verify / DoD:** per-item; Lighthouse PWA offline passes; CI zero-fetch test green.

---

## Now / Next / Later

- **Now (this week):** finish M1 leftovers: full native/session `DetectionFrame` adoption.
- **Next:** finish M3/M4 leftovers: explicit session state machine, smaller `useTuner` view models, `PitchDetector` trait, spectrum module and wasm module split.
- **Later:** M5 (single-source domain), M6 (native realtime), M7 (DSP accuracy), M8 (polish).

## Working conventions
- One concept = one module/file; new modules target < ~200 LOC.
- Every PR answers: *does this decrease coupling between audio / dsp / state / presentation?*
- When a milestone closes recommendation items, update [recommendation.md](recommendation.md), [TOP-200-current.md](TOP-200-current.md), [TOP-500-backlog.md](TOP-500-backlog.md) if rank/status changes, and [ARCHITECTURE.md](ARCHITECTURE.md) status.
- Prefer behavior-preserving extractions over rewrites; land each milestone green before starting the next.
