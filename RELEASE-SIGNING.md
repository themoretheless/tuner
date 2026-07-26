# Подпись и нотаризация релизов (M8)

Приложение десктопное (Tauri 2). Автоматическая подпись в CI **не настроена** —
сертификаты и учётные данные хранятся у человека-релизера и в репозиторий не
коммитятся. Этот файл — чек-лист для выпуска подписанных сборок.

Комплектность scaffolding'а проверяется в CI:
`node scripts/check-release-signing.mjs` (workflow `.github/workflows/security.yml`).
Гейт гарантирует: plist-файлы на месте, entitlements минимальны (только
микрофон), плейсхолдеры подписи в `tauri.conf.json` остаются `null`, приватные
ключи не закоммичены.

## macOS (подпись + нотаризация)

Нужно от релизера:

1. **Apple Developer Program** — активная учётная запись (Team ID).
2. **Сертификат "Developer ID Application"** в Keychain релиз-машины.
3. **App-specific password** или API-ключ App Store Connect (`AuthKey_XXXX.p8`)
   для `notarytool`.

Локально (на машине релизера), НЕ коммитя значения в git:

```bash
# 1. Подпись: передать identity через переменные окружения, не через конфиг.
export APPLE_SIGNING_IDENTITY="Developer ID Application: <Имя> (<TEAM_ID>)"

# 2. Нотаризация (tauri >= 2 поддерживает нативно через env):
export APPLE_ID="apple-id@example.com"
export APPLE_PASSWORD="<app-specific password>"
export APPLE_TEAM_ID="<TEAM_ID>"
#   либо вариант с API-ключом: APPLE_API_ISSUER / APPLE_API_KEY / APPLE_API_KEY_PATH

# 3. Сборка (из desktop/):
npm run tauri build -- --target aarch64-apple-darwin --bundles dmg app
# tauri подпишет .app/.dmg и отправит на нотаризацию автоматически,
# если переменные выше заданы.

# 4. Проверка на машине релизера:
codesign --verify --deep --strict --verbose=2 target/release/bundle/macos/*.app
spctl -a -t exec -vv target/release/bundle/macos/*.app   # Gatekeeper: accepted
xcrun stapler validate target/release/bundle/dmg/*.dmg
```

В CI (когда появятся секреты): сохранить сертификат как base64 в GitHub Secrets
(`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`), импортировать в keychain шагом
`apple-actions/import-codesign-certs@v3` в `build-tauri.yml`. **Сейчас этот шаг
намеренно отсутствует.**

`tauri.conf.json` → `bundle.macOS.signingIdentity` / `providerShortName`
намеренно остаются `null` — значения приходят только из окружения.

## Windows (Authenticode)

Нужно от релизера:

1. **EV/OV Code Signing сертификат** (`.pfx` + пароль) или облачная подпись
   (Azure Trusted Signing / DigiCert KeyLocker и т.п.).

Локально:

```powershell
# tauri.conf.json -> bundle.windows.certificateThumbprint остаётся null в git.
# Вариант A: thumbprint сертификата из локального хранилища через env не
# пробрасывается — используйте временный override-конфиг (не коммитить!):
npx tauri build -c '{"bundle":{"windows":{"certificateThumbprint":"<THUMBPRINT>","timestampUrl":"http://timestamp.digicert.com"}}}'
```

В CI (когда появятся секреты): шаг импорта `.pfx`
(`signtool` доступен на windows-latest) или Azure Trusted Signing action.
**Сейчас этот шаг намеренно отсутствует.**

## Entitlements (macOS) — аудит выполнен

`desktop/src-tauri/entitlements.plist` содержит **только**
`com.apple.security.device.audio-input` (микрофон — единственное, что нужно
тюнеру). Сетевые entitlements (`com.apple.security.network.*`) отсутствуют
намеренно — приложение полностью offline (см. zero-network гейт
`scripts/check-no-network.mjs`). Добавление любого нового entitlement требует
обновления allowlist в `scripts/check-release-signing.mjs` с обоснованием.

`desktop/src-tauri/Info.plist` содержит только
`NSMicrophoneUsageDescription` с текстом, объясняющим on-device обработку аудио.
