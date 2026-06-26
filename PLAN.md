# Execution Plan - sequenced refactoring roadmap

**Purpose:** the ordered "what to do, in what order" plan. It turns the *problems* in
[recommendation.md](recommendation.md) and the *target design* in [ARCHITECTURE.md](ARCHITECTURE.md)
into dependency-ordered milestones with a definition of done. README.md links here.

This is the **single source of truth for execution order**. The other docs stay as references:
- [recommendation.md](recommendation.md) - WHAT is wrong (250 numbered problems, P0-P3). Cited below as `R#`.
- [ARCHITECTURE.md](ARCHITECTURE.md) - WHAT it should become (layers + Phases 0-7 + 200 ideas). Cited below as `Phase N`.
- This file - WHEN/IN WHAT ORDER, and how each step is verified.

## Sequencing principle

The refactor target (loose coupling, layered domain/dsp/audio/engine/presentation) is correct, but
the order matters. We **deliberately diverge** from recommendation.md's "pick R1-R5 first": you cannot
safely tear apart god-objects without a regression net. So the order is:

1. **Safety net first** (tests, parity, CI) - M0.
2. **Data contracts** that everything else depends on - M1.
3. **Decouple presentation** (viz off AnalyserNode, split the web god-object) - M2, M3.
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
**Closes:** R29, R30, R34, R35, R63, R69, R161, R162, R165, R169, R249.
- CI: `cargo test` + `cargo clippy -D warnings` + `cargo fmt --check` + `vue-tsc` on PRs; pin toolchains (`rust-toolchain.toml`, `.nvmrc`).
- Stand up **vitest** in `web/`.
- **Rust<->TS parity test**: a Rust bin dumps `get_tunings()` + note-math samples to JSON; a vitest deep-equals `notes.ts` against it (ids, names, octaves, freqs, cents). This is the net that makes M5 safe.
- Dev **synthetic-signal injector** (`?fixture=E2`) feeding a known WAV into the pipeline; commit a few synthetic guitar fixtures.
**Verify / DoD:** CI green and gating; parity test passes; one fixture drives detection headlessly.

## M1 - Shared data contracts (the keystone) **[BP]**
**Goal:** one resolved frame that views render instead of recompute. Phase 0 (types).
**Closes:** R7, R8, R48, R51, R71, R8/R9 (viz data).
- Define `DetectionFrame { freq, confidence, cents, note, target, in_tune, is_power, level }`, `SpectrumFrame`, `WaveformFrame` in pitch-core (small `frames`/types module).
- `TunerEngine::process(...) -> DetectionFrame` returns the **fully resolved** readout (chromatic-vs-string, hysteresis, clear-on-silence) so web and egui stop coding those rules twice.
**Verify / DoD:** frame types exist; engine emits them; shape snapshot test; existing tests green.

## M2 - Visualizers off AnalyserNode (web) **[BP]**
**Goal:** components are pure renderers of plain data. Phase 3.
**Closes:** R1, R45, R74, R77, R82, R111, R141, R181, R182.
- New `useVizData` derives `WaveformFrame`/`SpectrumFrame` from the engine/analyser in ONE place.
- `Waveform/Spectrum/Spectrogram/CentsHistory/Fretboard` take plain data props; delete `analyser: AnalyserNode` props and all `get*Data` calls from components.
- Extract a shared **`useVizCanvas`** helper (DPR backing-store + ResizeObserver + rAF) to kill the 4-5x canvas duplication.
**Verify / DoD:** `grep AnalyserNode web/src/components` is empty; `vue-tsc` green; visual parity by inspection.

## M3 - Split the web god-composable **[BP]**
**Goal:** `useTuner` becomes a thin orchestrator. Phase 3 + Phase 5.
**Closes:** R2, R10, R46, R54, R60, R67, R72, R131, R183.
- Extract `useAudioInput` (mic/devices/AudioContext/rAF/mic-settings), `useReferenceTone` (output ctx + reference/random tone, decoupled via callbacks), `useTunerSession` (wraps engine, exposes the `DetectionFrame`).
- `useTuner` composes them; settings stays persistence-only.
**Verify / DoD:** `useTuner` < ~150 LOC; each new composable single-responsibility; `vue-tsc` green; behavior preserved.

## M4 - Finish pitch-core layering **[BP]**
**Goal:** small focused modules + a detector trait. Phase 1.
**Closes:** R3, R17, R42, R55, R61, R74, R132.
- Split `lib.rs` -> `dsp/yin.rs`, `dsp/mpm.rs`, `spectrum.rs`, `smoothing.rs`, `engine.rs`, `wasm.rs`; `lib.rs` = re-exports only. (`domain.rs` already done.)
- `trait PitchDetector { fn detect(&[f32], sr) -> Option<Detection>; }`; YIN/MPM implement it.
- `EngineConfig` value type for the scattered magic numbers (2048, 0.12, gates).
**Verify / DoD:** `cargo test` green; files < ~200 LOC; `clippy -D warnings` clean.

## M5 - Unify the domain (kill duplication)
**Goal:** pitch-core is the only source of tunings + note math. Phase 1/2.
**Closes:** R13, R14, R15, R16, R47, R67, R115, R116, R133.
- Generate/export the TS tunings + note math from Rust (codegen at build time or WASM-backed `notes.ts`); `notes.ts` stops hand-maintaining the table.
- Remove JS fallbacks for core DSP (R16) or fence them behind a dev flag.
**Verify / DoD:** M0 parity test passes **by construction** (one source); no second hand-written tuning table.
**Risk:** medium - touches every web consumer of `notes.ts`; the M0 parity test de-risks it.

## M6 - Native realtime safety + egui decomposition
**Goal:** no DSP/alloc/lock on the cpal callback; data-driven painters. Phase 4 (P1).
**Closes:** R4, R5, R12, R28, R46(egui tone), R64, R81, R101, R102, R103, R112, R118, R201, R204, R219.
- cpal callback only copies samples into a ring buffer; a worker drains 2048-hop windows and calls `engine.process`. Remove `Arc<Mutex>` from the realtime path (use SPSC ring / channel).
- Extract `WaveformPainter/SpectrumPainter/SpectrogramPainter` that take only data slices; shrink `App::update`.
- One reusable cpal output-tone builder behind an RAII `ToneHandle`; fixes the random-tone `out.take()` drop and the TODO.
- Gate history/spectrogram pushes behind `listening` + throttle.
**Verify / DoD:** `cargo check` clean; by inspection no DSP/alloc/lock in callback; random tone audibly plays.
**Risk:** medium-high (threading) - do after M0/M1 so behavior is pinned.

## M7 - DSP accuracy hardening
**Goal:** fewer octave/jitter errors, robust gating - guarded by M0 fixtures. Phase 6 (P2).
**Closes:** R21-R27, R157, R158, R221-R228, R236, R238.
- HPS octave guard from the existing 2048 FFT; runtime DC-block + ~30-40Hz high-pass; adaptive noise-floor gate; per-string tau bounds when a string is selected; confidence-weighted fusion (YIN+MPM+HPS).
**Verify / DoD:** fixture corpus + equivalence harness pass; no regression vs M0 baselines.

## M8 - Platform / PWA / a11y / release polish
**Goal:** ship-quality cross-platform surface. Phases 5-7 (P2/P3).
**Closes:** R40, R49, R88, R122, R182, R185, R186, R189, R190, R196, R248, R93, R192.
- Real Service Worker + offline cache (currently manifest only).
- a11y: aria-live on note/cents; colorblind + forced-colors palettes; non-color-only in-tune cue.
- Observability: "Test my mic" wizard + pipeline health strip + silent/clipping/DC/hum watchdog.
- Release: Tauri CSP; macOS notarize / Windows sign; CI "zero network in release build" proof + cargo-deny/npm-audit.
**Verify / DoD:** per-item; Lighthouse PWA offline passes; CI zero-fetch test green.

---

## Now / Next / Later

- **Now (this week):** M0 (safety net) + M1 (frame contracts). Nothing else is safe without these.
- **Next:** M2 -> M3 (decouple presentation, split god-composable) + M4 (core layering). This is the bulk of the loose-coupling win.
- **Later:** M5 (domain unify), M6 (native realtime), M7 (DSP accuracy), M8 (polish).

## Working conventions
- One concept = one module/file; new modules target < ~200 LOC.
- Every PR answers: *does this decrease coupling between audio / dsp / state / presentation?*
- When a milestone closes recommendation items, tick them in [recommendation.md](recommendation.md) and update [ARCHITECTURE.md](ARCHITECTURE.md) status.
- Prefer behavior-preserving extractions over rewrites; land each milestone green before starting the next.
