use super::manifest::invalid_input;
use std::error::Error;
use std::path::PathBuf;

pub struct Command {
    pub check: bool,
    pub mode: CommandMode,
}

pub enum CommandMode {
    Single { capture: PathBuf, scenario: PathBuf },
    Corpus { manifest: PathBuf },
}

impl Command {
    pub fn parse() -> Result<Self, Box<dyn Error>> {
        let mut args = std::env::args().skip(1);
        let mut check = false;
        let mut corpus = None;
        let mut positional = Vec::new();

        while let Some(argument) = args.next() {
            match argument.as_str() {
                "--check" => check = true,
                "--corpus" => {
                    let path = args.next().ok_or_else(|| invalid_input(usage()))?;
                    if corpus.replace(PathBuf::from(path)).is_some() {
                        return Err(invalid_input("--corpus may only be supplied once"));
                    }
                }
                "-h" | "--help" => return Err(invalid_input(usage())),
                value if value.starts_with('-') => {
                    return Err(invalid_input(format!(
                        "unknown option {value}\n{}",
                        usage()
                    )));
                }
                value => positional.push(PathBuf::from(value)),
            }
        }

        let mode = match (corpus, positional.as_slice()) {
            (Some(manifest), []) => CommandMode::Corpus { manifest },
            (None, [capture, scenario]) => CommandMode::Single {
                capture: capture.clone(),
                scenario: scenario.clone(),
            },
            _ => return Err(invalid_input(usage())),
        };
        Ok(Self { check, mode })
    }
}

fn usage() -> &'static str {
    "usage: quality [--check] <capture.wav|capture.f32le> <scenario.json>\n       quality [--check] --corpus <manifest.json>"
}
