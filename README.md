# Guitar Tuner

**Кросс-платформенный гитарный тюнер**

- **Оффлайн десктопные приложения**:
  - Tauri версия (Vue frontend + Rust backend)
  - egui версия (pure native Rust + cpal, no webview)
- **Онлайн сайт**: любой современный браузер (Vue 3)

Точный, быстрый и полностью работает без интернета в десктопной версии.

## Что сделано (summary)

- Shared Rust `pitch-core` для YIN/MPM, note math и части engine path.
- Vue 3 web UI с Tauri desktop shell и отдельной egui/cpal native версией.
- Tauri native audio backend уже есть, но пока не приведён к общей audio-port архитектуре.
- Пресеты инструментов и строев, A4, capo, transpose, temperaments, custom tunings, practice history, metronome, themes.
- Waveform/spectrum/spectrogram, cents history, reference tone и ear training.
- Bilingual RU/EN, keyboard shortcuts, Tauri Store + localStorage persistence.
- CI/CD для web, Tauri, egui, deploy/release flows.

## Current Audit / Technical Debt

Канонический текущий extract того, что сейчас сделано плохо или неправильно: [recommendation.md](recommendation.md).
Полный ranked **Top 500**: [TOP-500-backlog.md](TOP-500-backlog.md).
Свежий grounded-аудит по коду: [TOP-200-current.md](TOP-200-current.md).

Главные проблемы:
- egui random-string tone сейчас ломается из-за `out.take()` и AudioContext в web может остаться suspended;
- `useTuningState.ts`, `useSettings.ts` и `egui/src/main.rs` всё ещё слишком крупные и связные; `useTuner.ts` уже тоньше после выноса `useTunerSession`, но ещё не полноценный state-machine shell;
- нет единого `AudioInputPort` и `TunerSessionController`; общий `DetectionFrame` начат в `pitch-core`, но ещё не принят всеми platform paths;
- web-визуализаторы уже получают plain frames, но общий session/native frame contract ещё не доведён до всех платформ;
- TS/Rust таблицы строев и note math теперь покрыты parity-тестом, но всё ещё дублируются; pitch paths между TS/Rust/Tauri пока расходятся;
- egui и Tauri native audio всё ещё делают тяжёлую работу в cpal callback path;
- тесты уже доказывают Rust/Web domain parity и headless synthetic fixture, но ещё нет Tauri/egui parity и Playwright fake-mic E2E;
- web PWA пока manifest-first, без полноценного Service Worker/offline cache.

Целевая архитектура и фазы рефакторинга: [ARCHITECTURE.md](ARCHITECTURE.md). Практический порядок работ: [PLAN.md](PLAN.md). Подробные рекомендации по рефакторингу: [RECOMMENDATIONS.md](RECOMMENDATIONS.md).

## Возможности

- Современный алгоритм **YIN** (высокая точность)
- Поддержка нескольких строев (Standard, Drop D, DADGAD, Open G, Open D + свои)
- Реал-тайм визуализация формы волны
- Большой индикатор ноты + шкала центов с гистерезисом
- Клавиатурные сокращения
- Референсный тон
- Полностью оффлайн в десктопной версии
- Кросс-платформенность: Windows, macOS, Linux + браузер

CI и деплой страницы (GitHub Pages для онлайн-версии) настроены как в cut-log:
- build-web.yml, build-tauri.yml, build-egui.yml, deploy.yml, pr-deploy.yml, release.yml
- Страница: https://themoretheless.github.io/tuner/ (включи GitHub Pages с source "GitHub Actions")
- Для десктоп-релизов бинари собираются в release с матрицей (Win/Mac/Linux) и добавляются в GitHub Release
- Страница двуязычная (RU/EN) с переключателем, как в cut-log

Base в web/vite.config.ts = '/tuner/' (repo name is lowercase "tuner").

## Скачать / Собрать

Собери приложение самостоятельно (рекомендуется) или используй CI в GitHub Actions (workflow уже настроен).

## Структура проекта

```
Tuner/
├── pitch-core/          # Shared Rust pitch core (YIN + MPM) - used by egui, WASM for web
├── web/                 # Vue 3 — онлайн сайт (GitHub Pages)
├── desktop/             # Tauri desktop (Vue frontend + Rust backend)
├── egui/                # Pure native offline (egui + cpal, no webview)
├── ARCHITECTURE.md      # План рефакторинга + интегрированные бэклоги идей и приоритеты
├── recommendation.md    # Стабильный current extract открытых проблем (R#)
├── TOP-200-current.md   # Последний grounded-аудит текущего кода (C#)
├── TOP-500-backlog.md   # Полный ranked Top 500 (M#)
├── PLAN.md              # Порядок выполнения и DoD
├── RECOMMENDATIONS.md   # Приоритизированный план исправлений
└── README.md
```

## Запуск онлайн сайта (web)

```bash
cd web
npm install
npm run dev
```

Открой http://localhost:5173

## Поддерживаемые платформы

| Платформа     | Статус     | Форматы распространения          |
|---------------|------------|----------------------------------|
| **Windows**   | ✅         | .exe (NSIS)                      |
| **macOS**     | ✅         | .app + .dmg (Intel + Apple Silicon) |
| **Linux**     | ✅         | .deb + .AppImage                 |
| Браузер       | ✅         | PWA / обычный сайт               |

### Быстрый запуск в разработке (все платформы)

```bash
cd desktop
npm install
npm run tauri dev
```

### Необходимые инструменты для сборки

**Все платформы:**
- [Rust](https://rustup.rs/) (stable)
- Node.js ≥ 18 + npm

**macOS:**
- Xcode Command Line Tools (`xcode-select --install`)

**Windows:**
- Microsoft C++ Build Tools (Visual Studio 2022 рекомендуется)

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Десктопные приложения

Есть две версии оффлайн десктопа:

### 1. Tauri (Vue + Rust)
Использует веб-фронтенд из `web/`, упакованный в нативное приложение.

```bash
cd desktop
npm run tauri build
```

Бинарники в `desktop/src-tauri/target/release/bundle/`

### 2. egui (pure native Rust)
Лёгкая версия без WebView, полностью на Rust + egui.

```bash
cd egui
cargo build --release
```

Бинарник в `egui/target/release/guitar-tuner-egui`

## Сборка веб-версии

```bash
cd web
npm run build
```

#### macOS

```bash
cd desktop
npm run tauri build
```

Результаты:
- `.app` + `.dmg` в `src-tauri/target/release/bundle/macos/` и `dmg/`

**Важно для macOS:**
- Для подписывания и нотаризации (рекомендуется для распространения) настрой `signingIdentity` в `tauri.conf.json`
- Может потребоваться разрешение на микрофон в System Settings → Privacy & Security

#### Windows

```bash
cd desktop
npm run tauri build
```

Результаты:
- Установщик NSIS (`.exe`) в `src-tauri/target/release/bundle/nsis/`

**Дополнительно:**
- Для MSI установщика можно изменить `targets` в конфиге
- Рекомендуется собирать на Windows (кросс-компиляция возможна, но сложнее с иконками)

#### Linux

```bash
cd desktop
npm run tauri build
```

Результаты:
- `.deb` (Debian/Ubuntu)
- `.AppImage` (универсальный)

**Для Fedora/openSUSE** можно включить `rpm` в `targets`.

### Генерация иконок (обязательно для релиза)

Текущие иконки — заглушки. Сделай так:

1. Подготовь изображение 1024×1024 px (PNG или SVG) с прозрачным фоном.
2. Сохрани как `icon.png` в корень проекта или `desktop/src-tauri/`.
3. Выполни:

```bash
cd desktop
npx tauri icon ./icon.png
```

Это создаст все нужные размеры и форматы (`icns`, `ico`, png для разных платформ).

### Платформенные особенности

| Платформа | Установщик       | Особенности                     | Микрофон          |
|-----------|------------------|---------------------------------|-------------------|
| Windows   | NSIS (.exe)      | Per-machine / per-user          | Работает сразу    |
| macOS     | .app + .dmg      | Подпись + нотаризация           | Нужно разрешение  |
| Linux     | .deb / .AppImage | Зависимости (обычно минимальны) | Работает сразу    |

## Как это работает

- Веб версия использует Web Audio API + getUserMedia; pitch loop сейчас читает frames из analyser и отправляет часть работы в worker.
- Tauri упаковывает Vue frontend в нативное приложение и уже имеет дополнительный native cpal audio backend.
- egui версия использует cpal напрямую и частично общий `pitch-core`.
- Цель рефакторинга: убрать платформенные утечки из UI, вести всё через audio ports, session controller и shared frame contracts.

## Советы по использованию

- Тихая комната
- Играй по одной струне
- Используй ручной выбор струны для максимальной точности
- Держи гитару близко к микрофону

## Текущий архитектурный статус

Исторические ревью, текущий code-audit и Top 500 сведены в [ARCHITECTURE.md](ARCHITECTURE.md), [recommendation.md](recommendation.md), [TOP-200-current.md](TOP-200-current.md) и [TOP-500-backlog.md](TOP-500-backlog.md). README больше не является местом полного аудита.

M0 safety net существенно продвинут: web core tests переведены на Vitest и расширены, Node/Rust toolchains закреплены, `pitch-core` проходит fmt/clippy/test/wasm feature check в CI, Rust/Web parity проверяет built-in tunings + note/cents math, а `?fixture=E2` даёт headless synthetic audio path. Полный M0 ещё не закрыт: нужны composable/session tests и Playwright fake-mic E2E.

Сейчас есть три рабочих shell path: Vue web, Tauri desktop и egui native. Переход к полностью общему core/session ещё не завершён:
- часть domain уже вынесена в `pitch-core/src/domain.rs`;
- `pitch-core` уже разделён на `domain`, `frames`, `signal`, `smoother`, `engine`, `dsp`; осталось разнести `dsp` на YIN/MPM, вынести spectrum и WASM surface;
- web всё ещё держит собственные TS note/pitch helpers;
- Tauri native audio пока имеет отдельный detector path;
- egui пока не в feature parity с web UI.

Нативный egui запуск: `cargo run -p guitar-tuner-egui`.

## Следующие улучшения (рекомендуемые)

- AudioWorklet для обработки звука вне основного потока
- Дополнительные строи + кастомный редактор
- Полноценный Service Worker для offline PWA
- Качественные иконки для desktop: `cd desktop && npx tauri icon path/to/512.png`
- Укрепить Tauri native audio backend: общий detector, stream recovery, device selection, realtime-safe processing

---

## План глубокого рефакторинга

Полный план (10 критиков + целевая архитектура слоёв + **влитые бэклоги**) — в [ARCHITECTURE.md](ARCHITECTURE.md). Там же приоритезированные пункты из старых бэклогов + 200 конкретных предложений.

**Порядок выполнения** — пошаговый план с зависимостями, привязкой к проблемам recommendation.md и критериями готовности — в [PLAN.md](PLAN.md). Это источник истины по очерёдности работ.

**Ключевые цели рефакторинга:**
- Разбить god-объекты (`useTuner.ts`, `egui/main.rs`, `pitch-core/lib.rs`)
- Чёткие слои + трейты (domain / dsp / audio / engine / presentation)
- Визуализаторы получают только plain data (никаких AnalyserNode или cpal утечек)
- Легко тестировать, расширять (MIDI, файлы, новые платформы) и онбордить людей

Мы проектировали **как будто с нуля**, уделяя особое внимание слабой зацепленности между аудио, вычислениями и UI.

Первые шаги уже частично выполнены. Дальше — инкрементальная реализация по фазам из ARCHITECTURE.md.

## Идеи и предложения (влиты в ARCHITECTURE.md)

Все существующие бэклоги ([TOP-500-backlog.md](TOP-500-backlog.md) + [IDEAS-round4-500.md](IDEAS-round4-500.md)) **синхронизированы** с [ARCHITECTURE.md](ARCHITECTURE.md).

Там теперь единая живая картина:
- Самые высокоприоритетные P1/P2 пункты из master Top 500 (вытащены наверх).
- Выбранные мощные направления расширения из 500 идей (в первую очередь архитектурно интересные, типа course-aware tuning).
- Полный структурированный список из 200 конкретных реализуемых предложений по категориям (Performance, DSP, Architecture, Web, egui, Canvas/Viz, Features, Testing и др.).

Ключевые направления:
- Завершить слои и убрать coupling (god-объекты, session/audio boundaries, дубли math).
- Весь DSP в pitch-core + реальные оптимизации (decimate, fusion, prealloc, off-main-thread).
- Canvas/DPR + data-driven визуализации (прямо по текущей ветке canvas-dpr-and-dsp-fixes).
- DX и качество (тесты, harness-ы, snapshot-ы, единый источник tuning tables).
- Полировка аудио, accessibility, privacy, PWA, релизы (signing, CSP).
- Гитаристские фичи поверх чистой архитектуры (custom tunings, guided flow, history и т.д.).

См. раздел **"Integrated Ideas..."** в ARCHITECTURE.md. 

Работаем так: берём 5–8 самых высоких по приоритету (сверху из [TOP-500-backlog.md](TOP-500-backlog.md), сверяя с [TOP-200-current.md](TOP-200-current.md)), делаем инкрементально, каждый раз спрашивая "уменьшает или увеличивает coupling?". Отдельные списки остаются активными источниками фактов, а не копипастятся в README.

## Технический долг и что сделано плохо

Полный ranked Top 500 того, что сделано плохо, неправильно, рискованно или стратегически недостроено, находится в [TOP-500-backlog.md](TOP-500-backlog.md). Текущий grounded-аудит по коду: [TOP-200-current.md](TOP-200-current.md) (**187** detailed findings). Стабильный extract для ссылок из плана: [recommendation.md](recommendation.md) (**183** `R#` items).

Ключевые проблемы на сегодня (выборка):
- `useTuner.ts`, `useTuningState.ts`, `useSettings.ts`, `pitch-core/src/lib.rs` и `egui/src/main.rs` всё ещё слишком связные.
- Нет полноценного общего `AudioInputPort`, `TunerSessionController`, полного `TunerFrame` на всех платформах.
- Дублирование таблиц строев и математики нот теперь guarded parity-тестом, но ещё не заменено single-source/codegen; pitch paths между TS, Rust core и Tauri native всё ещё расходятся.
- Mutex'ы, аллокации и обработка DSP в realtime callback path.
- Слабые тесты вокруг session/backend switching/Tauri/egui; Rust/Web domain harness уже есть.
- Много hardcoded значений; canvas renderer lifecycle уже централизован, но ещё требует visual QA.

См. также раздел "Current Problems" в [ARCHITECTURE.md](ARCHITECTURE.md).

Полный master Top 500 — в [TOP-500-backlog.md](TOP-500-backlog.md). Текущие `R#` проблемы — в [recommendation.md](recommendation.md).

Когда фиксим — обновляем [recommendation.md](recommendation.md), [TOP-200-current.md](TOP-200-current.md), [TOP-500-backlog.md](TOP-500-backlog.md) при изменении ранга/статуса, [ARCHITECTURE.md](ARCHITECTURE.md), этот README и, если меняется порядок работ, [PLAN.md](PLAN.md) / [RECOMMENDATIONS.md](RECOMMENDATIONS.md).
