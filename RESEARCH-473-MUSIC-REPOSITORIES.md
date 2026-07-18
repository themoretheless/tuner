# Research: 473 Music, Instrument and Tuner Repositories

**Snapshot:** 2026-07-18
**Goal:** compare Tuner with open-source tuners, DSP engines, instrument tools, ear-training apps, metronomes, notation software and current commercial competitors, then keep only a small set of useful actions.

This document extends [RESEARCH-100-PITCH-REPOSITORIES.md](RESEARCH-100-PITCH-REPOSITORIES.md). It is an evidence annex, not a second canonical backlog. Stable implementation priorities remain in [TOP-500-backlog.md](TOP-500-backlog.md), while grounded current defects remain in [recommendation.md](recommendation.md).

## Executive conclusion

The current project is already unusually strong in three areas: one Rust pitch core shared by native/WASM targets, local/offline operation, and a transparent live pipeline workspace. The largest competitive gaps are elsewhere:

1. **Accuracy now has a first real-instrument gate, but not yet a stress benchmark.** A licensed, checksummed 19-WAV corpus blocks CI on acquisition, false-lock, switching, sustain error and coverage. Reacquisition metrics exist but need multi-segment transition captures. Strong detector projects still go further with multiple candidates, calibrated uncertainty, phase state, controlled SNR/reverb sweeps and statistical release comparisons.
2. **Professional tuning interoperability is shallow.** Tuner can create custom 12-note temperaments, but cannot read Scala `.scl`, `.kbm` or AnaMark `.tun`, cannot represent arbitrary/non-octave scales, and has no generic note/octave filter.
3. **Practice is a demo, not yet a learning system.** The current ear trainer asks the user to reveal and self-mark one random note. Strong projects separate exercise generation, playback, answer evaluation and scheduling, then adapt to mistakes.
4. **The metronome is functionally correct only at a basic UI level.** It schedules ticks with `window.setInterval`, while serious metronomes use an audio clock, compensate latency and support count-in, tempo ramps, accents, muted subdivisions and saved programs.
5. **The product should not imitate the biggest competitor's content business.** GuitarTuna's song catalog and lessons are a different company-scale problem. Tuner's defensible path is accurate, explainable, local-first tuning plus focused practice tools that directly reuse its detector.

## Method

### Repository universe

The scan used GitHub Search API topic queries, sorted by stars, with 50 results per topic:

`music`, `audio`, `guitar`, `music-theory`, `ear-training`, `tuner`, `pitch-detection`, `digital-signal-processing`, `web-audio`, `midi`, `synthesizer`, `music-education`, `sheet-music`, `music-notation`, `audio-visualization`, `microtonal`, `metronome`, `music-information-retrieval`.

| Layer | Count | How it was used |
|---|---:|---|
| Raw topic results | 900 | 18 topics x 50; lexical false positives were expected here. |
| Unique topic-tagged repositories | 813 | Metadata screen: purpose, activity, stars, language, license and description. |
| Stratified comparison set | 405 | Top 25 per topic before deduplication; preserves small tuner/ear-training projects instead of ranking everything globally by stars. |
| Previous pitch/DSP set | 100 | The earlier focused audit, including source and scientific references. |
| Combined unique repository universe | **473** | The new 405 and previous 100 overlap by 32 repositories. |
| Deep README sample | 139 | 138 README files available; 59 projects had at least 1000 stars and 29 had fewer than 100. |
| Source-tree review | 10 | 183,851 code lines across tuner, metronome, exercise and scale applications. |

The source-tree pass covered [thetwom/Tuner](https://github.com/thetwom/Tuner), [billthefarmer/tuner](https://github.com/billthefarmer/tuner), [gstraube/cythara](https://github.com/gstraube/cythara), [jpsim/ZenTuner](https://github.com/jpsim/ZenTuner), [qiuxiang/tuner](https://github.com/qiuxiang/tuner), [mducharme/Tuner](https://github.com/mducharme/Tuner), [ShacharHarshuv/open-ear](https://github.com/ShacharHarshuv/open-ear), [patzly/tack-android](https://github.com/patzly/tack-android), [ZaneH/metronome](https://github.com/ZaneH/metronome) and [SeanArchibald/scale-workshop](https://github.com/SeanArchibald/scale-workshop).

Obvious topic collisions such as PID, CUDA-kernel, engine and cache "tuners", non-musical metronomes and image-only DSP projects were rejected and did not influence the proposals. GitHub stars are a volatile discovery signal, not a quality metric. Copyleft or unclear licenses are evidence sources only; no implementation should be copied without a separate license review.

## What the strongest projects do

### Detection and tuning

- [thetwom/Tuner](https://github.com/thetwom/Tuner) combines spectrum, phase-difference refinement, polynomial fitting, harmonic grouping, inharmonicity modeling, configurable windows/overlap and extensive numerical tests.
- [x42/tuna.lv2](https://github.com/x42/tuna.lv2), [Lingot](https://github.com/ibancg/lingot), [aubio](https://github.com/aubio/aubio), [sevagh/pitch-detection](https://github.com/sevagh/pitch-detection) and [librosa](https://github.com/librosa/librosa) separate candidate generation, confidence/periodicity and temporal selection instead of treating one frame estimate as final truth.
- [billthefarmer/tuner](https://github.com/billthefarmer/tuner) exposes note/octave filters, focused spectrum, result lock, multiple simultaneous results, input filters, 32 temperaments and custom temperament loading.
- [Cythara](https://github.com/gstraube/cythara) keeps a deliberately small tuner UI but validates exact visual states with bitmap comparisons.
- [stringSync](https://github.com/konLiogka/stringSync) documents an important product truth: selected-string/manual mode is materially more reliable than unconstrained automatic mode when harmonics cause octave jumps.

### Temperament and interoperability

- [Lingot](https://github.com/ibancg/lingot) supports Scala `.scl` files for microtonal tuning.
- [Scale Workshop](https://github.com/SeanArchibald/scale-workshop) supports ratios, cents, arbitrary EDO steps, non-octave periods, `.scl`, `.kbm`, `.tun`, MIDI microtuning, URL sharing and multiple synth/export formats.
- [Wilsonic MTS-ESP](https://github.com/marcus-w-hobbs/Wilsonic-MTS-ESP) shows a clean model boundary for editable tuning systems and a single state owner for plugin automation.
- [Helio](https://github.com/helio-fm/helio-sequencer), [MuseScore](https://github.com/musescore/MuseScore), [alphaTab](https://github.com/CoderLine/alphaTab) and [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) demonstrate that musical interchange formats need explicit parsers, versioned models and round-trip tests.

### Practice and ear training

- [OpenEar](https://github.com/ShacharHarshuv/open-ear) has independent exercise definitions, playback, state/evaluation, settings and optional adaptive scheduling. It trains scale degrees, chord functions, progressions, inversions and notes over chords, not only isolated absolute notes.
- [Nootka](https://github.com/SeeLook/nootka) combines microphone pitch input, notation exercises, custom exercise rules, result charts and MusicXML import.
- [Prelude](https://github.com/BHSPitMonkey/Prelude) accepts on-screen and MIDI answers, works offline and separates sight-reading, perfect-pitch and free-play modes.
- [Tuitar](https://github.com/orhun/tuitar) reuses live pitch detection for fretboard tracking, random-note games, scales and song practice.
- [Pianalyze](https://github.com/leandrodaf/pianalyze) and [SightKick](https://github.com/tonygoldcrest/sightkick) demonstrate per-note grading, looped sections, adjustable speed, difficulty levels and importable practice material.

### Metronome and realtime UX

- [Tack](https://github.com/patzly/tack-android) uses a dedicated low-latency audio engine and supports latency correction, count-in, duration, tempo increase, muted beats, swing, polyrhythm, song presets, visual flash and Wear OS.
- [metro](https://github.com/indiebubbler/metro) focuses on speed training, tempo ranges, polyrhythms and local preset import/export.
- [Tone.js](https://github.com/Tonejs/Tone.js) keeps music scheduling on the audio timeline rather than binding it to UI timers.

## Current Tuner gap matrix

| Capability | Current state | Competitive reading |
|---|---|---|
| Shared deterministic DSP core | **Strong** | Rust native/WASM parity and current telemetry are a real differentiator. Preserve this. |
| Live algorithm explainability | **Strong** | The block graph, live result, timeline, freeze/replay and A/B workspace go beyond most consumer tuners. |
| Real-instrument accuracy evidence | **Partial** | A 19-capture guitar/bass/ukulele/violin/voice corpus blocks CI with temporal thresholds; controlled rooms, SNR/reverb transforms and statistical sample sizes remain. |
| Automatic vs selected-string tuning | **Partial** | Both exist, but the UI does not clearly communicate the accuracy advantage and fallback behavior of constrained mode. |
| Harmonic/octave handling | **Partial** | YIN/MPM arbitration, octave telemetry and corpus gates exist; top-K candidate lattice, calibrated uncertainty and broader stress evidence do not. |
| Stage/fullscreen/compact layouts | **Partial-to-strong** | These modes exist, but active sessions cannot hold a screen wake lock and true strobe behavior remains incomplete. |
| Instrument/tuning presets | **Strong** | Broad preset coverage, profiles, capo, transpose and per-string offsets are already present. |
| Custom temperament editor | **Partial** | Limited to 12 integer cent offsets in `[-50, 50]`; no ratios, arbitrary degree count, period or standard files. |
| Scala/MIDI/MusicXML interoperability | **Missing** | Repository-wide search finds no `.scl`, `.kbm`, `.tun`, Web MIDI or MusicXML path. |
| Ear training | **Weak** | `useEarTraining.ts` generates one note and `EarTrainingPanel.vue` relies on manual Correct/Miss buttons. |
| Practice analytics | **Basic** | Attempts, accuracy, streak and JSON export exist; no mistake model, weak-item scheduling or detector-validated exercise. |
| Metronome timing | **Weak** | `useMetronome.ts` uses `window.setInterval`; there is no audio-clock lookahead or jitter test. |
| Audio output ownership | **Weak** | Reference tone, ear exercise and metronome lifecycles can overlap and own separate oscillator/context behavior. |
| Visual regression coverage | **Partial** | Synthetic Playwright behavior exists, but not a deterministic state/theme/locale screenshot matrix. |
| Privacy/offline | **Strong** | Local-first profiles, PWA behavior and no-account operation should remain a product principle. |

## Final Top 50 synthesis

`G#` identifiers are research candidates. An item that already has an `M#`, `X#` or `R#` reference should strengthen or regroup that item, not create a duplicate canonical backlog row.

### A. Detection accuracy and realtime pipeline

| G# | Pri | Proposal | Evidence and relation |
|---|---|---|---|
| G1 | P0 | Build a licensed real-WAV fixture corpus with every standard string plus bass, ukulele, violin and voice; annotate attack, stable sustain and release. | **Baseline delivered 2026-07-18:** 19 redistributable captures, exact source/output hashes, transforms, licenses and phase annotations cover all requested groups. More performers, devices, dynamics and environments remain. |
| G2 | P0 | Make release metrics tuner-specific: time-to-first-correct, false-lock duration, reacquisition latency, note switches/second and stable-sustain cents MAE by scenario. | **Blocking single-note gate delivered 2026-07-18:** pure `pitch-core::quality`, seven metric/threshold tests, versioned manifests, effective thresholds in JSON and CI artifact run across G1. Reacquisition transition captures, statistical non-regression and SNR buckets remain under G9/G10/G50. |
| G3 | P0 | Introduce a top-K candidate lattice carrying Hz, score, source, lag/bin and harmonic relation through arbitration and tracking. | `X8`; follows pYIN/YAAPT-style separation and prevents each detector from discarding alternatives too early. |
| G4 | P0 | Model `attack -> sustain -> release` explicitly and use phase-dependent windows, gates and hold rules. | `X6-X7`, related to `M12/M27`; plucked attack and low-string sustain should not share one policy. |
| G5 | P0 | Replace scalar confidence semantics with a quality vector: periodicity, voicing, harmonic fit, detector agreement, level and explicit unresolved reason. | `X3-X5/X9`; UI derives a calm state, while diagnostics preserve the evidence. |
| G6 | P0 | Complete the harmonic octave guard with subharmonic hypotheses, harmonic-energy ratio and fit residual, then validate every correction against the corpus. | Promotes `M4/M9` and `X27`; inspired by thetwom/Tuner, SWIPE, Lingot and x42 rather than a single hardcoded octave rule. |
| G7 | P1 | Make selected-string tuning an explicit **Precision** mode with constrained lag/frequency range and safe fallback, while keeping chromatic **Auto** mode honest about ambiguity. | Consolidates `M17/M55/M281`; stringSync's own documentation confirms why manual mode avoids octave jumps. |
| G8 | P1 | Move web capture cadence to AudioWorklet + sample-indexed ring buffer; make Worker/WASM consume complete windows independently of paint. | Promotes `M19/M69` and `X18-X20`; add overrun, gap and queue-depth telemetry. |
| G9 | P1 | Add a noise/reverb stress generator and a preprocessor pitch-bias gate before enabling high-pass, notch, downsample or denoise defaults. | `M10/M15`, `X15-X16`; every filter must prove it does not create cents or octave bias. |
| G10 | P1 | Create a differential lab against deterministic baselines and offline neural oracles, with metamorphic and statistical non-regression gates. | `X10-X12/X21-X22`; runtime stays Rust/WASM until an alternative wins the accuracy/latency/CPU Pareto comparison. |
| G11 | P1 | Record reproducible capture envelopes: PCM/WAV, sample index, device/sample rate, config revision, frame decisions and timing; replay them through every backend. | **Baseline delivered 2026-07-18:** Rust trace accepts WAV/f32 and exports sample-indexed config/candidate/decision JSON; hidden web debug capture exports WebM plus settings/frame sidecar. Exact browser PCM, shared timebase, queue telemetry and every-backend parity remain. |
| G12 | P2 | Benchmark phase-difference spectral refinement and inharmonic harmonic regression as independent evidence sources, not unconditional replacements. | Promotes `M104/M114`; thetwom/Tuner demonstrates both, but acceptance still depends on G1-G2. |

### B. Professional tuner workflows

| G# | Pri | Proposal | Evidence and relation |
|---|---|---|---|
| G13 | P1 | Turn the Algorithm workspace into a safe parameter lab for window size/type, overlap/hop, detector thresholds and range, with reset, versioned presets and replayed comparison. | thetwom/Tuner exposes these controls; keep them out of the beginner Tuner screen and validate every value before it reaches DSP. |
| G14 | P1 | Acquire Screen Wake Lock only while an active tuner/stage session requests it; release on stop, hide or error and show capability status. | New grounded gap from billthefarmer/Tuner and stage tools; complements rather than contradicts power-saving `M80`. |
| G15 | P1 | Add generic allowed-note and octave filters independent of string presets. | New candidate from billthefarmer/Tuner; useful for voice, winds, accordion and narrow-range diagnostics. |
| G16 | P1 | Add a focused spectrum mode centered on the selected/detected note with harmonic markers, noise floor and candidate peaks. | Extends current diagnostics and `M420`; billthefarmer/Tuner makes zoom a direct workflow, not a separate developer chart. |
| G17 | P1 | Let users pin the last reliable live result with timestamp, target, Hz/cents and one-click copy/export, clearly marked as frozen. | Extends `M484`; diagnostics freeze already proves the interaction, but the primary tuner needs a user-facing version. |
| G18 | P1 | Finish guided all-string tuning: auto-advance only after a stable hold, allow back/skip, show completion and record time-to-tune per string. | Consolidates `M38/M310/M483`; do not advance on a single transient frame. |
| G19 | P2 | Persist capture profiles per input device with range/gate/gain hints and expose actual sample rate, queue health and measured latency. | Combines `M82/M397`; professional users need to know which interface/profile is active. |
| G20 | P2 | Implement a true continuously moving strobe whose direction and speed encode cents, with reduced-motion and high-contrast alternatives. | Promotes `M235`; directly addresses current `R257`, where the strobe snaps between static offsets. |
| G21 | P3 | Add an optional multi-result analyzer for accordion/free-reed/piano service, showing up to N stable fundamentals without changing the monophonic default. | New specialist candidate from billthefarmer/Tuner. Gate it behind a separate analyzer because polyphonic scope and CPU cost are substantial. |
| G22 | P2 | Define direct-input/contact-pickup and tuner-out workflows: channel selection, noise profile, mute/passthrough and stage-safe status. | Consolidates `M341/M362/M482`; microphone and electrical input should not pretend to have identical constraints. |

### C. Temperament and format interoperability

| G# | Pri | Proposal | Evidence and relation |
|---|---|---|---|
| G23 | P0 | Add strict Scala `.scl` import/export that preserves descriptions, ratios and cents instead of flattening everything to rounded offsets. | New high-value gap evidenced by Lingot and Scale Workshop. Start here because `.scl` is compact and tuner-relevant. |
| G24 | P1 | Add separate `.kbm` mapping and AnaMark `.tun` adapters behind a common `TuningFormatAdapter` boundary. | New candidate from Scale Workshop; parsers should return diagnostics and never mutate the library until preview is accepted. |
| G25 | P1 | Evolve `Temperament` into a scale definition with arbitrary degree count, ratio-or-cents intervals and an explicit period that may be non-octave. | New domain correction. Preserve a 12-note offset facade so current presets/UI migrate incrementally. |
| G26 | P1 | Generalize calibration from only A4 to `{referenceNote, referenceFrequency}` and support movable tonic/Sa plus historical pitch presets. | Extends `M201/M251/M436`; required for non-12-EDO and culturally correct notation. |
| G27 | P2 | Encode a custom tuning/scale into a versioned, checksummed local-only share URL with import preview and size limits. | Extends `M154/M326`; follows Scale Workshop's useful collaboration workflow without accounts or a backend. |
| G28 | P1 | Build format conformance fixtures, property/round-trip tests and provenance metadata for every imported scale or tuning pack. | Extends `M248/M301`; malformed files must produce line-level errors, not partially corrupted library state. |

### D. Ear training and deliberate practice

| G# | Pri | Proposal | Evidence and relation |
|---|---|---|---|
| G29 | P0 | Replace manual Correct/Miss self-reporting with an answer model and explicit answer controls; record chosen answer, correct answer, response time, replay count and mistakes. | Current `EarTrainingPanel.vue` cannot verify learning. Prelude and OpenEar show the minimum credible interaction. |
| G30 | P0 | Introduce a small exercise domain: `ExerciseDefinition`, `Question`, `PlaybackPlan`, `AnswerEvaluator`, `Scheduler` and persistence ports, with UI as an adapter. | New architectural candidate from OpenEar. It prevents every future exercise from expanding `useTuner.ts`. |
| G31 | P1 | Add functional scale-degree training established by cadence/drone, with key/mode and chromatic-degree settings. | New learning mode from OpenEar and birdears; more transferable than random isolated-note guessing. |
| G32 | P1 | Add chord quality, chord function, common progression and triad inversion exercises as independent definitions over the same engine. | New product family from OpenEar; reuse one playback/evaluation contract rather than four bespoke panels. |
| G33 | P1 | Add microphone-validated "sing/play this note" exercises that require a stable hold inside tolerance and reject octave-wrong answers explicitly. | Extends `M314/M392/M418`; directly reuses the core competency of this project. |
| G34 | P1 | Schedule weak notes/intervals after mistakes using short-interval skill mastery, with a heatmap and transparent reset; do not apply generic FSRS blindly. | New candidate informed by OpenEar's adaptive code and its own caveat that long-term flashcard scheduling may not fit perceptual skill. |
| G35 | P2 | Add versioned exercise profiles for answer set, key, octave range, instrument sound, cadence, replay policy, auto-next and difficulty. | New candidate from OpenEar/Piano Trainer; profiles make tests and progress comparable. |
| G36 | P2 | Reuse pitch detection for a live fretboard mapper plus focused random-note and scale-position drills. | Extends `M231/M314`; Tuitar demonstrates that this can stay local and instrument-specific. |
| G37 | P2 | Add Web MIDI as an answer-input adapter with accessible on-screen fallback, connection status and deterministic fake-device tests. | Extends `M290` beyond tuning; Prelude and Piano Trainer show the interaction value. |
| G38 | P2 | Import MIDI/MusicXML into a bounded practice plan with section markers, loop range and tempo; keep score parsing outside the exercise engine. | New candidate from Nootka, Pianalyze and SightKick; start with monophonic material and explicit unsupported-feature errors. |
| G39 | P2 | Add a long-tone intonation coach for bowed strings, winds and voice: stable-hold timer, drift, wobble and release summary by note. | Consolidates `M392/M418`; it uses the existing cents timeline more naturally than generic gamification. |

### E. Metronome and audio output

| G# | Pri | Proposal | Evidence and relation |
|---|---|---|---|
| G40 | P0 | Replace `window.setInterval` tick generation with an AudioContext-time lookahead scheduler or sample-clock worklet; UI follows scheduled beat events. | New correctness issue grounded in `web/src/composables/useMetronome.ts`. Tone.js and serious metronomes keep musical time off the UI timer. |
| G41 | P1 | Add audio/visual latency calibration and persist the offset per output device; test that visual flash and click align after compensation. | New candidate from Tack; latency is perceptible in practice even when average BPM is correct. |
| G42 | P1 | Add count-in, duration/stop timer and interval-based tempo ramp for deliberate speed training. | New candidate from Tack and metro; more useful than decorative metronome themes. |
| G43 | P1 | Add editable accent/mute patterns, swing ratios and a bounded two-track polyrhythm mode. | Extends thin `M307`; Tack/metro demonstrate the expected control model. |
| G44 | P2 | Add local metronome programs/song presets with reorder, duplicate, import/export and optional tuning link. | New candidate from Tack/metro; a preset may bind BPM, meter, accents, count-in and the tuning used for the song. |
| G45 | P1 | Create one output-audio service and mixer for reference tones, ear exercises and metronome, with cancellable playback scopes and one resumed AudioContext. | Addresses `R195/R196`; prevents overlapping oscillators and divergent lifecycle bugs while preserving independent feature APIs. |

### F. Architecture, testing and product discipline

| G# | Pri | Proposal | Evidence and relation |
|---|---|---|---|
| G46 | P0 | Continue splitting `useTuner.ts` into feature application services; make Tuner, Practice, Library, Analysis and Algorithm depend on narrow typed ports, not one flattened root object. | Promotes existing architecture findings. OpenEar's separate exercise state/player and mducharme/Tuner's injected audio/detector ports reinforce the direction. |
| G47 | P1 | Introduce explicit capability ports for microphone, AudioWorklet, native stream, MIDI, Wake Lock, fullscreen and file formats, each with availability and failure reasons. | New cross-cutting boundary. UI should render capabilities, not probe globals ad hoc. |
| G48 | P1 | Version domain schemas independently for settings, tuning packs, scales, exercises and practice events; imports execute as validate-preview-commit transactions. | Extends `M83/M328/M375`; avoids one giant settings schema controlling unrelated feature evolution. |
| G49 | P1 | Add deterministic visual-regression scenarios for `idle/flat/in-tune/sharp/ambiguous/error` across mobile/desktop, RU/EN, themes, reduced motion and high contrast. | Extends `M176`; Cythara proves pitch UI can be golden-tested, while current synthetic fixtures can drive richer states. |
| G50 | P1 | Publish one release scorecard covering accuracy, false locks, latency, metronome jitter, audio deadline misses, CPU, memory, bundle size, accessibility, format round-trips and license provenance. | Consolidates `X21-X24/M94/M187`; prevents a visually attractive feature from silently degrading the actual instrument tool. |

## What not to copy

1. **Do not build a giant song/tab catalog.** GuitarTuna's catalog is a content, licensing, moderation and editorial business. A local MIDI/MusicXML practice importer is achievable and aligned with the repository.
2. **Do not require accounts for custom tunings or progress.** Fender's account-backed custom tuning is convenient for cloud sync, but local export/share URLs preserve Tuner's privacy advantage.
3. **Do not ship neural F0 in runtime before G1-G2 and G10.** Use neural models as offline oracles first; bundle and CPU cost require measured benefit.
4. **Do not expose every DSP knob on the primary tuner.** Advanced controls belong in Algorithm with presets, validation, replay and reset.
5. **Do not treat strobe as a skin.** A true strobe is a motion/phase instrument; a snapping striped background damages trust.
6. **Do not add multi-note detection to the monophonic default.** It is a specialist analyzer with different accuracy and compute expectations.
7. **Do not clone copyleft code into pitch-core.** Reimplement from papers/specifications and preserve source/license provenance.

## Suggested delivery waves

1. **Evidence first:** G1-G2, G5, G10-G11 and G50.
2. **Fix the reported chaos:** G3-G9, then G12 only if benchmarks justify it.
3. **Professional interoperability:** G23-G28 plus G14-G18.
4. **Practice foundation:** G29-G35, then microphone/MIDI/score adapters G33 and G36-G39.
5. **Metronome credibility:** G40-G45.
6. **Specialist expansion:** G19-G22 after the primary tuning path is demonstrably stable.

## Commercial product check

- [GuitarTuna](https://guitartuna.com/about) combines tuner, metronome, chord library, ear trainer, song player and lessons across many instruments. Its breadth validates practice adjacency, not a requirement to copy its catalog.
- [Fender Tune](https://apps.apple.com/us/app/fender-tune-guitar-tuner-app/id1107017950) emphasizes Auto and Manual modes plus saved custom tunings. This supports making constrained/manual accuracy explicit.
- [Peterson iStroboSoft](https://www.petersontuners.com/products/istrobosoft/) emphasizes true strobe behavior, sweetened tunings, noise filtering and contact pickups. This supports G6, G20 and G22.
- [BOSS Tuner](https://www.boss.info/us/products/boss_tuner_app/) succeeds through a focused, familiar hardware-like display. It is evidence that clarity and trust can beat feature count on the primary screen.

## Representative source shortlist

The proposals above were most influenced by these repositories; the full screened universe is intentionally not copied into the canonical backlog:

- **Pitch/DSP:** [aubio](https://github.com/aubio/aubio), [librosa](https://github.com/librosa/librosa), [TarsosDSP](https://github.com/JorenSix/TarsosDSP), [CREPE](https://github.com/marl/crepe), [pitchy](https://github.com/ianprime0509/pitchy), [sevagh/pitch-detection](https://github.com/sevagh/pitch-detection), [fastF0Nls](https://github.com/jkjaer/fastF0Nls), [x42/tuna.lv2](https://github.com/x42/tuna.lv2).
- **Tuner products:** [thetwom/Tuner](https://github.com/thetwom/Tuner), [Lingot](https://github.com/ibancg/lingot), [FMIT](https://github.com/gillesdegottex/fmit), [billthefarmer/tuner](https://github.com/billthefarmer/tuner), [Cythara](https://github.com/gstraube/cythara), [ZenTuner](https://github.com/jpsim/ZenTuner), [Chroma](https://github.com/adrielcafe/chroma), [stringSync](https://github.com/konLiogka/stringSync), [mducharme/Tuner](https://github.com/mducharme/Tuner).
- **Practice/education:** [OpenEar](https://github.com/ShacharHarshuv/open-ear), [Nootka](https://github.com/SeeLook/nootka), [Prelude](https://github.com/BHSPitMonkey/Prelude), [Piano Trainer](https://github.com/ZaneH/piano-trainer), [Tuitar](https://github.com/orhun/tuitar), [Pianalyze](https://github.com/leandrodaf/pianalyze), [SightKick](https://github.com/tonygoldcrest/sightkick), [birdears](https://github.com/birdears/birdears).
- **Timing/realtime:** [Tack](https://github.com/patzly/tack-android), [metro](https://github.com/indiebubbler/metro), [Tone.js](https://github.com/Tonejs/Tone.js), [Web Audio API](https://github.com/WebAudio/web-audio-api), [ringbuf.js](https://github.com/padenot/ringbuf.js).
- **Theory/formats/UI:** [Scale Workshop](https://github.com/SeanArchibald/scale-workshop), [tonal](https://github.com/tonaljs/tonal), [alphaTab](https://github.com/CoderLine/alphaTab), [react-guitar](https://github.com/4lejandrito/react-guitar), [MuseScore](https://github.com/musescore/MuseScore), [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay), [Helio](https://github.com/helio-fm/helio-sequencer).
