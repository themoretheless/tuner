# Guitar Tuner - Architecture & Deep Refactoring Plan

**Date:** 2026-07-09
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
- `pitch-core/src/lib.rs` remains large and mixed despite domain.rs extraction.
- `egui/src/main.rs` still has god-like `App` + heavy Mutex use + inline painter logic.
- No clear boundaries: audio I/O, DSP, domain math, session state, and presentation are mixed.
- Hard to test in isolation.
- Duplication between TS note math and Rust domain.
- Many items from the original critique are only partially addressed.

See the canonical current open-problems extract in [recommendation.md](recommendation.md), the grounded code audit in [TOP-200-current.md](TOP-200-current.md), and the full ranked Top 500 in [TOP-500-backlog.md](TOP-500-backlog.md).

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

## Integrated Ideas, Suggestions and Improvements (June/July 2026)

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

## SOLID/DRY Small-Slice Decomposition

This section turns the architecture into small, reviewable slices. The goal is not to
rename folders for aesthetics. The goal is that every future change has one natural
home, one owner, one test seam, and one reason to change.

### Dependency Rule

```text
domain -> dsp -> engine/session -> ports -> adapters -> presentation
```

- `domain` has music facts and pure math only: notes, cents, tunings, temperaments, profile schemas.
- `dsp` has signal algorithms only: YIN, MPM, HPS, gates, filters, smoothing, spectrum transforms.
- `engine/session` resolves raw signal into `DetectionFrame` and owns lifecycle state.
- `ports` define contracts: audio input, tone output, settings store, profile import/export, diagnostics.
- `adapters` talk to Web Audio, Tauri, cpal, localStorage, Tauri Store, browser APIs.
- `presentation` renders view-models and sends commands; it does not know audio or DSP internals.

### SOLID Rules For This Project

| Rule | Local Meaning | Current Violation | Small Fix |
| --- | --- | --- | --- |
| Single Responsibility | One module owns one workflow | `useTuner`, `useTuningState`, `useSettings`, `egui/main.rs` own too much | Extract session, tuning, practice, persistence, and view-model controllers |
| Open/Closed | New backend or tuning should add an adapter/data row | Backend branching spreads across UI | Add `AudioInputPort`, `ToneGeneratorPort`, registry/codegen |
| Liskov | Fake, web, native and file inputs behave through the same contract | Synthetic, web, native and egui paths expose different shapes | Make all emit `AudioFrame`/`DetectionFrame` events |
| Interface Segregation | Components receive only what they render | `useTuner` returns a giant object | Split `liveReadout`, `controls`, `practice`, `library`, `settings` slices |
| Dependency Inversion | UI depends on ports, not concrete APIs | UI still knows native/web backend flags | UI consumes capabilities and commands from session controller |

### DRY Rules For This Project

- One source for tuning/instrument/note math: Rust domain or generated registry, not hand-maintained TS plus Rust.
- One detector contract: pitch, confidence, power-chord, smoothing and gates are specified once.
- One visual data contract: `WaveformFrame`, `SpectrumFrame`, `DetectionFrame`.
- One lifecycle contract: `idle -> starting -> listening -> stopping -> error`.
- One settings/profile schema with versioned migration.
- One design-token layer for color, spacing, typography and motion.
- One diagnostics vocabulary for mic, backend, WASM, clipping, silence, device-loss and permission errors.

### Target Small Modules

| Slice | Target Module | Current Files To Peel From | Tests First |
| --- | --- | --- | --- |
| Live session lifecycle | `web/src/application/tunerSessionController.ts` | `useTunerSession.ts`, `useTuner.ts` | backend switching, duplicate start/stop, range update |
| Audio port | `web/src/ports/audioInput.ts` + adapters | `useAudioInput.ts`, `useNativeAudioInput.ts`, synthetic input | fake adapter contract tests |
| Tone port | `web/src/ports/toneGenerator.ts` | `useReferenceTone.ts`, `useEarTraining.ts`, egui output code | reference/ear-training tone tests |
| Music domain | `web/src/core/music/*` or generated from Rust | `web/src/utils/notes.ts`, `pitch-core/src/domain.rs` | Rust/TS parity by construction |
| Pitch domain | `web/src/core/pitch/*` and `pitch-core/src/dsp/*` | `web/src/utils/pitch.ts`, `pitch-core/src/dsp.rs` | fixture + property tests |
| Practice workflow | `web/src/application/practiceController.ts` | `useTuner.ts`, `useEarTraining.ts`, settings history | streak/export/import tests |
| Profile persistence | `web/src/application/userProfile.ts` | `useSettings.ts`, custom transfer UI | migration + roundtrip tests |
| Diagnostics | `web/src/application/audioDiagnostics.ts` | scattered error strings | silence/clipping/device-loss tests |
| Presentation slices | `web/src/view-models/*` | broad `useTuner` return | snapshot shape tests |
| egui painters | `egui/src/painters/*` | `egui/src/main.rs` | golden data-to-painter smoke tests |

### Refactor Order By Bite Size

1. Add explicit `TunerSessionStatus` and serialize `start/stop/restart`.
2. Add `AudioInputPort` with fake/web/native adapters.
3. Move native tuning context into `DetectionFrame`.
4. Move egui readout onto the same `DetectionFrame`.
5. Extract practice summary/controller from `useTuner`.
6. Split `useTuner` return into small view-model slices.
7. Split pitch range, stats, smoother and detector modules.
8. Add `PitchDetector` trait in Rust.
9. Move spectrum analyzer out of engine.
10. Introduce versioned `UserProfileV1`.
11. Make `notes.ts` a compatibility export around generated/shared domain.
12. Split `App.vue` into Tune, Practice, Library and Settings feature shells.

## Designer-Led Product Direction

The tuner should feel like an instrument tool, not a dashboard. The first screen must
answer three questions in under a second: am I listening, what note is detected, and
which direction should the player move?

### Information Architecture

- **Live Tuner:** mic button, level, note, cents gauge, target, selected string, minimal backend status.
- **Practice:** ear-training challenge, metronome, streak/history, export stats.
- **Library:** instruments, tunings, custom profiles, import/export.
- **Settings:** audio backend/device, A4, temperament, theme, accessibility, diagnostics.

### Visual Design Principles

- Keep the main note and cents direction dominant. Controls should not compete with the readout.
- Use stable layout dimensions for gauge, note, buttons and visualizers to prevent jitter.
- Treat visualizers as optional instruments, not permanent black boxes.
- Use semantic tokens: `surface`, `surface-raised`, `text-primary`, `text-muted`, `accent-tuned`, `accent-flat`, `accent-sharp`, `focus`, `danger`.
- Color must never be the only signal. Pair tuned/flat/sharp with shape, label, needle direction, haptic/audio options.
- Stage mode should be high-contrast and sparse. Compact mode should be dense but not miniature.
- Mobile should privilege one-handed tuning: bottom controls, large note, thumb-reachable string picker.
- Desktop should privilege scanning: left live readout, right collapsible controls, keyboard-friendly focus order.

### UI Components To Refine

| Component | Design Fix | Architecture Fix |
| --- | --- | --- |
| `NoteDisplay` | Bigger hierarchy: note, confidence, target as separate tiers | Consume only enriched `DetectionFrame` + target display |
| `CentsGauge` | Add non-color flat/sharp/tuned cues and reduced-motion path | Render pure readout props, no tuning logic |
| `StringSelector` | Stable string tiles with clear selected/auto states | Receive small string view model |
| `TuningOptions` | Split basic vs expert controls | Move temperament/capo/transpose into settings slice |
| Visualizers | Lazy, opt-in, bounded height, no idle black panels | Keep plain `WaveformFrame`/`SpectrumFrame` props |
| Diagnostics | Add "Test mic" and backend health strip | Consume diagnostics view model |

## Three-Pass Review Protocol

Every architecture change should pass these three review loops before merging:

1. **Pass 1 - Structure:** Does every new function have one reason to change? Are dependencies inward-only?
2. **Pass 2 - Design/UX:** Does the user see a calmer, clearer workflow? Are states, labels, focus and mobile layout coherent?
3. **Pass 3 - Verification:** Is there a unit, parity, E2E, visual or build check that would catch a regression?

The review outcome for this documentation sync is recorded in [recommendation.md](recommendation.md).

## Master Top 500 Register

The canonical ranked source is [TOP-500-backlog.md](TOP-500-backlog.md). The generated mirror below
is intentionally collapsible so architecture readers can inspect all 500 items without losing the
layered design narrative above.

<!-- TOP500_ARCHITECTURE:START -->
<details>
<summary>Full ranked Top 500, mirrored from TOP-500-backlog.md</summary>

| M# | Tier | Theme | Item | Note |
| --- | --- | --- | --- | --- |
| M1 | P1 | review | move DSP off cpal realtime callback |  |
| M2 | P1 | review | remove blocking Mutex in audio callback |  |
| M3 | P2 | review | unify tunings and note math into pitch-core |  |
| M4 | P2 | review | octave-error guard subharmonic/NSDF |  |
| M5 | P2 | review | real service worker / offline PWA |  |
| M6 | P2 | review | eliminate per-callback heap allocations |  |
| M7 | P2 | review | check Rust and TS tuning tables match |  |
| M8 | P2 | review | code-sign and notarize macOS/Windows |  |
| M9 | P2 | algorithms | Harmonic Product Spectrum octave disambiguator from the existing 2048 FFT | Reuses current FFT to kill octave errors with minimal code. |
| M10 | P2 | review | high-pass filter rumble/mains |  |
| M11 | P2 | review | reconcile Rust/TS frequency-to-MIDI rounding |  |
| M12 | P2 | algorithms | Multi-resolution dual-window analysis: long window for low strings, short for high | Fixes low-E resolution vs high-string latency tradeoff. |
| M13 | P2 | review | stop resizeCanvas every frame |  |
| M14 | P2 | review | Tauri CSP |  |
| M15 | P2 | review | adaptive noise-floor gate |  |
| M16 | P2 | distribution | Verifiable '100% local, no network' privacy badge backed by CI zero-fetch test | Strong trust signal with a cheap CI assertion; differentiates from cloud tuners. |
| M17 | P2 | algorithms | Adaptive per-string tau search bounds derived from the selected target | Faster, fewer-error search when string known. |
| M18 | P2 | review | consolidate five rAF loops into one |  |
| M19 | P2 | review | decouple detection cadence from rAF |  |
| M20 | P2 | review | CI hygiene clippy/rustfmt/deploy-freshness |  |
| M21 | P2 | distribution | Dedicated SEO landing page at /tuner/ targeting 'online guitar tuner' with schema.org FAQ + HowTo | Primary organic-discovery lever for a web tuner. |
| M22 | P2 | dx-quality | WASM/native numeric-equivalence harness over a shared fixture manifest | Guarantees egui and web paths agree numerically. |
| M23 | P2 | observability-reliability | Graceful-degradation matrix: explicit WASM-down / mic-down fallback states | Defines deterministic UX for every failure mode instead of blank screens. |
| M24 | P2 | docs-dx | Playwright fake-WAV pipeline test asserts detected note | Feed synthetic E2 audio, assert NoteDisplay shows E. |
| M25 | P2 | review | legible sidebar text |  |
| M26 | P2 | review | vitest unit tests note math |  |
| M27 | P2 | review | one-euro filter |  |
| M28 | P2 | review | WebKitGTK media backend AppImage |  |
| M29 | P2 | review | hardcoded 44100 in egui harmonic overlay |  |
| M30 | P2 | algorithms | Confidence-weighted late fusion of YIN, MPM, HPS and Goertzel into one estimate | Single fused estimate from existing detectors cuts octave/jitter errors cheaply. |
| M31 | P2 | a11y-deep | Shape/texture redundancy so in-tune state never relies on color alone | WCAG non-color-reliance; trivial and broadly useful. |
| M32 | P2 | dx-quality | Property-based test for frequencyToNote round-trip across A4 sweep | Catches note-math regressions cheaply. |
| M33 | P2 | dx-quality | cargo-deny + npm audit supply-chain gate with committed advisory baseline | Blocks vulnerable deps in CI cheaply. |
| M34 | P2 | observability-reliability | "Test My Mic" self-diagnostic wizard with pass/fail panel | Cuts the #1 support cause (no signal) before it becomes a bug report. |
| M35 | P2 | dx-quality | Vitest fake-mic harness driving useTuner via scripted AnalyserNode stub | Deterministic frontend tuner-logic testing. |
| M36 | P2 | observability-reliability | Mic-signal sanity watchdog (silent / clipping / DC-stuck warnings) | Proactively tells users why detection is wrong before they blame the app. |
| M37 | P2 | review | aria-live for note and cents |  |
| M38 | P2 | review | auto-advance string-by-string guided tuning |  |
| M39 | P2 | review | fix CentsHistory deep watcher |  |
| M40 | P2 | review | bound MPM NSDF tau range |  |
| M41 | P2 | review | chromatic auto-detect mode |  |
| M42 | P2 | dx-quality | insta snapshot tests for full DetectionResult on fixture WAVs | Locks down pipeline output on real signals. |
| M43 | P2 | i18n-breadth | Browser-language auto-detect via navigator.languages with persisted override | Foundation for all localization; cheap and immediately broadens reach. |
| M44 | P2 | perf-bundle | Preallocate YIN buffers as module singletons across calls | pitch.ts reallocates per size change; pin to max guitar size. |
| M45 | P2 | docs-dx | Playwright E2E for mic-permission-denied flow | Drive fake getUserMedia, assert permission UI path renders. |
| M46 | P2 | review | localize hardcoded English in-tune hint |  |
| M47 | P2 | algorithms | Goertzel bank locked to 6 selected-string targets and their first 4 harmonics | Cheap targeted detection when string is known. |
| M48 | P2 | perf-bundle | WASM streaming instantiation via instantiateStreaming for pitch-core | When web wires WASM, compile-while-download instead of arrayBuffer fetch. |
| M49 | P3 | review | validate/clamp A4 on load |  |
| M50 | P3 | review | gate FFT spectrum when viz hidden |  |
| M51 | P3 | review | reuse YIN difference buffers |  |
| M52 | P3 | native-os | Native mic-permission preflight via Tauri macOS AVCaptureDevice request | Avoids silent failure when OS denies mic. |
| M53 | P3 | algorithms | Gaussian-window interpolation on log-magnitude FFT peaks (Jacobsen/Quinn) | Sub-bin frequency accuracy from existing FFT. |
| M54 | P3 | observability-reliability | Stale-PWA / update-available checker against version.json | Stops users getting stuck on cached old builds. |
| M55 | P3 | perf-bundle | Cap maxTau by selected-string frequency to shorten YIN | When string chosen, narrow lag range, fewer CMNDF iterations. |
| M56 | P3 | review | first-run onboarding + mic priming |  |
| M57 | P3 | review | cache Spectrum gradients |  |
| M58 | P3 | review | collapsible settings sidebar on mobile |  |
| M59 | P3 | review | build script copies WASM to unserved dir |  |
| M60 | P3 | a11y-deep | Colorblind palette presets (deuteran/protan/tritan) replacing red/green coding | Red/green in-tune coding fails ~8% of male users. |
| M61 | P3 | dx-quality | Golden-trace differential runner: flag any fixture moving >1 cent | Regression tripwire for DSP changes. |
| M62 | P3 | a11y-deep | Adjustable in-tune tolerance + detection smoothing as accessibility controls | Lets tremor/motor users widen the target. |
| M63 | P3 | i18n-breadth | Locale-correct A4 decimal parsing accepting comma and period keypads | Prevents broken A4 entry for half the world; trivial fix. |
| M64 | P3 | settings-personalization | Configurable in-tune tolerance band in cents | Slider 1-10 cents controls green-zone width directly. |
| M65 | P3 | perf-bundle | Lazy-load Waveform and Spectrum via defineAsyncComponent | App.vue statically imports both; split each into its own chunk. |
| M66 | P3 | review | spectrogram allocation and full redraw |  |
| M67 | P3 | review | pin toolchain and wasm-pack version |  |
| M68 | P3 | review | custom/editable tuning builder |  |
| M69 | P3 | review | web AudioWorklet detection |  |
| M70 | P3 | review | strengthen TARGET vs detected note hierarchy |  |
| M71 | P3 | review | async device-change restart |  |
| M72 | P3 | review | useSettings single source for tuning/A4 |  |
| M73 | P3 | review | in-tune confirmation cue haptic/sound/flash |  |
| M74 | P3 | review | auto-detected string highlight + spring needle |  |
| M75 | P3 | review | maskable PNG icons 192/512 |  |
| M76 | P3 | algorithms | wasm-SIMD f32x4 vectorization of YIN difference and MPM NSDF inner loops | Headroom to run fusion/multi-window without CPU cost. |
| M77 | P3 | a11y-deep | Cognitive-load Simple Mode: target note + big up/down arrow only | Removes clutter for beginners and cognitive accessibility. |
| M78 | P3 | dx-quality | Synthetic harmonic-stack generator with controllable inharmonicity B-coefficient | Realistic test signals for the whole suite. |
| M79 | P3 | algorithms | Real-cepstrum quefrency cross-check gating the YIN result | Independent octave/voicing sanity check. |
| M80 | P3 | native-os | Power/idle-aware stream suspension on display sleep and app hide | Saves battery when not actively tuning. |
| M81 | P3 | observability-reliability | Audio-pipeline health strip (AudioContext state + buffer underrun counter) | Makes silent audio failures visible and debuggable in the field. |
| M82 | P3 | observability-reliability | Sample-rate / device-mismatch reconciliation warning | Explains a subtle, common cause of detection error. |
| M83 | P3 | settings-personalization | Versioned settings schema with migration runner | Stamp schemaVersion; migrate old keys on load, no data loss. |
| M84 | P3 | perf-bundle | Gate visualizer chunk fetch behind showWaveform/showSpectrum toggles | Only download viz code when user enables that visualizer. |
| M85 | P3 | perf-bundle | Decimate input to fixed 22050Hz before YIN loop | Guitar max 400Hz needs no 44.1k; halves tau-search cost. |
| M86 | P3 | review | header wrap/shrink at 320px |  |
| M87 | P3 | review | bass 4/5-string tunings |  |
| M88 | P3 | review | A4 clamp on commit not keystroke |  |
| M89 | P3 | review | reference-tone playback feedback |  |
| M90 | P3 | review | devicechange listener refresh |  |
| M91 | P3 | review | per-instrument detection frequency range |  |
| M92 | P3 | review | split useTuner god-composable |  |
| M93 | P3 | algorithms | Kalman filter on (log-f0, df0/dt) replacing EMA+median smoother | Predictive smoothing tracks vibrato/glide better than EMA. |
| M94 | P3 | dx-quality | Detection-accuracy report artifact: cents-error histogram per SNR bucket | Objective accuracy tracking across noise levels. |
| M95 | P3 | observability-reliability | Version/build-info panel (git SHA, build date, WASM hash, platform) | Makes bug reports actionable with exact build identity. |
| M96 | P3 | perf-bundle | Brotli + gzip precompress dist with vite-plugin-compression | Static GitHub Pages host can serve .br/.gz for JS/WASM/CSS. |
| M97 | P3 | perf-bundle | Throttle visualizer redraw to 30fps decoupled from detection | Waveform/Spectrum at 30fps saves canvas work, detection stays fast. |
| M98 | P3 | docs-dx | Local seed fixture: bundled reference tone WAVs | Ship per-string sample files for mic-free dev iteration. |
| M99 | P3 | theming-identity | Extract semantic color tokens from hardcoded hex | CSS custom properties layer enabling all theming work in style.css. |
| M100 | P3 | review | redesign StringSelector for narrow column |  |
| M101 | P3 | review | refactor egui App::update god method |  |
| M102 | P3 | review | needle color gradient and directional arrow |  |
| M103 | P3 | a11y-deep | forced-colors mode mapping with SystemColor keywords for canvas needle/spectrum | Windows High Contrast support for canvas elements. |
| M104 | P3 | algorithms | Phase-vocoder instantaneous-frequency refinement of the FFT peak bin | Higher precision than parabolic interpolation. |
| M105 | P3 | distribution | Open Graph + Twitter Card meta with per-tuning dynamic preview image | Better share-link previews for SEO/social. |
| M106 | P3 | observability-reliability | Pseudo-localization CI check flagging hardcoded strings before merge | Stops untranslated strings regressing into releases. |
| M107 | P3 | perf-bundle | Skip getByteFrequencyData when Spectrum component unmounted | Stop analyser frequency reads entirely when spectrum hidden. |
| M108 | P3 | docs-dx | Dev mode synthetic-signal injector toggle | Replace mic with generated f0 for deterministic local UI work. |
| M109 | P3 | review | accessible label for input device select |  |
| M110 | P3 | review | ring buffer for centsHistory |  |
| M111 | P3 | review | tighten 440Hz octave test |  |
| M112 | P3 | review | idle vs no-signal empty states |  |
| M113 | P3 | review | Tauri updater signed feed |  |
| M114 | P3 | algorithms | Inharmonicity-aware f0 fit (B-coefficient stretched-partial model) | Corrects wound-string stretched partials. |
| M115 | P3 | algorithms | pYIN probabilistic candidates + Viterbi HMM pitch track across frames | State-of-art temporal track; heavier to implement. |
| M116 | P3 | a11y-deep | Per-string cents announced as discrete buckets for screen-reader users | Readable SR output instead of rapid numbers. |
| M117 | P3 | i18n-breadth | Translated note-name systems by locale: Do-Re-Mi vs C-D-E | Romance-language users expect solfege; core to feeling native. |
| M118 | P3 | observability-reliability | egui native panic hook writing crash trace to OS app-data dir | Captures native crashes that otherwise vanish. |
| M119 | P3 | i18n-breadth | Translated egui native strings sharing the web app's locale JSON | One translation source covers both clients. |
| M120 | P3 | ui-micro | Press-and-hold +/- A4 stepper auto-repeats with acceleration | Hold accelerates Hz steps; tap nudges single increment. |
| M121 | P3 | perf-bundle | Reuse single Float32Array for RMS and YIN, no copy | Share timeDomainBuffer; avoid second analyser read per frame. |
| M122 | P3 | theming-identity | In-tune color semantics override (green-blind safe sets) | Theme defines in-tune/flat/sharp hues, not hardcoded green/amber. |
| M123 | P3 | review | async load persisted lastTuningId |  |
| M124 | P3 | review | label A4 input |  |
| M125 | P3 | review | label tuning select |  |
| M126 | P3 | review | FFT-accelerate YIN/MPM |  |
| M127 | P3 | dx-quality | DSP scope-recorder: dump per-frame internals to a replayable .ndjson trace | Replay field bugs without the original audio. |
| M128 | P3 | algorithms | Autocorrelation-of-the-spectrum (spectral autocorrelation) f0 estimator | Extra fusion vote robust to missing fundamental. |
| M129 | P3 | native-os | Window-state persistence across launches | Restores size/position; expected desktop polish. |
| M130 | P3 | a11y-deep | egui native: respect OS reduce-motion/high-contrast via accesskit + theme query | Brings native app to accessibility parity. |
| M131 | P3 | observability-reliability | In-app local error-log viewer with copy-to-clipboard | Users can self-serve logs without devtools. |
| M132 | P3 | i18n-breadth | Locale-aware A4 number formatting with Intl.NumberFormat | Displays decimals correctly per locale; pairs with parsing fix. |
| M133 | P3 | ui-micro | Swipe horizontally on tuner panel to cycle tunings | Touch swipe steps prev/next tuning with edge bounce. |
| M134 | P3 | privacy-security | Clear-all-local-data button wiping localStorage IndexedDB caches | One click clears settings, logs, caches, revokes mic stream. |
| M135 | P3 | offline-storage | Cache-version manifest with stale-cache purge on boot | Compare baked CACHE_VERSION, delete old caches.keys() entries at startup. |
| M136 | P3 | docs-dx | CONTRIBUTING.md with WASM build prerequisites | List wasm-pack, Rust toolchain, npm steps before first run. |
| M137 | P3 | theming-identity | High-contrast pro theme for bright-stage readability | Max luminance separation on note-letter, gauge, cents bar. |
| M138 | P3 | review | anti-aliased decimation |  |
| M139 | P3 | review | ukulele/violin/mandolin/banjo tunings |  |
| M140 | P3 | review | announce listening status to SR |  |
| M141 | P3 | review | redesign PerStringCents |  |
| M142 | P3 | review | clean dead code dev security surface |  |
| M143 | P3 | a11y-deep | Sonification mode: continuous oscillator pitch encodes cents error (beat-against-target) | Enables fully non-visual tuning for blind users. |
| M144 | P3 | design-motion | OKLCH cents-deviation hue ramp as the single tuner color signal | Perceptually-uniform color signal for tuning error. |
| M145 | P3 | native-os | Native macOS/Windows app menu with tuning + A4 items and shortcuts | Standard native menu affordances. |
| M146 | P3 | web-apis | Web Locks to serialize AudioContext/mic across duplicate tabs | Stops two tabs fighting over the mic. |
| M147 | P3 | web-apis | OffscreenCanvas + dedicated Worker for the needle/cents meter | Renders meter off the main thread for smoothness. |
| M148 | P3 | i18n-breadth | Ship named language packs (ES, PT-BR, DE, FR, IT, JA, ZH-Hans, KO, HI, AR) | Concrete locale set turns generic i18n into shippable market reach. |
| M149 | P3 | observability-reliability | One-click diagnostic bundle export (env + flags + recent log, no audio) | Turns vague reports into reproducible ones, privacy-safe. |
| M150 | P3 | i18n-breadth | Regional default A4 preset (442/443 EU orchestral) keyed to locale | Matches local tuning conventions out of the box. |
| M151 | P3 | data-viz | Cents bullseye: concentric tolerance rings with live dot | Dot homes into green center ring as pitch nears target. |
| M152 | P3 | ui-micro | Bottom-sheet tuning picker on mobile with snap points | Swipe-up sheet lists tunings, half/full detents. |
| M153 | P3 | ui-micro | A4 number-stepper with scroll-wheel and arrow-key nudge | Focus field, wheel/arrows adjust Hz within clamp range. |
| M154 | P3 | power-user | URL query params preset tuning/A4/string state | ?tuning=dadgad&a4=442&string=3 deep-links exact state |
| M155 | P3 | power-user | Tab/Shift+Tab roving focus across all controls | Logical focus order, visible focus ring everywhere |
| M156 | P3 | privacy-security | Permissions explainer page detailing microphone-only no-upload usage | Static page explaining mic stays on-device, never transmitted. |
| M157 | P3 | perf-bundle | manualChunks split vendor vue from app code | Vue rarely changes; long-cache vendor chunk separate from app. |
| M158 | P3 | perf-bundle | Cache Spectrum bar gradient and bin-x lookup tables | Precompute bar geometry once per resize, not per frame. |
| M159 | P3 | content-marketing | Public changelog page rendered from version.json | Dated release notes build trust and fresh-content signals. |
| M160 | P3 | docs-dx | ADR for pitch-core as single-source DSP crate | Record why YIN+MPM live in shared Rust, not duplicated per target. |
| M161 | P3 | docs-dx | JSDoc on pitch.ts and notes.ts public functions | Document frequencyToNote, cents math signatures and edge cases. |
| M162 | P3 | review | stage mode large high-contrast readout |  |
| M163 | P3 | review | input-device affordance/heading semantics |  |
| M164 | P3 | distribution | Embeddable iframe widget (vite lib mode) + postMessage onInTune/onNote API | Distribution multiplier across third-party sites. |
| M165 | P3 | design-motion | Spring-physics needle driven by a critically-damped spring integrator | Smooth needle motion without overshoot. |
| M166 | P3 | platform-reach | Android app + Play listing via Tauri 2 mobile with Oboe low-latency audio | Biggest install-base expansion; Oboe keeps latency tuner-grade. |
| M167 | P3 | i18n-breadth | Translation-completeness fallback chain with coverage badge | Prevents blank strings and tracks translation progress. |
| M168 | P3 | data-viz | Cents sparkline mini-history under note readout | Tiny 3-second inline trace shows whether pitch is settling. |
| M169 | P3 | ui-micro | Hover popover on string shows target Hz and cents | Desktop tooltip surfaces exact frequency per string. |
| M170 | P3 | ui-micro | Double-tap a string to instantly select as target | Quick gesture pins manual target without dropdown. |
| M171 | P3 | settings-personalization | Units toggle: cents-only vs Hz-and-cents readout | Hide Hz for beginners, show both for techs. |
| M172 | P3 | privacy-security | Tauri capability allowlist audit removing unused command scopes | Minimize Tauri v2 capabilities to mic and storage only. |
| M173 | P3 | perf-bundle | Low-end-device mode: halve FFT_SIZE and viz FPS | Detect deviceMemory/hardwareConcurrency, reduce 2048 buffer and redraw rate. |
| M174 | P3 | content-marketing | FAQ schema JSON-LD on landing page | Rich-result eligibility for "is this tuner accurate" queries. |
| M175 | P3 | docs-dx | Three-target architecture diagram in README | Mermaid graph: pitch-core feeding web, egui, Tauri. |
| M176 | P3 | docs-dx | Visual-regression snapshots per CentsGauge needle angle | Lock pixel output of gauge at -50/0/+50 cents. |
| M177 | P3 | review | prefers-reduced-motion handling |  |
| M178 | P3 | review | capo/transpose + pitch-pipe per-string reference |  |
| M179 | P3 | a11y-deep | Distinct vibration patterns: pulse-train flat, long-buzz sharp, double-tap in-tune | Eyes-free directional feedback; small code, big inclusion. |
| M180 | P3 | design-motion | Modular type scale + 4px spacing tokens with fluid clamp() root | Design-system foundation for consistent layout. |
| M181 | P3 | a11y-deep | RTL layout support with dir=rtl, logical properties, mirrored cents axis | Supports Arabic/Hebrew UI direction. |
| M182 | P3 | platform-reach | iOS/iPadOS app via Tauri 2 mobile reusing native pitch-core | Unlocks App Store distribution and the high-value iOS music market. |
| M183 | P3 | observability-reliability | Structured in-app bug-report template prefilled from local diagnostics | Standardizes incoming issues for faster triage. |
| M184 | P3 | i18n-breadth | Translated tuning-preset display names with locale conventions | Completes the localized feel of the catalog. |
| M185 | P3 | ui-micro | Inline-edit string note via tap-to-spin chromatic picker | Tap string label, scroll wheel to reassign note. |
| M186 | P3 | ui-micro | Toast confirming tuning switch with one-tap undo | Transient toast: 'Drop D' with inline undo button. |
| M187 | P3 | perf-bundle | CI bundle-size budget gate on dist JS/WASM bytes | Fail PR if main chunk or WASM exceeds set kB threshold. |
| M188 | P3 | perf-bundle | OffscreenCanvas spectrum compute off main thread, fallback main | Move FFT-bin drawing to worker, free main for detection. |
| M189 | P3 | docs-dx | Histoire/Storybook stories for the 10 Vue components | Isolated CentsGauge, Waveform, Spectrum states without live mic. |
| M190 | P3 | docs-dx | useTuner composable lifecycle sequence diagram | Document AudioContext start, detection loop, teardown ordering. |
| M191 | P3 | privacy-security | Permissions-Policy header denying camera geolocation USB except microphone | Lock down all browser features except needed microphone. |
| M192 | P4 | review | Fretboard SVG keyboard accessible |  |
| M193 | P4 | review | text alternatives/pressed ARIA on canvases |  |
| M194 | P4 | native-os | Always-on-top frameless mini-overlay with click-through when in-tune | Compact stage/DAW companion; high desktop value. |
| M195 | P4 | analytics | Per-session tuning-stability score (0-100 from post-lock cents RMS) | Headline practice metric users can track over time. |
| M196 | P4 | design-motion | CSS container queries on the tuner panel instead of viewport media queries | Correct responsiveness when embedded at any width. |
| M197 | P4 | native-os | Global hotkey nudge-to-next-string in guided tuning | Hands-light stepping during a guided pass. |
| M198 | P4 | native-os | Tray submenu to switch tuning preset and A4 without opening window | Quick config from the system tray. |
| M199 | P4 | a11y-deep | Captions track: on-screen text for every audio cue | Deaf-accessible labeling of sounds. |
| M200 | P4 | a11y-deep | Screen-magnifier Huge Mode with rem-scaled layout and follow-focus reflow | Low-vision large-layout mode. |
| M201 | P4 | instruments-notation | German note-naming (H/B) and Helmholtz/scientific octave toggle | Regional notation convention support. |
| M202 | P4 | observability-reliability | Opt-in privacy-first crash reporter writing a local JSON trace file | Captures real failures without breaking the zero-network guarantee. |
| M203 | P4 | ai-ml-features | On-device 'What tuning is this?' auto-detect from a single open strum | Signature local-ML feature that differentiates from every basic tuner. |
| M204 | P4 | education-content | Lefty mode mirroring the fretboard and string order | Inclusivity win for left-handed players at low cost. |
| M205 | P4 | observability-reliability | Local feature-flag panel persisted to localStorage / config file | Enables safe staged rollout and field debugging. |
| M206 | P4 | i18n-breadth | Localized PWA manifest name/description/shortcuts per language | Native-feeling install metadata per locale. |
| M207 | P4 | brand-microinteractions | Per-string accent identity: each open string owns a fixed brand hue | Consistent visual language across every view. |
| M208 | P3 | ui-micro | Long-press a string opens reference-tone sustain menu | Hold string to ring sustained pitch, release stops. |
| M209 | P3 | ui-micro | Command palette (Cmd/Ctrl-K) for tunings and settings | Fuzzy-search tunings, A4 presets, modes from one input. |
| M210 | P3 | ui-micro | Drag A4 horizontal slider with magnetic 440 detent | Slider snaps softly at 440 within fine drag range. |
| M211 | P3 | power-user | Spacebar toggles listening start/stop | Single most-used action on most accessible key |
| M212 | P3 | settings-personalization | Per-tuning default A4 override | DADGAD remembers 442, standard stays 440 automatically. |
| M213 | P4 | privacy-security | CSP report-only header then enforce wasm-unsafe-eval default-src self | Stage report-only, collect violations, then enforce strict policy. |
| M214 | P4 | perf-bundle | Frame-time budget guard skipping detection when over 16ms | tick() drops a YIN pass on slow frames to hold 60fps. |
| M215 | P4 | offline-storage | IndexedDB tuning store replacing localStorage for packs | Move custom tunings/packs from localStorage to structured IndexedDB store. |
| M216 | P4 | content-marketing | "Standard tuning notes EADGBE" cornerstone SEO page | Targets the single highest-volume beginner guitar query. |
| M217 | P4 | docs-dx | ADR for Vite base '/tuner/' subpath constraint | Document base-path coupling so contributors stop breaking asset URLs. |
| M218 | P4 | docs-dx | Pull request template with target-checklist | Boxes for web/egui/Tauri tested and tuning-table parity. |
| M219 | P4 | docs-dx | ADR for keeping note math in two languages | Explain Rust-TS duplication tradeoff vs single WASM source. |
| M220 | P4 | theming-identity | OLED true-black theme with pure #000 surfaces | Saves AMOLED power; cards become #000, borders dim gray. |
| M221 | P4 | theming-identity | Animated tuning-fork logo with listening/locked states | Tine vibrates while listening, settles when in tune. |
| M222 | P4 | review | footer contrast |  |
| M223 | P4 | review | subtitle contrast |  |
| M224 | P4 | native-os | Single-instance guard that forwards CLI args to the running window | Prevents duplicate windows/mic contention; foundational desktop UX. |
| M225 | P4 | community-social | Curated static community tuning-pack gallery shipped in /public, offline | Content depth with zero backend; high value for low effort. |
| M226 | P4 | ui-micro | Undo/redo stack for tuning and A4 changes | Ctrl-Z reverts last tuning/A4/string edit; redo forward. |
| M227 | P4 | privacy-security | CI no-third-party-requests test blocking external fetch/connect | Playwright fails build if any non-self network request fires. |
| M228 | P4 | review | light theme toggle |  |
| M229 | P4 | a11y-deep | Voice-control-friendly target names like 'tune string E2' | Reliable Voice Control/Dragon targeting. |
| M230 | P4 | workflows | Oboe-A / tuning-fork reference-listen mode that locks to the heard pitch | Match the ensemble's actual sounded A. |
| M231 | P4 | education-content | Fretboard-note quiz overlaying the existing Fretboard SVG | Reuses shipped SVG to add sticky learning value cheaply. |
| M232 | P4 | settings-personalization | Remember-last-string per tuning | Reopen on the string you last tuned in that tuning. |
| M233 | P4 | offline-storage | Full backup export to single .tunerbackup JSON file | Bundle tunings, A4, settings, stats into one downloadable file. |
| M234 | P4 | theming-identity | Illustrated empty-state art for idle/no-signal | SVG sleeping headstock replaces bare idle text states. |
| M235 | P4 | review | strobe tuner mode |  |
| M236 | P4 | native-os | NSStatusItem live cents micro-meter with colored attributed string in menu bar | Glanceable tuning without window focus on macOS. |
| M237 | P4 | native-os | Follow-OS-theme via window theme events feeding web/egui palette | Auto light/dark matching the OS. |
| M238 | P4 | native-os | Native 'in tune, hold it' notification with throttling | Background confirmation without window focus. |
| M239 | P4 | web-apis | WebGPU strobe/phase visualizer with WebGL2 fallback | GPU strobe disc; ambitious visual flourish. |
| M240 | P4 | a11y-deep | Stereo-pan + pitch-glide sonification encoding sharp/flat direction | Directional audio cue beyond single-tone beat. |
| M241 | P4 | a11y-deep | Dyslexia-friendly font option (OpenDyslexic/Atkinson) with spacing | Readability aid; small toggle. |
| M242 | P4 | analytics | Personal in-tune tolerance auto-calibration | Adapts threshold to the user's steadiness. |
| M243 | P4 | distribution | OBS/Twitch browser-source overlay mode (?overlay=1) transparent compact needle | Streamer overlay reusing one query flag. |
| M244 | P4 | education-content | "Tune for this song" preset library with capo + tuning per track | High user-pull feature that drives repeat use and shareable content. |
| M245 | P4 | brand-microinteractions | Tuning-fork wordmark with the dotted 'i' as a vibrating tine | Establishes a memorable visual identity the brand currently lacks. |
| M246 | P4 | i18n-breadth | Per-language pre-rendered landing pages (/tuner/es/, /tuner/de/) with hreflang | Multiplies organic SEO reach across non-English search markets. |
| M247 | P4 | platform-reach | Linux Flatpak on Flathub with PipeWire/portal mic permission | Primary Linux distribution channel with correct mic permissions. |
| M248 | P4 | observability-reliability | Tuning-pack import/export round-trip self-test in CI | Guarantees bandpack compatibility across versions. |
| M249 | P4 | i18n-breadth | ICU MessageFormat plural/gender handling for count strings | Grammatically correct counts across languages. |
| M250 | P4 | monetization | Ko-fi / Buy Me a Coffee one-tap tip jar | Frictionless small-tip path; complements Sponsors. |
| M251 | P4 | bowed-strings | Baroque vs modern A4 quick-toggle 415/430/440 | One-tap historical pitch standards instead of slider hunting. |
| M252 | P4 | data-viz | Cents waterfall: scrolling per-frame deviation history band | Vertical scroll of cents-colored rows shows pluck decay drift. |
| M253 | P4 | ui-micro | Right-click string context menu: set reference, mute, edit | Desktop context menu per string row with actions. |
| M254 | P4 | ui-micro | Long-press A4 value resets to 440 with confirm | Hold value, ripple confirms snap back to standard. |
| M255 | P4 | ui-micro | Keyboard string navigation with up/down and Enter select | Arrow through strings, Enter sets manual target. |
| M256 | P4 | power-user | Number-key direct string selection 1-6 | Press digit to target that string immediately |
| M257 | P4 | power-user | Scriptable JSON config import/export file | Declarative file defines hotkeys, tunings, defaults |
| M258 | P4 | settings-personalization | Quarantine unknown keys on import, never silently drop | Preserve forward-compat keys from newer app versions. |
| M259 | P4 | privacy-security | Subresource Integrity hashes on WASM and JS bundles | Vite plugin emits SRI digests; tamper-proof /tuner/ asset loads. |
| M260 | P4 | perf-bundle | Inline critical CSS, defer rest to cut first paint | Extract above-fold tuner styles, async-load remainder. |
| M261 | P4 | perf-bundle | requestIdleCallback-defer settings/practice code past mic start | Tuner core mounts first; defer TunerControls heavy logic. |
| M262 | P4 | offline-storage | Deferred beforeinstallprompt with contextual re-surface timing | Stash event, show install CTA after second successful tune. |
| M263 | P4 | content-marketing | Per-tuning explainer article set: Drop D, DADGAD, Open G | One deep page per tuning with notes, songs, history. |
| M264 | P4 | content-marketing | Tuning frequency reference table page (Hz per string) | Snippet-bait table for 82.41Hz E2 etc. queries. |
| M265 | P4 | content-marketing | Reddit r/Guitar launch + AMA-style demo thread | Privacy/offline angle resonates with that community. |
| M266 | P4 | docs-dx | Issue template for new tuning-preset submissions | Structured form: strings, frequencies, source citation. |
| M267 | P4 | docs-dx | l10n contributor guide for adding string keys | Document l10n.ts structure and RU/EN key parity rules. |
| M268 | P4 | review | surface color tokens remove unused palette |  |
| M269 | P4 | review | viz start/stop transitions |  |
| M270 | P4 | distribution | Chrome/Firefox MV3 toolbar extension opening WASM tuner in 360px popup | New surface reusing existing pitch-core build. |
| M271 | P4 | analytics | Per-string accuracy heatmap across the 6 string targets | Cheap visualization surfacing weak strings. |
| M272 | P4 | native-os | Global push-to-tune hotkey that summons overlay only while held | On-demand overlay for live performance. |
| M273 | P4 | web-apis | navigator.storage.persist() + estimate() to mark packs non-evictable, warn on low quota | Protects saved tunings from eviction. |
| M274 | P4 | community-social | User-submitted tuning presets via GitHub PR with JSON schema + CI validation | Crowdsources the catalog safely; classic OSS growth loop. |
| M275 | P4 | brand-microinteractions | Swappable needle skins: Strobe Disc, Analog VU, Laser Line, Vintage Plate | Personalization driver and a natural Pro-tier upsell candidate. |
| M276 | P4 | platform-reach | Windows Store MSIX package with packaged-app mic capability | Clean Windows install and store discovery with proper capabilities. |
| M277 | P4 | education-content | Genre/artist-themed tuning collections as grouped catalog sections | Improves discoverability of the existing tuning catalog. |
| M278 | P4 | i18n-breadth | Arabic RTL needle/cents with mirrored layout but LTR pitch axis | Correct bidi handling so the meter stays physically meaningful. |
| M279 | P4 | monetization | GitHub Sponsors tier ladder with in-app 'Sponsor' footer link | Low-effort recurring support channel for an OSS project. |
| M280 | P4 | brand-microinteractions | Idle 'breathing' needle animation when no signal is present | Signals the app is alive and listening; cheap polish. |
| M281 | P4 | live-deep | Single-string isolation: lock detection to one target | Ignore other strings when tech tunes one string fast. |
| M282 | P4 | ui-micro | Segmented control for detection mode guitar/chromatic/strobe | Sliding pill toggle replaces dropdown for modes. |
| M283 | P4 | settings-personalization | Export full config as downloadable tuner.json | Serialize all keys including custom tunings to one file. |
| M284 | P4 | privacy-security | Cross-Origin-Isolation COOP COEP headers for hardened context | Enable crossOriginIsolated, gate future SharedArrayBuffer DSP safely. |
| M285 | P4 | content-marketing | Comparison page: Tuner vs GuitarTuna/Fender Tune | Privacy/offline/free angle captures branded comparison search. |
| M286 | P4 | docs-dx | Design-token reference page from Tailwind config | Auto-render color/spacing tokens used across components. |
| M287 | P4 | theming-identity | Gauge face skins: arc, linear bar, half-circle dial | Pluggable CentsGauge rendering bound to one theme choice. |
| M288 | P4 | analytics | Blind-tuning self-test (hide cents, score the guess) | Ear-training metric distinct from games already shipped. |
| M289 | P4 | native-os | tuner:// protocol handler opening a specific tuning + A4 preset | Deep-launch into a configured state from links. |
| M290 | P4 | web-apis | Web MIDI input tuning mode: cents deviation of MIDI note-on vs A4 | Tune from a connected keyboard/controller. |
| M291 | P4 | brand-microinteractions | Signature in-tune chime voiced from the current tuning's open strings | Audio branding moment that reinforces success feedback. |
| M292 | P4 | i18n-breadth | Locale-correct font stack for CJK/Arabic/Devanagari with subset fonts | Without this the language packs render as tofu; gating dependency. |
| M293 | P4 | brand-microinteractions | User color-theme creator: 2-color seed generates the full dark palette | Strong personalization but needs a robust palette-generation engine. |
| M294 | P4 | platform-reach | macOS App Store (MAS) sandboxed distribution channel | Sandboxed channel that pairs with paid IAP on macOS. |
| M295 | P4 | community-social | In-app 'Suggest a tuning' button prefilling a GitHub issue/PR body | Lowers the contribution barrier for the PR-based catalog. |
| M296 | P4 | brand-microinteractions | In-tune celebration micro-burst: subtle particle bloom on lock | Delightful reward moment reinforcing success. |
| M297 | P4 | bowed-strings | Cello C-string low-end detection range extension | Reliable f0 down to bass C1 32.7 Hz. |
| M298 | P4 | ui-micro | Inline toast queue stacking with auto-dismiss timers | Multiple notifications stack, oldest expires first. |
| M299 | P4 | power-user | Quick-switch tuning palette (Ctrl+K command bar) | Fuzzy-search overlay to jump to any tuning instantly |
| M300 | P4 | power-user | Hold-to-sound reference tone while key down | Momentary tone playback released on keyup |
| M301 | P4 | settings-personalization | Import config JSON with validation and diff preview | Validate against schema, show what changes before applying. |
| M302 | P4 | settings-personalization | Advanced vs Simple settings disclosure split | Hide gate/tolerance/range behind an Advanced toggle. |
| M303 | P4 | content-marketing | Glossary pages: cents, A4, harmonics, intonation | Long-tail definitional pages internally linking to tuner. |
| M304 | P4 | content-marketing | "Best A4 reference: 440 vs 432 vs 442" debate article | Controversial topic drives shares and backlinks. |
| M305 | P4 | notifications-engagement | New-feature announcement modal keyed to version.json | Show once per build SHA; dismiss persists in localStorage. |
| M306 | P4 | review | TuningSelector redundant label |  |
| M307 | P4 | review | metronome tap-tempo accent |  |
| M308 | P4 | distribution | GitHub Action auto-generating animated demo GIF via headless Chromium + synthetic audio | Keeps README/store demo fresh automatically. |
| M309 | P4 | workflows | Pre-take tuning gate with pass/fail threshold for the engineer | Blocks recording until in-tune; high studio value, low effort. |
| M310 | P4 | analytics | Time-to-in-tune metric per string and per session | Quantifies tuning speed improvement over time. |
| M311 | P4 | web-apis | File System Access .tunerpack save/open with persistent FileSystemFileHandle | Edit-in-place tuning packs on the web. |
| M312 | P4 | analytics | First-attempt overshoot detector (sharp/flat bias profile) | Reveals systematic tuning bias. |
| M313 | P4 | pro-audio-ecosystem | VST3 + AU bundle via nih-plug reusing pitch-core unchanged | Largest reach multiplier for the existing engine into producer workflows. |
| M314 | P4 | education-content | Scale-practice mode detecting each played degree against a chosen scale | Extends the detector into practice tooling without new DSP. |
| M315 | P4 | education-content | Chord-library cross-reference keyed to the current tuning | Very useful for alt tunings; large content and correctness burden. |
| M316 | P4 | platform-reach | ChromeOS-optimized installable PWA with tablet/clamshell mic handling | Captures the large education Chromebook base cheaply. |
| M317 | P4 | education-content | Open-string note-name recognition trainer (E-A-D-G-B-e flashcards) | Cheap beginner drill that reinforces fundamentals. |
| M318 | P4 | community-social | Localized community-translations credit page + i18n CONTRIBUTING guide | Motivates and structures translator contributions. |
| M319 | P4 | bowed-strings | Bowed-string preset bank GDAE/CGDA/CGDA-bass tunings | Violin, viola, cello, 4/5-string bass standard fifths sets. |
| M320 | P4 | live-deep | Loud-stage noise-aware confidence floor | Adapt gating thresholds for ambient stage roar between songs. |
| M321 | P4 | data-viz | Beat-frequency envelope meter vs reference tone | Pulsing amplitude bar; beat rate slows to zero at unison. |
| M322 | P4 | ui-micro | Drag-reorder strings to reverse for left-handed display | Vertical drag handle reorders string list, persists. |
| M323 | P4 | power-user | Keyboard cheat-sheet overlay bound to '?' | Modal listing all active shortcuts contextually |
| M324 | P4 | settings-personalization | Named setting presets (Studio, Live, Practice) | Save full settings snapshot under a name, switch instantly. |
| M325 | P4 | settings-personalization | Reset-to-defaults scoped per settings section | Reset only visualizers or only detection, not everything. |
| M326 | P4 | settings-personalization | Cloud-free settings sync via shareable text blob | Base64 paste-string moves config between browser and native. |
| M327 | P4 | privacy-security | Dependency pinning by integrity hash plus lockfile-lint gate | lockfile-lint enforces https resolved URLs and integrity present. |
| M328 | P4 | offline-storage | Versioned IndexedDB schema with onupgradeneeded migration ladder | Sequential migration functions per schema version, idempotent and tested. |
| M329 | P4 | content-marketing | "Why does my guitar go out of tune" troubleshooting article | High-intent maintenance query with strong app CTA. |
| M330 | P4 | content-marketing | YouTube short: 30-second offline-tuner demo | Visual proof of accuracy for social distribution. |
| M331 | P4 | content-marketing | breadcrumb + Article schema on all explainer pages | Structured data lifts SERP presentation site-wide. |
| M332 | P4 | docs-dx | commitlint config rejecting type: prefixes | Enforce the repo's no-conventional-prefix subject convention in CI. |
| M333 | P4 | theming-identity | Vintage analog-meter skin with cream face and amber lamp | Skeuomorphic needle, ticks, glow for the gauge component. |
| M334 | P4 | review | normalize corner radii |  |
| M335 | P4 | workflows | Setlist-bound multi-guitar profiles with one-tap silent-stage switch | Targets gigging players changing tunings between songs. |
| M336 | P4 | workflows | Studio tuning log: timestamped take/tuning entries per session | Engineer-facing record of tuning at each take. |
| M337 | P4 | analytics | Drift-after-tuning timeline per string (settle curve overlay) | Shows new-string settle behavior visually. |
| M338 | P4 | web-apis | Media Session now-playing surface for active tuning with prev/next-string actions | Lock-screen/headset string stepping. |
| M339 | P4 | web-apis | SpeechRecognition voice commands: 'next string','low E','play A','stop' | Fully hands-free web operation. |
| M340 | P4 | education-content | "Your first 4 chords" guided lesson path using the detector | Onboards absolute beginners; content-heavy to do well. |
| M341 | P4 | hardware-peripherals | Guitar-with-USB direct-input device profile with auto channel selection | Smooths setup for USB-equipped guitars and interfaces. |
| M342 | P4 | community-social | Contributor wall generated at build time from git history (Credits page) | Recognition fuels OSS contribution; fully automated. |
| M343 | P4 | ai-ml-features | Ship on-device models as versioned WASM/ONNX with cache + integrity check | Infra prerequisite for any shipped local-ML feature. |
| M344 | P4 | bowed-strings | Per-string fifths-check mode for violin/viola/cello/bass | Tune adjacent strings as pure 3:2 fifths, beat-rate readout. |
| M345 | P4 | live-deep | Drop-tune delta: cents-to-detune for low string | Show how far to slacken E to D for next song. |
| M346 | P4 | data-viz | Lissajous phase figure: mic signal vs reference sine | Rotating ellipse freezes still when string matches reference frequency. |
| M347 | P4 | ui-micro | Two-finger swipe-down dismisses settings sidebar mobile | Gesture closes panel matching native sheet feel. |
| M348 | P4 | power-user | egui native global keymap mirroring web bindings | Shared keymap JSON consumed by egui input handler |
| M349 | P4 | settings-personalization | Settings dirty-state and discard-changes guard | Warn before nav if unsaved manual edits exist. |
| M350 | P4 | settings-personalization | Default-startup-view setting (tuner/ear-trainer) | Choose which mode opens on launch. |
| M351 | P4 | offline-storage | storage.persisted() request gated on engagement signal | Request persistent storage after user saves first custom tuning. |
| M352 | P4 | content-marketing | Tutorial series: tune by ear without a tuner | 5th-fret method article funnels to app as backup. |
| M353 | P4 | content-marketing | "Drop D vs Drop C vs Drop B" comparison cluster | Metal-genre tuning cluster captures niche long-tail. |
| M354 | P4 | theming-identity | Custom accent picker from a color wheel | Replace fixed #22c55e green across buttons, gauge, strings. |
| M355 | P4 | theming-identity | Curated built-in theme gallery picker in settings | Thumbnail grid of bundled themes with live preview swatch. |
| M356 | P4 | notifications-engagement | Notification permission soft-ask after first session | Explain value before triggering OS permission prompt. |
| M357 | P4 | distribution | App Store / Play Store listing asset kit generator from a single template | Automates icon/screenshots/ASO copy for store launch. |
| M358 | P4 | native-os | File association for .gtuning custom-tuning files with open-with import | Double-click import of shared tunings. |
| M359 | P4 | workflows | Session export of tuning log to CSV for studio/teacher records | Portable records from the log. |
| M360 | P4 | community-social | Exportable .bandpack: signed bundle of tunings + A4 + per-string references | Solves real band-coordination pain and seeds a sharing format. |
| M361 | P4 | platform-reach | Android Quick Settings tile + iOS Control Center/Lock Screen launcher | One-tap access drives habitual use on mobile. |
| M362 | P4 | hardware-peripherals | Clip-on contact piezo input profile with vibration-pickup auto-detect | Better noisy-stage tuning for the common clip-on use case. |
| M363 | P4 | education-content | Interval ear-training between two played strings | Useful musicianship feature reusing detection; not a game per se. |
| M364 | P4 | education-content | Note-on-staff reader linking each open string to standard notation | Connects tuning to notation literacy for learners. |
| M365 | P4 | ai-ml-features | Local capo/partial-capo detector from open-string set vs chosen tuning | Auto-transposes targets; reuses existing detection output. |
| M366 | P4 | bowed-strings | Double-bass fourths tuning EADG preset | Orchestral bass tunes in fourths, not fifths; distinct table. |
| M367 | P4 | bowed-strings | Bow-noise tolerant gating for sustained bowed tone | Stable readout despite scratchy attack and bow changes. |
| M368 | P4 | kids-gamify | Kids mode toggle: oversized 56px+ string buttons | Big touch targets, fewer controls, hides advanced panels |
| M369 | P4 | data-viz | Polar pitch wheel with 12 semitone spokes | Detected note as rotating arm; cents push off-spoke radially. |
| M370 | P4 | data-viz | Pitch trajectory comet: fading trail of recent f0 | Comet tail shows attack glide direction toward target line. |
| M371 | P4 | power-user | Focus mode hiding all chrome (key 'f') | Hide header/footer/sidebar, show only needle |
| M372 | P4 | power-user | Hotkey to cycle reference-tone through all strings | Bracket keys step pitch-pipe up/down strings |
| M373 | P4 | settings-personalization | Per-string custom in-tune tolerance overrides | Tighter band on high E, looser on low E. |
| M374 | P4 | privacy-security | Static asset hash manifest verified against version.json at load | Runtime checks served bundle hashes match signed manifest. |
| M375 | P4 | offline-storage | Backup schema-version field with forward-compat import guard | Reject or migrate older/newer .tunerbackup versions with clear message. |
| M376 | P4 | content-marketing | Press/media kit page: logo, screenshots, copy blurbs | Lowers friction for bloggers and reviewers to feature. |
| M377 | P4 | content-marketing | Song-to-tuning index page (capo + tuning per song) | Curated static map of popular songs to their tunings. |
| M378 | P4 | theming-identity | Live theme preview before applying in picker | Hover a theme tile to temporarily recolor the tuner. |
| M379 | P4 | notifications-engagement | Tauri tray scheduled daily practice reminder | Native OS notification at user-set hour via tauri-plugin-notification. |
| M380 | P4 | business-ops-deep | Canary channel toggle pulling versioned WASM from /tuner/canary/ | Opt-in users get prerelease builds before stable promotion. |
| M381 | P4 | instruments-notation | Per-tuning notation-system binding so world presets auto-select naming scheme | Right notation appears automatically with preset. |
| M382 | P4 | workflows | Capo-aware shared key for the band: announce capo + sounding key | Aligns capoed players on a key. |
| M383 | P4 | analytics | Practice streak + calendar heatmap (GitHub-style) | Habit motivation via streak grid. |
| M384 | P4 | pro-audio-ecosystem | CLAP-format tuner plugin sharing pitch-core as DSP backend | Modern open plugin format; pairs naturally with the VST3/AU build. |
| M385 | P4 | hardware-peripherals | USB-HID footswitch mapping for hands-free next-string stepping | High value for live performers; modest native-app effort. |
| M386 | P4 | ai-ml-features | Auto-tab a short monophonic riff into ASCII tablature, fully on-device | Standout local feature, but scope and accuracy risk are large. |
| M387 | P4 | education-content | Printable tuning + chord-chart practice sheet PDF generator | Tangible takeaway for teachers and students. |
| M388 | P4 | ai-ml-features | On-device practice-session auto-summary from the local drift timeline | Gives end-of-session value from already-logged data. |
| M389 | P4 | monetization | Affiliate gear links: contextual string/capo/pickup recommendations | Passive revenue tied to relevant moments; keep tasteful. |
| M390 | P4 | bowed-strings | Fine-tuner vs peg guidance by cents magnitude | Coarse error says peg, small error says fine-tuner. |
| M391 | P4 | plucked-world | Course-aware Tuning model for paired-string instruments | Add course grouping so bouzouki/laud/mandola octave pairs map correctly. |
| M392 | P4 | wind-brass | Long-tone intonation-hold scoring with drift graph | Score steadiness over a sustained note, plot cents over seconds. |
| M393 | P4 | live-deep | Stage-blackout one-hand mode: giant edge tap zones | Full-screen left/right halves advance string, no precise targets. |
| M394 | P4 | data-viz | Six-string radial gauge cluster, hexagon arrangement | All EADGBE mini needles at once for whole-guitar glance. |
| M395 | P4 | data-viz | Confidence ribbon overlaid on cents trace | Trace thickness or opacity encodes detection confidence per frame. |
| M396 | P4 | ui-micro | Radial long-press menu around string: tone, edit, octave | Hold spawns arc of actions under finger. |
| M397 | P4 | settings-personalization | Per-device input profiles keyed by deviceId label | Auto-load A4/tolerance/gate when a known mic reconnects. |
| M398 | P4 | privacy-security | CycloneDX SBOM generation for npm and Cargo dependencies | Emit signed SBOM artifact per release for npm and crates. |
| M399 | P4 | perf-bundle | Subset Tailwind font stack, drop unused system-ui fallbacks | No custom font loaded; trim CSS and preconnect nothing. |
| M400 | P4 | offline-storage | Backup restore with dry-run diff preview | Show added/changed/removed entries before committing restore. |
| M401 | P4 | integrations-music | Read tuning from imported Guitar Pro .gp/.gpx file | Parse .gp track header, auto-select matching 6-string tuning. |
| M402 | P4 | content-marketing | "How to tune a 12-string guitar" long-form guide | Octave-pair tuning is a high-intent unanswered query. |
| M403 | P4 | content-marketing | Embeddable "Tuned with" badge for guitar blogs | Backlink-generating HTML snippet pointing to /tuner/. |
| M404 | P4 | content-marketing | Social share-card SVG templates per tuning result | Brandable images for Reddit/forum tuning posts. |
| M405 | P4 | docs-dx | iframe widget embed API reference page | Document postMessage events, allowed attributes, sizing contract. |
| M406 | P4 | docs-dx | Copy-paste iframe embed snippet generator page | Interactive form emitting ready iframe HTML for sites. |
| M407 | P4 | theming-identity | Sepia warm low-blue-light reading variant | Amber-tinted surfaces for late-night practice eye comfort. |
| M408 | P4 | business-ops-deep | Donation thermometer SVG fed by static goals.json | Server-maintained JSON renders raised-vs-goal bar, no tracking. |
| M409 | P4 | workflows | Concert-A broadcast: one device sets reference pitch for the whole ensemble | Solves real orchestra/band reference-pitch coordination. |
| M410 | P4 | workflows | Teacher push-a-target mode: instructor sets note, student screen mirrors | Remote-lesson tuning sync; strong teaching hook. |
| M411 | P4 | web-apis | Gamepad API foot-controller stepping to advance strings/toggle reference hands-free | Hands-free control for performers. |
| M412 | P4 | workflows | Luthier string-change log with brand/gauge and settle-in tracking | Records string history for setup work. |
| M413 | P4 | pro-audio-ecosystem | AUv3 app-extension inside a thin iOS host wrapper | Lets iOS DAW users tune inline; depends on the iOS build landing first. |
| M414 | P4 | community-social | Local family/band profiles (avatar + name) in IndexedDB, header-switchable | Personalizes multi-user devices without any account system. |
| M415 | P4 | ai-ml-features | Smart string-change reminder from accumulated post-tuning drift trend | Turns drift history into a useful maintenance nudge. |
| M416 | P4 | ai-ml-features | On-device model-card + provenance page (no phone-home guarantee) | Builds trust for local-ML features; reinforces privacy brand. |
| M417 | P4 | wind-brass | Difference-tone / beat-rate visualizer against reference drone | Show beating against sustained reference for unison wind tuning. |
| M418 | P4 | vocal-training | Sustained-note steadiness meter (cents standard deviation) | Live wobble gauge from rolling f0 variance during one held note. |
| M419 | P4 | kids-gamify | Reward chime built from the open-string chord | Reuse sine engine to play a happy arpeggio on success |
| M420 | P4 | data-viz | Harmonic stack ladder: partial deviations vs ideal integers | Visualizes string inharmonicity as drift up the overtone ladder. |
| M421 | P4 | power-user | Command palette recent/favorites ordering | Surface last-used tunings first in Ctrl+K list |
| M422 | P4 | settings-personalization | Settings JSON schema doc generated from TS types | Single source describes every key for import validators. |
| M423 | P4 | privacy-security | CI fail on disallowed WASM imports outside known namespace | wasm-objdump asserts only env/webaudio imports, no surprise host calls. |
| M424 | P4 | perf-bundle | Merge favicon.svg + icons.svg into one symbol sprite | Two SVGs (14KB) become one cached <use> sprite request. |
| M425 | P4 | theming-identity | Per-instrument auto-theme keyed to selected tuning | Acoustic warm-wood vs metal cold-steel palette per preset. |
| M426 | P4 | theming-identity | Themeable needle/pointer SVG asset packs | CentsGauge pointer loads from skin set: blade, dial, dot. |
| M427 | P4 | theming-identity | Theme import/export as single shareable JSON file | Tokens serialized to .gtheme for swap without a server. |
| M428 | P4 | theming-identity | Per-string accent ramp themeable as a gradient set | Six string hues derive from one editable base ramp. |
| M429 | P4 | notifications-engagement | egui native reminder via notify-rust desktop toast | Standalone egui app schedules its own OS notification. |
| M430 | P4 | business-ops-deep | In-app roadmap voting via GitHub Discussions reactions embed | Read-only fetch of reaction counts, vote opens GitHub. |
| M431 | P4 | business-ops-deep | Help-desk widget linking to canned offline troubleshooting answers | Bundled FAQ, deep-links to email with diagnostics prefilled. |
| M432 | P4 | data-viz | Chromagram: 12-bin pitch-class energy bar ring | Folds spectrum into pitch classes; confirms fundamental over harmonics. |
| M433 | P4 | data-viz | Cents histogram building live during a hold | Bars accumulate; symmetric narrow peak means stable in-tune hold. |
| M434 | P4 | privacy-security | egui native config file written with 0600 restrictive permissions | Chmod app-data tuning config so other users cannot read. |
| M435 | P4 | integrations-music | Drop-link bar: paste any tab URL, extract tuning | Unified parser dispatching to Songsterr/UG/GP by host. |
| M436 | P4 | instruments-notation | Sargam note-naming (Sa Re Ga Ma Pa Dha Ni) with movable Sa | Core Indian-classical notation; unlocks that audience. |
| M437 | P4 | hardware-peripherals | Serial/JSON local control protocol as the integration contract for peripherals | Foundation enabling every footswitch/LED/Stream Deck peripheral cleanly. |
| M438 | P4 | hardware-peripherals | Elgato Stream Deck plugin: tuning-select, A4-nudge, live cents on keys | Reaches the streamer/creator niche; depends on the control protocol. |
| M439 | P4 | hardware-peripherals | USB MIDI-controller knob/pad mapping (input only) for tuning and A4 | Reuses MIDI-input infra for hands-free hardware control. |
| M440 | P4 | bowed-strings | Natural-harmonic target mode (5th/4th nodes) | Tune by lightly-touched harmonics, expected pitch shown. |
| M441 | P4 | studio-deep | Per-string offset profile saved as session tuning preset | Snapshot exact measured cents per string, recall next day. |
| M442 | P4 | live-deep | Silent between-song mode: vibrate-only, screen dimmed | No audio reference, haptic-only confirmation for quiet tuning. |
| M443 | P4 | kids-gamify | Tuney the tuning-fork mascot reacts to cents error | SVG sprite wobbles flat/sharp, smiles when string lands in tune |
| M444 | P4 | data-viz | Session timeline scrubber over recorded tuning attempt | Drag playhead across a stored cents-vs-time curve per string. |
| M445 | P4 | settings-personalization | Settings search/filter box | Type to jump to any control across all sections. |
| M446 | P4 | settings-personalization | Settings change-history with undo stack | Step back through recent setting edits this session. |
| M447 | P4 | settings-personalization | Preset auto-apply rule by connected device | Bind a named preset to fire when a mic appears. |
| M448 | P4 | privacy-security | security.txt at well-known with contact and PGP | Publish /tuner/.well-known/security.txt for vulnerability disclosure. |
| M449 | P4 | offline-storage | Storage-usage meter UI in settings sidebar | navigator.storage.estimate() usage/quota bar with per-category breakdown. |
| M450 | P4 | offline-storage | Quota-pressure handler degrading non-essential caches first | On QuotaExceededError evict spectrogram caches before tuning data. |
| M451 | P4 | integrations-productivity | Apple Calendar practice reminder via generated .ics download | Export VEVENT with VALARM for next practice session. |
| M452 | P4 | integrations-music | Songsterr paste-link tuning extractor | Paste Songsterr URL, fetch track tuning JSON, apply preset. |
| M453 | P4 | content-marketing | Email newsletter: monthly tuning tip + changelog | Re-engagement channel; static signup, no backend needed. |
| M454 | P4 | theming-identity | Swappable icon-set variants outline/filled/duotone | Mic, settings, play icons share one selectable style family. |
| M455 | P4 | notifications-engagement | Quiet-hours window suppressing all reminders | User-defined start/end; clamp scheduled times outside band. |
| M456 | P4 | notifications-engagement | Do-not-disturb master toggle pausing all nudges | One switch silences reminders for a chosen duration. |
| M457 | P4 | notifications-engagement | Tauri autostart with minimized tray for reminders | Launch-on-login so scheduled toasts fire without app open. |
| M458 | P4 | business-ops-deep | Privacy-preserving local aggregate metrics with k-anonymity batching | Opt-in counters flushed only above threshold, no IDs. |
| M459 | P4 | business-ops-deep | Self-hosted Plausible-style aggregate dashboard, IP-truncated, opt-in | First-party analytics with no cookies or persistent IDs. |
| M460 | P4 | bowed-strings | Equal-tempered vs pure-fifths deviation display | Show both ET target and beatless-fifth target cents. |
| M461 | P4 | kids-gamify | Daily challenge: tune all six before timer ends | One seeded challenge per local date, completion badge |
| M462 | P4 | kids-gamify | Confetti bloom and mascot cheer on six-string completion | CSS particle burst when all strings tuned in session |
| M463 | P4 | kids-gamify | Star rating per string: 1-3 stars by tuning precision | Tighter cents window earns more stars, drives replay |
| M464 | P4 | privacy-security | Privacy regression snapshot of localStorage keys in CI | Golden test fails if new persisted key appears unreviewed. |
| M465 | P4 | offline-storage | Eviction warning when persisted-storage permission denied | Banner noting data may be cleared under disk pressure. |
| M466 | P4 | integrations-music | Ultimate-Guitar tab URL capo/tuning sniffer | Read UG page tuning+capo line, suggest matching tuner setup. |
| M467 | P4 | instruments-notation | Oud course tuning presets (Arabic, Turkish, Iraqi) with 5-6 double courses | Opens a large underserved Middle-Eastern player base. |
| M468 | P4 | instruments-notation | Maqam quarter-tone target set (24-TET / koma) with named jins | Microtonal targets for Arabic/Turkish music. |
| M469 | P4 | instruments-notation | Harp / autoharp full-range chromatic per-string tuning sequencer | Sequenced many-string tuning workflow. |
| M470 | P4 | instruments-notation | Hammered/mountain dulcimer and bouzouki/charango course tunings | Folk course-instrument presets, low effort. |
| M471 | P4 | monetization | Paid Pro feature bundle definition and pricing page | The 'what is Pro' anchor every monetization idea depends on; define first. |
| M472 | P4 | monetization | Desktop app on Microsoft Store / Mac App Store with paid Pro IAP | Native store discovery plus a sanctioned IAP monetization channel. |
| M473 | P4 | pro-audio-ecosystem | ARA2 plugin placing per-note tuning markers along the DAW timeline | Deep DAW integration for editors; significant host-specific work. |
| M474 | P4 | hardware-peripherals | Generic USB gamepad/foot-pedal stepping via gilrs (native) | Cheap hands-free stepping reusing a standard input library. |
| M475 | P4 | pro-audio-ecosystem | Detected-pitch envelope export as Reaper/Audacity automation/label track | Bridges detection output into editor workflows. |
| M476 | P4 | pro-audio-ecosystem | Cross-format installer (VST3/AU/CLAP/AAX) with signed packages + manifest | Makes plugin distribution trustworthy and versioned. |
| M477 | P4 | community-social | Invite-a-bandmate onboarding pack: shareable .bandpack + printable one-pager | Drives word-of-mouth growth among bandmates. |
| M478 | P4 | monetization | Bundle on-device intelligence as opt-in 'Pro Listening' tier | Connects the ML features to a future revenue line. |
| M479 | P4 | brand-microinteractions | Seasonal accent themes auto-applied by date with manual override | Periodic freshness that invites users to return. |
| M480 | P4 | bowed-strings | Scordatura preset library per piece | Bach G-minor, Mahler, Saint-Saens Danse Macabre A-Eb. |
| M481 | P4 | keyed-free-reed | Piano 88-key sectioned tuning map A0-C8 | Visual keyboard split into bass/temperament/treble tuning sections |
| M482 | P4 | live-deep | Tuner-out passthrough: mute audio while detecting | Emulate pedalboard tuner-out by gating output during tune. |
| M483 | P4 | live-deep | Pre-show checklist: all strings green before set | Confirm every open string in tune before walking onstage. |
| M484 | P4 | live-deep | Hold-to-tune latch pins display while glancing away | Freeze last reading so tech reads after string stops. |
| M485 | P4 | kids-gamify | XP awarded per string within cents tolerance | Faster, steadier tuning grants more XP; shown as bar |
| M486 | P4 | kids-gamify | Tuning streak counter with streak-freeze token | Consecutive days tracked; earned token skips one missed day |
| M487 | P4 | kids-gamify | Color-by-string game: match strummed string to its hue | Detect played string, child taps matching colored pad |
| M488 | P4 | data-viz | Pitch constellation scatter: cents vs amplitude points | Each frame a dot; cluster tightness signals tuning stability. |
| M489 | P4 | power-user | Fully remappable hotkey editor in settings | Per-action key capture stored in localStorage, conflict detection |
| M490 | P4 | privacy-security | local CSP violation collector logging to in-app panel | report-to endpoint writes violations locally, no external reporting URI. |
| M491 | P4 | privacy-security | Threat-model doc STRIDE for mic audio and storage | Document trust boundaries, attack surface, mitigations in repo. |
| M492 | P4 | offline-storage | Last-write-wins conflict resolution with timestamp tiebreak | Per-pack updatedAt compares local vs synced, prompt on tie. |
| M493 | P4 | offline-storage | Offline pack availability badge per gallery entry | Mark which community packs are cached and usable offline. |
| M494 | P4 | theming-identity | Wallpaper-extracted palette via desktop accent (Tauri) | Native pulls OS accent color to seed app theme. |
| M495 | P4 | theming-identity | Texture/material backdrop layer brushed-metal or felt | Optional subtle tiled SVG behind cards per theme. |
| M496 | P4 | notifications-engagement | Streak-at-risk nudge before midnight local time | Fire only if today's session count is zero near cutoff. |
| M497 | P4 | notifications-engagement | Weekly recap notification: strings tuned, accuracy delta | Sunday summary pulled from local IndexedDB session stats. |
| M498 | P4 | notifications-engagement | Re-engagement nudge after N days lapsed | Single gentle ping after 7-day inactivity, then escalating cooldown. |
| M499 | P4 | notifications-engagement | Per-channel opt-in: OS push vs in-app inbox | Independent toggles per notification type and delivery surface. |
| M500 | P4 | notifications-engagement | In-app notification inbox with unread badge | Persistent local list of past nudges, recaps, announcements. |

</details>
<!-- TOP500_ARCHITECTURE:END -->

## Current Top Problems (Synchronized)

The synchronized problem map is split by purpose:
- [TOP-500-backlog.md](TOP-500-backlog.md) - full ranked Top 500 (`M#`).
- [TOP-200-current.md](TOP-200-current.md) - latest grounded code audit, 187 findings (`C#`).
- [recommendation.md](recommendation.md) - stable current extract, 183 plan-cited items (`R#`).

Key highlights that directly block the target architecture:
- Broken/silent audio paths: egui random-string output stream is dropped; web AudioContext can stay suspended (`C1-C7`).
- Missing session/audio-port/frame contracts outside the web readout path (`R2`, `R3`, `R9`; `C47`, `C53`).
- God objects and oversized coupling surfaces (`R1`, `R4-R8`; `C28`, `C31`, `C62`).
- Duplication of domain, pitch, tuning registry and smoothing logic (`R12`, `R14-R18`; `C32-C37`, `C57`, `C60-C61`).
- Realtime safety problems in egui and Tauri native audio (`C8`, `C10-C17`, `C182-C183`; `M1`, `M2`, `M6`).
- Weak parity, fake-mic, WASM, test and CI coverage (`C3`, `C24`, `C33`, `C37`, `C45`, `C56`, `C180`, `C184`).

When closing any of these open problems, update [recommendation.md](recommendation.md), [TOP-200-current.md](TOP-200-current.md), [TOP-500-backlog.md](TOP-500-backlog.md) if rank/status changes, this file, [README.md](README.md), and if the execution order changes, [PLAN.md](PLAN.md) / [RECOMMENDATIONS.md](RECOMMENDATIONS.md).

Recommended reading order:
1. [TOP-200-current.md](TOP-200-current.md) for exact current code evidence.
2. [TOP-500-backlog.md](TOP-500-backlog.md) for the full ranked Top 500.
3. [recommendation.md](recommendation.md) for stable `R#` references.
4. This file for the target layered design.
5. [PLAN.md](PLAN.md) for execution order.
