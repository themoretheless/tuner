use crate::state::SharedTunerState;
use eframe::egui;
use pitch_core::TunerEngine;
use std::sync::{Arc, Mutex};

#[cfg(not(target_arch = "wasm32"))]
use audio_input::{input_device_names, InputConfig, InputStream};
#[cfg(not(target_arch = "wasm32"))]
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
#[cfg(not(target_arch = "wasm32"))]
use cpal::{FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig};

#[derive(Default)]
pub(crate) struct AudioManager {
    pub(crate) input_devices: Vec<String>,
    pub(crate) selected_input_device: Option<String>,
    #[cfg(not(target_arch = "wasm32"))]
    input: Option<InputStream>,
    #[cfg(not(target_arch = "wasm32"))]
    output: Option<Stream>,
    tone_playing: bool,
}

impl AudioManager {
    #[cfg(not(target_arch = "wasm32"))]
    pub(crate) fn refresh(&mut self) {
        self.input_devices = input_device_names();
    }

    #[cfg(target_arch = "wasm32")]
    pub(crate) fn refresh(&mut self) {}

    #[cfg(not(target_arch = "wasm32"))]
    pub(crate) fn start_input(
        &mut self,
        state: SharedTunerState,
        engine: Arc<Mutex<TunerEngine>>,
        context: egui::Context,
    ) -> Result<(), String> {
        self.stop_input();
        let error_state = state.clone();
        let frame_context = context.clone();
        let input = InputStream::open(
            InputConfig {
                device_name: self.selected_input_device.clone(),
                ..InputConfig::default()
            },
            move |samples, sample_rate| {
                let frame = match engine.lock() {
                    Ok(mut engine) => engine.process(samples, sample_rate),
                    Err(_) => return,
                };
                if let Ok(mut state) = state.lock() {
                    state.apply(frame, samples, sample_rate);
                }
                frame_context.request_repaint();
            },
            move |error| {
                if let Ok(mut state) = error_state.lock() {
                    state.error = Some(error);
                }
                context.request_repaint();
            },
        )?;
        input.play()?;
        self.input = Some(input);
        Ok(())
    }

    #[cfg(target_arch = "wasm32")]
    pub(crate) fn start_input(
        &mut self,
        _state: SharedTunerState,
        _engine: Arc<Mutex<TunerEngine>>,
        _context: egui::Context,
    ) -> Result<(), String> {
        Ok(())
    }

    pub(crate) fn stop_input(&mut self) {
        #[cfg(not(target_arch = "wasm32"))]
        if let Some(mut input) = self.input.take() {
            input.stop();
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub(crate) fn play_tone(&mut self, frequency: f32) -> Result<(), String> {
        self.stop_tone();
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| "No output device available".to_string())?;
        let supported = device
            .default_output_config()
            .map_err(|error| format!("Could not read output config: {error}"))?;
        let sample_format = supported.sample_format();
        let config: StreamConfig = supported.into();
        let stream = match sample_format {
            SampleFormat::I8 => build_tone_stream::<i8>(&device, &config, frequency),
            SampleFormat::I16 => build_tone_stream::<i16>(&device, &config, frequency),
            SampleFormat::I32 => build_tone_stream::<i32>(&device, &config, frequency),
            SampleFormat::I64 => build_tone_stream::<i64>(&device, &config, frequency),
            SampleFormat::U8 => build_tone_stream::<u8>(&device, &config, frequency),
            SampleFormat::U16 => build_tone_stream::<u16>(&device, &config, frequency),
            SampleFormat::U32 => build_tone_stream::<u32>(&device, &config, frequency),
            SampleFormat::U64 => build_tone_stream::<u64>(&device, &config, frequency),
            SampleFormat::F32 => build_tone_stream::<f32>(&device, &config, frequency),
            SampleFormat::F64 => build_tone_stream::<f64>(&device, &config, frequency),
            format => Err(format!("Unsupported output sample format: {format}")),
        }?;
        stream
            .play()
            .map_err(|error| format!("Could not play reference tone: {error}"))?;
        self.output = Some(stream);
        self.tone_playing = true;
        Ok(())
    }

    #[cfg(target_arch = "wasm32")]
    pub(crate) fn play_tone(&mut self, _frequency: f32) -> Result<(), String> {
        self.tone_playing = true;
        Ok(())
    }

    pub(crate) fn stop_tone(&mut self) {
        #[cfg(not(target_arch = "wasm32"))]
        {
            self.output = None;
        }
        self.tone_playing = false;
    }

    pub(crate) fn is_tone_playing(&self) -> bool {
        self.tone_playing
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn build_tone_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    frequency: f32,
) -> Result<Stream, String>
where
    T: Sample + SizedSample + FromSample<f32>,
{
    let sample_rate = config.sample_rate.0 as f32;
    let channels = usize::from(config.channels.max(1));
    let mut phase = 0.0_f32;
    device
        .build_output_stream(
            config,
            move |data: &mut [T], _| {
                for frame in data.chunks_mut(channels) {
                    let sample = (2.0 * std::f32::consts::PI * phase).sin() * 0.18;
                    for output in frame {
                        *output = T::from_sample(sample);
                    }
                    phase = (phase + frequency / sample_rate).fract();
                }
            },
            |error| eprintln!("reference tone output error: {error}"),
            None,
        )
        .map_err(|error| format!("Could not create reference tone stream: {error}"))
}
