mod app;
mod audio;
mod diagnostics;
mod state;
mod visualization;

use app::App;

#[cfg(target_arch = "wasm32")]
use pitch_core::{TunerEngine, TunerUpdate};
#[cfg(target_arch = "wasm32")]
use state::{SharedTunerState, TunerViewState};
#[cfg(target_arch = "wasm32")]
use std::sync::{Arc, Mutex, OnceLock};

#[cfg(target_arch = "wasm32")]
const PREFERRED_SAMPLE_RATE: f32 = 48_000.0;

#[cfg(target_arch = "wasm32")]
static WEB_ENGINE: OnceLock<Arc<Mutex<TunerEngine>>> = OnceLock::new();
#[cfg(target_arch = "wasm32")]
static WEB_STATE: OnceLock<SharedTunerState> = OnceLock::new();

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn feed_audio_samples(samples: &[f32]) {
    if samples.len() < 2_048 {
        return;
    }
    let waveform = &samples[..2_048];
    let frame = WEB_ENGINE
        .get()
        .and_then(|engine| engine.lock().ok())
        .map(|mut engine| engine.process(waveform, PREFERRED_SAMPLE_RATE))
        .unwrap_or_else(TunerUpdate::default);
    if let Some(state) = WEB_STATE.get() {
        if let Ok(mut state) = state.lock() {
            state.apply(frame, waveform, PREFERRED_SAMPLE_RATE);
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([720.0, 720.0])
            .with_min_inner_size([520.0, 600.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Guitar Tuner",
        options,
        Box::new(|creation_context| {
            let mut app = App::default();
            app.restore(creation_context.storage);
            app.refresh_devices();
            Box::new(app)
        }),
    )
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    let engine = WEB_ENGINE
        .get_or_init(|| Arc::new(Mutex::new(TunerEngine::new(440.0))))
        .clone();
    let state = WEB_STATE
        .get_or_init(|| Arc::new(Mutex::new(TunerViewState::default())))
        .clone();
    wasm_bindgen_futures::spawn_local(async move {
        eframe::WebRunner::new()
            .start(
                "the_canvas_id",
                eframe::WebOptions::default(),
                Box::new(move |_creation_context| {
                    let mut app = App::default();
                    app.use_shared_state(state.clone(), engine.clone());
                    Box::new(app)
                }),
            )
            .await
            .expect("failed to start eframe");
    });
}

#[cfg(target_arch = "wasm32")]
fn main() {}
