use pitch_core::{
    apply_cents_offset_frequency, closest_note_index, frequency_to_nearest_midi, frequency_to_note,
    get_cents, get_note_display, midi_to_frequency, note_name_from_midi, octave_from_midi, Note,
};

#[test]
fn equal_tempered_notes_round_trip_across_references_and_range() {
    for a4 in (415..=465).step_by(5) {
        let a4 = a4 as f32;
        for midi in 21..=120 {
            let frequency = midi_to_frequency(midi as f32, a4);
            assert_eq!(frequency_to_nearest_midi(frequency, a4), midi);

            let expected = Note {
                name: note_name_from_midi(midi),
                octave: octave_from_midi(midi),
                frequency,
            };
            let (display, cents) = frequency_to_note(frequency, a4);
            assert_eq!(display, get_note_display(&expected));
            assert!(cents.abs() < 0.001, "midi={midi}, a4={a4}, cents={cents}");
        }
    }
}

#[test]
fn cents_offsets_round_trip_and_preserve_direction() {
    for frequency in [27.5_f32, 82.4069, 440.0, 4_186.009] {
        for cents in [-50.0_f32, -25.0, -1.0, 0.0, 1.0, 25.0, 50.0] {
            let shifted = apply_cents_offset_frequency(frequency, cents);
            let recovered = get_cents(shifted, frequency);
            assert!(
                (recovered - cents).abs() < 0.002,
                "frequency={frequency}, cents={cents}, recovered={recovered}"
            );
        }
    }
}

#[test]
fn closest_note_and_invalid_input_contracts_are_total() {
    let targets = [
        Note {
            name: "A",
            octave: 2,
            frequency: 110.0,
        },
        Note {
            name: "A",
            octave: 3,
            frequency: 220.0,
        },
    ];

    assert_eq!(closest_note_index(112.0, &targets, 1.0), Some(0));
    assert_eq!(closest_note_index(218.0, &targets, 1.0), Some(1));
    assert_eq!(closest_note_index(f32::NAN, &targets, 1.0), None);
    assert_eq!(closest_note_index(110.0, &targets, 0.0), None);
    assert_eq!(midi_to_frequency(69.0, f32::NAN), 0.0);
    assert_eq!(get_cents(0.0, 440.0), 0.0);
    assert_eq!(frequency_to_note(440.0, 0.0), ("—".to_string(), 0.0));
}
