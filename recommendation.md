# Recommendations & Top 50 Problems

**Current state audit (2026-06-29)**

This document lists the **top 50 things that are done poorly or incorrectly** in the guitar tuner codebase (as of now).

Progress since previous audits:
- Web side has been significantly split: useTuner.ts is now a thin orchestrator. New focused composables (useAudioInput, usePitchLoop, useTuningState, useReferenceTone, useCentsHistory, useNativeAudioInput, etc.).
- Some sample rate consistency fixes applied earlier.

Remaining major issues are documented below. The list is kept in sync with:
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [README.md](README.md)

Many items still violate the loose coupling and layered architecture goals.

Prioritization: P0 (critical), P1 (architecture), P2 (quality/perf), P3 (polish).

## Top 50 Problems (What Was Done Poorly or Incorrectly) — Current (2026-06-29)

### Architecture & Coupling
1. Visualizers (Spectrum.vue, Waveform.vue, Spectrogram.vue) still accept `analyser: AnalyserNode | null` and call get*Data directly.
   **Rec:** Make all viz receive only plain data frames from pitch loop / native audio.

2. Note math, cents, frequencyToNote, TUNINGS and GUITAR_STRINGS_STANDARD are duplicated (web/utils/notes.ts + useTuningState.ts vs pitch-core/domain.rs).
   **Rec:** Make pitch-core the single source; export or codegen for TS.

3. egui App is still god-like: update() does state clone, history push, keyboard, multiple painters, audio manager calls.
   **Rec:** Further extract painters and use pure data-driven rendering.

4. Heavy Arc<Mutex<State>> and Arc<Mutex<TunerEngine>> throughout egui (update + audio paths).
   **Rec:** Move DSP off realtime thread, use channels or lock-free structures.

5. pitch-core/lib.rs remains mixed (TunerEngine owns FFT, smoother, spectrum, detector logic) even after domain split.
   **Rec:** Complete the split into dsp/, engine/, etc. with traits.

6. useAudioInput.ts still creates AnalyserNode and exposes it (usePitchLoop consumes frames but viz layer bypasses).
   **Rec:** Push frames only; remove analyser from viz props.

7. Dual audio backends (web Audio + native) are useful but lack a clean shared trait/abstraction.
   **Rec:** Define AudioInput trait + implementations as per ARCHITECTURE plan.

8. useTuner.ts orchestrates well now, but settings, tuning, detectionRange, and audioBackend are still spread and watched in multiple places.
   **Rec:** Stronger single config + session state separation.

9. No consistent DetectionFrame / VizFrame types passed down; some paths still leak audio nodes or raw refs.
   **Rec:** Define in pitch-core and use everywhere (web + egui).

10. egui still does unconditional history push + spectrogram clone in every update().
    **Rec:** Gate behind isListening + throttle.

### Duplication & Inconsistency
11. Tuning data lives in web (notes.ts, CustomTuningEditor) and Rust domain with different shapes (id field, etc.).
12. cents / note conversion logic duplicated and can drift.
13. Canvas resize/DPR/draw code is copy-pasted across Spectrum, Waveform, Spectrogram (and useHiDpiCanvas is only partial).
14. Smoothing, RMS, level normalization have JS fallbacks + Rust versions.
15. Buffer handling and 2048/fftSize assumptions in multiple places.
16. "in tune" logic and colors not fully consistent between web and egui.
17. Device/permission flow code duplicated between useAudioInput and useNativeAudioInput.
18. Reference tone / ear training tone creation code has duplication.
19. Low-level pitch range and detection constants scattered.
20. Error strings and cleanup logic repeated across audio composables.

### Performance & Real-time Issues
21. YIN still runs O(n²) without aggressive per-string bounds or downsampling in all paths.
22. egui update always requests repaint and does viz work even when not listening.
23. No AudioWorklet; web path still does work on main thread + raf.
24. History arrays use shift() (O(n)) instead of proper ring buffers.
25. Spectrum and viz computations not always gated when hidden.
26. Multiple AudioContext risk and creation overhead.
27. Inline per-sample drawing (circle_filled etc.) in egui painters is slow.
28. No frame rate limiting or idle scheduling for non-critical viz.

### Testing, Quality, Error Handling
29. pitch-core tests are basic (sine waves); weak coverage of real signals, inharmonicity, edge cases.
30. No automated equivalence tests between web (TS/WASM) and native pitch results.
31. Many .lock().unwrap() and .unwrap() in egui — can panic on audio errors.
32. WASM/native availability and init is ad-hoc with limited graceful degradation.
33. Device change while listening has restart logic that is fragile.
34. Little observability (no good confidence/quality metrics exposed to user when detection is bad).
35. No property-based or fixture-based regression suite for the detector.

### DX, Docs, Maintainability, Product
36. Architecture plan (traits, data contracts, clean layers) only partially implemented.
37. recommendation.md / ARCHITECTURE.md are ahead of the code in many areas.
38. Hardcoded magic numbers (YIN_THRESHOLD=0.12, ranges, fft sizes) still present.
39. Limited rustdoc and usage examples for pitch-core public API.
40. Dual backend (web vs native) is powerful but the UI/UX for switching is not polished.
41. No file-based input or recorded clip analysis.
42. Accessibility still mostly color-based for tuning state.
43. i18n and new features (metronome, ear training, practice) not fully covered.
44. Build / WASM packaging and version handling for native audio is ad-hoc.
45. No CI gate for domain math parity between Rust and TS.
46. Custom tuning and temperament features are only in web.
47. State for practice history, layout, theme etc. lives only in web settings.
48. Keyboard shortcuts and focus handling not robust across all display modes.
49. egui native still has TODOs (web audio random tone) and incomplete features.
50. Overall: good progress on web composable splitting, but core vision of clean, testable, platform-agnostic layers is only ~40-50% realized across the stack.

**Recommendation for all items:** Prioritize P0/P1 (viz decoupling, domain unification, egui realtime safety, data contracts). Every change should reduce coupling between audio I/O, DSP, and presentation.

## How to Use This List
- Focus on items 1-10 first (highest architectural impact).
- Every fix should make viz data-driven and reduce duplication between web and core.
- Update this file + ARCHITECTURE.md + README.md when items are resolved.
- Turn top items into GitHub issues.

The original Top 50 was a starting point. Deeper inspection (full files for egui painting, useTuner internals, pitch-core internals, Vue canvas duplication, cpal streams, WASM bindings, settings races, lack of abstraction, etc.) revealed many more. Grouped for readability. All are real or strongly evidenced by code.



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

