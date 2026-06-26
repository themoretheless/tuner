# Guitar Tuner - Master Top 500 backlog

> **Влито в ARCHITECTURE.md.** Высокоприоритетные P1/P2 пункты извлечены и размещены в разделе "Integrated Ideas..." (Highest-Priority Items...). Этот файл оставлен как полный исторический источник. Всегда смотри каноническую версию в ARCHITECTURE.md перед планированием.

All ~800 ideas from this session (rounds 1-4) re-scored on one consistent 0-100 priority rubric, deduped, 17 already-shipped items excluded, ranked. Source tag: r1=review backlog, r2/r3/r4=idea rounds.

| # | Item | Tier | Val | Source | Note |
|---|------|------|-----|--------|------|
| 1 | move DSP off cpal realtime callback | P1 | 78 | r1:review |  |
| 2 | remove blocking Mutex in audio callback | P1 | 76 | r1:review |  |
| 3 | unify tunings and note math into pitch-core | P2 | 74 | r1:review |  |
| 4 | octave-error guard subharmonic/NSDF | P2 | 73 | r1:review |  |
| 5 | real service worker / offline PWA | P2 | 72 | r1:review |  |
| 6 | eliminate per-callback heap allocations | P2 | 70 | r1:review |  |
| 7 | check Rust and TS tuning tables match | P2 | 66 | r1:review |  |
| 8 | code-sign and notarize macOS/Windows | P2 | 66 | r1:review |  |
| 9 | Harmonic Product Spectrum octave disambiguator from the existing 2048 FFT | P2 | 66 | r2:algorithms | Reuses current FFT to kill octave errors with minimal code. |
| 10 | high-pass filter rumble/mains | P2 | 64 | r1:review |  |
| 11 | reconcile Rust/TS frequency-to-MIDI rounding | P2 | 64 | r1:review |  |
| 12 | Multi-resolution dual-window analysis: long window for low strings, short for high | P2 | 64 | r2:algorithms | Fixes low-E resolution vs high-string latency tradeoff. |
| 13 | stop resizeCanvas every frame | P2 | 62 | r1:review |  |
| 14 | Tauri CSP | P2 | 62 | r1:review |  |
| 15 | adaptive noise-floor gate | P2 | 62 | r1:review |  |
| 16 | Verifiable '100% local, no network' privacy badge backed by CI zero-fetch test | P2 | 62 | r2:distribution | Strong trust signal with a cheap CI assertion; differentiates from cloud tuners. |
| 17 | Adaptive per-string tau search bounds derived from the selected target | P2 | 62 | r2:algorithms | Faster, fewer-error search when string known. |
| 18 | consolidate five rAF loops into one | P2 | 60 | r1:review |  |
| 19 | decouple detection cadence from rAF | P2 | 60 | r1:review |  |
| 20 | CI hygiene clippy/rustfmt/deploy-freshness | P2 | 60 | r1:review |  |
| 21 | Dedicated SEO landing page at /tuner/ targeting 'online guitar tuner' with schema.org FAQ + HowTo | P2 | 60 | r2:distribution | Primary organic-discovery lever for a web tuner. |
| 22 | WASM/native numeric-equivalence harness over a shared fixture manifest | P2 | 60 | r2:dx-quality | Guarantees egui and web paths agree numerically. |
| 23 | Graceful-degradation matrix: explicit WASM-down / mic-down fallback states | P2 | 60 | r3:observability-reliability | Defines deterministic UX for every failure mode instead of blank screens. |
| 24 | Playwright fake-WAV pipeline test asserts detected note | P2 | 60 | r4:docs-dx | Feed synthetic E2 audio, assert NoteDisplay shows E. |
| 25 | legible sidebar text | P2 | 58 | r1:review |  |
| 26 | vitest unit tests note math | P2 | 58 | r1:review |  |
| 27 | one-euro filter | P2 | 58 | r1:review |  |
| 28 | WebKitGTK media backend AppImage | P2 | 58 | r1:review |  |
| 29 | hardcoded 44100 in egui harmonic overlay | P2 | 58 | r1:review |  |
| 30 | Confidence-weighted late fusion of YIN, MPM, HPS and Goertzel into one estimate | P2 | 58 | r2:algorithms | Single fused estimate from existing detectors cuts octave/jitter errors cheaply. |
| 31 | Shape/texture redundancy so in-tune state never relies on color alone | P2 | 58 | r2:a11y-deep | WCAG non-color-reliance; trivial and broadly useful. |
| 32 | Property-based test for frequencyToNote round-trip across A4 sweep | P2 | 58 | r2:dx-quality | Catches note-math regressions cheaply. |
| 33 | cargo-deny + npm audit supply-chain gate with committed advisory baseline | P2 | 58 | r2:dx-quality | Blocks vulnerable deps in CI cheaply. |
| 34 | "Test My Mic" self-diagnostic wizard with pass/fail panel | P2 | 58 | r3:observability-reliability | Cuts the #1 support cause (no signal) before it becomes a bug report. |
| 35 | Vitest fake-mic harness driving useTuner via scripted AnalyserNode stub | P2 | 57 | r2:dx-quality | Deterministic frontend tuner-logic testing. |
| 36 | Mic-signal sanity watchdog (silent / clipping / DC-stuck warnings) | P2 | 57 | r3:observability-reliability | Proactively tells users why detection is wrong before they blame the app. |
| 37 | aria-live for note and cents | P2 | 56 | r1:review |  |
| 38 | auto-advance string-by-string guided tuning | P2 | 56 | r1:review |  |
| 39 | fix CentsHistory deep watcher | P2 | 56 | r1:review |  |
| 40 | bound MPM NSDF tau range | P2 | 56 | r1:review |  |
| 41 | chromatic auto-detect mode | P2 | 56 | r1:review |  |
| 42 | insta snapshot tests for full DetectionResult on fixture WAVs | P2 | 56 | r2:dx-quality | Locks down pipeline output on real signals. |
| 43 | Browser-language auto-detect via navigator.languages with persisted override | P2 | 56 | r3:i18n-breadth | Foundation for all localization; cheap and immediately broadens reach. |
| 44 | Preallocate YIN buffers as module singletons across calls | P2 | 56 | r4:perf-bundle | pitch.ts reallocates per size change; pin to max guitar size. |
| 45 | Playwright E2E for mic-permission-denied flow | P2 | 56 | r4:docs-dx | Drive fake getUserMedia, assert permission UI path renders. |
| 46 | localize hardcoded English in-tune hint | P2 | 55 | r1:review |  |
| 47 | Goertzel bank locked to 6 selected-string targets and their first 4 harmonics | P2 | 55 | r2:algorithms | Cheap targeted detection when string is known. |
| 48 | WASM streaming instantiation via instantiateStreaming for pitch-core | P2 | 55 | r4:perf-bundle | When web wires WASM, compile-while-download instead of arrayBuffer fetch. |
| 49 | validate/clamp A4 on load | P3 | 54 | r1:review |  |
| 50 | gate FFT spectrum when viz hidden | P3 | 54 | r1:review |  |
| 51 | reuse YIN difference buffers | P3 | 54 | r1:review |  |
| 52 | Native mic-permission preflight via Tauri macOS AVCaptureDevice request | P3 | 54 | r2:native-os | Avoids silent failure when OS denies mic. |
| 53 | Gaussian-window interpolation on log-magnitude FFT peaks (Jacobsen/Quinn) | P3 | 54 | r2:algorithms | Sub-bin frequency accuracy from existing FFT. |
| 54 | Stale-PWA / update-available checker against version.json | P3 | 54 | r3:observability-reliability | Stops users getting stuck on cached old builds. |
| 55 | Cap maxTau by selected-string frequency to shorten YIN | P3 | 54 | r4:perf-bundle | When string chosen, narrow lag range, fewer CMNDF iterations. |
| 56 | first-run onboarding + mic priming | P3 | 53 | r1:review |  |
| 57 | cache Spectrum gradients | P3 | 52 | r1:review |  |
| 58 | collapsible settings sidebar on mobile | P3 | 52 | r1:review |  |
| 59 | build script copies WASM to unserved dir | P3 | 52 | r1:review |  |
| 60 | Colorblind palette presets (deuteran/protan/tritan) replacing red/green coding | P3 | 52 | r2:a11y-deep | Red/green in-tune coding fails ~8% of male users. |
| 61 | Golden-trace differential runner: flag any fixture moving >1 cent | P3 | 52 | r2:dx-quality | Regression tripwire for DSP changes. |
| 62 | Adjustable in-tune tolerance + detection smoothing as accessibility controls | P3 | 52 | r2:a11y-deep | Lets tremor/motor users widen the target. |
| 63 | Locale-correct A4 decimal parsing accepting comma and period keypads | P3 | 52 | r3:i18n-breadth | Prevents broken A4 entry for half the world; trivial fix. |
| 64 | Configurable in-tune tolerance band in cents | P3 | 52 | r4:settings-personalization | Slider 1-10 cents controls green-zone width directly. |
| 65 | Lazy-load Waveform and Spectrum via defineAsyncComponent | P3 | 52 | r4:perf-bundle | App.vue statically imports both; split each into its own chunk. |
| 66 | spectrogram allocation and full redraw | P3 | 50 | r1:review |  |
| 67 | pin toolchain and wasm-pack version | P3 | 50 | r1:review |  |
| 68 | custom/editable tuning builder | P3 | 50 | r1:review |  |
| 69 | web AudioWorklet detection | P3 | 50 | r1:review |  |
| 70 | strengthen TARGET vs detected note hierarchy | P3 | 50 | r1:review |  |
| 71 | async device-change restart | P3 | 50 | r1:review |  |
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
| 92 | split useTuner god-composable | P3 | 48 | r1:review |  |
| 93 | Kalman filter on (log-f0, df0/dt) replacing EMA+median smoother | P3 | 48 | r2:algorithms | Predictive smoothing tracks vibrato/glide better than EMA. |
| 94 | Detection-accuracy report artifact: cents-error histogram per SNR bucket | P3 | 48 | r2:dx-quality | Objective accuracy tracking across noise levels. |
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
| 127 | DSP scope-recorder: dump per-frame internals to a replayable .ndjson trace | P3 | 42 | r2:dx-quality | Replay field bugs without the original audio. |
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
| 177 | prefers-reduced-motion handling | P3 | 36 | r1:review |  |
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
