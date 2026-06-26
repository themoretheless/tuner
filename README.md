# Guitar Tuner

Кросс-платформенный тюнер для струнных инструментов: web/PWA, Tauri desktop и легкая egui-версия на Rust.

## Что внутри

- **Web app** на Vue 3: работает в браузере через Web Audio API.
- **Tauri desktop**: тот же Vue-интерфейс, persistence через Tauri Store, опциональный нативный аудио backend на Rust/cpal.
- **egui desktop**: отдельная легкая native-версия без WebView.
- **Pitch detection**: YIN + fallback, instrument-aware диапазоны, сглаживание, hysteresis для in-tune.
- **Performance**: pitch detection в Web Worker, переиспользуемые audio buffers/context, увеличенное окно для баса.
- **Инструменты и строи**: guitar, 7-string, baritone, Nashville, 12-string, bass variants, ukulele, baritone ukulele, mandolin, banjo, violin, viola, cello, vocal pitch, chromatic.
- **Музыкальные настройки**: A4 calibration, temperament, transpose, capo, just intonation root, sweetening offsets.
- **UI/UX**: RU/EN, dark/light/colorblind themes, stage/fullscreen/compact modes, left-handed string order, waveform/spectrum в web backend.
- **Практика**: ear training, practice history, daily streaks, stats export.
- **Custom data**: custom tunings, custom instruments, custom temperaments, import/export custom tunings.

## Быстрый запуск

### Web

```bash
cd web
npm install
npm run dev
```

Открой `http://localhost:5173/tuner/`.

### Tauri

```bash
cd desktop
npm install
npm run tauri dev
```

Сборка:

```bash
cd web
npm run tauri:build
```

Артефакты появляются в `desktop/src-tauri/target/release/bundle/`.

### egui

```bash
cd egui
cargo run
```

Release build:

```bash
cd egui
cargo build --release
```

## Проверка

Основной smoke перед релизом:

```bash
cd web
npm run test
npm run build
npm run tauri:build

cd ../egui
cargo build
```

Что сейчас регулярно проверялось вручную:

- `npm run test`
- `npm run build`
- `cargo build` в `egui`
- `cargo build` в `desktop/src-tauri`
- `npm run tauri:build`
- browser smoke на `http://127.0.0.1:5173/tuner/`

## Структура

```text
Tuner/
├── web/                 # Vue 3 app, PWA, shared UI
├── desktop/             # Tauri shell around web app
├── desktop/src-tauri/   # Rust commands, native audio backend
├── egui/                # Pure native Rust app
├── ARCHITECTURE.md      # Deep refactor plan and module boundaries
├── RECOMMENDATIONS.md   # Prioritized recommendations from the architecture review
└── README.md
```

## Платформы

| Платформа | Статус | Форматы |
| --- | --- | --- |
| macOS | поддерживается | `.app`, `.dmg` |
| Windows | поддерживается через CI/Tauri | NSIS `.exe` |
| Linux | поддерживается через CI/Tauri | `.deb`, `.AppImage` |
| Browser | поддерживается | web/PWA |

Для macOS микрофону нужно разрешение в System Settings -> Privacy & Security.

Linux-зависимости для Tauri на Ubuntu/Debian:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Аудио backend'ы

### Web backend

Используется по умолчанию в браузере и Tauri. Дает waveform/spectrum через `AnalyserNode`, поддерживает выбор input device.

### Native Tauri backend

Опциональный Rust/cpal backend в Tauri:

- проверяет наличие input device через Tauri command;
- запускает cpal stream на отдельном потоке;
- поддерживает разные sample format'ы (`i8/i16/i32/i64/u8/u16/u32/u64/f32/f64`);
- шлет frequency/level во frontend через `native-audio-frame`;
- использует тот же instrument-aware pitch range.

Если backend недоступен, приложение остается на web backend.

## CI/CD

Workflows настроены для web, Tauri, egui, GitHub Pages, preview deploy и release artifacts.

GitHub Pages URL:

```text
https://themoretheless.github.io/tuner/
```

`web/vite.config.ts` использует base `/tuner/`.

## Что уже исправлено после ревью

- Разделены audio input, pitch loop, tuning state, reference tone, settings, metronome, ear training.
- Убран pitch detection из главного UI loop в Web Worker.
- Добавлены instrument-aware detection ranges для низкого баса и высоких инструментов.
- Расширены instrument/tuning presets в web и egui.
- Добавлены temperament/transpose/capo/just-root/custom temperament controls.
- Добавлены stage/fullscreen/compact modes, light/colorblind themes, left-handed layout.
- Добавлены cents history, practice history, daily streaks, stats export.
- Добавлен import/export custom tunings.
- Добавлен optional native Tauri audio backend.
- Полный Tauri build проверен локально, не только `cargo build`.

## Deep Refactor Blueprint

Этот раздел - краткий план глубокого рефакторинга. Полный документ с 10 критиками, целевой архитектурой, dependency rules, module contracts и migration roadmap лежит в `ARCHITECTURE.md`. Практический список рекомендаций и порядок следующих коммитов лежит в `RECOMMENDATIONS.md`.

Главный принцип: UI не должен знать, какой audio backend активен; доменная музыка не должна знать про Vue, Tauri, localStorage или cpal; storage не должен знать про компоненты; orchestration должен быть тонким и тестируемым.

### 10 критиков

1. **Domain architect**
   - Критика: `web/src/utils/notes.ts` уже стал смесью note math, preset registry, temperament logic, custom-data normalization и UI-friendly names.
   - Как сделал бы с нуля: отдельный `core/music` с чистыми функциями, immutable domain types и data registry. Никаких Vue refs, localStorage, Tauri imports или browser API.
   - Рефакторинг: split `notes.ts` на `noteMath`, `temperaments`, `tunings`, `instruments`, `sweetening`, `selection`.

2. **Audio systems engineer**
   - Критика: web audio, native audio, pitch loop и detection range согласуются через `useTuner`; backend selection протекает в UI.
   - Как сделал бы с нуля: `AudioInputPort` с одинаковыми событиями `level`, `frame`, `frequency`, `status`, `error`; web и Tauri native - адаптеры.
   - Рефакторинг: UI работает с `TunerSession`, а не с `useAudioInput`/`useNativeAudioInput` напрямую.

3. **Performance critic**
   - Критика: YIN есть в TS и Rust отдельно; логика похожая, но расходится. Worker разгрузил UI, но core algorithm все еще живет в frontend package.
   - Как сделал бы с нуля: один shared pitch core: Rust crate + WASM для web или строго синхронизированные conformance tests для TS/Rust.
   - Рефакторинг: вынести pitch fixtures и expected outputs; проверять TS worker и Rust native backend на одинаковых sine/noisy samples.

4. **Frontend composition critic**
   - Критика: `useTuner.ts` остается фасадом на все: session lifecycle, pitch source, tuning, practice, metronome, UI prefs, export.
   - Как сделал бы с нуля: маленькие feature controllers: `tunerSession`, `tuningController`, `practiceController`, `metronomeController`, `displayController`.
   - Рефакторинг: `useTuner` оставить только compatibility facade для `App.vue`, а новую логику переносить в controllers по одному slice.

5. **State management critic**
   - Критика: settings - глобальные module refs; это удобно, но усложняет тесты, reset state, multi-instance и migration.
   - Как сделал бы с нуля: typed app store с `SettingsState`, actions, selectors и storage adapter. Для Vue можно Pinia или свой маленький store.
   - Рефакторинг: убрать прямую запись в settings из domain controllers; использовать command functions и typed selectors.

6. **Persistence critic**
   - Критика: storage schema разрослась плоским списком ключей; migration/versioning отсутствуют; export покрывает только custom tunings и practice stats.
   - Как сделал бы с нуля: versioned `UserProfile` document: settings, custom instruments, tunings, temperaments, practice, display prefs.
   - Рефакторинг: добавить `profile.schemaVersion`, `migrateProfile`, `importProfile`, `exportProfile`; localStorage/Tauri Store становятся backend adapters.

7. **Product UX critic**
   - Критика: приложение уже умеет многое, но workflows конкурируют в одном экране: tuning, temperament, practice, metronome, profile editing.
   - Как сделал бы с нуля: режимы с отдельными задачами пользователя: Tune, Stage, Practice, Library, Settings.
   - Рефакторинг: разнести панели по feature routes/tabs или mode sections, чтобы `App.vue` не был доской всех возможностей сразу.

8. **Testing critic**
   - Критика: есть хороший `test-core.mjs`, но он проверяет слишком широкий bundle и мало контрактов import/export/session lifecycle.
   - Как сделал бы с нуля: тестовая пирамида: pure domain tests, adapter contract tests, controller tests, browser smoke, Tauri smoke.
   - Рефакторинг: создать fixtures для notes/tunings/temperaments/profile; добавить tests на storage migrations и custom import validation.

9. **Native desktop critic**
   - Критика: Tauri native audio уже полезен, но Rust backend пока lives as one command module; нет отдельного core crate, нет typed event protocol package.
   - Как сделал бы с нуля: `crates/tuner-core`, `crates/native-audio`, `apps/tauri`; event protocol генерируется или описан в одном shared contract.
   - Рефакторинг: вынести Rust pitch/native audio из Tauri command boundary; Tauri module только открывает команды и пересылает события.

10. **Release/maintainability critic**
    - Критика: web, desktop и egui живут рядом, но без workspace contract. Дублирование presets между web и egui уже появилось.
    - Как сделал бы с нуля: monorepo workspace с shared packages/crates, generated preset data и release checks на parity.
    - Рефакторинг: один источник данных для instruments/tunings/temperaments; egui и web читают generated JSON или shared Rust/TS artifacts.

### Целевая модульная архитектура

```text
Tuner/
├── packages/
│   ├── core-music/              # note math, tunings, instruments, temperaments
│   ├── core-pitch/              # TS pitch API or WASM wrapper, fixtures, conformance tests
│   ├── app-state/               # settings/profile schema, migrations, selectors
│   ├── audio-ports/             # AudioInputPort, PitchSourcePort, event contracts
│   └── ui-kit/                  # reusable presentational Vue components
├── apps/
│   ├── web/                     # browser app, WebAudio adapter
│   ├── tauri/                   # Tauri shell, native-audio adapter, store adapter
│   └── egui/                    # Rust native UI
├── crates/
│   ├── tuner-core/              # optional Rust note/pitch core
│   └── native-audio/            # cpal stream, platform errors, sample conversion
└── fixtures/
    ├── pitch/
    ├── profiles/
    └── tunings/
```

Не обязательно сразу физически переносить все папки. Первый шаг - ввести эти границы внутри текущих `web/src/*`, чтобы миграция была безопасной.

### Dependency Rules

- `core-music` зависит только от TypeScript и данных. Он не импортирует Vue, DOM, Tauri, audio APIs или storage.
- `core-pitch` принимает `Float32Array + sampleRate + range` и возвращает typed result. Он не знает про instruments или UI.
- `audio adapters` знают про Web Audio/cpal/Tauri, но не знают про выбранный строй или cents UI.
- `application controllers` связывают ports: audio source -> pitch source -> tuning engine -> practice/history.
- `ui components` получают props и emit'ят commands. Они не читают storage и не выбирают backend.
- `storage adapters` умеют load/save versioned profile. Они не нормализуют музыку сами, только зовут schema/domain helpers.
- `egui` и `web` не дублируют preset logic вручную. Если данные расходятся, это failing parity test.

### Новый поток данных

```text
AudioInputPort
  -> PitchDetectorPort
  -> TuningEngine
  -> TunerSessionController
  -> ViewModel
  -> Vue components

User commands
  -> Controller actions
  -> Domain functions
  -> Settings/Profile store
  -> Storage adapter
```

Главная цель: `App.vue` и компоненты видят только `ViewModel` и commands. Они не знают, идет ли звук из `AnalyserNode`, Worker, Tauri event или будущего WASM/native backend.

### Предлагаемые новые модули внутри текущего web/src

```text
web/src/core/music/
  noteMath.ts
  temperaments.ts
  tunings.ts
  instruments.ts
  sweetening.ts
  tuningEngine.ts

web/src/core/pitch/
  detectPitch.ts
  smoothing.ts
  ranges.ts
  fixtures.ts

web/src/application/
  createTunerSession.ts
  createTuningController.ts
  createPracticeController.ts
  createMetronomeController.ts
  createDisplayController.ts

web/src/ports/
  audioInput.ts
  pitchSource.ts
  storage.ts
  profileTransfer.ts

web/src/adapters/
  audio/webAudioInput.ts
  audio/tauriNativeInput.ts
  pitch/workerPitchSource.ts
  storage/localStorageStore.ts
  storage/tauriStore.ts

web/src/features/
  tuner/
  practice/
  library/
  settings/
```

### Что разрезать первым

1. **Pitch range и detector**
   - Вынести `PitchDetectionRange`, normalization и smoothing из `utils/pitch.ts` в `core/pitch`.
   - Добавить conformance tests: E2, B0, E5, noisy signal, silence, wrong range.

2. **Music domain**
   - Разбить `utils/notes.ts`.
   - Создать `TuningEngineInput` и pure `calculateTuningState(input)`.
   - Убрать из domain функций знание о settings refs.

3. **Profile schema**
   - Ввести `UserProfileV1`.
   - Сделать `settingsStorage` адаптером, а не владельцем shape всей модели.
   - Добавить `exportFullProfile()` и `importFullProfile()`.

4. **Audio port**
   - Ввести интерфейс:

```ts
interface AudioInputPort {
  readonly kind: 'web' | 'native';
  start(range: PitchDetectionRange): Promise<void>;
  stop(): Promise<void>;
  setRange(range: PitchDetectionRange): Promise<void>;
  subscribe(listener: (event: AudioInputEvent) => void): () => void;
}
```

   - Web adapter шлет frames/level/analyser.
   - Native adapter шлет frequency/level/no analyser.
   - `useTuner` перестает знать детали двух backend'ов.

5. **Tuner session**
   - Создать `createTunerSession({ audio, pitch, tuning, history })`.
   - Состояния: `idle`, `starting`, `listening`, `stopping`, `error`.
   - Все restart-on-backend-change поведение уходит туда.

6. **Practice feature**
   - Ear training перестает жить как часть общего tuner facade.
   - Добавить modes: note, interval, direction, octave, adaptive.
   - Practice history пишет typed events, а summary считается selector'ом.

7. **UI shell**
   - `App.vue` разделить на feature sections: `TunerScreen`, `PracticeScreen`, `LibraryScreen`, `SettingsScreen`.
   - Presentational components оставить тупыми: props in, events out.

8. **Native Rust**
   - Вынести `desktop/src-tauri/src/native_audio.rs` на слой ниже: stream service + Tauri command wrapper.
   - Добавить Rust unit tests для pure pitch pieces или parity fixtures.

### Миграционный план без big bang

1. **Phase 0: Freeze contracts**
   - Зафиксировать текущие user-facing behaviors тестами: startup, backend fallback, tuning selection, custom tuning import, practice export.
   - Добавить markdown ADR: какие boundaries считаются стабильными.

2. **Phase 1: Extract pure core**
   - Перенести note math, pitch range, tuning calculations в `web/src/core`.
   - Сохранить re-export из старых файлов, чтобы не переписывать весь UI за один коммит.

3. **Phase 2: Introduce ports**
   - Добавить `AudioInputPort`, `StoragePort`, `ProfileTransferPort`.
   - Обернуть существующие composables адаптерами.
   - `useTuner` пока остается фасадом, но зависит от ports.

4. **Phase 3: Split application controllers**
   - Вынести session lifecycle, tuning commands, practice commands, display prefs в отдельные controllers.
   - `useTuner` превращается в thin composition root.

5. **Phase 4: Feature UI split**
   - Разделить `App.vue` на экраны/секции.
   - Убрать backend-specific conditions из visual components; заменить capabilities flags.

6. **Phase 5: Profile import/export**
   - Ввести full profile backup.
   - Добавить migrations и validation errors.
   - Custom tuning import оставить как частный импорт, но поверх общего transfer layer.

7. **Phase 6: Shared native parity**
   - Синхронизировать web/egui/Tauri preset data.
   - Вынести Rust native audio service из Tauri wrapper.
   - Добавить conformance tests между TS/Rust pitch.

8. **Phase 7: Workspace cleanup**
   - Перейти к workspace layout только после того, как boundaries уже доказаны внутри текущих папок.
   - CI начинает проверять packages отдельно.

### Definition of Done для рефакторинга

- `useTuner.ts` меньше 100 строк и только собирает controllers.
- `App.vue` не знает про Web Audio, Tauri commands, Worker или storage.
- Любой новый audio backend добавляется через один adapter без правок в tuning/practice UI.
- Любой новый temperament/instrument добавляется в data registry и покрывается parity test.
- Full profile export/import переносит весь пользовательский state.
- Web, Tauri и egui не расходятся по базовым presets.
- Core tests запускаются без DOM, Vue, Tauri и браузера.

## Что осталось в приоритете

1. Полнее ear training: интервалы, направление, octaves, adaptive difficulty, playback modes.
2. Полный import/export профиля: settings, instruments, temperaments, practice stats, tunings одним backup-файлом.
3. User instrument profiles глубже: reorder, duplicate, validation, per-profile defaults.
4. Temperament comparison view и сохранение/экспорт custom temperament presets как отдельный UX flow.
5. Native backend runtime QA на нескольких input devices и OS, включая permission/error states.
6. Accessibility pass: focus states, ARIA labels для select/button groups, keyboard-only flow.
7. Более широкий тестовый слой: composables, storage migrations, import validation, pitch fixtures.
8. Иконки для релиза и подпись/notarization для macOS.

## Генерация иконок

Подготовь PNG 1024x1024 и выполни:

```bash
cd desktop
npx tauri icon ./icon.png
```

Это создаст `icns`, `ico` и нужные PNG sizes.

## Советы по использованию

- Настраивайся в тихой комнате.
- Играй одну струну за раз.
- Для низких инструментов выбирай правильный preset: так pitch detector сужает диапазон.
- Для сцены включай stage/fullscreen mode.

Сделано на Vue + Rust. Работает оффлайн в desktop-сборках и как web/PWA в браузере.
