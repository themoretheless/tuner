# Guitar Tuner - Native egui version

Pure native Rust application using egui with the wgpu renderer. Audio input is
captured by the shared `audio-input` crate (cpal + supervised recovery), and
pitch detection is provided by the shared `pitch-core` crate.

This crate is desktop-native only. Browser builds use the Vue application and
the dedicated `pitch-core` WASM package; the old egui WebRunner/feed path has
been removed.

## Run

```bash
cargo run --release -p guitar-tuner-egui
```

Run the command from the repository root. Build without launching with:

```bash
cargo build --locked --release -p guitar-tuner-egui
```

## Features (current)
- Real-time pitch detection using YIN
- Note + cents display
- Basic visual cents gauge
- Preset list generated from the shared music registry
- Microphone start/stop
- Native `cpal` microphone and speaker I/O
- Optional FFT spectrum panel

This is a lightweight native sibling, not full feature parity with the Vue web
application. Native packaging assets live in `assets/icons/`.
