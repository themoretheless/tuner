# Guitar Tuner - Native egui version

Pure native Rust application using egui for UI and cpal for audio input.

## Run

```bash
cargo run --release
```

## Features (current)
- Real-time pitch detection using YIN
- Note + cents display
- Basic visual cents gauge
- Expanded preset list aligned with the web/Tauri app basics
- Microphone start/stop
- Native `cpal` microphone and speaker I/O
- Optional FFT spectrum panel

This is a lightweight native sibling, not full feature parity with the Vue/Tauri app.
Use the Tauri app for custom tunings, temperaments, themes, instrument profiles,
practice history, and import/export.
