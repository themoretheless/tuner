# Guitar Tuner - Native egui version

Pure native Rust application using egui for UI and cpal for audio input.

## Run

```bash
cargo run --release
```

## Features (current)
- Real-time pitch detection using autocorrelation
- Note + cents display
- Basic visual cents gauge
- 4 common tunings
- Microphone start/stop

This is the recommended offline native version (no webview, small binary).