pub(crate) fn is_likely_power_chord(buffer: &[f32], sample_rate: f32, fundamental: f32) -> bool {
    if fundamental < 40.0 {
        return false;
    }
    let fifth = fundamental * 1.4983;
    let lag = (sample_rate / fifth) as usize;
    if lag < 2 || lag >= buffer.len() / 2 {
        return false;
    }

    let mut correlation = 0.0;
    let mut energy = 0.0;
    let length = 512.min(buffer.len() - lag);
    for index in 0..length {
        let sample = buffer[index];
        correlation += sample * buffer[index + lag];
        energy += sample * sample;
    }
    energy > 0.0 && correlation / energy > 0.5
}
