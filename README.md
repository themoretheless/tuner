# Guitar Tuner

**Кросс-платформенный гитарный тюнер**

- **Оффлайн десктопные приложения**:
  - Tauri версия (Vue frontend + Rust backend)
  - egui версия (pure native Rust + cpal, no webview)
- **Онлайн сайт**: любой современный браузер (Vue 3)

Точный, быстрый и полностью работает без интернета в десктопной версии.

## Что сделано (summary)

- YIN pitch detection (гораздо лучше базовой автокорреляции) + fallback
- 8+ строев + переключение, A4 калибровка, гистерезис "in tune"
- Waveform визуализатор, reference tone, ear training (random note)
- Bilingual RU/EN с toggle, keyboard shortcuts (Space, 1-6, R)
- Persistence (Tauri Store + localStorage)
- CI/CD как у cut-log: build (web + Tauri + egui matrix), deploy, pr-deploy, release (с attachment бинарей обоих десктопов)
- GitHub Pages для демо, PWA manifest, regenerated icons
- Компонентная структура, SVG gauge, shared audio context

## Review: проблемы и исправления (на момент последнего ревью)

### Performance
- YIN O(n²) на каждый кадр (~60fps) — тяжеловато на слабых устройствах.
  - **Fixes**: preallocated buffer (избегаем GC), reused single AudioContext для всех тонов (вкл. random note), downsampling hints в комментариях.
  - Рекомендация: AudioWorklet или WASM-YIN для production.
- Новые AudioContext'ы на каждый референс — fixed.

### UI/UX
- Фиксированная ширина, toggle waveform в неудобном месте, неполные переводы клавиатурных подсказок.
  - **Fixes**: вынесено в l10n, улучшен hint, toggle рядом с A4.
- Нет настроек панели, спектрограммы, пер-струн индикаторов.
- **TODO**: добавить spectrogram, volume для ref, tutorial.

### Architecture / Separation / Coupling
- useTuner.ts — god-object (~250+ строк): mic + detection + tones + state.
  - Высокий coupling audio nodes ↔ state.
- Глобальные буферы в pitch.ts.
- Settings tightly coupled.
  - **Fixes**: вынес shared audio, prealloc, useSettings composable.
  - **Что бы сделал с нуля**: pnpm workspaces + packages/core (Rust pitch via WASM), useAudioInput + usePitchDetector отдельно, Pinia/XState для состояния, AudioWorklet с самого начала.

### Design / Проектирование
- Много магических чисел (FFT=2048, thresholds).
- Нет тестов для pitch (синтетика).
- Desktop всё ещё на web-audio (не native cpal).
- CI desktop может падать на некоторых матрицах (иконки, paths) — пофиксили icons + glob.

### Separation
- Frontend shared, но desktop build тесно связан с web/dist.
- L10n и настройки в отдельных stores — хорошо.
- Workflows скопированы из cut-log — адаптированы, но desktop часть может быть отдельным workflow'ом.

### Если бы делал с нуля по-другому
- **Core**: Rust crate для YIN + WASM с первого дня (shared между web и desktop, perf нативный).
- **Audio**: AudioWorklet + WebRTC constraints с самого начала.
- **State**: Pinia + typed state machine для tuner (idle/listening/detected).
- **Monorepo**: pnpm workspaces (core, ui, web, desktop, shared-types).
- **UI**: Design tokens + headless components, лучше responsive (не фиксир. 620px).
- **Testing**: Property-based testing pitch algo на синтетических сигналах.
- **CI**: matrix для desktop с artifacts, signed releases, Pages только от web build (как сейчас сделали).
- **Доп.**: нативный cpal захват в Tauri, больше инструментов (укулеле и т.д. из коробки), cloud sync опционально.
- Избегать god objects, глобальных буферов, multiple AudioContext.

Сейчас код в рабочем состоянии, CI/pages настроены, основные баги пофикшены. Можно итерировать по списку идей из предыдущего сообщения.

(Полный обзор в чате выше; этот раздел влит в README для будущих.)

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

- Веб версия использует Web Audio API + getUserMedia
- Алгоритм: autocorrelation + сглаживание (EMA + медиана)
- Tauri упаковывает тот же фронтенд в нативное приложение (Rust + webview)
- Можно расширить: Rust side (cpal + pitch detection) для desktop в будущем

## Советы по использованию

- Тихая комната
- Играй по одной струне
- Используй ручной выбор струны для максимальной точности
- Держи гитару близко к микрофону

## Что реализовано после ревью

- **YIN** — основной алгоритм определения высоты (гораздо стабильнее на гитаре)
- Поддержка нескольких строев (Standard, Drop D, DADGAD, Open G, Open D)
- Canvas waveform визуализатор
- Клавиатурные сокращения (Space/M, 1-6, R)
- PWA manifest (можно установить как приложение в браузере)
- Много архитектурных и UX улучшений (см. ниже)

## Review & Что было исправлено после первой версии

### Основные проблемы, которые мы нашли и исправили

**Архитектура и разделение ответственности**
- useTuner был монолитом (захват аудио + обработка + референс + состояние). Частично разделили.
- App.vue был 230 строк одним файлом — вынесли 7 компонентов (CentsGauge, NoteDisplay, StringSelector, MicButton и др.).
- Жёсткая связанность: частоты были захардкожены на 440, не передавались A4. Теперь A4 — реактивный параметр.
- Stale файлы от create-vue (HelloWorld и т.д.) удалены.

**Производительность**
- Автокорреляция работала на каждый RAF с новыми аллокациями (Float32Array + slice). Теперь буферы переиспользуются.
- Ограничили лаг по диапазону гитары, убрали бесполезные зоны.
- Naive volume scaling `*12` заменён на normalizeLevel.
- Reference tone создавал новый AudioContext каждый раз — теперь переиспользуется.

**UI / UX**
- Cents gauge использовал магические `centsClamped * 1.8 px` — привязан к конкретной ширине. Переписан на SVG (масштабируется).
- "IN TUNE" мигал — добавили гистерезис (±5 / ±7).
- Надписи FLAT/SHARP были некорректны — исправлены на понятные "SHARP — loosen" / "FLAT — tighten".
- Input level показывался всегда — теперь только при listening.
- Не было способа изменить A4 (дизайн-ошибка) — добавили простой input.
- Reference tone принудительно останавливался через 2 секунды — теперь честный toggle.

**Tauri / Desktop**
- Плейсхолдер-иконки (1 пиксель). Оставили, но добавили beforeDevCommand и beforeBuildCommand для удобства.
- Сборка desktop теперь может запускаться одной командой.

### Если бы делал с нуля — что сделал бы по-другому

1. **Монорепо + workspaces** (pnpm): `packages/tuner-core` (чистые функции + тесты), `apps/web`, `apps/desktop`.
2. **Core вынесен полностью** — pitch detection + Note math с unit-тестами на синтетических сигналах (110Hz, 82.4Hz и т.д.).
3. **AudioWorklet** вместо RAF + getFloatTimeDomainData в главном потоке (отказ от блокировки UI).
4. **Лучший алгоритм**: не чистая автокорреляция, а YIN или MPM (гораздо стабильнее на реальных гитарах).
5. **Больше компонентов + composables**: useAudioInput, usePitchDetector, useTunerState.
6. **Визуализация**: лёгкий canvas waveform + опционально FFT.
7. **Tunings как данные**: массив пресетов (Standard, Drop D, DADGAD...), выбор + редактор.
8. **PWA + оффлайн** для web версии.
9. **Для Rust desktop**: опционально нативный захват через cpal + передача pitch через события (для тех, кому важна "настоящая Rust часть").
10. **Accessibility + i18n** + клавиатурные сокращения (space, 1-6).
11. **Стабильность чтения**: доверие (confidence), индикатор "держи" (стабильно 300мс).

Текущая версия — egui везде (натив + веб).

Переход завершён:
- Вся логика (pitch, notes, tunings, engine, spectrum) в pitch-core.
- UI в egui (waveform, spectrum с гармониками, spectrogram heatmap, cents history, device selection).
- Веб — хост для egui wasm + JS для захвата микрофона и feed в Rust.
- Tauri может использовать тот же веб хост или остаться на Vue как опция.

Сборка egui wasm: npm run build:egui-wasm (в web).

Натив: cargo run -p guitar-tuner-egui.

## Следующие улучшения (рекомендуемые)

- AudioWorklet для обработки звука вне основного потока
- Дополнительные строи + кастомный редактор
- Полноценный Service Worker для offline PWA
- Качественные иконки для desktop: `cd desktop && npx tauri icon path/to/512.png`
- Опционально: Rust аудио бэкенд (cpal) для desktop версии

---

Сделано на Vue + Rust (Tauri). Работает везде.