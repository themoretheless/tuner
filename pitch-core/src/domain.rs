// Domain layer - pure types and math, no I/O, no DSP algorithms.
// Can be no_std in future.

use crate::generated_note_math::{
    closest_frequency_index, format_note_display, frequency_to_nearest_midi, get_cents,
    midi_to_frequency, note_name_from_midi, note_to_midi, octave_from_midi,
};

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
    let midi = note_to_midi(name, octave);
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

pub fn frequency_to_note(freq: f32, a4: f32) -> (String, f32) {
    if !freq.is_finite() || freq < 20.0 || !a4.is_finite() || a4 <= 0.0 {
        return ("—".to_string(), 0.0);
    }
    let midi = frequency_to_nearest_midi(freq, a4);
    let target = Note {
        name: note_name_from_midi(midi),
        octave: octave_from_midi(midi),
        frequency: midi_to_frequency(midi as f32, a4),
    };
    (get_note_display(&target), get_cents(freq, target.frequency))
}

pub fn get_note_display(note: &Note) -> String {
    format_note_display(note.name, note.octave)
}

pub fn closest_note_index(frequency: f32, targets: &[Note], scale: f32) -> Option<usize> {
    closest_frequency_index(
        frequency,
        targets.iter().map(|target| target.frequency),
        scale,
    )
}

pub fn find_closest_string(frequency: f32, strings: &[Note], a4: f32) -> Note {
    if !frequency.is_finite() || frequency <= 0.0 || strings.is_empty() {
        return strings.first().cloned().unwrap_or(Note {
            name: "E",
            octave: 2,
            frequency: 82.4069,
        });
    }
    let ratio = if a4.is_finite() && a4 > 0.0 {
        a4 / 440.0
    } else {
        1.0
    };
    let closest = &strings[closest_note_index(frequency, strings, ratio).unwrap_or(0)];
    Note {
        name: closest.name,
        octave: closest.octave,
        frequency: closest.frequency * ratio,
    }
}
