# Recommendations From README And Architecture Review

Документ превращает `README.md` и `ARCHITECTURE.md` в практические рекомендации: что делать дальше, в каком порядке, какой риск закрываем и как понять, что шаг завершен. Фокус тот же: модульность, разбиение кода, слабая зацепленность, предсказуемые контракты.

## Executive Summary

Главная рекомендация: не начинать с большого переезда в workspace. Сначала сделать границы реальными внутри текущего проекта, покрыть их тестами, а уже потом физически переносить код.

Порядок:

1. Зафиксировать текущее поведение тестами.
2. Вынести pure core: pitch, music, practice summary.
3. Ввести порты: audio, storage, profile transfer.
4. Разрезать `useTuner` на application controllers.
5. Разрезать UI на feature screens.
6. Ввести versioned full profile import/export.
7. Синхронизировать web/Tauri/egui через общий registry/parity tests.
8. Только после этого думать о workspace migration.

## Recommendation Matrix

| Priority | Recommendation | Main Risk Closed | Expected Impact |
| --- | --- | --- | --- |
| P0 | Freeze behavior with tests | Refactor regressions | Можно безопасно резать модули |
| P0 | Extract practice summary module | Быстрый win, меньше `useTuner` | Первый безопасный срез controller logic |
| P0 | Split `core/pitch` | Performance logic coupling | Чистый pitch API и conformance base |
| P0 | Split `core/music` | Domain god-file | Чистая музыкальная модель |
| P1 | Introduce `AudioInputPort` | Backend leakage into UI | Новый backend без каскада правок |
| P1 | Create `TunerSessionController` | Lifecycle spread | Единый start/stop/restart/status |
| P1 | Add versioned `UserProfileV1` | Storage schema drift | Полный backup/migrations |
| P1 | Split app controllers | `useTuner` god-object | Модули по workflows |
| P2 | Split feature screens | UI overcrowding/coupling | Tune/Practice/Library/Settings boundaries |
| P2 | Add preset parity tests | web/egui drift | Один truth source для instruments/tunings |
| P2 | Split Rust native audio service | Tauri command god-module | Тестируемый native layer |
| P3 | Workspace migration | Physical structure drift | Механический переезд после стабилизации |

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

### 4. Split Music Core

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

1. Сначала вынести types и note math.
2. Затем registry data: instruments, tunings, temperaments, sweetening.
3. Затем selection helpers: closest string, detection range hints.
4. Потом pure `calculateTuningState`.
5. Оставить compatibility exports.

**Definition Of Done**

- Music core тестируется без Vue.
- Добавление нового tuning не требует правки engine logic.
- `useTuningState` начинает использовать pure functions, а не держит все вычисления внутри composable.

## P1 Recommendations

### 5. Introduce AudioInputPort

**Problem**

`useTuner` знает про web audio and native audio одновременно. UI вынужден учитывать `usingNativeAudio` и наличие analyser.

**Recommendation**

Создать audio port and adapters. Это главный шаг к weak coupling audio layer.

**Target Files**

```text
web/src/ports/audioInput.ts
web/src/adapters/audio/webAudioInput.ts
web/src/adapters/audio/tauriNativeAudioInput.ts
web/src/application/createTunerSession.ts
```

**Recommended Contract**

```ts
interface AudioInputPort {
  readonly kind: 'web' | 'native';
  readonly capabilities: {
    analyser: boolean;
    inputDeviceSelection: boolean;
    native: boolean;
  };
  start(options: { range: PitchDetectionRange; deviceId?: string }): Promise<void>;
  stop(): Promise<void>;
  setRange(range: PitchDetectionRange): Promise<void>;
  subscribe(listener: (event: AudioInputEvent) => void): () => void;
}
```

**Definition Of Done**

- `useTuner` не вызывает `useAudioInput` и `useNativeAudioInput` напрямую.
- UI получает `capabilities`, а не проверяет native backend руками.
- Добавление третьего backend требует новый adapter, а не переписывание tuning/practice UI.

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

### 14. Consider Rust/WASM Pitch Core After Parity

**Problem**

TS/Rust pitch duplication can drift. But moving to WASM too early may slow product iteration.

**Recommendation**

First add fixtures and parity. Then decide:

- keep TS+Rust with conformance tests;
- or move pitch core to Rust and expose WASM.

**Definition Of Done**

- Decision is data-driven: performance and correctness measurements exist.
- No rewrite just for architecture aesthetics.

## Recommended Next 8 Commits

1. `Add practice summary tests`
2. `Extract practice summary helpers`
3. `Split pitch range and smoothing modules`
4. `Split pitch detector module`
5. `Split music note math and registry data`
6. `Add audio input port contract`
7. `Move tuner lifecycle into session controller`
8. `Add versioned user profile schema`

This sequence gives fast safety, reduces `useTuner`, and builds real boundaries before any workspace movement.

## What Not To Do Next

- Do not move to `packages/` before tests and compatibility exports.
- Do not rewrite the UI while `useTuner` is still a god-object.
- Do not add more features into `notes.ts` or `useTuner.ts`.
- Do not add more native Tauri commands without a service boundary.
- Do not add new presets separately in web and egui without parity protection.

## Success Metrics

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
