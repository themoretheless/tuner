use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig};
use std::sync::mpsc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const AUDIO_CHUNK_CAPACITY: usize = 8_192;
const AUDIO_CHUNK_POOL_SIZE: usize = 4;
const DEFAULT_FRAME_INTERVAL: Duration = Duration::from_millis(33);
const DEFAULT_WINDOW_SIZE: usize = 4_096;
const MAX_WINDOW_SIZE: usize = 8_192;

#[derive(Clone, Debug)]
pub struct InputConfig {
    pub device_name: Option<String>,
    pub frame_interval: Duration,
    pub window_size: usize,
}

impl Default for InputConfig {
    fn default() -> Self {
        Self {
            device_name: None,
            frame_interval: DEFAULT_FRAME_INTERVAL,
            window_size: DEFAULT_WINDOW_SIZE,
        }
    }
}

impl InputConfig {
    fn normalized(mut self) -> Self {
        self.window_size = self.window_size.clamp(64, MAX_WINDOW_SIZE);
        if self.frame_interval.is_zero() {
            self.frame_interval = DEFAULT_FRAME_INTERVAL;
        }
        self
    }
}

struct AudioChunk {
    length: usize,
    samples: Box<[f32; AUDIO_CHUNK_CAPACITY]>,
}

impl AudioChunk {
    fn new() -> Self {
        Self {
            length: 0,
            samples: Box::new([0.0; AUDIO_CHUNK_CAPACITY]),
        }
    }
}

struct SampleWindow {
    filled: usize,
    samples: Vec<f32>,
    write_cursor: usize,
}

impl SampleWindow {
    fn new(size: usize) -> Self {
        Self {
            filled: 0,
            samples: vec![0.0; size],
            write_cursor: 0,
        }
    }

    fn push(&mut self, samples: &[f32]) {
        for sample in samples {
            self.samples[self.write_cursor] = *sample;
            self.write_cursor = (self.write_cursor + 1) % self.samples.len();
            self.filled = (self.filled + 1).min(self.samples.len());
        }
    }

    fn copy_ordered(&self, output: &mut [f32]) -> bool {
        if self.filled < self.samples.len() || output.len() != self.samples.len() {
            return false;
        }
        let tail = self.samples.len() - self.write_cursor;
        output[..tail].copy_from_slice(&self.samples[self.write_cursor..]);
        output[tail..].copy_from_slice(&self.samples[..self.write_cursor]);
        true
    }
}

pub struct InputStream {
    processor: Option<JoinHandle<()>>,
    stream: Option<Stream>,
}

impl InputStream {
    pub fn open<FrameHandler, ErrorHandler>(
        config: InputConfig,
        on_frame: FrameHandler,
        on_error: ErrorHandler,
    ) -> Result<Self, String>
    where
        FrameHandler: FnMut(&[f32], f32) + Send + 'static,
        ErrorHandler: FnMut(String) + Send + 'static,
    {
        let config = config.normalized();
        let host = cpal::default_host();
        let device = find_input_device(&host, config.device_name.as_deref())?;
        let supported = device
            .default_input_config()
            .map_err(|error| format!("Could not read microphone config: {error}"))?;
        let sample_format = supported.sample_format();
        let stream_config: StreamConfig = supported.into();
        let sample_rate = stream_config.sample_rate.0 as f32;
        let channels = usize::from(stream_config.channels.max(1));

        let (samples_tx, samples_rx) = mpsc::sync_channel(AUDIO_CHUNK_POOL_SIZE);
        let (pool_tx, pool_rx) = mpsc::sync_channel(AUDIO_CHUNK_POOL_SIZE);
        for _ in 0..AUDIO_CHUNK_POOL_SIZE {
            pool_tx
                .send(AudioChunk::new())
                .map_err(|_| "Could not initialize audio buffer pool")?;
        }

        let processor_pool = pool_tx.clone();
        let processor = thread::spawn(move || {
            process_frames(
                config.window_size,
                config.frame_interval,
                sample_rate,
                samples_rx,
                processor_pool,
                on_frame,
            );
        });
        let stream = build_input_stream(
            &device,
            &stream_config,
            sample_format,
            channels,
            samples_tx,
            pool_rx,
            pool_tx,
            on_error,
        )?;

        Ok(Self {
            processor: Some(processor),
            stream: Some(stream),
        })
    }

    pub fn play(&self) -> Result<(), String> {
        self.stream
            .as_ref()
            .ok_or_else(|| "Audio input stream is closed".to_string())?
            .play()
            .map_err(|error| format!("Could not start microphone stream: {error}"))
    }

    pub fn stop(&mut self) {
        self.stream.take();
        if let Some(processor) = self.processor.take() {
            let _ = processor.join();
        }
    }
}

impl Drop for InputStream {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn default_input_available() -> bool {
    cpal::default_host().default_input_device().is_some()
}

pub fn input_device_names() -> Vec<String> {
    cpal::default_host()
        .input_devices()
        .map(|devices| devices.filter_map(|device| device.name().ok()).collect())
        .unwrap_or_default()
}

fn find_input_device(host: &cpal::Host, selected: Option<&str>) -> Result<cpal::Device, String> {
    if let Some(selected) = selected {
        if let Ok(mut devices) = host.input_devices() {
            if let Some(device) =
                devices.find(|device| device.name().map(|name| name == selected).unwrap_or(false))
            {
                return Ok(device);
            }
        }
        return Err(format!("Input device is no longer available: {selected}"));
    }
    host.default_input_device()
        .ok_or_else(|| "No input microphone found".to_string())
}

#[allow(clippy::too_many_arguments)]
fn build_input_stream<ErrorHandler>(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    channels: usize,
    samples_tx: mpsc::SyncSender<AudioChunk>,
    pool_rx: mpsc::Receiver<AudioChunk>,
    pool_tx: mpsc::SyncSender<AudioChunk>,
    on_error: ErrorHandler,
) -> Result<Stream, String>
where
    ErrorHandler: FnMut(String) + Send + 'static,
{
    match sample_format {
        SampleFormat::I8 => build_typed_input_stream::<i8, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::I16 => build_typed_input_stream::<i16, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::I32 => build_typed_input_stream::<i32, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::I64 => build_typed_input_stream::<i64, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::U8 => build_typed_input_stream::<u8, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::U16 => build_typed_input_stream::<u16, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::U32 => build_typed_input_stream::<u32, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::U64 => build_typed_input_stream::<u64, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::F32 => build_typed_input_stream::<f32, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        SampleFormat::F64 => build_typed_input_stream::<f64, _>(
            device, config, channels, samples_tx, pool_rx, pool_tx, on_error,
        ),
        format => Err(format!("Unsupported microphone sample format: {format}")),
    }
}

fn build_typed_input_stream<T, ErrorHandler>(
    device: &cpal::Device,
    config: &StreamConfig,
    channels: usize,
    samples_tx: mpsc::SyncSender<AudioChunk>,
    pool_rx: mpsc::Receiver<AudioChunk>,
    pool_tx: mpsc::SyncSender<AudioChunk>,
    mut on_error: ErrorHandler,
) -> Result<Stream, String>
where
    T: Sample + SizedSample,
    f32: FromSample<T>,
    ErrorHandler: FnMut(String) + Send + 'static,
{
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                let Ok(mut chunk) = pool_rx.try_recv() else {
                    return;
                };
                chunk.length = 0;
                for frame in data.chunks(channels).take(AUDIO_CHUNK_CAPACITY) {
                    let sum = frame
                        .iter()
                        .map(|sample| f32::from_sample(*sample))
                        .sum::<f32>();
                    chunk.samples[chunk.length] = sum / frame.len() as f32;
                    chunk.length += 1;
                }

                if let Err(error) = samples_tx.try_send(chunk) {
                    let chunk = match error {
                        mpsc::TrySendError::Full(chunk)
                        | mpsc::TrySendError::Disconnected(chunk) => chunk,
                    };
                    let _ = pool_tx.try_send(chunk);
                }
            },
            move |error| on_error(error.to_string()),
            None,
        )
        .map_err(|error| format!("Could not create microphone stream: {error}"))
}

fn process_frames<FrameHandler>(
    window_size: usize,
    frame_interval: Duration,
    sample_rate: f32,
    samples_rx: mpsc::Receiver<AudioChunk>,
    pool_tx: mpsc::SyncSender<AudioChunk>,
    mut on_frame: FrameHandler,
) where
    FrameHandler: FnMut(&[f32], f32),
{
    let mut ring = SampleWindow::new(window_size);
    let mut window = vec![0.0; window_size];
    let mut last_frame = Instant::now() - frame_interval;

    while let Ok(chunk) = samples_rx.recv() {
        ring.push(&chunk.samples[..chunk.length]);
        if last_frame.elapsed() >= frame_interval && ring.copy_ordered(&mut window) {
            last_frame = Instant::now();
            on_frame(&window, sample_rate);
        }
        let _ = pool_tx.send(chunk);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sample_window_preserves_chronological_order_after_wrap() {
        let mut ring = SampleWindow::new(4);
        ring.push(&[1.0, 2.0, 3.0, 4.0, 5.0]);
        let mut output = [0.0; 4];
        assert!(ring.copy_ordered(&mut output));
        assert_eq!(output, [2.0, 3.0, 4.0, 5.0]);
    }

    #[test]
    fn incomplete_window_is_not_emitted() {
        let mut ring = SampleWindow::new(4);
        ring.push(&[1.0, 2.0]);
        assert!(!ring.copy_ordered(&mut [0.0; 4]));
    }
}
