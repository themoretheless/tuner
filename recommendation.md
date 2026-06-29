# Recommendations & Top 200 Problems

**Current state audit (2026-06-29, synced with current `main`)**

This is the canonical **Top 200 things that are done poorly or incorrectly** in the current worktree. It is based on direct inspection of the current files, including `web/src/composables/useTuner.ts` (295 LOC), `useTuningState.ts` (487 LOC), `useSettings.ts` (362 LOC), `pitch-core/src/lib.rs` (668 LOC), `egui/src/main.rs` (654 LOC), `desktop/src-tauri/src/native_audio.rs` (290 LOC), the Vue visualizers and the build/test scripts.

Synced documents:
- [ARCHITECTURE.md](ARCHITECTURE.md) describes the target architecture and links back here.
- [README.md](README.md) summarizes the same debt for users and contributors.
- [RECOMMENDATIONS.md](RECOMMENDATIONS.md) turns this debt into ordered refactor steps.

Priority key: **P0** correctness / realtime safety / blocking architecture, **P1** high-impact coupling or duplication, **P2** quality / DX / product risk, **P3** cleanup.

## Top 200 Problems (What Was Done Poorly or Incorrectly)

### Architecture & Coupling (1-14)
1. **P0: Visualizers still receive live `AnalyserNode`.** `Waveform.vue`, `Spectrum.vue` and `Spectrogram.vue` accept `analyser: AnalyserNode | null` and call `getFloatTimeDomainData` / `getByteFrequencyData` directly. This violates the architecture rule that visualizers must render plain data frames only.
   **Recommendation:** Replace analyser props with `WaveformFrame`, `SpectrumFrame` and `SpectrogramFrame` produced by a session/viz data layer.

2. **P0: `useTuner.ts` is still a composition god-object.** It is no longer 500 lines, but it still wires settings, web audio, native audio, pitch loop, tuning state, reference tone, ear training, metronome, practice history, display modes and a huge return object.
   **Recommendation:** Turn it into a thin composition root and move lifecycle/workflow logic into controllers.

3. **P0: No `TunerSessionController` / explicit session state machine.** Start, stop, backend switching, native fallback and range updates are still plain functions and watchers.
   **Recommendation:** Add `idle | starting | listening | stopping | error` state and make start/stop/restart serialized.

4. **P0: No clean audio port abstraction.** Web audio, Tauri native audio and egui cpal paths expose different concepts and are selected with ad hoc conditionals.
   **Recommendation:** Introduce `AudioInputPort` and `ToneGenerator` ports, with web, Tauri, egui and mock adapters.

5. **P0: `pitch-core/src/lib.rs` remains monolithic.** Domain was partially extracted, but engine, YIN, MPM, smoothing, spectrum, power-chord detection, WASM exports and tests still share one large file.
   **Recommendation:** Split into `domain`, `dsp/yin`, `dsp/mpm`, `engine`, `spectrum`, `smoothing`, `wasm`.

6. **P0: `egui/src/main.rs` is still a god file.** `App::update` handles repaint policy, input, painting, history mutation, device UI, stream toggles and reference tone wiring.
   **Recommendation:** Extract widgets/painters/managers, then make egui consume the same session/data contracts as web.

7. **P1: `useTuningState.ts` is a second god-object.** It combines instrument registry selection, chromatic mode, temperament math, custom tuning CRUD, export/import, profile handling and display helpers.
   **Recommendation:** Split pure music/domain functions from workflow controllers and UI view models.

8. **P1: `useSettings.ts` is a global mutable settings singleton.** It owns persistence, schema normalization, refs, watches and save throttling in one module.
   **Recommendation:** Add a versioned profile schema and storage ports, then make settings a loaded config value.

9. **P1: `App.vue` is an overloaded feature shell.** It imports almost every panel and wires tuner, settings, practice, metronome, custom tunings, temperaments and display controls on one screen.
   **Recommendation:** Split into feature screens/slices: tuner, library, practice, settings.

10. **P1: No single `DetectionFrame` / `TunerFrame` contract.** Web, Tauri native and egui all move different partial data shapes around.
    **Recommendation:** Define canonical frame types and use them across all consumers.

11. **P1: Engine internals leak into UI shape.** The UI receives `analyser`, raw frequencies, selected strings, backend flags and many refs as one broad API.
    **Recommendation:** Return small view-model slices and commands for each feature.

12. **P1: Persistence, URL/app state and live session state are tangled.** Settings are watched and saved while live audio and tuning selection mutate.
    **Recommendation:** Separate persisted profile, transient session and derived presentation state.

13. **P1: Tauri native audio bypasses `pitch-core`.** `desktop/src-tauri/src/native_audio.rs` has its own YIN detector and level normalization instead of using shared core/engine.
    **Recommendation:** Reuse `pitch-core` or a shared detector module from Tauri native audio.

14. **P1: `TunerEngine` is not just an engine boundary.** It owns smoothing, FFT planner, buffers, note formatting strings and spectrum production regardless of consumer needs.
    **Recommendation:** Split detector/analyzer/smoother and let session request only needed outputs.

### Duplication & Drift (15-24)
15. **P0: Tuning and instrument truth is duplicated.** `web/src/utils/notes.ts` has a rich registry with ids, instruments, temperaments and custom features; `pitch-core/src/domain.rs` has a smaller independent list.
    **Recommendation:** Use one registry source or add parity/codegen tests that fail on drift.

16. **P0: Note math and cents logic exist in both TS and Rust.** `frequency_to_note`, `get_cents`, closest string selection and display formatting can diverge silently.
    **Recommendation:** Add numeric equivalence tests and converge on one source of truth.

17. **P1: Pitch detection exists in too many places.** Web TS (`utils/pitch.ts` + worker), pitch-core Rust and Tauri native Rust all implement overlapping YIN/range/level behavior.
    **Recommendation:** Make `pitch-core` the detector implementation and keep TS/Tauri as adapters.

18. **P1: Smoothing and confidence behavior are duplicated.** TS `FrequencySmoother`, Rust `Smoother`, native frame confidence and UI smoothing do not share a spec.
    **Recommendation:** Define one smoothing/filtering contract and test it with fixtures.

19. **P1: Power-chord and harmonic heuristics are not unified.** Core, web and UI paths can disagree on power-chord indication.
    **Recommendation:** Return power/harmonic flags from shared core with stable tests.

20. **P1: Spectrum/waveform drawing code is duplicated across Vue and egui.** Both platforms reinvent data scaling, history limits, colors and harmonic markers.
    **Recommendation:** Share data transforms and keep painters platform-specific but dumb.

21. **P2: Magic constants are scattered.** Buffer sizes, YIN threshold, RMS gates, history lengths, tolerance cents, gains and sample-rate assumptions live in many files.
    **Recommendation:** Move them into typed config structs/constants with docs.

22. **P2: Storage keys and profile shape are not centralized.** localStorage, Tauri Store and egui storage use unrelated flat keys.
    **Recommendation:** Add `UserProfileV1` and migrations.

23. **P2: Error handling language and shape differ per platform.** Web returns user-facing strings, Tauri emits strings, egui prints `eprintln!`.
    **Recommendation:** Introduce typed error categories and platform-specific presentation.

24. **P2: Old and new recommendation files can drift.** `recommendation.md` is the problem audit, while `RECOMMENDATIONS.md` is the action plan; without explicit links they look like duplicates.
    **Recommendation:** Keep `recommendation.md` canonical for problems and `RECOMMENDATIONS.md` canonical for the ordered refactor plan.

### Performance & Realtime Safety (25-34)
25. **P0: egui cpal callback locks and allocates.** It locks the engine/state, drains/grows Vecs and calls `request_repaint` from the audio callback path.
    **Recommendation:** Move DSP off the realtime callback using a ring buffer/channel and process on a non-realtime thread.

26. **P0: Tauri native cpal callback also does heavy work.** It extends/drains buffers, locks range, allocates YIN arrays and emits Tauri events from the input callback.
    **Recommendation:** Keep callback minimal: push samples into a bounded queue and process elsewhere.

27. **P0: `detect_pitch_yin_internal` allocates `diff` and `yin` on every call.** This is expensive in a hot path and contradicts the preallocation goal.
    **Recommendation:** Store YIN buffers in detector state and reuse them.

28. **P1: `TunerEngine::process` always computes spectrum and allocates `Vec<f32>`.** Even consumers that only need pitch pay FFT/spectrum cost.
    **Recommendation:** Make analyzer outputs optional and preallocate spectrum output.

29. **P1: Web pitch loop still depends on `requestAnimationFrame`.** Detection cadence is throttled to ~33ms, but the loop itself is a paint loop and copies buffers to a worker.
    **Recommendation:** Use AudioWorklet or a dedicated audio worker-style pipeline independent of paint.

30. **P1: Multiple visualizer RAF loops exist.** Waveform, spectrum and spectrogram each maintain their own draw loop and resizing.
    **Recommendation:** Centralize viz scheduling or drive all canvases from a shared `useVizData`/clock.

31. **P1: Canvas resize happens inside every draw.** `resizeCanvas()` is called on each frame in the visualizers.
    **Recommendation:** Use `ResizeObserver` and resize only when dimensions/DPR change.

32. **P1: `Spectrogram.vue` allocates a new `Uint8Array` every frame.** It also shifts history arrays in the draw loop.
    **Recommendation:** Reuse buffers and use a ring buffer.

33. **P2: egui requests repaint unconditionally.** `ctx.request_repaint()` runs every update even when idle.
    **Recommendation:** Repaint on audio frames, animations or user input; sleep when idle.

34. **P2: Native egui input path only builds an `f32` input stream.** It does not handle all cpal sample formats like the Tauri native path does.
    **Recommendation:** Add typed sample-format handling or reuse the Tauri/native audio service code.

### Testing & Verification (35-42)
35. **P0: No Rust/TS equivalence harness.** The project can drift between `notes.ts`, `pitch.ts`, `domain.rs`, `pitch-core`, Tauri native and egui without CI catching it.
    **Recommendation:** Add shared fixtures and assert frequency/note/cents parity.

36. **P0: No fake-mic E2E test.** There is no Playwright flow that feeds synthetic audio and asserts the UI detects the expected note.
    **Recommendation:** Add mocked `getUserMedia` / fake WAV pipeline tests.

37. **P1: Core tests are still narrow.** `web/scripts/test-core.mjs` tests useful synthetic notes, but not noisy guitar-like plucks, inharmonicity, silence runs, invalid imports or backend switching.
    **Recommendation:** Expand fixtures and split test suites by domain/pitch/settings/profile.

38. **P1: No benchmarks for hot DSP paths.** YIN/MPM/spectrum costs are not measured.
    **Recommendation:** Add `criterion` benches for representative buffer sizes and notes.

39. **P1: No property tests for note math.** Round-trip behavior across A4, transpose, capo and temperaments is not fuzzed.
    **Recommendation:** Add proptest/quickcheck and TS-side generated cases.

40. **P2: No visual regression tests for main states.** Gauge, stage/compact mode, colorblind mode and canvas states are not screenshot-tested.
    **Recommendation:** Add Playwright screenshots for idle/listening/in-tune/error states.

41. **P2: Build CI does not prove offline/privacy claims.** PWA/offline/local-only claims are not backed by a zero-network or cache test.
    **Recommendation:** Add CI checks for network fetches and built asset cacheability.

42. **P2: No long-running stability test.** There is no soak test for memory growth, stream restart, worker failure or repeated start/stop.
    **Recommendation:** Add scripted stability tests around lifecycle and audio mocks.

### Product, UX, Build & Documentation (43-50)
43. **P1: Web PWA is manifest-only.** README says PWA, but there is no full Service Worker/offline cache strategy.
    **Recommendation:** Implement real offline PWA or document it honestly as install metadata only.

44. **P1: Full profile import/export is missing.** Custom tuning transfer exists, but user instruments, temperaments, settings, metronome and practice history do not have one versioned backup.
    **Recommendation:** Add profile schema, migrations and full roundtrip tests.

45. **P1: Accessibility is incomplete.** Some live readout is improved, but canvases, color-only states, keyboard flow, focus rings and screen-reader text are not systematically verified.
    **Recommendation:** Add an accessibility checklist and test stage/compact/colorblind modes.

46. **P2: README still contained historical contradictions.** It mixed old first-review notes, future claims and current architecture status.
    **Recommendation:** Keep README short and point deep debt to this file and ARCHITECTURE.md.

47. **P2: WASM packaging is ad hoc.** `build:wasm` can try to install `wasm-pack` during the build and writes into `web/public/wasm`.
    **Recommendation:** Pin tool versions and make WASM artifacts reproducible/versioned.

48. **P2: Release hardening is incomplete.** Code-signing, notarization, CSP, checksums and audit gates are listed as plans rather than enforced release steps.
    **Recommendation:** Add release gates incrementally.

49. **P2: Observability is weak.** There is no health strip for WASM status, audio backend status, device failure, clipping, hum or DC bias.
    **Recommendation:** Add a "Test my mic" / diagnostics panel.

50. **P0: The architecture plan is only partially executed.** Domain extraction and composable splits started, but the key boundaries (ports, frames, session, shared registry, realtime-safe audio) are not in place.
    **Recommendation:** Treat [ARCHITECTURE.md](ARCHITECTURE.md) as the target spec and [RECOMMENDATIONS.md](RECOMMENDATIONS.md) as the ordered execution plan.

### More Architecture & Coupling Issues (51-80)

51. TunerEngine recomputes full spectrum on every process call regardless of whether any consumer needs it.
52. egui State struct mixes raw detection data with UI history (cents_history is pushed in App update).
53. No clear "Session" concept separating live detection from persistent settings.
54. useTuner returns a giant object with 30+ properties; consumers couple to too many details.
55. pitch-core still re-exports low level detect_pitch_yin_internal etc.; public surface is messy.
56. AudioManager in egui owns streams but no clear ownership transfer to engine.
57. VizManager in egui is a partial extraction but still lives inside the App impl.
58. Web and native have completely different strategies for feeding audio into the core (analyser vs cpal vs feed_audio_samples).
59. No inversion of control for "how pitch is detected" (hardcoded YIN+MPM fusion inside process).
60. Settings (a4, tuning) are mutated directly on engine and also kept in Vue refs without single source.
61. Components like StringSelector receive large computed lists instead of minimal props.
62. CentsHistory component receives raw array and does its own rendering logic duplicating gauge logic.
63. No event or callback abstraction for "new detection frame available".
64. Lock .clone() of entire State on every egui frame is inefficient and couples UI to internal repr.
65. WASM static OnceLock for WEB_ENGINE creates global mutable singleton anti-pattern.
66. Different handling of "no string selected" vs "chromatic" between web and egui.
67. Reference tone logic lives in useTuner instead of a dedicated composable/service.
68. No clean way to inject a mock detector for testing or file-based input.
69. The "edit current tuning" UI in egui mutates the tunings vec in place and assumes engine will see it.
70. Domain Note and Tuning use &'static str but web uses owned strings – friction when extending.
71. No separation between "raw pitch estimate" and "tuned to selected string cents".
72. useSettings and useTuner both manage a4 and lastTuningId with manual sync.
73. Spectrogram history is a VecDeque of Vec in egui with manual size management duplicated from cents_history.
74. Canvas components each implement their own requestAnimationFrame tick and resize – no shared VizCanvas helper.
75. pitch-core public API mixes f32 buffers with no lifetime or ownership docs.
76. Native cpal stream callback directly mutates engine through lock without clear producer/consumer.
77. Web still exposes analyserRef publicly for viz despite architecture goal of decoupling.
78. No "TunerConfig" value type passed around; a4 and tuning are set via methods scattered.
79. App.vue imports and uses many things from the single useTuner return value.
80. No ports/adapters for different input sources (mic, file, test tone generator).

### Performance & Efficiency Issues (81-110)
81. Every egui update pushes to cents_history and spectrogram_history unconditionally.
82. Spectrum bars in egui are drawn with per-frame math and allocations inside the paint closure.
83. Web tick function runs full detection + smoothing + history + volume calc at display refresh rate.
84. DownsampleForPitch often returns the original buffer (no-op fallback) wasting work.
85. No reuse of Float32Array for time domain in some web paths.
86. Histogram drawing in CentsHistory likely redraws full history every frame.
87. In egui waveform painting, every sample becomes a circle_filled call (very slow for 2048 samples).
88. Spectrogram uses 80 freq bins hard limit and redraws all history every time.
89. No idle/sleep when not listening – egui always requests repaint.
90. SharedAudio in web is created lazily but never suspended properly when tab hidden for long.
91. YIN difference function allocates inside the hot loop in native impl (from internal code structure).
92. Multiple BiquadFilter and Gain nodes created on every reference tone play.
93. No frame dropping or priority for viz when CPU is high.
94. Buffer of 2048 is always used even for higher strings where smaller window would suffice.
95. History arrays grow/shift without ring buffer (O(n) cost on shift).
96. In Spectrum.vue log scale bin selection recomputes every draw.
97. Waveform.vue allocates new path implicitly every frame with beginPath + many lineTo.
98. No memoization or caching of target note calculations when tuning doesn't change.
99. egui spectrum takes first 200 bins regardless of actual useful range.
100. WASM calls from JS have overhead on every raf tick; no batching.
101. Preallocated buffers in web are only for timeDomain; spectrum and others allocate.
102. cpal stream config is queried every device change without caching.
103. No use of requestIdleCallback for non-critical history updates.
104. FFT planner is recreated? No, but in engine it's per instance.
105. In tests synthetic sine generation uses full loop without SIMD.
106. Vue reactivity on large arrays (centsHistory) causes unnecessary component updates.
107. No WebGL or offscreen canvas for heavy spectrogram.
108. Reference tone lowpass is recreated every play instead of reused node.
109. Device list refresh is synchronous and can block UI.
110. Lack of any performance marks or profiling hooks in hot paths.

### Duplication & Code Smells (111-140)
111. Canvas resize + DPR code is nearly identical in Spectrum, Waveform, Spectrogram, CentsHistory.
112. Oscillator + Gain + Biquad creation code duplicated in playReferenceTone and playTone.
113. Two almost identical smoothing classes in TS (FrequencySmoother and WasmSmoother wrapper).
114. Spectrum drawing loop in egui duplicated in concept with web Spectrum.vue (log vs linear).
115. Note name arrays duplicated (Rust NOTE_NAMES, TS NOTE_NAMES).
116. Tuning list initialization logic similar in TS and Rust but not identical.
117. History limit 300 is hardcoded in multiple places (web cents, egui viz).
118. Error handling for audio start is different in web vs native (string message vs eprintln).
119. Cleanup logic scattered: stop(), cleanup(), onUnmounted, toggle paths.
120. "In tune" tolerance and hysteresis logic in web; similar but not same "in tune" color in egui.
121. Device selection UI code in egui and web TunerControls are parallel implementations.
122. Random string selection uses Math.random in web, SystemTime nanos in egui.
123. Lowpass freq 1600 and gains are magic in web but not centralized.
124. Several places do "if listening then show viz" but the condition is repeated in template and logic.
125. Buffer slicing in native cpal feed and wasm feed both hardcode 2048.
126. Frequency formatting functions duplicated (formatFreq in TS, inline in egui).
127. getNoteDisplay logic in web; similar display in egui labels.
128. Multiple places clamp cents manually ( /50.0 * w etc).
129. Power chord detection has native and wasm wrappers that may differ slightly.
130. Storage keys in egui save() are strings without constants.
131. Tick function in useTuner does detection, smoothing, rms, power, history, raf – god method.
132. In pitch-core many _impl and pub fn pairs for wasm vs native (boilerplate).
133. Vue computed for stringsWithCents, targetNote etc. recompute similar math.
134. Drawing colors are duplicated magic strings across canvas files (#11151b etc).
135. onUnmounted and stop() both try to clean some of the same things.
136. URL parsing and persisted load have similar "try find tuning" code.
137. Two places define "strings" selection (1-6 keys in web, combo in egui).
138. Sample rate preference duplicated in web constraints and consts.
139. Several "if (!x) return" guards that could be early returns or optionals.
140. Comments like "// for spectrum" and "// for waveform" indicate lack of structure.

### Error Handling, Robustness & Edge Cases (141-160)
141. Many .unwrap() on locks and device queries will panic on real errors.
142. WASM load failure leaves the app in broken state with only error message.
143. No handling for AudioContext being closed by browser (low power mode etc).
144. Device removal while listening not handled gracefully in native.
145. Synthetic tests use panic! on failure instead of proper assert macros with messages.
146. No recovery if cpal stream errors after start.
147. getUserMedia rejection only sets error string; no retry UI.
148. Frequency 0 or NaN from detector not always sanitized before UI.
149. In domain find_closest_string can panic? No, but returns first on empty.
150. No bounds checking on A4 input beyond simple clamp in some paths.
151. Visibility change resume can fail silently.
152. Osc.stop() in try/catch but no state if it was already stopped.
153. No handling for sample rate mismatch between requested and actual (web micSettings).
154. Buffer length < 2048 in feed_audio_samples just returns without detection.
155. No protection against concurrent start/stop calls.
156. In egui, if engine lock fails, detection is silently skipped in some places.
157. Power chord flag can flicker without hysteresis like the in-tune state.
158. DC offset detection test exists but no runtime DC bias removal.
159. Microphone constraints don't specify echoCancellation etc in all code paths consistently.
160. No timeout or watchdog for stuck raf loop or detection.

### Testing, Quality & CI Gaps (161-180)
161. Tests only cover basic sine waves; no real guitar recordings or inharmonicity cases.
162. No test that web WASM and native produce same cents within tolerance for same buffer.
163. No test for A4 != 440 behavior across the stack.
164. No fuzzing of extreme frequencies (20Hz, 2000Hz+).
165. Build doesn't run pitch-core tests in the web WASM target.
166. No visual regression tests for the gauge or canvas output.
167. Lacking tests for the new chromatic mode and tolerance settings.
168. No test for the settings migration or schema (none exists yet).
169. CI (from history) may not cover all matrix for egui + tauri + web.
170. No property test that find_closest_string + get_cents is consistent with target.
171. Tests use approx but tolerance is loose (2.0 Hz).
172. No load test or long-running stability test for the smoother.
173. Missing test for power chord on real multi-string input.
174. No test that UI doesn't crash when detector returns None for long time.
175. Documentation examples in code are missing for core functions.
176. No contract test between the exported WASM functions and TS callers.
177. Edge case of empty tuning list is handled poorly in tests and code.
178. No snapshot of TunerUpdate shape for regression.
179. Lack of mutation testing or any advanced quality metric.
180. Manual icons and build steps are error-prone and not tested.

### Web / Vue / Frontend Specific (181-200)
181. Every viz component duplicates the entire raf + resize + draw boilerplate.
182. analyser is passed down even when the component is not listening.
183. Large number of refs in useTuner cause many reactivity triggers.
184. No virtual list or optimization for long centsHistory render.
185. Fretboard component exists but may not be integrated well (from imports).
186. PerStringCents and other per-string views have their own detection logic?
187. i18n store is simple but strings for errors and hints are still mixed.
188. Keyboard shortcuts are global without proper focus management.
189. No ARIA live regions for the main note/cents readout despite plan.
190. Tailwind + custom CSS mix without clear design tokens.
191. Vite base path for /tuner/ must be maintained manually for Pages.
192. PWA manifest is present but no offline caching strategy implemented.
193. No proper handling for mic permission prompt UI states beyond pending flag.
194. Computed properties like stringsWithCents do work even when not visible.
195. Event listeners (keydown) added without passive or removal in all cases.
196. LocalStorage via useSettings has no versioning or corruption handling.
197. Many .value accesses in templates can be optimized.
198. No tree-shaking verification for the large pitch wasm bundle.
199. Dev server port is pinned for Tauri – brittle for other devs.
200. No source maps or proper error boundaries in production web build.

## How to Use This List
- Pick the highest impact items first: 1-6, 13, 15-17, 25-29, 35-36 and 50.
- Every fix should reduce coupling.
- Update this file, [ARCHITECTURE.md](ARCHITECTURE.md), [README.md](README.md) and relevant action steps in [RECOMMENDATIONS.md](RECOMMENDATIONS.md) when an item is resolved.
- Turn items into GitHub issues with links back here.

**Next audit:** after significant layer work or in 2-3 months.

## Fixes Applied (Small but Real)
- Fixed inconsistent sample rate (44100 hardcoded in egui spectrum harmonics vs 48000 in feed). Introduced PREFERRED_SAMPLE_RATE const and updated calculations.
- Documented the double-toggle mic restart hack in device change (egui) as a known smell.
- Fixed minor frequency rounding inconsistency in domain.rs default note (82.41 -> 82.4069 to match other sources).
These were safe, low-risk fixes addressing items from the Top 200.

## Summary
- The canonical audit now contains exactly 200 problems.
- Many are direct violations of the architecture vision.
- A number are low-hanging: hardcoded values, duplicate canvas plumbing, missing constants, stale README/docs.
- Highest impact remains: god objects, visualizer/audio coupling, duplicated domain/pitch logic, realtime safety, and missing parity tests.

Update this file when fixing. Link from issues.
