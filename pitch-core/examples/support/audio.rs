use std::error::Error;
use std::io::{Error as IoError, ErrorKind};
use std::path::Path;

pub struct AudioCapture {
    pub samples: Vec<f32>,
    pub sample_rate: f32,
}

pub fn read_capture(
    path: &Path,
    expected_sample_rate: f32,
) -> Result<AudioCapture, Box<dyn Error>> {
    let capture = read_capture_with_raw_rate(path, Some(expected_sample_rate))?;
    if (capture.sample_rate - expected_sample_rate).abs() > 0.5 {
        return Err(invalid_input(format!(
            "capture sample rate {} does not match expected sample rate {expected_sample_rate}",
            capture.sample_rate
        )));
    }
    Ok(capture)
}

pub fn read_capture_with_raw_rate(
    path: &Path,
    raw_sample_rate: Option<f32>,
) -> Result<AudioCapture, Box<dyn Error>> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default();
    if extension.eq_ignore_ascii_case("wav") {
        read_wav(path)
    } else {
        let sample_rate = raw_sample_rate
            .filter(|value| value.is_finite() && *value > 0.0)
            .ok_or_else(|| invalid_input("raw f32 capture requires a positive sample rate"))?;
        Ok(AudioCapture {
            samples: read_f32_samples(path)?,
            sample_rate,
        })
    }
}

fn read_f32_samples(path: &Path) -> Result<Vec<f32>, Box<dyn Error>> {
    let bytes = std::fs::read(path)?;
    if bytes.len() % 4 != 0 {
        return Err(invalid_input(
            "raw capture length must be divisible by four bytes",
        ));
    }
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();
    validate_samples(samples)
}

fn read_wav(path: &Path) -> Result<AudioCapture, Box<dyn Error>> {
    let mut reader = hound::WavReader::open(path)?;
    let spec = reader.spec();
    if spec.channels == 0 || spec.sample_rate == 0 {
        return Err(invalid_input(
            "WAV channels and sample rate must be positive",
        ));
    }

    let interleaved = match spec.sample_format {
        hound::SampleFormat::Float if spec.bits_per_sample == 32 => {
            reader.samples::<f32>().collect::<Result<Vec<_>, _>>()?
        }
        hound::SampleFormat::Float => {
            return Err(invalid_input("only 32-bit float WAV is supported"));
        }
        hound::SampleFormat::Int if (1..=32).contains(&spec.bits_per_sample) => {
            let scale = 2.0_f32.powi(i32::from(spec.bits_per_sample) - 1);
            reader
                .samples::<i32>()
                .map(|sample| sample.map(|value| value as f32 / scale))
                .collect::<Result<Vec<_>, _>>()?
        }
        hound::SampleFormat::Int => {
            return Err(invalid_input("WAV integer bit depth must be in 1..=32"));
        }
    };

    let channels = usize::from(spec.channels);
    if interleaved.len() % channels != 0 {
        return Err(invalid_input("WAV ends with an incomplete channel frame"));
    }
    let samples = interleaved
        .chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect();

    Ok(AudioCapture {
        samples: validate_samples(samples)?,
        sample_rate: spec.sample_rate as f32,
    })
}

fn validate_samples(samples: Vec<f32>) -> Result<Vec<f32>, Box<dyn Error>> {
    if samples.is_empty() {
        return Err(invalid_input("capture must contain at least one sample"));
    }
    if samples.iter().any(|sample| !sample.is_finite()) {
        return Err(invalid_input("capture contains non-finite samples"));
    }
    Ok(samples)
}

fn invalid_input(message: impl Into<String>) -> Box<dyn Error> {
    Box::new(IoError::new(ErrorKind::InvalidInput, message.into()))
}
