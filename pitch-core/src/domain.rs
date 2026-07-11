// Domain layer - pure types and math, no I/O, no DSP algorithms.
// Can be no_std in future.

#[derive(Clone, Debug, PartialEq)]
pub struct Note {
    pub name: &'static str,
    pub octave: i32,
    pub frequency: f32,
}

#[derive(Clone, Debug)]
pub struct Tuning {
    pub name: &'static str,
    pub strings: Vec<Note>,
}

include!(concat!(env!("OUT_DIR"), "/music_registry.rs"));

fn equal_tempered_note(name: &'static str, octave: i32) -> Note {
    let index = NOTE_NAMES
        .iter()
        .position(|&candidate| candidate == name)
        .unwrap_or(0);
    let midi = (octave + 1) * 12 + index as i32;
    Note {
        name,
        octave,
        frequency: midi_to_frequency(midi as f32, 440.0),
    }
}

fn equal_tempered_notes(spec: &[(&'static str, i32)]) -> Vec<Note> {
    spec.iter()
        .map(|&(name, octave)| equal_tempered_note(name, octave))
        .collect()
}

pub fn midi_to_frequency(midi: f32, a4: f32) -> f32 {
    a4 * 2f32.powf((midi - 69.0) / 12.0)
}

pub fn frequency_to_midi(freq: f32, a4: f32) -> f32 {
    69.0 + 12.0 * (freq / a4).log2()
}

pub fn frequency_to_note(freq: f32, a4: f32) -> (String, f32) {
    if freq < 20.0 {
        return ("—".to_string(), 0.0);
    }
    let midi = frequency_to_midi(freq, a4);
    let r = midi.round() as i32;
    let idx = ((r % 12 + 12) % 12) as usize;
    let oct = r / 12 - 1;
    let target = midi_to_frequency(r as f32, a4);
    let cents = 1200.0 * (freq / target).log2();
    (format!("{}{}", NOTE_NAMES[idx], oct), cents)
}

pub fn get_cents(frequency: f32, target_frequency: f32) -> f32 {
    if frequency <= 0.0 || target_frequency <= 0.0 {
        return 0.0;
    }
    1200.0 * (frequency / target_frequency).log2()
}

pub fn find_closest_string(frequency: f32, strings: &[Note], a4: f32) -> Note {
    if frequency <= 0.0 || strings.is_empty() {
        return strings.first().cloned().unwrap_or(Note {
            name: "E",
            octave: 2,
            frequency: 82.4069,
        });
    }
    let ratio = a4 / 440.0;
    let mut closest = strings[0].clone();
    let mut min_diff = f32::INFINITY;
    for s in strings {
        let scaled = s.frequency * ratio;
        let diff = (frequency / scaled).log2().abs();
        if diff < min_diff {
            min_diff = diff;
            closest = Note {
                name: s.name,
                octave: s.octave,
                frequency: scaled,
            };
        }
    }
    closest
}

pub fn get_note_display(note: &Note) -> String {
    format!("{}{}", note.name, note.octave)
}

pub fn format_freq(f: f32) -> String {
    format!("{:.1}", f)
}
