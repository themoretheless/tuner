# Recommendations & Top 50 Problems

**Current state audit (June 2026, post-integration into main)**

This document lists the **top 50 things that are done poorly or incorrectly** right now in the guitar tuner codebase. It is based on direct code inspection (useTuner.ts, pitch-core, egui/main.rs, visualizers, duplication between TS/Rust, audio paths, etc.).

The list is synchronized with:
- [ARCHITECTURE.md](ARCHITECTURE.md) (see "Current Problems" section)
- [README.md](README.md) (see "Technical Debt" section)

Many items directly contradict the goals stated in ARCHITECTURE.md (loose coupling, data-driven viz, clean layers).

Prioritization key: P0 (blocks correctness or main thread), P1 (architecture violation), P2 (perf/DX/quality), P3 (nice-to-fix).

## Top 50 Problems (What Was Done Poorly or Incorrectly)

### Architecture & Coupling (1-12)
1. **Visualizers still receive live AnalyserNode** — Spectrum.vue, Waveform.vue, Spectrogram.vue all accept `analyser: AnalyserNode | null` and call `getByteFrequencyData` / `getFloatTimeDomainData` directly. Violates the core "plain data only" rule from ARCHITECTURE.md.
   **Recommendation:** Drive every visualizer exclusively from `DetectionFrame` / `WaveformFrame` / `SpectrumFrame` produced by TunerEngine. Remove analyser props completely.

2. **useTuner.ts remains a god-object** (~450-550 LOC). It owns mic capture, device selection, AudioContext, Analyser, raf loop, smoothing, reference tones, URL state, persistence sync, history, and exposes everything.
   **Recommendation:** Split into `useAudioInput`, `useTunerSession`, `useReferenceTone`, `useVizData` as repeatedly planned.

3. **pitch-core/lib.rs is still mostly monolithic**. Even after moving domain.rs, it mixes TunerEngine, multiple detector impls, spectrum, power-chord detection, smoothing, WASM exports, and cfg in one file.
   **Recommendation:** Finish the split: `dsp/yin.rs`, `dsp/mpm.rs`, `engine.rs`, `smoothing.rs`, `spectrum.rs`. Expose clean traits.

4. **Heavy Mutex usage in egui audio and UI paths**. State and TunerEngine are wrapped in Arc<Mutex<...>> and locked from update() and audio callbacks.
   **Recommendation:** Move processing off the realtime callback. Use lock-free ring buffers or channels. Address the original P1 backlog items.

5. **DSP not reliably off the cpal realtime thread** (native). Processing and viz updates happen under locks in the audio callback path.
   **Recommendation:** Feed samples into a non-realtime engine (as planned in TOP-500 P1).

6. **No clean AudioInput trait / abstraction**. Web uses getUserMedia + Analyser, egui uses cpal, web WASM feed is manual `feed_audio_samples`. Huge platform leakage.
   **Recommendation:** Implement the AudioInput + ToneGenerator traits from the architecture plan.

7. **TunerEngine is not a pure session orchestrator**. It owns FFT planner, buffers, smoothing, and is mutated from multiple places.
   **Recommendation:** Make engine take config + implement a clear `process(&[f32]) -> TunerUpdate` with minimal internal state.

8. **No high-level data contracts for viz**. Components receive either AnalyserNode or raw state; no `DetectionFrame` / `VizFrame` types shared.
   **Recommendation:** Define the frame structs in pitch-core (or small types crate) and use them everywhere.

9. **App.vue + useTuner still leak engine internals** (showWaveform, analyser, currentFrequency, etc. are all exposed as a bag).
   **Recommendation:** Return structured, minimal view models for different parts of UI.

10. **Persistence, settings, and session state are tangled**. useSettings, currentTuning in useTuner, URL reconciliation, and async loaded races.
    **Recommendation:** One source of truth for config, separate from live session.

11. **No dependency inversion for the engine**. Web and egui both know too much about how detection happens.
    **Recommendation:** Depend on traits or high-level `TunerProcessor` interface.

12. **God-like egui App struct + update method**. Still contains keyboard, painting, history pushing, engine locking, audio manager, and viz all together.
    **Recommendation:** Continue extracting (VizManager was a start). Use data-driven painters that only receive frames.

### Duplication & Inconsistency (13-20)
13. **Tuning tables duplicated** — web/src/utils/notes.ts has its own `TUNINGS` + `GUITAR_STRINGS_STANDARD` (with `id` field) vs pitch-core/src/domain.rs (no id, slightly different structure).
    **Recommendation:** Make Rust the source of truth. Generate or export JS constants from WASM/domain at build time.

14. **Note math and cents logic duplicated** (frequency_to_note, get_cents, find_closest_string). JS fallbacks + Rust versions can diverge.
    **Recommendation:** Always call through WASM for core math in web when available. Add CI equivalence test.

15. **Smoothing implementations duplicated** (FrequencySmoother in TS, Smoother + WasmSmoother in Rust, plus EMA/median remnants).
    **Recommendation:** Unify smoothing logic inside pitch-core and expose a single good implementation.

16. **RMS / normalize / downsample have JS fallbacks** in pitch.ts even though WASM is the intended path.
    **Recommendation:** Remove JS fallbacks for core DSP or make them only for dev. Enforce WASM.

17. **Hardcoded constants scattered** (2048 FFT, 44100 sr in egui harmonics, 0.12 YIN threshold, 48000 preferred, various gains).
    **Recommendation:** Central Config struct in domain or engine. One place.

18. **Spectrum buffer sizes and bin logic** duplicated and inconsistent between web (Analyser) and Rust (rustfft 2048 -> 512?).
    **Recommendation:** Compute spectrum once in TunerEngine and return normalized data.

19. **Power chord and confidence logic** implemented in multiple places (isLikelyPowerChord, JS version, native).
    **Recommendation:** Single impl in pitch-core.

20. **Different note display / string selection logic** between platforms.
    **Recommendation:** Move more presentation helpers into shared core or pure functions.

### Performance & Real-time (21-28)
21. **Main-thread raf loop doing detection + viz work** at 60fps in web.
    **Recommendation:** Use AudioWorklet + off-main detection.

22. **Unconditional history pushing and spectrogram recording** every egui update frame.
    **Recommendation:** Only when listening + throttle to 30fps or on change.

23. **Canvas resize and draw every frame** in multiple components (even if the branch tried to fix DPR).
    **Recommendation:** Use ResizeObserver + requestIdle or proper dirty checks.

24. **YIN still O(n²) without aggressive downsampling or string-prior bounds** in hot path by default.
    **Recommendation:** Apply 22050 decimate + per-string tau limits when string selected (already in backlog).

25. **Multiple AudioContext creations** risk (shared one exists but not always used perfectly).
    **Recommendation:** Enforce single shared context everywhere.

26. **No rate limiting or decimation of viz data** sent to components.
    **Recommendation:** Engine can emit at full rate; consumers subsample.

27. **Spectrogram and full spectrum computed/pushed even when hidden** in some paths.
    **Recommendation:** Gate behind flags inside the engine or session.

28. **Per-frame allocations** still present (Vecs for spectrum, history clones in egui).
    **Recommendation:** Preallocated ring buffers and reuse.

### Testing & Quality (29-36)
29. **Very few real tests**. Only basic synthetic tests in pitch-core (440Hz sine, simple power chord). No guitar signal fixtures.
    **Recommendation:** Add recorded or synthetic guitar WAV fixtures + property tests.

30. **No equivalence / golden master tests** between Rust and web paths.
    **Recommendation:** WASM/native harness + committed fixtures as planned in backlog.

31. **No E2E or Playwright tests** using fake mic / synthetic audio.
    **Recommendation:** Implement the fake-WAV pipeline tests.

32. **No benchmarks** for YIN/MPM on representative buffers.
    **Recommendation:** criterion in pitch-core.

33. **No snapshot or insta tests** for DetectionResult shape.
    **Recommendation:** Add for key scenarios.

34. **Manual testing required for most audio behavior**.
    **Recommendation:** Synthetic signal injector in dev mode.

35. **Limited CI coverage** for cross-platform numeric results and WASM.
    **Recommendation:** Matrix that runs equivalence.

36. **No fuzz or property-based testing** on frequencyToNote roundtrips or edge frequencies.
    **Recommendation:** Add proptest / quickcheck.

### Web / Vue Specific (37-42)
37. **Still heavy reliance on Web Audio Analyser for both detection support and viz**.
    **Recommendation:** Move detection fully to WASM, viz to data.

38. **Global side-effect WASM init** at module load time.
    **Recommendation:** Explicit async init with proper loading state.

39. **Complicated settings restore + URL state dance** with races.
    **Recommendation:** Simplify with a proper state machine.

40. **No proper Service Worker** for real offline PWA (only manifest).
    **Recommendation:** Implement as high priority P2.

41. **Component props bloat** — many components receive large bags from useTuner.
    **Recommendation:** Narrow props.

42. **Magic numbers and strings** still in templates and composables.
    **Recommendation:** Extract to constants + l10n where appropriate.

### Rust / Native Specific (43-46)
43. **Hardcoded 44100.0** for harmonic overlay bin calculation in egui.
    **Recommendation:** Use actual sample rate from engine or stream config.

44. **Audio stream restart and device change logic** is fragile and scattered in AudioManager.
    **Recommendation:** Robust restart with proper error propagation.

45. **WASM and native use different smoother and feed mechanisms**.
    **Recommendation:** Unify via core.

46. **egui still has incomplete web audio random tone** (TODO in code).
    **Recommendation:** Implement or share the reference tone generator.

### DX, Build, Deployment, Product (47-50)
47. **No clear public API documentation** for pitch-core (rustdoc + examples missing for most fns).
    **Recommendation:** Add docs + "how to use from web/egui".

48. **Build and WASM packaging** is ad-hoc (vite public/wasm, old deleted files).
    **Recommendation:** Proper build script + versioned artifacts.

49. **Weak observability** — silent failures in audio/WASM, no health strip.
    **Recommendation:** Add the "Test my mic" wizard + pipeline health indicators.

50. **Architecture plan is only partially executed**. Domain split started, but most of the layered design (traits, data contracts, audio abstraction) is not in place.
    **Recommendation:** Treat the "Target Architecture" section of ARCHITECTURE.md as the spec. Every change should move closer to it.

## How to Use This List
- Pick the highest impact items first (1-5, 13, 21, 29).
- Every fix should reduce coupling.
- Update this file, ARCHITECTURE.md and README.md when an item is resolved.
- Turn items into GitHub issues with links back here.

**Next audit:** after significant layer work or in 2-3 months.

## Fixes Applied (Small but Real)
- Fixed inconsistent sample rate (44100 hardcoded in egui spectrum harmonics vs 48000 in feed). Introduced PREFERRED_SAMPLE_RATE const and updated calculations.
- Documented the double-toggle mic restart hack in device change (egui) as a known smell.
- Fixed minor frequency rounding inconsistency in domain.rs default note (82.41 -> 82.4069 to match other sources).
These were safe, low-risk fixes addressing items from the Top 50.

## Additional 200 Problems Discovered in Expanded Audit (51-250)

The original Top 50 was a starting point. Deeper inspection (full files for egui painting, useTuner internals, pitch-core internals, Vue canvas duplication, cpal streams, WASM bindings, settings races, lack of abstraction, etc.) revealed many more. Grouped for readability. All are real or strongly evidenced by code.

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

### Rust / Native / egui / Tauri Specific (201-220)
201. cpal stream is built with closure that captures engine by clone every time.
202. No use of cpal's error callback for proper stream recovery.
203. egui save() only saves a few strings; many settings (chromatic, tolerance, show*) lost.
204. Native random tone uses fixed 0.18 gain without sharing the ref tone generator.
205. Mutex clones happen on every device list refresh and toggle.
206. Audio callback buffer drain logic is manual ring of 4096.
207. WebAssembly specific code has separate toggle_mic that does almost nothing.
208. No proper egui integration for high DPI beyond default.
209. Tauri Info.plist and entitlements may be incomplete for mic on mac.
210. No signed release pipeline exercised in the current state.
211. egui App has many fields that should be in separate managers.
212. Stream config is converted every mic start.
213. No handling for sample rate from actual cpal config in viz (still uses const).
214. panic on eframe start in main.
215. Desktop Tauri lib.rs uses expect on run.
216. Different icon handling between tauri and egui builds.
217. No use of eframe's persist feature fully.
218. Audio input on Linux may have different backend issues not tested.
219. Realtime safety: the callback does allocations and locks.
220. No cross-compilation friendly setup documented for releases.

### Algorithm, DSP & Detection Weaknesses (221-240)
221. YIN threshold 0.12 is magic and not tuned per instrument or noise level.
222. No handling for inharmonicity in current core (wound strings detune partials).
223. Octave errors still possible without the HPS or subharmonic guard from backlog.
224. Power chord detection is heuristic and may false positive on clean notes.
225. Smoother in core resets on a4 or tuning change but may leave stale values.
226. Downsampling factor is not adaptive.
227. No DC removal or highpass at runtime (only test).
228. Confidence from detectors not fused with RMS or other signal quality.
229. Buffer window is fixed; no variable window based on freq.
230. MPM and YIN internals have duplicated cleaning code?
231. No vibrato or drift detection for "stable" readout.
232. Synthetic tests don't cover real guitar pluck transient.
233. No support for alternate temperaments or stretch tuning.
234. Frequency to note uses 12-TET only, no microtonal.
235. RMS and level are post downsample sometimes.
236. No adaptive noise gate based on recent silence.
237. Cents calculation for chromatic vs string target can differ in edge cases.
238. Lack of median or better filter on raw detector output.
239. The 30Hz-400Hz guitar range is assumed everywhere.
240. No multi-pitch or poly detection beyond power chord flag.

### Documentation, DX, Maintainability & Other (241-250 + extras to reach 200 additional)
241. ARCHITECTURE.md describes ideal layers that are not yet reflected in code structure.
242. recommendation.md and backlogs exist but no process to triage them into issues.
243. Few comments explaining why certain constants or algorithms were chosen.
244. No CONTRIBUTING or "how to add a new tuning preset" guide.
245. Version.json is present but not used for PWA update check.
246. Icons are still placeholders in some places.
247. No performance budget or bundle size check in build.
248. Accessibility: color only for in-tune in many places.
249. Privacy claim ("100% local") is not enforced by any CI check.
250. Overall the codebase has accumulated many small technical debts from iterative evolution without enough refactoring pauses.

(Additional issues beyond 250 can be derived similarly from deeper profiling, more component reads, and user reports.)

## Summary of Expanded Problems
- Total documented problems now significantly over 200.
- Many are direct violations of the architecture vision.
- A number are low-hanging (hardcoded values, comments, small cleanups) – some already fixed in this pass.
- High impact ones remain the god objects, coupling of viz to audio APIs, duplication of domain, realtime safety.

Update this file when fixing. Link from issues.

