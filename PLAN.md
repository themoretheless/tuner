# Execution Plan - sequenced refactoring roadmap

**Purpose:** the ordered "what to do, in what order" plan. It turns the *problems* in
[recommendation.md](recommendation.md) and the *target design* in [ARCHITECTURE.md](ARCHITECTURE.md)
into dependency-ordered milestones with a definition of done. README.md links here.

This is the **single source of truth for execution order**. The other docs stay as references:
- [recommendation.md](recommendation.md) - current extract (290 open/partial, 104 closed stable `R#` items).
- [TOP-500-backlog.md](TOP-500-backlog.md) - full ranked Top 500 (`M#`) and historical detailed `C#` evidence; revalidate old findings against the status overlay.
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

## Status Overlay (2026-07-21)

| Milestone | Status | Result / remaining gate |
| --- | --- | --- |
| M0 safety net | Done baseline | 159 Vitest, 71 all-feature core tests, pure-use-case/Vue-adapter/output boundaries, generated note-math properties, shared pitch/confidence/smoothing parity, lifecycle failure/retry coverage, eleven E2E flows, licensed native/WASM/Tauri/egui replay parity and a blocking 19-capture corpus; transition/SNR/soak remain in M7 |
| M1 frames | Done | Rust/Tauri/egui/browser frame adopted; revisioned context, shared hysteresis/smoothing semantics and canonical full-frame shape are verified |
| M2 visualization boundary | Done | Plain frames, shared canvas lifecycle, semantic palette and `320 px` QA |
| M3 web decomposition | Done | One-line compatibility facade, 124-line Vue composition adapter, framework-independent use cases, injected `TunerInputSet`, explicit capabilities and five segregated feature-port contracts are architecture-tested |
| M4 pitch-core layering | Done | Focused modules, trait, config, reusable buffers, optional spectrum and high-level WASM `TunerProcessor` |
| M5 single-source domain | Done | Registry data and one formula AST generate dependency-free Rust/TS note primitives; facades and freshness/property gates are in place |
| M6 native realtime | Done | Shared bounded input worker, decomposed egui/Tauri and supervised native input with typed recovery telemetry (stream-lost/recovery-attempted/succeeded/failed, stall watchdog, bounded backoff retries, session survives device unplug) are done |
| M7 DSP hardening | Done | DC centering, bounded MPM/ranges, adaptive gate, silence reset, real-WAV temporal gate, licensed cross-backend replay, HPS octave guard, phase period refinement, gated SNR (57/57) and reverb (57/57) grids, calibrated confidence-weighted YIN/MPM fusion, criterion hot-path benchmarks, restart soak tests and a CI differential baseline gate are done |
| M8 product/release | Done baseline | Offline SW, feature UI, themes, typed cross-platform diagnostics with signal-health watchdog, throttled aria-live/forced-colors/non-color a11y, strict prod CSP with dev override, zero-network CI, cargo-deny/npm-audit gates and signing scaffolding are done; actual Apple/Windows signing requires certificates |

---

## M0 - Safety net (do this first) **[BP]**
**Goal:** make the codebase safe to refactor. Phase 6.
**Targets:** `R31-R38`, plus parity gaps around `R14-R18`; grounded audit `C3`, `C24`, `C33`, `C37`, `C45`, `C56`, `C180`, `C184`; master `M20`, `M22`, `M24`, `M26`, `M32`, `M33`, `M35`.
- CI: `cargo test` + `cargo clippy -D warnings` + `cargo fmt --check` + `vue-tsc` on PRs; pin toolchains (`rust-toolchain.toml`, `.nvmrc`).
- Stand up **vitest** in `web/`.
- **Rust<->TS parity test**: a Rust bin dumps `get_tunings()` + note-math samples to JSON; a vitest deep-equals `notes.ts` against it (ids, names, octaves, freqs, cents). This is the net that makes M5 safe.
- Dev **synthetic-signal injector** (`?fixture=E2`) feeding a known WAV into the pipeline; commit a few synthetic guitar fixtures.
**Verify / DoD:** CI green and gating; parity test passes; one fixture drives detection headlessly.

**Status 2026-07-21:** M0 is complete for the current refactor gate: toolchain pins, `159` Vitest tests, `71` pitch-core all-feature tests, pure-use-case/Vue-adapter/output boundary guards, typed lifecycle failure/retry tests, CI fmt/clippy/tests/wasm/codegen/quality gates, generated registry/note-math parity, shared pitch/confidence and smoothing manifests, a provenance-checked 19-capture corpus, and eleven browser flows including licensed native/WASM replay, full-frame WASM, synthetic/file detection, exact PCM capture, responsive Algorithm/Library navigation and mocked permission/device-loss recovery. Tauri wire frames and egui view state consume the same replay contract; active Web/Native switching is registry-tested.

## M1 - Shared data contracts (the keystone) **[BP]**
**Goal:** one resolved frame that views render instead of recompute. Phase 0 (types).
**Targets:** `R9`, `R45`, `R58`; grounded audit `C47`, `C53`; master `M3`, `M7`, `M22`.
- Define `DetectionFrame { freq, confidence, cents, note, target, in_tune, is_power, level }`, `SpectrumFrame`, `WaveformFrame` in pitch-core (small `frames`/types module).
- `TunerEngine::process(...) -> DetectionFrame` returns the **fully resolved** readout (chromatic-vs-string, hysteresis, clear-on-silence) so web and egui stop coding those rules twice.
**Verify / DoD:** frame types exist; engine emits them; shape snapshot test; existing tests green.

**Status 2026-07-12:** complete. `FrameResolver` owns target/cents/hysteresis; Tauri and browser WASM receive A4/temperament/tuning/selected-target `FrameContext`; Vue trusts resolved primary output; Rust/TypeScript smoothing and confidence are fixture-gated; the top-level `frequency` alias is removed.

## M2 - Finish web visualization data boundary **[BP]**
**Goal:** complete the visualizer frame path without regressing the already-decoupled web components. Phase 3.
**Targets:** `R28`, `R69`, `R169`; grounded audit `C187`; architecture proposals 81-100 and 141-160.
- `Waveform/Spectrum/Spectrogram` already take plain frame props through `useVisualizationFrames`; keep that invariant.
- `useHiDpiCanvas` now owns DPR backing-store sizing; next extract shared draw scheduling / ResizeObserver behavior to finish the remaining canvas duplication.
- Extend the same frame contracts toward `CentsHistory`/future native-session outputs where useful.
**Verify / DoD:** `grep AnalyserNode web/src/components` is empty; `vue-tsc` green; visual parity by inspection.

**Status 2026-07-11:** complete for the intended boundary. Shared canvas scheduling/ResizeObserver/theme palette is used; backing stores resize only on dimension changes; visual checks pass at desktop and `320 px` without document overflow.

## M3 - Split the web god-composable **[BP]**
**Goal:** `useTuner` becomes a thin orchestrator. Phase 3 + Phase 5.
**Targets:** `R1`, `R6-R8`, `R10-R11`, `R49`, `R62`, `R67`, `R73`, `R170`; grounded audit `C18`, `C21-C22`, `C25-C26`, `C31`.
- Extract `useAudioInput` (mic/devices/AudioContext/rAF/mic-settings), `useReferenceTone` (output ctx + reference/random tone, decoupled via callbacks), `useTunerSession` (wraps engine, exposes the `DetectionFrame`).
- `useTuner` composes them; settings stays persistence-only.
**Verify / DoD:** `useTuner` < ~150 LOC; each new composable single-responsibility; `vue-tsc` green; behavior preserved.

**Status 2026-07-21:** complete. `useTuner.ts` is a one-line compatibility export over the 124-line Vue composition adapter. `application/` contains framework-independent use cases/value contracts, `app/ports/` owns implementation-independent screen contracts, and `adapters/vue/` owns their reactive implementations. The old concrete `TunerApplicationServices` bag and factory-derived `ReturnType` contracts are gone; a typed `TunerInputSet` is constructed only in the composition root. Tuning uses explicit selection/settings commands plus a domain detection machine. Unit and architecture tests enforce dependency direction.

## M4 - Finish pitch-core layering **[BP]**
**Goal:** small focused modules + a detector trait. Phase 1.
**Targets:** `R4`, `R13`, `R16`, `R50`, `R58`, `R70`; grounded audit `C28`, `C46`, `C48`, `C60`, `C63`; master `M3`, `M11`, `M160`.
- Split `lib.rs` -> `dsp/yin.rs`, `dsp/mpm.rs`, `spectrum.rs`, `smoothing.rs`, `engine.rs`, `wasm.rs`; `lib.rs` = re-exports only. (`domain.rs` already done.)
- `trait PitchDetector { fn detect(&[f32], sr) -> Option<Detection>; }`; YIN/MPM implement it.
- `EngineConfig` value type for the scattered magic numbers (2048, 0.12, gates).
**Verify / DoD:** `cargo test` green; files < ~200 LOC; `clippy -D warnings` clean.

**Status 2026-07-12:** complete: detector/yin/mpm/power, spectrum and WASM modules are split; `PitchDetector`, `EngineConfig` and full-frame `TunerProcessor` exist; detector buffers are reused and spectrum is demand-gated.

## M5 - Unify the domain (kill duplication)
**Goal:** one checked source owns tunings + note math for pitch-core and web. Phase 1/2.
**Targets:** `R14-R18`, `R65`, `R111`, `R112`, `R129`; grounded audit `C35-C37`, `C44`, `C50`, `C57`, `C59-C61`, `C176`; master `M3`, `M7`, `M11`.
- Tuning/instrument data now comes from `registry/music-registry.json`; Rust code is generated at build time and web derives its objects from the same schema.
- `scripts/generate-note-math.mjs` owns a language-neutral formula AST and emits dependency-free Rust/TypeScript primitives; `notes.ts` and `domain.rs` are thin composition facades.
**Verify / DoD:** M0 parity test passes **by construction** (one source); no second hand-written tuning table.
**Risk:** medium - touches every web consumer of `notes.ts`; the M0 parity test de-risks it.

**Status 2026-07-12:** complete. Codegen freshness gates build/test/CI; deterministic Rust/TypeScript sweeps cover A4, MIDI, cents, temperaments and transpose/capo. Confidence/full-frame WASM convergence is also complete under M1/M4.

## M6 - Native realtime safety + egui decomposition
**Goal:** no DSP/alloc/lock on the cpal callback; data-driven painters. Phase 4 (P1).
**Targets:** `R5`, `R12`, `R23-R26`, `R51`, `R59`, `R75`, `R96-R99`; grounded audit `C1`, `C4`, `C7-C8`, `C10-C17`, `C23`, `C51`, `C54`, `C62`, `C181-C183`; master `M1`, `M2`, `M6`, `M16`.
- cpal callback only copies samples into a ring buffer; a worker drains 2048-hop windows and calls `engine.process`. Remove `Arc<Mutex>` from the realtime path (use SPSC ring / channel).
- Extract `WaveformPainter/SpectrumPainter/SpectrogramPainter` that take only data slices; shrink `App::update`.
- One reusable cpal output-tone builder behind an RAII `ToneHandle`; fixes the random-tone `out.take()` drop and the TODO.
- Gate history/spectrogram pushes behind `listening` + throttle.
**Verify / DoD:** `cargo check` clean; by inspection no DSP/alloc/lock in callback; random tone audibly plays.
**Risk:** medium-high (threading) - do after M0/M1 so behavior is pinned.

**Status 2026-07-11:** complete for realtime safety and structural decomposition. Tauri/egui share `audio-input`; callback work is bounded nonblocking downmix/copy, DSP runs on workers, and egui main/audio/state/visualization are separate. Runtime error telemetry/restart remains under reliability work.

## M7 - DSP accuracy hardening
**Goal:** fewer octave/jitter errors, robust gating - guarded by M0 fixtures. Phase 6 (P2).
**Targets:** `R20`, `R25-R27`, `R143`, `R150-R152`, `R154-R166`; grounded audit `C9`, `C15`, `C29-C30`, `C48-C49`, `C173`, `C185`; master `M4`, `M9`, `M10`, `M12`, `M15`, `M17`, `M30`, `M40`.
- HPS octave guard from the existing 2048 FFT; runtime DC-block + ~30-40Hz high-pass; adaptive noise-floor gate; per-string tau bounds when a string is selected; confidence-weighted fusion (YIN+MPM+HPS).
**Verify / DoD:** fixture corpus + equivalence harness pass; no regression vs M0 baselines.

**Status 2026-07-21:** partial. A licensed guitar/bass/ukulele/violin/voice corpus, deterministic rebuild/checksums, temporal metrics, per-scenario thresholds, blocking CI artifact and sample-indexed native/WASM/Tauri/egui replay parity are complete. The next evidence slices are fixed SNR/noise/reverb transforms, differential baselines, criterion hot-path benchmarks and restart soak tests.

**Status 2026-07-25 (DSP round 07):** HPS octave guard (`dsp/hps.rs`, harmonic product spectrum over 3 compression stages, consulted only when Hz probes are inconclusive, skipped at confidence >= 0.97), phase period refinement (`dsp/phase.rs`, two Hann windows with N/4 shift, magnitude^2 weighting, gated on confidence/stationarity/dominant fundamental, clamp ±6 cents) and a deterministic seeded white-noise SNR grid at 30/20/10 dB (report schema v2, per-level `--check` thresholds, clean gate unchanged) are done. Benchmark `benchmark-07-dsp-*`: clean corpus 19/19, mean MAE 2.645 -> 2.436 cents (-7.9 %), mean p95 4.945 -> 4.763 cents; SNR grid 57/57 passed (30 dB MAE 2.45, 20 dB 2.44, 10 dB 2.48, coverage >= 0.93). Reverb transforms, differential baselines, criterion hot-path benchmarks and soak tests remain.

**Status 2026-07-25 (DSP round 08):** deterministic reverb grid is done: seeded exponentially decaying noise IRs (`quality/reverb.rs`, energy-normalized, FFT convolution) at RT60 0.3/0.8/1.5 s with a fixed -12 dB wet mix, per-condition `--check` thresholds under the same report schema v2 (optional `reverbGrid`, clean and SNR gates unchanged). Benchmark `benchmark-08-reverb-*`: clean 19/19 and SNR 57/57 identical to round 07 (mean MAE 2.436 cents); reverb grid 57/57 passed (0.3 s MAE 2.41, 0.8 s 2.58, 1.5 s 2.62, coverage >= 0.96). Differential baselines, criterion hot-path benchmarks and soak tests remain.

**Status 2026-07-26 (DSP round 09):** M7 complete. Calibrated confidence-weighted YIN/MPM fusion (`dsp/candidates.rs`: both confidences mapped to predicted absolute cents error, 1/sigma weights clamped to [0.5, 2.0], sigma-margin disagreement arbitration; probe-measured YIN error ~2-2.5x MPM at equal raw confidence) — benchmark `benchmark-09-fusion-*`: mean MAE 2.488 -> 2.432 cents, p95 improved across clean/SNR/reverb grids, no regression above 0.14 cents. Criterion hot-path benchmarks (`benches/hotpath.rs`): full frame E2 17.1 ms / E4 15.9 ms of the 33 ms budget, HPS guard 0.4 ms active, near-zero when skipped. Restart/long-run soak tests (`tests/soak.rs`, 2100-frame deterministic session + 20 restart cycles) caught and fixed a real bug: `reset_tracking_state` did not reset BandPassFilter state. Differential baseline gate: `fixtures/quality-baseline.json` (133 conditions) + `scripts/compare-quality-baseline.mjs` (budgets: MAE/p95 max(+5%, +0.10 cents), octaveErrorRatio +0.005 abs) wired into CI after the quality gate.

**Status 2026-07-27 (rounds 10-12):** M6 closed with supervised native input recovery (stall watchdog + typed backend-* codes, session survives device unplug). Round 11 quick wins: browser-language auto-detect, comma A4 input, PWA update banner + maskable icons, in-tune confirmation (flash/beep/vibrate), readout stability slider; accuracy core: per-string tau bounds (guided frame E4 1.87 ms, -85%), one-euro filter in PitchTracker (held-note jitter -21%, sum dMAE -20.6 cents), Jacobsen sub-bin interpolation in the HPS guard. Round 12 dual-window (M12): `AnalysisWindowSet` lane architecture (per-lane detector/biquad/HPS plan, shared tracker/gate, tail-slice of the host frame, chromatic lane hysteresis ~345/326 Hz, longest-lane fallback on short-lane miss); corpus runner emits observations at lane-window timestamps with monotonic clamping; dual mode [2048, 8192] is the CI gate. Benchmark `benchmark-14-dualwindow-*`: guided E4 445 us (4.2x), uke-g4 TTFC 152.7 -> 53.7 ms, voice-f4 MAE 21.5 -> 4.6 cents clean, coverage 1.0 everywhere, diff-gate PASS.

## M8 - Platform / PWA / a11y / release polish
**Goal:** ship-quality cross-platform surface. Phases 5-7 (P2/P3).
**Targets:** `R36-R44`, `R175-R183`; grounded audit `C19-C20`, `C39-C42`, `C95`, `C168-C172`, `C178-C180`; master `M5`, `M8`, `M14`, `M16`, `M23`, `M31`, `M33`, `M37`, `M45`.
- Real Service Worker + offline cache is done; add update/rollback and zero-network CI verification.
- a11y: aria-live on note/cents; colorblind + forced-colors palettes; non-color-only in-tune cue.
- Observability: "Test my mic" wizard + pipeline health strip + silent/clipping/DC/hum watchdog.
- Release: Tauri CSP; macOS notarize / Windows sign; CI "zero network in release build" proof + cargo-deny/npm-audit.
**Verify / DoD:** per-item; Lighthouse PWA offline passes; CI zero-fetch test green.

**Status 2026-07-21:** lifecycle visibility, native teardown propagation and web input recovery evidence are complete: restart intent is immediate, failed stop retains its backend for retry, snapshots expose typed operations, the Tauri API boundary is injectable, stale mic starts are revision-cancelled, and permission denial/track loss/devicechange/backend switching are tested. Cross-platform typed user-facing diagnostics, CSP/signing and accessibility gates remain.

**Status 2026-07-26 (M8 round):** typed cross-platform diagnostics are done: shared contract `web/src/domain/diagnostics.ts` (categories, severity, stable string codes, localized actionable hints) with signal-health detection (silent/clipping/DC offset/50-60 Hz hum via Goertzel) mirrored in `desktop/.../signal_health.rs` and `egui/src/diagnostics.rs`, surfaced via `DiagnosticsStrip.vue` (web/Tauri wire field `signal`) and egui state. a11y gates done: throttled aria-live tune announcer (`utils/tuneA11y.ts`, immediate on in-tune/note change, else <= 1/s), non-color in-tune cues (icons + border styles + text), forced-colors and prefers-contrast media branches, colorblind palette audit. Release gates done: strict prod CSP in `tauri.conf.json` with `tauri.conf.dev.json` override (safe-by-default), `scripts/check-no-network.mjs` zero-network proof wired into new `security.yml` (blocking `release.yml`), `deny.toml` cargo-deny (licenses/bans/advisories, two documented quick-xml RUSTSEC exceptions), npm audit gates (postcss high fixed), signing scaffolding in `RELEASE-SIGNING.md` + `scripts/check-release-signing.mjs` (entitlements minimal, no secrets in git). Web 209/209, workspace cargo tests green. Remaining: real Apple/Windows signing needs certificates (checklist in RELEASE-SIGNING.md); version numbers across version.json/Cargo.toml/tauri.conf.json/web package.json are inconsistent and should be aligned.

---

## Now / Next / Later

- **Now:** newcomer batch B (M34 mic wizard, M56 onboarding, M38 guided tuning, M77 simple mode); optional faster hop on the short lane (cadence still 33 ms everywhere).
- **Next:** real Apple/Windows signing per RELEASE-SIGNING.md once certificates exist; revisit the two quick-xml RUSTSEC exceptions on next tauri/plist update.
- **Later:** egui diagnostics presentation localization; extend the window set (16384 for bass, adaptive per-target windows) now that lanes are a set, not a pair.

## Working conventions
- One concept = one module/file; new modules target < ~200 LOC.
- Every PR answers: *does this decrease coupling between audio / dsp / state / presentation?*
- When a milestone closes recommendation items, update [recommendation.md](recommendation.md), the unified [TOP-500-backlog.md](TOP-500-backlog.md) if an `M#`/`C#` rank or status changes, and [ARCHITECTURE.md](ARCHITECTURE.md) status.
- Prefer behavior-preserving extractions over rewrites; land each milestone green before starting the next.
