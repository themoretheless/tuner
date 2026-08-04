# Подпись native-релизов

Desktop-приложение собирается из `egui/` как нативный `eframe`/`wgpu`
executable.

Сейчас `.github/workflows/build-egui.yml` выпускает **неподписанные** пакеты:

- macOS: `.app.zip` без codesign и notarization;
- Windows: portable `.zip` без Authenticode;
- Linux: portable `.tar.gz`.

Поэтому Gatekeeper и SmartScreen могут показывать предупреждение. До настройки
секретов эти пакеты следует считать preview/unsigned distribution.

## macOS

На машине релизера нужен сертификат `Developer ID Application` и доступ к
Apple notarization service. После сборки `cargo build --locked --release -p
guitar-tuner-egui` и создания `.app` тем же layout, что в `build-egui.yml`:

```bash
codesign --force --deep --options runtime \
  --sign "Developer ID Application: <NAME> (<TEAM_ID>)" "Guitar Tuner.app"
codesign --verify --deep --strict --verbose=2 "Guitar Tuner.app"
ditto -c -k --sequesterRsrc --keepParent "Guitar Tuner.app" Guitar-Tuner.zip
xcrun notarytool submit Guitar-Tuner.zip --keychain-profile tuner-notary --wait
xcrun stapler staple "Guitar Tuner.app"
spctl -a -t exec -vv "Guitar Tuner.app"
```

Для CI сертификат и данные notarization должны храниться только в GitHub
Secrets; release job обязан завершаться ошибкой, если signing/notarization
запрошены, но проверка подписи не прошла.

## Windows

Нужен OV/EV code-signing certificate или облачная служба подписи. Подписывать
следует итоговый `guitar-tuner.exe` до упаковки:

```powershell
signtool sign /fd SHA256 /tr <RFC3161_TIMESTAMP_URL> /td SHA256 /a guitar-tuner.exe
signtool verify /pa /v guitar-tuner.exe
```

Сертификат и пароль не коммитятся. После добавления CI signing unsigned package
не должен публиковаться под тем же именем при ошибке подписи.
