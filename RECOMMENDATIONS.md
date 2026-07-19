# Recommendations From README And Architecture Review

Документ превращает `README.md` и `ARCHITECTURE.md` в практические рекомендации: что делать дальше, в каком порядке, какой риск закрываем и как понять, что шаг завершен. Фокус тот же: модульность, разбиение кода, слабая зацепленность, предсказуемые контракты.

Problem sources: [recommendation.md](recommendation.md) is the current extract (317 open/partial and 77 closed stable `R#` items), while the unified [TOP-500-backlog.md](TOP-500-backlog.md) contains the full ranked `M#` Top 500, verified `[DONE]` markers and historical detailed `C#` evidence. This file keeps detailed implementation recipes; [PLAN.md](PLAN.md) is the execution-order source of truth.

**Status 2026-07-19:** session state machine, native realtime queue, pitch-core split/trait/resolver, contextual native/browser `DetectionFrame`, full-frame WASM `TunerProcessor`, measured fallback confidence, generated note math, egui/Tauri decomposition, profile V1, feature screens/ports, offline SW, licensed 19-WAV quality gate, interactive file/WAV input and exact shared browser PCM capture are implemented. Recipes below that describe those items are historical implementation guidance; use the matrix status and PLAN overlay before starting work.

## Executive Summary

Главная рекомендация: не начинать с большого переезда в workspace. Сначала сделать границы реальными внутри текущего проекта, покрыть их тестами, а уже потом физически переносить код.

Актуальный порядок оставшейся работы:

1. Добавить автоматическое cross-backend сравнение sample-indexed Rust replay и browser PCM/WAV+JSON v2 envelope.
2. Разрезать selection/temperament части `useTuningState`, затем broad `useTuner`/global settings ownership.
3. Расширить лицензированный 19-WAV corpus фиксированными SNR/noise/reverb transforms и session-adapter parity.
4. Добавить benchmark/soak/permission/device-loss/visual suites и более широкий DSP fuzzing.
5. Ввести typed diagnostics/errors и завершить accessibility/release gates.
6. Убрать owned spectrum `Vec` из каждого enabled frame через отдельный recyclable transport.
7. Унифицировать power/harmonic flags для explicit TS fallback либо документировать capability contract.
8. Не делать физический workspace split без измеримой необходимости: текущие module/crate boundaries уже читаемы.

## Recommendation Matrix

| Status | Priority | Recommendation | Remaining Impact |
| --- | --- | --- | --- |
| Done baseline | P0 | Freeze behavior with tests | Real-audio core gate exists; extend to SNR/session failure/soak, not another harness rewrite |
| Done | P0 | Complete shared frame contract | Keep `FrameContext` wire tests and revisioned native configuration green |
| Done | P0 | Move native audio work off callbacks | Add error/drop telemetry only |
| Done pure layer | P0 | Extract practice summary | Move remaining challenge commands later |
| Done primary | P0 | Unify pitch core | Full-frame WASM and fallback confidence are gated; power flags still degrade in fallback |
| Done | P0 | Unify music/note domain | Registry data plus one formula AST generate Rust/TypeScript primitives and freshness/property gates |
| Done | P0 | Introduce TS `AudioInputPort` | Web/native/synthetic/file registry, exact-capture capability and tests remove concrete session branching |
| Done | P1 | Create session lifecycle controller | Maintain adapter contract tests |
| Done | P1 | Add `UserProfileV1` | Add V2 migration only when needed |
| Partial | P1 | Split app controllers | Tuning/settings/root remain broad |
| Done | P2 | Split feature screens | Keep ports narrow as features grow |
| Done guard | P2 | Add preset parity tests | Replace guard with codegen by construction |
| Done | P2 | Split Rust native audio service | Add recovery diagnostics |
| Deferred | P3 | Further workspace migration | No current benefit over existing crates/modules |

## P0 Recommendations

### 1. Freeze Current Behavior Before Refactoring

**Problem**

Проект уже работает, но deep refactor будет менять границы файлов и ответственность модулей. Без тестов легко сломать tuner behavior, import/export или backend fallback.

**Recommendation**

Перед крупным переносом кода добавить минимальный safety net:

- pitch fixtures: silence, E2, A4, B0, E5, noisy signal, wrong range;
- practice summary/streak tests;
- custom tuning import validation tests;
- settings load/save smoke;
- browser smoke checklist for main page render.

**Implementation Steps**

1. Расширить `web/scripts/test-core.mjs` или разбить его на несколько suites.
2. Добавить fixture helpers вместо ad hoc sine buffers в каждом тесте.
3. Проверять не только happy path, но и invalid input.
4. Описать smoke checklist в `ARCHITECTURE.md` или рядом с tests.

**Definition Of Done**

- `npm run test` проверяет pitch, music basics, practice summary, custom import.
- Ошибка в detection range, tuning import или streak logic ловится тестом.
- Refactor можно начинать с понятной страховкой.

### 2. Extract Practice Summary First

**Problem**

`useTuner.ts` содержит practice history summary, daily streak, export stats и mark logic. Это не tuner session logic, а отдельный practice workflow.

**Recommendation**

Вынести practice pure logic и controller первым. Это маленький, безопасный шаг, который сразу уменьшит `useTuner`.

**Target Files**

```text
web/src/core/practice/practiceSummary.ts
web/src/application/createPracticeController.ts
web/src/composables/useTuner.ts
```

**Implementation Steps**

1. Вынести `summarizePractice`, `calculateDailyStreak`, `dayNumber`, `localDateKey`.
2. Добавить pure tests на empty history, today, yesterday, broken streak, multi-day streak.
3. Вынести `exportPracticeStats`.
4. Затем вынести `markEarTraining` в controller, оставив в `useTuner` только wiring.

**Definition Of Done**

- Practice summary тестируется без Vue.
- `useTuner.ts` потерял блок practice helpers.
- Existing `PracticeStatsPanel` behavior не изменился.

### 3. Split Pitch Core

**Problem**

`web/src/utils/pitch.ts` содержит stats, detector, fallback autocorrelation, range normalization, buffers, smoother and level normalization. Это слишком много для одного module boundary.

**Recommendation**

Разрезать pitch logic на чистые модули, сохранив old imports через compatibility export.

**Target Files**

```text
web/src/core/pitch/ranges.ts
web/src/core/pitch/signalStats.ts
web/src/core/pitch/detectPitch.ts
web/src/core/pitch/smoothing.ts
web/src/core/pitch/level.ts
web/src/utils/pitch.ts
```

**Implementation Steps**

1. Перенести `PitchDetectionRange`, default range, `normalizePitchDetectionRange`.
2. Перенести `computeSignalStats`.
3. Перенести YIN/autocorrelation в `detectPitch.ts`.
4. Перенести `FrequencySmoother`.
5. Оставить `utils/pitch.ts` как re-export.
6. Проверить worker imports.

**Definition Of Done**

- `core/pitch` не импортирует Vue/DOM/Tauri.
- Worker и tests проходят через public pitch API.
- `npm run test` и `npm run build` зеленые.

### 4. Split Music Core (Registry Implemented)

**Problem**

`web/src/utils/notes.ts` является самым важным domain module и одновременно самым рискованным god-file.

**Recommendation**

Разделить music domain по смыслу, но не менять public API за один коммит. Старый `notes.ts` должен временно re-export'ить новые модули.

**Target Files**

```text
web/src/core/music/types.ts
web/src/core/music/noteMath.ts
web/src/core/music/temperaments.ts
web/src/core/music/instruments.ts
web/src/core/music/tunings.ts
web/src/core/music/sweetening.ts
web/src/core/music/selection.ts
web/src/core/music/tuningEngine.ts
web/src/utils/notes.ts
```

**Implementation Steps**

1. Types и generated note math вынесены; держать compatibility facade тонким. [DONE 2026-07-11]
2. Registry data для notes/instruments/tunings уже живёт в `registry/music-registry.json`; temperaments/sweetening остаются следующим data slice.
3. Затем selection helpers: closest string, detection range hints.
4. Потом pure `calculateTuningState`.
5. Оставить compatibility exports.

**Definition Of Done**

- Music core тестируется без Vue.
- Добавление нового tuning не требует правки engine logic.
- `useTuningState` начинает использовать pure functions, а не держит все вычисления внутри composable.

## P1 Recommendations

### 5. Introduce AudioInputPort (Implemented)

**Problem**

Исторически session orchestration знала разные lifecycle APIs web/native/synthetic adapters и ветвилась по backend name. Теперь file adapter использует тот же lifecycle, а exact PCM capture сужается отдельной capability.

**Recommendation**

Реализовано: discriminated audio port разделяет raw `audio-frame` и resolved `detection-frame` capabilities. `useTunerSession` выбирает port из registry и управляет общим lifecycle; backend-specific analyser/device capabilities остаются на web adapter.

**Target Files**

```text
web/src/ports/audioInput.ts
web/src/ports/audioInput.ts
web/src/composables/useAudioInput.ts
web/src/composables/useFileAudioInput.ts
web/src/composables/useNativeAudioInput.ts
web/src/composables/useSyntheticAudioInput.ts
web/src/composables/useTunerSession.ts
web/src/audio/sampleTimeline.ts
web/src/audio/wav.ts
```

**Recommended Contract**

```ts
interface AudioInputPortBase {
  readonly id: 'web' | 'native' | 'synthetic' | 'file';
  readonly output: 'audio-frame' | 'detection-frame';
  readonly available: ReadableValue<boolean>;
  readonly isListening: ReadableValue<boolean>;
  start(options: { range: PitchDetectionRange }): Promise<boolean>;
  stop(): Promise<void>;
}
```

**Definition Of Done**

- Web/native/synthetic/file adapters проходят общий lifecycle/session suite.
- Session сужает capabilities по `output`, а не вызывает backend-specific start/stop branches.
- Exact PCM capture доступен через отдельную capability и не расширяет native resolved-frame port.
- Следующий input-quality шаг — device-loss/backend-switch E2E и cross-backend replay comparison.

### 6. Create TunerSessionController

**Problem**

Start/stop/restart/backend switching сейчас размазаны по `useTuner`. Ошибки lifecycle будут множиться: start во время stop, backend change во время listening, native unavailable fallback.

**Recommendation**

Вынести session lifecycle в controller с явными состояниями.

**Target State**

```ts
type TunerSessionStatus = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';
```

**Controller Responsibilities**

- start selected backend;
- stop current backend;
- restart on backend change;
- publish status/error/level/frequency;
- apply detection range changes;
- hide backend implementation from UI.

**Definition Of Done**

- Backend switching tested without component.
- `useTuner.start`, `useTuner.stop`, `setAudioBackend` are delegated to session.
- Session protects against duplicate starts.

### 7. Introduce Versioned UserProfile

**Problem**

Settings are a flat storage schema. Full backup is missing. Migration strategy is missing.

**Recommendation**

Add `UserProfileV1` and make localStorage/Tauri Store adapters load/save that shape.

**Target Files**

```text
web/src/core/profile/profileSchema.ts
web/src/core/profile/migrations.ts
web/src/core/profile/profileTransfer.ts
web/src/adapters/storage/localStorageProfileStore.ts
web/src/adapters/storage/tauriProfileStore.ts
```

**Profile Scope**

- music settings;
- display settings;
- audio backend preference;
- custom instruments;
- custom tunings;
- custom temperaments;
- string offsets/sweetening;
- practice history;
- metronome settings.

**Definition Of Done**

- One JSON export restores the same user state.
- Invalid import returns warnings, not silent corruption.
- Old flat keys can migrate into profile.

### 8. Split Application Controllers

**Problem**

`useTuner` is still the main coupling surface.

**Recommendation**

Turn `useTuner` into a composition root. Move workflow logic into controllers.

**Controllers**

```text
createTunerSession
createTuningController
createPracticeController
createMetronomeController
createDisplayController
createProfileController
```

**Definition Of Done**

- `useTuner.ts` under 100 lines.
- Each controller can be tested with fake ports/stores.
- Components depend on view model slices and commands.

## P2 Recommendations

### 9. Split Feature UI

**Problem**

One screen is overloaded: tuner, practice, metronome, temperament, custom library, display controls, import/export.

**Recommendation**

Introduce feature screens without changing visual behavior immediately.

**Target Structure**

```text
web/src/features/tuner/TunerScreen.vue
web/src/features/practice/PracticeScreen.vue
web/src/features/library/LibraryScreen.vue
web/src/features/settings/SettingsScreen.vue
```

**Definition Of Done**

- `App.vue` is shell/navigation/composition only.
- Feature screens receive only their slice of view model.
- Presentational components stay reusable.

### 10. Add Preset Parity Tests

**Problem**

Web and egui can drift. Presets were already synchronized manually once.

**Recommendation**

Create a single registry fixture or parity test.

**Options**

1. Shared JSON registry generates/feeds web and egui.
2. Keep separate code but test exported lists against fixture.

**Definition Of Done**

- Adding a new instrument/tuning fails CI unless parity is updated.
- egui README clearly states which features are intentionally not in parity.

### 11. Split Rust Native Audio Service

**Problem**

`native_audio.rs` contains command handling, service state, stream creation, conversion and DSP.

**Recommendation**

Split internally first, crate later.

**Target Internal Shape**

```text
desktop/src-tauri/src/native_audio/
  mod.rs
  commands.rs
  service.rs
  stream.rs
  pitch.rs
  events.rs
```

**Definition Of Done**

- Tauri commands are thin wrappers.
- Stream service can be reasoned about separately.
- Pitch function has tests or parity fixtures.

### 12. Accessibility And UX Pass

**Problem**

Feature growth can make the app powerful but harder to scan and operate by keyboard.

**Recommendation**

Do accessibility after feature-screen split, but before workspace migration.

**Checklist**

- ARIA labels for selects/buttons;
- focus states visible;
- keyboard-only flow for tuner and practice;
- stage mode text size and contrast;
- colorblind theme contrast pass;
- no controls hidden only by color;
- compact mode no text overflow.

**Definition Of Done**

- Browser smoke checks main controls with keyboard.
- Stage/compact/light/colorblind screenshots pass visual inspection.

## P3 Recommendations

### 13. Workspace Migration Last

**Problem**

Moving files before boundaries are real creates churn without reducing coupling.

**Recommendation**

Only migrate to workspace when current code already behaves like packages.

**Preconditions**

- `core/music` and `core/pitch` exist;
- ports/adapters exist;
- controllers exist;
- profile schema exists;
- parity tests exist.

**Definition Of Done**

- Workspace migration is mostly path/package config changes.
- CI can run package-level checks.

### 14. Complete Rust/WASM Parity After Primary Convergence (Full Frame Implemented)

**Problem**

Rust/WASM `TunerProcessor` is the primary web-worker processor and TypeScript is an explicit fallback. B0-E5 detector behavior shares ranges, harmonics, DC-offset cases, cents budgets and normalized-periodicity confidence minimums; Rust and TypeScript smoothing share exact traces and clear-on-silence. Browser WASM now owns full-frame assembly, while fallback target resolution remains a presentation-side degraded path.

**Recommendation**

Extend the current manifests with real WAV/SNR cases and failure traces. Keep the fallback only while cents/confidence/smoothing gates remain green and its missing power capability remains explicit.

**Definition Of Done**

- `TunerProcessor` returns one resolved frame and clears detector policy state on silence/reset.
- Native/WASM/TS fixtures assert cents and confidence contracts; smoothing traces match exactly.
- Remaining extensions use real WAV/SNR evidence and keep fallback capability differences explicit.

## Recommended Next 8 Commits

1. `Compare sample-indexed replay across backends`
2. `Split tuning selection and temperament controllers`
3. `Inject the settings storage port`
4. `Add typed pipeline diagnostics`
5. `Add SNR fixtures and restart soak gates`
6. `Separate recyclable spectrum transport from detection frames`
7. `Unify fallback power capability semantics`
8. `Add release security and accessibility gates`

This sequence attacks the current P0/P1 open items first: session lifecycle, audio-port boundaries, remaining frame-contract drift, realtime safety and core modularity. Practice extraction is still useful, but it is no longer the first architectural blocker.

## What Not To Do Next

- Do not move to `packages/` before tests and compatibility exports.
- Do not rewrite the UI while `useTuner` is still a god-object.
- Do not add more features into `notes.ts` or `useTuner.ts`.
- Do not add more native Tauri commands without a service boundary.
- Do not add new presets separately in web and egui without parity protection.

## Success Metrics

- Visualizer components keep receiving only plain frame props.
- Shared `DetectionFrame` / viz frame contracts exist and the web readout path consumes them.
- egui and Tauri native callbacks do not lock engine state or allocate detector buffers.
- `useTuner.ts` under 100 lines.
- `notes.ts` becomes compatibility export only.
- `pitch.ts` becomes compatibility export only.
- Core tests run in Node without DOM/Vue/Tauri.
- Full profile export/import roundtrip test passes.
- Backend switching is tested with fake adapters.
- web and egui preset parity test passes.
- `App.vue` becomes shell, not feature implementation.

## Final Recommendation

Treat this as a migration, not a rewrite. The right rhythm is:

```text
test -> extract pure module -> keep compatibility export -> switch one caller -> verify -> commit
```

That rhythm keeps the app usable while steadily removing coupling.
