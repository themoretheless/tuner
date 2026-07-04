# Guitar Tuner - Architecture & Deep Refactoring Plan

**Date:** 2026-06  
**Perspective:** Designing from scratch with heavy focus on **modularity**, **code decomposition**, and **loose coupling**.

## Current State Assessment (Honest Critique)

The project has evolved through many iterations (Vue web, Tauri, pure egui native, shared Rust pitch-core via WASM).

Strengths:
- Good move to shared `pitch-core` for YIN/MPM + spectrum.
- TunerEngine exists as a step toward better separation.
- Domain layer partially extracted.
- Multiple platforms (web + egui + Tauri) working.

Weaknesses (high coupling, low modularity):
- `web/src/composables/useTuner.ts` is smaller than before, but still acts as a composition god-object: settings, web audio, native audio, pitch loop, tuning state, reference tones, practice, metronome and display state are all wired through one broad return object (~308 lines).
- `web/src/composables/useTuningState.ts` and `useSettings.ts` are now the bigger coupling surfaces for music workflow and persistence.
- Web visualizers now receive plain visualization frames, but session/native frame contracts are still incomplete across platforms.
- `pitch-core/src/lib.rs` itself is now split (`domain`/`dsp`/`engine`/`frames`/`signal`/`smoother`, `lib.rs` down to ~191 lines of re-exports and tests), but the crate still has no `PitchDetector` trait, its detection range is hardcoded guitar-only, and `domain.rs` has no temperament/sweetening data at all — see [recommendation.md](recommendation.md) #3, #26, #28.
- `egui/src/main.rs` still has god-like `App` + heavy Mutex use + inline painter logic.
- No clear boundaries: audio I/O, DSP, domain math, session state, and presentation are mixed.
- Hard to test in isolation.
- Duplication between TS note math and Rust domain.
- Many items from the original critique are only partially addressed.

See the canonical current **Top 50 Problems** in [recommendation.md](recommendation.md) (freshly re-audited and independently re-verified against the live code on 2026-07-01, replacing the prior 183-item list). [TOP-200-current.md](TOP-200-current.md) and [TOP-500-backlog.md](TOP-500-backlog.md) still use the older `C#`/`M#` numbering and were not part of this refresh pass — some of their line-number citations are stale (e.g. they describe `pitch-core/src/lib.rs` as a ~660-line monolith; it's now ~191 lines after the `domain`/`dsp`/`engine`/`frames`/`signal`/`smoother` split) and a few of their listed P0s (the egui `out.take()` stream-drop, `AudioContext` never resuming) are already fixed in the current code. Trust [recommendation.md](recommendation.md) for current evidence until those two get their own re-grounding pass.

The list is kept in sync across docs. High priority problems directly contradict the layered architecture described here.

## 10 Different Critics — From-Scratch Design Perspectives

We role-played 10 different experts critiquing the current design and proposing how they would build it from scratch.

### 1. Software Architect (Systems View)
**Critique:** No layered architecture. Everything is "application code". High fan-in to few files, no dependency inversion.
**From scratch:** Strict layers:
- Domain (pure data + math)
- DSP (algorithms, no I/O)
- Audio Abstraction (traits for input/output)
- Engine/Session (orchestration, state machine)
- Adapters / UI shells (thin)

Use ports-and-adapters (hexagonal) or clean architecture. Dependency rule: inner layers don't know about outer.

### 2. DSP / Audio Engineer
**Critique:** YIN/MPM/spectrum/smoothing/power-chord are all jammed together. Hard to swap algorithms or benchmark independently. WASM surface is low-level.
**From scratch:** 
- `PitchDetector` trait with `process(&[f32]) -> Option<(f32, f32)>`
- Separate `SpectrumAnalyzer`
- Config object for thresholds, sample rate handling.
- Expose high-level `TunerProcessor` from WASM, not raw yin/mpm.

### 3. Vue / Frontend Reactivity Specialist
**Critique:** One massive composable violates single-responsibility. Visualizers leak Web Audio API details into components. State is scattered (refs everywhere).
**From scratch:**
- `useAudioInput()` — only mic/stream/device selection.
- `usePitchSession()` or `useTunerEngine()` — feeds buffers, gets `DetectionFrame`.
- `useVizData()` — transforms to waveform/spectrum frames.
- Visualizer components receive plain `Float32Array` or typed frames only. No knowledge of AnalyserNode or cpal.

Use signals / fine-grained reactivity. Avoid god return objects.

### 4. Rust Crate / Library Designer
**Critique:** Monolithic `pitch-core`. No separation between public API for different consumers (web WASM vs egui native). Hard to version or test pieces.
**From scratch:**
- `tuner-domain` crate (no_std friendly): Note, Tuning, pure functions.
- `tuner-dsp` crate: depends on domain, pure DSP.
- `tuner-engine` crate: depends on dsp, provides `TunerEngine` + `TunerUpdate`.
- Re-exports or workspace for convenience.

### 5. Cross-Platform / Portability Engineer
**Critique:** Web path still relies on browser Audio APIs for viz and some processing. Native uses cpal + engine. Different code paths for same concepts.
**From scratch:** Define platform-agnostic data contracts (`AudioFrame`, `DetectionFrame`). Audio input is pluggable. Viz is always driven by data, never by live audio nodes.

### 6. Testability & QA Engineer
**Critique:** Almost no unit tests for pitch logic. To test detection you need a real mic. God objects make mocking impossible.
**From scratch:** Pure functions in domain/dsp are trivial to test with synthetic sine waves at known frequencies (82.4 Hz E2, 110 Hz A, etc.). Session can be tested with fake AudioInput that feeds recorded buffers.

### 7. Performance Engineer (Real-time Audio)
**Critique:** Main-thread RAF + allocations in hot path. Spectrum computed every frame even when not shown. No ring buffers or worklet.
**From scratch:** 
- AudioWorklet for web (off-main-thread processing).
- Pre-allocated buffers everywhere.
- Optional downsampling inside engine.
- Viz computation only for enabled visualizers.

### 8. UX / Product Designer
**Critique:** Visualizers take space even when mic is off (big black boxes). UI mixes "configuration" with "live feedback" without clear states.
**From scratch:** 
- Clear states: Idle / Requesting / Listening / Detected.
- Visualizers only mounted or given height when listening.
- Main readout (note + cents) always visible and prominent.
- Sidebar for controls, main area for feedback.

### 9. Build, CI & Packaging Engineer
**Critique:** WASM build is ad-hoc. Desktop vs web have different entry points for same logic. Hard to ship consistent core.
**From scratch:** 
- DSP crate built to WASM artifact once.
- Platform shells (web, egui, tauri) depend on it.
- Clear separation in CI: build-core, build-web, build-egui, build-tauri.

### 10. Maintainability & Onboarding Lead
**Critique:** New developer opens `useTuner.ts` + `main.rs` and is overwhelmed. No clear "where does X live?".
**From scratch:** 
- One concept = one module/file.
- Excellent docs in ARCHITECTURE.md + crate-level READMEs.
- Small focused files (max ~150-200 LOC).
- Clear naming: `use*` for Vue composables, `Tuner*` for core types.

## Target Architecture (From-Scratch Design)

### Layered Structure (Loose Coupling)

```
tuner-domain/           (pure, no_std ok)
  - Note, Tuning, get_tunings()
  - frequency_to_note, get_cents, find_closest_string...

tuner-dsp/              (depends only on domain)
  - trait PitchDetector
  - yin, mpm implementations
  - SpectrumAnalyzer
  - compute_rms, normalize_level, is_likely_power_chord
  - Smoother

tuner-audio/            (depends on domain + dsp)
  - trait AudioInput { fn start(...), subscribe frames }
  - trait ToneGenerator
  - WebAudioInput, CpalAudioInput, MockAudioInput
  - WebTonePlayer, etc.

tuner-engine/           (orchestrator)
  - TunerSession or TunerEngine
  - owns config (a4, tuning), detector, smoother
  - fn process_frame(&[f32]) -> DetectionFrame
  - emits structured updates (plain data)

tuner-types/
  - DetectionFrame { freq, confidence, cents, note, is_power, spectrum }
  - WaveformFrame, SpectrumFrame, VizData

Platform shells (very thin):
- web/src/composables/   (useAudioInput, useTunerSession, useVizData)
- web/src/components/    (receive VizData only)
- egui/src/              (App uses TunerSession + painters on data)
```

**Key rules:**
- Inner layers never import outer (no web audio types in dsp).
- Communication via plain structs or events/traits.
- Visualizers are pure renderers.
- All heavy logic lives in Rust (shared).

## Proposed Phased Refactoring Plan

> **Sequenced execution order** (dependency-ordered milestones M0-M8 mapping these phases to
> specific recommendation.md problems, with verification and definition of done) lives in
> [PLAN.md](PLAN.md). The phases below are the conceptual grouping; PLAN.md is the order to do them in.

### Phase 0 — Foundations (low risk, high impact)
- Define `DetectionFrame`, `SpectrumFrame` etc. as the single source of truth (in tuner-types or domain).
- Gate visualizers behind `isListening` in App.vue (fix "big black boxes").
- Extract magic numbers into config structs.

**Status 2026-07-01:** started. `pitch-core::DetectionFrame`, `SpectrumFrame`, `WaveformFrame` and TS frame types exist; `TunerEngine::process` emits `DetectionFrame`; Tauri native emits frame-shaped events; web `useTunerSession`/`useTuner` now use an enriched `DetectionFrame` as the primary readout. Remaining: pass full tuning/target context into native frames, move egui to the same contract, and remove compatibility frequency-only aliases.

### Phase 1 — Strengthen the Core (highest value)
- Split `pitch-core`:
  - `src/domain.rs`
  - `src/dsp.rs` (or mod dsp)
  - `src/engine.rs`
  - `src/lib.rs` only re-exports + wasm bindings
- Introduce `trait PitchDetector`.
- Improve WASM exports to a higher-level API.

**Status 2026-06-30:** partially done. `domain`, `frames`, `signal`, `smoother`, `engine` and `dsp` modules exist, and `EngineConfig` is introduced. Remaining: split YIN/MPM, spectrum and wasm modules, then add `PitchDetector`.

### Phase 2 — Audio Abstraction Layer
- Define `AudioInput` trait + implementations.
- Move all `AudioContext`, stream, device enum logic behind the trait.
- Same for reference tone generation.

### Phase 3 — Decompose Web God Object
- Split `useTuner.ts` → 
  - `useAudioInput.ts`
  - `useTunerSession.ts`
  - `useReferenceTone.ts`
  - `useVizData.ts`
- Keep visualizers on data props and move the remaining session/native outputs to typed frames.

**Status 2026-07-01:** started. `useTunerSession` owns web/native/synthetic audio orchestration and pitch loop wiring; `useTuner` is thinner and exposes an enriched `DetectionFrame`, but still returns a broad view model and lacks an explicit session state machine.

### Phase 4 — Unify egui + Reduce Platform Differences
- Make egui use the same `TunerSession` / traits.
- Extract viz drawing code from `App` into data-driven painters.
- Reduce `#[cfg]` surface.

### Phase 5 — State, UI & Presentation
- Keep `useSettings` only for persistence.
- Add explicit view models for sidebar vs live feedback.
- Only render heavy viz when listening.

### Phase 6 — Testing, Perf, Tooling
- Property-based + unit tests for domain/dsp.
- Benchmarks.
- AudioWorklet spike for web.
- Better WASM packaging.

### Phase 7 — Migration & Documentation
- Incremental migration (keep facades temporarily).
- Update all docs, examples, onboarding guide.

## Immediate Next Actions (Concrete)

1. Define shared frame types in `pitch-core` (or new small crate).
2. Gate the three viz components on `isListening` (already partially done in history).
3. Begin splitting `pitch-core/lib.rs` into modules.
4. Extract `useAudioInput` from `useTuner.ts`.
5. Change one visualizer (Spectrum) to accept plain data + compute spectrum via core if possible.
6. Document progress in this file and README.

This plan prioritizes **loose coupling** and **modularity** so future features (MIDI, file playback, new platforms, better viz) become additive instead of invasive.

Any code change should be judged by: "Does this increase or decrease coupling between audio, dsp, state and presentation?"

---

**Tracked in:** this file + TODOs in code + GitHub issues when we start execution.

## Integrated Ideas, Suggestions and Improvements (June 2026)

All prior raw idea material from [TOP-500-backlog.md](TOP-500-backlog.md) and [IDEAS-round4-500.md](IDEAS-round4-500.md) has been reviewed and **влито** (integrated) here. The separate files remain active reference sources: `TOP-500-backlog.md` is the master ranked Top 500, `TOP-200-current.md` is the latest grounded code audit, and this section is the architecture-aligned living view.

- The numbered 200-item categorized list below captures focused, architecture-aligned, implementation-ready proposals (many overlap with or were inspired by the backlogs).
- High-value items from the ranked Master Top 500 are extracted and prioritized at the top.
- Selected high-impact directions from the 500 net-new (mostly instrument and workflow expansions) are folded in as a compact subsection.

Focus remains: loose coupling, completing the layers (domain/dsp/engine/audio/presentation), canvas/DPR + DSP fixes, web/egui/WASM parity, tests, DX and real guitarist value. Every idea should be judged by impact on coupling and maintainability.

### Highest-Priority Items from Master Top-500 Backlog (P1/P2, still open)
These are the current highest-scored items pulled directly from the ranked backlog (r1=review, r2/3/4=idea rounds). Many align directly with the architecture plan and the detailed list below. Prioritize these when planning work:

**P1 (critical):**
- Move DSP / pitch processing off the cpal realtime audio callback thread (egui native path).
- Remove blocking Mutex usage inside audio callback (native realtime safety).

**P2 (very high value):**
- Unify tunings and note math fully into pitch-core (verify + eliminate duplication with web/src/utils/notes.ts).
- Octave-error guard using subharmonic/NSDF analysis.
- Real Service Worker + full offline PWA (currently only manifest).
- Eliminate per-callback / per-frame heap allocations in audio paths.
- Check / enforce that Rust and TS tuning tables + frequency math match exactly (numeric equivalence).
- Code-sign + notarize for macOS/Windows desktop releases.
- Harmonic Product Spectrum (HPS) octave disambiguator reusing the existing 2048 FFT.
- High-pass filter for rumble / mains hum.
- Reconcile Rust/TS frequency-to-MIDI / note rounding behavior.
- Multi-resolution / dual-window analysis (long window for low strings, short for high strings).
- Stop calling resizeCanvas every frame (critical for current canvas-dpr-and-dsp-fixes branch).
- Tauri CSP hardening.
- Adaptive noise-floor gate.
- Verifiable "100% local, no network" privacy badge + CI zero-fetch test.
- Adaptive per-string tau search bounds derived from selected target.
- Consolidate multiple rAF loops into one.
- Decouple detection cadence from rAF / paint loop.
- CI hygiene (clippy, rustfmt, deploy freshness).
- Dedicated SEO landing page + schema.org for the web demo.
- WASM/native numeric-equivalence harness over shared fixture manifest.
- Graceful-degradation matrix (explicit states for WASM-down, mic-down, etc.).
- Playwright fake-WAV pipeline tests that assert correct detected note.
- One-Euro filter (or better predictor) for smoothing.
- Confidence-weighted late fusion (YIN + MPM + HPS + Goertzel).
- Shape/texture redundancy so "in tune" never relies on color alone (a11y).
- Property-based test for frequencyToNote round-trip across A4 sweep.
- cargo-deny + npm audit gates with committed baseline.
- "Test My Mic" self-diagnostic wizard.
- Mic-signal sanity watchdog (silent / clipping / DC / hum warnings).
- aria-live regions for note and cents.
- Auto-advance string-by-string guided tuning flow.
- WASM streaming instantiation (instantiateStreaming).
- Preallocate YIN buffers as stable singletons (max guitar range).
- Playwright E2E for permission-denied and error paths.
- Goertzel bank locked to current 6-string targets + harmonics.
- Versioned settings schema + migration runner.
- Decimate input to fixed ~22050 Hz before heavy YIN (already reflected in detailed list).

(Full ranked master table lives in [TOP-500-backlog.md](TOP-500-backlog.md).)

### Selected High-Impact Expansions from Round-4 500 Ideas
The Round-4 list focused on many instruments. For the core guitar product we selectively pull the architecturally interesting or high-ROI ones that fit the layered design (mostly P1/P2 from that round):

- **Course-aware Tuning model** (P1 H/H) — support paired strings / courses (bouzouki, charango middle course, octave pairs, 12-string, etc.). This directly affects domain.rs Tuning + detection logic.
- Per-string fifths-check and pure-interval trainers for bowed / folk (violin, cello low-end extension to ~32 Hz).
- Baroque/historical A4 quick toggles (415/430/442) + gut-string references.
- Reentrant / non-ascending string order flag (Venezuelan cuatro etc.).
- Inharmonicity-tolerant profiles + stretch for mallets/piano if we ever broaden (but start with wound guitar strings).
- "Drum mode" toggle with lug map for membrane instruments (future stretch, requires different gate + low freq).
- Vocal pitch training drills (steadiness, interval match) as optional ear-training module on top of the reference tone engine.
- Studio workflow items that are cheap: per-track tuning report from imported short clips (file input adapter).

These should be implemented only after core guitar experience and the layer boundaries are solid. Adding a TuningCourse or StringGroup concept in domain is the right first architectural step.

### Detailed Actionable Proposals (200 ideas)
The following categorized list (200 items) was created to be implementation-concrete. Many directly address or extend the priorities listed above. Use them for sprint planning.

### Performance & Efficiency (1-20)
1. Move spectrum FFT entirely into pitch-core (remove any remaining JS FFT paths).
2. Implement fixed 22050 Hz decimation inside TunerEngine before YIN/NSDF for ~2x tau speedup on guitar range.
3. Add WASM SIMD-friendly inner loops (or explicit f32x4) for difference function and NSDF peak search.
4. Preallocate all engine buffers (yin, cmndf, fft) at construction; never realloc in process().
5. Ring/circular buffer abstraction for live input samples to eliminate per-chunk Vec copies.
6. Decouple detection rate from rAF: run engine at fixed 30-60 Hz, viz at 30 fps max.
7. Gate full spectrogram computation + draw behind a user toggle + isListening.
8. Lazy load viz components (Waveform, Spectrum, Spectrogram) with defineAsyncComponent + dynamic import.
9. Throttle canvas resize/measure to resize observer + requestIdleCallback instead of every draw.
10. Cache gradient objects, Path2D objects, and font metrics for all canvas painters.
11. Use OffscreenCanvas + transferControlToOffscreen for heavy viz in supporting browsers.
12. Avoid setTransform every frame; set once on context after resize only.
13. Profile and cap maxTau using currently selected string target +/- 1 octave.
14. Single shared AudioContext for all reference + random tones (already partially done; enforce globally).
15. Remove per-frame Float32Array allocations in feed path and useTuner sampling.
16. Investigate WASM bulk memory for zero-copy waveform/spectrum handoff from Rust to JS.
17. Batch multiple short buffers into one engine.process call when mic delivers small chunks.
18. Add build-time size budget + webpack-bundle-analyzer or vite-bundle-visualizer for web.
19. Instrument hot paths with lightweight timing (performance.mark) behind dev flag.
20. Make TunerEngine optionally downsample internally and expose effective sample rate.

### DSP & Pitch Accuracy (21-40)
21. Add Harmonic Product Spectrum (HPS) as third detector; fuse with YIN+MPM via confidence-weighted average.
22. Implement sub-bin refinement (parabolic or Quinn/Jacobsen) on the FFT peak for inharmonicity work.
23. Add inharmonicity B-coefficient estimation + correction for wound bass strings.
24. Adaptive noise gate + rolling noise floor estimate before pitch search.
25. Per-string prior: when string selected, restrict search window around target freq and first 3 harmonics.
26. Octave-error guard using NSDF sub-harmonic check + spectral flatness.
27. Goertzel filter bank locked to current tuning's 6 targets + 4 harmonics for confirmation.
28. Add simple real-cepstrum cross-check as sanity vote on YIN result.
29. Hysteresis + dwell time on "in tune" state to avoid flicker on marginal signals.
30. Return multiple pitch candidates with scores from engine instead of single best.
31. Distinguish power-chord vs single note more robustly (current isLikelyPowerChord).
32. Support variable window size per frame or adaptive based on detected f0.
33. Add voiced/unvoiced decision using low-frequency energy ratio.
34. Median-of-medians or better outlier rejection on cents history for stable needle.
35. Expose raw period + tau from YIN for advanced users / debug views.
36. Synthetic harmonic stack test generator inside pitch-core with controllable inharmonicity.
37. Property-based test roundtrip: freq -> note -> closest string target within tolerance.
38. Compare Rust vs any legacy JS numbers on a shared fixture set in CI.
39. Add "stable pitch" flag: pitch has not drifted >X cents for Y ms.
40. Optional pYIN-lite (probabilistic) or Viterbi smoothing across frames when latency budget allows.

### Architecture, Layers & Coupling (41-60)
41. Finish strict layering: domain (no_std), split dsp modules, spectrum module, engine, audio-traits, types.
42. Introduce `trait PitchDetector { fn detect(&[f32], sr: f32) -> Option<Detection>; }`.
43. Extract `AudioInput` trait + WebAudioInput / CpalAudioInput / MockAudioInput.
44. Extract `ToneGenerator` trait; unify reference + ear-training tone behind it.
45. Keep all visualizers on plain data (DetectionFrame, SpectrumFrame, WaveformFrame) and finish the same contract for native/session outputs.
46. Continue splitting useTuner.ts into smaller feature view models; useAudioInput/useTunerSession/useReferenceTone are started.
47. Move note/frequency math duplication: make TS a thin client of WASM domain exports or generate from Rust.
48. Define single `DetectionFrame` struct in pitch-core and use identically in Vue and egui.
49. Remove direct state mutation from viz components; all data flows down as props.
50. Turn TunerEngine into an explicit state machine (Idle / Priming / Listening / Stable).
51. Introduce small tuner-types crate or mod for Frame types shared without pulling whole engine.
52. Make settings (A4, tuning, tolerances) a pure config value object passed into engine.
53. Eliminate global statics (WEB_ENGINE, WEB_STATE) via better WASM host object ownership.
54. Use ports-and-adapters for persistence: one SettingsStore trait, implementations for localStorage + Tauri + egui storage.
55. Ensure no outer-layer types (cpal, web-sys, AnalyserNode) leak into dsp or domain.
56. Provide a thin `TunerProcessor` high-level WASM export instead of raw detect_ functions.
57. Add clear ownership diagram in ARCHITECTURE.md for every platform path.
58. Extract common "session" orchestration so web feed path and egui loop use identical code.
59. Define stable JSON / msgpack schema for saved sessions / presets for future import/export.
60. Audit every `#[cfg]` and `if (isWasm)` for duplication; push differences only to adapters.

### Code Quality, Modularity, DX (61-80)
61. Split pitch-core/src/lib.rs into domain.rs (already started), dsp/yin.rs, dsp/mpm.rs, engine.rs, spectrum.rs, smoothing.rs, wasm.rs.
62. Enforce max 200 LOC per file guideline for new modules.
63. Add rustfmt + clippy to CI with -- -D warnings.
64. Add vitest or vitest + fake audio harness for JS note math and composables.
65. Add cargo test + property tests using quickcheck or proptest for freq/note math.
66. Add fixture-based snapshot tests (insta) for Detection on known WAV snippets (embed small assets or synthetic).
67. Unify TS and Rust tuning tables via codegen or a single source of truth (JSON5 + build script).
68. Add "no network" CI test that asserts zero external fetches in built artifacts.
69. Pin wasm-pack, rustc, node versions via rust-toolchain.toml + .nvmrc + CI matrix.
70. Create packages/ layout sketch even if not full monorepo yet (pitch-core, shared-types, web-shell, native-shell).
71. Document every public fn in pitch-core with rustdoc examples.
72. Add CONTRIBUTING.md with "how to add a new detector" and "how to add a tuning preset".
73. Add conventional PR template that asks "does this increase or decrease coupling?"
74. Extract magic numbers (2048, 0.12 threshold, 5 cents, etc.) into typed Config structs with sane defaults.
75. Add internal dev-mode "inject synthetic buffer" button for UI iteration without mic.
76. Make build produce reproducible WASM (deterministic) so hashes can be compared.
77. Add size and perf budgets as comments or md files (e.g. "engine.process < 2ms p95 on ref hardware").
78. Use workspace inheritance for common Cargo deps.
79. Add dep-review / cargo-deny + npm audit gates in CI.
80. Create a small "pitch-core/benches" with criterion for YIN on representative buffers.

### Web / Vue / WASM Specific (81-100)
81. Complete DPR handling consistently across Waveform, Spectrum, Spectrogram, CentsHistory, Fretboard (current branch work).
82. Remove all direct analyser.getByte* calls from components; compute or receive data from useVizData.
83. Make WASM init robust: show clear banner on load failure with "using fallback?" (even if no fallback).
84. Implement real AudioWorklet for mic capture + processing off main thread.
85. Use wasm-bindgen-rayon or simple threading if available for heavy analysis.
86. Version the WASM interface (detect_pitch_wasm_v1) so future changes don't break.
87. Serve pre-compressed .wasm .js .br via Vite plugin for Pages.
88. Add proper CSP for Tauri webview + web build (report-only first).
89. Fix remaining hardcoded English strings in web UI.
90. Add proper error boundary + friendly message when mic API unavailable (http vs https).
91. Persist user-chosen input device across reloads with deviceId + label validation.
92. Make A4 input use <input type=number step=0.1> + locale-aware parsing.
93. Implement Service Worker + cache-first for offline PWA (currently manifest only).
94. Add "install" prompt UI when beforeinstallprompt fires.
95. Extract l10n keys that are missing from stores/l10n.ts.
96. Drive Fretboard.vue from plain string + cents data only.
97. Add visual regression (Playwright screenshots) for main tuner states.
98. E2E: Playwright with mocked getUserMedia feeding WAV via MediaStream.
99. Add vitest fake for useTuner that feeds scripted frames.
100. Lazy-initialize expensive canvases only after first listen or explicit enable.

### egui / Native Rust UI Specific (101-120)
101. Refactor egui/src/main.rs App::update (god method) into smaller methods or separate widgets.
102. Extract painters: WaveformPainter, SpectrumPainter, SpectrogramPainter that take only data slices.
103. Unify random tone + reference tone playback code between native cpal and web (remove TODO).
104. Make device list refresh async + non-blocking; show last error.
105. Respect system "reduce motion" and high-contrast via egui options + accesskit.
106. Add native settings persistence using eframe storage + versioned schema.
107. Implement window size/position + last tuning restore.
108. Add crash/panic hook writing last 50 lines to app data dir for native.
109. Port spectrogram heatmap painting from web canvas style to egui.
110. Add menu bar (File, View, Help) with keyboard shortcuts documented.
111. Use egui plot or custom for CentsHistory instead of hand-rolled.
112. Fix hardcoded 44100 assumption in any harmonic overlay code.
113. Support HiDPI correctly (already partial via egui); verify on multi-monitor.
114. Add "export current session as NDJSON trace" for bug reports (native + web).
115. Implement proper stream error recovery for cpal (device unplugged mid-session).
116. Make egui WASM build use same feed_audio_samples contract as documented.
117. Add "pure Rust" badge / version string in native window title.
118. Reduce allocations in the egui update/draw hot loop (reuse Vecs).
119. Add keyboard focus ring + full keyboard navigation parity with web.
120. Package native as single binary; embed icons properly (current icons dir is for Tauri).

### Audio I/O, Devices, Reference & Ear Training (121-140)
121. Add input level auto-gain warning + clip detection with visual + text guidance.
122. "Test my mic" wizard: play 3s of user voice and report SNR / detected pitch stability.
123. Device change handling: restart stream cleanly without full app reload.
124. Expose sample rate actually negotiated; warn if far from 44100/48000.
125. Add output device selection for reference tone (currently default only).
126. Volume control for reference tone and random note separately.
127. Better random note: musical context (scale degree, chord tone) not pure random.
128. Reference tone with slight vibrato option for ear training realism.
129. Count-in metronome click while holding reference (user selectable BPM).
130. Record 5-10s of playing and show average tuning per string (post-session report).
131. Support virtual audio cables / loopback as valid input for studio use.
132. Latency measurement & display (mic -> detection) for transparency.
133. Per-platform mic permission preflight (AVCapture on mac for Tauri).
134. Graceful degradation when no mic: show "use reference tone only" mode prominently.
135. Mute system sounds / ducking hint while listening (desktop only, optional).
136. Add "play target note for this string" one-shot button per string selector.
137. Harmonic check mode: play 5th/7th harmonic and user matches open string.
138. Save/recall custom reference pitches (e.g. for alternate A4 historical).
139. Detect and warn on DC bias or 50/60Hz hum in input signal.
140. Provide a "headphone check" tone to verify output before relying on reference.

### Visualization & Canvas (141-160)
141. Consistent DPR scaling + backing store size logic in every canvas component (finish branch work).
142. Make all canvases respect CSS container queries or ResizeObserver only.
143. Add optional "minimal" viz mode (just big note + simple arrow) for focus / low power.
144. Spectrogram: use log-frequency scale + better color map (perceptually uniform).
145. Spectrum: show detected fundamental + first 4 harmonics as markers.
146. Waveform: overlay zero-crossings and detected period if confidence high.
147. CentsHistory: add "target band" shaded region +/- tolerance; color history by error sign.
148. Add "string inharmonicity ladder" view: partial cents deviation for current note.
149. Fretboard: highlight target fret + live cents offset on the played string.
150. PerStringCents: add sparkline trend and "last stable" value.
151. Add "ghost" previous reading faint overlay on gauge for trend.
152. High-contrast / forced-colors mode for all canvas drawings (no red/green only).
153. Printable / exportable tuning report as SVG or PNG snapshot of current state.
154. Dark / light theme toggle with proper canvas palette switch.
155. Animation: only animate needle when actively changing; respect prefers-reduced-motion.
156. Add optional "analog meter" skin for the cents gauge using canvas arc.
157. GPU-accelerated viz option (WebGL2 or egui glow) for spectrogram on powerful devices.
158. Decouple viz data rate: engine can emit at full rate, viz consumers subsample.
159. Add "freeze" button that pauses viz while continuing to update detection readout.
160. Visual regression baseline images committed for key states (in-tune, 15 cents flat, power chord, silence).

### Features, UX & Guitarist Tools (161-180)
161. Custom tuning editor: add/remove/reorder strings, name it, persist.
162. Capo mode: offset all targets by N frets with visual indicator.
163. Per-string tolerance (some strings harder to tune, user widens band).
164. Guided string-by-string workflow with "next" auto-advance when stable.
165. Session history: log last 50 tunings with timestamp + average error.
166. "How close was I" post-tune summary card.
167. Built-in chromatic mode (ignore selected tuning, just show nearest note).
168. Support 7-string and 8-string guitar presets + baritone tunings.
169. Bass guitar 4/5/6 string presets with lower freq gate.
170. Ukulele, mandolin, banjo quick presets (keep guitar primary).
171. "Tune to recording": drag short clip or use mic to analyze a reference recording's tuning.
172. Export/Import tuning presets as JSON.
173. In-app short help / onboarding tour (first-run + re-triggerable).
174. Keyboard cheat-sheet modal (all shortcuts, including hidden).
175. "Lock" A4 and tuning during a session to avoid accidental change.
176. Quick A4 from reference: "I am hearing A=442, set it" button.
177. Show open-string target frequency + detected live side-by-side.
178. Add "just intonation" vs ET deviation display toggle for interested players.
179. Simple built-in tuner "games": hit 5 strings within 3 cents in <30s challenge.
180. Optional cloud sync of personal presets/history (opt-in, end-to-end, privacy-first) or keep 100% local.

### Testing, Reliability, Accessibility, i18n, Docs, Distribution (181-200)
181. Add Playwright E2E covering permission denied, no-signal, happy path with synthetic audio.
182. Add mic-signal watchdog: silent / clipping / stuck-DC banners with actionable text.
183. Versioned settings schema + migration on load (no data loss on breaking changes).
184. Stale-PWA / update-available detection using version.json + SW.
185. Accessibility: aria-live on note + cents; full keyboard + SR testing.
186. Colorblind-safe palettes (deuteranopia etc.) selectable in settings.
187. Locale detection + full solfege (Do Re Mi) note names per language.
188. Right-to-left layout support (Arabic, Hebrew) - at least basic.
189. Add "privacy" badge + CI-enforced "zero network in release build" proof.
190. Tauri: code-sign + notarize pipeline (macOS) and EV cert for Windows.
191. Add reproducible desktop builds (same hash for same source).
192. GitHub release: attach both egui and Tauri bundles + checksums.
193. Documentation: architecture decision records (ADR) for key choices (YIN vs MPM, WASM vs native).
194. Onboarding README section with screenshots for each platform.
195. Add "contributing tunings" guide + test that all listed tunings have correct math.
196. Health dashboard page (or in-app): WASM ready?, audio context state, last error, fps.
197. Supply chain: dependabot + automated PRs with audit baseline.
198. Add end-to-end "build everything from clean checkout" verification script.
199. User satisfaction micro-survey (anonymous, 1-click "useful?") after 10 successful tunings.
200. Maintain a living "What we deliberately chose not to do" section (anti-roadmap) in ARCHITECTURE.md.

**Next step after adding these ideas:** pick highest-ROI 5-10 from the "Highest-Priority Items from Master Top-500" + the categorized list above (architecture splits + viz data decoupling + realtime safety for cpal + WASM perf + tests + one guitarist feature), turn into GitHub issues or Phase 8, execute incrementally.

### Статус интеграции бэклогов
- [TOP-500-backlog.md](TOP-500-backlog.md) — canonical master Top 500 (`M#`).
- [TOP-200-current.md](TOP-200-current.md) — latest grounded current audit (`C#`).
- [recommendation.md](recommendation.md) — stable current-problem extract cited by [PLAN.md](PLAN.md) (`R#`).
- Высокоприоритетные пункты из них **влиты** наверх этого раздела.
- 200 детализированных предложений — actionable слой поверх master backlog.
- Всегда проверяем: уменьшает ли изменение зацепленность между audio / dsp / state / presentation?

Любая новая работа должна отвечать: "Does this make future high-value backlog items easier to implement cleanly?"

## Current Top Problems (Synchronized)

**Refreshed 2026-07-01:** [recommendation.md](recommendation.md) now holds a freshly re-audited and independently re-verified **Top 50**, replacing the prior 183-item `R#` extract. Methodology: 6 parallel subsystem audits read the live source directly, pooled into 70 ranked candidates, each independently re-checked against the current file content by a separate skeptic pass (69/70 confirmed). [TOP-200-current.md](TOP-200-current.md) (`C#`) and [TOP-500-backlog.md](TOP-500-backlog.md) (`M#`) were not part of this refresh and still cite some now-stale evidence.

Key highlights that directly block the target architecture (numbers below are [recommendation.md](recommendation.md)'s new 1-50 ranking):
- Three independently-drifted YIN implementations (web TS, `pitch-core`, Tauri desktop) missing each other's bugfixes, and `pitch-core`'s wasm build is compiled but never actually used by the web app (#1, #9-11).
- Realtime-safety violations in both native audio paths: heap allocation, FFT and mutex locks inside the cpal callback with no throttling on egui (#2, #14-16).
- `pitch-core`'s detection range is hardcoded to guitar-only 30-400Hz, silently breaking every non-guitar tuning it ships (#3).
- Frame/session contracts still incomplete: egui's tuning editor doesn't re-sync the live engine (#4), Tauri hand-duplicates `DetectionFrame`'s shape (#27), all visualizers go blank on native/synthetic backends (#29), confidence is binary on web but graded on native (#18).
- God objects and oversized coupling surfaces persist: `useTuner.ts` (#40), egui `App::update` (#41).
- Domain/DSP duplication: no shared `PitchDetector` trait (#28), Rust `domain.rs` has no temperament/sweetening data at all (#26).
- Shipped-but-false or shipped-but-unverified claims: PWA "works offline" with no service worker (#6), release publishes even when a desktop build fails (#5), Playwright E2E never runs in CI (#36), unsigned/unchecksummed desktop releases (#17, #38).
- Weak test guards: `test_yin_440hz` accepts a full octave error as a pass (#8), `test_power_chord` discards its own assertion (#12), 12 of 15 web composables and all of egui/Tauri have zero tests (#22-23, #25).

When closing any of these open problems, update [recommendation.md](recommendation.md), this file, and [README.md](README.md). [TOP-200-current.md](TOP-200-current.md), [TOP-500-backlog.md](TOP-500-backlog.md), [PLAN.md](PLAN.md) and [RECOMMENDATIONS.md](RECOMMENDATIONS.md) still reference the prior `R#`/`C#`/`M#` numbering and need their own re-grounding pass before their specific line citations can be trusted again; their high-level direction remains consistent with the findings above.

Recommended reading order:
1. [recommendation.md](recommendation.md) for the current, re-verified Top 50 with exact evidence.
2. This file for the target layered design.
3. [PLAN.md](PLAN.md) for execution order (pending its own refresh against the new Top 50).
4. [TOP-200-current.md](TOP-200-current.md) / [TOP-500-backlog.md](TOP-500-backlog.md) for historical breadth, with the staleness caveat above.

## SOLID/DRY Module Decomposition ("Small Pieces")

**Added 2026-07-01.** The god-object problem described throughout this document (`useTuner.ts`, `useTuningState.ts`, `pitch-core`, `egui/src/main.rs`, `native_audio.rs`) is real but abstract until it's broken into concrete, nameable units. Below is a proposed decomposition into **32 small, single-responsibility "pieces"** across 6 domains — each piece is small enough to read, test, and fix in one sitting, and maps directly onto a group of items in [recommendation.md](recommendation.md)'s full backlog. This is the practical answer to "how do I split the project into pieces small enough to understand": pick one row below, read its target files, and work only its item list in recommendation.md.

A piece is not necessarily a file that exists yet — several (marked "proposed") are extraction targets that don't have a home yet and are themselves one of the `split`-tagged recommendation items for their parent piece.

**Web State & Session (Vue composables)**

- `P1` **useTunerOrchestrator** — web/src/composables/useTuner.ts. thin composition root; today a 302-line god object wiring 8 composables. (10 items in recommendation.md)
- `P2` **TunerSessionController** — web/src/composables/useTunerSession.ts. start/stop/backend-switch state machine. (14 items in recommendation.md)
- `P3` **useAudioInput (web mic port)** — web/src/composables/useAudioInput.ts. getUserMedia/AudioContext/device enumeration. (9 items in recommendation.md)
- `P4` **useNativeAudioInput + useSyntheticAudioInput** — web/src/composables/useNativeAudioInput.ts, useSyntheticAudioInput.ts. Tauri bridge and fixture-driven synthetic backend. (8 items in recommendation.md)
- `P5` **useReferenceTone / ToneGenerator port** — web/src/composables/useReferenceTone.ts. output tone generation, should share code with metronome/egui. (12 items in recommendation.md)
- `P6` **useMetronome** — web/src/composables/useMetronome.ts. tap-tempo/click generator. (11 items in recommendation.md)
- `P7` **useEarTraining** — web/src/composables/useEarTraining.ts. random-note ear-training workflow. (9 items in recommendation.md)
- `P8` **usePracticeController (proposed extraction)** — web/src/composables/useTuner.ts (practice/streak block). streak/history/export logic currently inline in useTuner. (9 items in recommendation.md)
- `P9` **useSettingsController / UserProfileV1** — web/src/composables/useSettings.ts, web/src/utils/settingsStorage.ts. persistence, schema, versioning. (15 items in recommendation.md)
- `P10` **useTuningState split (selection/CRUD/display)** — web/src/composables/useTuningState.ts. 487-line god object: instrument/tuning selection + custom CRUD + display all mixed. (14 items in recommendation.md)
- `P11` **useDisplayPreferencesController (proposed)** — web/src/composables/useTuner.ts, useTuningState.ts, web/src/App.vue. theme/stage/compact/colorblind scattered across files. (10 items in recommendation.md)

**Music / Pitch Domain (TS + Rust core)**

- `P12` **core/music/noteMath (TS)** — web/src/utils/notes.ts. note<->frequency<->cents math portion. (13 items in recommendation.md)
- `P13` **core/music/temperaments+sweetening (TS)** — web/src/utils/notes.ts. TEMPERAMENTS + SWEETENING_PROFILES portion. (7 items in recommendation.md)
- `P14` **core/music/instrumentsAndTunings registry (TS)** — web/src/utils/notes.ts. INSTRUMENTS/BUILT_IN_TUNINGS portion. (11 items in recommendation.md)
- `P15` **core/pitch/detectPitch (TS)** — web/src/utils/pitch.ts. YIN/autocorrelation detector, duplicated vs Rust. (13 items in recommendation.md)
- `P16` **pitch-core::domain** — pitch-core/src/domain.rs. note/tuning math; has no temperament/sweetening data at all. (13 items in recommendation.md)
- `P17` **pitch-core::dsp (yin/mpm/spectrum split)** — pitch-core/src/dsp.rs. needs PitchDetector trait, currently hardcoded 30-400Hz guitar range. (13 items in recommendation.md)
- `P18` **pitch-core::engine/smoother/signal/frames** — pitch-core/src/engine.rs, smoother.rs, signal.rs, frames.rs. session-level orchestration and shared frame types. (14 items in recommendation.md)

**Visualization / Canvas (Web + egui)**

- `P19` **useVisualizationFrames + shared frame contracts** — web/src/composables/useVisualizationFrames.ts, web/src/types/frames.ts. DetectionFrame/WaveformFrame/SpectrumFrame producers. (12 items in recommendation.md)
- `P20` **useCanvasRenderer + useHiDpiCanvas** — web/src/composables/useCanvasRenderer.ts, useHiDpiCanvas.ts. shared draw scheduling/DPR/resize. (11 items in recommendation.md)
- `P21` **Vue visualizer components** — web/src/components/Waveform.vue, Spectrum.vue, Spectrogram.vue, CentsHistory.vue, CentsHistoryGraph.vue, CentsGauge.vue, Fretboard.vue, PerStringCents.vue. includes at least 3 known-dead/orphan components. (29 items in recommendation.md)
- `P22` **egui painters split (proposed)** — egui/src/main.rs (drawing portions of App::update). waveform/needle/cents-history/spectrum/spectrogram all inline in one 330-line fn. (30 items in recommendation.md)

**Native Audio & Desktop Platform (Tauri + egui infra)**

- `P23` **desktop native_audio service split** — desktop/src-tauri/src/native_audio.rs. proposed commands.rs/service.rs/stream.rs/pitch.rs/events.rs. (22 items in recommendation.md)
- `P24` **egui AudioManager / device+stream lifecycle** — egui/src/main.rs (AudioManager, toggle_mic, device switching). device double-toggle hack, no SampleFormat dispatch. (32 items in recommendation.md)
- `P25` **Tauri release/signing/CSP/distribution** — desktop/src-tauri/tauri.conf.json, .github/workflows/build-tauri.yml, release.yml. unsigned builds, no checksums, dev CSP in prod. (19 items in recommendation.md)

**Testing / CI / Build / Release / Docs**

- `P26` **Test coverage & CI wiring** — web/tests/*, web/e2e/*, pitch-core #[test] blocks, .github/workflows/*. 12/15 composables untested, Playwright not run in CI, egui/Tauri unlinted. (42 items in recommendation.md)
- `P27` **Build/PWA/release pipeline & docs accuracy** — web/vite.config.ts, web/public/manifest.webmanifest, web/package.json, README.md claims. false "works offline" claim, no service worker, wasm dead weight. (16 items in recommendation.md)

**Product / UX / Visual Design**

- `P28` **Design system (typography/color/spacing/iconography)** — web/src/style.css, Tailwind usage across web/src/components. design-token consistency, dark/light/colorblind theme parity. (18 items in recommendation.md)
- `P29` **Interaction design & states (idle/listening/error/motion)** — web/src/App.vue, components/*.vue (MicButton, NoteDisplay, CentsGauge). state machine visibility, feedback, microinteractions. (19 items in recommendation.md)
- `P30` **Information architecture / feature screens** — web/src/App.vue overall layout. single overloaded screen vs tuner/practice/library/settings split. (15 items in recommendation.md)
- `P31` **Accessibility-as-design (cross-cutting)** — web/src/App.vue, components/*.vue, style.css. contrast, focus, redundant non-color cues, motion-reduction, as design decisions not just aria attributes. (20 items in recommendation.md)
- `P32` **Content/copy & localization design** — web/src/stores/l10n.ts, egui/src/main.rs strings. tone/clarity of copy, RU/EN parity, egui hardcoded English. (19 items in recommendation.md)

## Design Review (Product / Visual Design Pass)

**Added 2026-07-01.** A dedicated design-critique pass over the 5 pieces of the Product/UX/Visual Design group (`P28`-`P32`), read the way a senior product/visual designer would: information hierarchy, typography scale, color-token consistency, contrast, spacing rhythm, motion, and copy tone — grounded in the actual CSS, Vue templates, and localization strings, not generic design platitudes. 91 items total; the full list (compact form) is also folded into [recommendation.md](recommendation.md)'s piece-organized backlog under `P28`-`P32`. Reproduced here in fuller depth because design critique loses most of its value when compressed to one line.

### P28 — Design system (typography/color/spacing/iconography)

_web/src/style.css, Tailwind usage across web/src/components — design-token consistency, dark/light/colorblind theme parity_

- **[bug] Accent colors are hardcoded hex literals repeated across style.css instead of a CSS custom property (`web/src/style.css:61,80,104,223`).** Emerald #22c55e is hardcoded 4 separate times in style.css (gauge fill, .string-btn.active border, .btn-primary, .segmented button.active) and reappears again as literal hex in web/src/components/CentsGauge.vue (lines 35,39,45,56), so a rebrand or contrast fix means hunting every literal instead of editing one --color-accent variable, even though :root already exists for --mono.
- **[split] Extract the .theme-light and .theme-colorblind override blocks (style.css:289-371) into separate theme partial files (`web/src/style.css:289-371`).** style.css mixes base component styles (buttons, gauge, string-btn) with two full theme-override blocks totaling ~83 lines of !important-laden selectors in the same file, mixing 'define the design system' with 'override it per theme'.
- **[bug] Theme overrides select on Tailwind arbitrary-value bracket syntax, so a components's inline class literal change silently breaks the light theme (`web/src/style.css:313-317`).** .theme-light .bg-\[\#0f1319\], .bg-\[\#11151b\], .bg-\[\#1f2937\] hardcode the exact bracket syntax as CSS selectors; these three literals are used as inline Tailwind classes in well over a dozen components (TemperamentPanel.vue, CentsGauge.vue, LevelMeter.vue, App.vue, etc.), so any single component changing its literal breaks light-theme overrides there with no compiler warning.
- **[design] note-letter font-size uses five different magic values across layout modes with no shared scale token (`web/src/style.css:26,35,260-262,281-283,378`).** Base .note-letter is 7rem, mobile query drops it to 5.25rem, .layout-stage is 9rem (6rem on mobile), and .layout-compact is 4.5rem: five independent magic numbers with no documented type-scale relationship, making it hard to predict what a sixth layout mode should use.
- **[bug] Card and stat-tile borders are barely distinguishable from their background fills, especially in dark mode (`web/src/style.css:163-167,227-233`).** .card border #1f2937 against body background #0a0c10 computes to roughly a 1.33:1 contrast ratio (verified via WCAG relative-luminance formula), and .card's own border-vs-fill contrast is about 1.25:1, so card boundaries are nearly invisible and rely on subtle background luminance shifts rather than a clear border.
- **[bug] btn-ghost and card share near-identical background/border pairs, creating an inconsistent elevation ladder (`web/src/style.css:112-115,163-167`).** .btn-ghost (background #1f2937, border #334155) and .card (background #11151b, border #1f2937) form an inconsistent elevation ladder: btn-ghost's background equals card's own border color, with no documented token system explaining which shade means 'more prominent'.
- **[bug] cents-bar 'out of tune' amber and the amber used for power-chord/miss labels are declared independently with no shared token (`web/src/style.css:66`).** .cents-bar .fill.out (style.css:66, #f59e0b) vs NoteDisplay.vue:26 (text-amber-400) and EarTrainingPanel.vue:53 (text-amber-300) all mean 'attention/warning' but are three unrelated color declarations that can drift independently.
- **[idea] Define an accent/warning/listening CSS custom-property triad and point every green/amber/red usage at it (`web/src/style.css:61,66,80-82,104,223`).** style.css repeats #22c55e 4+ times and #f59e0b/#ef4444 multiple times each across base styles and theme overrides; centralizing into root custom properties would make the colorblind/light theme overrides a one-line redefinition instead of a parallel selector list.
- **[design] segmented button font-size is smaller than string-btn font-size despite both being primary tuning controls of similar visual weight (`web/src/style.css:74,213`).** .string-btn is 0.875rem vs .segmented button at 0.75rem, an unintentional type-scale mismatch between two same-level interactive control families with no documented rationale.
- **[bug] Field-caption labels use two different sizes for the same semantic role (`web/src/style.css:179,246`).** .option-field (font-size 0.75rem, inherited by its span) vs .stat-tile span (0.625rem, uppercase) style the same semantic role, a small caption under/before a value, with no shared utility class.
- **[split] Extract the repeated 'label span + input/select' pattern in .option-field into a shared FormField wrapper component (`web/src/components/TuningOptions.vue:31-82`).** TuningOptions.vue and MetronomePanel.vue:50-86 both hand-roll the same span+input markup styled by the shared .option-field CSS class, so a single FormField component with a label slot would remove the duplicated implementations (note: App.vue's A4 input at lines 124-136 uses a similar hand-rolled pattern but does not actually use the .option-field class, so it is a separate, unrelated duplication).
- **[idea] Introduce a documented spacing scale referenced consistently instead of the current ad hoc mix of gap utilities (`web/src/App.vue:75,86,90,100,123`).** App.vue alone mixes gap-3, gap-2, gap-1.5, gap-6, and gap-3 across nearby flex groupings with no documented rule for when to use which, making new component authoring inconsistent.
- **[bug] cents-bar green/amber and CentsGauge's inline SVG fills duplicate the same literal hex values with no shared source (`web/src/style.css:61,66`).** .cents-bar .fill{background:#22c55e} / .fill.out{background:#f59e0b} in style.css and CentsGauge.vue's inline SVG fill/stroke attributes (lines 35, 39, 45) hardcode the identical hex values a second time, so the two never-shared color definitions can silently diverge if one is edited without the other.
- **[design] stat-tile, ear-training target readout, and metronome BPM readout each use a different font size for their 'headline number' with no shared emphasis scale (`web/src/style.css:238,web/src/components/EarTrainingPanel.vue:35,web/src/components/MetronomePanel.vue:31`).** .stat-tile div is 1.25rem vs EarTrainingPanel's target readout at text-2xl (1.5rem) vs MetronomePanel's BPM readout at font-mono text-xs (0.75rem): three different 'this panel's key metric' font sizes across visually similar card blocks with no shared scale.
- **[bug] btn-primary hover green and string-btn/segmented active green are inconsistently related shades with no systematic hover-darkening convention (`web/src/style.css:104,109,223`).** #22c55e is used for btn-primary base with #16a34a defined as its :hover, while .segmented button.active and .string-btn.active reuse #22c55e/border with no :hover rule defined at all, so a hover-darkening convention exists for one button style but is never applied to the others.
- **[split] Extract the .segmented, .string-btn, and DisplayModeSelector's inline Tailwind pill-button styling into one shared SegmentedControl component (`web/src/style.css:198-225,web/src/components/DisplayModeSelector.vue:24-25`).** The same 'group of mutually-exclusive pill buttons' pattern is independently reimplemented as CSS classes (.segmented) and as inline Tailwind in DisplayModeSelector.vue (bg-emerald-500 vs hover:bg-slate-800 conditional classes), so the same visual component exists as two implementations that must be kept in sync by hand.
- **[bug] Compact layout mode hides the footer entirely instead of adapting its content (`web/src/style.css:285-287`).** .layout-compact footer{display:none} means switching to Compact mode removes footer attribution content outright instead of shrinking it, inconsistent with how note-letter font-size and .card padding just scale down in the same layout block (lines 268-283).
- **[design] The same emerald hue is overloaded across three semantically distinct states: selection, success, and active-toggle (`web/src/style.css:61,79-83,223`).** .string-btn.active (selection), .cents-bar .fill (success/in-tune), and .segmented button.active (chosen display mode) all share the same #22c55e-family green, so a colorblind-safe or status-vs-selection redesign would require touching this one hue across unrelated meanings.

### P29 — Interaction design & states (idle/listening/error/motion)

_web/src/App.vue, components/*.vue (MicButton, NoteDisplay, CentsGauge) — state machine visibility, feedback, microinteractions_

- **[bug] Dead 'requesting' l10n key never rendered during mic permission wait (`web/src/stores/l10n.ts:14`).** web/src/stores/l10n.ts:14 (ru) and :124 (en) define 'requesting'/'REQUESTING MIC...' but no component calls t('requesting'); web/src/components/MicButton.vue only branches on isListening (lines 15,19-22), so there is no intermediate state shown while getUserMedia is pending.
- **[idea] MicButton has only idle/listening visuals, no pending or error state (`web/src/components/MicButton.vue:15-22`).** web/src/components/MicButton.vue:15-22 toggles solely on the isListening boolean (default vs 'listening' class, mic emoji vs stop glyph), so a slow or failed getUserMedia request renders identically to an untouched idle button; the unused t('requesting') key could drive a distinct pending look.
- **[design] Gauge and strobe CentsGauge modes signal in-tune purely via fill color/opacity (`web/src/components/CentsGauge.vue:39,56`).** web/src/components/CentsGauge.vue:39 (gauge needle fill flips #22c55e/#f59e0b) and :56 (strobe stripe opacity 0.75 vs 0.35) are color/opacity-only in-tune cues with no shape change; note needle mode's own line at :46 is a static amber stroke unrelated to isInTune, so that mode's SVG carries no color-coded in-tune signal at all, leaving only the text pill (lines 63-76) to convey state there.
- **[bug] Keyboard shortcuts (Space/M/R/1-9) have zero on-screen affordance beyond one small footer line (`web/src/App.vue:333-334`).** web/src/App.vue:333-334 is the only hint, an 11px slate-500 line placed right before the footer, past MicButton, MetronomePanel, and EarTrainingPanel, so a first-time user has no way to discover shortcuts without scrolling to the bottom.
- **[bug] Error banner and dismiss control have no distinct visual weight or icon (`web/src/App.vue:170-173`).** web/src/App.vue:170-173 renders tuner.error as plain red-400 text in a red-950/40 box with a thin red-900 border and an underlined text-only 'dismiss' link, no icon or elevated weight to make a real getUserMedia failure stand out against the visualizer area above it.
- **[split] Extract a shared confidence-badge pattern instead of inlining it in NoteDisplay (`web/src/components/NoteDisplay.vue:16,24-27`).** web/src/components/NoteDisplay.vue:16 computes confidencePercent and lines 24-27 render it as gray 'conf N%' text plus an amber '(power)' tag, a self-contained detection-quality indicator mixed into NoteDisplay's template that could be reused by future surfaces (e.g. a diagnostics panel).
- **[bug] CentsGauge needle-mode SVG text labels duplicate the always-visible HTML -50/0/+50 legend (`web/src/components/CentsGauge.vue:21-25,48-50`).** web/src/components/CentsGauge.vue:21-25 renders an unconditional -50cents/reading/+50cents legend above all three display modes, and needle mode additionally draws its own '-50'/'0'/'+50' <text> elements at font-size 5 (lines 48-50), so only needle mode shows the range twice in two different typefaces/sizes.
- **[bug] MicButton emoji glyphs render with OS/browser-dependent color and weight (`web/src/components/MicButton.vue:19-20`).** web/src/components/MicButton.vue:19-20 uses native glyphs (stop-square and mic emoji) rather than an SVG icon, so the button's tap-to-start affordance can look markedly different across Windows/macOS/Linux emoji rendering.
- **[design] MicButton's caption and the header session-status pill narrate the same boolean with different wording (`web/src/components/MicButton.vue:22,web/src/App.vue:92`).** web/src/components/MicButton.vue:22 shows 'tap to start'/'tap to stop' while web/src/App.vue:92 shows 'READY'/'LISTENING' in the header pill, both derived from tuner.isListening but with different verbs and casing, giving the user two captions for one state (though one reads as an instruction and the other as a status indicator, so the overlap is partial rather than pure duplication).
- **[idea] LevelMeter collapses to a bare 4px strip when inactive, causing a layout jump (`web/src/components/LevelMeter.vue:34`).** web/src/components/LevelMeter.vue:34 (`<div v-else class="h-1" />`) means the meter's rendered height drops from a label+bar block to a bare 4px strip the instant isListening flips, shifting everything below it including the waveform/spectrum toggles.
- **[bug] MetronomePanel beat dots convey the active beat purely via background color on identical-size circles (`web/src/components/MetronomePanel.vue:34-39`).** web/src/components/MetronomePanel.vue:34-39 toggles only bg-emerald-400/border-emerald-300 vs bg-slate-900 on same-size h-2.5 w-2.5 dots, and web/src/style.css has no .metronome or beat-dot selector at all, so the colorblind theme provides no override and the active beat is indistinguishable by shape or size for colorblind users.
- **[split] Extract the metronome beat-dot row into its own subcomponent (`web/src/components/MetronomePanel.vue:33-40`).** web/src/components/MetronomePanel.vue:33-40 mixes bpm/beats/subdivision numeric controls with a bespoke inline beat-indicator markup; splitting the dots into a BeatIndicator component would let a future fix (e.g. adding shape/motion redundancy) land without touching the control form.
- **[bug] Metronome start/stop button uses generic lowercase l10n keys, inconsistent with the app's uppercase button convention (`web/src/components/MetronomePanel.vue:45,web/src/stores/l10n.ts:17-18,127-128`).** web/src/components/MetronomePanel.vue:45 renders {{ isRunning ? t('stop') : t('start') }} using web/src/stores/l10n.ts:17-18 (ru) and :127-128 (en) which are lowercase strings ('start'/'stop'), while sibling buttons use uppercase content strings (e.g. 'START MICROPHONE', 'PLAY REFERENCE'); note the .btn CSS class itself has no text-transform, so this is a raw string-casing inconsistency, not a CSS gap.
- **[bug] CentsGauge needle-mode's green highlight arc is a static decoration unrelated to isInTune (`web/src/components/CentsGauge.vue:45-46`).** web/src/components/CentsGauge.vue:45 draws a fixed green arc at opacity 0.55 that never changes with isInTune or cents, and the needle's own stroke color at line 46 is likewise a static #f59e0b, so needle mode's SVG carries no color-coded tuning feedback at all, only the needle's rotation angle and the text pill below it.
- **[bug] EarTrainingPanel's five action buttons carry the same visual weight regardless of destructive-vs-progressive semantics (`web/src/components/EarTrainingPanel.vue:41-53`).** web/src/components/EarTrainingPanel.vue:41 gives 'next' a btn-primary while play/reveal/correct/miss (lines 44,47,50,53) are all btn-ghost differentiated only by text color, so ANSWER (which spoils the exercise) carries no more visual weight or confirmation step than REPLAY (which is harmless).
- **[design] MetronomePanel's BPM/Beats/Subdivision inputs share a 5-column grid with full-width action buttons (`web/src/components/MetronomePanel.vue:43,50-86`).** web/src/components/MetronomePanel.vue:43 (grid-cols-2 sm:grid-cols-5) places the toggle and tap buttons alongside three option-field label+input pairs (lines 50-86) in one grid, so at the 5-column breakpoint the BPM stepper (range 30-240) gets the same narrow column width as the short 'tap' button, cramping the tap-tempo interaction.
- **[bug] Reference-tone and mic-stop icons reuse the identical glyph for two independent audio streams (`web/src/components/TunerControls.vue:25,web/src/components/MicButton.vue:19`).** web/src/components/TunerControls.vue:25 uses '■' for 'stop reference tone' and web/src/components/MicButton.vue:19 uses the same '■' for 'stop listening'; since reference playback and mic capture can run simultaneously, the glyph gives no visual cue which stream a given ■ refers to outside of button position.
- **[bug] FreqReadout duplicates the target frequency already shown in NoteDisplay within the same card (`web/src/App.vue:175-183,209-213`).** web/src/App.vue:175-183 renders NoteDisplay with :target-freq (shown per web/src/components/NoteDisplay.vue:35 next to the target note name), and web/src/App.vue:209-213 renders FreqReadout further down in the same main-card, which again shows target Hz (per web/src/components/FreqReadout.vue:20-23), so the target frequency appears twice in one scroll region with no cross-reference.
- **[bug] Reference-tone button's :disabled binding is dead logic because can-play-ref is hardcoded true (`web/src/App.vue:292,web/src/components/TunerControls.vue:22`).** web/src/App.vue:292 passes :can-play-ref="true" unconditionally into TunerControls.vue, whose :disabled="!canPlayRef" binding at line 22 can therefore never fire, so users get no feedback for cases where reference playback would be a no-op.

### P30 — Information architecture / feature screens

_web/src/App.vue overall layout — single overloaded screen vs tuner/practice/library/settings split_

- **[bug] Single-screen App.vue stacks tuner, tuning config, ear training, stats, and metronome (`web/src/App.vue:98-336`).** A first-time user opening the tuner sees TuningOptions, TemperamentPanel, CustomTuningEditor, StringOffsetsPanel, CustomTuningTransfer, InstrumentProfileEditor, EarTrainingPanel, PracticeStatsPanel, and MetronomePanel all stacked vertically before ever plucking a string, burying the core tune-a-string task under nine unrelated panels.
- **[design] No visual distinction between the 'core tuning' card and the 'configuration' card (`web/src/App.vue:100,216`).** The main-card (mic/note/gauge, line 100) and the settings card (instrument/temperament/tuning/strings/offsets, line 216) share the identical bare `.card` class with no heading or icon marking the boundary between live tuning state and configuration.
- **[idea] Add a persistent mini-readout so the detected note stays visible while scrolled into settings (`web/src/App.vue:100-214,216-287`).** Once a user scrolls to the settings card (216-287) to change instrument/tuning/temperament, the note/cents readout in main-card (100-214) scrolls fully out of view, breaking the tuning feedback loop; a sticky mini-readout would preserve it.
- **[split] Split App.vue's single template into logical screens via a view-state switch (`web/src/App.vue:70-342`).** Today all nine feature components (main-card 100-214, settings card 216-287, TunerControls 289-295, EarTrainingPanel/PracticeStatsPanel/MetronomePanel 297-331) mount and stay mounted simultaneously; a `view` ref ('tuner'|'tuning'|'practice'|'settings') with v-show/v-if per zone would let only the active screen render.
- **[design] Settings card flattens 8 sub-features with no accordion or grouping headers (`web/src/App.vue:216-287`).** TuningOptions, TemperamentPanel, TuningSelector, StringSelector, CustomTuningEditor, StringOffsetsPanel, CustomTuningTransfer, and InstrumentProfileEditor sit in one `.card p-6 space-y-4` block with only implicit spacing separating them, so power-user CRUD features get the same visual weight as the everyday tuning selector.
- **[bug] Audio-source configuration is split across two distant regions of the page (`web/src/App.vue:149-166,216-287`).** The native/web backend select and InputDeviceSelector sit in the visualizer-toggle row inside main-card (149-166), while every other configuration control (instrument, temperament, tuning) lives in the separate settings card (216-287), splitting one conceptual 'configure audio input' task across unrelated regions.
- **[design] EarTrainingPanel, PracticeStatsPanel, and MetronomePanel render as three undifferentiated cards with no shared grouping (`web/src/App.vue:297-331`).** All three use the identical `card p-5 space-y-4` class with no shared section wrapper, background tint, or eyebrow heading, so a user scrolling past the tuner cannot tell where tuning ends and practice mode begins.
- **[idea] Collapse the practice/ear-training/metronome trio behind a disclosure toggle for pure tuning use (`web/src/App.vue:297-331`).** EarTrainingPanel, PracticeStatsPanel, and MetronomePanel always render even for a user who only opened the app to tune, adding three full-width cards of scroll before the footer hint at line 333.
- **[bug] A4 reference-pitch input and visualizer checkboxes live in the tuner card, not the settings card (`web/src/App.vue:122-167,216`).** The A4 Hz input and three visualizer toggles render inside main-card (122-167) alongside the live note/cents readout, while conceptually similar settings (temperament, instrument) live in the second card starting at line 216, making the 'live state vs configuration' boundary inconsistent.
- **[split] Extract the visualizer-toggle-and-A4 row into a VisualizerControls component (`web/src/App.vue:122-167`).** This 46-line inline block mixes the A4 tuning-reference input, three checkbox visualizer toggles, native/web backend selection, and InputDeviceSelector delegation directly in App.vue's template, all of which could be extracted into a self-contained, independently testable component.
- **[design] StringOffsetsPanel, CustomTuningTransfer, and InstrumentProfileEditor blur together at the bottom of the settings card with no dividers (`web/src/App.vue:269-286`).** Three distinct sub-features (string offsets, tuning import/export, instrument profile CRUD) stack back to back inside the settings card with no visual divider between them, compounding the already-flagged undifferentiated-settings-card problem.
- **[bug] DisplayPreferences (theme/layout/handedness) is buried inside the main tuner card, far from the settings card (`web/src/App.vue:197-205,216`).** DisplayPreferences renders between DisplayModeSelector and CentsHistoryGraph inside main-card (100-214), so appearance/accessibility settings, which are configuration rather than live tuning data, are separated from the settings card at line 216 that holds TuningOptions/TemperamentPanel/StringOffsetsPanel.
- **[design] TuningSelector sits between TemperamentPanel and StringSelector with no heading (`web/src/App.vue:241-247`).** TuningSelector is wrapped in a bare flex div with no label distinguishing 'pick a tuning' from the temperament block above (230-239) and the string-selection block below (249-258) in the same undifferentiated settings card.
- **[split] Extract App.vue's keyboard shortcut handler into a useKeyboardShortcuts composable (`web/src/App.vue:43-59`).** handleKey mixes DOM focus-guarding, mic toggling, reference-tone toggling, and numeric string-selection dispatch directly in the root component, alongside App.vue's theming classes and entire template tree.
- **[bug] Capo/transpose and instrument/temperament controls sit in one undifferentiated grid despite different scopes of effect (`web/src/components/TuningOptions.vue:30`).** `grid gap-3 sm:grid-cols-2` places capo and transpose (which shift the effective target pitch) in the same grid as instrument and temperament (which change the entire note set), with no grouping or subheading signaling these four controls affect tuning in two different ways.

### P31 — Accessibility-as-design (cross-cutting)

_web/src/App.vue, components/*.vue, style.css — contrast, focus, redundant non-color cues, motion-reduction, as design decisions not just aria attributes_

- **[bug] CentsGauge SVGs hardcode hex fills that bypass the colorblind theme entirely (`web/src/components/CentsGauge.vue`).** web/src/components/CentsGauge.vue:39,45,56 set fill="#22c55e"/"#f59e0b" directly on SVG rect/path elements, and style.css's .theme-colorblind block (lines 359-365) only overrides `.cents-bar .fill`, a class CentsGauge.vue never uses, so needle/gauge/strobe stay green/amber for colorblind users regardless of theme.
- **[bug] No prefers-reduced-motion media query exists anywhere despite continuous CSS animations (`web/src/style.css`).** web/src/style.css:138-148 defines `.mic-btn.listening { animation: pulse 1.8s infinite }` and App.vue:91 applies Tailwind's animate-pulse to the session-status dot, and a repo-wide grep confirms zero @media (prefers-reduced-motion) guards exist to disable or dampen either.
- **[bug] Confidence and power-chord indicators use tiny low-contrast text with no icon or pattern redundancy (`web/src/components/NoteDisplay.vue`).** web/src/components/NoteDisplay.vue:24-27 renders 'conf {{ confidencePercent }}%' at text-[10px] text-slate-500 and the '(power)' amber tag has no icon, making low detection confidence and power-chord status hard to perceive for low-vision users.
- **[design] aria-label coverage is essentially limited to the mic button; the language toggle relies on a title attribute instead (`web/src/App.vue`).** a repo-wide grep shows only MicButton.vue:17 sets aria-label while App.vue:87's RU/EN language-toggle button relies solely on title="RU / EN" (not reliably exposed by all screen readers); note the TunerControls.vue play/stop button is not actually icon-only since it already has a visible text label (t('play.reference')) next to the glyph, so it is not part of this gap.
- **[bug] Focus ring styling exists only on MicButton; other primary interactive controls have no visible :focus-visible treatment (`web/src/style.css`).** a repo-wide grep of web/src/style.css finds zero :focus or :focus-visible rules of any kind, so .string-btn (StringSelector.vue), .segmented button (DisplayModeSelector.vue/DisplayPreferences.vue), and .btn all fall back to the browser default outline instead of the emerald focus:ring-2 treatment MicButton.vue defines inline.
- **[idea] Add role=alert or aria-live to the error banner instead of relying on default DOM semantics (`web/src/App.vue`).** the error div at App.vue:170-173 has no role or aria-live attribute at all, unlike NoteDisplay.vue's aria-live="polite" (line 20) or CentsGauge.vue's role="status" (line 66), so a getUserMedia or audio backend error is shown visually but never announced to screen reader users focused elsewhere on the page.
- **[bug] Language toggle button's only accessible name is its visible text ('RU'/'EN'), not the action it performs (`web/src/App.vue`).** App.vue:87-89 gives the button an accessible name of just 'RU' or 'EN' via its text content plus a title="RU / EN" attribute, neither of which communicates that clicking switches the language, unlike MicButton.vue's descriptive aria-label.
- **[bug] DisplayModeSelector's aria-pressed is a stringified boolean with no aria-label explaining what each display mode metaphor means (`web/src/components/DisplayModeSelector.vue`).** DisplayModeSelector.vue:26 sets :aria-pressed="mode === item ? 'true' : 'false'" but a screen reader user hears only 'gauge, pressed' / 'needle' / 'strobe' with no aria-describedby or title explaining what a strobe tuner display represents.
- **[bug] InputDeviceSelector's select gets only a focus border-color change, far weaker than MicButton's focus ring (`web/src/components/InputDeviceSelector.vue`).** InputDeviceSelector.vue:22 sets only focus:outline-none focus:border-emerald-600 (a 1px border-color shift), well below MicButton.vue's focus:ring-2 focus:ring-offset-2 focus indicator strength, making keyboard-focus visibility inconsistent across controls in the same view.
- **[design] Metronome beat dots have no aria-live region or text equivalent announcing the current beat (`web/src/components/MetronomePanel.vue`).** MetronomePanel.vue:33-40 renders the beat indicator as purely visual span dots with no aria-hidden+text fallback (e.g. 'beat 2 of 4'), so a blind user running the metronome gets no non-audio confirmation of the current beat position.
- **[bug] PracticeStatsPanel's export/clear buttons use only 45%-opacity dimming as the disabled indicator, with no explanatory text (`web/src/components/PracticeStatsPanel.vue`).** PracticeStatsPanel.vue:70-75 disables both buttons via :disabled with no title/aria-describedby, so they fall back to style.css:121-124's .btn:disabled { opacity: 0.45 }, a subtle visual cue a low-vision user may not register as 'disabled', with no text explaining 'no history yet'.
- **[idea] App.vue has zero semantic landmark elements (main/header/section) outside a single footer (`web/src/App.vue`).** the entire App.vue template (lines 71-341) uses only div wrappers for the header, main tuner card, and settings/practice cards, with <footer> (line 338) as the only semantic landmark, leaving screen-reader users no way to jump between regions via landmark navigation.
- **[bug] Keyboard shortcuts silently no-op when focus is inside any input/select/textarea, with no visible indicator of this behavior change (`web/src/App.vue`).** App.vue:44-45's `if (target?.closest('input, select, textarea, button, [contenteditable="true"]')) return` means pressing Space while the A4 or BPM number input has focus does nothing, silently breaking the Space-to-toggle-mic shortcut with no on-screen feedback that focus context changed shortcut behavior.
- **[bug] TuningOptions' label-wrapped fields have no explicit id/for pairing, only implicit label-wrapping (`web/src/components/TuningOptions.vue`).** TuningOptions.vue:31-42 and 57-81 wrap each <span>{{ t('instrument') }}</span> plus <select>/<input> inside <label class="option-field"> with no id/for pair; this works today via implicit label-wrapping but breaks silently if a field is ever pulled out of the label during refactoring.
- **[bug] DisplayPreferences' fullscreen toggle button has no aria-pressed feedback despite being a stateful toggle (`web/src/components/DisplayPreferences.vue`).** DisplayPreferences.vue:73-75 renders the fullscreen button as a plain <button> with no aria-pressed even though it is a stateful enter/exit toggle, inconsistent with DisplayModeSelector.vue's explicit aria-pressed for a conceptually similar toggle pattern (the left-handed checkbox at lines 65-70, by contrast, is a native input[type=checkbox] with :checked binding and doesn't need aria-checked).
- **[bug] StringOffsetsPanel's per-string offset inputs have no explicit id/for pairing or aria-label naming which string+octave the field controls (`web/src/components/StringOffsetsPanel.vue`).** StringOffsetsPanel.vue:45-64 wraps the note-name text and numeric offset input in one implicit <label> with no for/id, so screen readers announce only the note name with no indication the number represents a cents offset, since the visually adjacent '¢' span isn't part of the accessible name.
- **[design] Disclosure toggles built on native details/summary have no visible focus-visible styling or chevron indicating they're interactive (`web/src/components/InstrumentProfileEditor.vue`).** InstrumentProfileEditor.vue:30-33 (and the same pattern in StringOffsetsPanel.vue:25-28) use bare <details><summary> with automatic aria-expanded semantics but no focus ring styling matching the app's MicButton precedent and no custom disclosure chevron, giving keyboard users no visual cue the row is interactive.
- **[design] Destructive practice-history clear action relies solely on red text color with no icon or confirmation (`web/src/components/PracticeStatsPanel.vue`).** PracticeStatsPanel.vue:73 ('practice.clear', wired to tuner.clearPracticeHistory, an irreversible action) relies solely on text-red-300 border-red-900/60 styling with no trash icon, confirmation dialog, or textual warning, so colorblind users or anyone scanning quickly get no non-color cue this button erases data.
- **[bug] TuningSelector's select field explicitly removes the browser focus outline and substitutes only a weak border-color change (`web/src/components/TuningSelector.vue`).** TuningSelector.vue:28 sets focus:outline-none focus:border-emerald-600, removing the default outline for a 1px border-color change that falls short of WCAG 2.4.7's focus-visibility bar MicButton.vue satisfies via a 2px ring; TuningOptions.vue's fields, by contrast, rely on the plain .option-field select/input CSS rule (style.css:186-196) which does not remove the default outline.
- **[idea] CentsGauge's numeric cents readout has no aria-live region, unlike the sharp/flat status pill below it (`web/src/components/CentsGauge.vue`).** CentsGauge.vue's outer wrapper (line 20) and the numeric cents value (lines 20-25) carry no aria-live attribute, so only the separate status pill at lines 64-68 (role="status" aria-live="polite") auto-announces changes, meaning screen-reader users get the sharp/flat direction announced but not the precise cents number as it updates.

### P32 — Content/copy & localization design

_web/src/stores/l10n.ts, egui/src/main.rs strings — tone/clarity of copy, RU/EN parity, egui hardcoded English_

- **[bug] egui native client copy is entirely hardcoded English with no localization mechanism (`egui/src/main.rs:149,229,242,259-263,271,290,315,329,332-333`).** main.rs never imports or references anything like l10n.ts; heading (line 149), ComboBox labels (229), collapsing header (242), device labels (271, 290), and buttons (259-263, 315, 329, 332-333) are all inline &str literals, so a Russian-speaking user gets English-only on desktop-native while the Vue app defaults to Russian.
- **[design] egui and web apps use different labels and casing conventions for identical features (`egui/src/main.rs:315,329`).** egui's "Stop Mic"/"Start Mic" (main.rs:315) and "Play Random String (ear training)" (main.rs:329) use different casing/wording than l10n.ts's 'STOP MICROPHONE'/'START MICROPHONE' (l10n.ts:48-49) and 'RANDOM NOTE (ear training)' (l10n.ts:53,163), so vocabulary is inconsistent between the two clients for the same feature.
- **[bug] t() silently falls back to the raw key string when a translation is missing (`web/src/stores/l10n.ts:230-233`).** the useL10n() `t` function (`return ru[key] ?? key`) means any typo'd or newly-added key would render verbatim like 'custom.import.failed' in the UI with no build-time or lint signal.
- **[idea] Ear-training feedback strings 'ВЕРНО'/'МИМО' read as clinical scoreboard penalties rather than encouragement (`web/src/stores/l10n.ts:59-60,169-170`).** EarTrainingPanel.vue renders these all-caps labels next to a streak/accuracy readout (component lines 32, 51, 54) for what is framed as practice, so softer copy for the miss state would better fit the encouraging tone the feature otherwise has.
- **[bug] 'temperament.comparison' mixes untranslated technical jargon into the Russian localization with no explanation (`web/src/stores/l10n.ts:80`).** the RU string 'Сравнение с равномерной темперацией, центы' assumes familiarity with temperament theory and cents with no glossary or tooltip, a steep jargon cliff relative to the plain-language tone of 'quiet.room'.
- **[bug] The 'P' key alias for toggling the reference tone is undocumented in the keyboard hint copy (`web/src/App.vue:51,web/src/stores/l10n.ts:115,225`).** App.vue's handleKey treats both 'r' and 'p' as toggling the reference tone (`e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'p'`), but 'keyboard.hint' in both RU and EN dictionaries only mentions 'R', so the P alias is undiscoverable.
- **[bug] 'tap' l10n key is left untranslated (raw English) in the Russian dictionary (`web/src/stores/l10n.ts:19,129`).** `tap: 'tap'` at line 19 of the ru object is identical to the en object's `tap: 'tap'` at line 129, so the Russian metronome tap-tempo button literally shows the English word 'tap' unlike neighboring translated keys like 'beats' -> 'Доли'.
- **[design] Russian ear-training copy is entirely ALL-CAPS, reading more aggressively than the English equivalent (`web/src/stores/l10n.ts:56-60`).** 'ear.next'/'ear.play'/'ear.reveal'/'ear.correct'/'ear.miss' are all rendered in full Cyrillic uppercase (lines 56-60), and sustained full-caps conventionally reads as shouting more strongly in Russian typography than in Latin, making the practice feature feel harsher for RU users.
- **[idea] egui's tuning editor slider has no explanatory copy for what the frequency range controls (`egui/src/main.rs:242-257`).** `ui.collapsing("Edit current tuning", ...)` renders a bare `egui::Slider::new(&mut s.frequency, 40.0..=400.0).text("Hz")` per string with no context text explaining the control, unlike the web app where CustomTuningEditor is labeled near the tuning selector.
- **[bug] egui heading bakes an implementation-detail platform suffix into user-facing copy (`egui/src/main.rs:149,web/src/stores/l10n.ts:10,120`).** `ui.heading("Guitar Tuner — egui Native")` appends the implementation detail 'egui Native' to the product title, unlike the web app's plain 'app.title' key ('Гитарный Тюнер' / 'Guitar Tuner').
- **[design] egui's input-level bar has only a static overlaid label, unlike the web app's explicit percent readout (`egui/src/main.rs:165-169,web/src/components/LevelMeter.vue:13`).** `egui::ProgressBar::new(s.level).text("Input level")` draws static text centered on the bar which can be unreadable against the fill, whereas LevelMeter.vue explicitly renders `{{ (level * 100).toFixed(0) }}%` as a separate legible number.
- **[bug] 'sweetening' l10n key is left completely untranslated in the Russian dictionary (`web/src/stores/l10n.ts:23,133`).** `sweetening: 'Sweetening / offsets'` is byte-identical in both the ru (line 23) and en (line 133) dictionaries, so Russian users see raw untranslated English for the string-offsets feature label.
- **[idea] Add a build-time check asserting every ru key has a distinct, non-pasted-through en counterpart (`web/src/stores/l10n.ts:9,119,230-233`).** because `t()` silently falls back to the raw dictionary value or key with no error signal, a simple equality/diff check between the ru and en Record<string,string> objects would catch untranslated pass-through strings like 'tap' and 'sweetening' before merge.
- **[bug] Instrument, temperament, and sweetening preset names never go through t() and render raw English even in Russian mode (`web/src/utils/notes.ts:51-127`).** INSTRUMENT_PRESETS, TEMPERAMENTS, and SWEETENING_PROFILES in notes.ts hardcode English names like 'Guitar 7-string', 'Werckmeister III', and 'Sweet Baritone Guitar' with no ru counterpart, so these render as raw English in selects regardless of the active lang, unlike every other UI string which is routed through l10n.ts.
- **[design] egui's in-tune indicator uses only a color dot with no status text equivalent to the web app's copy (`egui/src/main.rs:203,web/src/stores/l10n.ts:37,40`).** egui hardcodes an `s.cents.abs() < 5.0` green/red dot with no textual state message, while the web app communicates the same state via `t('in.tune')`/`t('waiting.signal')` copy, so the two clients diverge in both tolerance value and how state is communicated to the user.
- **[idea] egui's device-selection labels have no localized counterpart despite one existing in l10n.ts (`egui/src/main.rs:272,290,web/src/stores/l10n.ts:26,136`).** 'Default (system)' (main.rs:290) and 'Detect devices' (main.rs:272) are English-only strings; l10n.ts already defines an 'input.default' key that egui never references, so there is no single source of truth for that concept across clients.
- **[design] RU ear-training reveal button label 'ОТВЕТ' is a bare noun, grammatically inconsistent with the adjacent imperative-verb button (`web/src/stores/l10n.ts:58`).** 'ear.reveal': 'ОТВЕТ' reads as 'the answer' (a noun) while the adjacent 'ear.play': 'ПОВТОР' is an imperative verb, making the two buttons inconsistent in grammatical form for a Russian speaker.
- **[bug] 'instrument.profile.name' has no helper text and is easily confused with the similarly-worded 'custom.name' for a different concept (`web/src/stores/l10n.ts:75,93,185,203`).** 'instrument.profile.name' ('Название профиля'/'Profile name') is used only as a bare placeholder in InstrumentProfileEditor.vue with no helper text, while a differently-scoped 'custom.name' ('Название'/'Name') label is used in CustomTuningEditor.vue, so users have no copy cue distinguishing a saved instrument profile from a saved custom tuning.
- **[idea] The 'chromatic' explanatory paragraph is a permanent inline block rather than a dismissible one-time hint (`web/src/stores/l10n.ts:91,201,web/src/App.vue:259-261`).** App.vue renders the full 'Хроматический режим: играй любую ноту...' paragraph every time `tuner.strings.length` is falsy (in the v-else branch that occupies the string-grid's slot), so returning chromatic-mode users re-read the same paragraph on every visit instead of a short label plus a one-time tooltip.

