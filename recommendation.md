# Recommendations & Open Problems Backlog

**Current state audit (synced 2026-06-30)**

This is the canonical **current open-problems extract** for the worktree. It keeps the stable `R#` references used by [PLAN.md](PLAN.md). The full ranked **Top 500** lives in [TOP-500-backlog.md](TOP-500-backlog.md). The latest direct code audit lives in [TOP-200-current.md](TOP-200-current.md) and contains **187 grounded findings**.

The condensed list below still contains **183 unresolved `R#` items** after removing issues that were already fixed or no longer true. Do not renumber these lightly: execution docs cite them. When turning the audit into GitHub issues, prefer adding issue links/status instead of changing existing `R#` identifiers.

Audit basis: direct inspection of `web/src/composables/useTuner.ts`, `useVisualizationFrames.ts`, `useTuningState.ts`, `useSettings.ts`, `pitch-core/src/lib.rs`, `egui/src/main.rs`, `desktop/src-tauri/src/native_audio.rs`, the Vue visualizers, build scripts, CI workflows, and the newer grounded findings in [TOP-200-current.md](TOP-200-current.md).

Synced documents:
- [ARCHITECTURE.md](ARCHITECTURE.md) describes the target architecture and links back here.
- [README.md](README.md) summarizes the same debt for users and contributors.
- [PLAN.md](PLAN.md) is the execution-order source of truth.
- [RECOMMENDATIONS.md](RECOMMENDATIONS.md) turns the same debt into detailed refactor recommendations.
- [TOP-500-backlog.md](TOP-500-backlog.md) is the master ranked Top 500 (`M#`).
- [TOP-200-current.md](TOP-200-current.md) is the latest grounded current audit (`C#`).

Priority key: **P0** correctness / realtime safety / blocking architecture, **P1** high-impact coupling or duplication, **P2** quality / DX / product risk, **P3** cleanup.

Notation used across docs:
- `R#` - stable recommendation item from this file.
- `C#` - detailed current-audit item from [TOP-200-current.md](TOP-200-current.md).
- `M#` - ranked master Top-500 item from [TOP-500-backlog.md](TOP-500-backlog.md).

## Open Problems (183 stable R-items)

### Architecture & Coupling
1. **P0: `useTuner.ts` is still a composition god-object.** It is no longer 500 lines, but it still wires settings, web audio, native audio, pitch loop, tuning state, reference tone, ear training, metronome, practice history, display modes and a huge return object.
   **Recommendation:** Turn it into a thin composition root and move lifecycle/workflow logic into controllers.

2. **P0: No `TunerSessionController` / explicit session state machine.** Start, stop, backend switching, native fallback and range updates are still plain functions and watchers.
   **Recommendation:** Add `idle | starting | listening | stopping | error` state and make start/stop/restart serialized.

3. **P0: No clean audio port abstraction.** Web audio, Tauri native audio and egui cpal paths expose different concepts and are selected with ad hoc conditionals.
   **Recommendation:** Introduce `AudioInputPort` and `ToneGenerator` ports, with web, Tauri, egui and mock adapters.

4. **P0: `pitch-core/src/lib.rs` remains monolithic.** Domain was partially extracted, but engine, YIN, MPM, smoothing, spectrum, power-chord detection, WASM exports and tests still share one large file.
   **Recommendation:** Split into `domain`, `dsp/yin`, `dsp/mpm`, `engine`, `spectrum`, `smoothing`, `wasm`.

5. **P0: `egui/src/main.rs` is still a god file.** `App::update` handles repaint policy, input, painting, history mutation, device UI, stream toggles and reference tone wiring.
   **Recommendation:** Extract widgets/painters/managers, then make egui consume the same session/data contracts as web.

6. **P1: `useTuningState.ts` is a second god-object.** It combines instrument registry selection, chromatic mode, temperament math, custom tuning CRUD, export/import, profile handling and display helpers.
   **Recommendation:** Split pure music/domain functions from workflow controllers and UI view models.

7. **P1: `useSettings.ts` is a global mutable settings singleton.** It owns persistence, schema normalization, refs, watches and save throttling in one module.
   **Recommendation:** Add a versioned profile schema and storage ports, then make settings a loaded config value.

8. **P1: `App.vue` is an overloaded feature shell.** It imports almost every panel and wires tuner, settings, practice, metronome, custom tunings, temperaments and display controls on one screen.
   **Recommendation:** Split into feature screens/slices: tuner, library, practice, settings.

9. **P1: No single `DetectionFrame` / `TunerFrame` contract.** Web, Tauri native and egui all move different partial data shapes around.
    **Recommendation:** Define canonical frame types and use them across all consumers.

10. **P1: Engine internals leak into UI shape.** The UI still receives raw frequencies, selected strings, backend flags and many refs as one broad API.
    **Recommendation:** Return small view-model slices and commands for each feature.

11. **P1: Persistence, URL/app state and live session state are tangled.** Settings are watched and saved while live audio and tuning selection mutate.
    **Recommendation:** Separate persisted profile, transient session and derived presentation state.

12. **P1: Tauri native audio bypasses `pitch-core`.** `desktop/src-tauri/src/native_audio.rs` has its own YIN detector and level normalization instead of using shared core/engine.
    **Recommendation:** Reuse `pitch-core` or a shared detector module from Tauri native audio.

13. **P1: `TunerEngine` is not just an engine boundary.** It owns smoothing, FFT planner, buffers, note formatting strings and spectrum production regardless of consumer needs.
    **Recommendation:** Split detector/analyzer/smoother and let session request only needed outputs.

### Duplication & Drift
14. **P0: Tuning and instrument truth is duplicated.** `web/src/utils/notes.ts` has a rich registry with ids, instruments, temperaments and custom features; `pitch-core/src/domain.rs` has a smaller independent list.
    **Recommendation:** Use one registry source or add parity/codegen tests that fail on drift.

15. **P0: Note math and cents logic exist in both TS and Rust.** `frequency_to_note`, `get_cents`, closest string selection and display formatting can diverge silently.
    **Recommendation:** Add numeric equivalence tests and converge on one source of truth.

16. **P1: Pitch detection exists in too many places.** Web TS (`utils/pitch.ts` + worker), pitch-core Rust and Tauri native Rust all implement overlapping YIN/range/level behavior.
    **Recommendation:** Make `pitch-core` the detector implementation and keep TS/Tauri as adapters.

17. **P1: Smoothing and confidence behavior are duplicated.** TS `FrequencySmoother`, Rust `Smoother`, native frame confidence and UI smoothing do not share a spec.
    **Recommendation:** Define one smoothing/filtering contract and test it with fixtures.

18. **P1: Power-chord and harmonic heuristics are not unified.** Core, web and UI paths can disagree on power-chord indication.
    **Recommendation:** Return power/harmonic flags from shared core with stable tests.

19. **P1: Spectrum/waveform drawing code is duplicated across Vue and egui.** Both platforms reinvent data scaling, history limits, colors and harmonic markers.
    **Recommendation:** Share data transforms and keep painters platform-specific but dumb.

20. **P2: Magic constants are scattered.** Buffer sizes, YIN threshold, RMS gates, history lengths, tolerance cents, gains and sample-rate assumptions live in many files.
    **Recommendation:** Move them into typed config structs/constants with docs.

21. **P2: Storage keys and profile shape are not centralized.** localStorage, Tauri Store and egui storage use unrelated flat keys.
    **Recommendation:** Add `UserProfileV1` and migrations.

22. **P2: Error handling language and shape differ per platform.** Web returns user-facing strings, Tauri emits strings, egui prints `eprintln!`.
    **Recommendation:** Introduce typed error categories and platform-specific presentation.

### Performance & Realtime Safety
23. **P0: egui cpal callback locks and allocates.** It locks the engine/state, drains/grows Vecs and calls `request_repaint` from the audio callback path.
    **Recommendation:** Move DSP off the realtime callback using a ring buffer/channel and process on a non-realtime thread.

24. **P0: Tauri native cpal callback also does heavy work.** It extends/drains buffers, locks range, allocates YIN arrays and emits Tauri events from the input callback.
    **Recommendation:** Keep callback minimal: push samples into a bounded queue and process elsewhere.

25. **P0: `detect_pitch_yin_internal` allocates `diff` and `yin` on every call.** This is expensive in a hot path and contradicts the preallocation goal.
    **Recommendation:** Store YIN buffers in detector state and reuse them.

26. **P1: `TunerEngine::process` always computes spectrum and allocates `Vec<f32>`.** Even consumers that only need pitch pay FFT/spectrum cost.
    **Recommendation:** Make analyzer outputs optional and preallocate spectrum output.

27. **P1: Web pitch loop still depends on `requestAnimationFrame`.** Detection cadence is throttled to ~33ms, but the loop itself is a paint loop and copies buffers to a worker.
    **Recommendation:** Use AudioWorklet or a dedicated audio worker-style pipeline independent of paint.

28. **P1: Canvas resize happens inside every draw.** `resizeCanvas()` is called on each frame in the visualizers.
    **Recommendation:** Use `ResizeObserver` and resize only when dimensions/DPR change.

29. **P2: egui requests repaint unconditionally.** `ctx.request_repaint()` runs every update even when idle.
    **Recommendation:** Repaint on audio frames, animations or user input; sleep when idle.

30. **P2: Native egui input path only builds an `f32` input stream.** It does not handle all cpal sample formats like the Tauri native path does.
    **Recommendation:** Add typed sample-format handling or reuse the Tauri/native audio service code.

### Testing & Verification
31. **P0: No Rust/TS equivalence harness.** The project can drift between `notes.ts`, `pitch.ts`, `domain.rs`, `pitch-core`, Tauri native and egui without CI catching it.
    **Recommendation:** Add shared fixtures and assert frequency/note/cents parity.

32. **P0: No fake-mic E2E test.** There is no Playwright flow that feeds synthetic audio and asserts the UI detects the expected note.
    **Recommendation:** Add mocked `getUserMedia` / fake WAV pipeline tests.

33. **P1: Core tests are still narrow.** Vitest now covers useful synthetic notes, noisy sine, silence and range normalization, but not inharmonicity, invalid imports, composables, fake mic, session behavior or backend switching.
    **Recommendation:** Expand fixtures and split test suites by domain/pitch/settings/profile.

34. **P1: No benchmarks for hot DSP paths.** YIN/MPM/spectrum costs are not measured.
    **Recommendation:** Add `criterion` benches for representative buffer sizes and notes.

35. **P1: No property tests for note math.** Round-trip behavior across A4, transpose, capo and temperaments is not fuzzed.
    **Recommendation:** Add proptest/quickcheck and TS-side generated cases.

36. **P2: No visual regression tests for main states.** Gauge, stage/compact mode, colorblind mode and canvas states are not screenshot-tested.
    **Recommendation:** Add Playwright screenshots for idle/listening/in-tune/error states.

37. **P2: Build CI does not prove offline/privacy claims.** PWA/offline/local-only claims are not backed by a zero-network or cache test.
    **Recommendation:** Add CI checks for network fetches and built asset cacheability.

38. **P2: No long-running stability test.** There is no soak test for memory growth, stream restart, worker failure or repeated start/stop.
    **Recommendation:** Add scripted stability tests around lifecycle and audio mocks.

### Product, UX, Build & Documentation
39. **P1: Web PWA is manifest-only.** README says PWA, but there is no full Service Worker/offline cache strategy.
    **Recommendation:** Implement real offline PWA or document it honestly as install metadata only.

40. **P1: Full profile import/export is missing.** Custom tuning transfer exists, but user instruments, temperaments, settings, metronome and practice history do not have one versioned backup.
    **Recommendation:** Add profile schema, migrations and full roundtrip tests.

41. **P1: Accessibility is incomplete.** Some live readout is improved, but canvases, color-only states, keyboard flow, focus rings and screen-reader text are not systematically verified.
    **Recommendation:** Add an accessibility checklist and test stage/compact/colorblind modes.

42. **P2: WASM packaging is ad hoc.** `build:wasm` can try to install `wasm-pack` during the build and writes into `web/public/wasm`.
    **Recommendation:** Pin tool versions and make WASM artifacts reproducible/versioned.

43. **P2: Release hardening is incomplete.** Code-signing, notarization, CSP, checksums and audit gates are listed as plans rather than enforced release steps.
    **Recommendation:** Add release gates incrementally.

44. **P2: Observability is weak.** There is no health strip for WASM status, audio backend status, device failure, clipping, hum or DC bias.
    **Recommendation:** Add a "Test my mic" / diagnostics panel.

45. **P0: The architecture plan is only partially executed.** Domain extraction and composable splits started, but the key boundaries (ports, frames, session, shared registry, realtime-safe audio) are not in place.
    **Recommendation:** Treat [ARCHITECTURE.md](ARCHITECTURE.md) as the target spec, [PLAN.md](PLAN.md) as the ordered execution plan, and [RECOMMENDATIONS.md](RECOMMENDATIONS.md) as detailed implementation guidance.

### More Architecture & Coupling Issues

46. TunerEngine recomputes full spectrum on every process call regardless of whether any consumer needs it.
47. egui State struct mixes raw detection data with UI history (cents_history is pushed in App update).
48. No clear "Session" concept separating live detection from persistent settings.
49. useTuner returns a giant object with 30+ properties; consumers couple to too many details.
50. pitch-core still re-exports low level detect_pitch_yin_internal etc.; public surface is messy.
51. AudioManager in egui owns streams but no clear ownership transfer to engine.
52. VizManager in egui is a partial extraction but still lives inside the App impl.
53. Web and native have completely different strategies for feeding audio into the core (analyser vs cpal vs feed_audio_samples).
54. No inversion of control for "how pitch is detected" (hardcoded YIN+MPM fusion inside process).
55. Settings (a4, tuning) are mutated directly on engine and also kept in Vue refs without single source.
56. Components like StringSelector receive large computed lists instead of minimal props.
57. CentsHistory component receives raw array and does its own rendering logic duplicating gauge logic.
58. No event or callback abstraction for "new detection frame available".
59. Lock .clone() of entire State on every egui frame is inefficient and couples UI to internal repr.
60. WASM static OnceLock for WEB_ENGINE creates global mutable singleton anti-pattern.
61. Different handling of "no string selected" vs "chromatic" between web and egui.
62. Reference tone logic lives in useTuner instead of a dedicated composable/service.
63. No clean way to inject a mock detector for testing or file-based input.
64. The "edit current tuning" UI in egui mutates the tunings vec in place and assumes engine will see it.
65. Domain Note and Tuning use &'static str but web uses owned strings – friction when extending.
66. No separation between "raw pitch estimate" and "tuned to selected string cents".
67. useSettings and useTuner both manage a4 and lastTuningId with manual sync.
68. Spectrogram history is a VecDeque of Vec in egui with manual size management duplicated from cents_history.
69. Canvas components still duplicate resize and rendering plumbing instead of using a shared VizCanvas helper.
70. pitch-core public API mixes f32 buffers with no lifetime or ownership docs.
71. Native cpal stream callback directly mutates engine through lock without clear producer/consumer.
72. No "TunerConfig" value type passed around; a4 and tuning are set via methods scattered.
73. App.vue imports and uses many things from the single useTuner return value.
74. No ports/adapters for different input sources (mic, file, test tone generator).

### Performance & Efficiency Issues
75. Every egui update pushes to cents_history and spectrogram_history unconditionally.
76. Spectrum bars in egui are drawn with per-frame math and allocations inside the paint closure.
77. Web tick function runs full detection + smoothing + history + volume calc at display refresh rate.
78. DownsampleForPitch often returns the original buffer (no-op fallback) wasting work.
79. Histogram drawing in CentsHistory likely redraws full history every frame.
80. In egui waveform painting, every sample becomes a circle_filled call (very slow for 2048 samples).
81. Spectrogram uses 80 freq bins hard limit and redraws all history every time.
82. No idle/sleep when not listening – egui always requests repaint.
83. SharedAudio in web is created lazily but never suspended properly when tab hidden for long.
84. YIN difference function allocates inside the hot loop in native impl (from internal code structure).
85. Multiple BiquadFilter and Gain nodes created on every reference tone play.
86. No frame dropping or priority for viz when CPU is high.
87. Buffer of 2048 is always used even for higher strings where smaller window would suffice.
88. History arrays grow/shift without ring buffer (O(n) cost on shift).
89. In Spectrum.vue log scale bin selection recomputes every draw.
90. Waveform.vue allocates new path implicitly every frame with beginPath + many lineTo.
91. No memoization or caching of target note calculations when tuning doesn't change.
92. egui spectrum takes first 200 bins regardless of actual useful range.
93. WASM calls from JS have overhead on every raf tick; no batching.
94. Preallocated buffers in web are only for timeDomain; spectrum and others allocate.
95. cpal stream config is queried every device change without caching.
96. No use of requestIdleCallback for non-critical history updates.
97. In tests synthetic sine generation uses full loop without SIMD.
98. Vue reactivity on large arrays (centsHistory) causes unnecessary component updates.
99. No WebGL or offscreen canvas for heavy spectrogram.
100. Reference tone lowpass is recreated every play instead of reused node.
101. Device list refresh is synchronous and can block UI.
102. Lack of any performance marks or profiling hooks in hot paths.

### Duplication & Code Smells
103. Canvas resize + DPR code is nearly identical in Spectrum, Waveform, Spectrogram, CentsHistory.
104. Oscillator + Gain + Biquad creation code duplicated in playReferenceTone and playTone.
105. Two almost identical smoothing classes in TS (FrequencySmoother and WasmSmoother wrapper).
106. Spectrum drawing loop in egui duplicated in concept with web Spectrum.vue (log vs linear).
107. Note name arrays duplicated (Rust NOTE_NAMES, TS NOTE_NAMES).
108. Tuning list initialization logic similar in TS and Rust but not identical.
109. History limit 300 is hardcoded in multiple places (web cents, egui viz).
110. Error handling for audio start is different in web vs native (string message vs eprintln).
111. Cleanup logic scattered: stop(), cleanup(), onUnmounted, toggle paths.
112. "In tune" tolerance and hysteresis logic in web; similar but not same "in tune" color in egui.
113. Device selection UI code in egui and web TunerControls are parallel implementations.
114. Random string selection uses Math.random in web, SystemTime nanos in egui.
115. Lowpass freq 1600 and gains are magic in web but not centralized.
116. Several places do "if listening then show viz" but the condition is repeated in template and logic.
117. Buffer slicing in native cpal feed and wasm feed both hardcode 2048.
118. Frequency formatting functions duplicated (formatFreq in TS, inline in egui).
119. getNoteDisplay logic in web; similar display in egui labels.
120. Multiple places clamp cents manually ( /50.0 * w etc).
121. Power chord detection has native and wasm wrappers that may differ slightly.
122. Storage keys in egui save() are strings without constants.
123. Tick function in useTuner does detection, smoothing, rms, power, history, raf – god method.
124. In pitch-core many _impl and pub fn pairs for wasm vs native (boilerplate).
125. Vue computed for stringsWithCents, targetNote etc. recompute similar math.
126. Drawing colors are duplicated magic strings across canvas files (#11151b etc).
127. onUnmounted and stop() both try to clean some of the same things.
128. URL parsing and persisted load have similar "try find tuning" code.
129. Two places define "strings" selection (1-6 keys in web, combo in egui).
130. Sample rate preference duplicated in web constraints and consts.
131. Several "if (!x) return" guards that could be early returns or optionals.
132. Comments like "// for spectrum" and "// for waveform" indicate lack of structure.

### Error Handling, Robustness & Edge Cases
133. Many .unwrap() on locks and device queries will panic on real errors.
134. WASM load failure leaves the app in broken state with only error message.
135. No handling for AudioContext being closed by browser (low power mode etc).
136. Device removal while listening not handled gracefully in native.
137. No recovery if cpal stream errors after start.
138. getUserMedia rejection only sets error string; no retry UI.
139. Frequency 0 or NaN from detector not always sanitized before UI.
140. Visibility change resume can fail silently.
141. Osc.stop() in try/catch but no state if it was already stopped.
142. No handling for sample rate mismatch between requested and actual (web micSettings).
143. Buffer length < 2048 in feed_audio_samples just returns without detection.
144. No protection against concurrent start/stop calls.
145. In egui, if engine lock fails, detection is silently skipped in some places.
146. Power chord flag can flicker without hysteresis like the in-tune state.
147. DC offset detection test exists but no runtime DC bias removal.
148. Microphone constraints don't specify echoCancellation etc in all code paths consistently.
149. No timeout or watchdog for stuck raf loop or detection.

### Testing, Quality & CI Gaps
150. Tests only cover basic sine waves; no real guitar recordings or inharmonicity cases.
151. No test that web WASM and native produce same cents within tolerance for same buffer.
152. No test for A4 != 440 behavior across the stack.
153. No fuzzing of extreme frequencies (20Hz, 2000Hz+).
154. Build doesn't run pitch-core tests in the web WASM target.
155. No visual regression tests for the gauge or canvas output.
156. Lacking tests for the new chromatic mode and tolerance settings.
157. No test for the settings migration or schema (none exists yet).
158. No property test that find_closest_string + get_cents is consistent with target.
159. Tests use approx but tolerance is loose (2.0 Hz).
160. No load test or long-running stability test for the smoother.
161. Missing test for power chord on real multi-string input.
162. No test that UI doesn't crash when detector returns None for long time.
163. Documentation examples in code are missing for core functions.
164. No contract test between the exported WASM functions and TS callers.
165. Edge case of empty tuning list is handled poorly in tests and code.
166. No snapshot of TunerUpdate shape for regression.
167. Lack of mutation testing or any advanced quality metric.
168. Manual icons and build steps are error-prone and not tested.

### Web / Vue / Frontend Specific
169. Viz components still duplicate resize and draw boilerplate.
170. Large number of refs in useTuner cause many reactivity triggers.
171. No virtual list or optimization for long centsHistory render.
172. Fretboard component exists but may not be integrated well (from imports).
173. i18n store is simple but strings for errors and hints are still mixed.
174. Keyboard shortcuts are global without proper focus management.
175. Tailwind + custom CSS mix without clear design tokens.
176. Vite base path for /tuner/ must be maintained manually for Pages.
177. PWA manifest is present but no offline caching strategy implemented.
178. No proper handling for mic permission prompt UI states beyond pending flag.
179. LocalStorage via useSettings has no versioning or corruption handling.
180. Many .value accesses in templates can be optimized.
181. No tree-shaking verification for the large pitch wasm bundle.
182. Dev server port is pinned for Tauri – brittle for other devs.
183. No source maps or proper error boundaries in production web build.

## How to Use This List
- **Execution order is in [PLAN.md](PLAN.md)** - milestones cite these item numbers (`R#`) and sequence them with dependencies and a definition of done. Start there rather than fixing items ad hoc.
- For the full requested Top 500, use [TOP-500-backlog.md](TOP-500-backlog.md). For the latest grounded code evidence, use [TOP-200-current.md](TOP-200-current.md).
- Pick the highest impact items first: 1-5, 12, 14-16, 23-27, 31-32 and 45.
- Every fix should reduce coupling.
- Update this file, [TOP-200-current.md](TOP-200-current.md), [TOP-500-backlog.md](TOP-500-backlog.md) if ranking/status changes, [ARCHITECTURE.md](ARCHITECTURE.md), [README.md](README.md), [PLAN.md](PLAN.md) and relevant action steps in [RECOMMENDATIONS.md](RECOMMENDATIONS.md) when an item is resolved.
- Turn items into GitHub issues with links back here.

**Next audit:** after significant layer work or in 2-3 months.

## Fixes Applied (Small but Real)
- Added the first M0 safety-gate slice: `.nvmrc`, `rust-toolchain.toml`, Vitest-based `npm test` fixtures for TS pitch/note utilities, CI gates for `pitch-core` fmt/clippy/tests/wasm feature check, and cleaned `pitch-core` so `clippy -D warnings` passes.
- Fixed inconsistent sample rate (44100 hardcoded in egui spectrum harmonics vs 48000 in feed). Introduced PREFERRED_SAMPLE_RATE const and updated calculations.
- Documented the double-toggle mic restart hack in device change (egui) as a known smell.
- Fixed minor frequency rounding inconsistency in domain.rs default note (82.41 -> 82.4069 to match other sources).
- Decoupled web visualizers from `AnalyserNode` by routing waveform/spectrum/spectrogram renderers through plain visualization frames.
These fixes were removed from the numbered backlog above so the list tracks only open work.

## Summary
- This file contains 183 stable unresolved `R#` problems used by the plan.
- The latest grounded audit contains 187 detailed `C#` findings in [TOP-200-current.md](TOP-200-current.md).
- The requested full Top 500 lives in [TOP-500-backlog.md](TOP-500-backlog.md).
- Many items are direct violations of the architecture vision.
- A number are low-hanging: hardcoded values, duplicate canvas plumbing, missing constants, stale README/docs.
- Highest impact remains: god objects, missing session/audio-port contracts, duplicated domain/pitch logic, realtime safety, and missing parity tests.

Update this file when fixing. Link from issues.
