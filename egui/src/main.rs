#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]

mod app;
mod audio;
mod diagnostics;
mod state;
mod visualization;

use app::App;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        renderer: eframe::Renderer::Wgpu,
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
