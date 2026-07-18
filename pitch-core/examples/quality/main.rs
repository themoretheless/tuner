//! Run the tuner over one capture or the licensed real-instrument corpus and
//! emit temporal quality metrics as JSON.
//!
//! ```text
//! cargo run -p pitch-core --example quality -- capture.wav scenario.json
//! cargo run -p pitch-core --example quality -- --check --corpus fixtures/corpus/manifest.json
//! ```

#[path = "../support/audio.rs"]
mod audio;
#[path = "../support/checksum.rs"]
mod checksum;
mod cli;
mod manifest;
mod pipeline;
mod report;
mod runner;

use cli::{Command, CommandMode};
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let command = Command::parse()?;
    let (json, passed) = match &command.mode {
        CommandMode::Single { capture, scenario } => {
            runner::run_single(capture, scenario, command.check)?
        }
        CommandMode::Corpus { manifest } => runner::run_corpus(manifest)?,
    };

    println!("{json}");
    if command.check && !passed {
        std::process::exit(2);
    }
    Ok(())
}
