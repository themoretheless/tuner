# Guitar Tuner - Historical Top 187 Grounded Audit

This file preserves the detailed pre-refactor evidence as stable `C#` items. It is **not the current-open list after 2026-07-11**: file paths and claims below intentionally remain as audit history. Use [recommendation.md](recommendation.md) for the current 120 open/partial and 60 closed `R#` registry, [ARCHITECTURE.md](ARCHITECTURE.md) for current boundaries, and [TOP-500-backlog.md](TOP-500-backlog.md) for all 500 options/status markers.

Grounded audit across 14 dimensions, ranked by tier x impact/effort, semantically deduped (collapsed 13 near-duplicate findings). Format: title - kind - I/E - where - note.

Tiers: P0=17 P1=58 P2=110 P3=2

## Status Notes

- 2026-07-11: web/native/synthetic inputs now implement one discriminated `AudioInputPort` with lifecycle contract tests, and `useTunerSession` selects capabilities through a registry. The web worker now uses a stateful pitch-core/WASM detector as primary, returns confidence/backend diagnostics and falls back to TS on load/runtime failure; Playwright verifies the live WASM E2 path. Remaining related work is shared numeric parity, native frame context and file/WAV input.
- 2026-07-11: three implementation iterations plus review supersede many findings below. Closed families include the session state machine/pending states, egui random tone, native callback DSP/alloc/locks, shared Tauri pitch-core path, pitch-core module/trait split, frame adoption, profile schema/import validation, offline Service Worker, semantic canvas themes and feature-shell decomposition. Do not reopen a `C#` from this file without revalidating it against current code; current dispositions live under the corresponding stable `R#` or `[DONE]` `M#` row.
- 2026-06-30: M0 safety-gate slice landed. `build-web.yml` runs `npm test`; `npm test` now uses Vitest for core note/pitch fixtures; `test-core.yml` gates `cargo fmt --check -p pitch-core`, `cargo clippy -p pitch-core --all-targets --all-features -- -D warnings`, `cargo test -p pitch-core`, and `cargo check -p pitch-core --target wasm32-unknown-unknown --features wasm`; `.nvmrc` and `rust-toolchain.toml` were added. This resolves the CI-wiring part of C3/C180 and partially addresses C76/C79/C99/C114/C118 for `pitch-core`. Remaining: composable tests, Rust<->TS parity harness, fake-mic E2E, and broader egui/Tauri clippy/fmt gates.
- 2026-07-01: M1 web-frame slice landed. `useTunerSession` now exposes `DetectionFrame` as the primary readout contract, `useTuner` enriches it with tuning target/cents/in-tune state, the native web adapter stores Tauri events as `DetectionFrame`, and the synthetic session harness asserts the frame shape. Remaining C47/C53/R9 work: native tuning context, egui frame adoption, and compatibility frequency aliases.

## P0 (17)

**1. play_random_string takes the just-created output stream then drops it, so no tone ever plays** - `problem` H/L - _egui-native_
  - egui/src/main.rs:538-542 (out = Some(s); out.take())
  - Line 538 stores the stream in self.audio.out, line 540 immediately .take()s it into a local out_clone that is dropped at end of fn, stopping playback instantly; remove the take() (and add the promised auto-stop timer instead).

**2. AudioContext never resume()d after construction; suspended-context start yields silent tuner** - `problem` H/L - _audio-io-realtime_
  - web/src/composables/useAudioInput.ts:56-65; useReferenceTone.ts:14; utils/audio.ts:5-11
  - createAudioContext() can return a context in 'suspended' state under browser autoplay policy; start()/readFrame() never call audioContext.resume(), so the analyser reads zeros and pitch detection silently produces nothing until some unrelated user gesture happens to resume it.

**3. RESOLVED 2026-06-30: web core tests are now run in CI** - `fixed` H/L - _testing-ci_
  - .github/workflows/build-web.yml runs `npm test`; web/package.json now maps `test` to `vitest run`.
  - Remaining related work moved under M0: composable tests, fake-mic E2E and Rust<->TS parity. Keep this entry for audit history; do not treat it as open.

**4. egui play_random_string immediately drops the output stream via out.take(), so ear-training tone never sounds** - `problem` H/L - _duplication_
  - egui/src/main.rs:510-542 (line 540: let out_clone = self.audio.out.take();)
  - After building and playing the random-string stream and storing it in self.audio.out, line 540 takes it back out into an unused local that is dropped at end of scope, stopping the cpal stream the same frame; the surrounding comments admit it is a placeholder - the feature is broken, not just smelly.

**5. Web getUserMedia track 'ended' (device unplug / OS revoke) is never handled** - `problem` H/L - _observability-reliability_
  - web/src/composables/useAudioInput.ts:62-66
  - No stream.getAudioTracks()[0].onended / .onmute listener; if the mic is unplugged or revoked mid-session, isListening stays true and readFrame keeps returning stale zeros with no error or auto-stop.

**6. AudioContext suspended/interrupted state is never monitored or resumed** - `problem` H/L - _observability-reliability_
  - web/src/utils/audio.ts:5-11; web/src/composables/useAudioInput.ts:56-65
  - createAudioContext() never checks ctx.state or wires onstatechange; on iOS/Safari the context starts/returns to 'suspended' (app backgrounded, autoplay policy) and the tuner silently freezes with no resume() and no UI signal.

**7. egui random-string stream is dropped immediately by out.take()** - `problem` M/L - _observability-reliability_
  - egui/src/main.rs:540
  - play_random_string builds an output stream, stores it in self.audio.out, then on line 540 does out.take() into an unused local that drops at end of fn, so the tone stops instantly and ear-training playback is silent on native.

**8. egui runs DSP inside the realtime cpal callback under a Mutex** - `problem` H/M - _architecture-coupling_
  - egui/src/main.rs:443-473 (eng.lock().process); pitch-core/src/lib.rs:61-128
  - The audio thread locks engine_for_cb and runs full YIN+2048-pt FFT inside build_input_stream's callback, then locks State and requests repaint; a contended lock or the O(n·tau) FFT can blow the realtime deadline and cause audio glitches.

**9. No octave-error guard: YIN/MPM can lock onto subharmonic with no HPS cross-check** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:153-330 (detect_pitch_yin_internal, detect_pitch_mpm_internal)
  - Neither detector validates the chosen tau against harmonic content; the absolute-threshold dip walk readily picks 2x/3x period on plucked guitar (rich harmonics), producing an octave-low reading with no HPS/subharmonic rejection step.

**10. Engine Mutex locked inside the realtime audio callback** - `problem` H/M - _egui-native_
  - egui/src/main.rs:449-455 (engine_for_cb.lock() in build_input_stream closure)
  - Taking a std::sync::Mutex on the realtime audio thread can block on the UI thread (which also locks the engine in toggle/slider handlers) causing priority inversion and dropouts; the audio path must be lock-free or use try_lock with a fallback.

**11. TunerEngine::process allocates per call inside the audio callback** - `problem` H/M - _performance_
  - pitch-core/src/lib.rs:99 (vec![0.0f32;512]) and lib.rs:341 (cleaned: Vec<f32>), plus main.rs:469 g.spectrum = update.spectrum
  - Every realtime callback heap-allocates a 512-elem spectrum Vec and a detrended copy of the input, then moves the Vec into State - allocation in the audio thread is a glitch hazard; preallocate and write in place.

**12. cpal runtime stream errors are swallowed with eprintln, never surfaced or recovered** - `problem` H/M - _observability-reliability_
  - desktop/src-tauri/src/native_audio.rs:163; egui/src/main.rs:474
  - The build_input_stream error callback only eprintln!s; if the mic disconnects or the stream errors mid-run, the frame thread goes silent, frontend isListening stays true, and there is no error event, watchdog, or auto-restart.

**13. Native audio device disconnection mid-stream is undetectable** - `problem` H/M - _observability-reliability_
  - desktop/src-tauri/src/native_audio.rs:145-167
  - No track-ended / device-lost handling; the spawned thread blocks on stop_rx.recv() forever while cpal silently stops delivering data, so the UI freezes on the last frequency with no indication.

**14. findClosestString picks nearest pitch with no course awareness on octave pairs** - `problem` H/M - _instruments-domain_
  - web/src/utils/notes.ts:512-524; useTuningState.ts:148-161
  - When tuning a 12-string E2/E3 course, a plucked octave string snaps to whichever of the two is closer; there is no 'tune this course' grouping so the displayed target flips between the pair members.

**15. 5-string bass B0 (30.87Hz) is below useful detection floor with no extended-low handling** - `problem` H/M - _instruments-domain_
  - web/src/utils/notes.ts:285 (B0), :291 (B0); domain.rs:178 (freq<20 guard)
  - B0 at 30.87Hz passes the 20Hz guard but there is no low-end detection extension (longer window / fundamental-tracking) configured per-tuning, so the lowest bass string is the least reliable exactly where it matters.

**16. Per-callback Vec::drain on the audio thread instead of a real ring buffer** - `problem` M/M - _audio-io-realtime_
  - egui/src/main.rs:444 (b.drain(..b.len()-2048)); desktop native_audio.rs:149-151 (buffer.drain)
  - Both accumulate into a growing Vec and drain the front each callback, an O(n) memmove on the realtime thread; the stated ring-buffer-off-the-RT-thread goal is unmet. Use a fixed-capacity SPSC ring (e.g. rtrb) and process off-thread.

**17. Full DSP (YIN+MPM+FFT+spectrum) executes inside cpal realtime callback under Mutex** - `problem` H/H - _dsp-algorithms_
  - egui/src/main.rs:443-472 (build_input_stream closure -> engine.lock().process)
  - eng.process() does pitch detection plus a 2048 FFT while holding engine_for_cb.lock() on the audio thread; any contention or allocation (vec! per call) risks xruns and dropouts, defeating realtime accuracy.

## P1 (58)

**18. "Requesting mic" state string exists but is never shown; permission wait looks frozen** - `problem` H/L - _ux-product_
  - web/src/composables/useAudioInput.ts:41-71 (start), App.vue:91-93 header status
  - l10n key requesting (l10n.ts:14,124) is dead; getUserMedia has no pending ref, so on first click the UI stays "READY" through the whole permission prompt with no Idle/Requesting/Listening distinction.

**19. Language toggle never updates document.documentElement.lang** - `problem` H/L - _a11y-i18n_
  - web/index.html:2 (hardcoded lang="en"); web/src/stores/l10n.ts:234 toggleLang; App.vue:87
  - Screen readers keep announcing Russian UI with an English speech engine because <html lang> stays "en" forever after toggleLang; set documentElement.lang in toggleLang/init.

**20. Global focus-visible styling missing for nearly all controls** - `problem` H/L - _a11y-i18n_
  - web/src/style.css (no :focus-visible rule); only MicButton.vue:13 has a ring; string-btn/segmented/btn/lang toggle/checkbox styled bg only
  - Keyboard users get little or no visible focus on .string-btn, .segmented, .btn and the RU/EN toggle since custom backgrounds suppress default outline; add a global :focus-visible outline.

**21. detectionRange watch in useTuner fires native setRange on every range object identity change** - `problem` M/L - _web-vue_
  - web/src/composables/useTuner.ts:48-51 (watch tuning.detectionRange)
  - tuning.detectionRange is a computed rebuilt from strings (new object each recompute), so the watch reassigns detectionRange.value and awaits nativeAudio.setRange even when min/max are unchanged; compare numeric bounds before firing the async native invoke.

**22. useReferenceTone/useNativeAudioInput register onUnmounted but are instantiated deep inside useTuner** - `problem` M/L - _web-vue_
  - web/src/composables/useReferenceTone.ts:93, useNativeAudioInput.ts:106, usePitchLoop.ts:144
  - These onUnmounted hooks only fire because useTuner() runs in App.vue setup; the contract is implicit and fragile — calling useTuner() outside a component setup (tests, SSR probe) registers no cleanup and leaks AudioContext/Worker/RAF. Document/guard the setup requirement.

**23. egui input device switch restarts the stream via a double toggle_mic() hack** - `problem` M/L - _audio-io-realtime_
  - egui/src/main.rs:268-273
  - Device change calls toggle_mic twice (stop then start) inside update(); the code's own comment flags it as a smell. There is no explicit restart_mic(); the stop path also resets the engine, dropping detection state on every device change.

**24. No CI job builds/tests the WASM feature or asserts it loads** - `problem` M/L - _testing-ci_
  - test-core.yml builds default features only; build-web.yml relies on npm build:wasm with a swallowed failure
  - Add a `wasm-pack build --features wasm` (or `cargo build --target wasm32-unknown-unknown --features wasm`) job that fails hard, since the web shipped artifact depends on it.

**25. In-tune state has no hold/dwell requirement, so it flickers on transients** - `problem` M/L - _ux-product_
  - web/src/composables/useTuningState.ts:170-180 isInTune
  - isInTune flips true the instant abs(cents)<5 with only a hysteresis band, no minimum stable duration; a pluck overshoot can briefly read in-tune. Guided tuning needs an N-ms dwell before declaring a string done.

**26. pitchWorker.onerror tears down the worker without surfacing or restarting** - `problem` M/L - _observability-reliability_
  - web/src/composables/usePitchLoop.ts:41-46
  - On a worker error the worker is terminated and nulled, then ensurePitchWorker silently recreates it next tick with no logged cause and no user-visible signal; a persistently crashing worker just thrashes invisibly.

**27. toggleString resolves by noteId, which collides on duplicate course members** - `problem` M/L - _instruments-domain_
  - web/src/composables/useTuningState.ts:250-256; notes.ts:466-468 (noteId)
  - 12-string has identical noteIds (B3/B3, E4/E4); selecting one by note (no index) always resolves to the first via findIndex, so the unison pair's second string is unreachable by note-click.

**28. pitch-core/lib.rs still monolithic: DSP, engine, smoothing, spectrum, wasm in one 668-line file** - `problem` H/M - _architecture-coupling_
  - pitch-core/src/lib.rs:1-668
  - Only domain.rs is split out; YIN, MPM, power-chord, FFT spectrum, RMS, Smoother, TunerEngine, and all wasm bindings live together, so algorithms can't be swapped or benchmarked independently as ARCHITECTURE.md lines 169-172 plan.

**29. detect_pitch returns first non-None of YIN-then-MPM, no confidence-weighted fusion** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:332-358 (detect_pitch)
  - The audit dimension asks for confidence-weighted YIN+MPM+HPS fusion, but the code just short-circuits on YIN success and never runs MPM unless YIN fails, so the two estimators never cross-validate or arbitrate disagreement.

**30. tau bounds are global GUITAR_MIN/MAX (30-400Hz), not per-string/per-instrument** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:1-2,160-161; TS uses configurable range but Rust hardcodes
  - Rust engine clamps every detection to 30-400Hz regardless of selected instrument (bass<30, violin/mandolin/ukulele go well above 400), so out-of-band strings for non-guitar instruments can never be detected by the native path.

**31. useSettings holds module-level singleton refs but the rest of the composable tree is instance-scoped** - `problem` H/M - _web-vue_
  - web/src/composables/useSettings.ts:26-59 vs useTuningState.ts:50, useTuner.ts:15
  - State is split between a global singleton (settings) and per-call refs (currentTuning, selectedStringIndex, audio); a second useTuner() instance would silently share settings but fork detection state, and there is no provide/inject contract making the single-instance assumption explicit.

**32. tauri native_audio.rs reimplements pitch + level instead of depending on pitch-core** - `problem` H/M - _audio-io-realtime_
  - desktop/src-tauri/src/native_audio.rs:196-290
  - normalize_level and detect_pitch_yin are duplicated in the desktop crate while pitch-core already provides compute_rms_volume/normalize_level and a YIN engine; the desktop backend should call pitch-core to keep detection identical to egui/web-wasm.

**33. No Rust<->TS pitch-detection parity/equivalence test** - `problem` H/M - _testing-ci_
  - pitch-core/src/lib.rs detect_pitch_native vs web/src/utils/pitch.ts detectPitch; usePitchLoop.ts:112 runs the TS path, egui runs the Rust path
  - Two independent DSP implementations of the same algorithm with zero cross-check; they can silently diverge in cents/Hz on identical input across web vs native.

**34. WASM pitch-core is built and shipped but never imported by the web app** - `problem` H/M - _performance_
  - web/public/wasm/* (detect_pitch_yin/mpm/wasm, downsample_for_pitch) vs web/src/workers/pitchWorker.ts:24
  - grep of web/src finds zero references to pitch_core/wasm; the worker runs pure-TS detectPitch while the shipped .wasm sits as unused download weight - either wire it in or drop it from the bundle.

**35. Tuning table duplicated and divergent between TS notes.ts and Rust domain.rs** - `problem` H/M - _duplication_
  - web/src/utils/notes.ts:138-359 (BUILT_IN_TUNINGS) vs pitch-core/src/domain.rs:19-167 (get_tunings)
  - TS has ~30 instrument tunings computed from note()/equalFrequency(); Rust hard-codes ~14 guitar tunings with literal frequencies and different sets (Rust has Drop B/Open C/Open A/Open Gm, TS has none of these; TS has bass/uke/violin, Rust has none) - two unsynced sources of truth.

**36. Cents/closest-string logic diverges: TS path is temperament-aware, Rust process() is not** - `problem` H/M - _duplication_
  - web/src/composables/useTuningState.ts:147-161 vs pitch-core/src/lib.rs:79-96
  - TS computes cents via frequencyToNote/findClosestString with temperament+sweetening+stringOffsets+A4-scaling; Rust TunerEngine::process does plain find_closest_string+get_cents with only A4 ratio - the egui/native readout silently ignores temperament and offsets, so the two backends report different cents for the same note.

**37. No Rust<->TS parity test pins the duplicated note/cents/tuning math to identical outputs** - `idea` H/M - _duplication_
  - pitch-core/src/lib.rs tests (lib.rs:543-667) cover Rust only; no cross-language fixture under web/ or pitch-core/
  - Given the table and math are duplicated, the only guard against drift would be a shared fixture (e.g. JSON of freq->note/cents and tuning frequencies) asserted by both vitest and cargo test; today frequencyToNote/get_cents/find_closest_string can silently diverge and the existing tests would still pass.

**38. No per-string tolerance; in-tune threshold is one global hardcoded 5/7¢** - `problem` H/M - _ux-product_
  - web/src/composables/useTuningState.ts:31-32,177-178
  - IN_TUNE_THRESHOLD/OUT_OF_TUNE_THRESHOLD are module constants applied to every string; guitarists want looser cents on low E/B and the dimension explicitly calls for per-string tolerance, which is impossible today.

**39. aria-live note/cents regions fire on every detection frame, no debounce or bucketing** - `problem` H/M - _a11y-i18n_
  - web/src/components/NoteDisplay.vue:20; CentsGauge.vue:64-68 (cents/conf update each frame)
  - polite region wraps continuously-changing cents/conf/Hz, flooding the SR queue; announce only on note change plus a coarse bucket (e.g. 'E2, slightly sharp') via a debounced sr-only element.

**40. colorblind theme does not recolor SVG gauges (hardcoded hex)** - `problem` H/M - _a11y-i18n_
  - web/src/components/CentsGauge.vue:39,45,46,56; CentsHistoryGraph.vue:39 stroke="#4ade80"
  - theme-colorblind only overrides Tailwind classes; the inline SVG fills #22c55e/#f59e0b/#4ade80 stay green/amber under Okabe-Ito, defeating the colorblind palette - drive these from CSS vars.

**41. No real Service Worker despite manifest and HTML claiming "Works offline"** - `problem` H/M - _build-pwa-distribution_
  - web/src/main.ts (no SW registration), web/public/manifest.webmanifest, web/index.html:8
  - main.ts only mounts the Vue app; nothing registers a SW and no sw.js/workbox exists, so the PWA is not installable-as-offline and the 'Works offline'/'Works offline as PWA' copy is false.

**42. manifest claims 'Works offline' but there is no service worker** - `problem` H/M - _observability-reliability_
  - web/index.html:9; web/public/manifest.webmanifest:4; web/vite.config.ts:8; web/src/main.ts
  - index.html description and manifest both advertise offline/PWA, yet vite has no VitePWA/workbox plugin and main.ts never registers a service worker, so a reload offline shows a blank page.

**43. No octave-course flag for 12-string lower pairs** - `problem` H/M - _instruments-domain_
  - web/src/utils/notes.ts:251-256
  - E2/E3, A2/A3, D3/D4, G3/G4 are octave courses but nothing marks the octave string vs the fundamental, so sweetening offsets (line 118) are applied by flat index with no semantic anchor.

**44. notes.ts and domain.rs duplicate the tuning/note model with no documented source of truth** - `problem` H/M - _dx-docs_
  - pitch-core/src/domain.rs:28 get_tunings() vs web/src/utils/notes.ts:51 INSTRUMENTS/BUILT_IN_TUNINGS
  - Two hand-maintained tuning tables drift silently (Rust has 13 guitar tunings; TS has instruments/temperaments the Rust side lacks); no ADR or doc records why they are separate or which is canonical.

**45. test-core.mjs is TS-only and not a real Rust<->TS parity test** - `problem` H/M - _dx-docs_
  - web/scripts/test-core.mjs:31-98 (bundles only notes.ts/pitch.ts)
  - It asserts TS behavior in isolation; it never loads the wasm build to compare detect_pitch / frequency_to_note / find_closest_string outputs against domain.rs, so the two engines can diverge numerically with green CI.

**46. No PitchDetector trait — detect_pitch() hardcodes YIN-then-MPM ordering** - `problem` M/M - _architecture-coupling_
  - pitch-core/src/lib.rs:332-358
  - detect_pitch calls detect_pitch_yin_internal then detect_pitch_mpm_internal directly; the planned `trait PitchDetector { process(&[f32]) -> Option<(f32,f32)> }` (ARCHITECTURE.md:49,121) does not exist, so detectors aren't pluggable or testable in isolation.

**47. No shared DetectionFrame/SpectrumFrame/WaveformFrame contract in Rust** - `problem` M/M - _architecture-coupling_
  - pitch-core/src/lib.rs:12-21 (TunerUpdate); ARCHITECTURE.md:140,162
  - Rust exposes only an ad-hoc TunerUpdate struct; the planned DetectionFrame/SpectrumFrame contract in domain/tuner-types is absent, so egui State manually re-copies fields field-by-field (egui/src/main.rs:459-471).

**48. No DC-block/high-pass filter; only per-buffer mean subtraction for rumble/mains** - `problem` M/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:340-345 (detect_pitch mean removal)
  - Only a single-buffer mean is removed; there is no first-order DC-block (y=x-x1+R*y1) or high-pass to attenuate sub-40Hz rumble and 50/60Hz mains hum, which sit in-band (GUITAR_MIN_FREQ=30) and can be detected as false fundamentals.

**49. Energy gate is a fixed RMS/peak threshold, not an adaptive noise floor** - `idea` M/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:174 (rms<0.0025||max_abs<0.012)
  - The gate is a hardcoded constant rather than a tracked/adaptive noise floor; quiet pickups or noisy rooms either get gated out or let hum through, where an EMA noise-floor with hysteresis would adapt.

**50. frequency_to_note / get_cents duplicated between notes.ts and domain.rs with no parity guard** - `problem` M/M - _dsp-algorithms_
  - pitch-core/src/domain.rs:169-195 vs web/src/utils/notes.ts
  - Note/cents math exists in both languages; without a shared fixture or generated table, equal-temperament rounding (e.g. midi.round vs JS rounding at the semitone boundary) can disagree by a cent and flip the displayed note.

**51. Three near-identical cpal stream builders duplicated across mic/ref/random** - `problem` M/M - _egui-native_
  - egui/src/main.rs:485-507 (ref), 510-542 (random), 437-481 (mic input config block)
  - toggle_ref and play_random_string contain byte-for-byte identical host/device/config resolution and a duplicated sine-oscillator closure; extract a build_tone_stream(freq) helper and a resolve_output_device() to kill ~60 duplicated lines and the divergence risk.

**52. WEB_ENGINE / WEB_STATE global OnceLock<Mutex> singletons couple wasm feed to a hidden global** - `problem` M/M - _egui-native_
  - egui/src/main.rs:28-32, 558-591, 631-636
  - feed_audio_samples reaches into module-global singletons rather than an explicit handle, so there can only ever be one App and the data flow is invisible; pass an Arc handle into the JS bridge (or a thread-local registry keyed by canvas) instead of process-global statics.

**53. Native backend emits {frequency, level} but web path emits raw audio frames; output contracts diverge** - `problem` M/M - _audio-io-realtime_
  - useNativeAudioInput.ts:4-7 / native_audio.rs:20-25 vs useAudioInput.ts:6-9 (AudioFrame buffer+sampleRate)
  - Native does detection in Rust and emits final frequency; web ships raw buffers to JS detectPitch. This split means smoothing, confidence, power-chord, and spectrum exist only on one path, so native and web feel like different tuners. A shared DetectionFrame would unify them.

**54. egui output stream assumes f32 sample format without matching on supported format** - `problem` M/M - _audio-io-realtime_
  - egui/src/main.rs:493-501, 525-533
  - build_output_stream is called with a |&mut [f32]| closure using default_output_config() directly; if the device's native format is i16/u16 (common on Windows/WASAPI) this errors or produces noise. The input path already dispatches on SampleFormat; output should too.

**55. Web getUserMedia has no device-disconnect recovery; loses stream silently on unplug** - `problem` M/M - _audio-io-realtime_
  - useAudioInput.ts:23-39 (refreshInputDevices), 46-66 (start)
  - devicechange only refreshes the list and clears selectedInputDeviceId; it never restarts the active stream when the in-use device disappears, and there is no track.onended handler, so unplugging the active mic leaves isListening=true with a dead track and no error surfaced.

**56. WASM path detect_pitch_wasm has no test and build can silently no-op** - `problem` M/M - _testing-ci_
  - pitch-core/src/lib.rs:377 detect_pitch_wasm; web/package.json:10 build:wasm ends in `|| echo 'WASM build skipped or failed'`
  - The wasm export is untested, and a failed wasm-pack build is swallowed by `|| echo`, so a broken/missing WASM module produces a green build.

**57. FrequencySmoother (TS) and Smoother (Rust) are byte-for-byte equivalent algorithms maintained twice** - `problem` M/M - _duplication_
  - web/src/utils/pitch.ts:230-256 (FrequencySmoother) vs pitch-core/src/lib.rs:473-518 (Smoother)
  - Identical EMA(alpha=0.4)+median(maxHistory=5) logic in both languages; a WasmSmoother wrapper already exists in lib.rs:520-541 but the web path ignores it and runs the TS copy, so tuning either requires editing both.

**58. No reentrant / non-ascending string flag despite high-G ukulele and banjo 5th string** - `problem` M/M - _instruments-domain_
  - web/src/utils/notes.ts:297-301 (ukulele GCEA), :325-330 (banjo gDGBD)
  - Reentrant tunings exist (uke high-G G4 below C4 string, banjo g4 then D3) but no flag marks them; any 'tune in order low->high' UI or arrow guidance will mis-order them.

**59. Rust find_closest_string lacks temperament/course logic present in TS** - `problem` M/M - _instruments-domain_
  - pitch-core/src/domain.rs:197-217 vs web/src/utils/notes.ts:512-524
  - The Rust path only scales by a4/440 and has no temperament offset, no course grouping, so the egui/native build gives different targets than web for the same tuning.

**60. Three independent YIN implementations that must agree but share no code** - `problem` H/H - _architecture-coupling_
  - pitch-core/src/lib.rs:153-268 vs web/src/utils/pitch.ts:69-151 vs desktop/src-tauri/src/native_audio.rs:201-290
  - pitch-core, the web TS path, and the Tauri native path each hand-roll YIN+CMNDF+parabolic-interp; desktop and web do not consume pitch-core at all, so bug fixes (e.g. the CMNDF/local-minimum fix) must be ported by hand to three places.

**61. Rust domain.rs and TS notes.ts duplicate the domain and have diverged** - `problem` H/H - _architecture-coupling_
  - pitch-core/src/domain.rs:28-167 vs web/src/utils/notes.ts:51-359
  - domain.rs hardcodes 13 guitar tunings and equal-temperament math only; notes.ts owns 14 instruments, 7 temperaments, sweetening profiles, capo/transpose — the two domains are not generated from one source and will keep drifting.

**62. egui App remains a god-object: update() mixes viz history, input, widgets, DSP wiring, persistence** - `problem` H/H - _architecture-coupling_
  - egui/src/main.rs:146-398
  - Despite AudioManager/VizManager extraction, App.update() still pushes cents/spectrogram history, handles keyboard, renders every widget, locks the engine, and save() persists settings inline; no TunerSession layer separates state from presentation.

**63. TS pitch.ts and Rust lib.rs are duplicated, divergent YIN implementations** - `problem` H/H - _dsp-algorithms_
  - web/src/utils/pitch.ts:69-151 vs pitch-core/src/lib.rs:153-268
  - Two hand-maintained YIN copies have already drifted (TS uses normalizePitchDetectionRange 24-1200Hz + autocorrelate fallback; Rust hardcodes 30-400Hz + MPM fallback and a different dip-walk), so web and native give different pitch on the same audio with no parity test.

**64. Three independent YIN pitch detectors with no shared contract** - `problem` H/H - _audio-io-realtime_
  - web/src/utils/pitch.ts:69; desktop/src-tauri/src/native_audio.rs:201; pitch-core (egui via engine.process)
  - Web TS YIN, tauri hand-rolled YIN, and egui's pitch-core YIN are three separate implementations with divergent thresholds (web 0.12 vs tauri 0.12 fallback 0.35, separate RMS gates). No single DetectionFrame/engine port, so the same input can produce different results across backends.

**65. No shared AudioInput/AudioOutput port across getUserMedia, cpal (egui), and cpal (tauri)** - `idea` H/H - _audio-io-realtime_
  - useAudioInput.ts; useNativeAudioInput.ts; egui/src/main.rs AudioManager; native_audio.rs
  - Each backend has its own start/stop/enumerate/restart surface with different shapes (web returns AnalyserNode frames, native returns {frequency,level} events). A single trait/interface (start, stop, setDevice, enumerate, frame stream) would let the UI and detection layer treat all three uniformly.

**66. TS composables (12 files) have zero unit tests** - `problem` H/H - _testing-ci_
  - web/src/composables/* (useTuningState, useCentsHistory, useMetronome, useEarTraining, useSettings, ...); test-core.mjs only covers utils/notes.ts and utils/pitch.ts
  - All stateful logic (smoothing, history, metronome timing, settings persistence) is untested; no vitest/@vue/test-utils present to test reactive composables in isolation.

**67. YIN + autocorrelation/MPM pitch detection fully reimplemented in TS and Rust** - `problem` H/H - _duplication_
  - web/src/utils/pitch.ts:69-228 (detectPitchYIN/autoCorrelate/detectPitch) vs pitch-core/src/lib.rs:153-358
  - Two independent YIN implementations with subtly different fallbacks (TS falls back to autocorrelation, Rust to MPM) and thresholds; the web hot path (usePitchLoop.ts:112) calls TS detectPitch, so the compiled wasm detect_pitch_wasm export is dead - the shared core is not actually shared.

**68. macOS builds are unsigned and not notarized** - `problem` H/H - _build-pwa-distribution_
  - desktop/src-tauri/tauri.conf.json:61 (signingIdentity: null), .github/workflows/build-tauri.yml (no APPLE_* env)
  - dmg/app artifacts ship with signingIdentity null and the Tauri build step passes no Apple ID/team/keychain secrets, so Gatekeeper blocks users with 'damaged/unidentified developer'.

**69. Windows builds have no EV/code-signing certificate** - `problem` H/H - _build-pwa-distribution_
  - desktop/src-tauri/tauri.conf.json:46 (certificateThumbprint null, timestampUrl empty)
  - NSIS installer is produced with no thumbprint and empty timestampUrl, so SmartScreen flags the unsigned exe and no RFC3161 timestamp means signatures (if added) would expire with the cert.

**70. Note model has no course/pairing metadata; 12-string is a flat 12-element array** - `problem` H/H - _instruments-domain_
  - web/src/utils/notes.ts:8-12 (Note), :248-260 (twelve-string-standard)
  - Paired-course instruments (12-string, mandolin, bouzouki, charango) are modeled as independent strings with no `course`/`pair` field, so the UI and detection cannot treat a course as one tuning target.

**71. Web app does not use pitch-core wasm at all — bindings are dead for web** - `problem` M/H - _architecture-coupling_
  - web/src (grep wasm/pitch_core = 0 hits); pitch-core/src/lib.rs:360-379,520-541
  - detect_pitch_wasm/WasmSmoother/feed_audio_samples exist but nothing under web/src imports wasm; the browser runs the TS reimplementation, so the wasm surface only serves egui-wasm and the core is not the single source of truth it claims to be.

**72. No AudioInput/ToneGenerator port traits — cpal and Web Audio are wired in directly** - `idea` M/H - _architecture-coupling_
  - egui/src/main.rs:409-507; desktop/src-tauri/src/native_audio.rs:102-167; ARCHITECTURE.md:127-131
  - Each surface builds cpal/Web Audio streams inline; the planned `trait AudioInput { start; subscribe frames }` / `trait ToneGenerator` ports do not exist, so input/output cannot be faked for tests or swapped per platform.

**73. App.vue passes ~100 props/handlers sourced from one 300-line useTuner god-object** - `idea` M/H - _web-vue_
  - web/src/App.vue:98-329; useTuner.ts:145-262
  - useTuner re-exports ~120 members and App.vue threads each as an explicit prop/emit; provide the domain composables via inject (audio, tuning, training, metronome) so panels pull what they need instead of App.vue acting as a prop bus.

**74. App::update is still a god method: state copy, history push, shortcuts, and 5 inline painters in one 240-line fn** - `problem` M/H - _egui-native_
  - egui/src/main.rs:147-389
  - Despite AudioManager/VizManager extraction, update() still inlines waveform, cents-meter, cents-history, spectrum, and spectrogram drawing plus all widget wiring; extract data-driven painter fns (draw_waveform/draw_spectrum/etc.) taking slices so they are testable and update() shrinks to layout.

**75. Web audio uses AnalyserNode polling, not an AudioWorklet capture path** - `idea` M/H - _performance_
  - web/src/composables/useAudioInput.ts:58-64 + readFrame:107-120
  - Pitch is read via analyser.getFloatTimeDomainData on the main-thread rAF; an AudioWorklet feeding a SharedArrayBuffer ring would give deterministic frame timing and decouple capture from rAF throttling/background-tab stalls.

## P2 (110)

**76. PARTIAL 2026-06-30: clippy gate exists for pitch-core, not yet all Rust crates** - `problem` H/L - _testing-ci_
  - .github/workflows/test-core.yml now runs `cargo clippy -p pitch-core --all-targets --all-features -- -D warnings`.
  - Remaining: extend clippy gates to egui/Tauri where platform dependencies make sense.

**77. GitHub Releases publish no checksums for any artifact** - `problem` H/L - _build-pwa-distribution_
  - .github/workflows/release.yml:110-121 (files: list, no sha256 step)
  - release uploads artifact.tar + tauri/egui binaries with no SHA256SUMS file or per-asset digest, so users and package managers cannot verify download integrity.

**78. WaveformFrame/SpectrumFrame defined inside a composable, not a shared contract module** - `suggestion` M/L - _architecture-coupling_
  - web/src/composables/useVisualizationFrames.ts:3-18
  - The viz frame types live in the composable that produces them rather than a neutral types module (e.g. utils/frames.ts), coupling every visualizer's contract to the producer; extract to a standalone contract so Rust-derived frames could later satisfy the same shape.

**79. PARTIAL 2026-06-30: pitch-core has clippy/rustfmt gates; workspace-wide gate still missing** - `suggestion` M/L - _architecture-coupling_
  - .github/workflows/test-core.yml now checks `cargo fmt --check -p pitch-core` and clippy for pitch-core.
  - Remaining: decide how broad the workspace-wide fmt/clippy gate should be for egui and Tauri platform builds.

**80. Power-chord detection runs on raw buffer, not the DC-cleaned signal** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:73-77, 385-403 (is_likely_power_chord_impl on window)
  - process() passes the original window to is_likely_power_chord_native while detect_pitch internally used a mean-removed copy; a DC offset inflates the energy denominator and skews the corr/energy fifth-detection ratio threshold of 0.5.

**81. YIN difference function recomputed over full max_tau every call, ignores configured min range** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:185-193 vs TS pitch.ts:90-97
  - Rust computes diff[tau] for tau in 1..max_tau (down to 30Hz) on every frame even when only guitar range is needed, while the TS version limits to minTau..maxTau; the wider sweep is both slower and admits more subharmonic dips.

**82. MPM confidence is raw NSDF peak value, not normalized/comparable to YIN confidence** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:329 vs lib.rs:225 (1.0-yin[v])
  - YIN reports confidence as 1-CMNDF and MPM reports the NSDF peak height directly; these live on different scales yet both feed TunerUpdate.confidence, so downstream thresholds/UI treat incomparable numbers as one metric.

**83. Confidence not gated into the readout; low-confidence pitches still update note/cents** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:61-96 (process) + egui/src/main.rs:460-465
  - process() commits note/cents whenever freq_opt is Some, but MPM accepts peaks as low as 0.25 and YIN fallback up to min_val 0.35 (confidence 0.65); there is no minimum-confidence gate before showing a result, so weak/ambiguous frames flicker onto the display.

**84. No Rust unit test asserts fundamental over octave for a harmonic-rich (non-sine) signal** - `suggestion` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:543-667 (tests use pure sines only)
  - All accuracy tests feed single sinusoids; add a synthetic plucked-string signal (fundamental + decaying harmonics + noise) to actually exercise the octave-error path the guard is supposed to protect against.

**85. Visualization frames wrap typed arrays in deep-reactive ref() instead of shallowRef** - `problem` M/L - _web-vue_
  - web/src/composables/useVisualizationFrames.ts:20-21,46-55
  - ref<WaveformFrame|null>/ref<SpectrumFrame|null> make Vue proxy the frame object and (attempt to) track the Float32Array/Uint8Array each RAF tick; shallowRef avoids per-frame proxy overhead on 4096-sample buffers updated ~60x/s.

**86. Canvas visualizers run resizeCanvas (layout read of parent.clientWidth) on every drawn frame** - `problem` M/L - _web-vue_
  - web/src/components/Spectrum.vue:63,93; Spectrogram.vue:93; Waveform.vue:58
  - drawFrame() calls resizeCanvas() which reads parent.clientWidth and may mutate canvas.width every frame, forcing a forced synchronous reflow ~60x/s per active visualizer; move resize to ResizeObserver and only on actual change.

**87. No app-level error boundary; only mic errors surface** - `problem` M/L - _web-vue_
  - web/src/App.vue (no onErrorCaptured), main.ts (no app.config.errorHandler)
  - A throw in any panel (e.g. importCustomTunings, canvas ctx, worker glue) unmounts the tree with a blank screen; add app.config.errorHandler + an onErrorCaptured fallback card so a single broken feature does not kill the tuner.

**88. Unconditional ctx.request_repaint() every frame burns CPU/battery even when idle** - `problem` M/L - _egui-native_
  - egui/src/main.rs:148
  - The app repaints at max framerate continuously regardless of whether mic/ref is active; gate repaints on self.listen||self.ref_on or use request_repaint_after with a fixed cadence to stop spinning a core when silent.

**89. History pushed every frame regardless of new data, duplicating stale samples** - `problem` M/L - _egui-native_
  - egui/src/main.rs:153-163
  - Because update() runs at UI framerate but audio updates State at its own rate, the same cents/spectrum is pushed into history multiple times between audio callbacks, distorting the time axis of the cents plot and spectrogram; push only when State carries a new frame (e.g. a monotonically increasing seq id).

**90. egui reference and random-tone generators are duplicated raw-sine cpal blocks** - `suggestion` M/L - _audio-io-realtime_
  - egui/src/main.rs:485-507 (toggle_ref) and 510-542 (play_random_string)
  - Both build an identical sine output stream by hand with the same phase loop and 0.18 gain; no shared tone-output helper. The random path is also buggy (out.take). Unify into one play_tone(freq, duration) on the AudioOutput port.

**91. No suspend/resume or visibilitychange lifecycle handling for the web AudioContext** - `idea` M/L - _audio-io-realtime_
  - useAudioInput.ts:122-130; useReferenceTone.ts
  - Only onMounted/onUnmounted exist; tab backgrounding, OS audio-device sleep, or mobile interruption can leave a suspended context with no recovery. A visibilitychange/statechange handler that resumes (or stops cleanly and shows status) would harden mobile/laptop use.

**92. vue-tsc typecheck runs only in build-web, not in the deploy-from-release fast path** - `problem` M/L - _testing-ci_
  - .github/workflows/deploy.yml deploy-from-release job ships a prebuilt artifact.tar without rebuild/typecheck
  - Production deploy from a release artifact bypasses typecheck/build entirely; quality gating depends on the artifact having been validated earlier, which isn't asserted at deploy time.

**93. pitch-core tests assert weak/permissive tolerances and ignored results** - `problem` M/L - _testing-ci_
  - pitch-core/src/lib.rs:560 (accepts 440 OR 220 octave), :594 `let _ = is_likely_power_chord_native(...)` result discarded
  - test_yin_440hz passes on an octave error and test_power_chord never asserts its actual detection, so these guard much less than they appear to.

**94. Worker buffer transferred in but never transferred back; new Float32Array slice every detection** - `problem` M/L - _performance_
  - usePitchLoop.ts:119 (frame.buffer.buffer.slice(0)) + pitchWorker.ts:25 (postMessage without transfer back)
  - Each detection allocates a fresh ArrayBuffer copy via slice(0) and the worker never returns the buffer, so no buffer pooling/zero-copy handoff - churns ~16KB/detection at 30Hz.

**95. viz rAF runs whenever listening, even though Spectrum redraws are driven by a watch not the loop** - `problem` M/L - _performance_
  - useTuner.ts:38-42 (anyViz gate) vs Spectrum.vue:166 / Waveform.vue:110 watchers
  - Visualizers redraw inside a Vue watch on frame.sequence rather than their own rAF, so heavy canvas work runs synchronously in the reactive flush; coupling draw to the frame producer's rAF avoids extra reactivity-triggered layout/paint.

**96. Spectrum recreates a linear gradient object per bar per frame** - `problem` M/L - _performance_
  - web/src/components/Spectrum.vue:120-124 (ctx.createLinearGradient inside the displayBins loop)
  - Up to 160 createLinearGradient + 3 addColorStop calls per frame; the gradient is height-invariant per frame and can be built once before the loop (or cached on h change).

**97. resizeCanvas (full reflow read of parent.clientWidth) runs on every drawFrame** - `problem` M/L - _performance_
  - Waveform.vue:58, Spectrum.vue:64, Spectrogram.vue:93
  - Reading parent.clientWidth every frame forces layout; resize only changes on window/container resize, so gate it behind a ResizeObserver instead of measuring inside the hot draw path.

**98. No bundle-size budget gate in web CI** - `suggestion` M/L - _performance_
  - .github/workflows/build-web.yml (no size/gzip step)
  - build-web.yml builds but never checks output size; a gzipped-budget assertion (incl. the ~unused wasm) would catch regressions and surface the dead-weight wasm payload.

**99. PARTIAL 2026-06-30: Vitest + pitch-core clippy/rustfmt gates exist; perf coverage is still shallow** - `suggestion` M/L - _performance_
  - build-web.yml runs Vitest; test-core.yml runs pitch-core fmt/clippy/test/wasm feature checks.
  - Remaining: benchmark/perf regression tests and broader component/session coverage.

**100. YIN_THRESHOLD = 0.12 and energy gate constants (0.0025 / 0.012) duplicated across languages** - `problem` M/L - _duplication_
  - web/src/utils/pitch.ts:15-17 vs pitch-core/src/lib.rs:3 (YIN_THRESHOLD), lib.rs:174 (0.0025/0.012)
  - Same DSP tuning magic numbers hand-copied; pitch.ts even uses a second inconsistent gate (0.002/0.01 at lines 175/220) inside autoCorrelate/detectPitch, so the same 'is there signal' question has three different answers in one file.

**101. FFT size 2048 hard-coded five times in Rust, mismatched against web fftSize 4096** - `problem` M/L - _duplication_
  - pitch-core/src/lib.rs:36,45,100-102,108 and egui/src/main.rs:329,444-446,559-562; web useAudioInput.ts:11 (fftSize=4096)
  - No named constant: the literal 2048 appears in the planner, spectrum_buffer, Hann loop, bin math, and egui windowing; web analyser uses 4096 then the worker detects on the full frame, so the implicit frame-size contract is undocumented and language-specific.

**102. Sample rate constant inconsistent: 44100 (web default), 48000 (egui PREFERRED), runtime cf.sample_rate (cpal)** - `problem` M/L - _duplication_
  - web/src/composables/useAudioInput.ts:4 (DEFAULT_SAMPLE_RATE=44100) vs egui/src/main.rs:26 (PREFERRED_SAMPLE_RATE=48000) vs main.rs:441,497 (actual device rate)
  - egui spectrum harmonic overlay (main.rs:326-329) assumes 48000 for bin math but the mic stream feeds the real device rate, so harmonic marker positions are wrong on any non-48k device; web assumes 44100 as fallback - three different 'the' sample rate values.

**103. No freeze/hold button to capture the last reading** - `idea` M/L - _ux-product_
  - web/src/composables/usePitchLoop.ts (no pause path other than stop); App.vue main card
  - A plucked note decays fast and the gauge keeps moving; there is no freeze control to snapshot detectedNote/cents while the user inspects, only full stop() which tears down audio.

**104. Auto vs Manual mode label is buried inside StringSelector header** - `suggestion` M/L - _ux-product_
  - web/src/components/StringSelector.vue:29-40
  - The auto-detect/manual indicator only appears in the string grid header, far from the big note readout; the primary detection state isn't surfaced where the user looks (NoteDisplay/CentsGauge).

**105. Detected state gives no "too quiet / play louder" feedback distinct from idle** - `idea` M/L - _ux-product_
  - web/src/composables/usePitchLoop.ts:96-100 signalTooQuiet; CentsGauge waiting.signal
  - When signal is below RMS gate the gauge just shows generic WAITING FOR SIGNAL, identical to before playing; a guitarist can't tell mic-too-quiet from not-yet-plucked. Surface a distinct low-level hint.

**106. No prefers-reduced-motion handling for pulse/transitions** - `problem` M/L - _a11y-i18n_
  - web/src/style.css:142-148 mic pulse keyframes; App.vue:91 animate-pulse; LevelMeter.vue:18,25; CentsGauge needle transitions
  - Continuous mic pulse, listening dot animate-pulse, and width transitions run regardless of OS reduce-motion; add a @media (prefers-reduced-motion: reduce) block that disables animation/transition.

**107. Lang toggle button has no aria-label or lang attribute** - `problem` M/L - _a11y-i18n_
  - web/src/App.vue:87-89 (only title="RU / EN", text 'RU'/'EN')
  - SR announces just 'RU' with no role context and title isn't reliably read; add aria-label like 'Switch language (current: English)' and lang on the label text.

**108. No skip link / landmark structure for keyboard and SR navigation** - `idea` M/L - _a11y-i18n_
  - web/src/App.vue:71-339 (divs only, no <main>/<nav>/<section>, no skip link)
  - Long single-column page with many panels has no landmarks or skip-to-tuner link, so keyboard/SR users must tab through everything; wrap regions in semantic landmarks.

**109. egui desktop in-tune indicator is color-only GREEN vs RED** - `problem` M/L - _a11y-i18n_
  - egui/src/main.rs:203 circle_filled GREEN/RED by cents.abs()<5
  - Desktop gauge dot conveys in-tune purely via green/red with no shape or text and no colorblind palette, unlike the web text cue; add a label or shape and an Okabe-Ito option.

**110. Tauri CSP only allows localhost dev origins; no production/connect hardening** - `suggestion` M/L - _build-pwa-distribution_
  - desktop/src-tauri/tauri.conf.json:28
  - connect-src hardcodes http/ws localhost:5173 (only meaningful in dev) and there is no separate stricter production CSP; ship a dev-vs-release CSP so the packaged app does not whitelist a dev server and add object-src 'none'/base-uri 'self'.

**111. Web manifest ships only an SVG icon; no PNG/maskable icons for installability** - `problem` M/L - _build-pwa-distribution_
  - web/public/manifest.webmanifest:11-17
  - icons array has a single SVG with sizes 'any'; Android/Chrome install prompts require 192px and 512px PNGs plus a purpose:'maskable' entry, so the home-screen install is degraded or refused despite full PNG sets already existing for Tauri.

**112. No pre-compressed (gzip/brotli) assets generated at build time** - `idea` M/L - _build-pwa-distribution_
  - web/vite.config.ts:20-26 (no compression plugin)
  - GitHub Pages does not compress on the fly for all asset types; vite build emits only raw .js/.css/.wasm with no .br/.gz siblings, inflating transfer size of the bundle and wasm.

**113. Release job tags and publishes even when desktop builds fail (if: always)** - `problem` M/L - _build-pwa-distribution_
  - .github/workflows/release.yml:50-51 and 91-102
  - release runs with `if: always()`; if build-tauri/egui fail it still creates the git tag and GitHub Release containing only the web artifact, producing a published vX.Y.Z release missing the advertised desktop binaries and silently consuming that version number.

**114. No CI gates for clippy, rustfmt, or web lint** - `suggestion` M/L - _observability-reliability_
  - .github/workflows/test-core.yml; build-web.yml (only vue-tsc + build)
  - test-core runs only `cargo test -p pitch-core`; no `cargo clippy`/`cargo fmt --check` and no eslint, so reliability regressions (unused stream like out.take, unwrap panics) pass CI.

**115. No baroque/historical A4 presets (415/432/392/466)** - `idea` M/L - _instruments-domain_
  - web/src/utils/notes.ts (a4 param everywhere, free number)
  - a4 is a bare float threaded through midiToFrequency; there is no enumerated set of historical pitches (415 baroque, 392 French, 466 chorton, 432) for period-instrument users.

**116. Hardcoded 20Hz low cutoff in both note resolvers blocks legitimate low instruments** - `problem` M/L - _instruments-domain_
  - pitch-core/src/domain.rs:178; web/src/utils/notes.ts has no explicit floor but frequencyToMidi log2 unguarded
  - domain.rs returns '—' under 20Hz which is fine, but the floor should be tuning-aware (32.7Hz cello C / 30.9Hz bass B0 sit just above it with no margin for slightly-flat strings).

**117. No crate-level `//!` doc explaining pitch-core layering or entry points** - `problem` M/L - _dx-docs_
  - pitch-core/src/lib.rs:1 (top of crate)
  - Crate opens with bare consts and a one-line `mod domain` comment; there is no `//!` overview telling a reader to start at TunerEngine::process vs the free detect_pitch fns, or which are wasm-only vs native.

**118. PARTIAL 2026-06-30: pitch-core has CI clippy/rustfmt; egui/desktop remain ungated** - `problem` M/L - _dx-docs_
  - .github/workflows/test-core.yml now gates pitch-core fmt/clippy/tests/wasm feature check; build-egui.yml/build-tauri.yml still build only.
  - Remaining: add platform-aware egui/desktop lint/format strategy.

**119. No dependency-audit gate (cargo-audit / npm audit / dependabot)** - `suggestion` M/L - _dx-docs_
  - .github/workflows/ (no audit job), .github/ (no dependabot.yml)
  - No `cargo audit`, `npm audit`, or Dependabot config exists for a project pulling rustfft/cpal/tauri and a Vue/Vite toolchain, so vulnerable transitive deps go unflagged.

**120. MPM NSDF is full O(n²) over all tau with no downsampling, run in realtime callback** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:270-289
  - NSDF loops tau in 0..n/2 with an inner i-loop over n-tau on the full 2048 buffer (~2M mul-adds), and downsample_for_pitch exists but is never called in process(); this is the fallback path's worst case inside the audio thread.

**121. No decimation before YIN; full 4096-sample buffer scanned at full sample rate** - `problem` H/M - _performance_
  - web/src/utils/pitch.ts:90-97 (detectPitchYIN difference loop)
  - YIN difference function is O(half * tauRange) on 4096 samples @ 44.1/48k; downsample_for_pitch exists in WASM but is unused - decimating 4x before YIN would cut the inner loop ~16x for the low-frequency tau range.

**122. Spectrogram repaints entire 128x150 history with per-cell fillRect every frame** - `problem` H/M - _performance_
  - web/src/components/Spectrogram.vue:115-136
  - Nested loop issues up to ~19200 fillRect + string-template rgb() fillStyle assignments per frame instead of scrolling via drawImage(canvas) and drawing only the newest column - main offender for jank on the viz path.

**123. No guided string-by-string auto-advance; selection is fully manual** - `idea` H/M - _ux-product_
  - web/src/composables/useTuningState.ts:250-257 toggleString; App.vue keyboard 1-9
  - Once a string settles in-tune there is no logic to mark it done and jump to the next un-tuned string; user must click/press each string manually, defeating the core guided-tuning flow.

**124. pitch-core public API has zero rustdoc comments** - `problem` H/M - _dx-docs_
  - pitch-core/src/lib.rs (whole file), pitch-core/src/domain.rs (whole file)
  - grep '///' returns 0 in both files: TunerEngine, detect_pitch, Smoother, frequency_to_note, get_cents, find_closest_string etc. are entirely undocumented, so `cargo doc` yields empty pages and no signature guidance for consumers.

**125. No CONTRIBUTING with an 'add a tuning / add a detector' walkthrough** - `problem` H/M - _dx-docs_
  - repo root (no CONTRIBUTING.md), README.md has no contributing/dev section
  - Adding a tuning currently means editing both domain.rs get_tunings() and notes.ts BUILT_IN_TUNINGS and the parity test; adding a detector means matching detect_pitch_yin/mpm conventions - none of this is documented anywhere.

**126. useTuner is a ~110-member god facade aggregating 11 composables** - `suggestion` M/M - _architecture-coupling_
  - web/src/composables/useTuner.ts:15-263
  - The orchestrator re-exports nearly every field of audio/pitch/tuning/earTraining/metronome/settings as one flat object plus hosts practice-summary logic; grouping the return into namespaced sub-objects (tuning, practice, viz, metronome) would cut the surface consumers couple to.

**127. No vitest gate for the TS domain/DSP despite it being the web's real detector** - `suggestion` M/M - _architecture-coupling_
  - web/package.json:11 ("test" = node scripts/test-core.mjs); no vitest config
  - pitch.ts (YIN/autocorr) and notes.ts (temperaments, scaleTuning, frequencyToNote) carry the production web logic but have no vitest suite; the only `test` script shells to a core script, leaving the TS layer unguarded.

**128. No Rust↔TS parity test pinning the two YIN + note-math implementations together** - `idea` M/M - _architecture-coupling_
  - pitch-core/src/lib.rs:153-268 / domain.rs:177-217 vs web/src/utils/pitch.ts + notes.ts
  - Two full implementations of detection and note/cents math must agree numerically, but no test feeds identical synthetic sines/known frequencies to both and asserts matching freq/note/cents within tolerance, so silent divergence between web and native is undetectable.

**129. No vibrato / stable-pitch detection; median+EMA smoother masks but doesn't classify** - `idea` M/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:473-518 (Smoother)
  - The Smoother just de-jitters with EMA(0.4)+5-tap median; there is no variance/stability metric to tell a steady held note from vibrato or a still-decaying pluck, so the readout can settle on transient pitch.

**130. useSettings watches 27 sources with deep:true including the 500-entry practiceHistory array** - `problem` M/M - _web-vue_
  - web/src/composables/useSettings.ts:292-322
  - Every markEarTraining replaces practiceHistory with a fresh up-to-500 array, forcing a deep re-traversal of all watched arrays (customTunings/instruments/temperaments/offsets) on each correct/miss; split persistence into a debounced snapshot keyed off shallow refs.

**131. Hardcoded canvas colors make colorblind/light themes not apply to visualizers** - `problem` M/M - _web-vue_
  - web/src/components/Spectrum.vue:121-123, Spectrogram.vue:124-133, Waveform.vue:72, CentsHistory.vue:70
  - style.css has .theme-colorblind overrides for DOM, but Spectrum/Spectrogram/Waveform/CentsHistory bake #22c55e/#4ade80 and the heat ramp directly into ctx, so the colorblind theme (an accessibility feature) silently does nothing on the canvases.

**132. l10n uses raw localStorage and a separate store, divorced from settingsStorage persistence** - `problem` L/L - _web-vue_
  - web/src/stores/l10n.ts:3-7,234-237 vs useSettings.ts/settingsStorage
  - Language is persisted via direct localStorage('lang') while every other preference goes through settingsStorage; on Tauri/native this bypasses the unified store and language won't migrate or export with the rest of the settings.

**133. currentTuning resolution logic is duplicated between init and the reconciliation watch** - `suggestion` L/L - _web-vue_
  - web/src/composables/useTuningState.ts:87-90 and 409-415
  - The 'find lastTuningId in allTunings else defaultTuningForInstrument' expression appears both at ref init and inside the deep immediate watch; extract resolveActiveTuning() so the two paths cannot drift.

**134. native frame listener can leak if start_native_audio rejects after listen resolves** - `problem` L/L - _web-vue_
  - web/src/composables/useNativeAudioInput.ts:59-70
  - unlisten is set before invoke('start_native_audio'); the catch calls cleanupListener so it is handled, but if a second start() races (no in-flight guard) the prior unlisten ref is overwritten and the first listener leaks. Add a starting-in-flight guard.

**135. in-tune hysteresis state (inTuneStable) is a closure flag inside a shared computed** - `suggestion` L/L - _web-vue_
  - web/src/composables/useTuningState.ts:92,170-180
  - isInTune mutates the closure-scoped inTuneStable as a side effect during computed evaluation; computeds should be pure. Move hysteresis to a watch/effect so re-evaluation (e.g. devtools, double subscription) cannot corrupt the latch.

**136. detectionRange round-trips through useTuner ref instead of being consumed directly** - `suggestion` L/L - _web-vue_
  - web/src/composables/useTuner.ts:19,25,48-51
  - A local detectionRange ref mirrors tuning.detectionRange via watch only to feed usePitchLoop; usePitchLoop already accepts a Ref, so pass tuning.detectionRange (a computed Ref) straight in and drop the mirror ref plus its sync watch.

**137. Per-frame State clone of full spectrum + waveform Vecs every repaint** - `problem` M/M - _egui-native_
  - egui/src/main.rs:151 (self.st.lock().unwrap().clone())
  - ctx.request_repaint() forces continuous repaint (line 148), and each frame deep-clones State including spectrum (512 f32) and waveform (2048 f32); read fields under the lock into the painters or double-buffer, instead of cloning the whole struct ~60x/s.

**138. cents_history uses Vec::remove(0) (O(n) shift) instead of a VecDeque** - `problem` L/L - _egui-native_
  - egui/src/main.rs:153-156 (cents_history.push + remove(0)); field at 110
  - spectrogram_history correctly uses VecDeque with pop_front, but cents_history is a Vec doing remove(0) every frame after 300 entries, shifting up to 300 elements 60x/s; switch the field to VecDeque<f32>.

**139. set_visuals(Visuals::dark()) called every frame** - `problem` L/L - _egui-native_
  - egui/src/main.rs:149
  - Theme is re-applied on every update() instead of once at startup, doing needless style cloning each frame and preventing any future light/colorblind theme that the web side already supports; set visuals once in the creation closure.

**140. Device-change restart implemented as double toggle_mic hack instead of restart_mic()** - `problem` L/L - _egui-native_
  - egui/src/main.rs:268-273
  - The code itself flags this as a smell: it calls toggle_mic twice to restart the stream on device change, briefly tearing down then rebuilding; add an explicit AudioManager::restart_input that swaps the stream without the stop/start race.

**141. Harmonic-overlay bin math hardcodes 2048/sr while max_bins comment claims 44.1kHz** - `problem` L/L - _egui-native_
  - egui/src/main.rs:297 (comment '~0-4300 Hz at 44.1kHz') vs 326-329 (sr=48000, /2048.0)
  - The spectrum uses PREFERRED_SAMPLE_RATE=48000 but the max_bins comment and frequency labeling assume 44.1kHz, and native mic actually runs at the device sr (line 441), so harmonic vlines land on wrong bins when device sr != 48000; derive bin spacing from the actual capture sr carried in State.

**142. No latency measurement anywhere in the audio path** - `idea` M/M - _audio-io-realtime_
  - useAudioInput.ts (AnalyserNode); native_audio.rs callback; egui input callback
  - Nothing reads AudioContext.baseLatency/outputLatency or cpal stream latency, and no input->display lag is tracked. Capturing and surfacing measured latency would let you tune window/hop sizes and detect device-induced lag.

**143. Native frame emit throttled by 33ms wall-clock Instant inside the RT callback** - `suggestion` L/L - _audio-io-realtime_
  - desktop/src-tauri/src/native_audio.rs:144,152,156
  - Throttling via Instant::now() on the audio thread couples emit cadence to callback timing and adds a syscall per callback; a sample-count-based hop or off-thread scheduler is cleaner and keeps the RT callback minimal.

**144. egui phase accumulator `ph=(ph+1.0)%sr` loses precision and is per-stream ad hoc** - `suggestion` L/L - _audio-io-realtime_
  - egui/src/main.rs:500,532
  - Phase computed as 2*pi*f*ph/sr with integer-stepped ph modulo sr is fragile across sample formats and non-f32 output configs (output stream assumes f32 data without checking sample_format, unlike the input path which handles all formats).

**145. Native start uses a 2s ready timeout but leaks the spawned audio thread on timeout** - `problem` L/L - _audio-io-realtime_
  - desktop/src-tauri/src/native_audio.rs:63-74
  - If ready_rx.recv_timeout fires (Err) the function returns an error but stop_tx is dropped without being stored; the spawned thread is blocked on stop_rx.recv() forever (or runs the stream), and no stop signal is ever sendable, leaking the thread/stream until app exit.

**146. No golden/fixture harness for detection outputs** - `idea` M/M - _testing-ci_
  - pitch-core tests + test-core.mjs both hand-roll sine buffers inline; no shared WAV/fixture corpus
  - Capture a corpus of real recorded notes (and synthetic chords/noisy/low-SNR) with expected freq/cents as golden files, asserted by both Rust and TS suites.

**147. No benchmarks for the realtime DSP hot path** - `idea` M/M - _testing-ci_
  - pitch-core/Cargo.toml dev-dependencies (only `approx`); no criterion bench
  - detect_pitch/YIN/MPM/FFT run per audio callback; a criterion bench would catch per-frame latency regressions that threaten realtime budget.

**148. Hand-rolled esbuild bundling test runner instead of vitest** - `suggestion` M/M - _testing-ci_
  - web/scripts/test-core.mjs (bundles TS via esbuild into temp dir, node:assert)
  - Bespoke runner can't do watch mode, coverage, parallelism, or test the .vue/composable surface; migrating to vitest unlocks all of those and is the missing tool the dimension calls out.

**149. egui crate has no tests at all** - `problem` M/M - _testing-ci_
  - egui/src/* (no #[test]/mod tests); build-egui.yml only does cargo build
  - The native app's audio-callback glue, tone generation, and UI-state logic are entirely untested and only checked for compilation.

**150. No DetectionFrame/contract test guarding the Rust<->TS data shape** - `idea` M/M - _testing-ci_
  - pitch-core PitchDetection (lib.rs) vs TS detection range/stats objects passed in usePitchLoop.ts:112
  - There's no shared schema or contract test ensuring the fields/units (Hz, cents, confidence) produced by Rust match what the TS consumer expects, so a field rename breaks silently across the boundary.

**151. Two independent rAF loops (pitch + viz) run uncoordinated on the main thread** - `idea` M/M - _performance_
  - usePitchLoop.ts:106 and useVisualizationFrames.ts:57
  - Each composable owns its own requestAnimationFrame; both call getFloatTimeDomainData on the same analyser each frame - a single shared rAF driver would halve analyser reads and centralize frame scheduling.

**152. Canvas DPR/getContext/setTransform boilerplate reimplemented in 4 visualizers instead of using useHiDpiCanvas** - `problem` M/M - _duplication_
  - components/Waveform.vue:18,41,50,106; Spectrum.vue:19,46,55,162; Spectrogram.vue:24,47,56,154; CentsHistory.vue:17,40,103 vs composables/useHiDpiCanvas.ts
  - A useHiDpiCanvas composable exists with exactly this resize/clear/setTransform logic, but every canvas component still hand-rolls its own dpr getter, getContext('2d',{alpha:true}), setTransform, and '#11151b' clear - the abstraction was written but never adopted.

**153. Every persisted-settings key string is written four times across load/save x Tauri/local** - `problem` M/M - _duplication_
  - web/src/utils/settingsStorage.ts:97-123, 134-170, 177-204, 208-234
  - ~30 keys each appear as a literal string in the Tauri-load block, the localStorage-load block, the Tauri-save block, and the localStorage-save block; a single key/serializer table would remove ~120 stringly-typed lines and the risk of a typo'd key on one of the four paths.

**154. Power-chord detection exists only in Rust; web NoteDisplay has a dead isPowerChord prop** - `problem` M/M - _duplication_
  - pitch-core/src/lib.rs:385-413 (is_likely_power_chord) vs web components/NoteDisplay.vue:10,24-26 (isPowerChord prop)
  - is_likely_power_chord with the 1.4983 fifth-ratio heuristic is implemented and unit-tested in Rust but there is no TS equivalent; NoteDisplay accepts an isPowerChord prop that the web tuner path never populates, so the '(power)' badge only ever lights on the native backend - feature parity gap masquerading as a shared prop.

**155. Note-name array, midi<->freq, and noteId/get_note_display formatting duplicated in TS and Rust** - `suggestion` L/L - _duplication_
  - web/src/utils/notes.ts:1,363-374,414-432,466-468,526-531 vs pitch-core/src/domain.rs:4,169-188,219-224
  - NOTE_NAMES, midiToFrequency/frequency_to_midi, the (midi%12+12)%12 index, octave = midi/12-1, and the `${name}${octave}` display string are each implemented once per language; small individually but they are the lowest-effort items to consolidate behind a single generated-from-Rust contract.

**156. No post-session "how close" report; cents history is wiped on every start** - `idea` M/M - _ux-product_
  - web/src/composables/useCentsHistory.ts:15-31; useTuner.start clears it (useTuner.ts:55,64)
  - centsHistory is a rolling 96-point graph with no per-string final-error capture or summary; there is no record of how many strings ended in tune or their residual cents after a tuning session.

**157. No minimal/focus mode; layout modes don't hide secondary panels** - `idea` M/M - _ux-product_
  - web/src/App.vue:98-334 (all panels always rendered); layoutMode default/stage/compact in useTuner.ts:89-92
  - Every panel (temperament, offsets, ear training, metronome, stats) renders unconditionally; layoutMode only changes CSS classes, so there is no way to collapse to just note + gauge for stage use.

**158. PerStringCents.vue is dead code, never imported** - `problem` L/L - _ux-product_
  - web/src/components/PerStringCents.vue (no references in src)
  - grep shows zero importers; it also hardcodes English "Per string:", uses raw red/green and a broken width formula. Either wire it into a per-string overview or delete it.

**159. NoteDisplay confidence/power-chord props are declared but never fed** - `problem` L/L - _ux-product_
  - web/src/components/NoteDisplay.vue:5-13,24-27; App.vue:175-181 omits them
  - confidence and isPowerChord props exist and render UI, but App.vue passes neither and the pitch loop exposes no confidence; the Detected state can't show signal-quality, so weak detections look identical to strong ones.

**160. String buttons don't show per-string tuned/in-progress status** - `idea` M/M - _ux-product_
  - web/src/components/StringSelector.vue:42-56
  - Buttons only reflect selected vs not; there is no green "tuned" / amber "close" / grey "untouched" state per string, so the grid can't act as a checklist for completing all six strings.

**161. No dir/RTL support anywhere despite locale switching** - `idea` M/M - _a11y-i18n_
  - web/src/stores/l10n.ts (only ru/en); App.vue root div; index.html
  - No document.dir handling, no logical CSS properties, and left-handed reverse uses array.reverse not dir; adding any RTL locale would break layout - set dir per locale and audit margins/needle direction.

**162. No screen-reader bucketed cents description** - `idea` M/M - _a11y-i18n_
  - web/src/components/CentsGauge.vue (status only says in.tune/sharp/flat); useTuningState.ts cents
  - SR users get raw needle/'SHARP' but no magnitude; expose bucketed text (in tune / slightly / very flat|sharp) so non-visual users know how far off without reading the gauge.

**163. Canvas visualizers ignore theme and colorblind palette** - `problem` M/M - _a11y-i18n_
  - web/src/components/Waveform.vue:72; Spectrum.vue:122,130 (hardcoded #22c55e/#f59e0b)
  - Waveform/Spectrum strokeStyle/gradient hardcode green+amber with no theme or colorblind variant and no forced-colors fallback; read colors from CSS custom properties or a theme palette object.

**164. No forced-colors / prefers-contrast / Windows High Contrast support** - `idea` M/M - _a11y-i18n_
  - web/src/style.css (no forced-colors media query); SVG/canvas use fixed fills
  - Gauges and buttons rely on background-color that vanishes in forced-colors mode; add a @media (forced-colors: active) block mapping to system color keywords and outlines.

**165. Only sharps + scientific notation; no flat or solfege (Do-Re-Mi) note names** - `idea` M/M - _a11y-i18n_
  - web/src/utils/notes.ts:1 NOTE_NAMES, getNoteDisplay:526; no preference in useSettings.ts
  - getNoteDisplay hardcodes C# style; many locales (RU/IT/FR/ES) expect Do-Re-Mi or flats - add a note-name-style setting and locale-aware name table rather than one global sharp array.

**166. String shortcuts capped at 1-9; higher strings unreachable by key** - `problem` L/L - _a11y-i18n_
  - web/src/App.vue:54-58 handleKey number parse
  - 12-string tuning has 12 strings but only keys 1-9 select; strings 10-12 have no keyboard shortcut and there's no arrow-key cycling - extend or use bracket/arrow navigation.

**167. WASM artifact is not content-hashed / versioned for cache-busting** - `problem` M/M - _build-pwa-distribution_
  - web/public/wasm/pitch_core_bg.wasm (fixed name copied verbatim into dist/wasm)
  - files in public/ bypass Vite hashing, so pitch_core_bg.wasm keeps a stable URL; once a SW/offline cache exists a stale wasm would be served indefinitely after an update (and today it ships unhashed regardless).

**168. No pipeline health strip (WASM/ctx state / fps / last error)** - `idea` M/M - _observability-reliability_
  - web/src/App.vue:169-172
  - Only observability surface is a single red error banner; there is no compact diagnostics readout for AudioContext state, worker alive, detection fps, sampleRate, or last-error, making field debugging blind.

**169. No clipping / DC-offset / hum watchdog despite stats availability** - `idea` M/M - _observability-reliability_
  - web/src/composables/usePitchLoop.ts:92-97; web/src/utils/pitch.ts:24-37
  - computeSignalStats only yields rms/maxAbs used for a silence gate; no detection of clipping (maxAbs near 1.0), DC offset (mean!=0), or 50/60Hz hum to warn the user about bad input conditions.

**170. LevelMeter 80% color break is cosmetic, not a real clip indicator** - `problem` L/L - _observability-reliability_
  - web/src/components/LevelMeter.vue:16-31
  - The yellow/red gradient triggers on normalized rms*18 crossing 0.8, not on actual sample clipping (maxAbs>=~0.99); it can stay green through hard clipping and red on a loud-but-clean signal.

**171. No update-available checker despite version.json + injected SHA** - `idea` M/M - _observability-reliability_
  - web/.github/workflows/build-web.yml (VITE_APP_VERSION/VITE_APP_SHA injected); web/src/main.ts
  - Build injects version/SHA env but nothing reads them at runtime or polls version.json to tell a long-open PWA session a new build exists; users get stuck on stale cached assets with no reload prompt.

**172. Native start uses a fixed 2s readiness timeout with no retry/diagnostics** - `suggestion` L/L - _observability-reliability_
  - desktop/src-tauri/src/native_audio.rs:67-74
  - recv_timeout(2s) returns a generic 'did not start in time' that conflates a slow-but-working device init with a real failure; no retry or device-name context makes intermittent startup failures hard to diagnose.

**173. Cello low-C extension (~32Hz, 5-string cello / C extension) absent and below 20Hz floor** - `problem` M/M - _instruments-domain_
  - web/src/utils/notes.ts:346-350 (cello C2=65Hz); :484-491 / domain.rs:178
  - Cello stops at C2; there is no C extension or 5-string cello low-C entry, and even if added the hardcoded 20Hz floor in frequency_to_note leaves no headroom for sub-33Hz fundamentals.

**174. Temperament/sweetening offsets keyed by flat string index, breaking on courses** - `problem` M/M - _instruments-domain_
  - web/src/utils/notes.ts:118 (sweet-guitar-12 12 offsets); useTuningState.ts:112-113
  - sweet-12-string supplies 12 offsets matched positionally to the 12 flat strings; if course grouping is introduced the offset arrays must be restructured per-course or they silently misalign.

**175. No explicit 'unison vs octave' course-type enum to drive beat-frequency tuning UI** - `idea` M/M - _instruments-domain_
  - web/src/utils/notes.ts (Tuning interface :20-26)
  - 12-string upper courses are unison (B3/B3, E4/E4) and lower are octave; distinguishing them would let the tuner offer beat-rate/zero-beat guidance for unison pairs, which the flat model cannot support.

**176. A4 changes don't propagate to the Rust catalog frequencies (precomputed constants)** - `problem` M/M - _instruments-domain_
  - pitch-core/src/domain.rs:19-26 (GUITAR_STRINGS_STANDARD literal Hz) vs notes.ts note() computes from equalFrequency
  - Rust strings carry literal 440-based Hz and are only rescaled at find_closest_string by a4/440; historical A4 or temperament shifts of the catalog itself are not representable on the native side.

**177. No runnable example for pitch-core (`examples/` absent, no doctests)** - `suggestion` M/M - _dx-docs_
  - pitch-core/ (no examples/ dir), no ``` fences in src
  - There is no `cargo run --example` showing feed-samples->TunerUpdate, and no doctest on detect_pitch/TunerEngine, so the only usage reference is reading egui/main.rs and web glue by hand.

**178. No ADRs recording key choices (YIN+MPM cascade, dual Rust/TS engines, A4-scaled cents)** - `suggestion` M/M - _dx-docs_
  - repo root (no docs/adr or adr/ dir); rationale only as inline comments in lib.rs:184/211
  - Non-obvious decisions (why YIN preferred then MPM fallback, why cents are computed against closest string not chromatic, why two engines exist) live only as code comments and large planning .md files, not as discoverable decision records.

**179. No dev synthetic-signal injector for the web pitch loop** - `idea` M/M - _dx-docs_
  - web/src/composables/useAudioInput.ts + usePitchLoop.ts (mic-only sources)
  - test-core.mjs builds sine buffers for node tests, but there is no in-app dev mode to inject a synthetic tone/sweep into usePitchLoop, so UI/visualizer work still requires a real instrument and mic.

**180. PARTIAL 2026-06-30: Vitest is wired into build-web CI; composable/component coverage is still missing** - `problem` M/M - _dx-docs_
  - web/package.json scripts.test -> `vitest run`; legacy `scripts/test-core.mjs` is retained as `test:core:legacy`.
  - build-web.yml runs `npm test`; remaining gap is Vitest coverage for composables/components and fake audio/session behavior.

**181. Self-documenting 'simplicity' hack left in egui play_random_string is undocumented dead code** - `problem` L/L - _dx-docs_
  - egui/src/main.rs:540
  - `let out_clone = self.audio.out.take();` immediately takes and drops the just-stored stream with only a hand-wavy comment; from a docs/DX view it is confusing dead-ish code with no doc-comment or issue link explaining intent.

**182. spectrum.clone() into State every audio callback allocates a fresh 512-f32 Vec** - `problem` L/M - _egui-native_
  - egui/src/main.rs:468-470 (g.spectrum = update.spectrum) + pitch-core/src/lib.rs:99 (vec![0.0f32;512])
  - process() allocates a new 512-element spectrum Vec each call and it is moved into State, so every callback heap-allocates on the audio thread; preallocate and write into a reused buffer to keep the realtime path allocation-free.

**183. Spectrogram inner loop fills 150x80 individual rect_filled calls per frame** - `idea` L/M - _egui-native_
  - egui/src/main.rs:355-375
  - Up to 12k tiny filled rects are emitted every repaint for the spectrogram; render to an egui TextureHandle (ColorImage) updated incrementally per new column instead of re-emitting all cells each frame.

**184. No E2E test driving the app with a fake mic / synthetic stream** - `idea` M/H - _testing-ci_
  - web (usePitchLoop/useAudioInput) and egui; no Playwright/headless harness feeding getUserMedia or cpal
  - Pipeline from audio frame -> visualization frame -> tuning state is integration-untested; a fake MediaStream feeding a known tone would catch wiring regressions composables can't.

**185. No stretch (Railsback) tuning model** - `idea` M/H - _instruments-domain_
  - web/src/utils/notes.ts:414-423 (midiToFrequency), domain.rs:169-171
  - Frequency is pure equal/temperament math with no inharmonicity curve; piano-style progressive sharpening of treble / flattening of bass octaves cannot be expressed.

## P3 (2)

**186. A4 is free numeric input with no lock against accidental change** - `suggestion` M/L - _ux-product_
  - web/src/App.vue:126-135; setA4 in useTuningState.ts:192-196
  - The A4 number field is always editable mid-session; a stray scroll/keypress shifts the whole reference. The dimension asks for a lock A4/tuning toggle that pins reference and current tuning.

**187. Visualizer mount-time watch registration delays first draw and double-guards isListening** - `suggestion` L/L - _web-vue_
  - web/src/components/Spectrum.vue:166-170, Spectrogram.vue:158-162, Waveform.vue:110-113
  - watch is created inside onMounted (not setup), so the immediate run happens post-mount and re-checks props.isListening already guarded by v-if in App.vue; lifting watch to setup with shallow frame ref simplifies and removes the redundant gate.
