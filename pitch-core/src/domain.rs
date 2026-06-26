// Domain layer - pure types and math, no I/O, no DSP algorithms.
// Can be no_std in future.

const NOTE_NAMES: [&str; 12] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

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

pub const GUITAR_STRINGS_STANDARD: [Note; 6] = [
    Note { name: "E", octave: 2, frequency: 82.4069 },
    Note { name: "A", octave: 2, frequency: 110.0000 },
    Note { name: "D", octave: 3, frequency: 146.8324 },
    Note { name: "G", octave: 3, frequency: 195.9977 },
    Note { name: "B", octave: 3, frequency: 246.9417 },
    Note { name: "E", octave: 4, frequency: 329.6276 },
];

pub fn get_tunings() -> Vec<Tuning> {
    vec![
        Tuning {
            name: "Standard (EADGBE)",
            strings: GUITAR_STRINGS_STANDARD.to_vec(),
        },
        Tuning {
            name: "Drop D (DADGBE)",
            strings: vec![
                Note { name: "D", octave: 2, frequency: 73.4162 },
                Note { name: "A", octave: 2, frequency: 110.0000 },
                Note { name: "D", octave: 3, frequency: 146.8324 },
                Note { name: "G", octave: 3, frequency: 195.9977 },
                Note { name: "B", octave: 3, frequency: 246.9417 },
                Note { name: "E", octave: 4, frequency: 329.6276 },
            ],
        },
        Tuning {
            name: "DADGAD",
            strings: vec![
                Note { name: "D", octave: 2, frequency: 73.4162 },
                Note { name: "A", octave: 2, frequency: 110.0000 },
                Note { name: "D", octave: 3, frequency: 146.8324 },
                Note { name: "G", octave: 3, frequency: 195.9977 },
                Note { name: "A", octave: 3, frequency: 220.0000 },
                Note { name: "D", octave: 4, frequency: 293.6648 },
            ],
        },
        Tuning {
            name: "Open G (DGDGBD)",
            strings: vec![
                Note { name: "D", octave: 2, frequency: 73.4162 },
                Note { name: "G", octave: 2, frequency: 97.9989 },
                Note { name: "D", octave: 3, frequency: 146.8324 },
                Note { name: "G", octave: 3, frequency: 195.9977 },
                Note { name: "B", octave: 3, frequency: 246.9417 },
                Note { name: "D", octave: 4, frequency: 293.6648 },
            ],
        },
        Tuning {
            name: "Open D (DADF#AD)",
            strings: vec![
                Note { name: "D", octave: 2, frequency: 73.4162 },
                Note { name: "A", octave: 2, frequency: 110.0000 },
                Note { name: "D", octave: 3, frequency: 146.8324 },
                Note { name: "F#", octave: 3, frequency: 184.9972 },
                Note { name: "A", octave: 3, frequency: 220.0000 },
                Note { name: "D", octave: 4, frequency: 293.6648 },
            ],
        },
        Tuning {
            name: "Drop C (CGCFAD)",
            strings: vec![
                Note { name: "C", octave: 2, frequency: 65.4064 },
                Note { name: "G", octave: 2, frequency: 97.9989 },
                Note { name: "C", octave: 3, frequency: 130.8128 },
                Note { name: "F", octave: 3, frequency: 174.6141 },
                Note { name: "A", octave: 3, frequency: 220.0000 },
                Note { name: "D", octave: 4, frequency: 293.6648 },
            ],
        },
        Tuning {
            name: "Half Step Down (D# G# C# F# A# D#)",
            strings: vec![
                Note { name: "D#", octave: 2, frequency: 77.7817 },
                Note { name: "G#", octave: 2, frequency: 103.8262 },
                Note { name: "C#", octave: 3, frequency: 138.5913 },
                Note { name: "F#", octave: 3, frequency: 185.0000 },
                Note { name: "A#", octave: 3, frequency: 233.0819 },
                Note { name: "D#", octave: 4, frequency: 311.1270 },
            ],
        },
        Tuning {
            name: "Open E (EBEG#BE)",
            strings: vec![
                Note { name: "E", octave: 2, frequency: 82.4069 },
                Note { name: "B", octave: 2, frequency: 123.4708 },
                Note { name: "E", octave: 3, frequency: 164.8138 },
                Note { name: "G#", octave: 3, frequency: 207.6523 },
                Note { name: "B", octave: 3, frequency: 246.9417 },
                Note { name: "E", octave: 4, frequency: 329.6276 },
            ],
        },
        Tuning {
            name: "Drop B (BF#BEG#C#)",
            strings: vec![
                Note { name: "B", octave: 1, frequency: 61.7354 },
                Note { name: "F#", octave: 2, frequency: 92.4986 },
                Note { name: "B", octave: 2, frequency: 123.4708 },
                Note { name: "E", octave: 3, frequency: 164.8138 },
                Note { name: "G#", octave: 3, frequency: 207.6523 },
                Note { name: "C#", octave: 4, frequency: 277.1826 },
            ],
        },
        Tuning {
            name: "Open C (CGCGCE)",
            strings: vec![
                Note { name: "C", octave: 2, frequency: 65.4064 },
                Note { name: "G", octave: 2, frequency: 97.9989 },
                Note { name: "C", octave: 3, frequency: 130.8128 },
                Note { name: "G", octave: 3, frequency: 195.9977 },
                Note { name: "C", octave: 4, frequency: 261.6256 },
                Note { name: "E", octave: 4, frequency: 329.6276 },
            ],
        },
        Tuning {
            name: "Open A (EAC#EAE)",
            strings: vec![
                Note { name: "E", octave: 2, frequency: 82.4069 },
                Note { name: "A", octave: 2, frequency: 110.0000 },
                Note { name: "C#", octave: 3, frequency: 138.5913 },
                Note { name: "E", octave: 3, frequency: 164.8138 },
                Note { name: "A", octave: 3, frequency: 220.0000 },
                Note { name: "E", octave: 4, frequency: 329.6276 },
            ],
        },
        Tuning {
            name: "Full Step Down (DGCFAD)",
            strings: vec![
                Note { name: "D", octave: 2, frequency: 73.4162 },
                Note { name: "G", octave: 2, frequency: 97.9989 },
                Note { name: "C", octave: 3, frequency: 130.8128 },
                Note { name: "F", octave: 3, frequency: 174.6141 },
                Note { name: "A", octave: 3, frequency: 220.0000 },
                Note { name: "D", octave: 4, frequency: 293.6648 },
            ],
        },
        Tuning {
            name: "Open Gm (DGDGA#D)",
            strings: vec![
                Note { name: "D", octave: 2, frequency: 73.4162 },
                Note { name: "G", octave: 2, frequency: 97.9989 },
                Note { name: "D", octave: 3, frequency: 146.8324 },
                Note { name: "G", octave: 3, frequency: 195.9977 },
                Note { name: "A#", octave: 3, frequency: 233.0819 },
                Note { name: "D", octave: 4, frequency: 293.6648 },
            ],
        },
    ]
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
        return strings.get(0).cloned().unwrap_or(Note { name: "E", octave: 2, frequency: 82.4069 });
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