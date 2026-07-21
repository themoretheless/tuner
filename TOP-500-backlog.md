# Guitar Tuner - Unified Top 500 Backlog and Grounded Audit

> **Canonical backlog and audit source.** The ranked `M1...M500` registry and the historical grounded `C1...C187` evidence now live in this one file. `M#` rows are stable options/risks, `C#` cards preserve pre-refactor evidence, [recommendation.md](recommendation.md) owns current `R#` dispositions, [PLAN.md](PLAN.md) owns execution order, and [ARCHITECTURE.md](ARCHITECTURE.md) explains the target shape. Dated `[DONE YYYY-MM-DD]` markers remain for traceability.

## Ranked Top 500 (M#)

Status note 2026-07-12: verified closures are M1, M2, M3, M5, M6, M7, M11, M13, M22, M24, M25, M26, M29, M32, M39, M40, M41, M44, M48, M49, M50, M51, M59, M64, M65, M68, M70, M71 and M177. All other rows are open, partial, optional or not yet revalidated; ranking is intentionally stable until a measured re-score.

All ~800 ideas from this session (rounds 1-4) re-scored on one consistent 0-100 priority rubric, deduped, 17 already-shipped items excluded, ranked. Source tag: r1=review backlog, r2/r3/r4=idea rounds.

| M# | Item | Tier | Val | Source | Note |
|---|------|------|-----|--------|------|
| 1 | move DSP off cpal realtime callback | P1 | 78 | r1:review | [DONE 2026-07-11] |
| 2 | remove blocking Mutex in audio callback | P1 | 76 | r1:review | [DONE 2026-07-11] |
| 3 | unify tunings and note math into pitch-core | P2 | 74 | r1:review | Registry plus one generated formula owner feed Rust and TypeScript facades. [DONE 2026-07-11] |
| 4 | octave-error guard subharmonic/NSDF | P2 | 73 | r1:review |  |
| 5 | real service worker / offline PWA | P2 | 72 | r1:review | [DONE 2026-07-11] |
| 6 | eliminate per-callback heap allocations | P2 | 70 | r1:review | [DONE 2026-07-11] |
| 7 | check Rust and TS tuning tables match | P2 | 66 | r1:review | [DONE 2026-07-11] |
| 8 | code-sign and notarize macOS/Windows | P2 | 66 | r1:review |  |
| 9 | Harmonic Product Spectrum octave disambiguator from the existing 2048 FFT | P2 | 66 | r2:algorithms | Reuses current FFT to kill octave errors with minimal code. |
| 10 | high-pass filter rumble/mains | P2 | 64 | r1:review |  |
| 11 | reconcile Rust/TS frequency-to-MIDI rounding | P2 | 64 | r1:review | Both targets use the generated nearest-MIDI contract. [DONE 2026-07-11] |
| 12 | Multi-resolution dual-window analysis: long window for low strings, short for high | P2 | 64 | r2:algorithms | Fixes low-E resolution vs high-string latency tradeoff. |
| 13 | stop resizeCanvas every frame | P2 | 62 | r1:review | [DONE 2026-07-11] |
| 14 | Tauri CSP | P2 | 62 | r1:review |  |
| 15 | adaptive noise-floor gate | P2 | 62 | r1:review |  |
| 16 | Verifiable '100% local, no network' privacy badge backed by CI zero-fetch test | P2 | 62 | r2:distribution | Strong trust signal with a cheap CI assertion; differentiates from cloud tuners. |
| 17 | Adaptive per-string tau search bounds derived from the selected target | P2 | 62 | r2:algorithms | Faster, fewer-error search when string known. |
| 18 | consolidate five rAF loops into one | P2 | 60 | r1:review |  |
| 19 | decouple detection cadence from rAF | P2 | 60 | r1:review |  |
| 20 | CI hygiene clippy/rustfmt/deploy-freshness | P2 | 60 | r1:review |  |
| 21 | Dedicated SEO landing page at /tuner/ targeting 'online guitar tuner' with schema.org FAQ + HowTo | P2 | 60 | r2:distribution | Primary organic-discovery lever for a web tuner. |
| 22 | WASM/native numeric-equivalence harness over a shared fixture manifest | P2 | 60 | r2:dx-quality | Native Rust, full-frame browser WASM and TS fallback share B0-E5 cents/confidence fixtures. [DONE 2026-07-12] |
| 23 | Graceful-degradation matrix: explicit WASM-down / mic-down fallback states | P2 | 60 | r3:observability-reliability | Defines deterministic UX for every failure mode instead of blank screens. |
| 24 | Playwright fake-WAV pipeline test asserts detected note | P2 | 60 | r4:docs-dx | Feed synthetic E2 audio, assert NoteDisplay shows E. [DONE 2026-07-11] |
| 25 | legible sidebar text | P2 | 58 | r1:review | [DONE 2026-07-11] |
| 26 | vitest unit tests note math | P2 | 58 | r1:review | [DONE 2026-07-11] |
| 27 | one-euro filter | P2 | 58 | r1:review |  |
| 28 | WebKitGTK media backend AppImage | P2 | 58 | r1:review |  |
| 29 | hardcoded 44100 in egui harmonic overlay | P2 | 58 | r1:review | [DONE 2026-07-11] |
| 30 | Confidence-weighted late fusion of YIN, MPM, HPS and Goertzel into one estimate | P2 | 58 | r2:algorithms | Single fused estimate from existing detectors cuts octave/jitter errors cheaply. |
| 31 | Shape/texture redundancy so in-tune state never relies on color alone | P2 | 58 | r2:a11y-deep | WCAG non-color-reliance; trivial and broadly useful. |
| 32 | Property-based test for frequencyToNote round-trip across A4 sweep | P2 | 58 | r2:dx-quality | Deterministic Rust/TS sweeps cover A4, MIDI, cents, temperament and transpose. [DONE 2026-07-11] |
| 33 | cargo-deny + npm audit supply-chain gate with committed advisory baseline | P2 | 58 | r2:dx-quality | Blocks vulnerable deps in CI cheaply. |
| 34 | "Test My Mic" self-diagnostic wizard with pass/fail panel | P2 | 58 | r3:observability-reliability | Cuts the #1 support cause (no signal) before it becomes a bug report. |
| 35 | Vitest fake-mic harness driving useTuner via scripted AnalyserNode stub | P2 | 57 | r2:dx-quality | Deterministic frontend tuner-logic testing. |
| 36 | Mic-signal sanity watchdog (silent / clipping / DC-stuck warnings) | P2 | 57 | r3:observability-reliability | Proactively tells users why detection is wrong before they blame the app. |
| 37 | aria-live for note and cents | P2 | 56 | r1:review |  |
| 38 | auto-advance string-by-string guided tuning | P2 | 56 | r1:review |  |
| 39 | fix CentsHistory deep watcher | P2 | 56 | r1:review | [DONE 2026-07-11] |
| 40 | bound MPM NSDF tau range | P2 | 56 | r1:review | [DONE 2026-07-11] |
| 41 | chromatic auto-detect mode | P2 | 56 | r1:review | [DONE 2026-07-11] |
| 42 | insta snapshot tests for full DetectionResult on fixture WAVs | P2 | 56 | r2:dx-quality | [PARTIAL 2026-07-18] 19 real WAV temporal gates exist; per-frame golden snapshots remain. |
| 43 | Browser-language auto-detect via navigator.languages with persisted override | P2 | 56 | r3:i18n-breadth | Foundation for all localization; cheap and immediately broadens reach. |
| 44 | Preallocate YIN buffers as module singletons across calls | P2 | 56 | r4:perf-bundle | pitch.ts reallocates per size change; pin to max guitar size. [DONE 2026-07-11] |
| 45 | Playwright E2E for mic-permission-denied flow | P2 | 56 | r4:docs-dx | Drive fake getUserMedia, assert permission UI path renders. |
| 46 | localize hardcoded English in-tune hint | P2 | 55 | r1:review |  |
| 47 | Goertzel bank locked to 6 selected-string targets and their first 4 harmonics | P2 | 55 | r2:algorithms | Cheap targeted detection when string is known. |
| 48 | WASM streaming instantiation via instantiateStreaming for pitch-core | P2 | 55 | r4:perf-bundle | wasm-bindgen loader uses `instantiateStreaming`; Playwright verifies the live WASM path. [DONE 2026-07-11] |
| 49 | validate/clamp A4 on load | P3 | 54 | r1:review | [DONE 2026-07-11] |
| 50 | gate FFT spectrum when viz hidden | P3 | 54 | r1:review | [DONE 2026-07-11] |
| 51 | reuse YIN difference buffers | P3 | 54 | r1:review | [DONE 2026-07-11] |
| 52 | Native mic-permission preflight via Tauri macOS AVCaptureDevice request | P3 | 54 | r2:native-os | Avoids silent failure when OS denies mic. |
| 53 | Gaussian-window interpolation on log-magnitude FFT peaks (Jacobsen/Quinn) | P3 | 54 | r2:algorithms | Sub-bin frequency accuracy from existing FFT. |
| 54 | Stale-PWA / update-available checker against version.json | P3 | 54 | r3:observability-reliability | Stops users getting stuck on cached old builds. |
| 55 | Cap maxTau by selected-string frequency to shorten YIN | P3 | 54 | r4:perf-bundle | When string chosen, narrow lag range, fewer CMNDF iterations. |
| 56 | first-run onboarding + mic priming | P3 | 53 | r1:review |  |
| 57 | cache Spectrum gradients | P3 | 52 | r1:review |  |
| 58 | collapsible settings sidebar on mobile | P3 | 52 | r1:review |  |
| 59 | build script copies WASM to unserved dir | P3 | 52 | r1:review | [DONE 2026-07-11] |
| 60 | Colorblind palette presets (deuteran/protan/tritan) replacing red/green coding | P3 | 52 | r2:a11y-deep | Red/green in-tune coding fails ~8% of male users. |
| 61 | Golden-trace differential runner: flag any fixture moving >1 cent | P3 | 52 | r2:dx-quality | [PARTIAL 2026-07-18] Replay envelopes exist; differential baselines and the 1-cent rule remain. |
| 62 | Adjustable in-tune tolerance + detection smoothing as accessibility controls | P3 | 52 | r2:a11y-deep | Lets tremor/motor users widen the target. |
| 63 | Locale-correct A4 decimal parsing accepting comma and period keypads | P3 | 52 | r3:i18n-breadth | Prevents broken A4 entry for half the world; trivial fix. |
| 64 | Configurable in-tune tolerance band in cents | P3 | 52 | r4:settings-personalization | Slider 1-10 cents controls green-zone width directly. [DONE 2026-07-11] |
| 65 | Lazy-load Waveform and Spectrum via defineAsyncComponent | P3 | 52 | r4:perf-bundle | App.vue statically imports both; split each into its own chunk. [DONE 2026-07-11] |
| 66 | spectrogram allocation and full redraw | P3 | 50 | r1:review |  |
| 67 | pin toolchain and wasm-pack version | P3 | 50 | r1:review |  |
| 68 | custom/editable tuning builder | P3 | 50 | r1:review | [DONE 2026-07-11] |
| 69 | web AudioWorklet detection | P3 | 50 | r1:review |  |
| 70 | strengthen TARGET vs detected note hierarchy | P3 | 50 | r1:review | [DONE 2026-07-11] |
| 71 | async device-change restart | P3 | 50 | r1:review | [DONE 2026-07-11] |
| 72 | useSettings single source for tuning/A4 | P3 | 50 | r1:review |  |
| 73 | in-tune confirmation cue haptic/sound/flash | P3 | 50 | r1:review |  |
| 74 | auto-detected string highlight + spring needle | P3 | 50 | r1:review |  |
| 75 | maskable PNG icons 192/512 | P3 | 50 | r1:review |  |
| 76 | wasm-SIMD f32x4 vectorization of YIN difference and MPM NSDF inner loops | P3 | 50 | r2:algorithms | Headroom to run fusion/multi-window without CPU cost. |
| 77 | Cognitive-load Simple Mode: target note + big up/down arrow only | P3 | 50 | r2:a11y-deep | Removes clutter for beginners and cognitive accessibility. |
| 78 | Synthetic harmonic-stack generator with controllable inharmonicity B-coefficient | P3 | 50 | r2:dx-quality | Realistic test signals for the whole suite. |
| 79 | Real-cepstrum quefrency cross-check gating the YIN result | P3 | 50 | r2:algorithms | Independent octave/voicing sanity check. |
| 80 | Power/idle-aware stream suspension on display sleep and app hide | P3 | 50 | r2:native-os | Saves battery when not actively tuning. |
| 81 | Audio-pipeline health strip (AudioContext state + buffer underrun counter) | P3 | 50 | r3:observability-reliability | Makes silent audio failures visible and debuggable in the field. |
| 82 | Sample-rate / device-mismatch reconciliation warning | P3 | 50 | r3:observability-reliability | Explains a subtle, common cause of detection error. |
| 83 | Versioned settings schema with migration runner | P3 | 50 | r4:settings-personalization | Stamp schemaVersion; migrate old keys on load, no data loss. |
| 84 | Gate visualizer chunk fetch behind showWaveform/showSpectrum toggles | P3 | 50 | r4:perf-bundle | Only download viz code when user enables that visualizer. |
| 85 | Decimate input to fixed 22050Hz before YIN loop | P3 | 50 | r4:perf-bundle | Guitar max 400Hz needs no 44.1k; halves tau-search cost. |
| 86 | header wrap/shrink at 320px | P3 | 48 | r1:review |  |
| 87 | bass 4/5-string tunings | P3 | 48 | r1:review |  |
| 88 | A4 clamp on commit not keystroke | P3 | 48 | r1:review |  |
| 89 | reference-tone playback feedback | P3 | 48 | r1:review |  |
| 90 | devicechange listener refresh | P3 | 48 | r1:review |  |
| 91 | per-instrument detection frequency range | P3 | 48 | r1:review |  |
| 92 | split useTuner god-composable | P3 | 48 | r1:review | [DONE 2026-07-19] |
| 93 | Kalman filter on (log-f0, df0/dt) replacing EMA+median smoother | P3 | 48 | r2:algorithms | Predictive smoothing tracks vibrato/glide better than EMA. |
| 94 | Detection-accuracy report artifact: cents-error histogram per SNR bucket | P3 | 48 | r2:dx-quality | [PARTIAL 2026-07-18] CI uploads per-capture JSON metrics; SNR buckets and histograms remain. |
| 95 | Version/build-info panel (git SHA, build date, WASM hash, platform) | P3 | 48 | r3:observability-reliability | Makes bug reports actionable with exact build identity. |
| 96 | Brotli + gzip precompress dist with vite-plugin-compression | P3 | 48 | r4:perf-bundle | Static GitHub Pages host can serve .br/.gz for JS/WASM/CSS. |
| 97 | Throttle visualizer redraw to 30fps decoupled from detection | P3 | 48 | r4:perf-bundle | Waveform/Spectrum at 30fps saves canvas work, detection stays fast. |
| 98 | Local seed fixture: bundled reference tone WAVs | P3 | 48 | r4:docs-dx | Ship per-string sample files for mic-free dev iteration. |
| 99 | Extract semantic color tokens from hardcoded hex | P3 | 48 | r4:theming-identity | CSS custom properties layer enabling all theming work in style.css. |
| 100 | redesign StringSelector for narrow column | P3 | 46 | r1:review |  |
| 101 | refactor egui App::update god method | P3 | 46 | r1:review |  |
| 102 | needle color gradient and directional arrow | P3 | 46 | r1:review |  |
| 103 | forced-colors mode mapping with SystemColor keywords for canvas needle/spectrum | P3 | 46 | r2:a11y-deep | Windows High Contrast support for canvas elements. |
| 104 | Phase-vocoder instantaneous-frequency refinement of the FFT peak bin | P3 | 46 | r2:algorithms | Higher precision than parabolic interpolation. |
| 105 | Open Graph + Twitter Card meta with per-tuning dynamic preview image | P3 | 46 | r2:distribution | Better share-link previews for SEO/social. |
| 106 | Pseudo-localization CI check flagging hardcoded strings before merge | P3 | 46 | r3:observability-reliability | Stops untranslated strings regressing into releases. |
| 107 | Skip getByteFrequencyData when Spectrum component unmounted | P3 | 46 | r4:perf-bundle | Stop analyser frequency reads entirely when spectrum hidden. |
| 108 | Dev mode synthetic-signal injector toggle | P3 | 46 | r4:docs-dx | Replace mic with generated f0 for deterministic local UI work. |
| 109 | accessible label for input device select | P3 | 44 | r1:review |  |
| 110 | ring buffer for centsHistory | P3 | 44 | r1:review |  |
| 111 | tighten 440Hz octave test | P3 | 44 | r1:review |  |
| 112 | idle vs no-signal empty states | P3 | 44 | r1:review |  |
| 113 | Tauri updater signed feed | P3 | 44 | r1:review |  |
| 114 | Inharmonicity-aware f0 fit (B-coefficient stretched-partial model) | P3 | 44 | r2:algorithms | Corrects wound-string stretched partials. |
| 115 | pYIN probabilistic candidates + Viterbi HMM pitch track across frames | P3 | 44 | r2:algorithms | State-of-art temporal track; heavier to implement. |
| 116 | Per-string cents announced as discrete buckets for screen-reader users | P3 | 44 | r2:a11y-deep | Readable SR output instead of rapid numbers. |
| 117 | Translated note-name systems by locale: Do-Re-Mi vs C-D-E | P3 | 44 | r3:i18n-breadth | Romance-language users expect solfege; core to feeling native. |
| 118 | egui native panic hook writing crash trace to OS app-data dir | P3 | 44 | r3:observability-reliability | Captures native crashes that otherwise vanish. |
| 119 | Translated egui native strings sharing the web app's locale JSON | P3 | 44 | r3:i18n-breadth | One translation source covers both clients. |
| 120 | Press-and-hold +/- A4 stepper auto-repeats with acceleration | P3 | 44 | r4:ui-micro | Hold accelerates Hz steps; tap nudges single increment. |
| 121 | Reuse single Float32Array for RMS and YIN, no copy | P3 | 44 | r4:perf-bundle | Share timeDomainBuffer; avoid second analyser read per frame. |
| 122 | In-tune color semantics override (green-blind safe sets) | P3 | 44 | r4:theming-identity | Theme defines in-tune/flat/sharp hues, not hardcoded green/amber. |
| 123 | async load persisted lastTuningId | P3 | 42 | r1:review |  |
| 124 | label A4 input | P3 | 42 | r1:review |  |
| 125 | label tuning select | P3 | 42 | r1:review |  |
| 126 | FFT-accelerate YIN/MPM | P3 | 42 | r1:review |  |
| 127 | DSP scope-recorder: dump per-frame internals to a replayable .ndjson trace | P3 | 42 | r2:dx-quality | [DONE 2026-07-21] Rust replay v2 is sample-indexed; a shared licensed contract compares native/WASM frames and verifies Tauri/egui projections. |
| 128 | Autocorrelation-of-the-spectrum (spectral autocorrelation) f0 estimator | P3 | 42 | r2:algorithms | Extra fusion vote robust to missing fundamental. |
| 129 | Window-state persistence across launches | P3 | 42 | r2:native-os | Restores size/position; expected desktop polish. |
| 130 | egui native: respect OS reduce-motion/high-contrast via accesskit + theme query | P3 | 42 | r2:a11y-deep | Brings native app to accessibility parity. |
| 131 | In-app local error-log viewer with copy-to-clipboard | P3 | 42 | r3:observability-reliability | Users can self-serve logs without devtools. |
| 132 | Locale-aware A4 number formatting with Intl.NumberFormat | P3 | 42 | r3:i18n-breadth | Displays decimals correctly per locale; pairs with parsing fix. |
| 133 | Swipe horizontally on tuner panel to cycle tunings | P3 | 42 | r4:ui-micro | Touch swipe steps prev/next tuning with edge bounce. |
| 134 | Clear-all-local-data button wiping localStorage IndexedDB caches | P3 | 42 | r4:privacy-security | One click clears settings, logs, caches, revokes mic stream. |
| 135 | Cache-version manifest with stale-cache purge on boot | P3 | 42 | r4:offline-storage | Compare baked CACHE_VERSION, delete old caches.keys() entries at startup. |
| 136 | CONTRIBUTING.md with WASM build prerequisites | P3 | 42 | r4:docs-dx | List wasm-pack, Rust toolchain, npm steps before first run. |
| 137 | High-contrast pro theme for bright-stage readability | P3 | 42 | r4:theming-identity | Max luminance separation on note-letter, gauge, cents bar. |
| 138 | anti-aliased decimation | P3 | 40 | r1:review |  |
| 139 | ukulele/violin/mandolin/banjo tunings | P3 | 40 | r1:review |  |
| 140 | announce listening status to SR | P3 | 40 | r1:review |  |
| 141 | redesign PerStringCents | P3 | 40 | r1:review |  |
| 142 | clean dead code dev security surface | P3 | 40 | r1:review |  |
| 143 | Sonification mode: continuous oscillator pitch encodes cents error (beat-against-target) | P3 | 40 | r2:a11y-deep | Enables fully non-visual tuning for blind users. |
| 144 | OKLCH cents-deviation hue ramp as the single tuner color signal | P3 | 40 | r2:design-motion | Perceptually-uniform color signal for tuning error. |
| 145 | Native macOS/Windows app menu with tuning + A4 items and shortcuts | P3 | 40 | r2:native-os | Standard native menu affordances. |
| 146 | Web Locks to serialize AudioContext/mic across duplicate tabs | P3 | 40 | r2:web-apis | Stops two tabs fighting over the mic. |
| 147 | OffscreenCanvas + dedicated Worker for the needle/cents meter | P3 | 40 | r2:web-apis | Renders meter off the main thread for smoothness. |
| 148 | Ship named language packs (ES, PT-BR, DE, FR, IT, JA, ZH-Hans, KO, HI, AR) | P3 | 40 | r3:i18n-breadth | Concrete locale set turns generic i18n into shippable market reach. |
| 149 | One-click diagnostic bundle export (env + flags + recent log, no audio) | P3 | 40 | r3:observability-reliability | Turns vague reports into reproducible ones, privacy-safe. |
| 150 | Regional default A4 preset (442/443 EU orchestral) keyed to locale | P3 | 40 | r3:i18n-breadth | Matches local tuning conventions out of the box. |
| 151 | Cents bullseye: concentric tolerance rings with live dot | P3 | 40 | r4:data-viz | Dot homes into green center ring as pitch nears target. |
| 152 | Bottom-sheet tuning picker on mobile with snap points | P3 | 40 | r4:ui-micro | Swipe-up sheet lists tunings, half/full detents. |
| 153 | A4 number-stepper with scroll-wheel and arrow-key nudge | P3 | 40 | r4:ui-micro | Focus field, wheel/arrows adjust Hz within clamp range. |
| 154 | URL query params preset tuning/A4/string state | P3 | 40 | r4:power-user | ?tuning=dadgad&a4=442&string=3 deep-links exact state |
| 155 | Tab/Shift+Tab roving focus across all controls | P3 | 40 | r4:power-user | Logical focus order, visible focus ring everywhere |
| 156 | Permissions explainer page detailing microphone-only no-upload usage | P3 | 40 | r4:privacy-security | Static page explaining mic stays on-device, never transmitted. |
| 157 | manualChunks split vendor vue from app code | P3 | 40 | r4:perf-bundle | Vue rarely changes; long-cache vendor chunk separate from app. |
| 158 | Cache Spectrum bar gradient and bin-x lookup tables | P3 | 40 | r4:perf-bundle | Precompute bar geometry once per resize, not per frame. |
| 159 | Public changelog page rendered from version.json | P3 | 40 | r4:content-marketing | Dated release notes build trust and fresh-content signals. |
| 160 | ADR for pitch-core as single-source DSP crate | P3 | 40 | r4:docs-dx | Record why YIN+MPM live in shared Rust, not duplicated per target. |
| 161 | JSDoc on pitch.ts and notes.ts public functions | P3 | 40 | r4:docs-dx | Document frequencyToNote, cents math signatures and edge cases. |
| 162 | stage mode large high-contrast readout | P3 | 38 | r1:review |  |
| 163 | input-device affordance/heading semantics | P3 | 38 | r1:review |  |
| 164 | Embeddable iframe widget (vite lib mode) + postMessage onInTune/onNote API | P3 | 38 | r2:distribution | Distribution multiplier across third-party sites. |
| 165 | Spring-physics needle driven by a critically-damped spring integrator | P3 | 38 | r2:design-motion | Smooth needle motion without overshoot. |
| 166 | Android app + Play listing via Tauri 2 mobile with Oboe low-latency audio | P3 | 38 | r3:platform-reach | Biggest install-base expansion; Oboe keeps latency tuner-grade. |
| 167 | Translation-completeness fallback chain with coverage badge | P3 | 38 | r3:i18n-breadth | Prevents blank strings and tracks translation progress. |
| 168 | Cents sparkline mini-history under note readout | P3 | 38 | r4:data-viz | Tiny 3-second inline trace shows whether pitch is settling. |
| 169 | Hover popover on string shows target Hz and cents | P3 | 38 | r4:ui-micro | Desktop tooltip surfaces exact frequency per string. |
| 170 | Double-tap a string to instantly select as target | P3 | 38 | r4:ui-micro | Quick gesture pins manual target without dropdown. |
| 171 | Units toggle: cents-only vs Hz-and-cents readout | P3 | 38 | r4:settings-personalization | Hide Hz for beginners, show both for techs. |
| 172 | Tauri capability allowlist audit removing unused command scopes | P3 | 38 | r4:privacy-security | Minimize Tauri v2 capabilities to mic and storage only. |
| 173 | Low-end-device mode: halve FFT_SIZE and viz FPS | P3 | 38 | r4:perf-bundle | Detect deviceMemory/hardwareConcurrency, reduce 2048 buffer and redraw rate. |
| 174 | FAQ schema JSON-LD on landing page | P3 | 38 | r4:content-marketing | Rich-result eligibility for "is this tuner accurate" queries. |
| 175 | Three-target architecture diagram in README | P3 | 38 | r4:docs-dx | Mermaid graph: pitch-core feeding web, egui, Tauri. |
| 176 | Visual-regression snapshots per CentsGauge needle angle | P3 | 38 | r4:docs-dx | Lock pixel output of gauge at -50/0/+50 cents. |
| 177 | prefers-reduced-motion handling | P3 | 36 | r1:review | [DONE 2026-07-11] |
| 178 | capo/transpose + pitch-pipe per-string reference | P3 | 36 | r1:review |  |
| 179 | Distinct vibration patterns: pulse-train flat, long-buzz sharp, double-tap in-tune | P3 | 36 | r2:a11y-deep | Eyes-free directional feedback; small code, big inclusion. |
| 180 | Modular type scale + 4px spacing tokens with fluid clamp() root | P3 | 36 | r2:design-motion | Design-system foundation for consistent layout. |
| 181 | RTL layout support with dir=rtl, logical properties, mirrored cents axis | P3 | 36 | r2:a11y-deep | Supports Arabic/Hebrew UI direction. |
| 182 | iOS/iPadOS app via Tauri 2 mobile reusing native pitch-core | P3 | 36 | r3:platform-reach | Unlocks App Store distribution and the high-value iOS music market. |
| 183 | Structured in-app bug-report template prefilled from local diagnostics | P3 | 36 | r3:observability-reliability | Standardizes incoming issues for faster triage. |
| 184 | Translated tuning-preset display names with locale conventions | P3 | 36 | r3:i18n-breadth | Completes the localized feel of the catalog. |
| 185 | Inline-edit string note via tap-to-spin chromatic picker | P3 | 36 | r4:ui-micro | Tap string label, scroll wheel to reassign note. |
| 186 | Toast confirming tuning switch with one-tap undo | P3 | 36 | r4:ui-micro | Transient toast: 'Drop D' with inline undo button. |
| 187 | CI bundle-size budget gate on dist JS/WASM bytes | P3 | 36 | r4:perf-bundle | Fail PR if main chunk or WASM exceeds set kB threshold. |
| 188 | OffscreenCanvas spectrum compute off main thread, fallback main | P3 | 36 | r4:perf-bundle | Move FFT-bin drawing to worker, free main for detection. |
| 189 | Histoire/Storybook stories for the 10 Vue components | P3 | 36 | r4:docs-dx | Isolated CentsGauge, Waveform, Spectrum states without live mic. |
| 190 | useTuner composable lifecycle sequence diagram | P3 | 36 | r4:docs-dx | Document AudioContext start, detection loop, teardown ordering. |
| 191 | Permissions-Policy header denying camera geolocation USB except microphone | P3 | 35 | r4:privacy-security | Lock down all browser features except needed microphone. |
| 192 | Fretboard SVG keyboard accessible | P4 | 34 | r1:review |  |
| 193 | text alternatives/pressed ARIA on canvases | P4 | 34 | r1:review |  |
| 194 | Always-on-top frameless mini-overlay with click-through when in-tune | P4 | 34 | r2:native-os | Compact stage/DAW companion; high desktop value. |
| 195 | Per-session tuning-stability score (0-100 from post-lock cents RMS) | P4 | 34 | r2:analytics | Headline practice metric users can track over time. |
| 196 | CSS container queries on the tuner panel instead of viewport media queries | P4 | 34 | r2:design-motion | Correct responsiveness when embedded at any width. |
| 197 | Global hotkey nudge-to-next-string in guided tuning | P4 | 34 | r2:native-os | Hands-light stepping during a guided pass. |
| 198 | Tray submenu to switch tuning preset and A4 without opening window | P4 | 34 | r2:native-os | Quick config from the system tray. |
| 199 | Captions track: on-screen text for every audio cue | P4 | 34 | r2:a11y-deep | Deaf-accessible labeling of sounds. |
| 200 | Screen-magnifier Huge Mode with rem-scaled layout and follow-focus reflow | P4 | 34 | r2:a11y-deep | Low-vision large-layout mode. |
| 201 | German note-naming (H/B) and Helmholtz/scientific octave toggle | P4 | 34 | r2:instruments-notation | Regional notation convention support. |
| 202 | Opt-in privacy-first crash reporter writing a local JSON trace file | P4 | 34 | r3:observability-reliability | Captures real failures without breaking the zero-network guarantee. |
| 203 | On-device 'What tuning is this?' auto-detect from a single open strum | P4 | 34 | r3:ai-ml-features | Signature local-ML feature that differentiates from every basic tuner. |
| 204 | Lefty mode mirroring the fretboard and string order | P4 | 34 | r3:education-content | Inclusivity win for left-handed players at low cost. |
| 205 | Local feature-flag panel persisted to localStorage / config file | P4 | 34 | r3:observability-reliability | Enables safe staged rollout and field debugging. |
| 206 | Localized PWA manifest name/description/shortcuts per language | P4 | 34 | r3:i18n-breadth | Native-feeling install metadata per locale. |
| 207 | Per-string accent identity: each open string owns a fixed brand hue | P4 | 34 | r3:brand-microinteractions | Consistent visual language across every view. |
| 208 | Long-press a string opens reference-tone sustain menu | P3 | 34 | r4:ui-micro | Hold string to ring sustained pitch, release stops. |
| 209 | Command palette (Cmd/Ctrl-K) for tunings and settings | P3 | 34 | r4:ui-micro | Fuzzy-search tunings, A4 presets, modes from one input. |
| 210 | Drag A4 horizontal slider with magnetic 440 detent | P3 | 34 | r4:ui-micro | Slider snaps softly at 440 within fine drag range. |
| 211 | Spacebar toggles listening start/stop | P3 | 34 | r4:power-user | Single most-used action on most accessible key |
| 212 | Per-tuning default A4 override | P3 | 34 | r4:settings-personalization | DADGAD remembers 442, standard stays 440 automatically. |
| 213 | CSP report-only header then enforce wasm-unsafe-eval default-src self | P4 | 34 | r4:privacy-security | Stage report-only, collect violations, then enforce strict policy. |
| 214 | Frame-time budget guard skipping detection when over 16ms | P4 | 34 | r4:perf-bundle | tick() drops a YIN pass on slow frames to hold 60fps. |
| 215 | IndexedDB tuning store replacing localStorage for packs | P4 | 34 | r4:offline-storage | Move custom tunings/packs from localStorage to structured IndexedDB store. |
| 216 | "Standard tuning notes EADGBE" cornerstone SEO page | P4 | 34 | r4:content-marketing | Targets the single highest-volume beginner guitar query. |
| 217 | ADR for Vite base '/tuner/' subpath constraint | P4 | 34 | r4:docs-dx | Document base-path coupling so contributors stop breaking asset URLs. |
| 218 | Pull request template with target-checklist | P4 | 34 | r4:docs-dx | Boxes for web/egui/Tauri tested and tuning-table parity. |
| 219 | ADR for keeping note math in two languages | P4 | 34 | r4:docs-dx | Explain Rust-TS duplication tradeoff vs single WASM source. |
| 220 | OLED true-black theme with pure #000 surfaces | P4 | 34 | r4:theming-identity | Saves AMOLED power; cards become #000, borders dim gray. |
| 221 | Animated tuning-fork logo with listening/locked states | P4 | 34 | r4:theming-identity | Tine vibrates while listening, settles when in tune. |
| 222 | footer contrast | P4 | 33 | r1:review |  |
| 223 | subtitle contrast | P4 | 33 | r1:review |  |
| 224 | Single-instance guard that forwards CLI args to the running window | P4 | 33 | r2:native-os | Prevents duplicate windows/mic contention; foundational desktop UX. |
| 225 | Curated static community tuning-pack gallery shipped in /public, offline | P4 | 33 | r3:community-social | Content depth with zero backend; high value for low effort. |
| 226 | Undo/redo stack for tuning and A4 changes | P4 | 33 | r4:ui-micro | Ctrl-Z reverts last tuning/A4/string edit; redo forward. |
| 227 | CI no-third-party-requests test blocking external fetch/connect | P4 | 33 | r4:privacy-security | Playwright fails build if any non-self network request fires. |
| 228 | light theme toggle | P4 | 32 | r1:review |  |
| 229 | Voice-control-friendly target names like 'tune string E2' | P4 | 32 | r2:a11y-deep | Reliable Voice Control/Dragon targeting. |
| 230 | Oboe-A / tuning-fork reference-listen mode that locks to the heard pitch | P4 | 32 | r2:workflows | Match the ensemble's actual sounded A. |
| 231 | Fretboard-note quiz overlaying the existing Fretboard SVG | P4 | 32 | r3:education-content | Reuses shipped SVG to add sticky learning value cheaply. |
| 232 | Remember-last-string per tuning | P4 | 32 | r4:settings-personalization | Reopen on the string you last tuned in that tuning. |
| 233 | Full backup export to single .tunerbackup JSON file | P4 | 32 | r4:offline-storage | Bundle tunings, A4, settings, stats into one downloadable file. |
| 234 | Illustrated empty-state art for idle/no-signal | P4 | 32 | r4:theming-identity | SVG sleeping headstock replaces bare idle text states. |
| 235 | strobe tuner mode | P4 | 30 | r1:review |  |
| 236 | NSStatusItem live cents micro-meter with colored attributed string in menu bar | P4 | 30 | r2:native-os | Glanceable tuning without window focus on macOS. |
| 237 | Follow-OS-theme via window theme events feeding web/egui palette | P4 | 30 | r2:native-os | Auto light/dark matching the OS. |
| 238 | Native 'in tune, hold it' notification with throttling | P4 | 30 | r2:native-os | Background confirmation without window focus. |
| 239 | WebGPU strobe/phase visualizer with WebGL2 fallback | P4 | 30 | r2:web-apis | GPU strobe disc; ambitious visual flourish. |
| 240 | Stereo-pan + pitch-glide sonification encoding sharp/flat direction | P4 | 30 | r2:a11y-deep | Directional audio cue beyond single-tone beat. |
| 241 | Dyslexia-friendly font option (OpenDyslexic/Atkinson) with spacing | P4 | 30 | r2:a11y-deep | Readability aid; small toggle. |
| 242 | Personal in-tune tolerance auto-calibration | P4 | 30 | r2:analytics | Adapts threshold to the user's steadiness. |
| 243 | OBS/Twitch browser-source overlay mode (?overlay=1) transparent compact needle | P4 | 30 | r2:distribution | Streamer overlay reusing one query flag. |
| 244 | "Tune for this song" preset library with capo + tuning per track | P4 | 30 | r3:education-content | High user-pull feature that drives repeat use and shareable content. |
| 245 | Tuning-fork wordmark with the dotted 'i' as a vibrating tine | P4 | 30 | r3:brand-microinteractions | Establishes a memorable visual identity the brand currently lacks. |
| 246 | Per-language pre-rendered landing pages (/tuner/es/, /tuner/de/) with hreflang | P4 | 30 | r3:i18n-breadth | Multiplies organic SEO reach across non-English search markets. |
| 247 | Linux Flatpak on Flathub with PipeWire/portal mic permission | P4 | 30 | r3:platform-reach | Primary Linux distribution channel with correct mic permissions. |
| 248 | Tuning-pack import/export round-trip self-test in CI | P4 | 30 | r3:observability-reliability | Guarantees bandpack compatibility across versions. |
| 249 | ICU MessageFormat plural/gender handling for count strings | P4 | 30 | r3:i18n-breadth | Grammatically correct counts across languages. |
| 250 | Ko-fi / Buy Me a Coffee one-tap tip jar | P4 | 30 | r3:monetization | Frictionless small-tip path; complements Sponsors. |
| 251 | Baroque vs modern A4 quick-toggle 415/430/440 | P4 | 30 | r4:bowed-strings | One-tap historical pitch standards instead of slider hunting. |
| 252 | Cents waterfall: scrolling per-frame deviation history band | P4 | 30 | r4:data-viz | Vertical scroll of cents-colored rows shows pluck decay drift. |
| 253 | Right-click string context menu: set reference, mute, edit | P4 | 30 | r4:ui-micro | Desktop context menu per string row with actions. |
| 254 | Long-press A4 value resets to 440 with confirm | P4 | 30 | r4:ui-micro | Hold value, ripple confirms snap back to standard. |
| 255 | Keyboard string navigation with up/down and Enter select | P4 | 30 | r4:ui-micro | Arrow through strings, Enter sets manual target. |
| 256 | Number-key direct string selection 1-6 | P4 | 30 | r4:power-user | Press digit to target that string immediately |
| 257 | Scriptable JSON config import/export file | P4 | 30 | r4:power-user | Declarative file defines hotkeys, tunings, defaults |
| 258 | Quarantine unknown keys on import, never silently drop | P4 | 30 | r4:settings-personalization | Preserve forward-compat keys from newer app versions. |
| 259 | Subresource Integrity hashes on WASM and JS bundles | P4 | 30 | r4:privacy-security | Vite plugin emits SRI digests; tamper-proof /tuner/ asset loads. |
| 260 | Inline critical CSS, defer rest to cut first paint | P4 | 30 | r4:perf-bundle | Extract above-fold tuner styles, async-load remainder. |
| 261 | requestIdleCallback-defer settings/practice code past mic start | P4 | 30 | r4:perf-bundle | Tuner core mounts first; defer TunerControls heavy logic. |
| 262 | Deferred beforeinstallprompt with contextual re-surface timing | P4 | 30 | r4:offline-storage | Stash event, show install CTA after second successful tune. |
| 263 | Per-tuning explainer article set: Drop D, DADGAD, Open G | P4 | 30 | r4:content-marketing | One deep page per tuning with notes, songs, history. |
| 264 | Tuning frequency reference table page (Hz per string) | P4 | 30 | r4:content-marketing | Snippet-bait table for 82.41Hz E2 etc. queries. |
| 265 | Reddit r/Guitar launch + AMA-style demo thread | P4 | 30 | r4:content-marketing | Privacy/offline angle resonates with that community. |
| 266 | Issue template for new tuning-preset submissions | P4 | 30 | r4:docs-dx | Structured form: strings, frequencies, source citation. |
| 267 | l10n contributor guide for adding string keys | P4 | 30 | r4:docs-dx | Document l10n.ts structure and RU/EN key parity rules. |
| 268 | surface color tokens remove unused palette | P4 | 28 | r1:review |  |
| 269 | viz start/stop transitions | P4 | 28 | r1:review |  |
| 270 | Chrome/Firefox MV3 toolbar extension opening WASM tuner in 360px popup | P4 | 28 | r2:distribution | New surface reusing existing pitch-core build. |
| 271 | Per-string accuracy heatmap across the 6 string targets | P4 | 28 | r2:analytics | Cheap visualization surfacing weak strings. |
| 272 | Global push-to-tune hotkey that summons overlay only while held | P4 | 28 | r2:native-os | On-demand overlay for live performance. |
| 273 | navigator.storage.persist() + estimate() to mark packs non-evictable, warn on low quota | P4 | 28 | r2:web-apis | Protects saved tunings from eviction. |
| 274 | User-submitted tuning presets via GitHub PR with JSON schema + CI validation | P4 | 28 | r3:community-social | Crowdsources the catalog safely; classic OSS growth loop. |
| 275 | Swappable needle skins: Strobe Disc, Analog VU, Laser Line, Vintage Plate | P4 | 28 | r3:brand-microinteractions | Personalization driver and a natural Pro-tier upsell candidate. |
| 276 | Windows Store MSIX package with packaged-app mic capability | P4 | 28 | r3:platform-reach | Clean Windows install and store discovery with proper capabilities. |
| 277 | Genre/artist-themed tuning collections as grouped catalog sections | P4 | 28 | r3:education-content | Improves discoverability of the existing tuning catalog. |
| 278 | Arabic RTL needle/cents with mirrored layout but LTR pitch axis | P4 | 28 | r3:i18n-breadth | Correct bidi handling so the meter stays physically meaningful. |
| 279 | GitHub Sponsors tier ladder with in-app 'Sponsor' footer link | P4 | 28 | r3:monetization | Low-effort recurring support channel for an OSS project. |
| 280 | Idle 'breathing' needle animation when no signal is present | P4 | 28 | r3:brand-microinteractions | Signals the app is alive and listening; cheap polish. |
| 281 | Single-string isolation: lock detection to one target | P4 | 28 | r4:live-deep | Ignore other strings when tech tunes one string fast. |
| 282 | Segmented control for detection mode guitar/chromatic/strobe | P4 | 28 | r4:ui-micro | Sliding pill toggle replaces dropdown for modes. |
| 283 | Export full config as downloadable tuner.json | P4 | 28 | r4:settings-personalization | Serialize all keys including custom tunings to one file. |
| 284 | Cross-Origin-Isolation COOP COEP headers for hardened context | P4 | 28 | r4:privacy-security | Enable crossOriginIsolated, gate future SharedArrayBuffer DSP safely. |
| 285 | Comparison page: Tuner vs GuitarTuna/Fender Tune | P4 | 28 | r4:content-marketing | Privacy/offline/free angle captures branded comparison search. |
| 286 | Design-token reference page from Tailwind config | P4 | 28 | r4:docs-dx | Auto-render color/spacing tokens used across components. |
| 287 | Gauge face skins: arc, linear bar, half-circle dial | P4 | 28 | r4:theming-identity | Pluggable CentsGauge rendering bound to one theme choice. |
| 288 | Blind-tuning self-test (hide cents, score the guess) | P4 | 26 | r2:analytics | Ear-training metric distinct from games already shipped. |
| 289 | tuner:// protocol handler opening a specific tuning + A4 preset | P4 | 26 | r2:native-os | Deep-launch into a configured state from links. |
| 290 | Web MIDI input tuning mode: cents deviation of MIDI note-on vs A4 | P4 | 26 | r2:web-apis | Tune from a connected keyboard/controller. |
| 291 | Signature in-tune chime voiced from the current tuning's open strings | P4 | 26 | r3:brand-microinteractions | Audio branding moment that reinforces success feedback. |
| 292 | Locale-correct font stack for CJK/Arabic/Devanagari with subset fonts | P4 | 26 | r3:i18n-breadth | Without this the language packs render as tofu; gating dependency. |
| 293 | User color-theme creator: 2-color seed generates the full dark palette | P4 | 26 | r3:brand-microinteractions | Strong personalization but needs a robust palette-generation engine. |
| 294 | macOS App Store (MAS) sandboxed distribution channel | P4 | 26 | r3:platform-reach | Sandboxed channel that pairs with paid IAP on macOS. |
| 295 | In-app 'Suggest a tuning' button prefilling a GitHub issue/PR body | P4 | 26 | r3:community-social | Lowers the contribution barrier for the PR-based catalog. |
| 296 | In-tune celebration micro-burst: subtle particle bloom on lock | P4 | 26 | r3:brand-microinteractions | Delightful reward moment reinforcing success. |
| 297 | Cello C-string low-end detection range extension | P4 | 26 | r4:bowed-strings | Reliable f0 down to bass C1 32.7 Hz. |
| 298 | Inline toast queue stacking with auto-dismiss timers | P4 | 26 | r4:ui-micro | Multiple notifications stack, oldest expires first. |
| 299 | Quick-switch tuning palette (Ctrl+K command bar) | P4 | 26 | r4:power-user | Fuzzy-search overlay to jump to any tuning instantly |
| 300 | Hold-to-sound reference tone while key down | P4 | 26 | r4:power-user | Momentary tone playback released on keyup |
| 301 | Import config JSON with validation and diff preview | P4 | 26 | r4:settings-personalization | Validate against schema, show what changes before applying. |
| 302 | Advanced vs Simple settings disclosure split | P4 | 26 | r4:settings-personalization | Hide gate/tolerance/range behind an Advanced toggle. |
| 303 | Glossary pages: cents, A4, harmonics, intonation | P4 | 26 | r4:content-marketing | Long-tail definitional pages internally linking to tuner. |
| 304 | "Best A4 reference: 440 vs 432 vs 442" debate article | P4 | 26 | r4:content-marketing | Controversial topic drives shares and backlinks. |
| 305 | New-feature announcement modal keyed to version.json | P4 | 26 | r4:notifications-engagement | Show once per build SHA; dismiss persists in localStorage. |
| 306 | TuningSelector redundant label | P4 | 24 | r1:review |  |
| 307 | metronome tap-tempo accent | P4 | 24 | r1:review |  |
| 308 | GitHub Action auto-generating animated demo GIF via headless Chromium + synthetic audio | P4 | 24 | r2:distribution | Keeps README/store demo fresh automatically. |
| 309 | Pre-take tuning gate with pass/fail threshold for the engineer | P4 | 24 | r2:workflows | Blocks recording until in-tune; high studio value, low effort. |
| 310 | Time-to-in-tune metric per string and per session | P4 | 24 | r2:analytics | Quantifies tuning speed improvement over time. |
| 311 | File System Access .tunerpack save/open with persistent FileSystemFileHandle | P4 | 24 | r2:web-apis | Edit-in-place tuning packs on the web. |
| 312 | First-attempt overshoot detector (sharp/flat bias profile) | P4 | 24 | r2:analytics | Reveals systematic tuning bias. |
| 313 | VST3 + AU bundle via nih-plug reusing pitch-core unchanged | P4 | 24 | r3:pro-audio-ecosystem | Largest reach multiplier for the existing engine into producer workflows. |
| 314 | Scale-practice mode detecting each played degree against a chosen scale | P4 | 24 | r3:education-content | Extends the detector into practice tooling without new DSP. |
| 315 | Chord-library cross-reference keyed to the current tuning | P4 | 24 | r3:education-content | Very useful for alt tunings; large content and correctness burden. |
| 316 | ChromeOS-optimized installable PWA with tablet/clamshell mic handling | P4 | 24 | r3:platform-reach | Captures the large education Chromebook base cheaply. |
| 317 | Open-string note-name recognition trainer (E-A-D-G-B-e flashcards) | P4 | 24 | r3:education-content | Cheap beginner drill that reinforces fundamentals. |
| 318 | Localized community-translations credit page + i18n CONTRIBUTING guide | P4 | 24 | r3:community-social | Motivates and structures translator contributions. |
| 319 | Bowed-string preset bank GDAE/CGDA/CGDA-bass tunings | P4 | 24 | r4:bowed-strings | Violin, viola, cello, 4/5-string bass standard fifths sets. |
| 320 | Loud-stage noise-aware confidence floor | P4 | 24 | r4:live-deep | Adapt gating thresholds for ambient stage roar between songs. |
| 321 | Beat-frequency envelope meter vs reference tone | P4 | 24 | r4:data-viz | Pulsing amplitude bar; beat rate slows to zero at unison. |
| 322 | Drag-reorder strings to reverse for left-handed display | P4 | 24 | r4:ui-micro | Vertical drag handle reorders string list, persists. |
| 323 | Keyboard cheat-sheet overlay bound to '?' | P4 | 24 | r4:power-user | Modal listing all active shortcuts contextually |
| 324 | Named setting presets (Studio, Live, Practice) | P4 | 24 | r4:settings-personalization | Save full settings snapshot under a name, switch instantly. |
| 325 | Reset-to-defaults scoped per settings section | P4 | 24 | r4:settings-personalization | Reset only visualizers or only detection, not everything. |
| 326 | Cloud-free settings sync via shareable text blob | P4 | 24 | r4:settings-personalization | Base64 paste-string moves config between browser and native. |
| 327 | Dependency pinning by integrity hash plus lockfile-lint gate | P4 | 24 | r4:privacy-security | lockfile-lint enforces https resolved URLs and integrity present. |
| 328 | Versioned IndexedDB schema with onupgradeneeded migration ladder | P4 | 24 | r4:offline-storage | Sequential migration functions per schema version, idempotent and tested. |
| 329 | "Why does my guitar go out of tune" troubleshooting article | P4 | 24 | r4:content-marketing | High-intent maintenance query with strong app CTA. |
| 330 | YouTube short: 30-second offline-tuner demo | P4 | 24 | r4:content-marketing | Visual proof of accuracy for social distribution. |
| 331 | breadcrumb + Article schema on all explainer pages | P4 | 24 | r4:content-marketing | Structured data lifts SERP presentation site-wide. |
| 332 | commitlint config rejecting type: prefixes | P4 | 24 | r4:docs-dx | Enforce the repo's no-conventional-prefix subject convention in CI. |
| 333 | Vintage analog-meter skin with cream face and amber lamp | P4 | 24 | r4:theming-identity | Skeuomorphic needle, ticks, glow for the gauge component. |
| 334 | normalize corner radii | P4 | 22 | r1:review |  |
| 335 | Setlist-bound multi-guitar profiles with one-tap silent-stage switch | P4 | 22 | r2:workflows | Targets gigging players changing tunings between songs. |
| 336 | Studio tuning log: timestamped take/tuning entries per session | P4 | 22 | r2:workflows | Engineer-facing record of tuning at each take. |
| 337 | Drift-after-tuning timeline per string (settle curve overlay) | P4 | 22 | r2:analytics | Shows new-string settle behavior visually. |
| 338 | Media Session now-playing surface for active tuning with prev/next-string actions | P4 | 22 | r2:web-apis | Lock-screen/headset string stepping. |
| 339 | SpeechRecognition voice commands: 'next string','low E','play A','stop' | P4 | 22 | r2:web-apis | Fully hands-free web operation. |
| 340 | "Your first 4 chords" guided lesson path using the detector | P4 | 22 | r3:education-content | Onboards absolute beginners; content-heavy to do well. |
| 341 | Guitar-with-USB direct-input device profile with auto channel selection | P4 | 22 | r3:hardware-peripherals | Smooths setup for USB-equipped guitars and interfaces. |
| 342 | Contributor wall generated at build time from git history (Credits page) | P4 | 22 | r3:community-social | Recognition fuels OSS contribution; fully automated. |
| 343 | Ship on-device models as versioned WASM/ONNX with cache + integrity check | P4 | 22 | r3:ai-ml-features | Infra prerequisite for any shipped local-ML feature. |
| 344 | Per-string fifths-check mode for violin/viola/cello/bass | P4 | 22 | r4:bowed-strings | Tune adjacent strings as pure 3:2 fifths, beat-rate readout. |
| 345 | Drop-tune delta: cents-to-detune for low string | P4 | 22 | r4:live-deep | Show how far to slacken E to D for next song. |
| 346 | Lissajous phase figure: mic signal vs reference sine | P4 | 22 | r4:data-viz | Rotating ellipse freezes still when string matches reference frequency. |
| 347 | Two-finger swipe-down dismisses settings sidebar mobile | P4 | 22 | r4:ui-micro | Gesture closes panel matching native sheet feel. |
| 348 | egui native global keymap mirroring web bindings | P4 | 22 | r4:power-user | Shared keymap JSON consumed by egui input handler |
| 349 | Settings dirty-state and discard-changes guard | P4 | 22 | r4:settings-personalization | Warn before nav if unsaved manual edits exist. |
| 350 | Default-startup-view setting (tuner/ear-trainer) | P4 | 22 | r4:settings-personalization | Choose which mode opens on launch. |
| 351 | storage.persisted() request gated on engagement signal | P4 | 22 | r4:offline-storage | Request persistent storage after user saves first custom tuning. |
| 352 | Tutorial series: tune by ear without a tuner | P4 | 22 | r4:content-marketing | 5th-fret method article funnels to app as backup. |
| 353 | "Drop D vs Drop C vs Drop B" comparison cluster | P4 | 22 | r4:content-marketing | Metal-genre tuning cluster captures niche long-tail. |
| 354 | Custom accent picker from a color wheel | P4 | 22 | r4:theming-identity | Replace fixed #22c55e green across buttons, gauge, strings. |
| 355 | Curated built-in theme gallery picker in settings | P4 | 22 | r4:theming-identity | Thumbnail grid of bundled themes with live preview swatch. |
| 356 | Notification permission soft-ask after first session | P4 | 22 | r4:notifications-engagement | Explain value before triggering OS permission prompt. |
| 357 | App Store / Play Store listing asset kit generator from a single template | P4 | 20 | r2:distribution | Automates icon/screenshots/ASO copy for store launch. |
| 358 | File association for .gtuning custom-tuning files with open-with import | P4 | 20 | r2:native-os | Double-click import of shared tunings. |
| 359 | Session export of tuning log to CSV for studio/teacher records | P4 | 20 | r2:workflows | Portable records from the log. |
| 360 | Exportable .bandpack: signed bundle of tunings + A4 + per-string references | P4 | 20 | r3:community-social | Solves real band-coordination pain and seeds a sharing format. |
| 361 | Android Quick Settings tile + iOS Control Center/Lock Screen launcher | P4 | 20 | r3:platform-reach | One-tap access drives habitual use on mobile. |
| 362 | Clip-on contact piezo input profile with vibration-pickup auto-detect | P4 | 20 | r3:hardware-peripherals | Better noisy-stage tuning for the common clip-on use case. |
| 363 | Interval ear-training between two played strings | P4 | 20 | r3:education-content | Useful musicianship feature reusing detection; not a game per se. |
| 364 | Note-on-staff reader linking each open string to standard notation | P4 | 20 | r3:education-content | Connects tuning to notation literacy for learners. |
| 365 | Local capo/partial-capo detector from open-string set vs chosen tuning | P4 | 20 | r3:ai-ml-features | Auto-transposes targets; reuses existing detection output. |
| 366 | Double-bass fourths tuning EADG preset | P4 | 20 | r4:bowed-strings | Orchestral bass tunes in fourths, not fifths; distinct table. |
| 367 | Bow-noise tolerant gating for sustained bowed tone | P4 | 20 | r4:bowed-strings | Stable readout despite scratchy attack and bow changes. |
| 368 | Kids mode toggle: oversized 56px+ string buttons | P4 | 20 | r4:kids-gamify | Big touch targets, fewer controls, hides advanced panels |
| 369 | Polar pitch wheel with 12 semitone spokes | P4 | 20 | r4:data-viz | Detected note as rotating arm; cents push off-spoke radially. |
| 370 | Pitch trajectory comet: fading trail of recent f0 | P4 | 20 | r4:data-viz | Comet tail shows attack glide direction toward target line. |
| 371 | Focus mode hiding all chrome (key 'f') | P4 | 20 | r4:power-user | Hide header/footer/sidebar, show only needle |
| 372 | Hotkey to cycle reference-tone through all strings | P4 | 20 | r4:power-user | Bracket keys step pitch-pipe up/down strings |
| 373 | Per-string custom in-tune tolerance overrides | P4 | 20 | r4:settings-personalization | Tighter band on high E, looser on low E. |
| 374 | Static asset hash manifest verified against version.json at load | P4 | 20 | r4:privacy-security | Runtime checks served bundle hashes match signed manifest. |
| 375 | Backup schema-version field with forward-compat import guard | P4 | 20 | r4:offline-storage | Reject or migrate older/newer .tunerbackup versions with clear message. |
| 376 | Press/media kit page: logo, screenshots, copy blurbs | P4 | 20 | r4:content-marketing | Lowers friction for bloggers and reviewers to feature. |
| 377 | Song-to-tuning index page (capo + tuning per song) | P4 | 20 | r4:content-marketing | Curated static map of popular songs to their tunings. |
| 378 | Live theme preview before applying in picker | P4 | 20 | r4:theming-identity | Hover a theme tile to temporarily recolor the tuner. |
| 379 | Tauri tray scheduled daily practice reminder | P4 | 20 | r4:notifications-engagement | Native OS notification at user-set hour via tauri-plugin-notification. |
| 380 | Canary channel toggle pulling versioned WASM from /tuner/canary/ | P4 | 20 | r4:business-ops-deep | Opt-in users get prerelease builds before stable promotion. |
| 381 | Per-tuning notation-system binding so world presets auto-select naming scheme | P4 | 18 | r2:instruments-notation | Right notation appears automatically with preset. |
| 382 | Capo-aware shared key for the band: announce capo + sounding key | P4 | 18 | r2:workflows | Aligns capoed players on a key. |
| 383 | Practice streak + calendar heatmap (GitHub-style) | P4 | 18 | r2:analytics | Habit motivation via streak grid. |
| 384 | CLAP-format tuner plugin sharing pitch-core as DSP backend | P4 | 18 | r3:pro-audio-ecosystem | Modern open plugin format; pairs naturally with the VST3/AU build. |
| 385 | USB-HID footswitch mapping for hands-free next-string stepping | P4 | 18 | r3:hardware-peripherals | High value for live performers; modest native-app effort. |
| 386 | Auto-tab a short monophonic riff into ASCII tablature, fully on-device | P4 | 18 | r3:ai-ml-features | Standout local feature, but scope and accuracy risk are large. |
| 387 | Printable tuning + chord-chart practice sheet PDF generator | P4 | 18 | r3:education-content | Tangible takeaway for teachers and students. |
| 388 | On-device practice-session auto-summary from the local drift timeline | P4 | 18 | r3:ai-ml-features | Gives end-of-session value from already-logged data. |
| 389 | Affiliate gear links: contextual string/capo/pickup recommendations | P4 | 18 | r3:monetization | Passive revenue tied to relevant moments; keep tasteful. |
| 390 | Fine-tuner vs peg guidance by cents magnitude | P4 | 18 | r4:bowed-strings | Coarse error says peg, small error says fine-tuner. |
| 391 | Course-aware Tuning model for paired-string instruments | P4 | 18 | r4:plucked-world | Add course grouping so bouzouki/laud/mandola octave pairs map correctly. |
| 392 | Long-tone intonation-hold scoring with drift graph | P4 | 18 | r4:wind-brass | Score steadiness over a sustained note, plot cents over seconds. |
| 393 | Stage-blackout one-hand mode: giant edge tap zones | P4 | 18 | r4:live-deep | Full-screen left/right halves advance string, no precise targets. |
| 394 | Six-string radial gauge cluster, hexagon arrangement | P4 | 18 | r4:data-viz | All EADGBE mini needles at once for whole-guitar glance. |
| 395 | Confidence ribbon overlaid on cents trace | P4 | 18 | r4:data-viz | Trace thickness or opacity encodes detection confidence per frame. |
| 396 | Radial long-press menu around string: tone, edit, octave | P4 | 18 | r4:ui-micro | Hold spawns arc of actions under finger. |
| 397 | Per-device input profiles keyed by deviceId label | P4 | 18 | r4:settings-personalization | Auto-load A4/tolerance/gate when a known mic reconnects. |
| 398 | CycloneDX SBOM generation for npm and Cargo dependencies | P4 | 18 | r4:privacy-security | Emit signed SBOM artifact per release for npm and crates. |
| 399 | Subset Tailwind font stack, drop unused system-ui fallbacks | P4 | 18 | r4:perf-bundle | No custom font loaded; trim CSS and preconnect nothing. |
| 400 | Backup restore with dry-run diff preview | P4 | 18 | r4:offline-storage | Show added/changed/removed entries before committing restore. |
| 401 | Read tuning from imported Guitar Pro .gp/.gpx file | P4 | 18 | r4:integrations-music | Parse .gp track header, auto-select matching 6-string tuning. |
| 402 | "How to tune a 12-string guitar" long-form guide | P4 | 18 | r4:content-marketing | Octave-pair tuning is a high-intent unanswered query. |
| 403 | Embeddable "Tuned with" badge for guitar blogs | P4 | 18 | r4:content-marketing | Backlink-generating HTML snippet pointing to /tuner/. |
| 404 | Social share-card SVG templates per tuning result | P4 | 18 | r4:content-marketing | Brandable images for Reddit/forum tuning posts. |
| 405 | iframe widget embed API reference page | P4 | 18 | r4:docs-dx | Document postMessage events, allowed attributes, sizing contract. |
| 406 | Copy-paste iframe embed snippet generator page | P4 | 18 | r4:docs-dx | Interactive form emitting ready iframe HTML for sites. |
| 407 | Sepia warm low-blue-light reading variant | P4 | 18 | r4:theming-identity | Amber-tinted surfaces for late-night practice eye comfort. |
| 408 | Donation thermometer SVG fed by static goals.json | P4 | 18 | r4:business-ops-deep | Server-maintained JSON renders raised-vs-goal bar, no tracking. |
| 409 | Concert-A broadcast: one device sets reference pitch for the whole ensemble | P4 | 16 | r2:workflows | Solves real orchestra/band reference-pitch coordination. |
| 410 | Teacher push-a-target mode: instructor sets note, student screen mirrors | P4 | 16 | r2:workflows | Remote-lesson tuning sync; strong teaching hook. |
| 411 | Gamepad API foot-controller stepping to advance strings/toggle reference hands-free | P4 | 16 | r2:web-apis | Hands-free control for performers. |
| 412 | Luthier string-change log with brand/gauge and settle-in tracking | P4 | 16 | r2:workflows | Records string history for setup work. |
| 413 | AUv3 app-extension inside a thin iOS host wrapper | P4 | 16 | r3:pro-audio-ecosystem | Lets iOS DAW users tune inline; depends on the iOS build landing first. |
| 414 | Local family/band profiles (avatar + name) in IndexedDB, header-switchable | P4 | 16 | r3:community-social | Personalizes multi-user devices without any account system. |
| 415 | Smart string-change reminder from accumulated post-tuning drift trend | P4 | 16 | r3:ai-ml-features | Turns drift history into a useful maintenance nudge. |
| 416 | On-device model-card + provenance page (no phone-home guarantee) | P4 | 16 | r3:ai-ml-features | Builds trust for local-ML features; reinforces privacy brand. |
| 417 | Difference-tone / beat-rate visualizer against reference drone | P4 | 16 | r4:wind-brass | Show beating against sustained reference for unison wind tuning. |
| 418 | Sustained-note steadiness meter (cents standard deviation) | P4 | 16 | r4:vocal-training | Live wobble gauge from rolling f0 variance during one held note. |
| 419 | Reward chime built from the open-string chord | P4 | 16 | r4:kids-gamify | Reuse sine engine to play a happy arpeggio on success |
| 420 | Harmonic stack ladder: partial deviations vs ideal integers | P4 | 16 | r4:data-viz | Visualizes string inharmonicity as drift up the overtone ladder. |
| 421 | Command palette recent/favorites ordering | P4 | 16 | r4:power-user | Surface last-used tunings first in Ctrl+K list |
| 422 | Settings JSON schema doc generated from TS types | P4 | 16 | r4:settings-personalization | Single source describes every key for import validators. |
| 423 | CI fail on disallowed WASM imports outside known namespace | P4 | 16 | r4:privacy-security | wasm-objdump asserts only env/webaudio imports, no surprise host calls. |
| 424 | Merge favicon.svg + icons.svg into one symbol sprite | P4 | 16 | r4:perf-bundle | Two SVGs (14KB) become one cached <use> sprite request. |
| 425 | Per-instrument auto-theme keyed to selected tuning | P4 | 16 | r4:theming-identity | Acoustic warm-wood vs metal cold-steel palette per preset. |
| 426 | Themeable needle/pointer SVG asset packs | P4 | 16 | r4:theming-identity | CentsGauge pointer loads from skin set: blade, dial, dot. |
| 427 | Theme import/export as single shareable JSON file | P4 | 16 | r4:theming-identity | Tokens serialized to .gtheme for swap without a server. |
| 428 | Per-string accent ramp themeable as a gradient set | P4 | 16 | r4:theming-identity | Six string hues derive from one editable base ramp. |
| 429 | egui native reminder via notify-rust desktop toast | P4 | 16 | r4:notifications-engagement | Standalone egui app schedules its own OS notification. |
| 430 | In-app roadmap voting via GitHub Discussions reactions embed | P4 | 16 | r4:business-ops-deep | Read-only fetch of reaction counts, vote opens GitHub. |
| 431 | Help-desk widget linking to canned offline troubleshooting answers | P4 | 16 | r4:business-ops-deep | Bundled FAQ, deep-links to email with diagnostics prefilled. |
| 432 | Chromagram: 12-bin pitch-class energy bar ring | P4 | 15 | r4:data-viz | Folds spectrum into pitch classes; confirms fundamental over harmonics. |
| 433 | Cents histogram building live during a hold | P4 | 15 | r4:data-viz | Bars accumulate; symmetric narrow peak means stable in-tune hold. |
| 434 | egui native config file written with 0600 restrictive permissions | P4 | 15 | r4:privacy-security | Chmod app-data tuning config so other users cannot read. |
| 435 | Drop-link bar: paste any tab URL, extract tuning | P4 | 15 | r4:integrations-music | Unified parser dispatching to Songsterr/UG/GP by host. |
| 436 | Sargam note-naming (Sa Re Ga Ma Pa Dha Ni) with movable Sa | P4 | 14 | r2:instruments-notation | Core Indian-classical notation; unlocks that audience. |
| 437 | Serial/JSON local control protocol as the integration contract for peripherals | P4 | 14 | r3:hardware-peripherals | Foundation enabling every footswitch/LED/Stream Deck peripheral cleanly. |
| 438 | Elgato Stream Deck plugin: tuning-select, A4-nudge, live cents on keys | P4 | 14 | r3:hardware-peripherals | Reaches the streamer/creator niche; depends on the control protocol. |
| 439 | USB MIDI-controller knob/pad mapping (input only) for tuning and A4 | P4 | 14 | r3:hardware-peripherals | Reuses MIDI-input infra for hands-free hardware control. |
| 440 | Natural-harmonic target mode (5th/4th nodes) | P4 | 14 | r4:bowed-strings | Tune by lightly-touched harmonics, expected pitch shown. |
| 441 | Per-string offset profile saved as session tuning preset | P4 | 14 | r4:studio-deep | Snapshot exact measured cents per string, recall next day. |
| 442 | Silent between-song mode: vibrate-only, screen dimmed | P4 | 14 | r4:live-deep | No audio reference, haptic-only confirmation for quiet tuning. |
| 443 | Tuney the tuning-fork mascot reacts to cents error | P4 | 14 | r4:kids-gamify | SVG sprite wobbles flat/sharp, smiles when string lands in tune |
| 444 | Session timeline scrubber over recorded tuning attempt | P4 | 14 | r4:data-viz | Drag playhead across a stored cents-vs-time curve per string. |
| 445 | Settings search/filter box | P4 | 14 | r4:settings-personalization | Type to jump to any control across all sections. |
| 446 | Settings change-history with undo stack | P4 | 14 | r4:settings-personalization | Step back through recent setting edits this session. |
| 447 | Preset auto-apply rule by connected device | P4 | 14 | r4:settings-personalization | Bind a named preset to fire when a mic appears. |
| 448 | security.txt at well-known with contact and PGP | P4 | 14 | r4:privacy-security | Publish /tuner/.well-known/security.txt for vulnerability disclosure. |
| 449 | Storage-usage meter UI in settings sidebar | P4 | 14 | r4:offline-storage | navigator.storage.estimate() usage/quota bar with per-category breakdown. |
| 450 | Quota-pressure handler degrading non-essential caches first | P4 | 14 | r4:offline-storage | On QuotaExceededError evict spectrogram caches before tuning data. |
| 451 | Apple Calendar practice reminder via generated .ics download | P4 | 14 | r4:integrations-productivity | Export VEVENT with VALARM for next practice session. |
| 452 | Songsterr paste-link tuning extractor | P4 | 14 | r4:integrations-music | Paste Songsterr URL, fetch track tuning JSON, apply preset. |
| 453 | Email newsletter: monthly tuning tip + changelog | P4 | 14 | r4:content-marketing | Re-engagement channel; static signup, no backend needed. |
| 454 | Swappable icon-set variants outline/filled/duotone | P4 | 14 | r4:theming-identity | Mic, settings, play icons share one selectable style family. |
| 455 | Quiet-hours window suppressing all reminders | P4 | 14 | r4:notifications-engagement | User-defined start/end; clamp scheduled times outside band. |
| 456 | Do-not-disturb master toggle pausing all nudges | P4 | 14 | r4:notifications-engagement | One switch silences reminders for a chosen duration. |
| 457 | Tauri autostart with minimized tray for reminders | P4 | 14 | r4:notifications-engagement | Launch-on-login so scheduled toasts fire without app open. |
| 458 | Privacy-preserving local aggregate metrics with k-anonymity batching | P4 | 14 | r4:business-ops-deep | Opt-in counters flushed only above threshold, no IDs. |
| 459 | Self-hosted Plausible-style aggregate dashboard, IP-truncated, opt-in | P4 | 14 | r4:business-ops-deep | First-party analytics with no cookies or persistent IDs. |
| 460 | Equal-tempered vs pure-fifths deviation display | P4 | 13 | r4:bowed-strings | Show both ET target and beatless-fifth target cents. |
| 461 | Daily challenge: tune all six before timer ends | P4 | 13 | r4:kids-gamify | One seeded challenge per local date, completion badge |
| 462 | Confetti bloom and mascot cheer on six-string completion | P4 | 13 | r4:kids-gamify | CSS particle burst when all strings tuned in session |
| 463 | Star rating per string: 1-3 stars by tuning precision | P4 | 13 | r4:kids-gamify | Tighter cents window earns more stars, drives replay |
| 464 | Privacy regression snapshot of localStorage keys in CI | P4 | 13 | r4:privacy-security | Golden test fails if new persisted key appears unreviewed. |
| 465 | Eviction warning when persisted-storage permission denied | P4 | 13 | r4:offline-storage | Banner noting data may be cleared under disk pressure. |
| 466 | Ultimate-Guitar tab URL capo/tuning sniffer | P4 | 13 | r4:integrations-music | Read UG page tuning+capo line, suggest matching tuner setup. |
| 467 | Oud course tuning presets (Arabic, Turkish, Iraqi) with 5-6 double courses | P4 | 12 | r2:instruments-notation | Opens a large underserved Middle-Eastern player base. |
| 468 | Maqam quarter-tone target set (24-TET / koma) with named jins | P4 | 12 | r2:instruments-notation | Microtonal targets for Arabic/Turkish music. |
| 469 | Harp / autoharp full-range chromatic per-string tuning sequencer | P4 | 12 | r2:instruments-notation | Sequenced many-string tuning workflow. |
| 470 | Hammered/mountain dulcimer and bouzouki/charango course tunings | P4 | 12 | r2:instruments-notation | Folk course-instrument presets, low effort. |
| 471 | Paid Pro feature bundle definition and pricing page | P4 | 12 | r3:monetization | The 'what is Pro' anchor every monetization idea depends on; define first. |
| 472 | Desktop app on Microsoft Store / Mac App Store with paid Pro IAP | P4 | 12 | r3:monetization | Native store discovery plus a sanctioned IAP monetization channel. |
| 473 | ARA2 plugin placing per-note tuning markers along the DAW timeline | P4 | 12 | r3:pro-audio-ecosystem | Deep DAW integration for editors; significant host-specific work. |
| 474 | Generic USB gamepad/foot-pedal stepping via gilrs (native) | P4 | 12 | r3:hardware-peripherals | Cheap hands-free stepping reusing a standard input library. |
| 475 | Detected-pitch envelope export as Reaper/Audacity automation/label track | P4 | 12 | r3:pro-audio-ecosystem | Bridges detection output into editor workflows. |
| 476 | Cross-format installer (VST3/AU/CLAP/AAX) with signed packages + manifest | P4 | 12 | r3:pro-audio-ecosystem | Makes plugin distribution trustworthy and versioned. |
| 477 | Invite-a-bandmate onboarding pack: shareable .bandpack + printable one-pager | P4 | 12 | r3:community-social | Drives word-of-mouth growth among bandmates. |
| 478 | Bundle on-device intelligence as opt-in 'Pro Listening' tier | P4 | 12 | r3:monetization | Connects the ML features to a future revenue line. |
| 479 | Seasonal accent themes auto-applied by date with manual override | P4 | 12 | r3:brand-microinteractions | Periodic freshness that invites users to return. |
| 480 | Scordatura preset library per piece | P4 | 12 | r4:bowed-strings | Bach G-minor, Mahler, Saint-Saens Danse Macabre A-Eb. |
| 481 | Piano 88-key sectioned tuning map A0-C8 | P4 | 12 | r4:keyed-free-reed | Visual keyboard split into bass/temperament/treble tuning sections |
| 482 | Tuner-out passthrough: mute audio while detecting | P4 | 12 | r4:live-deep | Emulate pedalboard tuner-out by gating output during tune. |
| 483 | Pre-show checklist: all strings green before set | P4 | 12 | r4:live-deep | Confirm every open string in tune before walking onstage. |
| 484 | Hold-to-tune latch pins display while glancing away | P4 | 12 | r4:live-deep | Freeze last reading so tech reads after string stops. |
| 485 | XP awarded per string within cents tolerance | P4 | 12 | r4:kids-gamify | Faster, steadier tuning grants more XP; shown as bar |
| 486 | Tuning streak counter with streak-freeze token | P4 | 12 | r4:kids-gamify | Consecutive days tracked; earned token skips one missed day |
| 487 | Color-by-string game: match strummed string to its hue | P4 | 12 | r4:kids-gamify | Detect played string, child taps matching colored pad |
| 488 | Pitch constellation scatter: cents vs amplitude points | P4 | 12 | r4:data-viz | Each frame a dot; cluster tightness signals tuning stability. |
| 489 | Fully remappable hotkey editor in settings | P4 | 12 | r4:power-user | Per-action key capture stored in localStorage, conflict detection |
| 490 | local CSP violation collector logging to in-app panel | P4 | 12 | r4:privacy-security | report-to endpoint writes violations locally, no external reporting URI. |
| 491 | Threat-model doc STRIDE for mic audio and storage | P4 | 12 | r4:privacy-security | Document trust boundaries, attack surface, mitigations in repo. |
| 492 | Last-write-wins conflict resolution with timestamp tiebreak | P4 | 12 | r4:offline-storage | Per-pack updatedAt compares local vs synced, prompt on tie. |
| 493 | Offline pack availability badge per gallery entry | P4 | 12 | r4:offline-storage | Mark which community packs are cached and usable offline. |
| 494 | Wallpaper-extracted palette via desktop accent (Tauri) | P4 | 12 | r4:theming-identity | Native pulls OS accent color to seed app theme. |
| 495 | Texture/material backdrop layer brushed-metal or felt | P4 | 12 | r4:theming-identity | Optional subtle tiled SVG behind cards per theme. |
| 496 | Streak-at-risk nudge before midnight local time | P4 | 12 | r4:notifications-engagement | Fire only if today's session count is zero near cutoff. |
| 497 | Weekly recap notification: strings tuned, accuracy delta | P4 | 12 | r4:notifications-engagement | Sunday summary pulled from local IndexedDB session stats. |
| 498 | Re-engagement nudge after N days lapsed | P4 | 12 | r4:notifications-engagement | Single gentle ping after 7-day inactivity, then escalating cooldown. |
| 499 | Per-channel opt-in: OS push vs in-app inbox | P4 | 12 | r4:notifications-engagement | Independent toggles per notification type and delivery surface. |
| 500 | In-app notification inbox with unread badge | P4 | 12 | r4:notifications-engagement | Persistent local list of past nudges, recaps, announcements. |

## Historical Grounded Audit (C#)

The 187 cards below preserve detailed pre-refactor evidence and stable `C#` references. They are not the current-open list after 2026-07-12: paths and claims intentionally remain as audit history. Revalidate each card against [recommendation.md](recommendation.md), the `M#` status above and the current code before implementation.

### Status Notes

- 2026-07-19: R186 is complete. Device selection now treats both `starting` and `listening` web sessions as restartable intent; a regression test holds the first permission request open and verifies that the second start receives the new `deviceId`.
- 2026-07-21: R31/M127 are complete. One sample-indexed contract replays licensed bass E1, guitar E2 and violin A4 through native Rust and browser WASM frame by frame, while Rust tests project the same sessions through Tauri wire frames and egui view state.
- 2026-07-19: R73 is complete. A PCM/float WAV adapter joins the shared session registry, exact AudioWorklet PCM windows carry source sample indices through the worker, and debug capture exports replayable PCM16 WAV + JSON v2 from the same analyzed stream.
- 2026-07-12: R17 confidence/full-frame browser follow-up is complete. WASM `TunerProcessor` owns detector, smoothing, level, power and `FrameResolver`; revisioned context crosses the worker boundary once per change; TS fallback emits measured normalized-periodicity confidence; stop/restart explicitly resets worker state.
- 2026-07-11: R15/C155 note-math follow-up is complete. One registry/expression generator emits Rust/TypeScript note names, MIDI/frequency/cents/closest-target and formatting primitives; deterministic property sweeps and codegen freshness gate both targets. Remaining related work is file/WAV input.
- 2026-07-11: R9/C47/C53 native-frame follow-up is complete. `FrameResolver` owns target/cents/hysteresis, Tauri receives a revisioned A4/tuning/selected-target context, Vue trusts native semantics, Rust/TS smoothing shares traces, and the top-level `frequency` alias is gone.
- 2026-07-11: one B0-E5 manifest now gates native Rust, browser WASM and TS fallback; `registry/music-registry.json` replaces hand-maintained Rust/web tuning tables; custom-library CRUD is an injected controller and Library uses responsive keyboard tabs.
- 2026-07-11: web/native/synthetic inputs implement one discriminated `AudioInputPort`; the web worker uses pitch-core/WASM as primary and falls back to TS on load/runtime failure. The 2026-07-12 status above supersedes the former raw-detector/full-frame gap.
- 2026-07-11: three implementation iterations plus review supersede many findings below. Closed families include the session state machine/pending states, egui random tone, native callback DSP/alloc/locks, shared Tauri pitch-core path, pitch-core module/trait split, frame adoption, profile schema/import validation, offline Service Worker, semantic canvas themes and feature-shell decomposition. Do not reopen a `C#` from this file without revalidating it against current code; current dispositions live under the corresponding stable `R#` or `[DONE]` `M#` row.
- 2026-06-30: M0 safety-gate slice landed. `build-web.yml` runs `npm test`; `npm test` now uses Vitest for core note/pitch fixtures; `test-core.yml` gates `cargo fmt --check -p pitch-core`, `cargo clippy -p pitch-core --all-targets --all-features -- -D warnings`, `cargo test -p pitch-core`, and `cargo check -p pitch-core --target wasm32-unknown-unknown --features wasm`; `.nvmrc` and `rust-toolchain.toml` were added. This resolves the CI-wiring part of C3/C180 and partially addresses C76/C79/C99/C114/C118 for `pitch-core`. Remaining: composable tests, Rust<->TS parity harness, fake-mic E2E, and broader egui/Tauri clippy/fmt gates.
- 2026-07-01: M1 web-frame slice landed. `useTunerSession` exposed `DetectionFrame` as the primary readout contract and the synthetic session harness asserted the frame shape. The 2026-07-11 status above supersedes its former C47/C53/R9 follow-up list.

### P0 (17)

**C1. play_random_string takes the just-created output stream then drops it, so no tone ever plays** - `problem` H/L - _egui-native_
  - egui/src/main.rs:538-542 (out = Some(s); out.take())
  - Line 538 stores the stream in self.audio.out, line 540 immediately .take()s it into a local out_clone that is dropped at end of fn, stopping playback instantly; remove the take() (and add the promised auto-stop timer instead).

**C2. AudioContext never resume()d after construction; suspended-context start yields silent tuner** - `problem` H/L - _audio-io-realtime_
  - web/src/composables/useAudioInput.ts:56-65; useReferenceTone.ts:14; utils/audio.ts:5-11
  - createAudioContext() can return a context in 'suspended' state under browser autoplay policy; start()/readFrame() never call audioContext.resume(), so the analyser reads zeros and pitch detection silently produces nothing until some unrelated user gesture happens to resume it.

**C3. RESOLVED 2026-06-30: web core tests are now run in CI** - `fixed` H/L - _testing-ci_
  - .github/workflows/build-web.yml runs `npm test`; web/package.json now maps `test` to `vitest run`.
  - Remaining related work moved under M0: composable tests, fake-mic E2E and Rust<->TS parity. Keep this entry for audit history; do not treat it as open.

**C4. egui play_random_string immediately drops the output stream via out.take(), so ear-training tone never sounds** - `problem` H/L - _duplication_
  - egui/src/main.rs:510-542 (line 540: let out_clone = self.audio.out.take();)
  - After building and playing the random-string stream and storing it in self.audio.out, line 540 takes it back out into an unused local that is dropped at end of scope, stopping the cpal stream the same frame; the surrounding comments admit it is a placeholder - the feature is broken, not just smelly.

**C5. Web getUserMedia track 'ended' (device unplug / OS revoke) is never handled** - `problem` H/L - _observability-reliability_
  - web/src/composables/useAudioInput.ts:62-66
  - No stream.getAudioTracks()[0].onended / .onmute listener; if the mic is unplugged or revoked mid-session, isListening stays true and readFrame keeps returning stale zeros with no error or auto-stop.

**C6. AudioContext suspended/interrupted state is never monitored or resumed** - `problem` H/L - _observability-reliability_
  - web/src/utils/audio.ts:5-11; web/src/composables/useAudioInput.ts:56-65
  - createAudioContext() never checks ctx.state or wires onstatechange; on iOS/Safari the context starts/returns to 'suspended' (app backgrounded, autoplay policy) and the tuner silently freezes with no resume() and no UI signal.

**C7. egui random-string stream is dropped immediately by out.take()** - `problem` M/L - _observability-reliability_
  - egui/src/main.rs:540
  - play_random_string builds an output stream, stores it in self.audio.out, then on line 540 does out.take() into an unused local that drops at end of fn, so the tone stops instantly and ear-training playback is silent on native.

**C8. egui runs DSP inside the realtime cpal callback under a Mutex** - `problem` H/M - _architecture-coupling_
  - egui/src/main.rs:443-473 (eng.lock().process); pitch-core/src/lib.rs:61-128
  - The audio thread locks engine_for_cb and runs full YIN+2048-pt FFT inside build_input_stream's callback, then locks State and requests repaint; a contended lock or the O(n·tau) FFT can blow the realtime deadline and cause audio glitches.

**C9. No octave-error guard: YIN/MPM can lock onto subharmonic with no HPS cross-check** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:153-330 (detect_pitch_yin_internal, detect_pitch_mpm_internal)
  - Neither detector validates the chosen tau against harmonic content; the absolute-threshold dip walk readily picks 2x/3x period on plucked guitar (rich harmonics), producing an octave-low reading with no HPS/subharmonic rejection step.

**C10. Engine Mutex locked inside the realtime audio callback** - `problem` H/M - _egui-native_
  - egui/src/main.rs:449-455 (engine_for_cb.lock() in build_input_stream closure)
  - Taking a std::sync::Mutex on the realtime audio thread can block on the UI thread (which also locks the engine in toggle/slider handlers) causing priority inversion and dropouts; the audio path must be lock-free or use try_lock with a fallback.

**C11. TunerEngine::process allocates per call inside the audio callback** - `problem` H/M - _performance_
  - pitch-core/src/lib.rs:99 (vec![0.0f32;512]) and lib.rs:341 (cleaned: Vec<f32>), plus main.rs:469 g.spectrum = update.spectrum
  - Every realtime callback heap-allocates a 512-elem spectrum Vec and a detrended copy of the input, then moves the Vec into State - allocation in the audio thread is a glitch hazard; preallocate and write in place.

**C12. cpal runtime stream errors are swallowed with eprintln, never surfaced or recovered** - `problem` H/M - _observability-reliability_
  - desktop/src-tauri/src/native_audio.rs:163; egui/src/main.rs:474
  - The build_input_stream error callback only eprintln!s; if the mic disconnects or the stream errors mid-run, the frame thread goes silent, frontend isListening stays true, and there is no error event, watchdog, or auto-restart.

**C13. Native audio device disconnection mid-stream is undetectable** - `problem` H/M - _observability-reliability_
  - desktop/src-tauri/src/native_audio.rs:145-167
  - No track-ended / device-lost handling; the spawned thread blocks on stop_rx.recv() forever while cpal silently stops delivering data, so the UI freezes on the last frequency with no indication.

**C14. findClosestString picks nearest pitch with no course awareness on octave pairs** - `problem` H/M - _instruments-domain_
  - web/src/utils/notes.ts:512-524; useTuningState.ts:148-161
  - When tuning a 12-string E2/E3 course, a plucked octave string snaps to whichever of the two is closer; there is no 'tune this course' grouping so the displayed target flips between the pair members.

**C15. 5-string bass B0 (30.87Hz) is below useful detection floor with no extended-low handling** - `problem` H/M - _instruments-domain_
  - web/src/utils/notes.ts:285 (B0), :291 (B0); domain.rs:178 (freq<20 guard)
  - B0 at 30.87Hz passes the 20Hz guard but there is no low-end detection extension (longer window / fundamental-tracking) configured per-tuning, so the lowest bass string is the least reliable exactly where it matters.

**C16. Per-callback Vec::drain on the audio thread instead of a real ring buffer** - `problem` M/M - _audio-io-realtime_
  - egui/src/main.rs:444 (b.drain(..b.len()-2048)); desktop native_audio.rs:149-151 (buffer.drain)
  - Both accumulate into a growing Vec and drain the front each callback, an O(n) memmove on the realtime thread; the stated ring-buffer-off-the-RT-thread goal is unmet. Use a fixed-capacity SPSC ring (e.g. rtrb) and process off-thread.

**C17. Full DSP (YIN+MPM+FFT+spectrum) executes inside cpal realtime callback under Mutex** - `problem` H/H - _dsp-algorithms_
  - egui/src/main.rs:443-472 (build_input_stream closure -> engine.lock().process)
  - eng.process() does pitch detection plus a 2048 FFT while holding engine_for_cb.lock() on the audio thread; any contention or allocation (vec! per call) risks xruns and dropouts, defeating realtime accuracy.

### P1 (58)

**C18. "Requesting mic" state string exists but is never shown; permission wait looks frozen** - `problem` H/L - _ux-product_
  - web/src/composables/useAudioInput.ts:41-71 (start), App.vue:91-93 header status
  - l10n key requesting (l10n.ts:14,124) is dead; getUserMedia has no pending ref, so on first click the UI stays "READY" through the whole permission prompt with no Idle/Requesting/Listening distinction.

**C19. Language toggle never updates document.documentElement.lang** - `problem` H/L - _a11y-i18n_
  - web/index.html:2 (hardcoded lang="en"); web/src/stores/l10n.ts:234 toggleLang; App.vue:87
  - Screen readers keep announcing Russian UI with an English speech engine because <html lang> stays "en" forever after toggleLang; set documentElement.lang in toggleLang/init.

**C20. Global focus-visible styling missing for nearly all controls** - `problem` H/L - _a11y-i18n_
  - web/src/style.css (no :focus-visible rule); only MicButton.vue:13 has a ring; string-btn/segmented/btn/lang toggle/checkbox styled bg only
  - Keyboard users get little or no visible focus on .string-btn, .segmented, .btn and the RU/EN toggle since custom backgrounds suppress default outline; add a global :focus-visible outline.

**C21. detectionRange watch in useTuner fires native setRange on every range object identity change** - `problem` M/L - _web-vue_
  - web/src/composables/useTuner.ts:48-51 (watch tuning.detectionRange)
  - tuning.detectionRange is a computed rebuilt from strings (new object each recompute), so the watch reassigns detectionRange.value and awaits nativeAudio.setRange even when min/max are unchanged; compare numeric bounds before firing the async native invoke.

**C22. useReferenceTone/useNativeAudioInput register onUnmounted but are instantiated deep inside useTuner** - `problem` M/L - _web-vue_
  - web/src/composables/useReferenceTone.ts:93, useNativeAudioInput.ts:106, usePitchLoop.ts:144
  - These onUnmounted hooks only fire because useTuner() runs in App.vue setup; the contract is implicit and fragile — calling useTuner() outside a component setup (tests, SSR probe) registers no cleanup and leaks AudioContext/Worker/RAF. Document/guard the setup requirement.

**C23. egui input device switch restarts the stream via a double toggle_mic() hack** - `problem` M/L - _audio-io-realtime_
  - egui/src/main.rs:268-273
  - Device change calls toggle_mic twice (stop then start) inside update(); the code's own comment flags it as a smell. There is no explicit restart_mic(); the stop path also resets the engine, dropping detection state on every device change.

**C24. No CI job builds/tests the WASM feature or asserts it loads** - `problem` M/L - _testing-ci_
  - test-core.yml builds default features only; build-web.yml relies on npm build:wasm with a swallowed failure
  - Add a `wasm-pack build --features wasm` (or `cargo build --target wasm32-unknown-unknown --features wasm`) job that fails hard, since the web shipped artifact depends on it.

**C25. In-tune state has no hold/dwell requirement, so it flickers on transients** - `problem` M/L - _ux-product_
  - web/src/composables/useTuningState.ts:170-180 isInTune
  - isInTune flips true the instant abs(cents)<5 with only a hysteresis band, no minimum stable duration; a pluck overshoot can briefly read in-tune. Guided tuning needs an N-ms dwell before declaring a string done.

**C26. pitchWorker.onerror tears down the worker without surfacing or restarting** - `problem` M/L - _observability-reliability_
  - web/src/composables/usePitchLoop.ts:41-46
  - On a worker error the worker is terminated and nulled, then ensurePitchWorker silently recreates it next tick with no logged cause and no user-visible signal; a persistently crashing worker just thrashes invisibly.

**C27. toggleString resolves by noteId, which collides on duplicate course members** - `problem` M/L - _instruments-domain_
  - web/src/composables/useTuningState.ts:250-256; notes.ts:466-468 (noteId)
  - 12-string has identical noteIds (B3/B3, E4/E4); selecting one by note (no index) always resolves to the first via findIndex, so the unison pair's second string is unreachable by note-click.

**C28. pitch-core/lib.rs still monolithic: DSP, engine, smoothing, spectrum, wasm in one 668-line file** - `problem` H/M - _architecture-coupling_
  - pitch-core/src/lib.rs:1-668
  - Only domain.rs is split out; YIN, MPM, power-chord, FFT spectrum, RMS, Smoother, TunerEngine, and all wasm bindings live together, so algorithms can't be swapped or benchmarked independently as ARCHITECTURE.md lines 169-172 plan.

**C29. detect_pitch returns first non-None of YIN-then-MPM, no confidence-weighted fusion** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:332-358 (detect_pitch)
  - The audit dimension asks for confidence-weighted YIN+MPM+HPS fusion, but the code just short-circuits on YIN success and never runs MPM unless YIN fails, so the two estimators never cross-validate or arbitrate disagreement.

**C30. tau bounds are global GUITAR_MIN/MAX (30-400Hz), not per-string/per-instrument** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:1-2,160-161; TS uses configurable range but Rust hardcodes
  - Rust engine clamps every detection to 30-400Hz regardless of selected instrument (bass<30, violin/mandolin/ukulele go well above 400), so out-of-band strings for non-guitar instruments can never be detected by the native path.

**C31. useSettings holds module-level singleton refs but the rest of the composable tree is instance-scoped** - `problem` H/M - _web-vue_
  - web/src/composables/useSettings.ts:26-59 vs useTuningState.ts:50, useTuner.ts:15
  - State is split between a global singleton (settings) and per-call refs (currentTuning, selectedStringIndex, audio); a second useTuner() instance would silently share settings but fork detection state, and there is no provide/inject contract making the single-instance assumption explicit.

**C32. tauri native_audio.rs reimplements pitch + level instead of depending on pitch-core** - `problem` H/M - _audio-io-realtime_
  - desktop/src-tauri/src/native_audio.rs:196-290
  - normalize_level and detect_pitch_yin are duplicated in the desktop crate while pitch-core already provides compute_rms_volume/normalize_level and a YIN engine; the desktop backend should call pitch-core to keep detection identical to egui/web-wasm.

**C33. No Rust<->TS pitch-detection parity/equivalence test** - `problem` H/M - _testing-ci_
  - pitch-core/src/lib.rs detect_pitch_native vs web/src/utils/pitch.ts detectPitch; usePitchLoop.ts:112 runs the TS path, egui runs the Rust path
  - Two independent DSP implementations of the same algorithm with zero cross-check; they can silently diverge in cents/Hz on identical input across web vs native.

**C34. WASM pitch-core is built and shipped but never imported by the web app** - `problem` H/M - _performance_
  - web/public/wasm/* (detect_pitch_yin/mpm/wasm, downsample_for_pitch) vs web/src/workers/pitchWorker.ts:24
  - grep of web/src finds zero references to pitch_core/wasm; the worker runs pure-TS detectPitch while the shipped .wasm sits as unused download weight - either wire it in or drop it from the bundle.

**C35. Tuning table duplicated and divergent between TS notes.ts and Rust domain.rs** - `problem` H/M - _duplication_
  - web/src/utils/notes.ts:138-359 (BUILT_IN_TUNINGS) vs pitch-core/src/domain.rs:19-167 (get_tunings)
  - TS has ~30 instrument tunings computed from note()/equalFrequency(); Rust hard-codes ~14 guitar tunings with literal frequencies and different sets (Rust has Drop B/Open C/Open A/Open Gm, TS has none of these; TS has bass/uke/violin, Rust has none) - two unsynced sources of truth.

**C36. Cents/closest-string logic diverges: TS path is temperament-aware, Rust process() is not** - `problem` H/M - _duplication_
  - web/src/composables/useTuningState.ts:147-161 vs pitch-core/src/lib.rs:79-96
  - TS computes cents via frequencyToNote/findClosestString with temperament+sweetening+stringOffsets+A4-scaling; Rust TunerEngine::process does plain find_closest_string+get_cents with only A4 ratio - the egui/native readout silently ignores temperament and offsets, so the two backends report different cents for the same note.

**C37. No Rust<->TS parity test pins the duplicated note/cents/tuning math to identical outputs** - `idea` H/M - _duplication_
  - pitch-core/src/lib.rs tests (lib.rs:543-667) cover Rust only; no cross-language fixture under web/ or pitch-core/
  - Given the table and math are duplicated, the only guard against drift would be a shared fixture (e.g. JSON of freq->note/cents and tuning frequencies) asserted by both vitest and cargo test; today frequencyToNote/get_cents/find_closest_string can silently diverge and the existing tests would still pass.

**C38. No per-string tolerance; in-tune threshold is one global hardcoded 5/7¢** - `problem` H/M - _ux-product_
  - web/src/composables/useTuningState.ts:31-32,177-178
  - IN_TUNE_THRESHOLD/OUT_OF_TUNE_THRESHOLD are module constants applied to every string; guitarists want looser cents on low E/B and the dimension explicitly calls for per-string tolerance, which is impossible today.

**C39. aria-live note/cents regions fire on every detection frame, no debounce or bucketing** - `problem` H/M - _a11y-i18n_
  - web/src/components/NoteDisplay.vue:20; CentsGauge.vue:64-68 (cents/conf update each frame)
  - polite region wraps continuously-changing cents/conf/Hz, flooding the SR queue; announce only on note change plus a coarse bucket (e.g. 'E2, slightly sharp') via a debounced sr-only element.

**C40. colorblind theme does not recolor SVG gauges (hardcoded hex)** - `problem` H/M - _a11y-i18n_
  - web/src/components/CentsGauge.vue:39,45,46,56; CentsHistoryGraph.vue:39 stroke="#4ade80"
  - theme-colorblind only overrides Tailwind classes; the inline SVG fills #22c55e/#f59e0b/#4ade80 stay green/amber under Okabe-Ito, defeating the colorblind palette - drive these from CSS vars.

**C41. No real Service Worker despite manifest and HTML claiming "Works offline"** - `problem` H/M - _build-pwa-distribution_
  - web/src/main.ts (no SW registration), web/public/manifest.webmanifest, web/index.html:8
  - main.ts only mounts the Vue app; nothing registers a SW and no sw.js/workbox exists, so the PWA is not installable-as-offline and the 'Works offline'/'Works offline as PWA' copy is false.

**C42. manifest claims 'Works offline' but there is no service worker** - `problem` H/M - _observability-reliability_
  - web/index.html:9; web/public/manifest.webmanifest:4; web/vite.config.ts:8; web/src/main.ts
  - index.html description and manifest both advertise offline/PWA, yet vite has no VitePWA/workbox plugin and main.ts never registers a service worker, so a reload offline shows a blank page.

**C43. No octave-course flag for 12-string lower pairs** - `problem` H/M - _instruments-domain_
  - web/src/utils/notes.ts:251-256
  - E2/E3, A2/A3, D3/D4, G3/G4 are octave courses but nothing marks the octave string vs the fundamental, so sweetening offsets (line 118) are applied by flat index with no semantic anchor.

**C44. notes.ts and domain.rs duplicate the tuning/note model with no documented source of truth** - `problem` H/M - _dx-docs_
  - pitch-core/src/domain.rs:28 get_tunings() vs web/src/utils/notes.ts:51 INSTRUMENTS/BUILT_IN_TUNINGS
  - Two hand-maintained tuning tables drift silently (Rust has 13 guitar tunings; TS has instruments/temperaments the Rust side lacks); no ADR or doc records why they are separate or which is canonical.

**C45. test-core.mjs is TS-only and not a real Rust<->TS parity test** - `problem` H/M - _dx-docs_
  - web/scripts/test-core.mjs:31-98 (bundles only notes.ts/pitch.ts)
  - It asserts TS behavior in isolation; it never loads the wasm build to compare detect_pitch / frequency_to_note / find_closest_string outputs against domain.rs, so the two engines can diverge numerically with green CI.

**C46. No PitchDetector trait — detect_pitch() hardcodes YIN-then-MPM ordering** - `problem` M/M - _architecture-coupling_
  - pitch-core/src/lib.rs:332-358
  - detect_pitch calls detect_pitch_yin_internal then detect_pitch_mpm_internal directly; the planned `trait PitchDetector { process(&[f32]) -> Option<(f32,f32)> }` (ARCHITECTURE.md:49,121) does not exist, so detectors aren't pluggable or testable in isolation.

**C47. No shared DetectionFrame/SpectrumFrame/WaveformFrame contract in Rust** - `problem` M/M - _architecture-coupling_
  - pitch-core/src/lib.rs:12-21 (TunerUpdate); ARCHITECTURE.md:140,162
  - Rust exposes only an ad-hoc TunerUpdate struct; the planned DetectionFrame/SpectrumFrame contract in domain/tuner-types is absent, so egui State manually re-copies fields field-by-field (egui/src/main.rs:459-471).

**C48. No DC-block/high-pass filter; only per-buffer mean subtraction for rumble/mains** - `problem` M/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:340-345 (detect_pitch mean removal)
  - Only a single-buffer mean is removed; there is no first-order DC-block (y=x-x1+R*y1) or high-pass to attenuate sub-40Hz rumble and 50/60Hz mains hum, which sit in-band (GUITAR_MIN_FREQ=30) and can be detected as false fundamentals.

**C49. Energy gate is a fixed RMS/peak threshold, not an adaptive noise floor** - `idea` M/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:174 (rms<0.0025||max_abs<0.012)
  - The gate is a hardcoded constant rather than a tracked/adaptive noise floor; quiet pickups or noisy rooms either get gated out or let hum through, where an EMA noise-floor with hysteresis would adapt.

**C50. frequency_to_note / get_cents duplicated between notes.ts and domain.rs with no parity guard** - `problem` M/M - _dsp-algorithms_
  - pitch-core/src/domain.rs:169-195 vs web/src/utils/notes.ts
  - Note/cents math exists in both languages; without a shared fixture or generated table, equal-temperament rounding (e.g. midi.round vs JS rounding at the semitone boundary) can disagree by a cent and flip the displayed note.

**C51. Three near-identical cpal stream builders duplicated across mic/ref/random** - `problem` M/M - _egui-native_
  - egui/src/main.rs:485-507 (ref), 510-542 (random), 437-481 (mic input config block)
  - toggle_ref and play_random_string contain byte-for-byte identical host/device/config resolution and a duplicated sine-oscillator closure; extract a build_tone_stream(freq) helper and a resolve_output_device() to kill ~60 duplicated lines and the divergence risk.

**C52. WEB_ENGINE / WEB_STATE global OnceLock<Mutex> singletons couple wasm feed to a hidden global** - `problem` M/M - _egui-native_
  - egui/src/main.rs:28-32, 558-591, 631-636
  - feed_audio_samples reaches into module-global singletons rather than an explicit handle, so there can only ever be one App and the data flow is invisible; pass an Arc handle into the JS bridge (or a thread-local registry keyed by canvas) instead of process-global statics.

**C53. Native backend emits {frequency, level} but web path emits raw audio frames; output contracts diverge** - `problem` M/M - _audio-io-realtime_
  - useNativeAudioInput.ts:4-7 / native_audio.rs:20-25 vs useAudioInput.ts:6-9 (AudioFrame buffer+sampleRate)
  - Native does detection in Rust and emits final frequency; web ships raw buffers to JS detectPitch. This split means smoothing, confidence, power-chord, and spectrum exist only on one path, so native and web feel like different tuners. A shared DetectionFrame would unify them.

**C54. egui output stream assumes f32 sample format without matching on supported format** - `problem` M/M - _audio-io-realtime_
  - egui/src/main.rs:493-501, 525-533
  - build_output_stream is called with a |&mut [f32]| closure using default_output_config() directly; if the device's native format is i16/u16 (common on Windows/WASAPI) this errors or produces noise. The input path already dispatches on SampleFormat; output should too.

**C55. Web getUserMedia has no device-disconnect recovery; loses stream silently on unplug** - `problem` M/M - _audio-io-realtime_
  - useAudioInput.ts:23-39 (refreshInputDevices), 46-66 (start)
  - devicechange only refreshes the list and clears selectedInputDeviceId; it never restarts the active stream when the in-use device disappears, and there is no track.onended handler, so unplugging the active mic leaves isListening=true with a dead track and no error surfaced.

**C56. WASM path detect_pitch_wasm has no test and build can silently no-op** - `problem` M/M - _testing-ci_
  - pitch-core/src/lib.rs:377 detect_pitch_wasm; web/package.json:10 build:wasm ends in `|| echo 'WASM build skipped or failed'`
  - The wasm export is untested, and a failed wasm-pack build is swallowed by `|| echo`, so a broken/missing WASM module produces a green build.

**C57. FrequencySmoother (TS) and Smoother (Rust) are byte-for-byte equivalent algorithms maintained twice** - `problem` M/M - _duplication_
  - web/src/utils/pitch.ts:230-256 (FrequencySmoother) vs pitch-core/src/lib.rs:473-518 (Smoother)
  - Identical EMA(alpha=0.4)+median(maxHistory=5) logic in both languages; a WasmSmoother wrapper already exists in lib.rs:520-541 but the web path ignores it and runs the TS copy, so tuning either requires editing both.

**C58. No reentrant / non-ascending string flag despite high-G ukulele and banjo 5th string** - `problem` M/M - _instruments-domain_
  - web/src/utils/notes.ts:297-301 (ukulele GCEA), :325-330 (banjo gDGBD)
  - Reentrant tunings exist (uke high-G G4 below C4 string, banjo g4 then D3) but no flag marks them; any 'tune in order low->high' UI or arrow guidance will mis-order them.

**C59. Rust find_closest_string lacks temperament/course logic present in TS** - `problem` M/M - _instruments-domain_
  - pitch-core/src/domain.rs:197-217 vs web/src/utils/notes.ts:512-524
  - The Rust path only scales by a4/440 and has no temperament offset, no course grouping, so the egui/native build gives different targets than web for the same tuning.

**C60. Three independent YIN implementations that must agree but share no code** - `problem` H/H - _architecture-coupling_
  - pitch-core/src/lib.rs:153-268 vs web/src/utils/pitch.ts:69-151 vs desktop/src-tauri/src/native_audio.rs:201-290
  - pitch-core, the web TS path, and the Tauri native path each hand-roll YIN+CMNDF+parabolic-interp; desktop and web do not consume pitch-core at all, so bug fixes (e.g. the CMNDF/local-minimum fix) must be ported by hand to three places.

**C61. Rust domain.rs and TS notes.ts duplicate the domain and have diverged** - `problem` H/H - _architecture-coupling_
  - pitch-core/src/domain.rs:28-167 vs web/src/utils/notes.ts:51-359
  - domain.rs hardcodes 13 guitar tunings and equal-temperament math only; notes.ts owns 14 instruments, 7 temperaments, sweetening profiles, capo/transpose — the two domains are not generated from one source and will keep drifting.

**C62. egui App remains a god-object: update() mixes viz history, input, widgets, DSP wiring, persistence** - `problem` H/H - _architecture-coupling_
  - egui/src/main.rs:146-398
  - Despite AudioManager/VizManager extraction, App.update() still pushes cents/spectrogram history, handles keyboard, renders every widget, locks the engine, and save() persists settings inline; no TunerSession layer separates state from presentation.

**C63. TS pitch.ts and Rust lib.rs are duplicated, divergent YIN implementations** - `problem` H/H - _dsp-algorithms_
  - web/src/utils/pitch.ts:69-151 vs pitch-core/src/lib.rs:153-268
  - Two hand-maintained YIN copies have already drifted (TS uses normalizePitchDetectionRange 24-1200Hz + autocorrelate fallback; Rust hardcodes 30-400Hz + MPM fallback and a different dip-walk), so web and native give different pitch on the same audio with no parity test.

**C64. Three independent YIN pitch detectors with no shared contract** - `problem` H/H - _audio-io-realtime_
  - web/src/utils/pitch.ts:69; desktop/src-tauri/src/native_audio.rs:201; pitch-core (egui via engine.process)
  - Web TS YIN, tauri hand-rolled YIN, and egui's pitch-core YIN are three separate implementations with divergent thresholds (web 0.12 vs tauri 0.12 fallback 0.35, separate RMS gates). No single DetectionFrame/engine port, so the same input can produce different results across backends.

**C65. No shared AudioInput/AudioOutput port across getUserMedia, cpal (egui), and cpal (tauri)** - `idea` H/H - _audio-io-realtime_
  - useAudioInput.ts; useNativeAudioInput.ts; egui/src/main.rs AudioManager; native_audio.rs
  - Each backend has its own start/stop/enumerate/restart surface with different shapes (web returns AnalyserNode frames, native returns {frequency,level} events). A single trait/interface (start, stop, setDevice, enumerate, frame stream) would let the UI and detection layer treat all three uniformly.

**C66. TS composables (12 files) have zero unit tests** - `problem` H/H - _testing-ci_
  - web/src/composables/* (useTuningState, useCentsHistory, useMetronome, useEarTraining, useSettings, ...); test-core.mjs only covers utils/notes.ts and utils/pitch.ts
  - All stateful logic (smoothing, history, metronome timing, settings persistence) is untested; no vitest/@vue/test-utils present to test reactive composables in isolation.

**C67. YIN + autocorrelation/MPM pitch detection fully reimplemented in TS and Rust** - `problem` H/H - _duplication_
  - web/src/utils/pitch.ts:69-228 (detectPitchYIN/autoCorrelate/detectPitch) vs pitch-core/src/lib.rs:153-358
  - Two independent YIN implementations with subtly different fallbacks (TS falls back to autocorrelation, Rust to MPM) and thresholds; the web hot path (usePitchLoop.ts:112) calls TS detectPitch, so the compiled wasm detect_pitch_wasm export is dead - the shared core is not actually shared.

**C68. macOS builds are unsigned and not notarized** - `problem` H/H - _build-pwa-distribution_
  - desktop/src-tauri/tauri.conf.json:61 (signingIdentity: null), .github/workflows/build-tauri.yml (no APPLE_* env)
  - dmg/app artifacts ship with signingIdentity null and the Tauri build step passes no Apple ID/team/keychain secrets, so Gatekeeper blocks users with 'damaged/unidentified developer'.

**C69. Windows builds have no EV/code-signing certificate** - `problem` H/H - _build-pwa-distribution_
  - desktop/src-tauri/tauri.conf.json:46 (certificateThumbprint null, timestampUrl empty)
  - NSIS installer is produced with no thumbprint and empty timestampUrl, so SmartScreen flags the unsigned exe and no RFC3161 timestamp means signatures (if added) would expire with the cert.

**C70. Note model has no course/pairing metadata; 12-string is a flat 12-element array** - `problem` H/H - _instruments-domain_
  - web/src/utils/notes.ts:8-12 (Note), :248-260 (twelve-string-standard)
  - Paired-course instruments (12-string, mandolin, bouzouki, charango) are modeled as independent strings with no `course`/`pair` field, so the UI and detection cannot treat a course as one tuning target.

**C71. Web app does not use pitch-core wasm at all — bindings are dead for web** - `problem` M/H - _architecture-coupling_
  - web/src (grep wasm/pitch_core = 0 hits); pitch-core/src/lib.rs:360-379,520-541
  - detect_pitch_wasm/WasmSmoother/feed_audio_samples exist but nothing under web/src imports wasm; the browser runs the TS reimplementation, so the wasm surface only serves egui-wasm and the core is not the single source of truth it claims to be.

**C72. No AudioInput/ToneGenerator port traits — cpal and Web Audio are wired in directly** - `idea` M/H - _architecture-coupling_
  - egui/src/main.rs:409-507; desktop/src-tauri/src/native_audio.rs:102-167; ARCHITECTURE.md:127-131
  - Each surface builds cpal/Web Audio streams inline; the planned `trait AudioInput { start; subscribe frames }` / `trait ToneGenerator` ports do not exist, so input/output cannot be faked for tests or swapped per platform.

**C73. App.vue passes ~100 props/handlers sourced from one 300-line useTuner god-object** - `idea` M/H - _web-vue_
  - web/src/App.vue:98-329; useTuner.ts:145-262
  - useTuner re-exports ~120 members and App.vue threads each as an explicit prop/emit; provide the domain composables via inject (audio, tuning, training, metronome) so panels pull what they need instead of App.vue acting as a prop bus.

**C74. App::update is still a god method: state copy, history push, shortcuts, and 5 inline painters in one 240-line fn** - `problem` M/H - _egui-native_
  - egui/src/main.rs:147-389
  - Despite AudioManager/VizManager extraction, update() still inlines waveform, cents-meter, cents-history, spectrum, and spectrogram drawing plus all widget wiring; extract data-driven painter fns (draw_waveform/draw_spectrum/etc.) taking slices so they are testable and update() shrinks to layout.

**C75. Web audio uses AnalyserNode polling, not an AudioWorklet capture path** - `idea` M/H - _performance_
  - web/src/composables/useAudioInput.ts:58-64 + readFrame:107-120
  - Pitch is read via analyser.getFloatTimeDomainData on the main-thread rAF; an AudioWorklet feeding a SharedArrayBuffer ring would give deterministic frame timing and decouple capture from rAF throttling/background-tab stalls.

### P2 (110)

**C76. PARTIAL 2026-06-30: clippy gate exists for pitch-core, not yet all Rust crates** - `problem` H/L - _testing-ci_
  - .github/workflows/test-core.yml now runs `cargo clippy -p pitch-core --all-targets --all-features -- -D warnings`.
  - Remaining: extend clippy gates to egui/Tauri where platform dependencies make sense.

**C77. GitHub Releases publish no checksums for any artifact** - `problem` H/L - _build-pwa-distribution_
  - .github/workflows/release.yml:110-121 (files: list, no sha256 step)
  - release uploads artifact.tar + tauri/egui binaries with no SHA256SUMS file or per-asset digest, so users and package managers cannot verify download integrity.

**C78. WaveformFrame/SpectrumFrame defined inside a composable, not a shared contract module** - `suggestion` M/L - _architecture-coupling_
  - web/src/composables/useVisualizationFrames.ts:3-18
  - The viz frame types live in the composable that produces them rather than a neutral types module (e.g. utils/frames.ts), coupling every visualizer's contract to the producer; extract to a standalone contract so Rust-derived frames could later satisfy the same shape.

**C79. PARTIAL 2026-06-30: pitch-core has clippy/rustfmt gates; workspace-wide gate still missing** - `suggestion` M/L - _architecture-coupling_
  - .github/workflows/test-core.yml now checks `cargo fmt --check -p pitch-core` and clippy for pitch-core.
  - Remaining: decide how broad the workspace-wide fmt/clippy gate should be for egui and Tauri platform builds.

**C80. Power-chord detection runs on raw buffer, not the DC-cleaned signal** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:73-77, 385-403 (is_likely_power_chord_impl on window)
  - process() passes the original window to is_likely_power_chord_native while detect_pitch internally used a mean-removed copy; a DC offset inflates the energy denominator and skews the corr/energy fifth-detection ratio threshold of 0.5.

**C81. YIN difference function recomputed over full max_tau every call, ignores configured min range** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:185-193 vs TS pitch.ts:90-97
  - Rust computes diff[tau] for tau in 1..max_tau (down to 30Hz) on every frame even when only guitar range is needed, while the TS version limits to minTau..maxTau; the wider sweep is both slower and admits more subharmonic dips.

**C82. MPM confidence is raw NSDF peak value, not normalized/comparable to YIN confidence** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:329 vs lib.rs:225 (1.0-yin[v])
  - YIN reports confidence as 1-CMNDF and MPM reports the NSDF peak height directly; these live on different scales yet both feed TunerUpdate.confidence, so downstream thresholds/UI treat incomparable numbers as one metric.

**C83. Confidence not gated into the readout; low-confidence pitches still update note/cents** - `problem` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:61-96 (process) + egui/src/main.rs:460-465
  - process() commits note/cents whenever freq_opt is Some, but MPM accepts peaks as low as 0.25 and YIN fallback up to min_val 0.35 (confidence 0.65); there is no minimum-confidence gate before showing a result, so weak/ambiguous frames flicker onto the display.

**C84. No Rust unit test asserts fundamental over octave for a harmonic-rich (non-sine) signal** - `suggestion` M/L - _dsp-algorithms_
  - pitch-core/src/lib.rs:543-667 (tests use pure sines only)
  - All accuracy tests feed single sinusoids; add a synthetic plucked-string signal (fundamental + decaying harmonics + noise) to actually exercise the octave-error path the guard is supposed to protect against.

**C85. Visualization frames wrap typed arrays in deep-reactive ref() instead of shallowRef** - `problem` M/L - _web-vue_
  - web/src/composables/useVisualizationFrames.ts:20-21,46-55
  - ref<WaveformFrame|null>/ref<SpectrumFrame|null> make Vue proxy the frame object and (attempt to) track the Float32Array/Uint8Array each RAF tick; shallowRef avoids per-frame proxy overhead on 4096-sample buffers updated ~60x/s.

**C86. Canvas visualizers run resizeCanvas (layout read of parent.clientWidth) on every drawn frame** - `problem` M/L - _web-vue_
  - web/src/components/Spectrum.vue:63,93; Spectrogram.vue:93; Waveform.vue:58
  - drawFrame() calls resizeCanvas() which reads parent.clientWidth and may mutate canvas.width every frame, forcing a forced synchronous reflow ~60x/s per active visualizer; move resize to ResizeObserver and only on actual change.

**C87. No app-level error boundary; only mic errors surface** - `problem` M/L - _web-vue_
  - web/src/App.vue (no onErrorCaptured), main.ts (no app.config.errorHandler)
  - A throw in any panel (e.g. importCustomTunings, canvas ctx, worker glue) unmounts the tree with a blank screen; add app.config.errorHandler + an onErrorCaptured fallback card so a single broken feature does not kill the tuner.

**C88. Unconditional ctx.request_repaint() every frame burns CPU/battery even when idle** - `problem` M/L - _egui-native_
  - egui/src/main.rs:148
  - The app repaints at max framerate continuously regardless of whether mic/ref is active; gate repaints on self.listen||self.ref_on or use request_repaint_after with a fixed cadence to stop spinning a core when silent.

**C89. History pushed every frame regardless of new data, duplicating stale samples** - `problem` M/L - _egui-native_
  - egui/src/main.rs:153-163
  - Because update() runs at UI framerate but audio updates State at its own rate, the same cents/spectrum is pushed into history multiple times between audio callbacks, distorting the time axis of the cents plot and spectrogram; push only when State carries a new frame (e.g. a monotonically increasing seq id).

**C90. egui reference and random-tone generators are duplicated raw-sine cpal blocks** - `suggestion` M/L - _audio-io-realtime_
  - egui/src/main.rs:485-507 (toggle_ref) and 510-542 (play_random_string)
  - Both build an identical sine output stream by hand with the same phase loop and 0.18 gain; no shared tone-output helper. The random path is also buggy (out.take). Unify into one play_tone(freq, duration) on the AudioOutput port.

**C91. No suspend/resume or visibilitychange lifecycle handling for the web AudioContext** - `idea` M/L - _audio-io-realtime_
  - useAudioInput.ts:122-130; useReferenceTone.ts
  - Only onMounted/onUnmounted exist; tab backgrounding, OS audio-device sleep, or mobile interruption can leave a suspended context with no recovery. A visibilitychange/statechange handler that resumes (or stops cleanly and shows status) would harden mobile/laptop use.

**C92. vue-tsc typecheck runs only in build-web, not in the deploy-from-release fast path** - `problem` M/L - _testing-ci_
  - .github/workflows/deploy.yml deploy-from-release job ships a prebuilt artifact.tar without rebuild/typecheck
  - Production deploy from a release artifact bypasses typecheck/build entirely; quality gating depends on the artifact having been validated earlier, which isn't asserted at deploy time.

**C93. pitch-core tests assert weak/permissive tolerances and ignored results** - `problem` M/L - _testing-ci_
  - pitch-core/src/lib.rs:560 (accepts 440 OR 220 octave), :594 `let _ = is_likely_power_chord_native(...)` result discarded
  - test_yin_440hz passes on an octave error and test_power_chord never asserts its actual detection, so these guard much less than they appear to.

**C94. Worker buffer transferred in but never transferred back; new Float32Array slice every detection** - `problem` M/L - _performance_
  - usePitchLoop.ts:119 (frame.buffer.buffer.slice(0)) + pitchWorker.ts:25 (postMessage without transfer back)
  - Each detection allocates a fresh ArrayBuffer copy via slice(0) and the worker never returns the buffer, so no buffer pooling/zero-copy handoff - churns ~16KB/detection at 30Hz.

**C95. viz rAF runs whenever listening, even though Spectrum redraws are driven by a watch not the loop** - `problem` M/L - _performance_
  - useTuner.ts:38-42 (anyViz gate) vs Spectrum.vue:166 / Waveform.vue:110 watchers
  - Visualizers redraw inside a Vue watch on frame.sequence rather than their own rAF, so heavy canvas work runs synchronously in the reactive flush; coupling draw to the frame producer's rAF avoids extra reactivity-triggered layout/paint.

**C96. Spectrum recreates a linear gradient object per bar per frame** - `problem` M/L - _performance_
  - web/src/components/Spectrum.vue:120-124 (ctx.createLinearGradient inside the displayBins loop)
  - Up to 160 createLinearGradient + 3 addColorStop calls per frame; the gradient is height-invariant per frame and can be built once before the loop (or cached on h change).

**C97. resizeCanvas (full reflow read of parent.clientWidth) runs on every drawFrame** - `problem` M/L - _performance_
  - Waveform.vue:58, Spectrum.vue:64, Spectrogram.vue:93
  - Reading parent.clientWidth every frame forces layout; resize only changes on window/container resize, so gate it behind a ResizeObserver instead of measuring inside the hot draw path.

**C98. No bundle-size budget gate in web CI** - `suggestion` M/L - _performance_
  - .github/workflows/build-web.yml (no size/gzip step)
  - build-web.yml builds but never checks output size; a gzipped-budget assertion (incl. the ~unused wasm) would catch regressions and surface the dead-weight wasm payload.

**C99. PARTIAL 2026-06-30: Vitest + pitch-core clippy/rustfmt gates exist; perf coverage is still shallow** - `suggestion` M/L - _performance_
  - build-web.yml runs Vitest; test-core.yml runs pitch-core fmt/clippy/test/wasm feature checks.
  - Remaining: benchmark/perf regression tests and broader component/session coverage.

**C100. YIN_THRESHOLD = 0.12 and energy gate constants (0.0025 / 0.012) duplicated across languages** - `problem` M/L - _duplication_
  - web/src/utils/pitch.ts:15-17 vs pitch-core/src/lib.rs:3 (YIN_THRESHOLD), lib.rs:174 (0.0025/0.012)
  - Same DSP tuning magic numbers hand-copied; pitch.ts even uses a second inconsistent gate (0.002/0.01 at lines 175/220) inside autoCorrelate/detectPitch, so the same 'is there signal' question has three different answers in one file.

**C101. FFT size 2048 hard-coded five times in Rust, mismatched against web fftSize 4096** - `problem` M/L - _duplication_
  - pitch-core/src/lib.rs:36,45,100-102,108 and egui/src/main.rs:329,444-446,559-562; web useAudioInput.ts:11 (fftSize=4096)
  - No named constant: the literal 2048 appears in the planner, spectrum_buffer, Hann loop, bin math, and egui windowing; web analyser uses 4096 then the worker detects on the full frame, so the implicit frame-size contract is undocumented and language-specific.

**C102. Sample rate constant inconsistent: 44100 (web default), 48000 (egui PREFERRED), runtime cf.sample_rate (cpal)** - `problem` M/L - _duplication_
  - web/src/composables/useAudioInput.ts:4 (DEFAULT_SAMPLE_RATE=44100) vs egui/src/main.rs:26 (PREFERRED_SAMPLE_RATE=48000) vs main.rs:441,497 (actual device rate)
  - egui spectrum harmonic overlay (main.rs:326-329) assumes 48000 for bin math but the mic stream feeds the real device rate, so harmonic marker positions are wrong on any non-48k device; web assumes 44100 as fallback - three different 'the' sample rate values.

**C103. No freeze/hold button to capture the last reading** - `idea` M/L - _ux-product_
  - web/src/composables/usePitchLoop.ts (no pause path other than stop); App.vue main card
  - A plucked note decays fast and the gauge keeps moving; there is no freeze control to snapshot detectedNote/cents while the user inspects, only full stop() which tears down audio.

**C104. Auto vs Manual mode label is buried inside StringSelector header** - `suggestion` M/L - _ux-product_
  - web/src/components/StringSelector.vue:29-40
  - The auto-detect/manual indicator only appears in the string grid header, far from the big note readout; the primary detection state isn't surfaced where the user looks (NoteDisplay/CentsGauge).

**C105. Detected state gives no "too quiet / play louder" feedback distinct from idle** - `idea` M/L - _ux-product_
  - web/src/composables/usePitchLoop.ts:96-100 signalTooQuiet; CentsGauge waiting.signal
  - When signal is below RMS gate the gauge just shows generic WAITING FOR SIGNAL, identical to before playing; a guitarist can't tell mic-too-quiet from not-yet-plucked. Surface a distinct low-level hint.

**C106. No prefers-reduced-motion handling for pulse/transitions** - `problem` M/L - _a11y-i18n_
  - web/src/style.css:142-148 mic pulse keyframes; App.vue:91 animate-pulse; LevelMeter.vue:18,25; CentsGauge needle transitions
  - Continuous mic pulse, listening dot animate-pulse, and width transitions run regardless of OS reduce-motion; add a @media (prefers-reduced-motion: reduce) block that disables animation/transition.

**C107. Lang toggle button has no aria-label or lang attribute** - `problem` M/L - _a11y-i18n_
  - web/src/App.vue:87-89 (only title="RU / EN", text 'RU'/'EN')
  - SR announces just 'RU' with no role context and title isn't reliably read; add aria-label like 'Switch language (current: English)' and lang on the label text.

**C108. No skip link / landmark structure for keyboard and SR navigation** - `idea` M/L - _a11y-i18n_
  - web/src/App.vue:71-339 (divs only, no <main>/<nav>/<section>, no skip link)
  - Long single-column page with many panels has no landmarks or skip-to-tuner link, so keyboard/SR users must tab through everything; wrap regions in semantic landmarks.

**C109. egui desktop in-tune indicator is color-only GREEN vs RED** - `problem` M/L - _a11y-i18n_
  - egui/src/main.rs:203 circle_filled GREEN/RED by cents.abs()<5
  - Desktop gauge dot conveys in-tune purely via green/red with no shape or text and no colorblind palette, unlike the web text cue; add a label or shape and an Okabe-Ito option.

**C110. Tauri CSP only allows localhost dev origins; no production/connect hardening** - `suggestion` M/L - _build-pwa-distribution_
  - desktop/src-tauri/tauri.conf.json:28
  - connect-src hardcodes http/ws localhost:5173 (only meaningful in dev) and there is no separate stricter production CSP; ship a dev-vs-release CSP so the packaged app does not whitelist a dev server and add object-src 'none'/base-uri 'self'.

**C111. Web manifest ships only an SVG icon; no PNG/maskable icons for installability** - `problem` M/L - _build-pwa-distribution_
  - web/public/manifest.webmanifest:11-17
  - icons array has a single SVG with sizes 'any'; Android/Chrome install prompts require 192px and 512px PNGs plus a purpose:'maskable' entry, so the home-screen install is degraded or refused despite full PNG sets already existing for Tauri.

**C112. No pre-compressed (gzip/brotli) assets generated at build time** - `idea` M/L - _build-pwa-distribution_
  - web/vite.config.ts:20-26 (no compression plugin)
  - GitHub Pages does not compress on the fly for all asset types; vite build emits only raw .js/.css/.wasm with no .br/.gz siblings, inflating transfer size of the bundle and wasm.

**C113. Release job tags and publishes even when desktop builds fail (if: always)** - `problem` M/L - _build-pwa-distribution_
  - .github/workflows/release.yml:50-51 and 91-102
  - release runs with `if: always()`; if build-tauri/egui fail it still creates the git tag and GitHub Release containing only the web artifact, producing a published vX.Y.Z release missing the advertised desktop binaries and silently consuming that version number.

**C114. No CI gates for clippy, rustfmt, or web lint** - `suggestion` M/L - _observability-reliability_
  - .github/workflows/test-core.yml; build-web.yml (only vue-tsc + build)
  - test-core runs only `cargo test -p pitch-core`; no `cargo clippy`/`cargo fmt --check` and no eslint, so reliability regressions (unused stream like out.take, unwrap panics) pass CI.

**C115. No baroque/historical A4 presets (415/432/392/466)** - `idea` M/L - _instruments-domain_
  - web/src/utils/notes.ts (a4 param everywhere, free number)
  - a4 is a bare float threaded through midiToFrequency; there is no enumerated set of historical pitches (415 baroque, 392 French, 466 chorton, 432) for period-instrument users.

**C116. Hardcoded 20Hz low cutoff in both note resolvers blocks legitimate low instruments** - `problem` M/L - _instruments-domain_
  - pitch-core/src/domain.rs:178; web/src/utils/notes.ts has no explicit floor but frequencyToMidi log2 unguarded
  - domain.rs returns '—' under 20Hz which is fine, but the floor should be tuning-aware (32.7Hz cello C / 30.9Hz bass B0 sit just above it with no margin for slightly-flat strings).

**C117. No crate-level `//!` doc explaining pitch-core layering or entry points** - `problem` M/L - _dx-docs_
  - pitch-core/src/lib.rs:1 (top of crate)
  - Crate opens with bare consts and a one-line `mod domain` comment; there is no `//!` overview telling a reader to start at TunerEngine::process vs the free detect_pitch fns, or which are wasm-only vs native.

**C118. PARTIAL 2026-06-30: pitch-core has CI clippy/rustfmt; egui/desktop remain ungated** - `problem` M/L - _dx-docs_
  - .github/workflows/test-core.yml now gates pitch-core fmt/clippy/tests/wasm feature check; build-egui.yml/build-tauri.yml still build only.
  - Remaining: add platform-aware egui/desktop lint/format strategy.

**C119. No dependency-audit gate (cargo-audit / npm audit / dependabot)** - `suggestion` M/L - _dx-docs_
  - .github/workflows/ (no audit job), .github/ (no dependabot.yml)
  - No `cargo audit`, `npm audit`, or Dependabot config exists for a project pulling rustfft/cpal/tauri and a Vue/Vite toolchain, so vulnerable transitive deps go unflagged.

**C120. MPM NSDF is full O(n²) over all tau with no downsampling, run in realtime callback** - `problem` H/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:270-289
  - NSDF loops tau in 0..n/2 with an inner i-loop over n-tau on the full 2048 buffer (~2M mul-adds), and downsample_for_pitch exists but is never called in process(); this is the fallback path's worst case inside the audio thread.

**C121. No decimation before YIN; full 4096-sample buffer scanned at full sample rate** - `problem` H/M - _performance_
  - web/src/utils/pitch.ts:90-97 (detectPitchYIN difference loop)
  - YIN difference function is O(half * tauRange) on 4096 samples @ 44.1/48k; downsample_for_pitch exists in WASM but is unused - decimating 4x before YIN would cut the inner loop ~16x for the low-frequency tau range.

**C122. Spectrogram repaints entire 128x150 history with per-cell fillRect every frame** - `problem` H/M - _performance_
  - web/src/components/Spectrogram.vue:115-136
  - Nested loop issues up to ~19200 fillRect + string-template rgb() fillStyle assignments per frame instead of scrolling via drawImage(canvas) and drawing only the newest column - main offender for jank on the viz path.

**C123. No guided string-by-string auto-advance; selection is fully manual** - `idea` H/M - _ux-product_
  - web/src/composables/useTuningState.ts:250-257 toggleString; App.vue keyboard 1-9
  - Once a string settles in-tune there is no logic to mark it done and jump to the next un-tuned string; user must click/press each string manually, defeating the core guided-tuning flow.

**C124. pitch-core public API has zero rustdoc comments** - `problem` H/M - _dx-docs_
  - pitch-core/src/lib.rs (whole file), pitch-core/src/domain.rs (whole file)
  - grep '///' returns 0 in both files: TunerEngine, detect_pitch, Smoother, frequency_to_note, get_cents, find_closest_string etc. are entirely undocumented, so `cargo doc` yields empty pages and no signature guidance for consumers.

**C125. No CONTRIBUTING with an 'add a tuning / add a detector' walkthrough** - `problem` H/M - _dx-docs_
  - repo root (no CONTRIBUTING.md), README.md has no contributing/dev section
  - Adding a tuning currently means editing both domain.rs get_tunings() and notes.ts BUILT_IN_TUNINGS and the parity test; adding a detector means matching detect_pitch_yin/mpm conventions - none of this is documented anywhere.

**C126. useTuner is a ~110-member god facade aggregating 11 composables** - `suggestion` M/M - _architecture-coupling_
  - web/src/composables/useTuner.ts:15-263
  - The orchestrator re-exports nearly every field of audio/pitch/tuning/earTraining/metronome/settings as one flat object plus hosts practice-summary logic; grouping the return into namespaced sub-objects (tuning, practice, viz, metronome) would cut the surface consumers couple to.

**C127. No vitest gate for the TS domain/DSP despite it being the web's real detector** - `suggestion` M/M - _architecture-coupling_
  - web/package.json:11 ("test" = node scripts/test-core.mjs); no vitest config
  - pitch.ts (YIN/autocorr) and notes.ts (temperaments, scaleTuning, frequencyToNote) carry the production web logic but have no vitest suite; the only `test` script shells to a core script, leaving the TS layer unguarded.

**C128. No Rust↔TS parity test pinning the two YIN + note-math implementations together** - `idea` M/M - _architecture-coupling_
  - pitch-core/src/lib.rs:153-268 / domain.rs:177-217 vs web/src/utils/pitch.ts + notes.ts
  - Two full implementations of detection and note/cents math must agree numerically, but no test feeds identical synthetic sines/known frequencies to both and asserts matching freq/note/cents within tolerance, so silent divergence between web and native is undetectable.

**C129. No vibrato / stable-pitch detection; median+EMA smoother masks but doesn't classify** - `idea` M/M - _dsp-algorithms_
  - pitch-core/src/lib.rs:473-518 (Smoother)
  - The Smoother just de-jitters with EMA(0.4)+5-tap median; there is no variance/stability metric to tell a steady held note from vibrato or a still-decaying pluck, so the readout can settle on transient pitch.

**C130. useSettings watches 27 sources with deep:true including the 500-entry practiceHistory array** - `problem` M/M - _web-vue_
  - web/src/composables/useSettings.ts:292-322
  - Every markEarTraining replaces practiceHistory with a fresh up-to-500 array, forcing a deep re-traversal of all watched arrays (customTunings/instruments/temperaments/offsets) on each correct/miss; split persistence into a debounced snapshot keyed off shallow refs.

**C131. Hardcoded canvas colors make colorblind/light themes not apply to visualizers** - `problem` M/M - _web-vue_
  - web/src/components/Spectrum.vue:121-123, Spectrogram.vue:124-133, Waveform.vue:72, CentsHistory.vue:70
  - style.css has .theme-colorblind overrides for DOM, but Spectrum/Spectrogram/Waveform/CentsHistory bake #22c55e/#4ade80 and the heat ramp directly into ctx, so the colorblind theme (an accessibility feature) silently does nothing on the canvases.

**C132. l10n uses raw localStorage and a separate store, divorced from settingsStorage persistence** - `problem` L/L - _web-vue_
  - web/src/stores/l10n.ts:3-7,234-237 vs useSettings.ts/settingsStorage
  - Language is persisted via direct localStorage('lang') while every other preference goes through settingsStorage; on Tauri/native this bypasses the unified store and language won't migrate or export with the rest of the settings.

**C133. currentTuning resolution logic is duplicated between init and the reconciliation watch** - `suggestion` L/L - _web-vue_
  - web/src/composables/useTuningState.ts:87-90 and 409-415
  - The 'find lastTuningId in allTunings else defaultTuningForInstrument' expression appears both at ref init and inside the deep immediate watch; extract resolveActiveTuning() so the two paths cannot drift.

**C134. native frame listener can leak if start_native_audio rejects after listen resolves** - `problem` L/L - _web-vue_
  - web/src/composables/useNativeAudioInput.ts:59-70
  - unlisten is set before invoke('start_native_audio'); the catch calls cleanupListener so it is handled, but if a second start() races (no in-flight guard) the prior unlisten ref is overwritten and the first listener leaks. Add a starting-in-flight guard.

**C135. RESOLVED 2026-07-20: in-tune hysteresis no longer mutates inside a computed** - `fixed` L/L - _web-vue_
  - web/src/composables/useTuningState.ts:92,170-180
  - `domain/tuningDetectionMachine.ts` now owns explicit `process/reset/resetInTune` transitions; `useTuningDetection.ts` only watches inputs and exposes pure computed projections of the latest immutable snapshot.

**C136. detectionRange round-trips through useTuner ref instead of being consumed directly** - `suggestion` L/L - _web-vue_
  - web/src/composables/useTuner.ts:19,25,48-51
  - A local detectionRange ref mirrors tuning.detectionRange via watch only to feed usePitchLoop; usePitchLoop already accepts a Ref, so pass tuning.detectionRange (a computed Ref) straight in and drop the mirror ref plus its sync watch.

**C137. Per-frame State clone of full spectrum + waveform Vecs every repaint** - `problem` M/M - _egui-native_
  - egui/src/main.rs:151 (self.st.lock().unwrap().clone())
  - ctx.request_repaint() forces continuous repaint (line 148), and each frame deep-clones State including spectrum (512 f32) and waveform (2048 f32); read fields under the lock into the painters or double-buffer, instead of cloning the whole struct ~60x/s.

**C138. cents_history uses Vec::remove(0) (O(n) shift) instead of a VecDeque** - `problem` L/L - _egui-native_
  - egui/src/main.rs:153-156 (cents_history.push + remove(0)); field at 110
  - spectrogram_history correctly uses VecDeque with pop_front, but cents_history is a Vec doing remove(0) every frame after 300 entries, shifting up to 300 elements 60x/s; switch the field to VecDeque<f32>.

**C139. set_visuals(Visuals::dark()) called every frame** - `problem` L/L - _egui-native_
  - egui/src/main.rs:149
  - Theme is re-applied on every update() instead of once at startup, doing needless style cloning each frame and preventing any future light/colorblind theme that the web side already supports; set visuals once in the creation closure.

**C140. Device-change restart implemented as double toggle_mic hack instead of restart_mic()** - `problem` L/L - _egui-native_
  - egui/src/main.rs:268-273
  - The code itself flags this as a smell: it calls toggle_mic twice to restart the stream on device change, briefly tearing down then rebuilding; add an explicit AudioManager::restart_input that swaps the stream without the stop/start race.

**C141. Harmonic-overlay bin math hardcodes 2048/sr while max_bins comment claims 44.1kHz** - `problem` L/L - _egui-native_
  - egui/src/main.rs:297 (comment '~0-4300 Hz at 44.1kHz') vs 326-329 (sr=48000, /2048.0)
  - The spectrum uses PREFERRED_SAMPLE_RATE=48000 but the max_bins comment and frequency labeling assume 44.1kHz, and native mic actually runs at the device sr (line 441), so harmonic vlines land on wrong bins when device sr != 48000; derive bin spacing from the actual capture sr carried in State.

**C142. No latency measurement anywhere in the audio path** - `idea` M/M - _audio-io-realtime_
  - useAudioInput.ts (AnalyserNode); native_audio.rs callback; egui input callback
  - Nothing reads AudioContext.baseLatency/outputLatency or cpal stream latency, and no input->display lag is tracked. Capturing and surfacing measured latency would let you tune window/hop sizes and detect device-induced lag.

**C143. Native frame emit throttled by 33ms wall-clock Instant inside the RT callback** - `suggestion` L/L - _audio-io-realtime_
  - desktop/src-tauri/src/native_audio.rs:144,152,156
  - Throttling via Instant::now() on the audio thread couples emit cadence to callback timing and adds a syscall per callback; a sample-count-based hop or off-thread scheduler is cleaner and keeps the RT callback minimal.

**C144. egui phase accumulator `ph=(ph+1.0)%sr` loses precision and is per-stream ad hoc** - `suggestion` L/L - _audio-io-realtime_
  - egui/src/main.rs:500,532
  - Phase computed as 2*pi*f*ph/sr with integer-stepped ph modulo sr is fragile across sample formats and non-f32 output configs (output stream assumes f32 data without checking sample_format, unlike the input path which handles all formats).

**C145. Native start uses a 2s ready timeout but leaks the spawned audio thread on timeout** - `problem` L/L - _audio-io-realtime_
  - desktop/src-tauri/src/native_audio.rs:63-74
  - If ready_rx.recv_timeout fires (Err) the function returns an error but stop_tx is dropped without being stored; the spawned thread is blocked on stop_rx.recv() forever (or runs the stream), and no stop signal is ever sendable, leaking the thread/stream until app exit.

**C146. No golden/fixture harness for detection outputs** - `idea` M/M - _testing-ci_
  - pitch-core tests + test-core.mjs both hand-roll sine buffers inline; no shared WAV/fixture corpus
  - Capture a corpus of real recorded notes (and synthetic chords/noisy/low-SNR) with expected freq/cents as golden files, asserted by both Rust and TS suites.

**C147. No benchmarks for the realtime DSP hot path** - `idea` M/M - _testing-ci_
  - pitch-core/Cargo.toml dev-dependencies (only `approx`); no criterion bench
  - detect_pitch/YIN/MPM/FFT run per audio callback; a criterion bench would catch per-frame latency regressions that threaten realtime budget.

**C148. Hand-rolled esbuild bundling test runner instead of vitest** - `suggestion` M/M - _testing-ci_
  - web/scripts/test-core.mjs (bundles TS via esbuild into temp dir, node:assert)
  - Bespoke runner can't do watch mode, coverage, parallelism, or test the .vue/composable surface; migrating to vitest unlocks all of those and is the missing tool the dimension calls out.

**C149. egui crate has no tests at all** - `problem` M/M - _testing-ci_
  - egui/src/* (no #[test]/mod tests); build-egui.yml only does cargo build
  - The native app's audio-callback glue, tone generation, and UI-state logic are entirely untested and only checked for compilation.

**C150. No DetectionFrame/contract test guarding the Rust<->TS data shape** - `idea` M/M - _testing-ci_
  - pitch-core PitchDetection (lib.rs) vs TS detection range/stats objects passed in usePitchLoop.ts:112
  - There's no shared schema or contract test ensuring the fields/units (Hz, cents, confidence) produced by Rust match what the TS consumer expects, so a field rename breaks silently across the boundary.

**C151. Two independent rAF loops (pitch + viz) run uncoordinated on the main thread** - `idea` M/M - _performance_
  - usePitchLoop.ts:106 and useVisualizationFrames.ts:57
  - Each composable owns its own requestAnimationFrame; both call getFloatTimeDomainData on the same analyser each frame - a single shared rAF driver would halve analyser reads and centralize frame scheduling.

**C152. Canvas DPR/getContext/setTransform boilerplate reimplemented in 4 visualizers instead of using useHiDpiCanvas** - `problem` M/M - _duplication_
  - components/Waveform.vue:18,41,50,106; Spectrum.vue:19,46,55,162; Spectrogram.vue:24,47,56,154; CentsHistory.vue:17,40,103 vs composables/useHiDpiCanvas.ts
  - A useHiDpiCanvas composable exists with exactly this resize/clear/setTransform logic, but every canvas component still hand-rolls its own dpr getter, getContext('2d',{alpha:true}), setTransform, and '#11151b' clear - the abstraction was written but never adopted.

**C153. Every persisted-settings key string is written four times across load/save x Tauri/local** - `problem` M/M - _duplication_
  - web/src/utils/settingsStorage.ts:97-123, 134-170, 177-204, 208-234
  - ~30 keys each appear as a literal string in the Tauri-load block, the localStorage-load block, the Tauri-save block, and the localStorage-save block; a single key/serializer table would remove ~120 stringly-typed lines and the risk of a typo'd key on one of the four paths.

**C154. Power-chord detection exists only in Rust; web NoteDisplay has a dead isPowerChord prop** - `problem` M/M - _duplication_
  - pitch-core/src/lib.rs:385-413 (is_likely_power_chord) vs web components/NoteDisplay.vue:10,24-26 (isPowerChord prop)
  - is_likely_power_chord with the 1.4983 fifth-ratio heuristic is implemented and unit-tested in Rust but there is no TS equivalent; NoteDisplay accepts an isPowerChord prop that the web tuner path never populates, so the '(power)' badge only ever lights on the native backend - feature parity gap masquerading as a shared prop.

**C155. Note-name array, midi<->freq, and noteId/get_note_display formatting duplicated in TS and Rust** - `suggestion` L/L - _duplication_
  - web/src/utils/notes.ts:1,363-374,414-432,466-468,526-531 vs pitch-core/src/domain.rs:4,169-188,219-224
  - NOTE_NAMES, midiToFrequency/frequency_to_midi, the (midi%12+12)%12 index, octave = midi/12-1, and the `${name}${octave}` display string are each implemented once per language; small individually but they are the lowest-effort items to consolidate behind a single generated-from-Rust contract.

**C156. No post-session "how close" report; cents history is wiped on every start** - `idea` M/M - _ux-product_
  - web/src/composables/useCentsHistory.ts:15-31; useTuner.start clears it (useTuner.ts:55,64)
  - centsHistory is a rolling 96-point graph with no per-string final-error capture or summary; there is no record of how many strings ended in tune or their residual cents after a tuning session.

**C157. No minimal/focus mode; layout modes don't hide secondary panels** - `idea` M/M - _ux-product_
  - web/src/App.vue:98-334 (all panels always rendered); layoutMode default/stage/compact in useTuner.ts:89-92
  - Every panel (temperament, offsets, ear training, metronome, stats) renders unconditionally; layoutMode only changes CSS classes, so there is no way to collapse to just note + gauge for stage use.

**C158. PerStringCents.vue is dead code, never imported** - `problem` L/L - _ux-product_
  - web/src/components/PerStringCents.vue (no references in src)
  - grep shows zero importers; it also hardcodes English "Per string:", uses raw red/green and a broken width formula. Either wire it into a per-string overview or delete it.

**C159. NoteDisplay confidence/power-chord props are declared but never fed** - `problem` L/L - _ux-product_
  - web/src/components/NoteDisplay.vue:5-13,24-27; App.vue:175-181 omits them
  - confidence and isPowerChord props exist and render UI, but App.vue passes neither and the pitch loop exposes no confidence; the Detected state can't show signal-quality, so weak detections look identical to strong ones.

**C160. String buttons don't show per-string tuned/in-progress status** - `idea` M/M - _ux-product_
  - web/src/components/StringSelector.vue:42-56
  - Buttons only reflect selected vs not; there is no green "tuned" / amber "close" / grey "untouched" state per string, so the grid can't act as a checklist for completing all six strings.

**C161. No dir/RTL support anywhere despite locale switching** - `idea` M/M - _a11y-i18n_
  - web/src/stores/l10n.ts (only ru/en); App.vue root div; index.html
  - No document.dir handling, no logical CSS properties, and left-handed reverse uses array.reverse not dir; adding any RTL locale would break layout - set dir per locale and audit margins/needle direction.

**C162. No screen-reader bucketed cents description** - `idea` M/M - _a11y-i18n_
  - web/src/components/CentsGauge.vue (status only says in.tune/sharp/flat); useTuningState.ts cents
  - SR users get raw needle/'SHARP' but no magnitude; expose bucketed text (in tune / slightly / very flat|sharp) so non-visual users know how far off without reading the gauge.

**C163. Canvas visualizers ignore theme and colorblind palette** - `problem` M/M - _a11y-i18n_
  - web/src/components/Waveform.vue:72; Spectrum.vue:122,130 (hardcoded #22c55e/#f59e0b)
  - Waveform/Spectrum strokeStyle/gradient hardcode green+amber with no theme or colorblind variant and no forced-colors fallback; read colors from CSS custom properties or a theme palette object.

**C164. No forced-colors / prefers-contrast / Windows High Contrast support** - `idea` M/M - _a11y-i18n_
  - web/src/style.css (no forced-colors media query); SVG/canvas use fixed fills
  - Gauges and buttons rely on background-color that vanishes in forced-colors mode; add a @media (forced-colors: active) block mapping to system color keywords and outlines.

**C165. Only sharps + scientific notation; no flat or solfege (Do-Re-Mi) note names** - `idea` M/M - _a11y-i18n_
  - web/src/utils/notes.ts:1 NOTE_NAMES, getNoteDisplay:526; no preference in useSettings.ts
  - getNoteDisplay hardcodes C# style; many locales (RU/IT/FR/ES) expect Do-Re-Mi or flats - add a note-name-style setting and locale-aware name table rather than one global sharp array.

**C166. String shortcuts capped at 1-9; higher strings unreachable by key** - `problem` L/L - _a11y-i18n_
  - web/src/App.vue:54-58 handleKey number parse
  - 12-string tuning has 12 strings but only keys 1-9 select; strings 10-12 have no keyboard shortcut and there's no arrow-key cycling - extend or use bracket/arrow navigation.

**C167. WASM artifact is not content-hashed / versioned for cache-busting** - `problem` M/M - _build-pwa-distribution_
  - web/public/wasm/pitch_core_bg.wasm (fixed name copied verbatim into dist/wasm)
  - files in public/ bypass Vite hashing, so pitch_core_bg.wasm keeps a stable URL; once a SW/offline cache exists a stale wasm would be served indefinitely after an update (and today it ships unhashed regardless).

**C168. No pipeline health strip (WASM/ctx state / fps / last error)** - `idea` M/M - _observability-reliability_
  - web/src/App.vue:169-172
  - Only observability surface is a single red error banner; there is no compact diagnostics readout for AudioContext state, worker alive, detection fps, sampleRate, or last-error, making field debugging blind.

**C169. No clipping / DC-offset / hum watchdog despite stats availability** - `idea` M/M - _observability-reliability_
  - web/src/composables/usePitchLoop.ts:92-97; web/src/utils/pitch.ts:24-37
  - computeSignalStats only yields rms/maxAbs used for a silence gate; no detection of clipping (maxAbs near 1.0), DC offset (mean!=0), or 50/60Hz hum to warn the user about bad input conditions.

**C170. LevelMeter 80% color break is cosmetic, not a real clip indicator** - `problem` L/L - _observability-reliability_
  - web/src/components/LevelMeter.vue:16-31
  - The yellow/red gradient triggers on normalized rms*18 crossing 0.8, not on actual sample clipping (maxAbs>=~0.99); it can stay green through hard clipping and red on a loud-but-clean signal.

**C171. No update-available checker despite version.json + injected SHA** - `idea` M/M - _observability-reliability_
  - web/.github/workflows/build-web.yml (VITE_APP_VERSION/VITE_APP_SHA injected); web/src/main.ts
  - Build injects version/SHA env but nothing reads them at runtime or polls version.json to tell a long-open PWA session a new build exists; users get stuck on stale cached assets with no reload prompt.

**C172. Native start uses a fixed 2s readiness timeout with no retry/diagnostics** - `suggestion` L/L - _observability-reliability_
  - desktop/src-tauri/src/native_audio.rs:67-74
  - recv_timeout(2s) returns a generic 'did not start in time' that conflates a slow-but-working device init with a real failure; no retry or device-name context makes intermittent startup failures hard to diagnose.

**C173. Cello low-C extension (~32Hz, 5-string cello / C extension) absent and below 20Hz floor** - `problem` M/M - _instruments-domain_
  - web/src/utils/notes.ts:346-350 (cello C2=65Hz); :484-491 / domain.rs:178
  - Cello stops at C2; there is no C extension or 5-string cello low-C entry, and even if added the hardcoded 20Hz floor in frequency_to_note leaves no headroom for sub-33Hz fundamentals.

**C174. Temperament/sweetening offsets keyed by flat string index, breaking on courses** - `problem` M/M - _instruments-domain_
  - web/src/utils/notes.ts:118 (sweet-guitar-12 12 offsets); useTuningState.ts:112-113
  - sweet-12-string supplies 12 offsets matched positionally to the 12 flat strings; if course grouping is introduced the offset arrays must be restructured per-course or they silently misalign.

**C175. No explicit 'unison vs octave' course-type enum to drive beat-frequency tuning UI** - `idea` M/M - _instruments-domain_
  - web/src/utils/notes.ts (Tuning interface :20-26)
  - 12-string upper courses are unison (B3/B3, E4/E4) and lower are octave; distinguishing them would let the tuner offer beat-rate/zero-beat guidance for unison pairs, which the flat model cannot support.

**C176. A4 changes don't propagate to the Rust catalog frequencies (precomputed constants)** - `problem` M/M - _instruments-domain_
  - pitch-core/src/domain.rs:19-26 (GUITAR_STRINGS_STANDARD literal Hz) vs notes.ts note() computes from equalFrequency
  - Rust strings carry literal 440-based Hz and are only rescaled at find_closest_string by a4/440; historical A4 or temperament shifts of the catalog itself are not representable on the native side.

**C177. No runnable example for pitch-core (`examples/` absent, no doctests)** - `suggestion` M/M - _dx-docs_
  - pitch-core/ (no examples/ dir), no ``` fences in src
  - There is no `cargo run --example` showing feed-samples->TunerUpdate, and no doctest on detect_pitch/TunerEngine, so the only usage reference is reading egui/main.rs and web glue by hand.

**C178. No ADRs recording key choices (YIN+MPM cascade, dual Rust/TS engines, A4-scaled cents)** - `suggestion` M/M - _dx-docs_
  - repo root (no docs/adr or adr/ dir); rationale only as inline comments in lib.rs:184/211
  - Non-obvious decisions (why YIN preferred then MPM fallback, why cents are computed against closest string not chromatic, why two engines exist) live only as code comments and large planning .md files, not as discoverable decision records.

**C179. No dev synthetic-signal injector for the web pitch loop** - `idea` M/M - _dx-docs_
  - web/src/composables/useAudioInput.ts + usePitchLoop.ts (mic-only sources)
  - test-core.mjs builds sine buffers for node tests, but there is no in-app dev mode to inject a synthetic tone/sweep into usePitchLoop, so UI/visualizer work still requires a real instrument and mic.

**C180. PARTIAL 2026-06-30: Vitest is wired into build-web CI; composable/component coverage is still missing** - `problem` M/M - _dx-docs_
  - web/package.json scripts.test -> `vitest run`; legacy `scripts/test-core.mjs` is retained as `test:core:legacy`.
  - build-web.yml runs `npm test`; remaining gap is Vitest coverage for composables/components and fake audio/session behavior.

**C181. Self-documenting 'simplicity' hack left in egui play_random_string is undocumented dead code** - `problem` L/L - _dx-docs_
  - egui/src/main.rs:540
  - `let out_clone = self.audio.out.take();` immediately takes and drops the just-stored stream with only a hand-wavy comment; from a docs/DX view it is confusing dead-ish code with no doc-comment or issue link explaining intent.

**C182. spectrum.clone() into State every audio callback allocates a fresh 512-f32 Vec** - `problem` L/M - _egui-native_
  - egui/src/main.rs:468-470 (g.spectrum = update.spectrum) + pitch-core/src/lib.rs:99 (vec![0.0f32;512])
  - process() allocates a new 512-element spectrum Vec each call and it is moved into State, so every callback heap-allocates on the audio thread; preallocate and write into a reused buffer to keep the realtime path allocation-free.

**C183. Spectrogram inner loop fills 150x80 individual rect_filled calls per frame** - `idea` L/M - _egui-native_
  - egui/src/main.rs:355-375
  - Up to 12k tiny filled rects are emitted every repaint for the spectrogram; render to an egui TextureHandle (ColorImage) updated incrementally per new column instead of re-emitting all cells each frame.

**C184. No E2E test driving the app with a fake mic / synthetic stream** - `idea` M/H - _testing-ci_
  - web (usePitchLoop/useAudioInput) and egui; no Playwright/headless harness feeding getUserMedia or cpal
  - Pipeline from audio frame -> visualization frame -> tuning state is integration-untested; a fake MediaStream feeding a known tone would catch wiring regressions composables can't.

**C185. No stretch (Railsback) tuning model** - `idea` M/H - _instruments-domain_
  - web/src/utils/notes.ts:414-423 (midiToFrequency), domain.rs:169-171
  - Frequency is pure equal/temperament math with no inharmonicity curve; piano-style progressive sharpening of treble / flattening of bass octaves cannot be expressed.

### P3 (2)

**C186. A4 is free numeric input with no lock against accidental change** - `suggestion` M/L - _ux-product_
  - web/src/App.vue:126-135; setA4 in useTuningState.ts:192-196
  - The A4 number field is always editable mid-session; a stray scroll/keypress shifts the whole reference. The dimension asks for a lock A4/tuning toggle that pins reference and current tuning.

**C187. Visualizer mount-time watch registration delays first draw and double-guards isListening** - `suggestion` L/L - _web-vue_
  - web/src/components/Spectrum.vue:166-170, Spectrogram.vue:158-162, Waveform.vue:110-113
  - watch is created inside onMounted (not setup), so the immediate run happens post-mount and re-checks props.isListening already guarded by v-if in App.vue; lifting watch to setup with shallow frame ref simplifies and removes the redundant gate.
