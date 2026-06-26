mod native_audio;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(native_audio::NativeAudioState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            native_audio::native_audio_available,
            native_audio::set_native_audio_range,
            native_audio::start_native_audio,
            native_audio::stop_native_audio,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
