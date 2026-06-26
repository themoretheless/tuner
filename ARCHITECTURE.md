# Guitar Tuner - Architecture & Deep Refactoring Plan

**Date:** 2026-06  
**Perspective:** Designing from scratch with heavy focus on **modularity**, **code decomposition**, and **loose coupling**.

## Current State Assessment (Honest Critique)

The project has evolved through many iterations (Vue web, Tauri, pure egui native, shared Rust pitch-core via WASM).

Strengths:
- Good move to shared `pitch-core` for YIN/MPM + spectrum.
- TunerEngine exists as a step toward better separation.
- Multiple platforms (web + egui + Tauri) working.

Weaknesses (high coupling, low modularity):
- `web/src/composables/useTuner.ts` is a god object: audio input, device management, pitch state, smoothing, reference tones, history, UI state, persistence sync, URL state — everything in one file (~550 lines).
- Visualizers (`Spectrum.vue`, `Waveform.vue`, etc.) are tightly coupled to Web Audio `AnalyserNode`. They call `getByteFrequencyData` directly.
- `pitch-core/src/lib.rs` is a single huge file mixing domain types, DSP algorithms, engine, smoothing, and WASM bindings.
- `egui/src/main.rs` still has god-like `App` + inline painter code for viz + audio manager logic.
- No clear boundaries: audio I/O, DSP, domain math, session state, and presentation are mixed.
- Hard to test in isolation, hard to add new inputs (file, MIDI), new outputs, or new viz.
- Duplication and cfg hell between native and web paths.

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

### Phase 0 — Foundations (low risk, high impact)
- Define `DetectionFrame`, `SpectrumFrame` etc. as the single source of truth (in tuner-types or domain).
- Gate visualizers behind `isListening` in App.vue (fix "big black boxes").
- Extract magic numbers into config structs.

### Phase 1 — Strengthen the Core (highest value)
- Split `pitch-core`:
  - `src/domain.rs`
  - `src/dsp.rs` (or mod dsp)
  - `src/engine.rs`
  - `src/lib.rs` only re-exports + wasm bindings
- Introduce `trait PitchDetector`.
- Improve WASM exports to a higher-level API.

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
- Change all visualizer props from `analyser: AnalyserNode` to data props.

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

All prior raw idea material from TOP-500-backlog.md and IDEAS-round4-500.md has been reviewed and **влито** (integrated) here. The separate files now serve as historical source-of-truth dumps. This section is the canonical living view.

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

(Full raw ranked table lives in TOP-500-backlog.md for reference.)

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
41. Finish strict layering: domain (no_std), dsp (pure), engine, audio-traits, types.
42. Introduce `trait PitchDetector { fn detect(&[f32], sr: f32) -> Option<Detection>; }`.
43. Extract `AudioInput` trait + WebAudioInput / CpalAudioInput / MockAudioInput.
44. Extract `ToneGenerator` trait; unify reference + ear-training tone behind it.
45. Make all visualizers accept only plain data (DetectionFrame, SpectrumFrame, WaveformFrame); delete AnalyserNode from props.
46. Split useTuner.ts into: useAudioInput, useTunerSession, useReferenceTone, useVizData.
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
- TOP-500-backlog.md и IDEAS-round4-500.md — исторические сырые источники.
- Высокоприоритетные пункты из них **влиты** наверх этого раздела.
- 200 детализированных предложений — actionable слой поверх них.
- Всегда проверяем: уменьшает ли изменение зацепленность между audio / dsp / state / presentation?

Любая новая работа должна отвечать: "Does this make future high-value backlog items easier to implement cleanly?"
