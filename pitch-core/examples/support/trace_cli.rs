use std::error::Error;
use std::path::PathBuf;

pub struct Options {
    pub path: PathBuf,
    pub raw_sample_rate: Option<f32>,
    pub range: Option<(f32, f32)>,
    pub target_frequency: Option<f32>,
    pub max_frames: Option<usize>,
    pub json: bool,
}

pub fn parse_options() -> Result<Options, Box<dyn Error>> {
    let mut args = std::env::args().skip(1);
    let mut path = None;
    let mut raw_sample_rate = None;
    let mut range = None;
    let mut target_frequency = None;
    let mut max_frames = None;
    let mut json = false;

    while let Some(argument) = args.next() {
        match argument.as_str() {
            "--json" => json = true,
            "--sample-rate" => raw_sample_rate = Some(parse_positive(args.next(), "sample rate")?),
            "--range" => {
                let minimum = parse_positive(args.next(), "minimum frequency")?;
                let maximum = parse_positive(args.next(), "maximum frequency")?;
                if maximum <= minimum {
                    return Err("maximum frequency must exceed minimum frequency".into());
                }
                range = Some((minimum, maximum));
            }
            "--target" => target_frequency = Some(parse_positive(args.next(), "target frequency")?),
            "--max-frames" => {
                max_frames = Some(parse_positive_usize(args.next(), "maximum frames")?)
            }
            "-h" | "--help" => return Err(usage().into()),
            value if value.starts_with('-') => {
                return Err(format!("unknown option {value}\n{}", usage()).into());
            }
            value if path.is_none() => path = Some(PathBuf::from(value)),
            _ => return Err(usage().into()),
        }
    }

    let path = path.ok_or_else(|| usage().to_string())?;
    if let (Some((minimum, maximum)), Some(target)) = (range, target_frequency) {
        if !(minimum..=maximum).contains(&target) {
            return Err("target frequency must be inside the detector range".into());
        }
    }

    Ok(Options {
        path,
        raw_sample_rate,
        range,
        target_frequency,
        max_frames,
        json,
    })
}

fn parse_positive(value: Option<String>, label: &str) -> Result<f32, Box<dyn Error>> {
    let parsed = value
        .ok_or_else(|| format!("missing {label}\n{}", usage()))?
        .parse::<f32>()?;
    if parsed.is_finite() && parsed > 0.0 {
        Ok(parsed)
    } else {
        Err(format!("{label} must be positive").into())
    }
}

fn parse_positive_usize(value: Option<String>, label: &str) -> Result<usize, Box<dyn Error>> {
    let parsed = value
        .ok_or_else(|| format!("missing {label}\n{}", usage()))?
        .parse::<usize>()?;
    if parsed > 0 {
        Ok(parsed)
    } else {
        Err(format!("{label} must be positive").into())
    }
}

fn usage() -> &'static str {
    "usage: trace <capture.wav|capture.f32le> [--sample-rate HZ] [--range MIN MAX] [--target HZ] [--max-frames COUNT] [--json]"
}
