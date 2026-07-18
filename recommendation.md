# Recommendations & Current Problems Backlog

**Current state audit (findings synced 2026-07-12; verification refreshed 2026-07-18 after three implementation iterations and review)**

This is the canonical **current open-problems extract** for the worktree. It keeps stable `R#` references used by [PLAN.md](PLAN.md). The full ranked **Top 500** lives in [TOP-500-backlog.md](TOP-500-backlog.md); its mirrors remain in this file, [README.md](README.md), and [ARCHITECTURE.md](ARCHITECTURE.md).

**Update:** a second, independent audit pass against this same post-refactor code added **214 more items (`R181`-`R394`)**, organized by a finer 36-piece SOLID/DRY breakdown — see ["Post-Refactor Findings (R181-R394, by SOLID/DRY Piece)"](#post-refactor-findings-r181-r394-by-soliddry-piece) further down.

In the first audit range, **71 findings are verified closed or obsolete and 109 `R#` findings remain open/partial**. The independent `R181`-`R394` pass adds 214 open findings, so the combined current total is 323. Closed findings are removed from the current list below and retained in the closure registry so references do not change. The Top 500 is an idea/risk registry, not a claim that 500 independent features are shipped; some entries are mutually exclusive, platform-specific, commercial, or require external signing/accounts.

Audit basis: direct inspection of the changed web, Rust core, shared audio, Tauri and egui paths; `84` Vitest tests; `65` pitch-core tests with all features; licensed corpus `19/19`; workspace tests/clippy; generated-source freshness; core and egui WASM target checks; Vue production typecheck/build; five Playwright flows covering shared confidence parity, full-frame WASM, synthetic detection, Algorithm diagnostics and `360 px` Library navigation; manual `1280x720`/`390x844` visual QA; and a full Tauri `.app`/`.dmg` build.

Synced documents:
- [ARCHITECTURE.md](ARCHITECTURE.md) describes the target architecture and links back here.
- [README.md](README.md) summarizes the same debt for users and contributors.
- [PLAN.md](PLAN.md) is the execution-order source of truth.
- [RECOMMENDATIONS.md](RECOMMENDATIONS.md) turns the same debt into detailed refactor recommendations.
- [TOP-500-backlog.md](TOP-500-backlog.md) is the unified master ranked Top 500 (`M#`) and historical grounded audit (`C#`).
- [RESEARCH-100-PITCH-REPOSITORIES.md](RESEARCH-100-PITCH-REPOSITORIES.md) records the focused pitch/DSP evidence and `X#` hypotheses.
- [RESEARCH-473-MUSIC-REPOSITORIES.md](RESEARCH-473-MUSIC-REPOSITORIES.md) records the 473-repository competitor scan and 50 synthesized `G#` proposals. `G#` does not increase the current-open count unless a proposal is promoted through a grounded design/benchmark pass.

Priority key: **P0** correctness / realtime safety / blocking architecture, **P1** high-impact coupling or duplication, **P2** quality / DX / product risk, **P3** cleanup.

Notation used across docs:
- `R#` - stable recommendation item from this file.
- `C#` - detailed historical audit item in [TOP-500-backlog.md](TOP-500-backlog.md#historical-grounded-audit-c).
- `M#` - ranked master Top-500 item from [TOP-500-backlog.md](TOP-500-backlog.md).

## Latest Three Iterations Delivered

1. **Confidence contract:** Rust and TypeScript define confidence as normalized periodicity quality, share the `0.5` usable threshold through the parity manifest, and assert minimum confidence for B0-E5 fixtures.
2. **Full-frame browser owner:** WASM `TunerProcessor` owns detector, smoothing, level, power flag and target/cents/hysteresis resolution; the worker receives `FrameContext` only when its revision changes.
3. **Fallback and lifecycle review:** TypeScript fallback reports measured confidence with its own trace-compatible smoother; review added an explicit worker reset so stopped sessions cannot leak stale smoothing state into restart.

Post-iteration review verified the generated ABI in a real browser, removed double smoothing from the primary path, and fixed stale worker state across stop/restart.

## Closed R Registry (71)

| Stable IDs | Verified closure evidence |
| --- | --- |
| R2, R48, R142, R176 | Explicit serialized session lifecycle, cancellation/runtime-failure tests, visible pending states |
| R3 | Discriminated `AudioInputPort` contract, capability narrowing, adapter registry and lifecycle contract tests for web/native/synthetic inputs |
| R9, R150, R164 | Typed A4/tuning/selected-target `FrameContext`, native-owned frame resolution, A4=442 coverage, shared smoothing traces and exact canonical wire-shape tests without the top-level `frequency` alias |
| R14, R16 | One generated music registry plus a shared native/WASM/TS pitch fixture manifest remove hand-maintained tuning drift and specify fallback cents tolerance |
| R15, R105, R116, R117 | One code generator owns note names, MIDI/frequency/cents/closest-target formulas and note/frequency formatting; Rust, web and egui consume generated primitives or thin domain facades |
| R17 | Normalized-periodicity confidence is fixture-gated in Rust/TS; browser WASM exposes a full `DetectionFrame`, receives revisioned context and owns smoothing/resolution; presentation branches on explicit `resolved/unresolved` semantics rather than backend identity |
| R35 | Deterministic Rust and TypeScript property sweeps cover reference pitches, MIDI range, cents offsets, temperaments and capo/transpose, with invalid-input contracts |
| R4, R25, R46, R50, R66, R71, R83, R122, R145 | Split detector/spectrum/WASM modules, optional FFT, `PitchDetector`, `EngineConfig`, reusable YIN/MPM buffers, DC centering |
| R12, R23, R24, R29, R30, R70, R74, R79, R81, R140, R146 | Shared typed cpal adapter, bounded callback queue, worker DSP, actual sample rate, frame-gated histories and repaint |
| R5, R8, R47, R51, R52, R62, R64, R67, R72 | egui and Vue shells decomposed; visualization, audio, reference tone and settings ownership clarified |
| R39, R40, R155, R163, R175, R177 | Real offline service worker, `UserProfileV1`, strict normalization/migration fallback, complete backup/import |
| R68, R77, R90, R92, R96, R100, R103, R129, R130, R131, R132, R136, R169, R172 | False/obsolete findings removed; computed caching, async devices, bounded history helpers, no production lock unwraps, retry/focus flow verified |
| R93, R102, R137, R139 | Visualization arrays and worker buffers are reused; tone creation is centralized; invalid native frequency and stopped-tone state are sanitized |
| R124, R167 | Semantic canvas palette and shared renderer lifecycle replace duplicated scheduling/colors |

Do not renumber the remaining entries; plans and old review notes still cite these stable IDs.

## Open Problems (109 stable R-items)

### Architecture & Coupling
1. **P0: `useTuner.ts` is still a composition god-object.** It is no longer 500 lines, but it still wires settings, web audio, native audio, pitch loop, tuning state, reference tone, ear training, metronome, practice history, display modes and a huge return object.
   **Recommendation:** Turn it into a thin composition root and move lifecycle/workflow logic into controllers.

6. **P1: `useTuningState.ts` remains a broad controller.** Pure calculations and custom-library CRUD now have separate owners, reducing the composable to roughly 340 lines, but selection, chromatic/temperament workflow and display derivation still live together.
   **Recommendation:** Extract selection/target resolution and temperament workflow into independently tested controllers/view models.

7. **P1: `useSettings.ts` is still a global mutable settings singleton.** `UserProfileV1`, strict normalization and serialized saves now exist, but refs, watches and concrete storage selection remain module globals.
   **Recommendation:** Inject a storage port and expose a loaded settings store/value instead of module-global mutable state.

10. **P1: Engine internals leak into UI shape.** The UI still receives raw frequencies, selected strings, backend flags and many refs as one broad API.
    **Recommendation:** Return small view-model slices and commands for each feature.

11. **P1: Persistence, URL/app state and live session state are tangled.** Settings are watched and saved while live audio and tuning selection mutate.
    **Recommendation:** Separate persisted profile, transient session and derived presentation state.

13. **P1: `TunerEngine` still owns presentation-adjacent concerns.** Detector, spectrum and smoother are separate modules and spectrum is optional, but the engine still formats note strings and clones enabled spectrum output into each frame.
    **Recommendation:** Keep estimates/domain targets in the engine and move display formatting plus owned visualization transport outward.

### Duplication & Drift
18. **P1: Power-chord capability still degrades across the fallback boundary.** Native and primary browser WASM return the shared core flag, while explicit TypeScript fallback reports `isPower=false`.
    **Recommendation:** Port the shared heuristic or model the missing flag as an explicit backend capability with stable tests.

19. **P1: Spectrum/waveform drawing code is duplicated across Vue and egui.** Both platforms reinvent data scaling, history limits, colors and harmonic markers.
    **Recommendation:** Share data transforms and keep painters platform-specific but dumb.

20. **P2: Magic constants are scattered.** Buffer sizes, YIN threshold, RMS gates, history lengths, tolerance cents, gains and sample-rate assumptions live in many files.
    **Recommendation:** Move them into typed config structs/constants with docs.

21. **P2: Persistence is centralized only for the Vue/Tauri shell.** Web localStorage and Tauri Store now share `UserProfileV1`; egui still has independent flat keys and migrations.
    **Recommendation:** Define a platform-neutral profile subset and explicit egui migration mapping.

22. **P2: Error handling language and shape differ per platform.** Web returns user-facing strings, Tauri emits strings, egui prints `eprintln!`.
    **Recommendation:** Introduce typed error categories and platform-specific presentation.

### Performance & Realtime Safety
26. **P1: Enabled spectrum still creates an owned `Vec<f32>` per `DetectionFrame`.** FFT is now disabled for pitch-only consumers and hidden egui views, but visualization mode still clones analyzer output each frame.
    **Recommendation:** Reuse an owned frame buffer or publish visualization frames through a separate borrowed/recyclable channel.

27. **P1: Web pitch loop still depends on `requestAnimationFrame`.** Detection cadence is throttled to ~33ms, but the loop itself is a paint loop and copies buffers to a worker.
    **Recommendation:** Use AudioWorklet or a dedicated audio worker-style pipeline independent of paint.

28. **P1: Canvas renderer lifecycle is improved but still not fully optimized.** Web visualizers now share `useCanvasRenderer` with `ResizeObserver` and coalesced RAF scheduling, but the HiDPI validation still runs on scheduled draws.
    **Recommendation:** Cache dimensions/DPR and skip backing-store checks unless `ResizeObserver` or DPR changes.

### Testing & Verification
31. **P0: Rust/Web domain equivalence harness is partial.** Built-in tuning/note parity, native/WASM/TS pitch/confidence fixtures and an offline real-WAV core gate exist, but Tauri/egui/web session-output equivalence is not covered yet.
    **Recommendation:** Replay the same licensed captures through native events, egui and browser session adapters.

32. **P1: Fake-mic E2E coverage is still shallow.** Playwright now verifies `?fixture=E2` through the UI without microphone access, but permission-denied, device loss and mocked `getUserMedia` flows are not covered yet.
    **Recommendation:** Extend Playwright with denied-permission, device-unplug and fake WAV pipeline tests.

33. **P1: Core tests now include real audio but remain narrow.** Vitest covers lifecycle/profile/domain flows; Rust and browser WASM share cents-budget fixtures; a licensed 19-capture core corpus blocks temporal regressions; Playwright covers synthetic E2 and responsive UI behavior. More performers/devices, permission/device-loss flows, controlled noise/SNR/reverb sweeps and soak tests remain.
    **Recommendation:** Expand the corpus with deterministic stress transforms and add adapter-level failure/equivalence suites.

34. **P1: No benchmarks for hot DSP paths.** YIN/MPM/spectrum costs are not measured.
    **Recommendation:** Add `criterion` benches for representative buffer sizes and notes.

36. **P2: No visual regression tests for main states.** Gauge, stage/compact mode, colorblind mode and canvas states are not screenshot-tested.
    **Recommendation:** Add Playwright screenshots for idle/listening/in-tune/error states.

37. **P2: Build CI does not prove offline/privacy claims.** PWA/offline/local-only claims are not backed by a zero-network or cache test.
    **Recommendation:** Add CI checks for network fetches and built asset cacheability.

38. **P2: No long-running stability test.** There is no soak test for memory growth, stream restart, worker failure or repeated start/stop.
    **Recommendation:** Add scripted stability tests around lifecycle and audio mocks.

### Product, UX, Build & Documentation
41. **P1: Accessibility is incomplete.** Some live readout is improved, but canvases, color-only states, keyboard flow, focus rings and screen-reader text are not systematically verified.
    **Recommendation:** Add an accessibility checklist and test stage/compact/colorblind modes.

42. **P2: WASM packaging is ad hoc.** `build:wasm` can try to install `wasm-pack` during the build and writes into `web/public/wasm`.
    **Recommendation:** Pin tool versions and make WASM artifacts reproducible/versioned.

43. **P2: Release hardening is incomplete.** Code-signing, notarization, CSP, checksums and audit gates are listed as plans rather than enforced release steps.
    **Recommendation:** Add release gates incrementally.

44. **P2: Observability is weak.** There is no health strip for WASM status, audio backend status, device failure, clipping, hum or DC bias.
    **Recommendation:** Add a "Test my mic" / diagnostics panel.

45. **P1: The architecture plan is substantially advanced but incomplete.** Session lifecycle, explicit audio ports, native realtime processing, contextual full-frame WASM/native ownership, generated note math, measured fallback confidence, feature shells and profile schema are in place. File input and remaining broad controllers remain.
    **Recommendation:** Continue with file/WAV input and controller boundaries before adding another broad feature surface.

### More Architecture & Coupling Issues

49. useTuner returns a giant object with 30+ properties; consumers couple to too many details.
53. Web and native have completely different strategies for feeding audio into the core (analyser vs cpal vs feed_audio_samples).
54. `PitchDetector` exists, but `TunerEngine` still constructs `HybridPitchDetector` directly instead of accepting an injected detector.
55. Settings (a4, tuning) are mutated directly on engine and also kept in Vue refs without single source.
56. Components like StringSelector receive large computed lists instead of minimal props.
57. CentsHistory component receives raw array and does its own rendering logic duplicating gauge logic.
58. No event or callback abstraction for "new detection frame available".
59. Lock .clone() of entire State on every egui frame is inefficient and couples UI to internal repr.
60. WASM static OnceLock for WEB_ENGINE creates global mutable singleton anti-pattern.
61. Different handling of "no string selected" vs "chromatic" between web and egui.
63. No clean way to inject a mock detector for testing or file-based input.
65. Domain Note and Tuning use &'static str but web uses owned strings – friction when extending.
69. pitch-core public API mixes f32 buffers with no lifetime or ownership docs.
73. Mic/native/synthetic adapters implement one explicit shared interface, but there is still no file/WAV input adapter for deterministic real-audio sessions.

### Performance & Efficiency Issues
75. Spectrum bars in egui are drawn with per-frame math and allocations inside the paint closure.
76. `usePitchLoop` still couples RAF scheduling, signal stats and worker dispatch; primary smoothing moved into WASM and fallback smoothing is isolated, but cadence remains paint-driven.
78. Histogram drawing in CentsHistory likely redraws full history every frame.
80. Spectrogram uses 80 freq bins hard limit and redraws all history every time.
82. SharedAudio in web is created lazily but never suspended properly when tab hidden for long.
84. Multiple BiquadFilter and Gain nodes created on every reference tone play.
85. No frame dropping or priority for viz when CPU is high.
86. Buffer of 2048 is always used even for higher strings where smaller window would suffice.
87. History arrays grow/shift without ring buffer (O(n) cost on shift).
88. In Spectrum.vue log scale bin selection recomputes every draw.
89. Waveform.vue allocates new path implicitly every frame with beginPath + many lineTo.
91. egui spectrum takes first 200 bins regardless of actual useful range.
94. cpal stream config is queried every device change without caching.
95. No use of requestIdleCallback for non-critical history updates.
97. Vue reactivity on large arrays (centsHistory) causes unnecessary component updates.
98. No WebGL or offscreen canvas for heavy spectrogram.
99. Reference tone lowpass is recreated every play instead of reused node.
101. Lack of any performance marks or profiling hooks in hot paths.

### Duplication & Code Smells
104. Spectrum drawing loop in egui duplicated in concept with web Spectrum.vue (log vs linear).
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
118. Multiple places clamp cents manually ( /50.0 * w etc).
119. Power chord detection has native and wasm wrappers that may differ slightly.
120. Storage keys in egui save() are strings without constants.
121. The old `useTuner` tick moved to `usePitchLoop`, but that composable still owns scheduling, signal gating and worker lifecycle; only fallback smoothing remains local.
123. Vue computed for stringsWithCents, targetNote etc. recompute similar math.
125. onUnmounted and stop() both try to clean some of the same things.
126. URL parsing and persisted load have similar "try find tuning" code.
127. Two places define "strings" selection (1-6 keys in web, combo in egui).
128. Sample rate preference duplicated in web constraints and consts.
### Error Handling, Robustness & Edge Cases
133. No handling for AudioContext being closed by browser (low power mode etc).
134. Device removal while listening not handled gracefully in native.
135. No recovery if cpal stream errors after start.
138. Visibility change resume can fail silently.
141. Buffer length < 2048 in feed_audio_samples just returns without detection.
143. In egui, if engine lock fails, detection is silently skipped in some places.
144. Power chord flag can flicker without hysteresis like the in-tune state.
147. No timeout or watchdog for stuck raf loop or detection.

### Testing, Quality & CI Gaps
148. Real-instrument corpus coverage is limited to 19 captures; there are no controlled inharmonicity, SNR or room-response cases.
149. No test that web WASM and native produce same cents within tolerance for same buffer.
151. No fuzzing of extreme frequencies (20Hz, 2000Hz+).
152. Build doesn't run pitch-core tests in the web WASM target.
153. No visual regression tests for the gauge or canvas output.
154. Lacking tests for the new chromatic mode and tolerance settings.
156. No property test that find_closest_string + get_cents is consistent with target.
157. Tests use approx but tolerance is loose (2.0 Hz).
158. No load test or long-running stability test for the smoother.
159. Missing test for power chord on real multi-string input.
160. No test that UI doesn't crash when detector returns None for long time.
161. Documentation examples in code are missing for core functions.
162. No contract test between the exported WASM functions and TS callers.
165. Lack of mutation testing or any advanced quality metric.
166. Manual icons and build steps are error-prone and not tested.

### Web / Vue / Frontend Specific
168. Large number of refs in useTuner cause many reactivity triggers.
170. Fretboard component exists but may not be integrated well (from imports).
171. i18n store is simple but strings for errors and hints are still mixed.
173. Tailwind + custom CSS mix without clear design tokens.
174. Vite base path for /tuner/ must be maintained manually for Pages.
178. No tree-shaking verification for the large pitch wasm bundle.
179. Dev server port is pinned for Tauri – brittle for other devs.
180. No source maps or proper error boundaries in production web build.

## SOLID/DRY Execution Slices

Use this as the practical decomposition plan. Each slice should be small enough for one focused
commit and should reduce coupling between audio, DSP, state and presentation.

| Order | Status | Slice | Boundary Result | Next Step |
| --- | --- | --- | --- | --- |
| 1 | Done | Session state machine | Serialized lifecycle with cancellation/failure tests | Keep adapters behind commands only [DONE 2026-07-11] |
| 2 | Done | Audio input port | Discriminated TS port + registry cover web/native/synthetic adapters | Add interactive file/WAV adapter under R73; offline real-audio ingestion has landed [DONE 2026-07-11] |
| 3 | Done | Native frame context | Tauri consumes typed resolved context and Vue trusts its canonical frame | Keep wire/context/smoothing fixtures green [DONE 2026-07-11] |
| 4 | Done | egui frame adoption | egui state consumes `DetectionFrame` | Replace remaining static WASM globals later |
| 5 | Partial | Practice controller | Pure summary/date logic extracted and tested | Move ear-training workflow out of composition root [DONE 2026-07-11] |
| 6 | Done | Profile schema | Versioned full backup, strict normalization and serialized save | Add future `V1 -> V2` migration when schema changes [DONE 2026-07-11] |
| 7 | Done | Music registry source | Workspace JSON generates Rust and feeds web domain data | Keep schema validation and generated parity green [DONE 2026-07-11] |
| 8 | Done | Pitch module convergence | Stateful WASM is primary; native/WASM/TS share cents-budget fixtures and core CI has 19 licensed recordings | Extend parity to session adapters and SNR transforms [DONE 2026-07-11] |
| 9 | Done | Native realtime queue | Callback only downmixes into bounded recycled chunks | Add callback-drop counters/benchmarks |
| 10 | Done | Feature shells | `App.vue` is a 113-line shell with four lazy feature surfaces | Split the remaining 340-line tuning controller |
| 11 | Partial | Tuning workflow | Custom-library CRUD is an injected controller; Library uses focused tabs | Extract selection/temperament state from the remaining 340 lines |
| 12 | Done | Generated note math | One expression/registry source emits dependency-free Rust/TS primitives; web and egui use thin facades | Keep `codegen:check` and property sweeps green [DONE 2026-07-11] |

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

### Iteration 1 - Generated Domain Owner

Finding: tuning data was generated, but MIDI/frequency/cents formulas and note names were still hand-maintained in two languages.

Fix: add one expression AST plus registry-driven codegen and migrate pitch-core domain/resolution to the generated primitives.

### Iteration 2 - Web Facade and Property Sweeps

Finding: `notes.ts` still owned duplicate primitive math and example-only tests did not constrain the full domain range.

Fix: retain its public composition API while delegating primitives; sweep A4/MIDI/cents/temperament/capo behavior in Rust and TypeScript.

### Iteration 3 - Dependency and Release Review

Finding: the first generated Rust module imported `domain::Note`, creating a compiled but undesirable bidirectional dependency; egui still formatted values independently.

Fix: make generated Rust depend only on primitives/registry data, adapt `Note` in `domain.rs`, route egui through shared formatters and gate stale output in CI.

## Post-Refactor Findings (R181-R394, by SOLID/DRY Piece)

**Fresh pass, 2026-07-11 (after the three-iteration refactor above).** The 120 open + 60 closed `R#` items above and the 500-item `M#` register below were the baseline going into this pass. This section is a **second, independent audit of the post-refactor code** — 6 domain groups, each run through 3 novelty-checked iterations reading the live source directly (explicitly instructed to skip anything already tracked as open or closed above), then every piece's candidate list independently re-verified against the current file content. **214 new items** survived, continuing the stable `R#` numbering from `R181`. Do not renumber these; treat them exactly like the `R1`-`R180` items above for citation purposes.

Unlike the coarse 10-slice decomposition earlier in this document, these are organized into **36 finer-grained pieces** reflecting the actual post-refactor file layout (e.g. `pitch-core/src/dsp/` is now four separate files, egui is now `app.rs`/`audio.rs`/`state.rs`/`visualization.rs`, and web has new `ports/`, `session/`, `settings/`, `domain/`, `features/` layers) — small enough that a single item list per piece is a one-sitting read. The full piece definitions are in [ARCHITECTURE.md](ARCHITECTURE.md)'s "SOLID/DRY Small-Slice Decomposition" section.

Tags: `bug` = concrete correctness/architecture problem grounded in current code · `idea` = concrete improvement/feature suggestion · `design` = product/UX/visual-design critique or suggestion · `split` = a specific SOLID/DRY module-extraction/cleanup proposal.

### Web State & Session (Vue composables + new ports/session/settings/domain layers) (23)

**Q1 — useTunerOrchestrator** _(web/src/composables/useTuner.ts)_:

**R181.** _(bug)_ setDisplayMode skips the enum validation every sibling setter duplicates inline. `web/src/composables/useTuner.ts:74-76` — setDisplayMode (useTuner.ts:74-76) assigns settings.displayMode.value directly with no guard, whereas setThemeMode (78-81), setLayoutMode (83-86) and setAudioBackend (92-95) each re-check their value against a hand-written allow-list that duplicates normalizeDisplayMode/normalizeThemeMode/normalizeLayoutMode/normalizeAudioBackend in web/src/settings/normalizeSettings.ts:175-189, all of which lack an export keyword; exporting those four normalizers and routing all four setters through them closes the validation gap on setDisplayMode and removes the three duplicated literal lists.

**Q2 — sessionLifecycle state machine** _(web/src/session/sessionLifecycle.ts)_:

**R182.** _(bug)_ SessionLifecycle sets status synchronously in stop()/fail() but only from inside the queued async body in start(), so a stop immediately followed by a start can leave the UI showing a stale status until the queued start operation actually runs. `web/src/session/sessionLifecycle.ts:45-103 (stop() sets status at line 86 before enqueuing, fail() at line 97 before enqueuing, start() only sets 'starting' at line 59 once its queued body executes)` — Contradicts the 'visible pending states' guarantee recorded for R2/R48/R142/R176 in the Closed R Registry - a fast restart can make the tuner appear frozen right when the user expects immediate 'starting' feedback, because lifecycleSnapshot.status keeps reporting the prior stop's state while the new start waits behind it in the serialized queue.

**R183.** _(split)_ SessionLifecycleDriver.stop() is typed Promise<void> with no result channel, and the swallow happens twice over: useNativeAudioInput.stop() already discards the native stop_native_audio timeout error before SessionLifecycle.stopBackend()'s own catch ever sees it. `web/src/session/sessionLifecycle.ts:12-15 (interface), 122-129 (stopBackend); web/src/composables/useNativeAudioInput.ts:84-95 (stop() try/catch); desktop/src-tauri/src/native_audio.rs:92-107 (stop_native_audio's 2s recv_timeout can return Err)` — A native teardown that misses its 2-second timeout is lost at both the adapter and the lifecycle layer, so there is currently no way to detect or test a failed stop; widening SessionLifecycleDriver.stop() to Promise<boolean>/a discriminated result only helps if useNativeAudioInput.ts also stops swallowing the underlying invoke error first.

**Q3 — useTunerSession** _(web/src/composables/useTunerSession.ts)_:

**R184.** _(bug)_ Switching to native backend before the async availability probe resolves silently falls back to Web with no error. `web/src/composables/useTunerSession.ts:52-55 (requestedBackend, depends on usingNativeAudio at :46-50 and nativeAudio.available, which resolves asynchronously via useNativeAudioInput.ts:115)` — The user thinks they switched to native (settings.audioBackend stays 'native') but audio keeps running through Web Audio with no error surfaced, making the backend mismatch invisible and hard to diagnose.

**R185.** _(design)_ usingNativeAudio reflects backend preference/availability, not whether a session has started, so its only consumer picks the wrong empty-state copy. `web/src/composables/useTunerSession.ts:46-50 (usingNativeAudio), consumed at web/src/features/analysis/AnalysisView.vue:60` — A user with audioBackend='native' who simply hasn't pressed Start sees 'Visualizers are available with Web Audio', implying they need to switch backends when they just never started listening.

**R186.** _(bug)_ setAudioBackend and setInputDevice use different shouldRestart conditions, so a device change during an in-flight start silently fails to apply. `web/src/composables/useTunerSession.ts:152-158 (setAudioBackend) vs :160-165 (setInputDevice)` — setInputDevice's isListening.value check (false throughout SessionLifecycle's 'starting' state, per sessionLifecycle.ts:59,78) skips the restart while a getUserMedia prompt is pending; useAudioInput.ts:62-71 already read the old deviceId into the constraints synchronously before that prompt, so the session ends up listening on the stale device with no indication anything went wrong.

**Q4 — audioInput port contract** _(web/src/ports/audioInput.ts)_:

**R187.** _(bug)_ AudioInputStartOptions.range is silently ignored by two of three adapters implementing the same port. `web/src/ports/audioInput.ts` — useTunerSession.ts calls `port.start({ range: detectionRange.value })` uniformly for every backend (web/src/composables/useTunerSession.ts:125), but useAudioInput.ts's `start()` (web/src/composables/useAudioInput.ts:54) and useSyntheticAudioInput.ts's `start()` (web/src/composables/useSyntheticAudioInput.ts:26) both take zero parameters, not even an unused options arg; only useNativeAudioInput.ts's `start(options)` (web/src/composables/useNativeAudioInput.ts:62,74) actually reads `range`, and TypeScript's structural typing lets the mismatch through with no compile error, so range changes silently no-op on the two most-used backends.

**R188.** _(split)_ The shared port contract has no field for device selection, only for range, so device selection bypasses the interface. `web/src/ports/audioInput.ts` — AudioInputStartOptions declares only `{ range: PitchDetectionRange }` (web/src/ports/audioInput.ts:15-17); device selection instead works by injecting `selectedInputDeviceId: Ref<string>` directly into useAudioInput.ts's constructor (web/src/composables/useAudioInput.ts:18-19), a mechanism specific to that one adapter with no native or synthetic equivalent, so the port abstraction is asymmetric: one cross-cutting start parameter lives in the typed contract, the other lives in an adapter-specific side channel.

**Q5 — useAudioInput (web adapter)** _(web/src/composables/useAudioInput.ts)_:

**R189.** _(split)_ WebAudioInputAdapter.setInputDevice is dead code that duplicates useTunerSession's device-switch path. `web/src/composables/useAudioInput.ts:142-147` — grep across web/src shows this method is only ever referenced inside useAudioInput.ts's own return object; every real caller (LiveTunerView.vue -> featurePorts.ts -> useTuner.ts) reaches useTunerSession.ts's setInputDevice (lines 160-165) instead, which restarts the session through SessionLifecycle.start/stop. The port-level version stops/starts the MediaStream directly, bypassing the lifecycle queue entirely, so leaving it in place risks a future caller wiring it up and reintroducing a second, non-serialized restart path that races with SessionLifecycle.

**R190.** _(bug)_ A transient devicechange blip permanently clears the saved input-device preference with no restore. `web/src/composables/useAudioInput.ts:36-52` — refreshInputDevices() sets selectedInputDeviceId.value = '' the instant the currently selected id is briefly missing from enumerateDevices(), and the devicechange listener (useAudioInput.ts:166) calls it with no debounce or retry; because that same ref is in useSettings.ts's watch list (lines 174-202) behind a 150ms debounced scheduleSave, a momentary USB/Bluetooth mic dropout silently and permanently erases the user's persisted mic choice even after the device reconnects, since nothing re-selects it once cleared.

**Q6 — native + synthetic audio adapters** _(web/src/composables/useNativeAudioInput.ts, useSyntheticAudioInput.ts)_:

**R191.** _(design)_ Audio-input error strings across native/synthetic/web adapters are terse technical dead-ends with no actionable next step when they reach the user. `web/src/composables/useNativeAudioInput.ts:65` — 'Native audio backend unavailable' (useNativeAudioInput.ts:65), 'Microphone access denied or unavailable' (useAudioInput.ts:103) and 'No synthetic audio fixture selected' (useSyntheticAudioInput.ts:29) give no guidance such as checking site permissions or switching input backends.

**R192.** _(bug)_ A `?fixture=` URL query param permanently forces synthetic audio for the whole session with no UI indicator that real audio is being ignored. `web/src/utils/syntheticAudio.ts:54-56` — syntheticAudioFixtureFromLocation() is read once at startup and requestedBackend() (useTunerSession.ts:52-55) always returns 'synthetic' whenever a fixture is set, overriding the Web/Native settings choice, yet featurePorts.ts never exposes usingSyntheticAudio to any .vue view (only usingNativeAudio is surfaced), so a shared link carrying ?fixture=... silently strands a user on fabricated audio.

**R193.** _(bug)_ useNativeAudioInput's stop() marks the session idle before the stop IPC call resolves and silently discards any failure it returns. `web/src/composables/useNativeAudioInput.ts:84-95` — isListening.value is set false and frame cleared before `await invokeFn('stop_native_audio')` even runs, and the empty catch block swallows a genuine failure (Rust returns "Native audio backend did not stop in time" after a 2-second timeout, desktop/src-tauri/src/native_audio.rs:93-107), so the UI can show idle while native capture is still running, with no error surfaced or retry.

**R194.** _(idea)_ useNativeAudioInput's start() unconditionally re-runs the native_audio_available IPC round trip even though refreshAvailability() already resolved it at composable init. `web/src/composables/useNativeAudioInput.ts:62-64` — Every restart into the native backend (switching audioBackend to native via useTunerSession.ts's setAudioBackend, or the profile-import restart in useTuner.ts) re-pays this IPC latency; tuning-range changes and device switches do not trigger it, since setDetectionRange only forwards to each port (useTunerSession.ts:145-150) and setInputDevice's restart is gated to the web backend only (useTunerSession.ts:160-165).

**Q7 — useReferenceTone** _(web/src/composables/useReferenceTone.ts)_:

**R195.** _(bug)_ Reference-tone and metronome AudioContexts are never resumed from 'suspended', unlike the mic-input context. `web/src/composables/useReferenceTone.ts:12-17` — getSharedAudio() (useReferenceTone.ts:12-17) and useMetronome.ts's getAudioContext() (21-26) both hand back whatever createAudioContext() (web/src/utils/audio.ts:5-11) returns with no state check or resume call, unlike useAudioInput.ts's start() which explicitly awaits audioContext.resume() when state is 'suspended' (79-90); on strict-autoplay browsers referencePlaying/isRunning flips true while the tone or click stays silent.

**R196.** _(bug)_ Toggling the reference tone while an ear-training timed tone is playing starts a second, overlapping oscillator instead of stopping the first. `web/src/composables/useReferenceTone.ts:66-79` — playTimedTone (66-79) creates its oscillator as a local `osc` and never assigns it to the module-level `refOsc`, so stopReferenceTone() (38-44), called at the top of playReferenceTone (46-56), finds `refOsc` still null and stops nothing; toggling the manual tone during a timed tone's playback window (default 1500ms) leaves both oscillators sounding at once.

**R197.** _(bug)_ playTimedTone leaks a permanently-playing oscillator if invoked again before its own timeout fires. `web/src/composables/useReferenceTone.ts:66-79` — Each call creates a fresh oscillator via createTone (73) but stores only the setTimeout id in `randomTimeoutId` (75-78), not the oscillator itself; a second call within `durationMs` clears the pending timeout (68-71) without ever calling `.stop()` on the first oscillator, so it plays forever - reachable by clicking an ear-training Play/Next control twice in quick succession.

**Q10 — settings/profile persistence** _(web/src/composables/useSettings.ts, web/src/settings/normalizeSettings.ts, web/src/settings/profileCodec.ts)_:

**R198.** _(bug)_ normalizeInteger treats a persisted null as the number 0, so any field with a declared minimum above 0 (a4, inTuneTolerance, metronomeBpm, metronomeBeats) silently clamps to its minimum instead of the documented default. `web/src/settings/normalizeSettings.ts` — Number(null) is 0, which is finite, so normalizeInteger(value, min, max, fallback) at normalizeSettings.ts:158-162 clamps to min whenever min > 0 rather than reaching the fallback branch; a profile carrying an explicit null for a4, inTuneTolerance, metronomeBpm, or metronomeBeats loads silently wrong (capo, metronomeSubdivision, and transpose escape only because their min/clamped-zero happens to equal their fallback).

**R199.** _(bug)_ useSettings' single watch() over all 27 persisted refs (not 26) deep-traverses every persisted array on any single scalar edit, and the same shape recurs independently in useTuningState's 6-source deep watch. `web/src/composables/useSettings.ts` — ensureWatcher's watch([...27 refs...], scheduleSave, { deep: true }) at useSettings.ts:174-202 deep-diffs customTunings, practiceHistory, stringOffsets and every other array whenever a single scalar like a4 changes, and useTuningState.ts:347-369 repeats the same anti-pattern over 6 sources, distinct from the already-closed CentsHistory deep-watcher fix.

**R200.** _(bug)_ scheduleSave's 150ms debounce has no beforeunload/pagehide/visibilitychange flush, so an edit made just before closing or reloading the tab is dropped. `web/src/composables/useSettings.ts` — scheduleSave() (useSettings.ts:161-168) only arms a fresh window.setTimeout with no unload-time flush anywhere in web/src, so the last change made within that 150ms window never reaches savePersistedSettings when the tab closes or reloads.

**R201.** _(bug)_ exportUserProfile skips the loaded.value guard that save() uses, so clicking Export during Tauri's multi-await startup load downloads default settings instead of the real profile. `web/src/composables/useSettings.ts` — exportUserProfile() (useSettings.ts:79-81) reads the live refs synchronously with no loaded check, while loadPersistedSettings() (settingsStorage.ts:96-129) performs roughly 27 sequential awaited Tauri Store reads before applySettings runs, and ProfileTransferPanel.vue wires its Export button straight to exportUserProfile with no disabled state during that window.

**R202.** _(bug)_ normalizePersistedSettings only resolves a custom instrument's defaultTuningId against the profile's own custom tunings, so an instrument whose default points at a built-in tuning ID gets dropped entirely on load. `web/src/settings/normalizeSettings.ts` — customTuningById (normalizeSettings.ts:68-77) is built solely from normalizedTunings, so a defaultTuningId that resolves to a built-in TUNINGS entry (a path defaultTuningForInstrument in tuningCalculations.ts:30-39 explicitly supports as a fallback) fails the filter's Boolean(defaultTuning && ...) check and silently deletes the whole custom instrument on load.

**R203.** _(idea)_ decodeUserProfile rejects any schemaVersion other than exactly PROFILE_SCHEMA_VERSION with no migration path, unlike the field-level defensive normalizer it hands off to. `web/src/settings/profileCodec.ts` — if (candidate.schemaVersion !== PROFILE_SCHEMA_VERSION) return null at profileCodec.ts:37 is a strict-equality gate with no upgrade branch, so the first time PROFILE_SCHEMA_VERSION is bumped past 1, every previously-exported backup becomes unimportable even though normalizePersistedSettings tolerates malformed or partial data field-by-field.

### Music / Pitch Domain (TS + Rust pitch-core, now split into dsp/*) (27)

**Q13 — music/note domain (TS)** _(web/src/utils/notes.ts)_:

**R204.** _(bug)_ findClosestString(freq, []) returns undefined typed as Note instead of a safe fallback. `web/src/utils/notes.ts:547-559` — closest is seeded from strings[0] and the loop never runs on an empty array, so it silently returns undefined where Rust's find_closest_string (pitch-core/src/domain.rs:667-674) explicitly falls back to a default note; current callers in useTuningState.ts:134 and :147 happen to guard with isChromaticMode first, but the exported function itself has no such guard and will crash any future direct caller that passes an empty strings array.

**R205.** _(split)_ noteId() and getNoteDisplay() are two independently maintained functions with the identical body `${note.name}${note.octave}`. `web/src/utils/notes.ts:501-503, 561-563` — noteId is used only for string-identity comparison (useTuningState.ts:239) while getNoteDisplay is the UI display formatter used in useTuningState.ts:170, useTuner.ts, StringSelector.vue, StringOffsetsPanel.vue and EarTrainingPanel.vue, so a display-format change (e.g. sharps-to-flats) risks landing in only one and silently breaking string-selection matching.

**R206.** _(split)_ midiToFrequency, noteFromMidi, noteWithA4, scaleTuning and frequencyToNote repeat the same (a4, temperament, root, temperaments) tail but splice semitoneOffset into a different position in two of them. `web/src/utils/notes.ts:449-540` — noteWithA4 and scaleTuning insert semitoneOffset as the 4th parameter before root, while midiToFrequency/noteFromMidi/frequencyToNote have no semitoneOffset slot at all, so code written against one function's order and reused against another silently binds root or temperaments to the wrong parameter; today's call sites (useTuningState.ts:96-151) are all correct, but nothing in the signatures prevents a future misordered call from failing silently.

**R207.** _(design)_ Every TEMPERAMENTS entry's authored description string is never read anywhere in web/src. `web/src/utils/notes.ts:68-111` — a repo-wide grep for `.description` across web/src returns zero matches, so the temperament picker shows a bare name like 'Kirnberger III' with none of the explanatory text (e.g. "Well temperament with clear key color.") ever reaching the user.

**R208.** _(bug)_ noteToMidi returns a MIDI value shifted down one semitone for any unrecognized note name instead of validating it. `web/src/utils/notes.ts:464-467` — NOTE_NAMES.indexOf returns -1 for an unknown name and that -1 flows unchecked into (octave+1)*12+index; createCustomTuning (web/src/domain/customLibrary.ts:25-37) passes payload.strings straight into noteWithA4 -> noteToMidi with no name check, unlike its sibling normalizeImportedTunings (customLibrary.ts:77-110) which filters on NOTE_NAMES.includes first, and unlike Rust's equal_tempered_note (pitch-core/src/domain.rs:54-65) which falls back to 'C' via unwrap_or(0).

**Q15 — pitch-core::dsp::yin** _(pitch-core/src/dsp/yin.rs)_:

**R209.** _(idea)_ YIN's displayed confidence is mathematically bounded to roughly 65-100% and can never read lower, because sub-threshold detections return None instead of a graduated low score. `pitch-core/src/dsp/yin.rs:69-90` — With the default yin_threshold=0.12, the primary branch only accepts normalized values <0.12 (confidence >88%) and the map_or_else fallback only accepts values <=0.35 (confidence >=65%), so NoteDisplay.vue:25's 'conf XX%' readout can never display below ~65% - it is presenting a binary accept/reject gate as if it were a graduated diagnostic score.

**R210.** _(bug)_ detect_centered's adaptive threshold loosens (becomes more permissive) exactly as the input signal gets quieter, backwards from robust detection practice. `pitch-core/src/dsp/yin.rs:66-68` — adaptive_threshold = yin_threshold * (1.0 - 0.35*(rms*15.0).min(1.0)) sits at its loosest (~0.12, using default yin_threshold=0.12) near the rms_gate floor (0.0025) and only tightens to ~0.078 once rms exceeds ~0.067, so quiet or noisy input gets the most permissive periodicity-match acceptance instead of the strictest, letting spurious dips through when the signal is least reliable.

**R211.** _(bug)_ detect_centered's global-minimum fallback accepts matches up to a hardcoded 0.35 that is completely independent of the configured yin_threshold. `pitch-core/src/dsp/yin.rs:80-90` — When the primary adaptive-threshold search (yin.rs:69-78) finds no tau, the map_or_else fallback picks the global minimum and gates it with `(value <= 0.35).then_some(...)` (yin.rs:87), never reading self.config.yin_threshold - so tightening yin_threshold only makes the primary branch fail more often (routing more frames into this fallback), it never lowers the fallback's own 0.35 acceptance ceiling.

**Q16 — pitch-core::dsp::mpm** _(pitch-core/src/dsp/mpm.rs)_:

**R212.** _(idea)_ MPM's peak-acceptance threshold at mpm.rs:66 is purely self-relative to the current frame's own NSDF peak, while YIN's threshold at yin.rs:68 scales down as RMS loudness rises, so the hybrid detector judges the same input against two unrelated strictness policies. `pitch-core/src/dsp/mpm.rs:66` — HybridPitchDetector tries YIN first and only falls back to MPM on failure (pitch-core/src/dsp/detector.rs:121-124), so whether a given frame is accepted can flip discontinuously depending on which detector happens to answer, purely because of which unrelated threshold policy got applied.

**R213.** _(bug)_ MpmDetector::detect_centered (pitch-core/src/dsp/mpm.rs:30-32) has no sample_rate finiteness/positivity guard, unlike YinDetector::detect_centered (pitch-core/src/dsp/yin.rs:32). `pitch-core/src/dsp/mpm.rs:30-32` — HybridPitchDetector falls back to MPM with the same sample_rate that YIN already rejected (pitch-core/src/dsp/detector.rs:120-124); an infinite sample_rate saturates min_tau to usize::MAX via Rust's float-to-int cast, so `min_tau + 2` at mpm.rs:32 overflows and panics in debug/test builds (the workspace Cargo.toml sets no overflow-checks override, so release silently wraps instead).

**Q18 — pitch-core::dsp::detector + PitchDetector trait** _(pitch-core/src/dsp/detector.rs, pitch-core/src/dsp/mod.rs)_:

**R214.** _(split)_ prepare_centered is copy-pasted three times, reinventing signal::compute_rms_volume. `pitch-core/src/dsp/detector.rs:89-112` — HybridPitchDetector::prepare_centered (detector.rs:89-112), YinDetector::prepare_centered (yin.rs:115-136) and MpmDetector::prepare_centered (mpm.rs:94-115) are identical mean-center + RMS/peak-gate routines, each hand-rolling the same sum-of-squares/sqrt loop that signal::compute_rms_volume (signal.rs:1-10) already implements; consolidating removes triplicated logic that must otherwise be kept in sync by hand across three files.

**R215.** _(split)_ dsp::detect_pitch_native is a dead byte-identical wrapper around detect_pitch. `pitch-core/src/dsp/mod.rs:17-19` — It is re-exported crate-wide via `pub use dsp::*` in lib.rs but a workspace-wide grep for detect_pitch_native across pitch-core, desktop, egui and web finds zero callers, so it is unused public surface that only adds maintenance and API-review burden.

**R216.** _(idea)_ yin_threshold is a configurable DetectorConfig field but MPM's equivalent sensitivity constants are hardcoded. `pitch-core/src/dsp/detector.rs:24` — yin_threshold (detector.rs:24) is public and settable through DetectorConfig, while MPM's peak floor (0.25) and 0.93 acceptance fraction (mpm.rs:63,66) are baked into source with no corresponding field, so tuning YIN strictness is a runtime config change while doing the equivalent for MPM requires editing source and rebuilding.

**R217.** _(bug)_ DetectorConfig::set_frequency_range silently no-ops on a too-narrow range. `pitch-core/src/dsp/detector.rs:45-52` — The guard `if max_frequency > min_frequency * 1.05` only applies the new range when it passes, otherwise silently keeps the old one, and the function returns () rather than a Result/bool, so a caller requesting e.g. (100, 104) gets no error and no way to detect that its update was ignored.

**Q20 — pitch-core::engine/smoother/signal/frames** _(pitch-core/src/engine.rs, smoother.rs, signal.rs, frames.rs)_:

**R218.** _(bug)_ DetectionFrame.in_tune (engine.rs:169, `freq_opt.is_some() && cents.abs() <= 5.0`) is dropped by egui's TunerViewState::apply (egui/src/state.rs:22-35) and never read via `.inTune` anywhere in web/src, so both platforms recompute in-tune status independently — egui's visualization.rs:105 uses a strict `cents.abs() < 5.0` against the field's `<=`. `pitch-core/src/engine.rs` — A value computed every frame goes unused while its two real consumers silently reimplement it with a mismatched comparison operator, so "in tune" can flicker inconsistently with what the field itself says.

**R219.** _(split)_ SpectrumFrame/WaveformFrame (frames.rs:17-27) are never constructed anywhere in the Rust workspace, so DetectionFrame.spectrum stays a bare Vec<f32> and egui/src/visualization.rs:170 reverse-engineers `fft_size = spectrum.len() * 4`. `pitch-core/src/frames.rs` — That guess only holds because DEFAULT_SPECTRUM_BINS (512) and DEFAULT_SPECTRUM_FFT_SIZE (2048) in engine.rs happen to have a 4x ratio today, and silently breaks harmonic markers if either default changes.

**R220.** _(idea)_ TunerEngine::set_spectrum_enabled (engine.rs:98-109) tears down and rebuilds the whole SpectrumAnalyzer on every enable/disable, and SpectrumAnalyzer::new (pitch-core/src/spectrum.rs:12-22) re-plans a fresh rustfft FftPlanner and reallocates its Complex/f32 buffers each time. `pitch-core/src/engine.rs` — Repeatedly opening and closing the visualizer panel re-plans the FFT from scratch instead of just pausing an already-built analyzer.

**R221.** _(bug)_ signal::normalize_level (signal.rs:12-15) clamps before multiplying (`rms.min(1.0) * 18.0`), so any rms above ~0.056 produces a level up to 18.0 instead of the intended 0..1 range, unlike the TS twin (web/src/utils/pitch.ts:259-262) which clamps the output after multiplying. `pitch-core/src/signal.rs` — Vue is saved only by a defensive clamp01() in useNativeAudioInput.ts:142, while egui's ProgressBar (egui/src/app.rs:191) receives the raw unclamped value with no guard at all.

**R222.** _(split)_ smoother.rs's EMA+median Smoother (alpha=0.4, HISTORY_CAPACITY=5, lines 1-26) is already exported to WASM as WasmSmoother (pitch-core/src/wasm.rs:95-116), but web reimplements the identical algorithm from scratch in FrequencySmoother (web/src/utils/pitch.ts:230-256, same alpha=0.4, maxHistory=5) instead of using the existing bridge. `pitch-core/src/smoother.rs` — WasmSmoother has zero references anywhere in web/src, so the fix is wiring up an already-built export rather than defining a new shared spec as R17 suggests.

**R223.** _(split)_ frames.rs:29's `pub type TunerUpdate = DetectionFrame;` gives the same struct two public names, and the egui crate uses both inconsistently within itself: main.rs:9,34 imports and matches on TunerUpdate while state.rs:1,22 imports and takes DetectionFrame as a parameter. `pitch-core/src/frames.rs` — Two files in one crate refer to the identical type by different names for no functional reason, which is pure alias noise for anyone tracing frame data through egui.

**R224.** _(bug)_ engine.rs:112 computes the displayed input level (signal::compute_rms_volume) from the raw buffer, while yin.rs:124-135 and mpm.rs's prepare_centered gate detection on RMS of the mean-centered buffer. `pitch-core/src/engine.rs` — A DC offset inflates the raw-buffer RMS but not the centered one, so the level meter can show plenty of signal while the pitch detector simultaneously gates the frame out as too quiet.

**Q21 — wasm bindings + web pitch worker adapter** _(pitch-core/src/wasm.rs, web/src/workers/pitchCoreAdapter.ts, web/src/workers/pitchWorker.ts)_:

**R225.** _(bug)_ wasm.rs exports 8 wasm_bindgen items (detect_pitch_yin, detect_pitch_mpm, detect_pitch_wasm, is_likely_power_chord, compute_rms_volume_wasm, normalize_level_wasm, downsample_for_pitch_wasm, WasmSmoother) that no TS caller touches beyond WasmPitchDetector. `pitch-core/src/wasm.rs` — pitchCoreAdapter.ts:116 only ever constructs module.WasmPitchDetector, and downsample_for_pitch (signal.rs) has no internal caller either; since wasm-bindgen exports act as GC roots for wasm-opt's DCE, these dead functions inflate the WASM bundle every session downloads for zero functional benefit.

**R226.** _(bug)_ disableDetector() (pitchCoreAdapter.ts:122-127) sets detectorPromise to Promise.resolve(null) on any WASM detect() exception, and getDetector()'s `!this.detectorPromise` guard (lines 106-109) can never be true again because a resolved promise is truthy. `web/src/workers/pitchCoreAdapter.ts` — One transient error (bad buffer, intermittent WASM fault) permanently and silently downgrades accuracy/confidence for the rest of the session with no retry path, surfaced only via a non-user-facing data-detector-backend attribute (App.vue:85).

**R227.** _(design)_ fallbackDetection() (pitchCoreAdapter.ts:129-141) hardcodes confidence to exactly 0 or 1 instead of a graduated value, and NoteDisplay.vue:25 renders that fabricated number verbatim as "conf N%". `web/src/workers/pitchCoreAdapter.ts` — Once a session is on the TS fallback, users see a fabricated "conf 100%" on every note regardless of actual signal quality, indistinguishable from a genuine high-confidence WASM detection.

**R228.** _(bug)_ detectPitchYIN (pitch.ts:90-97), the function pitchWorker.ts:50 wires in as pitchCoreAdapter's fallback callback, builds its difference function directly from the raw buffer with no DC mean-subtraction, unlike pitch-core's prepare_centered (dsp/yin.rs:115-136) that it substitutes for. `web/src/utils/pitch.ts` — DC bias degrades YIN's difference function precisely when the app is already running degraded (WASM down or disabled), compounding accuracy loss exactly when robustness matters most.

**R229.** _(bug)_ detectPitch()'s own energy gate (pitch.ts:220, rms<0.002/maxAbs<0.01) is looser than detectPitchYIN's internal gate (line 85, MIN_RMS=0.0025/MIN_PEAK=0.012), so borderline-quiet buffers pass detectPitch, get self-rejected by YIN, and fall through to autoCorrelate (line 227) using the loose gate again. `web/src/utils/pitch.ts` — For a narrow RMS/peak band, the exact function pitchCoreAdapter falls back to silently swaps from YIN to a weaker plain-autocorrelation algorithm with no signal to the caller, so identical borderline signals can yield different pitch estimates run to run.

**R230.** _(bug)_ pitchCoreAdapter caches a requested frequency range as 'applied' (pitchCoreAdapter.ts:67-74) immediately after calling set_frequency_range, even though DetectorConfig::set_frequency_range (pitch-core/src/dsp/detector.rs:45-52) silently no-ops and keeps the previous range whenever the new range fails its max_frequency > min_frequency*1.05 check. `web/src/workers/pitchCoreAdapter.ts` — If Rust rejects a range, the JS-side cache still marks it as applied, so an identical follow-up request is skipped forever and a UI/WASM range mismatch can never self-heal.

### Visualization / Canvas (Web + egui) (37)

**Q22 — visualization frame contracts** _(web/src/composables/useVisualizationFrames.ts, web/src/utils/canvasPalette.ts)_:

**R231.** _(bug)_ useVisualizationFrames.ts keeps calling getFloatTimeDomainData/getByteFrequencyData on every rAF tick whenever a show* toggle is on, even on the Tuner/Library/Practice screens where AnalysisView (the only frame consumer) isn't mounted, because shouldCaptureVisualizationFrames (useTuner.ts:34-39) never checks App.vue's activeView (App.vue:109-112). `web/src/composables/useVisualizationFrames.ts` — Wastes analyser reads indefinitely on non-Analysis screens whenever a visualization toggle was left on from a prior visit.

**R232.** _(idea)_ canvasPalette() (canvasPalette.ts:12) re-parses CSS custom properties via a fresh getComputedStyle(frame.canvas) call inside every drawFrame() across Waveform/Spectrum/Spectrogram/CentsHistory, instead of caching until useCanvasRenderer's MutationObserver (useCanvasRenderer.ts:50-55) signals an actual theme change. `web/src/utils/canvasPalette.ts` — Forces a style recalculation on every redraw for a value that only changes when the theme class toggles.

**R233.** _(idea)_ canvasPalette.ts:16-17's fallback hex (#11151b/#334155) and useHiDpiCanvas.ts:46's clear() default (#11151b) have drifted from the real --canvas-bg/--canvas-grid values in style.css:21-22 (#0e1217/#3a4658). `web/src/utils/canvasPalette.ts` — Three independently hardcoded copies with no shared source mean any code path that hits a fallback renders a visibly wrong color.

**R234.** _(bug)_ style.css defines --accent:#34d399/--warning:#fbbf24 (lines 16,19) and --canvas-accent:#4ade80/--canvas-warning:#f59e0b (lines 23,25) as separate, already-diverged token pairs for the same semantic colors in the default theme. `web/src/style.css` — CentsHistoryGraph.vue (lines 32-34) mixes both systems in one widget, visibly proving canvas and DOM/SVG widgets render different greens/ambers for the same state.

**R235.** _(split)_ canvasPalette(frame: CanvasFrame) (canvasPalette.ts:11-12) only ever reads frame.canvas and never touches frame.ctx/w/h. `web/src/utils/canvasPalette.ts` — Narrowing the signature to canvasPalette(canvas: HTMLCanvasElement) would decouple the module from useHiDpiCanvas's CanvasFrame shape.

**R236.** _(idea)_ useVisualizationFrames.ts:16-17 mutates waveformBuffer/spectrumBuffer in place and reassigns the same reference to waveformFrame.value.samples/spectrumFrame.value.bins every tick (lines 37-46), while WaveformFrame/SpectrumFrame (types/frames.ts:15-25) leave those fields non-readonly. `web/src/composables/useVisualizationFrames.ts` — A consumer that retains a frame reference across ticks would see its data mutate underneath it with no type-level warning.

**R237.** _(split)_ WaveformFrame and SpectrumFrame (types/frames.ts:15-25) copy-paste sampleRate: number and sequence: number verbatim, differing only in the payload field's name and typed-array type. `web/src/types/frames.ts` — A shared FrameBase{sampleRate,sequence} would let a future contract change, such as adding a capture timestamp, touch one interface instead of two independently maintained copies.

**Q23 — canvas renderer/DPR** _(web/src/composables/useCanvasRenderer.ts, useHiDpiCanvas.ts)_:

**R238.** _(split)_ useHiDpiCanvas exports a dead clear() (useHiDpiCanvas.ts:46-51, zero callers) while Waveform.vue:20-23, Spectrum.vue:21-24, and Spectrogram.vue:26-29 each hand-roll an identical clearCanvas(frame). `web/src/composables/useHiDpiCanvas.ts` — Delete the unused export and extract the triplicated 2-line clearCanvas helper so the background-fill convention has one source instead of three copies that can drift.

**R239.** _(split)_ useCanvasRenderer's attachThemeListener (useCanvasRenderer.ts:50-55) runs once per call, so all four canvas components -- Waveform.vue, Spectrum.vue, Spectrogram.vue, and CentsHistory.vue -- each install their own MutationObserver on the same shared .app-root node. `web/src/composables/useCanvasRenderer.ts` — Up to 4 separate observers fire on every theme-class mutation; a single module-level theme-change signal would replace them with one shared subscription. (Corrected from the original claim of 3 callers -- CentsHistory.vue also calls useCanvasRenderer.)

**R240.** _(bug)_ useHiDpiCanvas's minWidth (default 260, useHiDpiCanvas.ts:25-29) only floors canvas width when parentWidth is exactly 0, which normal layout never produces since every consumer wraps its canvas in a parent div. `web/src/composables/useHiDpiCanvas.ts` — In a 320px compact-mode column the canvas can shrink below the documented minimum because the floor that's supposed to prevent it never actually triggers, and no caller even passes a custom minWidth today.

**R241.** _(bug)_ No devicePixelRatio-change listener exists in web/src (useHiDpiCanvas.ts:24 is the only reference); DPR is only re-read inside resize(), which fires from setup(), drawNow(), the ResizeObserver, or the theme MutationObserver. `web/src/composables/useHiDpiCanvas.ts` — None of those triggers fire on their own while a canvas is idle (not listening, no new frames), so moving the window to a different-DPR display leaves a stale backing-store scale until an unrelated redraw trigger happens to fire.

**R242.** _(idea)_ useHiDpiCanvas always opens the 2D context with { alpha: true } (useHiDpiCanvas.ts:16), yet every consumer (Waveform.vue, Spectrum.vue, Spectrogram.vue, CentsHistory.vue) immediately fills the whole frame with an opaque canvasPalette(frame).background rect. `web/src/composables/useHiDpiCanvas.ts` — Passing { alpha: false } lets the browser skip alpha-compositing on a surface that's never translucent, a free cost reduction applied identically across all four visualizer canvases.

**R243.** _(split)_ useCanvasRenderer's deep option (declared useCanvasRenderer.ts:10, wired into watch() at lines 57-60) is dead code -- none of its four callers ever sets it. `web/src/composables/useCanvasRenderer.ts` — Every source getter (Waveform.vue, Spectrum.vue, Spectrogram.vue, CentsHistory.vue) already returns a fresh array literal per change, so deep watching is never exercised; dropping the option shrinks the composable to what's actually used and tested.

**Q24 — Vue visualizer components** _(web/src/components/Waveform.vue, Spectrum.vue, Spectrogram.vue, CentsHistory.vue, CentsHistoryGraph.vue, CentsGauge.vue)_:

**R244.** _(bug)_ CentsGauge's default 'gauge' mode caps needle travel at half the track width via a stray /100 divisor in offset() (CentsGauge.vue:14, used at the needle translate on line 38), leaving a ~25% dead zone on each side. `web/src/components/CentsGauge.vue:14,38` — Every new user hits this since 'gauge' is the default displayMode (normalizeSettings.ts:42), so the needle visually undersells how far off-pitch they actually are.

**R245.** _(bug)_ Spectrogram's heat-color ramp (Spectrogram.vue:91-101) is computed by hand and ignores canvasPalette's accent/warning colors, which the component only calls for the background fill (lines 27, 71-72). `web/src/components/Spectrogram.vue:91-101` — Enabling the colorblind theme (style.css:774-781) recolors nearly everything else but leaves the spectrogram's full heat scale untouched.

**R246.** _(bug)_ CentsGauge's status pill (CentsGauge.vue:68) pairs a green Tailwind background with a colorblind-remapped blue text color, since style.css only overrides text-emerald-400 (lines 803-807), never bg-emerald-500/15. `web/src/components/CentsGauge.vue:68` — Colorblind-mode users see a mismatched green-tinted pill with blue text instead of one coherent color.

**R247.** _(design)_ CentsHistoryGraph draws unlabeled guide lines at a fixed ±25 cents (lines 33-34, per the y = 20 - (cents/50)*18 mapping on line 18) regardless of the actual configured tolerance. `web/src/components/CentsHistoryGraph.vue:18,33-34` — With the default 5-cent tolerance (normalizeSettings.ts:43,116), the unlabeled 'comfort band' is 5x wider than what actually counts as in tune.

**R248.** _(split)_ CentsHistory.vue is a dead component nothing imports; AnalysisView.vue wires CentsHistoryGraph.vue instead (AnalysisView.vue:4,66). `web/src/components/CentsHistory.vue` — The old canvas implementation duplicates the SVG version's clamp/scale logic for no reason and should just be deleted.

**R249.** _(design)_ CentsGauge's 'needle' mode redraws its own internal -50/0/+50 <text> labels (lines 48-50) on top of the shared header row (lines 21-25) that already prints them for every mode. `web/src/components/CentsGauge.vue:48-50` — Makes 'needle' visually busier than 'gauge'/'strobe' even though the three modes are meant to be interchangeable skins for the same reading.

**R250.** _(bug)_ CentsHistoryGraph's polyline computed (lines 12-22) builds x purely from array index and never reads the point.at timestamp useCentsHistory.ts records (useCentsHistory.ts:21,29). `web/src/components/CentsHistoryGraph.vue:12-22` — A multi-second silence gap gets drawn as a smooth continuous line instead of a visible break, misrepresenting how long the player was off-signal.

**R251.** _(design)_ Spectrum.vue normalizes bars to a per-frame peak (lines 52-73) while Spectrogram.vue reads raw byte values directly (line 87), so the two panels disagree on loudness for identical audio. `web/src/components/Spectrum.vue:52-73` — A quiet pluck reads as a near-full-height bar chart in Spectrum but dim in Spectrogram, contradicting each other in the same UI.

**R252.** _(bug)_ Spectrogram stretches its first up-to-150 history columns (MAX_HISTORY, line 21) across the full canvas width via timeStepW = w/timeSteps (lines 79-80), so the apparent scroll speed changes once the buffer fills. `web/src/components/Spectrogram.vue:21,79-80` — Users get a silently varying timebase for the first couple seconds after starting, with no indication the scroll speed just changed.

**R253.** _(bug)_ CentsGauge's in-tune zone is a hardcoded <rect x="45" y="3" width="10" height="6"/> (line 35); the component's props (lines 5-10) carry no tolerance value to size it by. `web/src/components/CentsGauge.vue:35` — The needle can turn green via isInTune while sitting visibly outside (or well inside) the static drawn zone, since real tolerance is configurable 1-25 cents (normalizeSettings.ts:116).

**R254.** _(bug)_ Waveform/Spectrum/Spectrogram's `if (!props.isListening || !props.frame)` guard and opacity-40 dimming are dead code because AnalysisView.vue, their only caller, never mounts them with isListening false. `web/src/components/Waveform.vue:26,65` — AnalysisView.vue:44 gates all three behind v-if="isListening && !usingNativeAudio" and passes isListening straight through (lines 46,51,56), so the isListening half of the guard and the opacity-40 class can never fire.

**R255.** _(bug)_ Spectrogram.vue's `freqBins = Math.min(128, binCount)` (line 81) is commented '// limit for perf' but actually caps the heatmap at roughly the bottom 1.5kHz, not just a downsampling optimization. `web/src/components/Spectrogram.vue:81` — With the default fftSize=4096 (useAudioInput.ts:20) giving 2048 bins, most guitar overtone content above ~1.5kHz is structurally excluded from the display, not merely downsampled.

**R256.** _(design)_ CentsGauge's idle pill uses bg-slate-800 text-slate-500 (line 68), the only state with no light-theme color override anywhere in style.css. `web/src/components/CentsGauge.vue:68` — Unlike the translucent emerald/amber in-tune/adjust states, the idle pill risks poor contrast or a mismatched look on the light theme.

**R257.** _(design)_ CentsGauge's 'strobe' mode snaps patternTransform to a new static strobeShift() offset on every cents update (lines 16,55) instead of animating continuously. `web/src/components/CentsGauge.vue:16,55` — Reads as jitter rather than the smooth scrolling motion the 'strobe' name implies, since nothing (rAF or CSS transition) drives continuous motion.

**R258.** _(bug)_ Spectrum.vue creates a new CanvasGradient with two addColorStop calls inside the per-bar loop (lines 82-87), up to 160 times per frame per the displayBins cap on line 48. `web/src/components/Spectrum.vue:82-87` — At a 60Hz redraw that is up to ~9,600 gradient allocations/second for colors that only actually change on theme switch.

**R259.** _(bug)_ CentsGauge's needle-mode -50/0/+50 <text> labels (lines 48-50) live inside the viewBox="0 0 100 44" preserveAspectRatio="none" SVG (line 43), so they stretch anisotropically along with the shapes. `web/src/components/CentsGauge.vue:43,48-50` — 'gauge' and 'strobe' keep all text as plain HTML outside their SVGs and don't have this distortion, so 'needle' renders inconsistently with its siblings.

**R260.** _(split)_ The .visual-canvas background declared in style.css:410-414 is unreachable on every canvas visualizer because drawFrame() always opens with an opaque fillRect (Waveform.vue:36-37, Spectrum.vue:37-38, Spectrogram.vue:72-73). `web/src/components/Waveform.vue:36-37` — Only CentsHistoryGraph's SVG (.visual-surface, CentsHistoryGraph.vue:31) actually benefits from that CSS rule; the canvas-based visualizers never will.

**Q25 — egui visualization module** _(egui/src/visualization.rs)_:

**R261.** _(bug)_ The harmonic-marker overlay derives fft_size from spectrum.len() * 4, a ratio nothing in the types actually guarantees. `egui/src/visualization.rs:170` — EngineConfig (pitch-core/src/engine.rs:15-16) lets spectrum_fft_size and spectrum_bins vary independently and DetectionFrame carries no fft_size field, so any config where the ratio isn't exactly 4 (it only is by coincidence of the current defaults 2048/512) silently misplaces every harmonic tick mark.

**R262.** _(bug)_ draw_waveform's point-count clamp relies on an unenforced invariant that callers never pass fewer than 2 samples. `egui/src/visualization.rs:78` — (rect.width() as usize).clamp(2, samples.len()) panics via Ord::clamp for samples.len()==1 since only the empty case is guarded at line 69; today's two callers happen to always supply a window >= 64 samples (audio-input's clamped window_size) or a fixed 2048-sample WASM slice, but the function itself enforces nothing, so it's one new caller or test away from a panic instead of a graceful degrade.

**R263.** _(split)_ Every draw_* function reimplements the same allocate-then-paint-background boilerplate with inconsistent literal grays and corner radii. `egui/src/visualization.rs (lines 76, 98, 121, 154, 194)` — draw_waveform, draw_cents_gauge, draw_cents_history, draw_spectrum and draw_spectrogram each call rect_filled(rect, R, Color32::from_gray(G)) with three different near-duplicate grays (30, 48, 15) and three different radii (2.0, 4.0, 0.0) that read as accidental drift; a shared panel(ui, max_w, h, radius, bg) helper removes both the duplication and the inconsistency.

**R264.** _(bug)_ The spectrogram's green color channel is sqrt-scaled while red and blue stay linear, so near-silent bins already glow instead of reading black. `egui/src/visualization.rs:202-206` — At value=0.02 (quiet content), sqrt(0.02)*210 is about 30 while linear red is about 5, so green dominates and crushes usable contrast at exactly the low-magnitude end where the heatmap needs it most.

**R265.** _(design)_ egui has no gauge/needle/strobe display-mode switch; the cents readout is permanently locked to one bar-and-dot style. `egui/src/visualization.rs:94-111 (draw_cents_gauge)` — grep -rn "DisplayMode|needle|strobe" egui/src/ returns nothing and draw_cents_gauge hardcodes one rendering path with no branch or stored preference, so a returning user's chosen web display style has no native-app equivalent.

**R266.** _(bug)_ VisualizationHistory::capture() records silence as a literal 0-cent reading instead of skipping it the way the web history does. `egui/src/visualization.rs:17-23` — pitch-core/src/engine.rs:151 sets cents=0.0 whenever no pitch is detected, and capture() pushes state.cents into history on every changed frame with no frequency/confidence check, so silent gaps render as "perfectly in tune"; web/src/composables/useCentsHistory.ts:21 explicitly guards with if (!detected) return.

**R267.** _(bug)_ VisualizationHistory::capture() clones the entire spectrum Vec into a VecDeque ring buffer on every captured frame while the spectrogram is enabled. `egui/src/visualization.rs:24-28` — This is a second, egui-local Vec<f32> allocation (up to 512 elements) stacked on top of the engine's own per-DetectionFrame spectrum clone tracked separately under R26; a preallocated ring of fixed-size rows reused in place would avoid the repeated allocation whenever show_spectrogram is on.

### Native Audio & Desktop Platform (new audio-input crate, Tauri, egui) (44)

**Q26 — audio-input shared crate** _(audio-input/src/lib.rs)_:

**R268.** _(bug)_ process_frames() (audio-input/src/lib.rs:292-314) runs on_frame with no catch_unwind, and InputStream::stop() (lib.rs:158-163) discards any panic via `let _ = processor.join()`. `audio-input/src/lib.rs` — A panic in on_frame (e.g. Tauri's app.emit in desktop/src-tauri/src/native_audio/stream.rs:19-23) kills the processor thread silently: samples_rx drops, the cpal callback's try_send starts failing, and capture looks alive since play() already returned Ok but never processes another frame.

**R269.** _(idea)_ find_input_device (audio-input/src/lib.rs:183-196) discards the Err case from host.input_devices() and always falls through to the generic "device no longer available" message. `audio-input/src/lib.rs` — A genuine host-level failure (audio subsystem down, permission revoked mid-session) becomes indistinguishable from a simple unplugged device, which misleads any retry or diagnostic logic built on the error text.

**R270.** _(split)_ build_input_stream (audio-input/src/lib.rs:212-245) enumerates all 10 cpal SampleFormat variants for input, and egui/src/audio.rs:99-111 (build_tone_stream at 139-167) re-derives the identical 10-arm match for output outside the shared crate. `egui/src/audio.rs` — Every future native output feature, or any new cpal sample format, has to be hand-updated in two places instead of one.

**R271.** _(bug)_ The cpal input callback (audio-input/src/lib.rs:269) does `data.chunks(channels).take(AUDIO_CHUNK_CAPACITY)` with AUDIO_CHUNK_CAPACITY = 8,192 (lib.rs:7), silently dropping the tail of any larger driver batch. `audio-input/src/lib.rs` — Large ASIO/CoreAudio buffers or aggregate/Bluetooth devices lose audio with no counter, log, or backpressure signal to indicate it happened.

**R272.** _(bug)_ InputStream::stop() (audio-input/src/lib.rs:158-163) joins its processor thread with no timeout, and egui's toggle_mic (egui/src/app.rs:78-90) invokes it synchronously from eframe::App::update (app.rs:322-324). `audio-input/src/lib.rs` — Any on_frame call that blocks freezes the whole UI thread and window with no recovery short of a force-kill.

**R273.** _(bug)_ input_device_names() (audio-input/src/lib.rs:176-181) collects device.name() with no dedup handling, and find_input_device (lib.rs:183-196) matches on `name == selected`, always returning the first hit. `audio-input/src/lib.rs` — A multi-port interface reporting duplicate driver names shows two combo-box entries where the second can never actually be opened.

**R274.** _(idea)_ AudioChunk::new() (audio-input/src/lib.rs:45-51) always boxes the full 8,192-sample (32KB) AUDIO_CHUNK_CAPACITY, and the pool preallocates 4 of them (128KB, lib.rs:8,116-120) with no knob tied to any runtime configuration. `audio-input/src/lib.rs` — This is fixed steady-state overhead regardless of use case; the real sizing driver is the per-callback truncation bound (see the truncation item above), not window_size, so any fix must not naively shrink to the configured window or it reintroduces that truncation.

**R275.** _(bug)_ process_frames() only returns a chunk to the pool after on_frame finishes (audio-input/src/lib.rs:310,312), and the realtime cpal callback pulls from that same 4-buffer pool (AUDIO_CHUNK_POOL_SIZE = 4, lib.rs:8) via `pool_rx.try_recv()` (lib.rs:265). `audio-input/src/lib.rs` — A handler that's merely slow, not crashing (heavier DSP, JSON serialize, Tauri app.emit), starves the pool within a handful of callbacks and starts dropping live input, not just delaying a repaint.

**R276.** _(bug)_ test-core.yml scopes every step to `-p pitch-core` (comment at line 31, `cargo test -p pitch-core --all-features` at line 42), and no other workflow (build-tauri.yml, build-egui.yml, release.yml) ever runs `cargo test`. `.github/workflows/test-core.yml` — The two audio-input tests (audio-input/src/lib.rs:320-334) and two native_audio::frame tests (desktop/src-tauri/src/native_audio/frame.rs:120-148) can silently start failing with zero CI signal.

**R277.** _(idea)_ InputConfig::normalized() (audio-input/src/lib.rs:31-37) clamps window_size to [64, MAX_WINDOW_SIZE] but for frame_interval only replaces Duration::ZERO with the default, leaving an oversized interval untouched. `audio-input/src/lib.rs` — An unreasonably large caller-supplied interval silently starves process_frames's emit gate (`last_frame.elapsed() >= frame_interval`, lib.rs:308) for that whole span with no validation error.

**Q27 — desktop native_audio service** _(desktop/src-tauri/src/native_audio.rs, native_audio/frame.rs, native_audio/stream.rs)_:

**R278.** _(bug)_ stop_native_audio clears the control handle before the stop is confirmed, risking two concurrent capture streams. `desktop/src-tauri/src/native_audio.rs:93-107` — `.take()` at line 98 empties `state.control` before the subsequent `control.stopped.recv_timeout(Duration::from_secs(2))` (lines 101-104) is even awaited; if that wait times out (e.g. `InputStream::stop()` blocked joining a wedged processor thread per audio-input/src/lib.rs:158-163), the function returns Err with control already None, so the next start_native_audio call (control.is_some() check at line 38) spawns a second cpal input stream while the first is still tearing down.

**R279.** _(bug)_ A start_native_audio startup timeout can permanently orphan the spawned audio thread with no owner able to reach it. `desktop/src-tauri/src/native_audio.rs:51-64` — On a `ready_rx.recv_timeout` timeout, `stop_tx.send(())` fires (line 61) but `state.control` is only ever set in the `Ok(Ok(()))` arm (lines 52-56); if `stream::NativeAudioRuntime::create` (native_audio/stream.rs:11-27) never returns because it is stuck opening the device, `run_audio_thread` (lines 67-90) never reaches `stop_rx.recv()` at line 88, so the buffered stop is never consumed and the thread plus its mic handle leak for the process lifetime with no reference left anywhere to cancel it.

**R280.** _(bug)_ set_native_audio_range always reports success even when the requested range is silently discarded. `desktop/src-tauri/src/native_audio.rs:109-122` — `NativeAudioRange::normalized()` (native_audio/frame.rs:22-34) replaces any tight/close custom range with the hardcoded 24-1200Hz default whenever `max_frequency <= min_frequency * 1.2`, but `set_native_audio_range`/`set_range` (native_audio.rs:109-122) always return `Ok(())` without comparing the normalized result to the caller's input, so the frontend has no way to detect that its requested range was overridden.

**R281.** _(idea)_ Tauri's native audio path has no microphone picker at all, unlike its egui sibling on the same crate. `desktop/src-tauri/src/native_audio/stream.rs:17-18` — `InputStream::open` is always called with `InputConfig::default()` (device_name: None) and `start_native_audio`'s signature (native_audio.rs:26-31) never accepts a device name, pinning the Tauri app to the OS default input, while `egui/src/audio.rs:44-47` passes `device_name: self.selected_input_device.clone()` through the identical `InputConfig` struct, so a multi-interface guitarist can pick an input device on egui but not on desktop (Tauri).

**R282.** _(bug)_ start_native_audio holds the control mutex across its whole startup wait, so the Stop button can silently block for up to 2 seconds. `desktop/src-tauri/src/native_audio.rs:34-64` — The `MutexGuard` from `state.control.lock()` (lines 34-37) is reassigned inside the `Ok(Ok(()))` match arm (line 53), so it stays alive for the entire `ready_rx.recv_timeout(Duration::from_secs(2))` wait; `stop_native_audio` (lines 93-98) needs that same lock to send its stop signal, so a Stop click during a slow mic start blocks invisibly to the frontend for up to 2 seconds.

**R283.** _(split)_ NativeAudioRange::normalized() hand-copies web's pitch-range clamp constants instead of sharing them. `desktop/src-tauri/src/native_audio/frame.rs:24-26` — The clamp bounds (20,600)/(80,1800) and the `max_frequency <= min_frequency * 1.2` fallback ratio are duplicated verbatim in `web/src/utils/pitch.ts:55-58` (`normalizePitchDetectionRange`), so the two independently maintained implementations can silently diverge with no shared constant or parity test between the Rust and TypeScript sides.

**R284.** _(split)_ The Tauri-to-web native-audio-frame event name is a bare string literal duplicated by hand on both sides. `desktop/src-tauri/src/native_audio/frame.rs:4` — `EVENT_NAME` is a `pub(crate)` const ("native-audio-frame") that never leaves the Rust crate, while `web/src/composables/useNativeAudioInput.ts:71` re-types the identical literal by hand in `listenFn<NativeAudioFrame>('native-audio-frame', ...)`, so renaming the event on either side compiles cleanly and just silently stops delivering frames at runtime.

**R285.** _(idea)_ NativeFrameProcessor's live-range-change branch has zero test coverage. `desktop/src-tauri/src/native_audio/frame.rs:90` — `process()` only calls `engine.set_detection_range(...)` when `range != self.range` (the entire reason range is threaded per-call instead of fixed at construction), but the only test that calls `process()` (`processor_uses_shared_pitch_core`, frame.rs:132-148) builds the processor and calls process with the same range both times, so that branch is never exercised by either test in the module.

**Q28 — egui app/audio/state modules** _(egui/src/app.rs, egui/src/audio.rs, egui/src/state.rs, egui/src/main.rs)_:

**R286.** _(bug)_ Stopping the mic leaves a stale device-error banner on screen because clear_detection() never resets `error`. `egui/src/state.rs:37-46; egui/src/app.rs:79-90, 195-197` — draw_header renders state.error unconditionally regardless of `listening`, so a transient device error the user already acted on by stopping the mic keeps showing until the next successful detection frame or an app restart.

**R287.** _(split)_ egui/src/main.rs ships a wasm32-only feed_audio_samples FFI entry point and WEB_ENGINE/WEB_STATE globals that nothing calls. `egui/src/main.rs:15-21, 23-40, 62-86` — The project's actual WASM pipeline (web/package.json build:wasm) targets pitch-core directly via wasm-pack, not this egui crate; grep across the repo finds zero callers of feed_audio_samples, so this is a second, unreachable wasm entry point to maintain.

**R288.** _(design)_ "Edit current tuning" mutates the built-in Tuning in place with no persistence and no reset control. `egui/src/app.rs:223-241, 355-367` — save() persists only a4/tuning_index/show_spectrum/input_device/show_spectrogram, so an in-session Hz edit silently vanishes on restart while giving no "edited" indicator or way to revert to the shipped default.

**R289.** _(design)_ The Space/M/R keyboard shortcuts wired in handle_shortcuts are never surfaced anywhere in the UI. `egui/src/app.rs:161-170, 276-286` — The mic button just reads "Start mic"/"Stop mic" and the tone button reads "Reference tone" with no tooltip or accelerator hint, so the shortcuts are undiscoverable without reading source.

**R290.** _(bug)_ restart_mic bypasses toggle_mic's stop-branch cleanup, so switching input device mid-session skips the visualization/engine/state reset. `egui/src/app.rs:108-115, 82-88` — restart_mic manually calls stop_input() and sets listening=false itself before calling toggle_mic, which then sees listening=false and takes the START branch, so the old device's smoother/history state carries into the new stream instead of being cleared.

**R291.** _(bug)_ TunerViewState::apply unconditionally clears `error` on every successful frame, so a transient device error can be overwritten before a repaint ever shows it. `egui/src/state.rs:25; egui/src/audio.rs:48-57, 58-63` — The frame and error closures write the same Mutex from different threads roughly every 33ms, so a transient error that doesn't stop capture outright is routinely clobbered by the next successful frame before the UI reliably displays it.

**R292.** _(design)_ The native window ships with no icon even though desktop/src-tauri/icons/ already has usable PNG/ICNS assets. `egui/src/main.rs:44-49` — NativeOptions only sets with_inner_size/with_min_inner_size with no .with_icon(...), so the taskbar/dock/Alt-Tab entry falls back to eframe's generic default instead of the project's own icon.png/32x32.png/128x128.png.

**R293.** _(bug)_ The global Space shortcut can double-fire toggle_mic when the Start/Stop button itself holds keyboard focus. `egui/src/app.rs:161-166, 276-285` — egui activates a focused clickable widget on Space, so tabbing to the mic button and pressing Space triggers both the global handler and the button's own activation in the same frame, toggling the mic twice.

**R294.** _(bug)_ A persisted input device name is restored from storage but never revalidated against the freshly enumerated device list. `egui/src/app.rs:48-50, 246-266; egui/src/main.rs:53-58` — If the previously selected mic is gone, the ComboBox still shows it selected and the first "Start mic" click fails with find_input_device's "Input device is no longer available" error (audio-input/src/lib.rs:192), with no automatic fallback or startup warning.

**R295.** _(bug)_ The reference tone keeps sounding the frequency it was started with even after A4 or the tuning selection changes. `egui/src/app.rs:117-131, 214-221, 307-317; egui/src/audio.rs:139-167` — The A4 slider and tuning switch only call engine.set_a4/set_tuning and never touch self.audio, so a tone already playing keeps the stale frequency baked into cpal's output closure until manually stopped and replayed.

**R296.** _(bug)_ Editing a tuning string's Hz value leaves its note-name label stale. `egui/src/app.rs:223-241 (slider at 232, label at 230)` — The Hz slider only mutates string.frequency; string.name/octave used in the row's label are never updated, so a string dragged across the full 20-1200 Hz range keeps showing its original note name next to an unrelated frequency.

**R297.** _(design)_ Cents/confidence renders as a real reading before the mic is ever started. `egui/src/app.rs:172-198 (unconditional label at 182-186 vs. guarded Hz label at 179-181)` — The Hz label is correctly guarded by `if let Some(frequency)`, but the cents/confidence label right below it is unconditional, so a cold launch with cents=0.0/confidence=0.0 defaults permanently shows "0.0 cents · confidence 0%" as if a real silent reading had been taken.

**R298.** _(idea)_ Device enumeration runs as a synchronous cpal scan inside eframe::run_native's creation closure, blocking the first frame. `egui/src/main.rs:53-58; audio-input/src/lib.rs:176-181` — input_device_names() does a blocking cpal::default_host().input_devices() call before any window is shown, so a slow or hanging ALSA/JACK backend delays the app's first paint with no splash or feedback.

**Q29 — Tauri release/signing/CSP/distribution** _(desktop/src-tauri/tauri.conf.json, .github/workflows/build-tauri.yml, release.yml)_:

**R299.** _(bug)_ tauri.conf.json:28's CSP whitelists the Vite dev-server origins (http://localhost:5173, ws://localhost:5173, and 127.0.0.1 equivalents) in connect-src, and with beforeBuildCommand empty and no dev/prod config split, every signed release build ships this identical permissive policy. `desktop/src-tauri/tauri.conf.json:28` — Shipped release .app/.dmg/.exe webviews carry a connect-src exception for a dev-only address they never need, needlessly widening the CSP attack surface in production.

**R300.** _(bug)_ entitlements.plist grants com.apple.security.device.audio-input and com.apple.security.network.client (lines 5-6, 9-10) without ever setting com.apple.security.app-sandbox: true, so both entitlements are currently inert. `desktop/src-tauri/entitlements.plist` — The moment sandboxing is enabled for hardened signing, this silently hands an app with no network code (lib.rs registers only opener and store, no HTTP client) unrestricted outbound networking.

**R301.** _(bug)_ tauri_plugin_opener::init() (lib.rs:7) is registered and granted opener:default in capabilities/default.json, but grepping every .rs/.ts/.vue/.js file in the repo finds no other reference to it. `desktop/src-tauri/capabilities/default.json` — Dead plugin registration and permission grant add attack surface and bundle weight for a capability the app never exercises.

**R302.** _(bug)_ release.yml:51 sets the release job to if: always() over needs: [build-web, build-tauri, build-egui], so "Create GitHub Release" (lines 110-121) still runs and publishes even when build-tauri or build-egui fails, since softprops/action-gh-release silently skips unmatched file globs instead of failing. `.github/workflows/release.yml:51` — A failed desktop build can ship a public release missing the Tauri or egui binaries with no red CI signal to catch it.

**R303.** _(design)_ build-egui.yml:63-71 copies the raw guitar-tuner-egui[.exe] binary straight into the release artifact with no .app bundle, icon, Info.plist, or code signing, unlike build-tauri.yml's dmg/app/nsis bundles built from tauri.conf.json metadata. `.github/workflows/build-egui.yml:63-71` — A macOS user downloading the egui build gets a Gatekeeper-quarantined bare Mach-O with none of the packaging polish of the Tauri release.

**R304.** _(split)_ The version string "0.1.0" is hand-typed independently in version.json, tauri.conf.json:4, desktop/src-tauri/Cargo.toml:3, egui/Cargo.toml:3, and desktop/package.json:4, with no single source of truth or CI check that they match. `version.json` — release.yml:62 tags the GitHub Release from version.json alone, so nothing stops the Tauri or egui binary embedding a version number that doesn't match the git tag it ships under.

**R305.** _(bug)_ desktop/src-tauri/Cargo.toml:7 still ships the create-tauri-app scaffold placeholder repository = "https://github.com/yourname/guitar-tuner" in real crate metadata. `desktop/src-tauri/Cargo.toml:7` — The placeholder URL is visible via cargo metadata and any generated SBOM, misleading anyone auditing crate provenance from the release binary.

**R306.** _(split)_ Cargo.toml:23-26 enables the tauri tray-icon and image-png features, but no TrayIcon/TrayIconBuilder/system-tray code exists anywhere under desktop/src-tauri/src. `desktop/src-tauri/Cargo.toml:23-26` — Compiling in an unused system-tray feature set costs binary size and build time for functionality the app never uses.

**R307.** _(bug)_ tauri.conf.json:49-51 configures windows.wix.language: ["en-US", "ru-RU"], but build-tauri.yml's windows-latest matrix entry (line 31) only builds --bundles nsis, leaving the wix block dead and its locale list duplicated in an incompatible format by the adjacent nsis.languages: ["English", "Russian"] (lines 52-54). `desktop/src-tauri/tauri.conf.json:49-54` — Two divergent, never-reconciled locale lists sit under a bundler (WiX/MSI) that the release pipeline never actually invokes.

**R308.** _(bug)_ useNativeAudioInput.ts:38-39 dynamically imports @tauri-apps/api/core and @tauri-apps/api/event, but web/package.json only declares @tauri-apps/plugin-store as a dependency; @tauri-apps/api resolves today only because plugin-store transitively depends on it (^2.11.0, confirmed in node_modules). `web/src/composables/useNativeAudioInput.ts:38-39` — Any lockfile or hoisting change that stops surfacing the transitive package breaks native mic input with no compile-time warning.

**R309.** _(bug)_ desktop/package.json declares "@tauri-apps/cli": "^2" as a devDependency, but every script (tauri, dev, build, build:debug, icon) hardcodes ../web/node_modules/.bin/tauri instead, while web/package.json separately pins a different range (^2.11.2). `desktop/package.json` — desktop's own CLI dependency is dead weight, and its build is only reproducible if web/ has already been npm-installed first.

**R310.** _(split)_ tauri.conf.json:17-20 sets the window to 720x640 (min 520x580) while egui/src/main.rs:46-47 sets with_inner_size([720.0, 720.0]) / with_min_inner_size([520.0, 600.0]) — same product, two hand-typed shells with silently diverging height and min-height. `desktop/src-tauri/tauri.conf.json:17-20` — The Tauri and egui shells present different default window proportions for the same app with no shared constant keeping them in sync.

**R311.** _(design)_ tauri.conf.json:53 sets NSIS installMode: "perMachine" (requiring UAC elevation) while certificateThumbprint is null (line 46) and neither build-tauri.yml nor release.yml contains a Windows signing step. `desktop/src-tauri/tauri.conf.json:53` — Users already facing an "Unknown Publisher" SmartScreen warning on the unsigned installer are additionally forced through an admin elevation prompt that perUser would avoid until signing exists.

### Testing / CI / Build / Release / Offline (38)

**Q30 — test coverage & CI wiring** _(web/tests/*, web/e2e/*, pitch-core/tests/pitch_core.rs, .github/workflows/*)_:

**R312.** _(bug)_ Playwright E2E never runs in any GitHub Actions workflow. `.github/workflows/build-web.yml` — package.json's test:e2e/test:e2e:install scripts (web/e2e/synthetic-fixture.spec.ts) are invoked by none of the 7 workflow files; build-web.yml's "Run web tests" step only runs `npm test` (vitest), so the repo's only browser-level check runs exclusively when a human remembers to run it locally.

**R313.** _(bug)_ audio-input and desktop/src-tauri crate unit tests never execute in CI. `Cargo.toml` — test-core.yml scopes `cargo test` to `-p pitch-core` only, build-tauri.yml runs just `tauri build`, and build-egui.yml runs just `cargo build --release`, so the real #[test] functions in audio-input/src/lib.rs (process_frames/SampleWindow) and desktop/src-tauri/src/native_audio/frame.rs never run automatically.

**R314.** _(bug)_ build-web.yml provisions no Rust toolchain, yet `npm test` shells out to a cold `cargo run`. `web/tests/rustDomainParity.test.ts` — loadRustSnapshot() (lines 52-68) calls execFileSync('cargo', ['run', '--quiet', '-p', 'pitch-core', '--example', 'domain_snapshot']), but build-web.yml has no Setup-Rust/rust-cache step (unlike test-core.yml), so this dependency is unpinned, uncached and undeclared as a job requirement.

**R315.** _(bug)_ The `/deploy` PR-comment trigger has no author-association gate and deploys into the shared production Pages environment. `.github/workflows/pr-deploy.yml` — line 22 checks only that the comment body contains `/deploy`, never `github.event.comment.author_association`, and with pages:write/id-token:write permissions it builds and deploys the commenting PR's own head ref - a pwn-request pattern any commenter can trigger; pr-deploy.yml, deploy.yml and release.yml all declare the identical `environment: { name: github-pages }`, so the comment overwrites the live production tuner until the next release.

**R316.** _(bug)_ `if-no-files-found: warn` lets an empty desktop/egui bundle upload succeed as a green build. `.github/workflows/build-tauri.yml` — build-tauri.yml:91 and build-egui.yml:79 both set `if-no-files-found: warn` on actions/upload-artifact, so a matrix leg producing no bundle still reports success, and release.yml gates the GitHub Release purely on `needs.build-*.result == 'success'`, letting a release publish silently missing a platform binary.

**R317.** _(bug)_ The `?fixture=` synthetic-audio override works identically in production with no DEV gate or on-screen indicator. `web/src/utils/syntheticAudio.ts` — syntheticAudioFixtureFromLocation() (lines 54-57) reads `?fixture=` from window.location.search with no import.meta.env.DEV check, useTunerSession.ts wires it in unconditionally, and the resulting `usingSyntheticAudio` flag (returned by useTuner.ts) is never referenced in any .vue template, so a live production URL with `?fixture=440hz` silently fabricates a tone instead of using the microphone.

**R318.** _(bug)_ HybridPitchDetector's MPM fallback branch is never exercised by a test. `pitch-core/src/dsp/detector.rs` — `detect` (lines 116-124) is `self.yin.detect_centered(...).or_else(|| self.mpm.detect_centered(...))`, but every test in pitch-core/tests/pitch_core.rs feeds clean single-tone or DC-biased sine buffers on which YIN succeeds, so the `or_else` fallback to MPM is never actually taken.

**R319.** _(split)_ version.json is parsed and diffed three different, undeduplicated ways across workflow files. `.github/workflows/build-web.yml` — build-web.yml:26 and release.yml:62 both use `node -p 'require("./version.json").version'` while pr-deploy.yml:64 uses `jq -r .version version.json`; build-web.yml:43 also checks "already released" via `git tag -l` while release.yml:72 uses `git rev-parse` for the same check, with no shared composite action (no `.github/actions/` exists) backing any of it.

**R320.** _(bug)_ The E2E status assertion is a locale-blind tautology that could never catch a broken English string. `web/e2e/synthetic-fixture.spec.ts` — line 8 asserts session-status `toContainText(/LISTENING|СЛУШАЕТ/)` without ever selecting a language first, and l10n.ts's `initialLang()` defaults to 'ru' for a fresh context with no localStorage, so the page always renders "СЛУШАЕТ" and the test would pass identically if the English string were deleted.

**R321.** _(split)_ core.test.ts and test-core.mjs are the same test suite written twice, and the second copy is dead. `web/src/utils/core.test.ts` — both files assert identical capo/tuning/temperament/pitch-detection behavior with matching numeric tolerances, but web/scripts/test-core.mjs is reachable only via the unused `test:core:legacy` script (package.json:14), which neither `npm test` (`vitest run src tests`) nor any CI workflow ever calls, leaving ~140 lines of dead duplicate assertions that can drift silently.

**R322.** _(bug)_ rustDomainParity.test.ts's cold `cargo run` has no vitest timeout override. `web/tests/rustDomainParity.test.ts` — execFileSync('cargo', ['run', ...]) (lines 54-64) runs synchronously with no `testTimeout` override anywhere in the codebase (absent from web/vite.config.ts and the test file itself), so compiling pitch-core plus its domain_snapshot example from a cold `target/` on a fresh checkout can exceed vitest's 5000ms default and fail nondeterministically.

**R323.** _(bug)_ serviceWorker.test.ts's protocol-exclusion assertions can never fail, because vitest's PROD flag already short-circuits the check. `web/tests/serviceWorker.test.ts` — shouldRegisterServiceWorker (web/src/platform/serviceWorker.ts) is `import.meta.env.PROD && (protocol check) && 'serviceWorker' in nav`; vitest's default PROD is false, so the tauri:/file: exclusion the test claims to cover never actually runs - the test would pass identically if that exclusion were deleted.

**R324.** _(bug)_ audio-input's realtime frame-cadence dispatcher `process_frames` has zero test coverage. `audio-input/src/lib.rs` — `process_frames` (lines 292-314) gates detection to `frame_interval` and recycles chunks through the pool channel, but the only tests in the file (lines 320-334) cover `SampleWindow::push`/`copy_ordered` in isolation, leaving the realtime-safety-critical cadence/recycling logic completely unexercised.

**R325.** _(bug)_ InputConfig::normalized()'s clamp logic and find_input_device()'s branches are untested pure logic. `audio-input/src/lib.rs` — `normalized()` (lines 30-37) clamps `window_size` to [64, 8192] and resets a zero `frame_interval` to the 33ms default, and `find_input_device()` (lines 183-196) has named-found/named-missing/no-device branches needing no real hardware, yet neither has a single test in the crate.

**R326.** _(bug)_ release.yml's always()-gated release job downloads the web artifact without the success-gate the tauri/egui downloads get. `.github/workflows/release.yml` — the release job (line 51: `if: always()`) correctly gates "Download Tauri artifacts" (line 91) and "Download egui artifacts" (line 98) on `needs.build-*.result == 'success'`, but "Download web artifact" (lines 79-84) only checks the version-skip output, so a failed build-web still triggers a hard-failing download of a never-uploaded `github-pages` artifact instead of degrading gracefully.

**R327.** _(bug)_ playwright.config.ts's `trace: 'on-first-retry'` can never fire because retries stay at Playwright's 0 default. `web/playwright.config.ts` — line 11 sets `trace: 'on-first-retry'`, but no `retries` key exists anywhere in the 25-line config, not even CI-conditional; since a trace only captures on a retried run, this is dead configuration that will never produce a trace artifact for a failing test.

**R328.** _(bug)_ deploy.yml's instant-deploy-from-release fast path keys off a ref that is never a release tag. `.github/workflows/deploy.yml` — line 35 sets `TAG="${{ github.ref_name }}"` then runs `gh release download "$TAG"`, but deploy.yml's only trigger is `workflow_dispatch` (line 7) whose ref selector defaults to `main` while releases are tagged `v${VERSION}`, so the job silently falls through to the full build-from-source path unless the operator manually picks a `vX.Y.Z` tag.

**R329.** _(bug)_ pr-deploy.yml's version comment reads main's version.json, not the deployed PR's. `.github/workflows/pr-deploy.yml` — the deploy job's checkout at line 60 is a bare `actions/checkout@v6` with no `ref:`, unlike the build job (lines 44-47) which correctly checks out `needs.prepare.outputs.branch`, so the final "Deployed v$VERSION" comment (line 71) reports the default branch's version whenever the PR's version.json differs from main's.

**R330.** _(bug)_ SessionLifecycle's already-listening no-op guard is never exercised by a test. `web/src/session/sessionLifecycle.ts` — line 51 (`if (this.activeBackend === backend && this.status === 'listening') return;`) is the only guard against a redundant restart, but none of the 5 cases in sessionLifecycle.test.ts call start() twice with the same backend while already listening - the one test that calls start('web') twice does so only after fail() has already reset activeBackend to null.

**R331.** _(bug)_ PitchCoreAdapter's "WASM ran but found no pitch" path has no test. `web/src/workers/pitchCoreAdapter.ts` — the `if (!detection) return { backend: 'wasm', confidence: 0, frequency: null }` branch at line 77 (the real return when the WASM detector's own detect() yields undefined, i.e. silence/no-signal) is not exercised by any of the 3 cases in pitchCoreAdapter.test.ts, which only cover a populated detection, a failed module load, and a throwing detector.

**R332.** _(bug)_ defaultTuningForInstrument's 3-level fallback chain is completely untested. `web/src/domain/tuningCalculations.ts` — the function (lines 30-38) falls back `storedTunings.find(id===defaultId) -> TUNINGS.find(id==='standard') -> TUNINGS[0]`, but neither it nor its sibling tuningsForInstrument (lines 17-28) is imported anywhere under web/tests/, so a corrupted or orphaned defaultTuningId silently returning the wrong tuning would go unnoticed.

**R333.** _(idea)_ pr-deploy.yml tells reviewers it's deploying but never tells them if it failed. `.github/workflows/pr-deploy.yml` — the workflow posts a rocket reaction and "Deploying branch..." (line 41) then, on the happy path, "Deployed v$VERSION" (line 71); there is no `if: failure()` step anywhere in the file, so a failed deploy-pages or build step leaves the PR with a stale "Deploying..." comment and no failure notice.

**R334.** _(bug)_ The repo's one E2E test only ever turns the mic on, never off. `web/e2e/synthetic-fixture.spec.ts` — the entire 12-line spec clicks `mic-toggle` exactly once (line 6); the toggle-off path and the resulting teardown (status reverting to idle, detected-note clearing) have zero end-to-end coverage.

**R335.** _(bug)_ The AudioInputPort contract test never calls or asserts setDetectionRange. `web/src/ports/audioInput.ts` — DetectionFrameInputPort.setDetectionRange (audioInput.ts:37) is part of the shared contract, and the fake native port even implements it (audioInputPort.test.ts:88), but expectPortLifecycle() (audioInputPort.test.ts:50-61) never invokes or asserts it.

**R336.** _(idea)_ Every push to main runs the full 9-job release matrix even for docs-only commits, and the version-skip check fires too late to help. `.github/workflows/release.yml` — `on: push: branches: ["main"]` (lines 8-9) has no paths/paths-ignore filter, so a markdown-only commit still triggers build-web plus all 4 build-tauri and all 4 build-egui matrix legs; the "already released" skip check (lines 72-77) only runs inside the final release job, which needs the entire matrix (lines 50-51) to finish first.

**Q31 — build/PWA/offline pipeline** _(web/src/platform/serviceWorker.ts, web/vite.config.ts, web/package.json, web/public/manifest.webmanifest)_:

**R337.** _(bug)_ web/package.json's build:wasm always exits 0 (`|| echo 'WASM build skipped or failed'`) while the SW install handler awaits an all-or-nothing `cache.addAll(PRECACHE)` in vite.config.ts, so a broken WASM build can ship as a successful release with zero offline capability. `web/vite.config.ts` — CI, the deploy step, and the browser's install event all treat this failure mode as success, so users only discover offline mode doesn't work once they're actually offline.

**R338.** _(bug)_ The SW cache-busting signature (vite.config.ts:49-54) hashes only bundler-emitted file names and never the bytes of the hardcoded `publicFiles` array (wasm/pitch_core.js, wasm/pitch_core_bg.wasm, manifest.webmanifest, lines 56-61), so a WASM-only or manifest-only release regenerates a byte-identical sw.js. `web/vite.config.ts` — Browsers skip the SW update entirely when sw.js is byte-for-byte identical, so a WASM or manifest change never reaches users who already have the app installed.

**R339.** _(bug)_ The repo's only E2E entry point runs `npm run build:tauri`, which builds with `--base ./`, exactly the base value vite.config.ts's `generateBundle` treats as a signal to skip emitting sw.js (`if (base === './' || base === '') return`, line 44). `web/playwright.config.ts` — Every Playwright run exercises a build with no service worker present at all, so offline/cache regressions can land and go undetected indefinitely.

**R340.** _(split)_ The entire service worker (install/activate/fetch handlers) is authored as an untyped JS template literal inside `createServiceWorkerSource` (vite.config.ts:74-121), invisible to TypeScript and lint until it's emitted as sw.js at build time. `web/vite.config.ts` — Neither vite-plugin-pwa nor Workbox is a dependency, so this hand-rolled caching logic gets no type checking, no linting, and no test harness beyond whatever is written by hand.

**R341.** _(idea)_ `npm run dev` (web/package.json:7) unconditionally runs `build:wasm` before every dev-server start with no mtime/hash guard, paying a full wasm-pack rebuild even when pitch-core's Rust hasn't changed. `web/package.json` — Slows every local dev iteration for contributors who aren't touching the Rust core, with no way to skip it.

**R342.** _(bug)_ The generated SW calls `skipWaiting()`/`clients.claim()` unconditionally (vite.config.ts:79-93), handing already-open tabs a new cache mid-session with no reload prompt, while App.vue's lazy-loaded AnalysisView/LibraryView/PracticeView (App.vue:8-10) use bare `defineAsyncComponent` with no error fallback. `web/vite.config.ts` — A tab left open across a deploy can fetch an old-hashed chunk the new cache never precached and fail to load that screen with no visible error or recovery.

**R343.** _(bug)_ The navigate-fetch handler (vite.config.ts:101-111) writes whatever index.html the network returns right now into `CACHE_NAME` via `cache.put(APP_SHELL, response.clone())`, independent of that cache's own frozen precache list. `web/vite.config.ts` — An old SW instance still active after a new deploy can overwrite its own cached shell with a newer index.html referencing chunk hashes it never precached, so the next fully-offline load can fail to boot.

**R344.** _(design)_ manifest.webmanifest (18 lines) has no `screenshots` array alongside its name/icons/display fields. `web/public/manifest.webmanifest` — Desktop Chrome/Edge only show the richer install dialog with preview imagery when `screenshots` is present, so this offline-first PWA gets the bare-bones install prompt.

**R345.** _(bug)_ web/package.json's `"version": "0.1.0"` (line 4) is a separate, hand-maintained field from root version.json, which vite.config.ts imports for `__PKG_VERSION__`/the SW cache name and which build-web.yml's version-bump gate checks; nothing keeps the two in sync (desktop/package.json duplicates the same unsynced field). `web/package.json` — Any future tooling that trusts package.json's semver will silently read a stale version after a release bump that only updates version.json.

**R346.** _(idea)_ `optimizeDeps.exclude: []` (vite.config.ts:28-31) is empty behind a comment claiming it supports WASM files; the wasm-pack glue module is actually loaded at runtime via a plain `new URL(...)` fetch (usePitchLoop.ts:194), never a bare import Vite would pre-bundle. `web/vite.config.ts` — The block is inert and the comment misleads anyone trying to understand how WASM loading actually works.

**R347.** _(bug)_ build-web.yml wires `VITE_APP_VERSION`/`VITE_APP_SHA` into the build step (lines 78-80), but grepping `import.meta.env` across web/src shows only BASE_URL/DEV/PROD are ever read; `__PKG_VERSION__` (vite.config.ts:9), the value these presumably exist to feed, is itself defined but never referenced anywhere in web/src. `.github/workflows/build-web.yml` — The app currently has no working runtime version display at all; this CI wiring and the `__PKG_VERSION__` define are both dead and give a false impression that one exists.

**R348.** _(idea)_ No test or CI step parses manifest.webmanifest or asserts its required PWA fields (start_url, icons, display) stay self-consistent with vite.config.ts's `base`; confirmed absent from web/tests/serviceWorker.test.ts and the Playwright specs. `web/public/manifest.webmanifest` — A stray trailing comma or a base-path typo would only surface in production as a silently-missing install prompt.

**R349.** _(idea)_ `server: { host: '0.0.0.0' }` (vite.config.ts:12-17) binds the Vite dev server to all network interfaces, commented as being for Tauri's webview access. `web/vite.config.ts` — Every `npm run dev` exposes unminified source and source maps to any device on the same LAN, not just the local Tauri process it's meant for.

### Product / UX / Visual Design (now 4-screen feature architecture) (45)

**Q32 — design system (tokens/typography/color)** _(web/src/style.css, web/src/utils/canvasPalette.ts)_:

**R350.** _(bug)_ Documented flat/sharp/tuned accent tokens (accent-flat/accent-sharp/accent-tuned/--focus) don't exist anywhere in web/src, so CentsGauge renders sharp and flat in the identical warning color. `web/src/style.css (see web/src/components/CentsGauge.vue:39)` — grep for accent-tuned|accent-flat|accent-sharp|--focus across web/src returns zero matches, and CentsGauge.vue:39 only branches on isInTune (`isInTune ? 'var(--accent)' : 'var(--warning)'`), so a player 30 cents flat and one 30 cents sharp see the exact same needle color.

**R351.** _(bug)_ canvasPalette.ts's background and grid fallback colors have drifted from the real :root tokens they mirror. `web/src/utils/canvasPalette.ts:14-18` — the fallbacks are background '#11151b' and grid '#334155', but style.css:21-22 defines --canvas-bg as #0e1217 and --canvas-grid as #3a4658 (accent/accentStrong/warning fallbacks still match correctly), so any failed getComputedStyle read would silently paint visualizers in a stale, mismatched palette.

**R352.** _(bug)_ Colorblind theme repaints the tuning-status pill's text blue but leaves its background chip green or amber underneath. `web/src/components/CentsGauge.vue:64-68` — the pill binds bg-emerald-500/15 text-emerald-400 (in tune) or bg-amber-500/10 text-amber-400 (out of tune), but style.css:803-807's .theme-colorblind block only overrides .text-emerald-300/400/500 to blue and never touches either background utility class.

**R353.** _(bug)_ The `.analysis-toolbar .segmented { margin-left: auto }` rule in style.css matches no element on the page. `web/src/style.css:338-340` — the only control inside .analysis-toolbar is DisplayModeSelector (AnalysisView.vue:28-41), which never carries a 'segmented' class (DisplayModeSelector.vue:19); the real .segmented elements live in DisplayPreferences.vue inside a separate .workspace-panel further down the same page (AnalysisView.vue:74).

**R354.** _(split)_ Three hand-rolled copies of the same single-select pill-toggle pattern are why the dead margin-left rule above exists. `web/src/components/DisplayModeSelector.vue:19-32` — style.css's .segmented class (598-625, used by DisplayPreferences.vue), DisplayModeSelector's bespoke Tailwind markup, and StringSelector's .string-btn (style.css:468-486) each reimplement a mutually exclusive toggle group with independent class names and active-state styling; one shared SegmentedControl would remove the class-name mismatch entirely.

**R355.** _(bug)_ A whole cents-bar CSS component and its colorblind palette override are dead code with zero matching elements in any Vue file. `web/src/style.css:438-466,795-801` — grep for cents-bar across web/src/**/*.vue returns nothing; the actual cents-history view wired in (AnalysisView.vue:66, CentsHistoryGraph.vue) renders its own inline SVG polyline, not this markup, yet a colorblind override (795-801) was still added for classes nothing ever used.

**R356.** _(design)_ The live cents number stays fixed at 10px in every layout mode while the note letter beside it scales up to 9rem in Stage mode. `web/src/components/CentsGauge.vue:21-25` — the +/-50 bound labels and live cents value use Tailwind's text-[10px] with no responsive or .layout-stage override anywhere in style.css, while .note-letter has five separate size rules (style.css:424,433,669,690,814) including a Stage-mode bump, so the number that says exactly how far off pitch you are stays microscopic in the mode built for glanceability.

**R357.** _(design)_ NoteDisplay's dominant 7rem/9rem note letter is hardcoded emerald and never reflects tuning state. `web/src/components/NoteDisplay.vue:22` — its defineProps has no isInTune or cents field, and LiveTunerView.vue binds is-in-tune only to CentsGauge (line 53), not to NoteDisplay (lines 41-49), so the biggest glyph on screen is decorative green whether the player is 40 cents flat or dead on pitch.

**R358.** _(design)_ TemperamentPanel recolors its interval-comparison numbers with the same emerald/amber pair the app uses elsewhere to mean 'in tune' vs 'needs adjustment'. `web/src/components/TemperamentPanel.vue:92-93` — `row.cents > 0 ? 'text-emerald-300' : 'text-amber-300'` labels whether a Just/Pythagorean/Werckmeister interval sits above or below equal temperament, a neutral musicological fact, using the exact color pairing that signals correctness everywhere else in the app.

**R359.** _(bug)_ MicButton's focus ring hardcodes a dark-theme surface color instead of the app's themed focus rule. `web/src/components/MicButton.vue:22` — focus:ring-offset-[#11151b] is a literal, not a CSS var, and MicButton is the only component in web/src using Tailwind's focus:ring instead of the global `button:focus-visible { outline: 2px solid var(--accent) }` rule (style.css:416-422); .theme-light overrides .bg-[#11151b] but not this ring-offset utility, so keyboard-focusing the mic button in Light theme shows a near-black halo.

**R360.** _(bug)_ The mic button's recording pulse-glow keyframe stays hardcoded red even in colorblind mode. `web/src/style.css:545-548,784-787` — @keyframes pulse animates box-shadow with rgba(239, 68, 68, ...) unconditionally outside any theme scope, and .theme-colorblind .mic-btn.listening only swaps the button's background/border to orange, so the one theme meant to stop relying on red/green cues still pulses a red halo around an orange body.

**R361.** _(split)_ Two different hardcoded greens (#22c55e) compete with the --accent token (#34d399) for the same 'correct/selected' meaning. `web/src/style.css:16,478-482,456-460` — --accent drives btn-primary/segmented-active/canvas accents, but .string-btn.active, .cents-bar .fill, and LevelMeter.vue:18's bg-[#22c55e] are hardcoded Tailwind-green-500 literals that never route through the token, so the string rail and the primary CTA show two visibly different greens for what's meant to be one concept.

**Q33 — interaction design & feature-view states** _(web/src/features/tuner/LiveTunerView.vue, features/practice/PracticeView.vue, features/library/LibraryView.vue, features/analysis/AnalysisView.vue)_:

**R362.** _(bug)_ Leaving Library mid-edit via the tab bar silently discards an unsaved custom tuning or temperament draft. `web/src/components/CustomTuningEditor.vue:25-26,60-62` — CustomTuningEditor and TemperamentPanel.vue:26-27,61 hold draft name/offsets in local refs reset by an immediate:true watcher, and App.vue:109-112 tears LibraryView down via v-else-if on every tab switch, so a half-typed custom tuning or temperament vanishes with no warning or recovery.

**R363.** _(bug)_ LibraryView's StringSelector has no chromatic-mode fallback, unlike the identical selector on Live Tuner. `web/src/features/library/LibraryView.vue:43-52` — LiveTunerView.vue:67-77 shows a v-else chromatic-mode hint when strings.length is 0, but LibraryView gates the same StringSelector with only v-if and no v-else, leaving a silent blank gap when a chromatic tuning is picked from Library.

**R364.** _(bug)_ Analysis shows the 'switch off Native audio' message even when the user simply hasn't pressed Start yet. `web/src/features/analysis/AnalysisView.vue:59-61` — The empty-panel copy picks between t('analysis.native') and t('analysis.idle') based solely on usingNativeAudio (useTunerSession.ts:46-50), which is true as soon as the Native backend is selected regardless of isListening, so a first-time Native user sees the wrong reason for the empty panel.

**R365.** _(bug)_ The idle NoteDisplay placeholder renders at roughly half the height of the detected-note glyph, so the panel resizes on every detection blip. `web/src/components/NoteDisplay.vue:29` — The detected note uses .note-letter (style.css:424-430, font-size 7rem) while the 'no signal' dash is Tailwind's default text-6xl (3.75rem), so each isDetected flip during natural pluck gaps reflows the live panel's height.

**R366.** _(bug)_ Practice's Correct/Miss/Reveal buttons can be tapped before any ear-training note has been generated or heard. `web/src/components/EarTrainingPanel.vue:44,47,50,53` — Only Play is guarded with :disabled="!target"; tapping Correct on a fresh tab calls mark(true) -> ensureTarget() (useEarTraining.ts:18-23,40-50), which silently spawns a hidden note and banks a real streak/accuracy point for a note the user never played or heard.

**R367.** _(design)_ Changing needle/gauge/strobe display mode on the Analysis tab silently changes it on Live Tuner too, since both feature ports share the same ref. `web/src/app/featurePorts.ts:16,127` — createLiveTunerPort and createAnalysisPort both expose the identical root.displayMode ref to their own DisplayModeSelector instance, so a setting changed while reading Analysis's spectrum reconfigures the primary Tuner screen with no indication the two are linked.

**R368.** _(idea)_ Deleting a custom tuning, temperament, or instrument profile, or clearing practice history, all fire immediately on a single click with no confirmation or undo. `web/src/components/CustomTuningEditor.vue:112-118` — The same bare @click-straight-to-destructive-action pattern repeats in TemperamentPanel.vue:128-135, InstrumentProfileEditor.vue:54-60, and PracticeStatsPanel.vue:73-75, so a mis-tap permanently erases hand-tuned data or a practice streak.

**R369.** _(split)_ TuningSelector's v-for loop variable t shadows the useL10n() translate function it is named after. `web/src/components/TuningSelector.vue:14,31` — const { t } = useL10n() at the top is re-bound to each Tuning object inside <option v-for="t in tunings">, so the code only works today because nothing in the loop body calls t(...) as a translator; adding one later throws 't is not a function' at runtime.

**R370.** _(bug)_ CentsHistoryGraph plots points at evenly spaced index positions and never reads the timestamp it stores, so silence between plucks is invisible in the trend line. `web/src/components/CentsHistoryGraph.vue:12-22` — useCentsHistory.ts:29 records { at: Date.now(), cents } but the polyline computed only uses x = (index / maxIndex) * 100, so a 2-second pluck followed by 20 seconds of silence and another pluck renders as two adjacent, evenly spaced dots, compressing real elapsed time out of the graph.

**Q34 — information architecture / 4-screen execution** _(web/src/App.vue, web/src/app/featurePorts.ts)_:

**R371.** _(bug)_ App.vue:60-62's `watch(tuner.layoutMode, ...)` forces `activeView` to 'tuner' the instant layoutMode becomes 'stage', hiding the app-tabs nav via style.css:655-658 (`.layout-stage .app-tabs{display:none}`) — and because layoutMode is in useSettings.ts's watched/debounced-save list (lines 174-202), even a reload restores 'stage' and re-triggers the same trap, so there is no in-app escape at all, not even via reload. `web/src/App.vue:60-62` — A guitarist who taps the Stage toggle (only reachable from AnalysisView.vue's DisplayPreferences) loses Library/Practice/Analysis permanently within that browser profile, with no nav, no shortcut, and no working reload escape since the choice is already persisted to storage.

**R372.** _(bug)_ Screen state is a bare `const activeView = ref<AppView>('tuner')` (App.vue:22) with no vue-router, history.pushState, or 'vue-router' dependency anywhere in the repo. `web/src/App.vue:22` — Library, Practice, and Analysis have no URL, can't be bookmarked or shared, and browser/OS back-gesture and reload always silently dump the user back on Tuner.

**R373.** _(split)_ CentsHistory.vue, PerStringCents.vue, and TunerControls.vue have zero references anywhere outside their own file (confirmed by repo-wide grep) and ship dead in the bundle; CentsHistory.vue's canvas graph is superseded by CentsHistoryGraph.vue (wired at AnalysisView.vue:4,66), and TunerControls.vue's mic/reference buttons duplicate the command-row now inline in LiveTunerView.vue (~line 118). `web/src/components/CentsHistory.vue, web/src/components/PerStringCents.vue, web/src/components/TunerControls.vue` — Dead weight in the bundle plus a stale backlog: recommendation.md's items 57/78/97 and M110 describe CentsHistory redraw performance as if it were still live, so fixing those items would change nothing a user sees.

**R374.** _(bug)_ The single window `keydown` listener `handleKey` (App.vue:43-58, registered at line 64) parses digit keys 1-9 into `tuner.toggleString(...)` with no check on `activeView`. `web/src/App.vue:43-58,64` — Standing on Practice or Analysis and pressing a number key silently reassigns the live tuner's selected string with zero visual feedback on the current screen.

**R375.** _(bug)_ `createAnalysisPort` exposes `start: root.start` (featurePorts.ts:145) but no `stop`, unlike `createLiveTunerPort`'s matched `start`/`stop` pair at featurePorts.ts:41-42, and AnalysisView.vue:23-25's 'Start Microphone' button (gated on `!analysis.isListening`) simply disappears once listening with nothing replacing it. `web/src/app/featurePorts.ts:145` — Stopping a mic session started from Analysis requires switching to the Tuner tab or knowing the unlabeled Space/M shortcut, since the Analysis screen has no stop control at all.

**R376.** _(design)_ `themeMode`, `layoutMode`, and `leftHanded` (featurePorts.ts:130,131,138) are wired only into `createAnalysisPort` and consumed solely by `DisplayPreferences` inside AnalysisView.vue:73-82. `web/src/app/featurePorts.ts:130,131,138` — Dark/Light/Colorblind theme, Stage/Compact layout, and left-handed string order are unreachable from Live Tuner or Library, forcing a guitarist through the screen least related to setup before they can adjust display or handedness.

**R377.** _(design)_ The footer (App.vue:115-118) renders `t('quiet.room')` ('Works best in a quiet room. Pluck one string at a time. Use manual selection for best accuracy.') and the mic/string/reference keyboard hint unconditionally on all four screens, with no `v-if` on `activeView`. `web/src/App.vue:115-118` — On Library, Practice, or Analysis the persistent footer keeps coaching live-tuning technique that has nothing to do with what's currently on screen.

**R378.** _(bug)_ `createAnalysisPort()` (featurePorts.ts:124-148) omits `error`, `clearError`, and `sessionStatus`, fields `createLiveTunerPort` does expose (featurePorts.ts:17,29,34). `web/src/app/featurePorts.ts:124-148` — A mic failure triggered from AnalysisView.vue:23 sets useTuner's `session.error` ref, but nothing on the Analysis screen can read it, so a failed start shows no error banner, no 'requesting...' state, and no indication anything went wrong.

**Q35 — accessibility-as-design (cross-cutting)** _(web/src/features/*/*.vue, web/src/components/*.vue, web/src/style.css)_:

**R379.** _(bug)_ NoteDisplay's aria-live wrapper re-announces the confidence percentage on every detection frame. `web/src/components/NoteDisplay.vue:20,25` — aria-live="polite" (line 20) wraps `conf {{ confidencePercent }}%` (line 25), which recomputes from props.confidence roughly every 33ms while listening, so a screen reader gets a continuous stream of percentage announcements instead of the stable note/cents content the live region should surface.

**R380.** _(bug)_ The App.vue tab bar declares role="tablist"/role="tab" but implements none of the required roving-focus or tabpanel wiring. `web/src/App.vue:94-106` — No keydown handler for Left/Right/Home/End, no id/aria-controls pairing, and none of the four screens the tabs render (LiveTunerView.vue, LibraryView.vue, PracticeView.vue, AnalysisView.vue) carries role="tabpanel", leaving the WAI-ARIA tab contract the roles commit to unmet for keyboard and screen-reader users.

**R381.** _(bug)_ InputDeviceSelector's <select> has no accessible name. `web/src/components/InputDeviceSelector.vue:19-24` — The device picker is labeled with a plain <span> instead of a <label>/aria-label, breaking the convention every sibling option control follows (TuningOptions.vue:31-42, StringOffsetsPanel.vue:45-64 wrap the identical pattern in <label class="option-field">), so a screen-reader user can't identify the control before picking a microphone.

**R382.** _(bug)_ DisplayModeSelector and StringSelector mark mutually-exclusive choices as independent toggle buttons instead of a radio group. `web/src/components/DisplayModeSelector.vue:26, web/src/components/StringSelector.vue:48` — Both use aria-pressed="true"/"false" on a button row where exactly one item is ever active, so a screen reader announces isolated pressed/unpressed toggles instead of positional '2 of 3' choice context.

**R383.** _(design)_ LiveTunerView is the only one of the four screens whose heading is a hidden div, not a real heading element. `web/src/features/tuner/LiveTunerView.vue:26-28` — `<div class="sr-only" id="live-tuner-heading">` stands in for an h1-h6 while LibraryView.vue:20-22, PracticeView.vue and AnalysisView.vue each render a visible <h2> inside <header class="workspace-heading">, so a screen-reader user navigating by heading level finds three level-2 headings and one unlabeled section.

**R384.** _(bug)_ MicButton exposes no pressed/on-off state to assistive tech. `web/src/components/MicButton.vue:20-29` — The button carries a static :aria-label="t('toggle.microphone')" but no aria-pressed or role="switch", unlike DisplayModeSelector.vue:26 and StringSelector.vue:48, so a screen-reader user tabbing to the app's primary control hears only 'Toggle microphone, button' with no indication of whether the mic is currently on.

**Q36 — content/copy & localization** _(web/src/stores/l10n.ts, egui/src/*.rs strings)_:

**R385.** _(bug)_ useL10n()'s t() falls back to the Russian string (not the key, not an English default) when the current language is 'en' and that key is missing from the en dictionary. `web/src/stores/l10n.ts:276-278` — The ru/en dictionaries are symmetric today (130 keys each), so the bug is dormant, but it will silently leak Cyrillic text into English mode the next time a ru-only key is added.

**R386.** _(bug)_ NoteDisplay.vue renders the confidence readout and power-chord tag as raw English template text ('conf {{ }}%' and '(power)') instead of through t(). `web/src/components/NoteDisplay.vue:25-26` — initialLang() defaults first-run visitors to Russian, so this is the one line that stays in English while every sibling label (СТРУНА/ЦЕЛЬ) is translated.

**R387.** _(idea)_ footer, random.note, reset.to.auto, standard.tuning and tolerance are translated in both ru and en dictionaries but are never read by any component, including via the dynamic t(`nav.${view}`)/t(`display.${item}`) call sites. `web/src/stores/l10n.ts:64-139 (ru), 197-272 (en)` — Dead keys get maintained and re-translated indefinitely and mislead contributors into thinking removed UI (e.g. the old flat ear-training trigger) still exists.

**R388.** _(bug)_ 'appearance.colorblind', 'sweetening', 'audio.backend.web' and 'audio.backend.native' are byte-identical English strings copy-pasted into the Russian dictionary rather than translated. `web/src/stores/l10n.ts:39,53-54,90 (ru) / 172,186-187,223 (en)` — These sit inside otherwise fully-Cyrillic panels next to Темная/Светлая/Обычный, so the Russian UI visibly code-switches mid-list.

**R389.** _(design)_ egui's tuner readout prints only raw numbers ('{:.1} cents · confidence {:.0}%') with no counterpart to the web's in.tune/adjust.flat/adjust.sharp/waiting.signal guidance text. `egui/src/app.rs:182-186 (vs. web/src/components/CentsGauge.vue:70-74)` — Desktop-native players have to mentally interpret a signed cents number instead of reading a plain-language 'FLAT - tighten' cue that the web app already has.

**R390.** _(bug)_ MetronomePanel hardcodes the literal string 'BPM' twice in the template instead of routing it through t(). `web/src/components/MetronomePanel.vue:31,51` — It is the only text in the component that isn't localized, even though every sibling label (t('beats'), t('subdivision'), t('metronome')) is.

**R391.** _(design)_ Metronome's Start/Stop/Tap button reuses the generic lowercase start/stop/tap dictionary keys while every other primary CTA in the app is authored in full caps. `web/src/components/MetronomePanel.vue:45,48 using web/src/stores/l10n.ts:33-35 (ru), 166-168 (en)` — No CSS text-transform compensates (.btn/.btn-primary in web/src/style.css:488-509 sets none), so the button visibly whispers next to ВКЛЮЧИТЬ МИКРОФОН and ЭКСПОРТ ПРОФИЛЯ.

**R392.** _(bug)_ INSTRUMENTS, TEMPERAMENTS, TUNINGS and SWEETENING_PROFILES in notes.ts carry English-only display names that are rendered directly (item.name) with no t() call anywhere in the chain. `web/src/utils/notes.ts:51-127 (and TUNINGS at 396), consumed raw at TuningOptions.vue:39,52, TuningSelector.vue:32, TemperamentPanel.vue:91, StringOffsetsPanel.vue:39` — Switching to Russian relocalizes every label and button around these lists but leaves every instrument/temperament/tuning/sweetening name inside the actual dropdowns in English.

**R393.** _(bug)_ .session-pill's max-width:116px + ellipsis under the 560px breakpoint truncates Russian status text before English text, since Cyrillic glyphs render wider at the same font size. `web/src/style.css:866-870 (breakpoint opens at 847; base white-space:nowrap rule at 127-133)` — 'ЗАПРОС МИКРОФОНА...' (19 chars) has to fit in roughly 80px of remaining pill width, so it visibly ellipsizes mid-word exactly while telling the user whether the mic is listening.

**R394.** _(bug)_ createCustomTuning/createInstrumentProfile/createCustomTemperament fall back to plain-English literals ('Custom tuning', 'Custom instrument', 'Custom temperament') when the name field is blank, and none of the three editors block saving an empty name. `web/src/domain/customLibrary.ts:32,45,71` — A Russian-language user who forgets to type a name gets an entry permanently titled in English inside an otherwise fully-Russian Library list.

## Full Top 500 Mirror

The canonical source is [TOP-500-backlog.md](TOP-500-backlog.md). This mirror keeps all 500 proposals in this file as requested. Rows with dated `[DONE]` markers are retained for traceability and are not part of the current open list; every unmarked row is open, partial, optional, or not yet revalidated.

Verified closed master items in this pass: **M1, M2, M3, M5, M6, M7, M11, M13, M22, M24, M25, M26, M29, M32, M39, M40, M41, M44, M48, M49, M50, M51, M59, M64, M65, M68, M70, M71, M177**.

<!-- TOP500_RECOMMENDATION:START -->
<details open>
<summary>Full ranked Top 500, mirrored from TOP-500-backlog.md</summary>

| M# | Tier | Val | Source | Item | Note |
| --- | --- | --- | --- | --- | --- |
| M1 | P1 | 78 | r1:review | move DSP off cpal realtime callback | [DONE 2026-07-11] |
| M2 | P1 | 76 | r1:review | remove blocking Mutex in audio callback | [DONE 2026-07-11] |
| M3 | P2 | 74 | r1:review | unify tunings and note math into pitch-core | Registry plus one generated formula owner feed Rust and TypeScript facades. [DONE 2026-07-11] |
| M4 | P2 | 73 | r1:review | octave-error guard subharmonic/NSDF |  |
| M5 | P2 | 72 | r1:review | real service worker / offline PWA | [DONE 2026-07-11] |
| M6 | P2 | 70 | r1:review | eliminate per-callback heap allocations | [DONE 2026-07-11] |
| M7 | P2 | 66 | r1:review | check Rust and TS tuning tables match | [DONE 2026-07-11] |
| M8 | P2 | 66 | r1:review | code-sign and notarize macOS/Windows |  |
| M9 | P2 | 66 | r2:algorithms | Harmonic Product Spectrum octave disambiguator from the existing 2048 FFT | Reuses current FFT to kill octave errors with minimal code. |
| M10 | P2 | 64 | r1:review | high-pass filter rumble/mains |  |
| M11 | P2 | 64 | r1:review | reconcile Rust/TS frequency-to-MIDI rounding | Both targets use the generated nearest-MIDI contract. [DONE 2026-07-11] |
| M12 | P2 | 64 | r2:algorithms | Multi-resolution dual-window analysis: long window for low strings, short for high | Fixes low-E resolution vs high-string latency tradeoff. |
| M13 | P2 | 62 | r1:review | stop resizeCanvas every frame | [DONE 2026-07-11] |
| M14 | P2 | 62 | r1:review | Tauri CSP |  |
| M15 | P2 | 62 | r1:review | adaptive noise-floor gate |  |
| M16 | P2 | 62 | r2:distribution | Verifiable '100% local, no network' privacy badge backed by CI zero-fetch test | Strong trust signal with a cheap CI assertion; differentiates from cloud tuners. |
| M17 | P2 | 62 | r2:algorithms | Adaptive per-string tau search bounds derived from the selected target | Faster, fewer-error search when string known. |
| M18 | P2 | 60 | r1:review | consolidate five rAF loops into one |  |
| M19 | P2 | 60 | r1:review | decouple detection cadence from rAF |  |
| M20 | P2 | 60 | r1:review | CI hygiene clippy/rustfmt/deploy-freshness |  |
| M21 | P2 | 60 | r2:distribution | Dedicated SEO landing page at /tuner/ targeting 'online guitar tuner' with schema.org FAQ + HowTo | Primary organic-discovery lever for a web tuner. |
| M22 | P2 | 60 | r2:dx-quality | WASM/native numeric-equivalence harness over a shared fixture manifest | Native Rust, full-frame browser WASM and TS fallback share B0-E5 cents/confidence fixtures. [DONE 2026-07-12] |
| M23 | P2 | 60 | r3:observability-reliability | Graceful-degradation matrix: explicit WASM-down / mic-down fallback states | Defines deterministic UX for every failure mode instead of blank screens. |
| M24 | P2 | 60 | r4:docs-dx | Playwright fake-WAV pipeline test asserts detected note | Feed synthetic E2 audio, assert NoteDisplay shows E. [DONE 2026-07-11] |
| M25 | P2 | 58 | r1:review | legible sidebar text | [DONE 2026-07-11] |
| M26 | P2 | 58 | r1:review | vitest unit tests note math | [DONE 2026-07-11] |
| M27 | P2 | 58 | r1:review | one-euro filter |  |
| M28 | P2 | 58 | r1:review | WebKitGTK media backend AppImage |  |
| M29 | P2 | 58 | r1:review | hardcoded 44100 in egui harmonic overlay | [DONE 2026-07-11] |
| M30 | P2 | 58 | r2:algorithms | Confidence-weighted late fusion of YIN, MPM, HPS and Goertzel into one estimate | Single fused estimate from existing detectors cuts octave/jitter errors cheaply. |
| M31 | P2 | 58 | r2:a11y-deep | Shape/texture redundancy so in-tune state never relies on color alone | WCAG non-color-reliance; trivial and broadly useful. |
| M32 | P2 | 58 | r2:dx-quality | Property-based test for frequencyToNote round-trip across A4 sweep | Deterministic Rust/TS sweeps cover A4, MIDI, cents, temperament and transpose. [DONE 2026-07-11] |
| M33 | P2 | 58 | r2:dx-quality | cargo-deny + npm audit supply-chain gate with committed advisory baseline | Blocks vulnerable deps in CI cheaply. |
| M34 | P2 | 58 | r3:observability-reliability | "Test My Mic" self-diagnostic wizard with pass/fail panel | Cuts the #1 support cause (no signal) before it becomes a bug report. |
| M35 | P2 | 57 | r2:dx-quality | Vitest fake-mic harness driving useTuner via scripted AnalyserNode stub | Deterministic frontend tuner-logic testing. |
| M36 | P2 | 57 | r3:observability-reliability | Mic-signal sanity watchdog (silent / clipping / DC-stuck warnings) | Proactively tells users why detection is wrong before they blame the app. |
| M37 | P2 | 56 | r1:review | aria-live for note and cents |  |
| M38 | P2 | 56 | r1:review | auto-advance string-by-string guided tuning |  |
| M39 | P2 | 56 | r1:review | fix CentsHistory deep watcher | [DONE 2026-07-11] |
| M40 | P2 | 56 | r1:review | bound MPM NSDF tau range | [DONE 2026-07-11] |
| M41 | P2 | 56 | r1:review | chromatic auto-detect mode | [DONE 2026-07-11] |
| M42 | P2 | 56 | r2:dx-quality | insta snapshot tests for full DetectionResult on fixture WAVs | [PARTIAL 2026-07-18] 19 real WAV temporal gates exist; per-frame golden snapshots remain. |
| M43 | P2 | 56 | r3:i18n-breadth | Browser-language auto-detect via navigator.languages with persisted override | Foundation for all localization; cheap and immediately broadens reach. |
| M44 | P2 | 56 | r4:perf-bundle | Preallocate YIN buffers as module singletons across calls | pitch.ts reallocates per size change; pin to max guitar size. [DONE 2026-07-11] |
| M45 | P2 | 56 | r4:docs-dx | Playwright E2E for mic-permission-denied flow | Drive fake getUserMedia, assert permission UI path renders. |
| M46 | P2 | 55 | r1:review | localize hardcoded English in-tune hint |  |
| M47 | P2 | 55 | r2:algorithms | Goertzel bank locked to 6 selected-string targets and their first 4 harmonics | Cheap targeted detection when string is known. |
| M48 | P2 | 55 | r4:perf-bundle | WASM streaming instantiation via instantiateStreaming for pitch-core | wasm-bindgen loader uses `instantiateStreaming`; Playwright verifies the live WASM path. [DONE 2026-07-11] |
| M49 | P3 | 54 | r1:review | validate/clamp A4 on load | [DONE 2026-07-11] |
| M50 | P3 | 54 | r1:review | gate FFT spectrum when viz hidden | [DONE 2026-07-11] |
| M51 | P3 | 54 | r1:review | reuse YIN difference buffers | [DONE 2026-07-11] |
| M52 | P3 | 54 | r2:native-os | Native mic-permission preflight via Tauri macOS AVCaptureDevice request | Avoids silent failure when OS denies mic. |
| M53 | P3 | 54 | r2:algorithms | Gaussian-window interpolation on log-magnitude FFT peaks (Jacobsen/Quinn) | Sub-bin frequency accuracy from existing FFT. |
| M54 | P3 | 54 | r3:observability-reliability | Stale-PWA / update-available checker against version.json | Stops users getting stuck on cached old builds. |
| M55 | P3 | 54 | r4:perf-bundle | Cap maxTau by selected-string frequency to shorten YIN | When string chosen, narrow lag range, fewer CMNDF iterations. |
| M56 | P3 | 53 | r1:review | first-run onboarding + mic priming |  |
| M57 | P3 | 52 | r1:review | cache Spectrum gradients |  |
| M58 | P3 | 52 | r1:review | collapsible settings sidebar on mobile |  |
| M59 | P3 | 52 | r1:review | build script copies WASM to unserved dir | [DONE 2026-07-11] |
| M60 | P3 | 52 | r2:a11y-deep | Colorblind palette presets (deuteran/protan/tritan) replacing red/green coding | Red/green in-tune coding fails ~8% of male users. |
| M61 | P3 | 52 | r2:dx-quality | Golden-trace differential runner: flag any fixture moving >1 cent | [PARTIAL 2026-07-18] Replay envelopes exist; differential baselines and the 1-cent rule remain. |
| M62 | P3 | 52 | r2:a11y-deep | Adjustable in-tune tolerance + detection smoothing as accessibility controls | Lets tremor/motor users widen the target. |
| M63 | P3 | 52 | r3:i18n-breadth | Locale-correct A4 decimal parsing accepting comma and period keypads | Prevents broken A4 entry for half the world; trivial fix. |
| M64 | P3 | 52 | r4:settings-personalization | Configurable in-tune tolerance band in cents | Slider 1-10 cents controls green-zone width directly. [DONE 2026-07-11] |
| M65 | P3 | 52 | r4:perf-bundle | Lazy-load Waveform and Spectrum via defineAsyncComponent | App.vue statically imports both; split each into its own chunk. [DONE 2026-07-11] |
| M66 | P3 | 50 | r1:review | spectrogram allocation and full redraw |  |
| M67 | P3 | 50 | r1:review | pin toolchain and wasm-pack version |  |
| M68 | P3 | 50 | r1:review | custom/editable tuning builder | [DONE 2026-07-11] |
| M69 | P3 | 50 | r1:review | web AudioWorklet detection |  |
| M70 | P3 | 50 | r1:review | strengthen TARGET vs detected note hierarchy | [DONE 2026-07-11] |
| M71 | P3 | 50 | r1:review | async device-change restart | [DONE 2026-07-11] |
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
| M94 | P3 | 48 | r2:dx-quality | Detection-accuracy report artifact: cents-error histogram per SNR bucket | [PARTIAL 2026-07-18] CI uploads per-capture JSON metrics; SNR buckets and histograms remain. |
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
| M127 | P3 | 42 | r2:dx-quality | DSP scope-recorder: dump per-frame internals to a replayable .ndjson trace | [PARTIAL 2026-07-18] Rust sample-indexed JSON and browser WebM+sidecar exist; exact shared browser PCM/timebase remains. |
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
| M177 | P3 | 36 | r1:review | prefers-reduced-motion handling | [DONE 2026-07-11] |
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
- For the full requested Top 500 and historical evidence, use [TOP-500-backlog.md](TOP-500-backlog.md); revalidate old `C#` claims before acting on them.
- Next dependency order: R73 interactive file/WAV adapter plus exact browser PCM replay, then SNR/benchmark/soak gates and R1/R6/R7 controller splits.
- Every fix should reduce coupling.
- Update this file, the unified [TOP-500-backlog.md](TOP-500-backlog.md) if an `M#`/`C#` ranking or status changes, [ARCHITECTURE.md](ARCHITECTURE.md), [README.md](README.md), [PLAN.md](PLAN.md) and relevant action steps in [RECOMMENDATIONS.md](RECOMMENDATIONS.md) when an item is resolved.
- Turn items into GitHub issues with links back here.

**Next audit:** after significant layer work or in 2-3 months.

## Fixes Applied (Small but Real)
- Added the first M0 safety-gate slice: `.nvmrc`, `rust-toolchain.toml`, Vitest-based `npm test` fixtures for TS pitch/note utilities, CI gates for `pitch-core` fmt/clippy/tests/wasm feature check, and cleaned `pitch-core` so `clippy -D warnings` passes.
- Fixed inconsistent sample rate (44100 hardcoded in egui spectrum harmonics vs 48000 in feed). Introduced PREFERRED_SAMPLE_RATE const and updated calculations.
- Replaced the egui double-toggle device restart hack with explicit `restart_mic` ownership.
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
- Finished the core split into detector/YIN/MPM/power/spectrum/WASM modules and added `PitchDetector`, reusable buffers, bounded MPM and optional spectrum.
- Added shared `audio-input`, moved Tauri/egui DSP off realtime callbacks, split egui and Tauri native modules, and gated native FFT by visibility.
- Added explicit session lifecycle/recovery tests, feature ports/screens, strict full-profile transfer, practice/tuning domains, worker buffer reuse and real offline SW.
- Added a discriminated `AudioInputPort` registry with contract-tested web/native/synthetic adapters and capability-based session orchestration.
- Made stateful pitch-core/WASM the primary web-worker detector, retained a tested TS fallback, propagated confidence/backend diagnostics and verified WASM end to end in Playwright.
- Added one B0-E5 pitch fixture manifest consumed by native Rust, browser WASM and TS fallback, with explicit cents budgets.
- Replaced hand-maintained Rust/web tuning tables with `registry/music-registry.json` and build-time Rust generation.
- Extracted custom-library CRUD into an injected application controller and reorganized Library into responsive keyboard tabs.
- Completed designer review at desktop and `320 px`, fixed four-tab/canvas overflow, then passed Playwright and full Tauri `.app`/`.dmg` packaging.
- Added a typed cross-boundary `FrameContext`, extracted Rust `FrameResolver`, made native frames authoritative for A4/temperament/selected-target semantics, and replaced separate range mutation with one revisioned native configuration service.
- Added shared Rust/TypeScript smoothing traces with immediate silence reset, removed the top-level `frequency` compatibility alias, hardened frame/range normalization, and passed the full workspace/WASM/Playwright/Tauri release gate.
- Added registry/expression-driven Rust/TypeScript note-math generation, migrated web/core/egui facades, gated stale output in CI and added deterministic A4/MIDI/cents/temperament/capo property sweeps.
- Added normalized-periodicity confidence semantics, a high-level full-frame WASM `TunerProcessor`, revisioned browser `FrameContext`, measured TS fallback confidence and explicit worker reset on session restart.
- Added the live Algorithm workspace with candidate/arbitration telemetry, uncertainty history, decision timeline, freeze/replay inspector, spectral/noise evidence, latency budget, virtual bypass and baseline comparison.
- Made detailed block help viewport-aware and internally scrollable, fixed the baseline action width selector, and added Playwright regression assertions for both layouts.
- Completed the 473-repository music/instrument scan and recorded 50 deduplicated `G#` proposals in [RESEARCH-473-MUSIC-REPOSITORIES.md](RESEARCH-473-MUSIC-REPOSITORIES.md).
- Added a provenance-checked corpus of 19 licensed guitar/bass/ukulele/violin/voice WAVs, deterministic rebuild, temporal threshold evaluation and a blocking JSON CI artifact.
- Added a sample-indexed Rust WAV/f32 replay envelope plus hidden browser WebM+JSON capture sidecar; exact browser PCM/timebase and cross-backend replay remain open.
Fully fixed items should be removed from future audits; partially fixed items above now call out their remaining scope so stable `R#` references stay usable.

## Summary
- This file contains 109 current open/partial `R#` findings (`R1`-`R180` range) and a 71-item stable closure registry.
- A second, independent post-refactor pass added **214 more `R#` findings (`R181`-`R394`)**, organized by 36 finer SOLID/DRY pieces — see "Post-Refactor Findings" above. **323 open items total.**
- The historical 187-item `C#` audit is preserved inside [TOP-500-backlog.md](TOP-500-backlog.md); it is not the current-open count.
- Each of the three requested documents mirrors exactly 500 `M#` rows; 29 verified master items carry dated `[DONE]` markers.
- Highest impact now is: interactive file/WAV input, exact browser PCM replay, SNR/differential/benchmark/soak gates, remaining controller splits, diagnostics and release hardening; the `sessionLifecycle` status-visibility gap (R182), asymmetric `AudioInputPort` contract (R187-R188), and swallowed native `stop()` failures (R183, R193) also remain.

Update this file when fixing. Link from issues.
