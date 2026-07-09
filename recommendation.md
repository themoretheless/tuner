# Recommendations & Open Problems Backlog

**Current state audit (synced 2026-07-09)**

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

4. **P0: `pitch-core` layering is only partially complete.** `lib.rs` is no longer the monolith: `frames`, `signal`, `smoother`, `engine` and `dsp` are split out. The remaining debt is that YIN/MPM still share one `dsp.rs`, spectrum analysis lives in `engine.rs`, WASM exports live with DSP and tests still sit in root.
   **Recommendation:** Finish the split into `dsp/yin`, `dsp/mpm`, `spectrum`, `wasm` and add a `PitchDetector` trait.

5. **P0: `egui/src/main.rs` is still a god file.** `App::update` handles repaint policy, input, painting, history mutation, device UI, stream toggles and reference tone wiring.
   **Recommendation:** Extract widgets/painters/managers, then make egui consume the same session/data contracts as web.

6. **P1: `useTuningState.ts` is a second god-object.** It combines instrument registry selection, chromatic mode, temperament math, custom tuning CRUD, export/import, profile handling and display helpers.
   **Recommendation:** Split pure music/domain functions from workflow controllers and UI view models.

7. **P1: `useSettings.ts` is a global mutable settings singleton.** It owns persistence, schema normalization, refs, watches and save throttling in one module.
   **Recommendation:** Add a versioned profile schema and storage ports, then make settings a loaded config value.

8. **P1: `App.vue` is an overloaded feature shell.** It imports almost every panel and wires tuner, settings, practice, metronome, custom tunings, temperaments and display controls on one screen.
   **Recommendation:** Split into feature screens/slices: tuner, library, practice, settings.

9. **P1: `DetectionFrame` contract is started but not universal.** `pitch-core` now emits `DetectionFrame`, TS has matching frame types, Tauri native emits a frame-shaped event, and web session/useTuner now exposes a primary enriched `DetectionFrame`. Remaining drift: native does not yet receive full tuning/target context, egui is not on the same frame contract, and some compatibility frequency aliases remain.
    **Recommendation:** Finish canonical frame adoption across Tauri native and egui, pass tuning context into the native frame path, then remove compatibility frequency-only plumbing.

10. **P1: Engine internals leak into UI shape.** The UI still receives raw frequencies, selected strings, backend flags and many refs as one broad API.
    **Recommendation:** Return small view-model slices and commands for each feature.

11. **P1: Persistence, URL/app state and live session state are tangled.** Settings are watched and saved while live audio and tuning selection mutate.
    **Recommendation:** Separate persisted profile, transient session and derived presentation state.

12. **P1: Tauri native audio bypasses `pitch-core`.** `desktop/src-tauri/src/native_audio.rs` has its own YIN detector and level normalization instead of using shared core/engine.
    **Recommendation:** Reuse `pitch-core` or a shared detector module from Tauri native audio.

13. **P1: `TunerEngine` is not just an engine boundary.** It owns smoothing, FFT planner, buffers, note formatting strings and spectrum production regardless of consumer needs.
    **Recommendation:** Split detector/analyzer/smoother and let session request only needed outputs.

### Duplication & Drift
14. **P0: Tuning and instrument truth is still duplicated, but drift is now guarded.** `web/src/utils/notes.ts` and `pitch-core/src/domain.rs` now have parity coverage for built-in tunings, but they are still two hand-maintained sources.
    **Recommendation:** Move to one registry source/codegen so the parity test passes by construction.

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

28. **P1: Canvas renderer lifecycle is improved but still not fully optimized.** Web visualizers now share `useCanvasRenderer` with `ResizeObserver` and coalesced RAF scheduling, but the HiDPI validation still runs on scheduled draws.
    **Recommendation:** Cache dimensions/DPR and skip backing-store checks unless `ResizeObserver` or DPR changes.

29. **P2: egui requests repaint unconditionally.** `ctx.request_repaint()` runs every update even when idle.
    **Recommendation:** Repaint on audio frames, animations or user input; sleep when idle.

30. **P2: Native egui input path only builds an `f32` input stream.** It does not handle all cpal sample formats like the Tauri native path does.
    **Recommendation:** Add typed sample-format handling or reuse the Tauri/native audio service code.

### Testing & Verification
31. **P0: Rust/Web domain equivalence harness is partial.** Built-in tuning, note/cents and closest-string parity now runs from a Rust snapshot inside Vitest, but pitch-path and Tauri/egui equivalence are not covered yet.
    **Recommendation:** Extend shared fixtures to pitch detection, native events and egui/session outputs.

32. **P1: Fake-mic E2E coverage is still shallow.** Playwright now verifies `?fixture=E2` through the UI without microphone access, but permission-denied, device loss and mocked `getUserMedia` flows are not covered yet.
    **Recommendation:** Extend Playwright with denied-permission, device-unplug and fake WAV pipeline tests.

33. **P1: Core tests are still narrow.** Vitest now covers useful synthetic notes, noisy sine, silence, range normalization, Rust/Web domain parity, a headless synthetic audio fixture and the synthetic `useTunerSession` path, while Playwright covers the synthetic UI flow; still missing inharmonicity, invalid imports, full session state behavior and backend switching.
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
69. pitch-core public API mixes f32 buffers with no lifetime or ownership docs.
70. Native cpal stream callback directly mutates engine through lock without clear producer/consumer.
71. No "TunerConfig" value type passed around; a4 and tuning are set via methods scattered.
72. App.vue imports and uses many things from the single useTuner return value.
73. No ports/adapters for different input sources (mic, file, test tone generator).

### Performance & Efficiency Issues
74. Every egui update pushes to cents_history and spectrogram_history unconditionally.
75. Spectrum bars in egui are drawn with per-frame math and allocations inside the paint closure.
76. Web tick function runs full detection + smoothing + history + volume calc at display refresh rate.
77. DownsampleForPitch often returns the original buffer (no-op fallback) wasting work.
78. Histogram drawing in CentsHistory likely redraws full history every frame.
79. In egui waveform painting, every sample becomes a circle_filled call (very slow for 2048 samples).
80. Spectrogram uses 80 freq bins hard limit and redraws all history every time.
81. No idle/sleep when not listening – egui always requests repaint.
82. SharedAudio in web is created lazily but never suspended properly when tab hidden for long.
83. YIN difference function allocates inside the hot loop in native impl (from internal code structure).
84. Multiple BiquadFilter and Gain nodes created on every reference tone play.
85. No frame dropping or priority for viz when CPU is high.
86. Buffer of 2048 is always used even for higher strings where smaller window would suffice.
87. History arrays grow/shift without ring buffer (O(n) cost on shift).
88. In Spectrum.vue log scale bin selection recomputes every draw.
89. Waveform.vue allocates new path implicitly every frame with beginPath + many lineTo.
90. No memoization or caching of target note calculations when tuning doesn't change.
91. egui spectrum takes first 200 bins regardless of actual useful range.
92. WASM calls from JS have overhead on every raf tick; no batching.
93. Preallocated buffers in web are only for timeDomain; spectrum and others allocate.
94. cpal stream config is queried every device change without caching.
95. No use of requestIdleCallback for non-critical history updates.
96. In tests synthetic sine generation uses full loop without SIMD.
97. Vue reactivity on large arrays (centsHistory) causes unnecessary component updates.
98. No WebGL or offscreen canvas for heavy spectrogram.
99. Reference tone lowpass is recreated every play instead of reused node.
100. Device list refresh is synchronous and can block UI.
101. Lack of any performance marks or profiling hooks in hot paths.

### Duplication & Code Smells
102. Oscillator + Gain + Biquad creation code duplicated in playReferenceTone and playTone.
103. Two almost identical smoothing classes in TS (FrequencySmoother and WasmSmoother wrapper).
104. Spectrum drawing loop in egui duplicated in concept with web Spectrum.vue (log vs linear).
105. Note name arrays duplicated (Rust NOTE_NAMES, TS NOTE_NAMES).
106. Tuning list initialization logic similar in TS and Rust but not identical.
107. History limit 300 is hardcoded in multiple places (web cents, egui viz).
108. Error handling for audio start is different in web vs native (string message vs eprintln).
109. Cleanup logic scattered: stop(), cleanup(), onUnmounted, toggle paths.
110. "In tune" tolerance and hysteresis logic in web; similar but not same "in tune" color in egui.
111. Device selection UI code in egui and web TunerControls are parallel implementations.
112. Random string selection uses Math.random in web, SystemTime nanos in egui.
113. Lowpass freq 1600 and gains are magic in web but not centralized.
114. Several places do "if listening then show viz" but the condition is repeated in template and logic.
115. Buffer slicing in native cpal feed and wasm feed both hardcode 2048.
116. Frequency formatting functions duplicated (formatFreq in TS, inline in egui).
117. getNoteDisplay logic in web; similar display in egui labels.
118. Multiple places clamp cents manually ( /50.0 * w etc).
119. Power chord detection has native and wasm wrappers that may differ slightly.
120. Storage keys in egui save() are strings without constants.
121. Tick function in useTuner does detection, smoothing, rms, power, history, raf – god method.
122. In pitch-core many _impl and pub fn pairs for wasm vs native (boilerplate).
123. Vue computed for stringsWithCents, targetNote etc. recompute similar math.
124. Drawing colors are duplicated magic strings across canvas files (#11151b etc).
125. onUnmounted and stop() both try to clean some of the same things.
126. URL parsing and persisted load have similar "try find tuning" code.
127. Two places define "strings" selection (1-6 keys in web, combo in egui).
128. Sample rate preference duplicated in web constraints and consts.
129. Several "if (!x) return" guards that could be early returns or optionals.
130. Comments like "// for spectrum" and "// for waveform" indicate lack of structure.

### Error Handling, Robustness & Edge Cases
131. Many .unwrap() on locks and device queries will panic on real errors.
132. WASM load failure leaves the app in broken state with only error message.
133. No handling for AudioContext being closed by browser (low power mode etc).
134. Device removal while listening not handled gracefully in native.
135. No recovery if cpal stream errors after start.
136. getUserMedia rejection only sets error string; no retry UI.
137. Frequency 0 or NaN from detector not always sanitized before UI.
138. Visibility change resume can fail silently.
139. Osc.stop() in try/catch but no state if it was already stopped.
140. No handling for sample rate mismatch between requested and actual (web micSettings).
141. Buffer length < 2048 in feed_audio_samples just returns without detection.
142. No protection against concurrent start/stop calls.
143. In egui, if engine lock fails, detection is silently skipped in some places.
144. Power chord flag can flicker without hysteresis like the in-tune state.
145. DC offset detection test exists but no runtime DC bias removal.
146. Microphone constraints don't specify echoCancellation etc in all code paths consistently.
147. No timeout or watchdog for stuck raf loop or detection.

### Testing, Quality & CI Gaps
148. Tests only cover basic sine waves; no real guitar recordings or inharmonicity cases.
149. No test that web WASM and native produce same cents within tolerance for same buffer.
150. No test for A4 != 440 behavior across the stack.
151. No fuzzing of extreme frequencies (20Hz, 2000Hz+).
152. Build doesn't run pitch-core tests in the web WASM target.
153. No visual regression tests for the gauge or canvas output.
154. Lacking tests for the new chromatic mode and tolerance settings.
155. No test for the settings migration or schema (none exists yet).
156. No property test that find_closest_string + get_cents is consistent with target.
157. Tests use approx but tolerance is loose (2.0 Hz).
158. No load test or long-running stability test for the smoother.
159. Missing test for power chord on real multi-string input.
160. No test that UI doesn't crash when detector returns None for long time.
161. Documentation examples in code are missing for core functions.
162. No contract test between the exported WASM functions and TS callers.
163. Edge case of empty tuning list is handled poorly in tests and code.
164. No snapshot of TunerUpdate shape for regression.
165. Lack of mutation testing or any advanced quality metric.
166. Manual icons and build steps are error-prone and not tested.

### Web / Vue / Frontend Specific
167. Viz components still duplicate draw scheduling and start/stop boilerplate.
168. Large number of refs in useTuner cause many reactivity triggers.
169. No virtual list or optimization for long centsHistory render.
170. Fretboard component exists but may not be integrated well (from imports).
171. i18n store is simple but strings for errors and hints are still mixed.
172. Keyboard shortcuts are global without proper focus management.
173. Tailwind + custom CSS mix without clear design tokens.
174. Vite base path for /tuner/ must be maintained manually for Pages.
175. PWA manifest is present but no offline caching strategy implemented.
176. No proper handling for mic permission prompt UI states beyond pending flag.
177. LocalStorage via useSettings has no versioning or corruption handling.
178. No tree-shaking verification for the large pitch wasm bundle.
179. Dev server port is pinned for Tauri – brittle for other devs.
180. No source maps or proper error boundaries in production web build.

## SOLID/DRY Execution Slices

Use this as the practical decomposition plan. Each slice should be small enough for one focused
commit and should reduce coupling between audio, DSP, state and presentation.

| Order | Slice | SOLID/DRY Problem Closed | Files To Touch First | Done When |
| --- | --- | --- | --- | --- |
| 1 | Session state machine | Start/stop logic has no single owner | `useTunerSession.ts`, tests | `idle/starting/listening/stopping/error` is serialized and tested |
| 2 | Audio input port | UI depends on backend details | `web/src/ports/audioInput.ts`, adapters | web/native/synthetic use same contract |
| 3 | Native frame context | `DetectionFrame` is not universal | Tauri native, `useNativeAudioInput.ts` | native frame includes target/cents from shared config |
| 4 | egui frame adoption | egui readout drifts from web | `egui/src/main.rs`, pitch-core frames | egui renders `DetectionFrame`, not parallel state |
| 5 | Practice controller | `useTuner` owns practice workflow | `useTuner.ts`, `useEarTraining.ts` | streak/export/mark logic tested outside Vue shell |
| 6 | Profile schema | settings keys are duplicated and flat | `useSettings.ts`, transfer UI | `UserProfileV1` roundtrip and migration tests pass |
| 7 | Music registry source | TS/Rust tuning truth duplicated | `notes.ts`, `domain.rs`, codegen | parity passes by construction |
| 8 | Pitch module split | detector/range/smoothing mixed | `pitch.ts`, `pitch-core/src/dsp.rs` | modules have single responsibility and fixtures |
| 9 | Native realtime queue | callback locks/allocates | Tauri/egui cpal code | callback only pushes samples; worker processes |
| 10 | Feature shells | `App.vue` is a feature pile | `App.vue`, view-models | Tune/Practice/Library/Settings are separate shells |

### Small-Commit Rules

- One concept per commit: status machine, audio port, profile schema, design tokens, etc.
- Keep compatibility facades during migration, then remove aliases in a later cleanup commit.
- Add a fake adapter or fixture before moving real code behind a port.
- Prefer pure functions for domain, practice, profile and formatting.
- Do not add a new feature into `useTuner`, `useTuningState`, `useSettings`, `egui/main.rs` or `native_audio.rs` without first extracting the owner module.

## Design Recommendations

The product-design target is a quiet, accurate musical tool. It should not look like a debug dashboard
unless diagnostics are explicitly opened.

| Area | Problem | Recommendation |
| --- | --- | --- |
| Main readout | Note, target and controls visually compete | Make note/cents direction the dominant center; move expert controls away |
| States | Idle/listening/error/no-signal are too similar | Add explicit state copy, shape and focus changes for each state |
| Color | Green/red semantics are not enough | Add direction labels, needle shape, haptics/audio options and colorblind tokens |
| Mobile | Controls can crowd the tuner | Use bottom-sheet controls and keep note/gauge fixed-size |
| Stage mode | Needs glanceable high contrast | Hide nonessential controls, use larger type and high-luminance tokens |
| Compact mode | Risks unreadable miniature UI | Keep one-line status, note, cents and selected string only |
| Visualizers | Optional data can dominate the task | Lazy-load and collapse when idle; never show idle black panels |
| Diagnostics | Failure states are vague | Add "Test mic", backend health, silence/clipping/DC/device-loss hints |

## Three Review Iterations

### Iteration 1 - Structure Review

Finding: the docs had the full Top 500 in a separate file, but the requested files did not explain how the 500 items map to the architecture.

Fix: add SOLID/DRY decomposition, small-slice execution order and generated Top 500 mirrors to `ARCHITECTURE.md`, `README.md` and this file.

### Iteration 2 - Design Review

Finding: the architecture plan was mostly engineering-first and did not state the product design shape clearly enough.

Fix: add designer-led information architecture, visual principles, state hierarchy and component-level UI recommendations.

### Iteration 3 - Consistency Review

Finding: current docs used different wording for Top 500, current audit, execution order and remaining frame/session debt.

Fix: make [TOP-500-backlog.md](TOP-500-backlog.md) the canonical ranked source, keep `R#` here stable, and add generated mirrors with date/status so the three requested files agree.

## Full Top 500 Mirror

The canonical source is [TOP-500-backlog.md](TOP-500-backlog.md). This mirror is generated from it so the
500 proposals, improvements, problems, errors and bad-design findings are also present in this recommendation file.

<!-- TOP500_RECOMMENDATION:START -->
<details open>
<summary>Full ranked Top 500, mirrored from TOP-500-backlog.md</summary>

| M# | Tier | Val | Source | Item | Note |
| --- | --- | --- | --- | --- | --- |
| M1 | P1 | 78 | r1:review | move DSP off cpal realtime callback |  |
| M2 | P1 | 76 | r1:review | remove blocking Mutex in audio callback |  |
| M3 | P2 | 74 | r1:review | unify tunings and note math into pitch-core |  |
| M4 | P2 | 73 | r1:review | octave-error guard subharmonic/NSDF |  |
| M5 | P2 | 72 | r1:review | real service worker / offline PWA |  |
| M6 | P2 | 70 | r1:review | eliminate per-callback heap allocations |  |
| M7 | P2 | 66 | r1:review | check Rust and TS tuning tables match |  |
| M8 | P2 | 66 | r1:review | code-sign and notarize macOS/Windows |  |
| M9 | P2 | 66 | r2:algorithms | Harmonic Product Spectrum octave disambiguator from the existing 2048 FFT | Reuses current FFT to kill octave errors with minimal code. |
| M10 | P2 | 64 | r1:review | high-pass filter rumble/mains |  |
| M11 | P2 | 64 | r1:review | reconcile Rust/TS frequency-to-MIDI rounding |  |
| M12 | P2 | 64 | r2:algorithms | Multi-resolution dual-window analysis: long window for low strings, short for high | Fixes low-E resolution vs high-string latency tradeoff. |
| M13 | P2 | 62 | r1:review | stop resizeCanvas every frame |  |
| M14 | P2 | 62 | r1:review | Tauri CSP |  |
| M15 | P2 | 62 | r1:review | adaptive noise-floor gate |  |
| M16 | P2 | 62 | r2:distribution | Verifiable '100% local, no network' privacy badge backed by CI zero-fetch test | Strong trust signal with a cheap CI assertion; differentiates from cloud tuners. |
| M17 | P2 | 62 | r2:algorithms | Adaptive per-string tau search bounds derived from the selected target | Faster, fewer-error search when string known. |
| M18 | P2 | 60 | r1:review | consolidate five rAF loops into one |  |
| M19 | P2 | 60 | r1:review | decouple detection cadence from rAF |  |
| M20 | P2 | 60 | r1:review | CI hygiene clippy/rustfmt/deploy-freshness |  |
| M21 | P2 | 60 | r2:distribution | Dedicated SEO landing page at /tuner/ targeting 'online guitar tuner' with schema.org FAQ + HowTo | Primary organic-discovery lever for a web tuner. |
| M22 | P2 | 60 | r2:dx-quality | WASM/native numeric-equivalence harness over a shared fixture manifest | Guarantees egui and web paths agree numerically. |
| M23 | P2 | 60 | r3:observability-reliability | Graceful-degradation matrix: explicit WASM-down / mic-down fallback states | Defines deterministic UX for every failure mode instead of blank screens. |
| M24 | P2 | 60 | r4:docs-dx | Playwright fake-WAV pipeline test asserts detected note | Feed synthetic E2 audio, assert NoteDisplay shows E. |
| M25 | P2 | 58 | r1:review | legible sidebar text |  |
| M26 | P2 | 58 | r1:review | vitest unit tests note math |  |
| M27 | P2 | 58 | r1:review | one-euro filter |  |
| M28 | P2 | 58 | r1:review | WebKitGTK media backend AppImage |  |
| M29 | P2 | 58 | r1:review | hardcoded 44100 in egui harmonic overlay |  |
| M30 | P2 | 58 | r2:algorithms | Confidence-weighted late fusion of YIN, MPM, HPS and Goertzel into one estimate | Single fused estimate from existing detectors cuts octave/jitter errors cheaply. |
| M31 | P2 | 58 | r2:a11y-deep | Shape/texture redundancy so in-tune state never relies on color alone | WCAG non-color-reliance; trivial and broadly useful. |
| M32 | P2 | 58 | r2:dx-quality | Property-based test for frequencyToNote round-trip across A4 sweep | Catches note-math regressions cheaply. |
| M33 | P2 | 58 | r2:dx-quality | cargo-deny + npm audit supply-chain gate with committed advisory baseline | Blocks vulnerable deps in CI cheaply. |
| M34 | P2 | 58 | r3:observability-reliability | "Test My Mic" self-diagnostic wizard with pass/fail panel | Cuts the #1 support cause (no signal) before it becomes a bug report. |
| M35 | P2 | 57 | r2:dx-quality | Vitest fake-mic harness driving useTuner via scripted AnalyserNode stub | Deterministic frontend tuner-logic testing. |
| M36 | P2 | 57 | r3:observability-reliability | Mic-signal sanity watchdog (silent / clipping / DC-stuck warnings) | Proactively tells users why detection is wrong before they blame the app. |
| M37 | P2 | 56 | r1:review | aria-live for note and cents |  |
| M38 | P2 | 56 | r1:review | auto-advance string-by-string guided tuning |  |
| M39 | P2 | 56 | r1:review | fix CentsHistory deep watcher |  |
| M40 | P2 | 56 | r1:review | bound MPM NSDF tau range |  |
| M41 | P2 | 56 | r1:review | chromatic auto-detect mode |  |
| M42 | P2 | 56 | r2:dx-quality | insta snapshot tests for full DetectionResult on fixture WAVs | Locks down pipeline output on real signals. |
| M43 | P2 | 56 | r3:i18n-breadth | Browser-language auto-detect via navigator.languages with persisted override | Foundation for all localization; cheap and immediately broadens reach. |
| M44 | P2 | 56 | r4:perf-bundle | Preallocate YIN buffers as module singletons across calls | pitch.ts reallocates per size change; pin to max guitar size. |
| M45 | P2 | 56 | r4:docs-dx | Playwright E2E for mic-permission-denied flow | Drive fake getUserMedia, assert permission UI path renders. |
| M46 | P2 | 55 | r1:review | localize hardcoded English in-tune hint |  |
| M47 | P2 | 55 | r2:algorithms | Goertzel bank locked to 6 selected-string targets and their first 4 harmonics | Cheap targeted detection when string is known. |
| M48 | P2 | 55 | r4:perf-bundle | WASM streaming instantiation via instantiateStreaming for pitch-core | When web wires WASM, compile-while-download instead of arrayBuffer fetch. |
| M49 | P3 | 54 | r1:review | validate/clamp A4 on load |  |
| M50 | P3 | 54 | r1:review | gate FFT spectrum when viz hidden |  |
| M51 | P3 | 54 | r1:review | reuse YIN difference buffers |  |
| M52 | P3 | 54 | r2:native-os | Native mic-permission preflight via Tauri macOS AVCaptureDevice request | Avoids silent failure when OS denies mic. |
| M53 | P3 | 54 | r2:algorithms | Gaussian-window interpolation on log-magnitude FFT peaks (Jacobsen/Quinn) | Sub-bin frequency accuracy from existing FFT. |
| M54 | P3 | 54 | r3:observability-reliability | Stale-PWA / update-available checker against version.json | Stops users getting stuck on cached old builds. |
| M55 | P3 | 54 | r4:perf-bundle | Cap maxTau by selected-string frequency to shorten YIN | When string chosen, narrow lag range, fewer CMNDF iterations. |
| M56 | P3 | 53 | r1:review | first-run onboarding + mic priming |  |
| M57 | P3 | 52 | r1:review | cache Spectrum gradients |  |
| M58 | P3 | 52 | r1:review | collapsible settings sidebar on mobile |  |
| M59 | P3 | 52 | r1:review | build script copies WASM to unserved dir |  |
| M60 | P3 | 52 | r2:a11y-deep | Colorblind palette presets (deuteran/protan/tritan) replacing red/green coding | Red/green in-tune coding fails ~8% of male users. |
| M61 | P3 | 52 | r2:dx-quality | Golden-trace differential runner: flag any fixture moving >1 cent | Regression tripwire for DSP changes. |
| M62 | P3 | 52 | r2:a11y-deep | Adjustable in-tune tolerance + detection smoothing as accessibility controls | Lets tremor/motor users widen the target. |
| M63 | P3 | 52 | r3:i18n-breadth | Locale-correct A4 decimal parsing accepting comma and period keypads | Prevents broken A4 entry for half the world; trivial fix. |
| M64 | P3 | 52 | r4:settings-personalization | Configurable in-tune tolerance band in cents | Slider 1-10 cents controls green-zone width directly. |
| M65 | P3 | 52 | r4:perf-bundle | Lazy-load Waveform and Spectrum via defineAsyncComponent | App.vue statically imports both; split each into its own chunk. |
| M66 | P3 | 50 | r1:review | spectrogram allocation and full redraw |  |
| M67 | P3 | 50 | r1:review | pin toolchain and wasm-pack version |  |
| M68 | P3 | 50 | r1:review | custom/editable tuning builder |  |
| M69 | P3 | 50 | r1:review | web AudioWorklet detection |  |
| M70 | P3 | 50 | r1:review | strengthen TARGET vs detected note hierarchy |  |
| M71 | P3 | 50 | r1:review | async device-change restart |  |
| M72 | P3 | 50 | r1:review | useSettings single source for tuning/A4 |  |
| M73 | P3 | 50 | r1:review | in-tune confirmation cue haptic/sound/flash |  |
| M74 | P3 | 50 | r1:review | auto-detected string highlight + spring needle |  |
| M75 | P3 | 50 | r1:review | maskable PNG icons 192/512 |  |
| M76 | P3 | 50 | r2:algorithms | wasm-SIMD f32x4 vectorization of YIN difference and MPM NSDF inner loops | Headroom to run fusion/multi-window without CPU cost. |
| M77 | P3 | 50 | r2:a11y-deep | Cognitive-load Simple Mode: target note + big up/down arrow only | Removes clutter for beginners and cognitive accessibility. |
| M78 | P3 | 50 | r2:dx-quality | Synthetic harmonic-stack generator with controllable inharmonicity B-coefficient | Realistic test signals for the whole suite. |
| M79 | P3 | 50 | r2:algorithms | Real-cepstrum quefrency cross-check gating the YIN result | Independent octave/voicing sanity check. |
| M80 | P3 | 50 | r2:native-os | Power/idle-aware stream suspension on display sleep and app hide | Saves battery when not actively tuning. |
| M81 | P3 | 50 | r3:observability-reliability | Audio-pipeline health strip (AudioContext state + buffer underrun counter) | Makes silent audio failures visible and debuggable in the field. |
| M82 | P3 | 50 | r3:observability-reliability | Sample-rate / device-mismatch reconciliation warning | Explains a subtle, common cause of detection error. |
| M83 | P3 | 50 | r4:settings-personalization | Versioned settings schema with migration runner | Stamp schemaVersion; migrate old keys on load, no data loss. |
| M84 | P3 | 50 | r4:perf-bundle | Gate visualizer chunk fetch behind showWaveform/showSpectrum toggles | Only download viz code when user enables that visualizer. |
| M85 | P3 | 50 | r4:perf-bundle | Decimate input to fixed 22050Hz before YIN loop | Guitar max 400Hz needs no 44.1k; halves tau-search cost. |
| M86 | P3 | 48 | r1:review | header wrap/shrink at 320px |  |
| M87 | P3 | 48 | r1:review | bass 4/5-string tunings |  |
| M88 | P3 | 48 | r1:review | A4 clamp on commit not keystroke |  |
| M89 | P3 | 48 | r1:review | reference-tone playback feedback |  |
| M90 | P3 | 48 | r1:review | devicechange listener refresh |  |
| M91 | P3 | 48 | r1:review | per-instrument detection frequency range |  |
| M92 | P3 | 48 | r1:review | split useTuner god-composable |  |
| M93 | P3 | 48 | r2:algorithms | Kalman filter on (log-f0, df0/dt) replacing EMA+median smoother | Predictive smoothing tracks vibrato/glide better than EMA. |
| M94 | P3 | 48 | r2:dx-quality | Detection-accuracy report artifact: cents-error histogram per SNR bucket | Objective accuracy tracking across noise levels. |
| M95 | P3 | 48 | r3:observability-reliability | Version/build-info panel (git SHA, build date, WASM hash, platform) | Makes bug reports actionable with exact build identity. |
| M96 | P3 | 48 | r4:perf-bundle | Brotli + gzip precompress dist with vite-plugin-compression | Static GitHub Pages host can serve .br/.gz for JS/WASM/CSS. |
| M97 | P3 | 48 | r4:perf-bundle | Throttle visualizer redraw to 30fps decoupled from detection | Waveform/Spectrum at 30fps saves canvas work, detection stays fast. |
| M98 | P3 | 48 | r4:docs-dx | Local seed fixture: bundled reference tone WAVs | Ship per-string sample files for mic-free dev iteration. |
| M99 | P3 | 48 | r4:theming-identity | Extract semantic color tokens from hardcoded hex | CSS custom properties layer enabling all theming work in style.css. |
| M100 | P3 | 46 | r1:review | redesign StringSelector for narrow column |  |
| M101 | P3 | 46 | r1:review | refactor egui App::update god method |  |
| M102 | P3 | 46 | r1:review | needle color gradient and directional arrow |  |
| M103 | P3 | 46 | r2:a11y-deep | forced-colors mode mapping with SystemColor keywords for canvas needle/spectrum | Windows High Contrast support for canvas elements. |
| M104 | P3 | 46 | r2:algorithms | Phase-vocoder instantaneous-frequency refinement of the FFT peak bin | Higher precision than parabolic interpolation. |
| M105 | P3 | 46 | r2:distribution | Open Graph + Twitter Card meta with per-tuning dynamic preview image | Better share-link previews for SEO/social. |
| M106 | P3 | 46 | r3:observability-reliability | Pseudo-localization CI check flagging hardcoded strings before merge | Stops untranslated strings regressing into releases. |
| M107 | P3 | 46 | r4:perf-bundle | Skip getByteFrequencyData when Spectrum component unmounted | Stop analyser frequency reads entirely when spectrum hidden. |
| M108 | P3 | 46 | r4:docs-dx | Dev mode synthetic-signal injector toggle | Replace mic with generated f0 for deterministic local UI work. |
| M109 | P3 | 44 | r1:review | accessible label for input device select |  |
| M110 | P3 | 44 | r1:review | ring buffer for centsHistory |  |
| M111 | P3 | 44 | r1:review | tighten 440Hz octave test |  |
| M112 | P3 | 44 | r1:review | idle vs no-signal empty states |  |
| M113 | P3 | 44 | r1:review | Tauri updater signed feed |  |
| M114 | P3 | 44 | r2:algorithms | Inharmonicity-aware f0 fit (B-coefficient stretched-partial model) | Corrects wound-string stretched partials. |
| M115 | P3 | 44 | r2:algorithms | pYIN probabilistic candidates + Viterbi HMM pitch track across frames | State-of-art temporal track; heavier to implement. |
| M116 | P3 | 44 | r2:a11y-deep | Per-string cents announced as discrete buckets for screen-reader users | Readable SR output instead of rapid numbers. |
| M117 | P3 | 44 | r3:i18n-breadth | Translated note-name systems by locale: Do-Re-Mi vs C-D-E | Romance-language users expect solfege; core to feeling native. |
| M118 | P3 | 44 | r3:observability-reliability | egui native panic hook writing crash trace to OS app-data dir | Captures native crashes that otherwise vanish. |
| M119 | P3 | 44 | r3:i18n-breadth | Translated egui native strings sharing the web app's locale JSON | One translation source covers both clients. |
| M120 | P3 | 44 | r4:ui-micro | Press-and-hold +/- A4 stepper auto-repeats with acceleration | Hold accelerates Hz steps; tap nudges single increment. |
| M121 | P3 | 44 | r4:perf-bundle | Reuse single Float32Array for RMS and YIN, no copy | Share timeDomainBuffer; avoid second analyser read per frame. |
| M122 | P3 | 44 | r4:theming-identity | In-tune color semantics override (green-blind safe sets) | Theme defines in-tune/flat/sharp hues, not hardcoded green/amber. |
| M123 | P3 | 42 | r1:review | async load persisted lastTuningId |  |
| M124 | P3 | 42 | r1:review | label A4 input |  |
| M125 | P3 | 42 | r1:review | label tuning select |  |
| M126 | P3 | 42 | r1:review | FFT-accelerate YIN/MPM |  |
| M127 | P3 | 42 | r2:dx-quality | DSP scope-recorder: dump per-frame internals to a replayable .ndjson trace | Replay field bugs without the original audio. |
| M128 | P3 | 42 | r2:algorithms | Autocorrelation-of-the-spectrum (spectral autocorrelation) f0 estimator | Extra fusion vote robust to missing fundamental. |
| M129 | P3 | 42 | r2:native-os | Window-state persistence across launches | Restores size/position; expected desktop polish. |
| M130 | P3 | 42 | r2:a11y-deep | egui native: respect OS reduce-motion/high-contrast via accesskit + theme query | Brings native app to accessibility parity. |
| M131 | P3 | 42 | r3:observability-reliability | In-app local error-log viewer with copy-to-clipboard | Users can self-serve logs without devtools. |
| M132 | P3 | 42 | r3:i18n-breadth | Locale-aware A4 number formatting with Intl.NumberFormat | Displays decimals correctly per locale; pairs with parsing fix. |
| M133 | P3 | 42 | r4:ui-micro | Swipe horizontally on tuner panel to cycle tunings | Touch swipe steps prev/next tuning with edge bounce. |
| M134 | P3 | 42 | r4:privacy-security | Clear-all-local-data button wiping localStorage IndexedDB caches | One click clears settings, logs, caches, revokes mic stream. |
| M135 | P3 | 42 | r4:offline-storage | Cache-version manifest with stale-cache purge on boot | Compare baked CACHE_VERSION, delete old caches.keys() entries at startup. |
| M136 | P3 | 42 | r4:docs-dx | CONTRIBUTING.md with WASM build prerequisites | List wasm-pack, Rust toolchain, npm steps before first run. |
| M137 | P3 | 42 | r4:theming-identity | High-contrast pro theme for bright-stage readability | Max luminance separation on note-letter, gauge, cents bar. |
| M138 | P3 | 40 | r1:review | anti-aliased decimation |  |
| M139 | P3 | 40 | r1:review | ukulele/violin/mandolin/banjo tunings |  |
| M140 | P3 | 40 | r1:review | announce listening status to SR |  |
| M141 | P3 | 40 | r1:review | redesign PerStringCents |  |
| M142 | P3 | 40 | r1:review | clean dead code dev security surface |  |
| M143 | P3 | 40 | r2:a11y-deep | Sonification mode: continuous oscillator pitch encodes cents error (beat-against-target) | Enables fully non-visual tuning for blind users. |
| M144 | P3 | 40 | r2:design-motion | OKLCH cents-deviation hue ramp as the single tuner color signal | Perceptually-uniform color signal for tuning error. |
| M145 | P3 | 40 | r2:native-os | Native macOS/Windows app menu with tuning + A4 items and shortcuts | Standard native menu affordances. |
| M146 | P3 | 40 | r2:web-apis | Web Locks to serialize AudioContext/mic across duplicate tabs | Stops two tabs fighting over the mic. |
| M147 | P3 | 40 | r2:web-apis | OffscreenCanvas + dedicated Worker for the needle/cents meter | Renders meter off the main thread for smoothness. |
| M148 | P3 | 40 | r3:i18n-breadth | Ship named language packs (ES, PT-BR, DE, FR, IT, JA, ZH-Hans, KO, HI, AR) | Concrete locale set turns generic i18n into shippable market reach. |
| M149 | P3 | 40 | r3:observability-reliability | One-click diagnostic bundle export (env + flags + recent log, no audio) | Turns vague reports into reproducible ones, privacy-safe. |
| M150 | P3 | 40 | r3:i18n-breadth | Regional default A4 preset (442/443 EU orchestral) keyed to locale | Matches local tuning conventions out of the box. |
| M151 | P3 | 40 | r4:data-viz | Cents bullseye: concentric tolerance rings with live dot | Dot homes into green center ring as pitch nears target. |
| M152 | P3 | 40 | r4:ui-micro | Bottom-sheet tuning picker on mobile with snap points | Swipe-up sheet lists tunings, half/full detents. |
| M153 | P3 | 40 | r4:ui-micro | A4 number-stepper with scroll-wheel and arrow-key nudge | Focus field, wheel/arrows adjust Hz within clamp range. |
| M154 | P3 | 40 | r4:power-user | URL query params preset tuning/A4/string state | ?tuning=dadgad&a4=442&string=3 deep-links exact state |
| M155 | P3 | 40 | r4:power-user | Tab/Shift+Tab roving focus across all controls | Logical focus order, visible focus ring everywhere |
| M156 | P3 | 40 | r4:privacy-security | Permissions explainer page detailing microphone-only no-upload usage | Static page explaining mic stays on-device, never transmitted. |
| M157 | P3 | 40 | r4:perf-bundle | manualChunks split vendor vue from app code | Vue rarely changes; long-cache vendor chunk separate from app. |
| M158 | P3 | 40 | r4:perf-bundle | Cache Spectrum bar gradient and bin-x lookup tables | Precompute bar geometry once per resize, not per frame. |
| M159 | P3 | 40 | r4:content-marketing | Public changelog page rendered from version.json | Dated release notes build trust and fresh-content signals. |
| M160 | P3 | 40 | r4:docs-dx | ADR for pitch-core as single-source DSP crate | Record why YIN+MPM live in shared Rust, not duplicated per target. |
| M161 | P3 | 40 | r4:docs-dx | JSDoc on pitch.ts and notes.ts public functions | Document frequencyToNote, cents math signatures and edge cases. |
| M162 | P3 | 38 | r1:review | stage mode large high-contrast readout |  |
| M163 | P3 | 38 | r1:review | input-device affordance/heading semantics |  |
| M164 | P3 | 38 | r2:distribution | Embeddable iframe widget (vite lib mode) + postMessage onInTune/onNote API | Distribution multiplier across third-party sites. |
| M165 | P3 | 38 | r2:design-motion | Spring-physics needle driven by a critically-damped spring integrator | Smooth needle motion without overshoot. |
| M166 | P3 | 38 | r3:platform-reach | Android app + Play listing via Tauri 2 mobile with Oboe low-latency audio | Biggest install-base expansion; Oboe keeps latency tuner-grade. |
| M167 | P3 | 38 | r3:i18n-breadth | Translation-completeness fallback chain with coverage badge | Prevents blank strings and tracks translation progress. |
| M168 | P3 | 38 | r4:data-viz | Cents sparkline mini-history under note readout | Tiny 3-second inline trace shows whether pitch is settling. |
| M169 | P3 | 38 | r4:ui-micro | Hover popover on string shows target Hz and cents | Desktop tooltip surfaces exact frequency per string. |
| M170 | P3 | 38 | r4:ui-micro | Double-tap a string to instantly select as target | Quick gesture pins manual target without dropdown. |
| M171 | P3 | 38 | r4:settings-personalization | Units toggle: cents-only vs Hz-and-cents readout | Hide Hz for beginners, show both for techs. |
| M172 | P3 | 38 | r4:privacy-security | Tauri capability allowlist audit removing unused command scopes | Minimize Tauri v2 capabilities to mic and storage only. |
| M173 | P3 | 38 | r4:perf-bundle | Low-end-device mode: halve FFT_SIZE and viz FPS | Detect deviceMemory/hardwareConcurrency, reduce 2048 buffer and redraw rate. |
| M174 | P3 | 38 | r4:content-marketing | FAQ schema JSON-LD on landing page | Rich-result eligibility for "is this tuner accurate" queries. |
| M175 | P3 | 38 | r4:docs-dx | Three-target architecture diagram in README | Mermaid graph: pitch-core feeding web, egui, Tauri. |
| M176 | P3 | 38 | r4:docs-dx | Visual-regression snapshots per CentsGauge needle angle | Lock pixel output of gauge at -50/0/+50 cents. |
| M177 | P3 | 36 | r1:review | prefers-reduced-motion handling |  |
| M178 | P3 | 36 | r1:review | capo/transpose + pitch-pipe per-string reference |  |
| M179 | P3 | 36 | r2:a11y-deep | Distinct vibration patterns: pulse-train flat, long-buzz sharp, double-tap in-tune | Eyes-free directional feedback; small code, big inclusion. |
| M180 | P3 | 36 | r2:design-motion | Modular type scale + 4px spacing tokens with fluid clamp() root | Design-system foundation for consistent layout. |
| M181 | P3 | 36 | r2:a11y-deep | RTL layout support with dir=rtl, logical properties, mirrored cents axis | Supports Arabic/Hebrew UI direction. |
| M182 | P3 | 36 | r3:platform-reach | iOS/iPadOS app via Tauri 2 mobile reusing native pitch-core | Unlocks App Store distribution and the high-value iOS music market. |
| M183 | P3 | 36 | r3:observability-reliability | Structured in-app bug-report template prefilled from local diagnostics | Standardizes incoming issues for faster triage. |
| M184 | P3 | 36 | r3:i18n-breadth | Translated tuning-preset display names with locale conventions | Completes the localized feel of the catalog. |
| M185 | P3 | 36 | r4:ui-micro | Inline-edit string note via tap-to-spin chromatic picker | Tap string label, scroll wheel to reassign note. |
| M186 | P3 | 36 | r4:ui-micro | Toast confirming tuning switch with one-tap undo | Transient toast: 'Drop D' with inline undo button. |
| M187 | P3 | 36 | r4:perf-bundle | CI bundle-size budget gate on dist JS/WASM bytes | Fail PR if main chunk or WASM exceeds set kB threshold. |
| M188 | P3 | 36 | r4:perf-bundle | OffscreenCanvas spectrum compute off main thread, fallback main | Move FFT-bin drawing to worker, free main for detection. |
| M189 | P3 | 36 | r4:docs-dx | Histoire/Storybook stories for the 10 Vue components | Isolated CentsGauge, Waveform, Spectrum states without live mic. |
| M190 | P3 | 36 | r4:docs-dx | useTuner composable lifecycle sequence diagram | Document AudioContext start, detection loop, teardown ordering. |
| M191 | P3 | 35 | r4:privacy-security | Permissions-Policy header denying camera geolocation USB except microphone | Lock down all browser features except needed microphone. |
| M192 | P4 | 34 | r1:review | Fretboard SVG keyboard accessible |  |
| M193 | P4 | 34 | r1:review | text alternatives/pressed ARIA on canvases |  |
| M194 | P4 | 34 | r2:native-os | Always-on-top frameless mini-overlay with click-through when in-tune | Compact stage/DAW companion; high desktop value. |
| M195 | P4 | 34 | r2:analytics | Per-session tuning-stability score (0-100 from post-lock cents RMS) | Headline practice metric users can track over time. |
| M196 | P4 | 34 | r2:design-motion | CSS container queries on the tuner panel instead of viewport media queries | Correct responsiveness when embedded at any width. |
| M197 | P4 | 34 | r2:native-os | Global hotkey nudge-to-next-string in guided tuning | Hands-light stepping during a guided pass. |
| M198 | P4 | 34 | r2:native-os | Tray submenu to switch tuning preset and A4 without opening window | Quick config from the system tray. |
| M199 | P4 | 34 | r2:a11y-deep | Captions track: on-screen text for every audio cue | Deaf-accessible labeling of sounds. |
| M200 | P4 | 34 | r2:a11y-deep | Screen-magnifier Huge Mode with rem-scaled layout and follow-focus reflow | Low-vision large-layout mode. |
| M201 | P4 | 34 | r2:instruments-notation | German note-naming (H/B) and Helmholtz/scientific octave toggle | Regional notation convention support. |
| M202 | P4 | 34 | r3:observability-reliability | Opt-in privacy-first crash reporter writing a local JSON trace file | Captures real failures without breaking the zero-network guarantee. |
| M203 | P4 | 34 | r3:ai-ml-features | On-device 'What tuning is this?' auto-detect from a single open strum | Signature local-ML feature that differentiates from every basic tuner. |
| M204 | P4 | 34 | r3:education-content | Lefty mode mirroring the fretboard and string order | Inclusivity win for left-handed players at low cost. |
| M205 | P4 | 34 | r3:observability-reliability | Local feature-flag panel persisted to localStorage / config file | Enables safe staged rollout and field debugging. |
| M206 | P4 | 34 | r3:i18n-breadth | Localized PWA manifest name/description/shortcuts per language | Native-feeling install metadata per locale. |
| M207 | P4 | 34 | r3:brand-microinteractions | Per-string accent identity: each open string owns a fixed brand hue | Consistent visual language across every view. |
| M208 | P3 | 34 | r4:ui-micro | Long-press a string opens reference-tone sustain menu | Hold string to ring sustained pitch, release stops. |
| M209 | P3 | 34 | r4:ui-micro | Command palette (Cmd/Ctrl-K) for tunings and settings | Fuzzy-search tunings, A4 presets, modes from one input. |
| M210 | P3 | 34 | r4:ui-micro | Drag A4 horizontal slider with magnetic 440 detent | Slider snaps softly at 440 within fine drag range. |
| M211 | P3 | 34 | r4:power-user | Spacebar toggles listening start/stop | Single most-used action on most accessible key |
| M212 | P3 | 34 | r4:settings-personalization | Per-tuning default A4 override | DADGAD remembers 442, standard stays 440 automatically. |
| M213 | P4 | 34 | r4:privacy-security | CSP report-only header then enforce wasm-unsafe-eval default-src self | Stage report-only, collect violations, then enforce strict policy. |
| M214 | P4 | 34 | r4:perf-bundle | Frame-time budget guard skipping detection when over 16ms | tick() drops a YIN pass on slow frames to hold 60fps. |
| M215 | P4 | 34 | r4:offline-storage | IndexedDB tuning store replacing localStorage for packs | Move custom tunings/packs from localStorage to structured IndexedDB store. |
| M216 | P4 | 34 | r4:content-marketing | "Standard tuning notes EADGBE" cornerstone SEO page | Targets the single highest-volume beginner guitar query. |
| M217 | P4 | 34 | r4:docs-dx | ADR for Vite base '/tuner/' subpath constraint | Document base-path coupling so contributors stop breaking asset URLs. |
| M218 | P4 | 34 | r4:docs-dx | Pull request template with target-checklist | Boxes for web/egui/Tauri tested and tuning-table parity. |
| M219 | P4 | 34 | r4:docs-dx | ADR for keeping note math in two languages | Explain Rust-TS duplication tradeoff vs single WASM source. |
| M220 | P4 | 34 | r4:theming-identity | OLED true-black theme with pure #000 surfaces | Saves AMOLED power; cards become #000, borders dim gray. |
| M221 | P4 | 34 | r4:theming-identity | Animated tuning-fork logo with listening/locked states | Tine vibrates while listening, settles when in tune. |
| M222 | P4 | 33 | r1:review | footer contrast |  |
| M223 | P4 | 33 | r1:review | subtitle contrast |  |
| M224 | P4 | 33 | r2:native-os | Single-instance guard that forwards CLI args to the running window | Prevents duplicate windows/mic contention; foundational desktop UX. |
| M225 | P4 | 33 | r3:community-social | Curated static community tuning-pack gallery shipped in /public, offline | Content depth with zero backend; high value for low effort. |
| M226 | P4 | 33 | r4:ui-micro | Undo/redo stack for tuning and A4 changes | Ctrl-Z reverts last tuning/A4/string edit; redo forward. |
| M227 | P4 | 33 | r4:privacy-security | CI no-third-party-requests test blocking external fetch/connect | Playwright fails build if any non-self network request fires. |
| M228 | P4 | 32 | r1:review | light theme toggle |  |
| M229 | P4 | 32 | r2:a11y-deep | Voice-control-friendly target names like 'tune string E2' | Reliable Voice Control/Dragon targeting. |
| M230 | P4 | 32 | r2:workflows | Oboe-A / tuning-fork reference-listen mode that locks to the heard pitch | Match the ensemble's actual sounded A. |
| M231 | P4 | 32 | r3:education-content | Fretboard-note quiz overlaying the existing Fretboard SVG | Reuses shipped SVG to add sticky learning value cheaply. |
| M232 | P4 | 32 | r4:settings-personalization | Remember-last-string per tuning | Reopen on the string you last tuned in that tuning. |
| M233 | P4 | 32 | r4:offline-storage | Full backup export to single .tunerbackup JSON file | Bundle tunings, A4, settings, stats into one downloadable file. |
| M234 | P4 | 32 | r4:theming-identity | Illustrated empty-state art for idle/no-signal | SVG sleeping headstock replaces bare idle text states. |
| M235 | P4 | 30 | r1:review | strobe tuner mode |  |
| M236 | P4 | 30 | r2:native-os | NSStatusItem live cents micro-meter with colored attributed string in menu bar | Glanceable tuning without window focus on macOS. |
| M237 | P4 | 30 | r2:native-os | Follow-OS-theme via window theme events feeding web/egui palette | Auto light/dark matching the OS. |
| M238 | P4 | 30 | r2:native-os | Native 'in tune, hold it' notification with throttling | Background confirmation without window focus. |
| M239 | P4 | 30 | r2:web-apis | WebGPU strobe/phase visualizer with WebGL2 fallback | GPU strobe disc; ambitious visual flourish. |
| M240 | P4 | 30 | r2:a11y-deep | Stereo-pan + pitch-glide sonification encoding sharp/flat direction | Directional audio cue beyond single-tone beat. |
| M241 | P4 | 30 | r2:a11y-deep | Dyslexia-friendly font option (OpenDyslexic/Atkinson) with spacing | Readability aid; small toggle. |
| M242 | P4 | 30 | r2:analytics | Personal in-tune tolerance auto-calibration | Adapts threshold to the user's steadiness. |
| M243 | P4 | 30 | r2:distribution | OBS/Twitch browser-source overlay mode (?overlay=1) transparent compact needle | Streamer overlay reusing one query flag. |
| M244 | P4 | 30 | r3:education-content | "Tune for this song" preset library with capo + tuning per track | High user-pull feature that drives repeat use and shareable content. |
| M245 | P4 | 30 | r3:brand-microinteractions | Tuning-fork wordmark with the dotted 'i' as a vibrating tine | Establishes a memorable visual identity the brand currently lacks. |
| M246 | P4 | 30 | r3:i18n-breadth | Per-language pre-rendered landing pages (/tuner/es/, /tuner/de/) with hreflang | Multiplies organic SEO reach across non-English search markets. |
| M247 | P4 | 30 | r3:platform-reach | Linux Flatpak on Flathub with PipeWire/portal mic permission | Primary Linux distribution channel with correct mic permissions. |
| M248 | P4 | 30 | r3:observability-reliability | Tuning-pack import/export round-trip self-test in CI | Guarantees bandpack compatibility across versions. |
| M249 | P4 | 30 | r3:i18n-breadth | ICU MessageFormat plural/gender handling for count strings | Grammatically correct counts across languages. |
| M250 | P4 | 30 | r3:monetization | Ko-fi / Buy Me a Coffee one-tap tip jar | Frictionless small-tip path; complements Sponsors. |
| M251 | P4 | 30 | r4:bowed-strings | Baroque vs modern A4 quick-toggle 415/430/440 | One-tap historical pitch standards instead of slider hunting. |
| M252 | P4 | 30 | r4:data-viz | Cents waterfall: scrolling per-frame deviation history band | Vertical scroll of cents-colored rows shows pluck decay drift. |
| M253 | P4 | 30 | r4:ui-micro | Right-click string context menu: set reference, mute, edit | Desktop context menu per string row with actions. |
| M254 | P4 | 30 | r4:ui-micro | Long-press A4 value resets to 440 with confirm | Hold value, ripple confirms snap back to standard. |
| M255 | P4 | 30 | r4:ui-micro | Keyboard string navigation with up/down and Enter select | Arrow through strings, Enter sets manual target. |
| M256 | P4 | 30 | r4:power-user | Number-key direct string selection 1-6 | Press digit to target that string immediately |
| M257 | P4 | 30 | r4:power-user | Scriptable JSON config import/export file | Declarative file defines hotkeys, tunings, defaults |
| M258 | P4 | 30 | r4:settings-personalization | Quarantine unknown keys on import, never silently drop | Preserve forward-compat keys from newer app versions. |
| M259 | P4 | 30 | r4:privacy-security | Subresource Integrity hashes on WASM and JS bundles | Vite plugin emits SRI digests; tamper-proof /tuner/ asset loads. |
| M260 | P4 | 30 | r4:perf-bundle | Inline critical CSS, defer rest to cut first paint | Extract above-fold tuner styles, async-load remainder. |
| M261 | P4 | 30 | r4:perf-bundle | requestIdleCallback-defer settings/practice code past mic start | Tuner core mounts first; defer TunerControls heavy logic. |
| M262 | P4 | 30 | r4:offline-storage | Deferred beforeinstallprompt with contextual re-surface timing | Stash event, show install CTA after second successful tune. |
| M263 | P4 | 30 | r4:content-marketing | Per-tuning explainer article set: Drop D, DADGAD, Open G | One deep page per tuning with notes, songs, history. |
| M264 | P4 | 30 | r4:content-marketing | Tuning frequency reference table page (Hz per string) | Snippet-bait table for 82.41Hz E2 etc. queries. |
| M265 | P4 | 30 | r4:content-marketing | Reddit r/Guitar launch + AMA-style demo thread | Privacy/offline angle resonates with that community. |
| M266 | P4 | 30 | r4:docs-dx | Issue template for new tuning-preset submissions | Structured form: strings, frequencies, source citation. |
| M267 | P4 | 30 | r4:docs-dx | l10n contributor guide for adding string keys | Document l10n.ts structure and RU/EN key parity rules. |
| M268 | P4 | 28 | r1:review | surface color tokens remove unused palette |  |
| M269 | P4 | 28 | r1:review | viz start/stop transitions |  |
| M270 | P4 | 28 | r2:distribution | Chrome/Firefox MV3 toolbar extension opening WASM tuner in 360px popup | New surface reusing existing pitch-core build. |
| M271 | P4 | 28 | r2:analytics | Per-string accuracy heatmap across the 6 string targets | Cheap visualization surfacing weak strings. |
| M272 | P4 | 28 | r2:native-os | Global push-to-tune hotkey that summons overlay only while held | On-demand overlay for live performance. |
| M273 | P4 | 28 | r2:web-apis | navigator.storage.persist() + estimate() to mark packs non-evictable, warn on low quota | Protects saved tunings from eviction. |
| M274 | P4 | 28 | r3:community-social | User-submitted tuning presets via GitHub PR with JSON schema + CI validation | Crowdsources the catalog safely; classic OSS growth loop. |
| M275 | P4 | 28 | r3:brand-microinteractions | Swappable needle skins: Strobe Disc, Analog VU, Laser Line, Vintage Plate | Personalization driver and a natural Pro-tier upsell candidate. |
| M276 | P4 | 28 | r3:platform-reach | Windows Store MSIX package with packaged-app mic capability | Clean Windows install and store discovery with proper capabilities. |
| M277 | P4 | 28 | r3:education-content | Genre/artist-themed tuning collections as grouped catalog sections | Improves discoverability of the existing tuning catalog. |
| M278 | P4 | 28 | r3:i18n-breadth | Arabic RTL needle/cents with mirrored layout but LTR pitch axis | Correct bidi handling so the meter stays physically meaningful. |
| M279 | P4 | 28 | r3:monetization | GitHub Sponsors tier ladder with in-app 'Sponsor' footer link | Low-effort recurring support channel for an OSS project. |
| M280 | P4 | 28 | r3:brand-microinteractions | Idle 'breathing' needle animation when no signal is present | Signals the app is alive and listening; cheap polish. |
| M281 | P4 | 28 | r4:live-deep | Single-string isolation: lock detection to one target | Ignore other strings when tech tunes one string fast. |
| M282 | P4 | 28 | r4:ui-micro | Segmented control for detection mode guitar/chromatic/strobe | Sliding pill toggle replaces dropdown for modes. |
| M283 | P4 | 28 | r4:settings-personalization | Export full config as downloadable tuner.json | Serialize all keys including custom tunings to one file. |
| M284 | P4 | 28 | r4:privacy-security | Cross-Origin-Isolation COOP COEP headers for hardened context | Enable crossOriginIsolated, gate future SharedArrayBuffer DSP safely. |
| M285 | P4 | 28 | r4:content-marketing | Comparison page: Tuner vs GuitarTuna/Fender Tune | Privacy/offline/free angle captures branded comparison search. |
| M286 | P4 | 28 | r4:docs-dx | Design-token reference page from Tailwind config | Auto-render color/spacing tokens used across components. |
| M287 | P4 | 28 | r4:theming-identity | Gauge face skins: arc, linear bar, half-circle dial | Pluggable CentsGauge rendering bound to one theme choice. |
| M288 | P4 | 26 | r2:analytics | Blind-tuning self-test (hide cents, score the guess) | Ear-training metric distinct from games already shipped. |
| M289 | P4 | 26 | r2:native-os | tuner:// protocol handler opening a specific tuning + A4 preset | Deep-launch into a configured state from links. |
| M290 | P4 | 26 | r2:web-apis | Web MIDI input tuning mode: cents deviation of MIDI note-on vs A4 | Tune from a connected keyboard/controller. |
| M291 | P4 | 26 | r3:brand-microinteractions | Signature in-tune chime voiced from the current tuning's open strings | Audio branding moment that reinforces success feedback. |
| M292 | P4 | 26 | r3:i18n-breadth | Locale-correct font stack for CJK/Arabic/Devanagari with subset fonts | Without this the language packs render as tofu; gating dependency. |
| M293 | P4 | 26 | r3:brand-microinteractions | User color-theme creator: 2-color seed generates the full dark palette | Strong personalization but needs a robust palette-generation engine. |
| M294 | P4 | 26 | r3:platform-reach | macOS App Store (MAS) sandboxed distribution channel | Sandboxed channel that pairs with paid IAP on macOS. |
| M295 | P4 | 26 | r3:community-social | In-app 'Suggest a tuning' button prefilling a GitHub issue/PR body | Lowers the contribution barrier for the PR-based catalog. |
| M296 | P4 | 26 | r3:brand-microinteractions | In-tune celebration micro-burst: subtle particle bloom on lock | Delightful reward moment reinforcing success. |
| M297 | P4 | 26 | r4:bowed-strings | Cello C-string low-end detection range extension | Reliable f0 down to bass C1 32.7 Hz. |
| M298 | P4 | 26 | r4:ui-micro | Inline toast queue stacking with auto-dismiss timers | Multiple notifications stack, oldest expires first. |
| M299 | P4 | 26 | r4:power-user | Quick-switch tuning palette (Ctrl+K command bar) | Fuzzy-search overlay to jump to any tuning instantly |
| M300 | P4 | 26 | r4:power-user | Hold-to-sound reference tone while key down | Momentary tone playback released on keyup |
| M301 | P4 | 26 | r4:settings-personalization | Import config JSON with validation and diff preview | Validate against schema, show what changes before applying. |
| M302 | P4 | 26 | r4:settings-personalization | Advanced vs Simple settings disclosure split | Hide gate/tolerance/range behind an Advanced toggle. |
| M303 | P4 | 26 | r4:content-marketing | Glossary pages: cents, A4, harmonics, intonation | Long-tail definitional pages internally linking to tuner. |
| M304 | P4 | 26 | r4:content-marketing | "Best A4 reference: 440 vs 432 vs 442" debate article | Controversial topic drives shares and backlinks. |
| M305 | P4 | 26 | r4:notifications-engagement | New-feature announcement modal keyed to version.json | Show once per build SHA; dismiss persists in localStorage. |
| M306 | P4 | 24 | r1:review | TuningSelector redundant label |  |
| M307 | P4 | 24 | r1:review | metronome tap-tempo accent |  |
| M308 | P4 | 24 | r2:distribution | GitHub Action auto-generating animated demo GIF via headless Chromium + synthetic audio | Keeps README/store demo fresh automatically. |
| M309 | P4 | 24 | r2:workflows | Pre-take tuning gate with pass/fail threshold for the engineer | Blocks recording until in-tune; high studio value, low effort. |
| M310 | P4 | 24 | r2:analytics | Time-to-in-tune metric per string and per session | Quantifies tuning speed improvement over time. |
| M311 | P4 | 24 | r2:web-apis | File System Access .tunerpack save/open with persistent FileSystemFileHandle | Edit-in-place tuning packs on the web. |
| M312 | P4 | 24 | r2:analytics | First-attempt overshoot detector (sharp/flat bias profile) | Reveals systematic tuning bias. |
| M313 | P4 | 24 | r3:pro-audio-ecosystem | VST3 + AU bundle via nih-plug reusing pitch-core unchanged | Largest reach multiplier for the existing engine into producer workflows. |
| M314 | P4 | 24 | r3:education-content | Scale-practice mode detecting each played degree against a chosen scale | Extends the detector into practice tooling without new DSP. |
| M315 | P4 | 24 | r3:education-content | Chord-library cross-reference keyed to the current tuning | Very useful for alt tunings; large content and correctness burden. |
| M316 | P4 | 24 | r3:platform-reach | ChromeOS-optimized installable PWA with tablet/clamshell mic handling | Captures the large education Chromebook base cheaply. |
| M317 | P4 | 24 | r3:education-content | Open-string note-name recognition trainer (E-A-D-G-B-e flashcards) | Cheap beginner drill that reinforces fundamentals. |
| M318 | P4 | 24 | r3:community-social | Localized community-translations credit page + i18n CONTRIBUTING guide | Motivates and structures translator contributions. |
| M319 | P4 | 24 | r4:bowed-strings | Bowed-string preset bank GDAE/CGDA/CGDA-bass tunings | Violin, viola, cello, 4/5-string bass standard fifths sets. |
| M320 | P4 | 24 | r4:live-deep | Loud-stage noise-aware confidence floor | Adapt gating thresholds for ambient stage roar between songs. |
| M321 | P4 | 24 | r4:data-viz | Beat-frequency envelope meter vs reference tone | Pulsing amplitude bar; beat rate slows to zero at unison. |
| M322 | P4 | 24 | r4:ui-micro | Drag-reorder strings to reverse for left-handed display | Vertical drag handle reorders string list, persists. |
| M323 | P4 | 24 | r4:power-user | Keyboard cheat-sheet overlay bound to '?' | Modal listing all active shortcuts contextually |
| M324 | P4 | 24 | r4:settings-personalization | Named setting presets (Studio, Live, Practice) | Save full settings snapshot under a name, switch instantly. |
| M325 | P4 | 24 | r4:settings-personalization | Reset-to-defaults scoped per settings section | Reset only visualizers or only detection, not everything. |
| M326 | P4 | 24 | r4:settings-personalization | Cloud-free settings sync via shareable text blob | Base64 paste-string moves config between browser and native. |
| M327 | P4 | 24 | r4:privacy-security | Dependency pinning by integrity hash plus lockfile-lint gate | lockfile-lint enforces https resolved URLs and integrity present. |
| M328 | P4 | 24 | r4:offline-storage | Versioned IndexedDB schema with onupgradeneeded migration ladder | Sequential migration functions per schema version, idempotent and tested. |
| M329 | P4 | 24 | r4:content-marketing | "Why does my guitar go out of tune" troubleshooting article | High-intent maintenance query with strong app CTA. |
| M330 | P4 | 24 | r4:content-marketing | YouTube short: 30-second offline-tuner demo | Visual proof of accuracy for social distribution. |
| M331 | P4 | 24 | r4:content-marketing | breadcrumb + Article schema on all explainer pages | Structured data lifts SERP presentation site-wide. |
| M332 | P4 | 24 | r4:docs-dx | commitlint config rejecting type: prefixes | Enforce the repo's no-conventional-prefix subject convention in CI. |
| M333 | P4 | 24 | r4:theming-identity | Vintage analog-meter skin with cream face and amber lamp | Skeuomorphic needle, ticks, glow for the gauge component. |
| M334 | P4 | 22 | r1:review | normalize corner radii |  |
| M335 | P4 | 22 | r2:workflows | Setlist-bound multi-guitar profiles with one-tap silent-stage switch | Targets gigging players changing tunings between songs. |
| M336 | P4 | 22 | r2:workflows | Studio tuning log: timestamped take/tuning entries per session | Engineer-facing record of tuning at each take. |
| M337 | P4 | 22 | r2:analytics | Drift-after-tuning timeline per string (settle curve overlay) | Shows new-string settle behavior visually. |
| M338 | P4 | 22 | r2:web-apis | Media Session now-playing surface for active tuning with prev/next-string actions | Lock-screen/headset string stepping. |
| M339 | P4 | 22 | r2:web-apis | SpeechRecognition voice commands: 'next string','low E','play A','stop' | Fully hands-free web operation. |
| M340 | P4 | 22 | r3:education-content | "Your first 4 chords" guided lesson path using the detector | Onboards absolute beginners; content-heavy to do well. |
| M341 | P4 | 22 | r3:hardware-peripherals | Guitar-with-USB direct-input device profile with auto channel selection | Smooths setup for USB-equipped guitars and interfaces. |
| M342 | P4 | 22 | r3:community-social | Contributor wall generated at build time from git history (Credits page) | Recognition fuels OSS contribution; fully automated. |
| M343 | P4 | 22 | r3:ai-ml-features | Ship on-device models as versioned WASM/ONNX with cache + integrity check | Infra prerequisite for any shipped local-ML feature. |
| M344 | P4 | 22 | r4:bowed-strings | Per-string fifths-check mode for violin/viola/cello/bass | Tune adjacent strings as pure 3:2 fifths, beat-rate readout. |
| M345 | P4 | 22 | r4:live-deep | Drop-tune delta: cents-to-detune for low string | Show how far to slacken E to D for next song. |
| M346 | P4 | 22 | r4:data-viz | Lissajous phase figure: mic signal vs reference sine | Rotating ellipse freezes still when string matches reference frequency. |
| M347 | P4 | 22 | r4:ui-micro | Two-finger swipe-down dismisses settings sidebar mobile | Gesture closes panel matching native sheet feel. |
| M348 | P4 | 22 | r4:power-user | egui native global keymap mirroring web bindings | Shared keymap JSON consumed by egui input handler |
| M349 | P4 | 22 | r4:settings-personalization | Settings dirty-state and discard-changes guard | Warn before nav if unsaved manual edits exist. |
| M350 | P4 | 22 | r4:settings-personalization | Default-startup-view setting (tuner/ear-trainer) | Choose which mode opens on launch. |
| M351 | P4 | 22 | r4:offline-storage | storage.persisted() request gated on engagement signal | Request persistent storage after user saves first custom tuning. |
| M352 | P4 | 22 | r4:content-marketing | Tutorial series: tune by ear without a tuner | 5th-fret method article funnels to app as backup. |
| M353 | P4 | 22 | r4:content-marketing | "Drop D vs Drop C vs Drop B" comparison cluster | Metal-genre tuning cluster captures niche long-tail. |
| M354 | P4 | 22 | r4:theming-identity | Custom accent picker from a color wheel | Replace fixed #22c55e green across buttons, gauge, strings. |
| M355 | P4 | 22 | r4:theming-identity | Curated built-in theme gallery picker in settings | Thumbnail grid of bundled themes with live preview swatch. |
| M356 | P4 | 22 | r4:notifications-engagement | Notification permission soft-ask after first session | Explain value before triggering OS permission prompt. |
| M357 | P4 | 20 | r2:distribution | App Store / Play Store listing asset kit generator from a single template | Automates icon/screenshots/ASO copy for store launch. |
| M358 | P4 | 20 | r2:native-os | File association for .gtuning custom-tuning files with open-with import | Double-click import of shared tunings. |
| M359 | P4 | 20 | r2:workflows | Session export of tuning log to CSV for studio/teacher records | Portable records from the log. |
| M360 | P4 | 20 | r3:community-social | Exportable .bandpack: signed bundle of tunings + A4 + per-string references | Solves real band-coordination pain and seeds a sharing format. |
| M361 | P4 | 20 | r3:platform-reach | Android Quick Settings tile + iOS Control Center/Lock Screen launcher | One-tap access drives habitual use on mobile. |
| M362 | P4 | 20 | r3:hardware-peripherals | Clip-on contact piezo input profile with vibration-pickup auto-detect | Better noisy-stage tuning for the common clip-on use case. |
| M363 | P4 | 20 | r3:education-content | Interval ear-training between two played strings | Useful musicianship feature reusing detection; not a game per se. |
| M364 | P4 | 20 | r3:education-content | Note-on-staff reader linking each open string to standard notation | Connects tuning to notation literacy for learners. |
| M365 | P4 | 20 | r3:ai-ml-features | Local capo/partial-capo detector from open-string set vs chosen tuning | Auto-transposes targets; reuses existing detection output. |
| M366 | P4 | 20 | r4:bowed-strings | Double-bass fourths tuning EADG preset | Orchestral bass tunes in fourths, not fifths; distinct table. |
| M367 | P4 | 20 | r4:bowed-strings | Bow-noise tolerant gating for sustained bowed tone | Stable readout despite scratchy attack and bow changes. |
| M368 | P4 | 20 | r4:kids-gamify | Kids mode toggle: oversized 56px+ string buttons | Big touch targets, fewer controls, hides advanced panels |
| M369 | P4 | 20 | r4:data-viz | Polar pitch wheel with 12 semitone spokes | Detected note as rotating arm; cents push off-spoke radially. |
| M370 | P4 | 20 | r4:data-viz | Pitch trajectory comet: fading trail of recent f0 | Comet tail shows attack glide direction toward target line. |
| M371 | P4 | 20 | r4:power-user | Focus mode hiding all chrome (key 'f') | Hide header/footer/sidebar, show only needle |
| M372 | P4 | 20 | r4:power-user | Hotkey to cycle reference-tone through all strings | Bracket keys step pitch-pipe up/down strings |
| M373 | P4 | 20 | r4:settings-personalization | Per-string custom in-tune tolerance overrides | Tighter band on high E, looser on low E. |
| M374 | P4 | 20 | r4:privacy-security | Static asset hash manifest verified against version.json at load | Runtime checks served bundle hashes match signed manifest. |
| M375 | P4 | 20 | r4:offline-storage | Backup schema-version field with forward-compat import guard | Reject or migrate older/newer .tunerbackup versions with clear message. |
| M376 | P4 | 20 | r4:content-marketing | Press/media kit page: logo, screenshots, copy blurbs | Lowers friction for bloggers and reviewers to feature. |
| M377 | P4 | 20 | r4:content-marketing | Song-to-tuning index page (capo + tuning per song) | Curated static map of popular songs to their tunings. |
| M378 | P4 | 20 | r4:theming-identity | Live theme preview before applying in picker | Hover a theme tile to temporarily recolor the tuner. |
| M379 | P4 | 20 | r4:notifications-engagement | Tauri tray scheduled daily practice reminder | Native OS notification at user-set hour via tauri-plugin-notification. |
| M380 | P4 | 20 | r4:business-ops-deep | Canary channel toggle pulling versioned WASM from /tuner/canary/ | Opt-in users get prerelease builds before stable promotion. |
| M381 | P4 | 18 | r2:instruments-notation | Per-tuning notation-system binding so world presets auto-select naming scheme | Right notation appears automatically with preset. |
| M382 | P4 | 18 | r2:workflows | Capo-aware shared key for the band: announce capo + sounding key | Aligns capoed players on a key. |
| M383 | P4 | 18 | r2:analytics | Practice streak + calendar heatmap (GitHub-style) | Habit motivation via streak grid. |
| M384 | P4 | 18 | r3:pro-audio-ecosystem | CLAP-format tuner plugin sharing pitch-core as DSP backend | Modern open plugin format; pairs naturally with the VST3/AU build. |
| M385 | P4 | 18 | r3:hardware-peripherals | USB-HID footswitch mapping for hands-free next-string stepping | High value for live performers; modest native-app effort. |
| M386 | P4 | 18 | r3:ai-ml-features | Auto-tab a short monophonic riff into ASCII tablature, fully on-device | Standout local feature, but scope and accuracy risk are large. |
| M387 | P4 | 18 | r3:education-content | Printable tuning + chord-chart practice sheet PDF generator | Tangible takeaway for teachers and students. |
| M388 | P4 | 18 | r3:ai-ml-features | On-device practice-session auto-summary from the local drift timeline | Gives end-of-session value from already-logged data. |
| M389 | P4 | 18 | r3:monetization | Affiliate gear links: contextual string/capo/pickup recommendations | Passive revenue tied to relevant moments; keep tasteful. |
| M390 | P4 | 18 | r4:bowed-strings | Fine-tuner vs peg guidance by cents magnitude | Coarse error says peg, small error says fine-tuner. |
| M391 | P4 | 18 | r4:plucked-world | Course-aware Tuning model for paired-string instruments | Add course grouping so bouzouki/laud/mandola octave pairs map correctly. |
| M392 | P4 | 18 | r4:wind-brass | Long-tone intonation-hold scoring with drift graph | Score steadiness over a sustained note, plot cents over seconds. |
| M393 | P4 | 18 | r4:live-deep | Stage-blackout one-hand mode: giant edge tap zones | Full-screen left/right halves advance string, no precise targets. |
| M394 | P4 | 18 | r4:data-viz | Six-string radial gauge cluster, hexagon arrangement | All EADGBE mini needles at once for whole-guitar glance. |
| M395 | P4 | 18 | r4:data-viz | Confidence ribbon overlaid on cents trace | Trace thickness or opacity encodes detection confidence per frame. |
| M396 | P4 | 18 | r4:ui-micro | Radial long-press menu around string: tone, edit, octave | Hold spawns arc of actions under finger. |
| M397 | P4 | 18 | r4:settings-personalization | Per-device input profiles keyed by deviceId label | Auto-load A4/tolerance/gate when a known mic reconnects. |
| M398 | P4 | 18 | r4:privacy-security | CycloneDX SBOM generation for npm and Cargo dependencies | Emit signed SBOM artifact per release for npm and crates. |
| M399 | P4 | 18 | r4:perf-bundle | Subset Tailwind font stack, drop unused system-ui fallbacks | No custom font loaded; trim CSS and preconnect nothing. |
| M400 | P4 | 18 | r4:offline-storage | Backup restore with dry-run diff preview | Show added/changed/removed entries before committing restore. |
| M401 | P4 | 18 | r4:integrations-music | Read tuning from imported Guitar Pro .gp/.gpx file | Parse .gp track header, auto-select matching 6-string tuning. |
| M402 | P4 | 18 | r4:content-marketing | "How to tune a 12-string guitar" long-form guide | Octave-pair tuning is a high-intent unanswered query. |
| M403 | P4 | 18 | r4:content-marketing | Embeddable "Tuned with" badge for guitar blogs | Backlink-generating HTML snippet pointing to /tuner/. |
| M404 | P4 | 18 | r4:content-marketing | Social share-card SVG templates per tuning result | Brandable images for Reddit/forum tuning posts. |
| M405 | P4 | 18 | r4:docs-dx | iframe widget embed API reference page | Document postMessage events, allowed attributes, sizing contract. |
| M406 | P4 | 18 | r4:docs-dx | Copy-paste iframe embed snippet generator page | Interactive form emitting ready iframe HTML for sites. |
| M407 | P4 | 18 | r4:theming-identity | Sepia warm low-blue-light reading variant | Amber-tinted surfaces for late-night practice eye comfort. |
| M408 | P4 | 18 | r4:business-ops-deep | Donation thermometer SVG fed by static goals.json | Server-maintained JSON renders raised-vs-goal bar, no tracking. |
| M409 | P4 | 16 | r2:workflows | Concert-A broadcast: one device sets reference pitch for the whole ensemble | Solves real orchestra/band reference-pitch coordination. |
| M410 | P4 | 16 | r2:workflows | Teacher push-a-target mode: instructor sets note, student screen mirrors | Remote-lesson tuning sync; strong teaching hook. |
| M411 | P4 | 16 | r2:web-apis | Gamepad API foot-controller stepping to advance strings/toggle reference hands-free | Hands-free control for performers. |
| M412 | P4 | 16 | r2:workflows | Luthier string-change log with brand/gauge and settle-in tracking | Records string history for setup work. |
| M413 | P4 | 16 | r3:pro-audio-ecosystem | AUv3 app-extension inside a thin iOS host wrapper | Lets iOS DAW users tune inline; depends on the iOS build landing first. |
| M414 | P4 | 16 | r3:community-social | Local family/band profiles (avatar + name) in IndexedDB, header-switchable | Personalizes multi-user devices without any account system. |
| M415 | P4 | 16 | r3:ai-ml-features | Smart string-change reminder from accumulated post-tuning drift trend | Turns drift history into a useful maintenance nudge. |
| M416 | P4 | 16 | r3:ai-ml-features | On-device model-card + provenance page (no phone-home guarantee) | Builds trust for local-ML features; reinforces privacy brand. |
| M417 | P4 | 16 | r4:wind-brass | Difference-tone / beat-rate visualizer against reference drone | Show beating against sustained reference for unison wind tuning. |
| M418 | P4 | 16 | r4:vocal-training | Sustained-note steadiness meter (cents standard deviation) | Live wobble gauge from rolling f0 variance during one held note. |
| M419 | P4 | 16 | r4:kids-gamify | Reward chime built from the open-string chord | Reuse sine engine to play a happy arpeggio on success |
| M420 | P4 | 16 | r4:data-viz | Harmonic stack ladder: partial deviations vs ideal integers | Visualizes string inharmonicity as drift up the overtone ladder. |
| M421 | P4 | 16 | r4:power-user | Command palette recent/favorites ordering | Surface last-used tunings first in Ctrl+K list |
| M422 | P4 | 16 | r4:settings-personalization | Settings JSON schema doc generated from TS types | Single source describes every key for import validators. |
| M423 | P4 | 16 | r4:privacy-security | CI fail on disallowed WASM imports outside known namespace | wasm-objdump asserts only env/webaudio imports, no surprise host calls. |
| M424 | P4 | 16 | r4:perf-bundle | Merge favicon.svg + icons.svg into one symbol sprite | Two SVGs (14KB) become one cached <use> sprite request. |
| M425 | P4 | 16 | r4:theming-identity | Per-instrument auto-theme keyed to selected tuning | Acoustic warm-wood vs metal cold-steel palette per preset. |
| M426 | P4 | 16 | r4:theming-identity | Themeable needle/pointer SVG asset packs | CentsGauge pointer loads from skin set: blade, dial, dot. |
| M427 | P4 | 16 | r4:theming-identity | Theme import/export as single shareable JSON file | Tokens serialized to .gtheme for swap without a server. |
| M428 | P4 | 16 | r4:theming-identity | Per-string accent ramp themeable as a gradient set | Six string hues derive from one editable base ramp. |
| M429 | P4 | 16 | r4:notifications-engagement | egui native reminder via notify-rust desktop toast | Standalone egui app schedules its own OS notification. |
| M430 | P4 | 16 | r4:business-ops-deep | In-app roadmap voting via GitHub Discussions reactions embed | Read-only fetch of reaction counts, vote opens GitHub. |
| M431 | P4 | 16 | r4:business-ops-deep | Help-desk widget linking to canned offline troubleshooting answers | Bundled FAQ, deep-links to email with diagnostics prefilled. |
| M432 | P4 | 15 | r4:data-viz | Chromagram: 12-bin pitch-class energy bar ring | Folds spectrum into pitch classes; confirms fundamental over harmonics. |
| M433 | P4 | 15 | r4:data-viz | Cents histogram building live during a hold | Bars accumulate; symmetric narrow peak means stable in-tune hold. |
| M434 | P4 | 15 | r4:privacy-security | egui native config file written with 0600 restrictive permissions | Chmod app-data tuning config so other users cannot read. |
| M435 | P4 | 15 | r4:integrations-music | Drop-link bar: paste any tab URL, extract tuning | Unified parser dispatching to Songsterr/UG/GP by host. |
| M436 | P4 | 14 | r2:instruments-notation | Sargam note-naming (Sa Re Ga Ma Pa Dha Ni) with movable Sa | Core Indian-classical notation; unlocks that audience. |
| M437 | P4 | 14 | r3:hardware-peripherals | Serial/JSON local control protocol as the integration contract for peripherals | Foundation enabling every footswitch/LED/Stream Deck peripheral cleanly. |
| M438 | P4 | 14 | r3:hardware-peripherals | Elgato Stream Deck plugin: tuning-select, A4-nudge, live cents on keys | Reaches the streamer/creator niche; depends on the control protocol. |
| M439 | P4 | 14 | r3:hardware-peripherals | USB MIDI-controller knob/pad mapping (input only) for tuning and A4 | Reuses MIDI-input infra for hands-free hardware control. |
| M440 | P4 | 14 | r4:bowed-strings | Natural-harmonic target mode (5th/4th nodes) | Tune by lightly-touched harmonics, expected pitch shown. |
| M441 | P4 | 14 | r4:studio-deep | Per-string offset profile saved as session tuning preset | Snapshot exact measured cents per string, recall next day. |
| M442 | P4 | 14 | r4:live-deep | Silent between-song mode: vibrate-only, screen dimmed | No audio reference, haptic-only confirmation for quiet tuning. |
| M443 | P4 | 14 | r4:kids-gamify | Tuney the tuning-fork mascot reacts to cents error | SVG sprite wobbles flat/sharp, smiles when string lands in tune |
| M444 | P4 | 14 | r4:data-viz | Session timeline scrubber over recorded tuning attempt | Drag playhead across a stored cents-vs-time curve per string. |
| M445 | P4 | 14 | r4:settings-personalization | Settings search/filter box | Type to jump to any control across all sections. |
| M446 | P4 | 14 | r4:settings-personalization | Settings change-history with undo stack | Step back through recent setting edits this session. |
| M447 | P4 | 14 | r4:settings-personalization | Preset auto-apply rule by connected device | Bind a named preset to fire when a mic appears. |
| M448 | P4 | 14 | r4:privacy-security | security.txt at well-known with contact and PGP | Publish /tuner/.well-known/security.txt for vulnerability disclosure. |
| M449 | P4 | 14 | r4:offline-storage | Storage-usage meter UI in settings sidebar | navigator.storage.estimate() usage/quota bar with per-category breakdown. |
| M450 | P4 | 14 | r4:offline-storage | Quota-pressure handler degrading non-essential caches first | On QuotaExceededError evict spectrogram caches before tuning data. |
| M451 | P4 | 14 | r4:integrations-productivity | Apple Calendar practice reminder via generated .ics download | Export VEVENT with VALARM for next practice session. |
| M452 | P4 | 14 | r4:integrations-music | Songsterr paste-link tuning extractor | Paste Songsterr URL, fetch track tuning JSON, apply preset. |
| M453 | P4 | 14 | r4:content-marketing | Email newsletter: monthly tuning tip + changelog | Re-engagement channel; static signup, no backend needed. |
| M454 | P4 | 14 | r4:theming-identity | Swappable icon-set variants outline/filled/duotone | Mic, settings, play icons share one selectable style family. |
| M455 | P4 | 14 | r4:notifications-engagement | Quiet-hours window suppressing all reminders | User-defined start/end; clamp scheduled times outside band. |
| M456 | P4 | 14 | r4:notifications-engagement | Do-not-disturb master toggle pausing all nudges | One switch silences reminders for a chosen duration. |
| M457 | P4 | 14 | r4:notifications-engagement | Tauri autostart with minimized tray for reminders | Launch-on-login so scheduled toasts fire without app open. |
| M458 | P4 | 14 | r4:business-ops-deep | Privacy-preserving local aggregate metrics with k-anonymity batching | Opt-in counters flushed only above threshold, no IDs. |
| M459 | P4 | 14 | r4:business-ops-deep | Self-hosted Plausible-style aggregate dashboard, IP-truncated, opt-in | First-party analytics with no cookies or persistent IDs. |
| M460 | P4 | 13 | r4:bowed-strings | Equal-tempered vs pure-fifths deviation display | Show both ET target and beatless-fifth target cents. |
| M461 | P4 | 13 | r4:kids-gamify | Daily challenge: tune all six before timer ends | One seeded challenge per local date, completion badge |
| M462 | P4 | 13 | r4:kids-gamify | Confetti bloom and mascot cheer on six-string completion | CSS particle burst when all strings tuned in session |
| M463 | P4 | 13 | r4:kids-gamify | Star rating per string: 1-3 stars by tuning precision | Tighter cents window earns more stars, drives replay |
| M464 | P4 | 13 | r4:privacy-security | Privacy regression snapshot of localStorage keys in CI | Golden test fails if new persisted key appears unreviewed. |
| M465 | P4 | 13 | r4:offline-storage | Eviction warning when persisted-storage permission denied | Banner noting data may be cleared under disk pressure. |
| M466 | P4 | 13 | r4:integrations-music | Ultimate-Guitar tab URL capo/tuning sniffer | Read UG page tuning+capo line, suggest matching tuner setup. |
| M467 | P4 | 12 | r2:instruments-notation | Oud course tuning presets (Arabic, Turkish, Iraqi) with 5-6 double courses | Opens a large underserved Middle-Eastern player base. |
| M468 | P4 | 12 | r2:instruments-notation | Maqam quarter-tone target set (24-TET / koma) with named jins | Microtonal targets for Arabic/Turkish music. |
| M469 | P4 | 12 | r2:instruments-notation | Harp / autoharp full-range chromatic per-string tuning sequencer | Sequenced many-string tuning workflow. |
| M470 | P4 | 12 | r2:instruments-notation | Hammered/mountain dulcimer and bouzouki/charango course tunings | Folk course-instrument presets, low effort. |
| M471 | P4 | 12 | r3:monetization | Paid Pro feature bundle definition and pricing page | The 'what is Pro' anchor every monetization idea depends on; define first. |
| M472 | P4 | 12 | r3:monetization | Desktop app on Microsoft Store / Mac App Store with paid Pro IAP | Native store discovery plus a sanctioned IAP monetization channel. |
| M473 | P4 | 12 | r3:pro-audio-ecosystem | ARA2 plugin placing per-note tuning markers along the DAW timeline | Deep DAW integration for editors; significant host-specific work. |
| M474 | P4 | 12 | r3:hardware-peripherals | Generic USB gamepad/foot-pedal stepping via gilrs (native) | Cheap hands-free stepping reusing a standard input library. |
| M475 | P4 | 12 | r3:pro-audio-ecosystem | Detected-pitch envelope export as Reaper/Audacity automation/label track | Bridges detection output into editor workflows. |
| M476 | P4 | 12 | r3:pro-audio-ecosystem | Cross-format installer (VST3/AU/CLAP/AAX) with signed packages + manifest | Makes plugin distribution trustworthy and versioned. |
| M477 | P4 | 12 | r3:community-social | Invite-a-bandmate onboarding pack: shareable .bandpack + printable one-pager | Drives word-of-mouth growth among bandmates. |
| M478 | P4 | 12 | r3:monetization | Bundle on-device intelligence as opt-in 'Pro Listening' tier | Connects the ML features to a future revenue line. |
| M479 | P4 | 12 | r3:brand-microinteractions | Seasonal accent themes auto-applied by date with manual override | Periodic freshness that invites users to return. |
| M480 | P4 | 12 | r4:bowed-strings | Scordatura preset library per piece | Bach G-minor, Mahler, Saint-Saens Danse Macabre A-Eb. |
| M481 | P4 | 12 | r4:keyed-free-reed | Piano 88-key sectioned tuning map A0-C8 | Visual keyboard split into bass/temperament/treble tuning sections |
| M482 | P4 | 12 | r4:live-deep | Tuner-out passthrough: mute audio while detecting | Emulate pedalboard tuner-out by gating output during tune. |
| M483 | P4 | 12 | r4:live-deep | Pre-show checklist: all strings green before set | Confirm every open string in tune before walking onstage. |
| M484 | P4 | 12 | r4:live-deep | Hold-to-tune latch pins display while glancing away | Freeze last reading so tech reads after string stops. |
| M485 | P4 | 12 | r4:kids-gamify | XP awarded per string within cents tolerance | Faster, steadier tuning grants more XP; shown as bar |
| M486 | P4 | 12 | r4:kids-gamify | Tuning streak counter with streak-freeze token | Consecutive days tracked; earned token skips one missed day |
| M487 | P4 | 12 | r4:kids-gamify | Color-by-string game: match strummed string to its hue | Detect played string, child taps matching colored pad |
| M488 | P4 | 12 | r4:data-viz | Pitch constellation scatter: cents vs amplitude points | Each frame a dot; cluster tightness signals tuning stability. |
| M489 | P4 | 12 | r4:power-user | Fully remappable hotkey editor in settings | Per-action key capture stored in localStorage, conflict detection |
| M490 | P4 | 12 | r4:privacy-security | local CSP violation collector logging to in-app panel | report-to endpoint writes violations locally, no external reporting URI. |
| M491 | P4 | 12 | r4:privacy-security | Threat-model doc STRIDE for mic audio and storage | Document trust boundaries, attack surface, mitigations in repo. |
| M492 | P4 | 12 | r4:offline-storage | Last-write-wins conflict resolution with timestamp tiebreak | Per-pack updatedAt compares local vs synced, prompt on tie. |
| M493 | P4 | 12 | r4:offline-storage | Offline pack availability badge per gallery entry | Mark which community packs are cached and usable offline. |
| M494 | P4 | 12 | r4:theming-identity | Wallpaper-extracted palette via desktop accent (Tauri) | Native pulls OS accent color to seed app theme. |
| M495 | P4 | 12 | r4:theming-identity | Texture/material backdrop layer brushed-metal or felt | Optional subtle tiled SVG behind cards per theme. |
| M496 | P4 | 12 | r4:notifications-engagement | Streak-at-risk nudge before midnight local time | Fire only if today's session count is zero near cutoff. |
| M497 | P4 | 12 | r4:notifications-engagement | Weekly recap notification: strings tuned, accuracy delta | Sunday summary pulled from local IndexedDB session stats. |
| M498 | P4 | 12 | r4:notifications-engagement | Re-engagement nudge after N days lapsed | Single gentle ping after 7-day inactivity, then escalating cooldown. |
| M499 | P4 | 12 | r4:notifications-engagement | Per-channel opt-in: OS push vs in-app inbox | Independent toggles per notification type and delivery surface. |
| M500 | P4 | 12 | r4:notifications-engagement | In-app notification inbox with unread badge | Persistent local list of past nudges, recaps, announcements. |

</details>
<!-- TOP500_RECOMMENDATION:END -->

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
- Removed `tuner.*.value` noise from `App.vue` by exposing the shell view-model through Vue ref unwrapping.
- Centralized canvas DPR/backing-store resize logic in `useHiDpiCanvas` and reused it across waveform, spectrum, spectrogram and cents history.
- Added Rust/Web domain parity through `pitch-core/examples/domain_snapshot.rs` and Vitest, aligned built-in tuning registries, and added headless synthetic audio fixture support (`?fixture=E2`).
- Added canonical frame types (`DetectionFrame`, `SpectrumFrame`, `WaveformFrame`), made `TunerEngine::process` return `DetectionFrame`, and moved egui level rendering to `frame.level`.
- Added `useCanvasRenderer` with shared draw scheduling/ResizeObserver and moved canvas visualizers onto it.
- Extracted `useTunerSession` from `useTuner` for web/native/synthetic audio orchestration.
- Added a Vitest synthetic-session harness for `useTunerSession`.
- Added Playwright synthetic UI E2E for `?fixture=E2` and fixed worker payload cloning by sending plain detection range/stats objects.
- Made Tauri native audio emit a frame-shaped payload and made the web native adapter normalize it into `DetectionFrame`.
- Split `pitch-core` into `frames`, `signal`, `smoother`, `engine` and `dsp` modules, plus `EngineConfig`.
Fully fixed items should be removed from future audits; partially fixed items above now call out their remaining scope so stable `R#` references stay usable.

## Summary
- This file contains 183 stable unresolved `R#` problems used by the plan.
- The latest grounded audit contains 187 detailed `C#` findings in [TOP-200-current.md](TOP-200-current.md).
- The requested full Top 500 lives in [TOP-500-backlog.md](TOP-500-backlog.md).
- Many items are direct violations of the architecture vision.
- A number are low-hanging: hardcoded values, duplicate canvas plumbing, missing constants, stale README/docs.
- Highest impact remains: explicit session/audio-port contracts, single-source domain/codegen, Tauri/egui parity, realtime safety, DSP hot-path allocation, and UI/release hardening.

Update this file when fixing. Link from issues.
