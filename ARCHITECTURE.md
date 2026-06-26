# Architecture And Deep Refactor Plan

Этот документ описывает, как мы бы спроектировали Tuner с нуля и как безопасно привести текущий проект к этой форме. Главный фокус: модульность, слабая зацепленность, ясные границы, тестируемость и возможность добавлять новые audio backend'ы, инструменты, темперации и режимы практики без каскада правок по всему UI.

## North Star

Проект должен быть устроен так, чтобы:

- музыкальная доменная логика не знала про Vue, Tauri, cpal, DOM, localStorage и canvas;
- audio backend был заменяемым адаптером с единым портом;
- UI работал с view model и commands, а не с низкоуровневыми backend details;
- storage был versioned profile layer, а не набором случайных ключей;
- web, Tauri и egui не расходились по пресетам и pitch behavior;
- каждый большой workflow имел свой controller и тесты.

## Current Coupling Map

Сейчас проект уже стал сильно лучше первой версии, но основные точки связанности такие:

- `web/src/composables/useTuner.ts` агрегирует почти все: lifecycle микрофона, backend selection, pitch source, tuning state, reference tone, practice history, metronome, UI prefs, export.
- `web/src/utils/notes.ts` смешивает note math, registry instruments/tunings, temperament math, sweetening profiles, import normalization и display helpers.
- `web/src/utils/pitch.ts` содержит detector, smoothing, signal stats и глобальные reusable buffers в одном модуле.
- `web/src/utils/settingsStorage.ts` одновременно знает storage backend, persisted schema и конкретные ключи всех features.
- `desktop/src-tauri/src/native_audio.rs` совмещает Tauri commands, cpal stream lifecycle, sample conversion, YIN implementation и event emission.
- `egui/src/main.rs` хранит UI, presets, audio capture и tuning logic рядом, поэтому parity с web легко теряется.

Это нормальная цена быстрого развития MVP. Следующий этап - не переписывать все, а стабилизировать границы и постепенно переносить код за эти границы.

## 10 Critics Review

### 1. Domain Architect

**Критика**

`notes.ts` стал "мешком домена": там типы, частоты, пресеты, темперации, sweetening, выбор ближайшей струны и display helpers. Такой файл трудно тестировать кусками и рискованно расширять.

**Как сделал бы с нуля**

Создал бы `core/music` как чистую библиотеку:

- `noteMath.ts`: note id, semitone math, frequency conversion, cents;
- `temperaments.ts`: registry, offsets, root rotation, validation;
- `tunings.ts`: tuning registry, custom tuning normalization;
- `instruments.ts`: instrument registry, default tuning lookup;
- `sweetening.ts`: per-string offsets;
- `selection.ts`: closest string, chromatic target, detection range hints;
- `tuningEngine.ts`: pure calculation from input state to output state.

**Правило**

`core/music` не импортирует Vue, browser APIs, Tauri APIs, storage, audio или components.

**Первый refactor**

Вынести note math и registry data из `notes.ts`, оставив old file как re-export compatibility layer.

### 2. Audio Systems Engineer

**Критика**

WebAudio и Tauri native audio отличаются на уровне деталей, но `useTuner` знает про оба. UI тоже знает, что native backend не имеет analyser.

**Как сделал бы с нуля**

Ввел бы единый порт:

```ts
type AudioBackendKind = 'web' | 'native';

interface AudioInputPort {
  readonly kind: AudioBackendKind;
  readonly capabilities: AudioInputCapabilities;
  start(options: AudioStartOptions): Promise<void>;
  stop(): Promise<void>;
  setRange(range: PitchDetectionRange): Promise<void>;
  subscribe(listener: (event: AudioInputEvent) => void): () => void;
}
```

События:

```ts
type AudioInputEvent =
  | { type: 'frame'; frame: Float32Array; sampleRate: number; level: number }
  | { type: 'frequency'; frequency: number | null; level: number }
  | { type: 'status'; status: 'idle' | 'starting' | 'listening' | 'stopping' }
  | { type: 'error'; message: string };
```

**Правило**

Tuner session знает только `AudioInputPort`. Web adapter может отдавать `frame + analyser`, native adapter может отдавать `frequency`, но UI видит только capabilities.

**Первый refactor**

Создать `web/src/ports/audioInput.ts` и адаптеры вокруг существующих `useAudioInput` и `useNativeAudioInput`, не переписывая UI сразу.

### 3. Performance Critic

**Критика**

Pitch detection вынесен в Worker, но YIN есть в TS и Rust отдельно. Это создает риск расхождения поведения между web и native.

**Как сделал бы с нуля**

Сделал бы один из двух вариантов:

- Rust `tuner-core` + WASM wrapper для web + native crate для Tauri/egui;
- или TS/Rust реализации с общими fixtures и conformance tests.

**Правило**

Любая реализация pitch detector должна проходить одинаковые fixtures: silence, E2, A4, B0, E5, noisy signal, wrong range, low RMS, octave confusion.

**Первый refactor**

Создать `fixtures/pitch` и тесты, которые проверяют текущий TS detector. Потом добавить Rust parity.

### 4. Frontend Composition Critic

**Критика**

`useTuner.ts` слишком много знает. Он не просто composition root, а application service, settings writer, practice recorder и backend switcher одновременно.

**Как сделал бы с нуля**

Разделил бы:

- `createTunerSession`: start/stop/restart/status/error/backend;
- `createTuningController`: tuning, instrument, temperament, target, cents;
- `createPracticeController`: ear training, history, streaks, export;
- `createMetronomeController`: tempo, beats, subdivision, tap tempo;
- `createDisplayController`: theme, layout, fullscreen, visualizer flags.

**Правило**

`useTuner` должен быть тонкой сборкой controllers и view model. Цель - меньше 100 строк.

**Первый refactor**

Вынести `summarizePractice`, `calculateDailyStreak`, `exportPracticeStats`, `markEarTraining` в `application/createPracticeController.ts`.

### 5. State Management Critic

**Критика**

`useSettings` построен на module-level refs. Это удобно, но затрудняет reset в тестах, несколько экземпляров приложения, migrations и predictable actions.

**Как сделал бы с нуля**

Сделал бы typed store:

```ts
interface AppState {
  profile: UserProfile;
  session: TunerSessionState;
  display: DisplayState;
}
```

И actions/selectors:

```ts
setInstrument(id)
setTuning(id)
selectTargetString(index)
setAudioBackend(kind)
importProfile(profile)
```

**Правило**

Feature controllers не должны напрямую мутировать чужие refs. Они вызывают actions.

**Первый refactor**

Сначала добавить action functions поверх текущих refs, затем заменить прямые записи в controllers.

### 6. Persistence Critic

**Критика**

Storage schema плоская и без versioning. Есть экспорт custom tunings и practice stats, но нет полного backup/restore профиля.

**Как сделал бы с нуля**

Сделал бы versioned profile:

```ts
interface UserProfileV1 {
  schemaVersion: 1;
  settings: MusicSettings;
  display: DisplaySettings;
  customData: {
    instruments: InstrumentPreset[];
    tunings: Tuning[];
    temperaments: Temperament[];
  };
  practice: {
    history: PracticeHistoryEntry[];
  };
}
```

**Правило**

Storage adapters load/save только profile document. Validation и migrations живут в `app-state`.

**Первый refactor**

Создать `profileSchema.ts`, `migrateProfile.ts`, `exportFullProfile.ts`, `importFullProfile.ts`.

### 7. Product UX Critic

**Критика**

Один экран уже несет слишком много задач: live tuning, temperament editing, custom instruments, metronome, practice, export. Это снижает scanability и делает `App.vue` все более связанным.

**Как сделал бы с нуля**

Сделал бы режимы:

- **Tune**: live tuner, strings, A4, backend, visualizers;
- **Stage**: fullscreen/compact high-contrast tuner;
- **Practice**: ear training, metronome, stats;
- **Library**: instruments, tunings, temperaments, import/export;
- **Settings**: display, audio backend, profile backup.

**Правило**

Каждый экран получает только свой view model slice и commands.

**Первый refactor**

Создать `features/tuner/TunerScreen.vue`, `features/practice/PracticeScreen.vue`, `features/library/LibraryScreen.vue`, затем переносить панели без изменения поведения.

### 8. Testing Critic

**Критика**

`web/scripts/test-core.mjs` полезен, но он bundle-level и не описывает контракты features. Нет tests на migrations, import validation, backend switching, view-model states.

**Как сделал бы с нуля**

Пирамида:

- pure unit tests: note math, temperaments, pitch, range, profile migrations;
- contract tests: audio port, storage port, profile import/export;
- controller tests: session lifecycle, practice history, tuning commands;
- browser smoke: page renders, key controls exist, no console errors;
- Tauri smoke: build and command availability.

**Правило**

Каждый новый module boundary получает contract test.

**Первый refactor**

Разбить `test-core.mjs` на domain/pitch/profile suites или хотя бы добавить отдельные sections и fixtures.

### 9. Native Desktop Critic

**Критика**

`native_audio.rs` делает сразу много: Tauri commands, state, cpal stream, conversion, detector. Это усложнит поддержку Windows/Linux edge cases и тестирование.

**Как сделал бы с нуля**

Rust layout:

```text
crates/
  tuner-core/
    src/pitch.rs
    src/music.rs
  native-audio/
    src/device.rs
    src/stream.rs
    src/events.rs
apps/
  tauri/src/commands/native_audio.rs
```

**Правило**

Tauri command wrapper не содержит DSP. Он вызывает service и мапит errors/events.

**Первый refactor**

Внутри текущего `native_audio.rs` сначала разделить функции на sections/service structs, потом вынести в crate.

### 10. Release And Maintainability Critic

**Критика**

web, Tauri и egui живут рядом, но parity не гарантируется. Presets уже приходится синхронизировать вручную.

**Как сделал бы с нуля**

Workspace:

```text
packages/core-music
packages/core-pitch
packages/app-state
apps/web
apps/tauri
apps/egui
crates/tuner-core
fixtures
```

**Правило**

Один источник truth для instruments/tunings/temperaments. Если web и egui расходятся, CI падает.

**Первый refactor**

Сгенерировать JSON registry из одного файла или наоборот генерировать TS/Rust fixtures из общего JSON.

## Target Architecture

```text
Tuner/
├── packages/
│   ├── core-music/
│   │   ├── noteMath.ts
│   │   ├── temperaments.ts
│   │   ├── tunings.ts
│   │   ├── instruments.ts
│   │   ├── sweetening.ts
│   │   └── tuningEngine.ts
│   ├── core-pitch/
│   │   ├── detectPitch.ts
│   │   ├── ranges.ts
│   │   ├── smoothing.ts
│   │   └── conformance.ts
│   ├── app-state/
│   │   ├── profileSchema.ts
│   │   ├── migrations.ts
│   │   ├── selectors.ts
│   │   └── actions.ts
│   ├── audio-ports/
│   │   ├── audioInput.ts
│   │   └── pitchSource.ts
│   └── ui-kit/
├── apps/
│   ├── web/
│   ├── tauri/
│   └── egui/
├── crates/
│   ├── tuner-core/
│   └── native-audio/
└── fixtures/
    ├── pitch/
    ├── profiles/
    └── registries/
```

До workspace-переезда те же границы можно реализовать внутри текущего `web/src`:

```text
web/src/core/
web/src/ports/
web/src/adapters/
web/src/application/
web/src/features/
```

## Dependency Rules

Строгие правила зависимостей:

```text
features -> application -> ports -> core
adapters -> ports
application -> core
ui-kit -> no app state
core -> no framework
```

Запрещено:

- `core/*` импортирует `vue`, `@tauri-apps/*`, `window`, `document`, `localStorage`;
- `components/*` напрямую импортируют storage adapters;
- `features/*` напрямую вызывают Tauri commands;
- `egui` и `web` имеют независимые manual presets без parity test;
- storage migrations зависят от UI labels.

Разрешено:

- adapters знают про platform APIs;
- application controllers знают про ports и core;
- composition root знает про concrete adapters;
- presentational components знают только props/events.

## Proposed Data Flow

```text
Audio adapter
  -> AudioInputPort events
  -> Pitch source
  -> Tuning engine
  -> Session controller
  -> View model
  -> UI components

User action
  -> Component emit
  -> Feature command
  -> Application controller
  -> Domain function or state action
  -> Profile store
  -> Storage adapter
```

Пример weak coupling:

- `Waveform.vue` получает `analyser` только если capability есть;
- `TuningSelector.vue` получает `tunings` и `selectedId`, но не знает storage;
- `PracticeScreen.vue` вызывает `practice.markCorrect()`, но не знает, как history сохраняется;
- `createTunerSession` вызывает `audio.start()`, но не знает WebAudio это или cpal.

## Module Boundary Contracts

### Music Core

```ts
interface TuningEngineInput {
  detectedFrequency: number | null;
  selectedStringIndex: number | null;
  tuning: Tuning;
  a4: number;
  temperament: TemperamentId;
  temperamentRoot: NoteName;
  transpose: number;
  capo: number;
  sweeteningOffsets: number[];
}

interface TuningEngineOutput {
  strings: Note[];
  targetNote: Note;
  detectedNote: DetectedNote | null;
  cents: number;
  isChromaticMode: boolean;
  detectionRange: PitchDetectionRange;
}
```

### Audio Port

```ts
interface AudioInputCapabilities {
  analyser: boolean;
  inputDeviceSelection: boolean;
  native: boolean;
}

interface AudioStartOptions {
  range: PitchDetectionRange;
  deviceId?: string;
}
```

### Storage Port

```ts
interface StoragePort<T> {
  load(): Promise<Partial<T>>;
  save(value: T): Promise<void>;
}
```

### Profile Transfer

```ts
interface ProfileTransferResult {
  profile: UserProfileV1;
  warnings: string[];
}
```

## Refactor Roadmap

### Phase 0: Freeze Behavior

Цель: перед разрезанием зафиксировать текущее поведение.

Deliverables:

- browser smoke checklist;
- tests для pitch ranges;
- tests для import custom tunings;
- tests для practice summary/streak;
- docs boundary decision в этом файле.

Exit criteria:

- можно менять структуру файлов и видеть, что поведение не уехало.

### Phase 1: Extract Pure Core

Цель: вынести чистую музыку и pitch без изменения UI.

Deliverables:

- `web/src/core/music/*`;
- `web/src/core/pitch/*`;
- старые `utils/notes.ts` и `utils/pitch.ts` временно re-export'ят новый core;
- дополнительные fixtures в tests.

Exit criteria:

- core tests запускаются без Vue/DOM/Tauri.

### Phase 2: Introduce Ports And Adapters

Цель: перестать связывать `useTuner` с concrete audio/storage APIs.

Deliverables:

- `web/src/ports/audioInput.ts`;
- `web/src/adapters/audio/webAudioInput.ts`;
- `web/src/adapters/audio/tauriNativeInput.ts`;
- `web/src/ports/storage.ts`;
- localStorage/Tauri Store adapters.

Exit criteria:

- backend switching живет в session controller, а не в UI.

### Phase 3: Split Application Controllers

Цель: превратить `useTuner` в composition root.

Deliverables:

- `createTunerSession`;
- `createTuningController`;
- `createPracticeController`;
- `createMetronomeController`;
- `createDisplayController`;
- tests на каждый controller.

Exit criteria:

- `useTuner.ts` меньше 100 строк;
- каждый controller можно тестировать без компонента.

### Phase 4: Split Feature UI

Цель: убрать "один экран знает обо всем".

Deliverables:

- `features/tuner/TunerScreen.vue`;
- `features/practice/PracticeScreen.vue`;
- `features/library/LibraryScreen.vue`;
- `features/settings/SettingsScreen.vue`;
- shared presentational components остаются в `components` или `ui-kit`.

Exit criteria:

- компоненты не импортируют storage/audio adapters;
- backend-specific UI основан на capabilities.

### Phase 5: Versioned Profile Import/Export

Цель: полноценный backup и migration layer.

Deliverables:

- `UserProfileV1`;
- `migrateProfile`;
- `exportFullProfile`;
- `importFullProfile`;
- UI для backup/restore;
- tests с broken/old profile fixtures.

Exit criteria:

- пользователь может перенести все настройки одним JSON.

### Phase 6: Native And egui Parity

Цель: убрать расхождение desktop implementations.

Deliverables:

- общий registry fixtures для instruments/tunings/temperaments;
- parity test web vs egui data;
- Rust native audio service separated from Tauri command wrapper;
- pitch conformance fixtures for TS/Rust.

Exit criteria:

- добавление нового инструмента не требует ручной правки в двух местах без теста.

### Phase 7: Workspace Migration

Цель: физически закрепить уже доказанные boundaries.

Deliverables:

- workspace layout;
- package build/test scripts;
- CI matrix per package/app;
- release checks.

Exit criteria:

- packages можно развивать независимо;
- apps зависят от public package APIs.

## Priority Backlog

1. Extract `summarizePractice` and streak logic into pure practice module.
2. Split `utils/pitch.ts` into `core/pitch/detectPitch.ts`, `ranges.ts`, `smoothing.ts`.
3. Split `utils/notes.ts` into pure music modules with compatibility exports.
4. Introduce `AudioInputPort` and wrap web/native audio.
5. Create `createTunerSession` and move start/stop/backend switching there.
6. Create versioned `UserProfileV1`.
7. Implement full profile import/export.
8. Split `App.vue` into feature screens.
9. Add parity fixtures for presets.
10. Split Rust native audio into service + Tauri command wrapper.

## Anti-Patterns To Avoid

- Adding another boolean to `useTuner` when it belongs to a feature controller.
- Letting UI components import `settingsStorage`.
- Adding a new instrument in web and forgetting egui.
- Duplicating pitch thresholds in TS and Rust without conformance tests.
- Making one "global profile object" mutable from everywhere.
- Creating abstractions before a boundary has a concrete second implementation.
- Moving files into packages before tests protect behavior.

## Definition Of Done

Deep refactor is done when:

- `useTuner.ts` is a small composition root, not a god-object;
- `App.vue` does not know about WebAudio, Worker, Tauri commands or storage;
- `core/music` and `core/pitch` run in Node tests without DOM;
- backend switching does not require UI changes;
- full profile import/export covers settings, instruments, tunings, temperaments, practice and display;
- web/Tauri/egui share or validate the same preset registry;
- Rust native audio has a service boundary below Tauri commands;
- every module boundary has at least one contract test.

## Architecture Decision

Do not start with a big-bang workspace migration. First make boundaries real inside the current structure, behind compatibility exports. Once the code behaves like packages, moving it into packages becomes mechanical and low-risk.
