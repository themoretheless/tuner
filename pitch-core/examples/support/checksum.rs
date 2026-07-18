use sha2::{Digest, Sha256};
use std::error::Error;
use std::path::Path;

pub fn sha256(path: &Path) -> Result<String, Box<dyn Error>> {
    Ok(format!("{:x}", Sha256::digest(std::fs::read(path)?)))
}
