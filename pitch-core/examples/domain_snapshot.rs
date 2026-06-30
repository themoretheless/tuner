use pitch_core::{find_closest_string, frequency_to_note, get_cents, get_tunings, Note};
use serde_json::{json, Value};

fn note_json(note: &Note) -> Value {
    json!({
        "name": note.name,
        "octave": note.octave,
        "frequency": note.frequency,
    })
}

fn main() {
    let tunings = get_tunings();
    let standard = tunings
        .iter()
        .find(|tuning| tuning.name == "Standard (EADGBE)")
        .expect("standard tuning must exist");

    let frequency_samples = [
        (73.4162_f32, 440.0_f32),
        (82.4069, 440.0),
        (110.0, 440.0),
        (261.6256, 440.0),
        (440.0, 440.0),
        (445.0, 440.0),
        (442.0, 442.0),
        (432.0, 432.0),
    ]
    .into_iter()
    .map(|(frequency, a4)| {
        let (note, cents) = frequency_to_note(frequency, a4);
        json!({
            "frequency": frequency,
            "a4": a4,
            "note": note,
            "cents": cents,
        })
    })
    .collect::<Vec<_>>();

    let closest_string_samples = [82.4069_f32, 111.0, 247.0, 330.0]
        .into_iter()
        .map(|frequency| {
            let note = find_closest_string(frequency, &standard.strings, 440.0);
            json!({
                "frequency": frequency,
                "a4": 440.0_f32,
                "tuning": standard.name,
                "note": note_json(&note),
                "cents": get_cents(frequency, note.frequency),
            })
        })
        .collect::<Vec<_>>();

    let snapshot = json!({
        "tunings": tunings
            .iter()
            .map(|tuning| json!({
                "name": tuning.name,
                "strings": tuning.strings.iter().map(note_json).collect::<Vec<_>>(),
            }))
            .collect::<Vec<_>>(),
        "frequencyToNote": frequency_samples,
        "closestString": closest_string_samples,
    });

    println!(
        "{}",
        serde_json::to_string_pretty(&snapshot).expect("domain snapshot should serialize")
    );
}
