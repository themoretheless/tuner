# Icons

Есть базовый icon.svg (простой дизайн с нотой).

Для производства:

1. Используй `icon.svg` как основу или замени на свой 1024x1024 PNG/SVG.
2. Запусти из root или desktop:

```bash
cd desktop
npm run icon ./src-tauri/icons/icon.svg
```

Это сгенерирует все platform-specific иконки (ico, icns, pngs) для Windows, macOS, Linux.

Затем rebuild.