use crate::{
    closest_note_index, find_closest_string, frequency_to_note, get_cents, get_note_display, Note,
    Tuning,
};

const DEFAULT_IN_TUNE_ENTER_CENTS: f32 = 5.0;
const DEFAULT_IN_TUNE_EXIT_CENTS: f32 = 7.0;
const TARGET_SWITCH_MARGIN_CENTS: f32 = 15.0;

#[derive(Clone, Debug, PartialEq)]
pub struct FrameContext {
    pub a4: f32,
    pub display_targets: Vec<Note>,
    pub tuning_targets: Vec<Note>,
    pub selected_target: Option<Note>,
    pub idle_target: Option<Note>,
    pub in_tune_enter_cents: f32,
    pub in_tune_exit_cents: f32,
}

impl Default for FrameContext {
    fn default() -> Self {
        Self {
            a4: 440.0,
            display_targets: Vec::new(),
            tuning_targets: Vec::new(),
            selected_target: None,
            idle_target: None,
            in_tune_enter_cents: DEFAULT_IN_TUNE_ENTER_CENTS,
            in_tune_exit_cents: DEFAULT_IN_TUNE_EXIT_CENTS,
        }
    }
}

impl FrameContext {
    fn normalized(mut self) -> Self {
        if !self.a4.is_finite() {
            self.a4 = 440.0;
        }
        self.a4 = self.a4.clamp(400.0, 480.0);
        self.display_targets.retain(valid_target);
        self.tuning_targets.retain(valid_target);
        self.selected_target = self.selected_target.filter(valid_target);
        self.idle_target = self.idle_target.filter(valid_target);

        if !self.in_tune_enter_cents.is_finite() {
            self.in_tune_enter_cents = DEFAULT_IN_TUNE_ENTER_CENTS;
        }
        if !self.in_tune_exit_cents.is_finite() {
            self.in_tune_exit_cents = DEFAULT_IN_TUNE_EXIT_CENTS;
        }
        self.in_tune_enter_cents = self.in_tune_enter_cents.clamp(0.1, 50.0);
        self.in_tune_exit_cents = self
            .in_tune_exit_cents
            .clamp(self.in_tune_enter_cents, 60.0);
        self
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct FrameResolution {
    pub cents: f32,
    pub in_tune: bool,
    pub note: String,
    pub target: Option<Note>,
}

pub struct FrameResolver {
    a4: f32,
    context: Option<FrameContext>,
    in_tune_stable: bool,
    sticky_display_target: Option<Note>,
    sticky_tuning_target: Option<Note>,
    tuning: Tuning,
}

impl FrameResolver {
    pub fn new(a4: f32, tuning: Tuning, context: Option<FrameContext>) -> Self {
        let mut resolver = Self {
            a4: normalize_a4(a4),
            context: None,
            in_tune_stable: false,
            sticky_display_target: None,
            sticky_tuning_target: None,
            tuning,
        };
        resolver.set_context(context);
        resolver
    }

    pub fn set_a4(&mut self, a4: f32) {
        let a4 = normalize_a4(a4);
        if (self.a4 - a4).abs() > 0.01 {
            self.a4 = a4;
            self.reset();
        }
    }

    pub fn set_tuning(&mut self, tuning: Tuning) {
        self.tuning = tuning;
        self.reset();
    }

    pub fn set_context(&mut self, context: Option<FrameContext>) {
        let context = context.map(FrameContext::normalized);
        if self.context == context {
            return;
        }
        if let Some(context) = &context {
            self.a4 = context.a4;
        }
        self.context = context;
        self.reset();
    }

    pub fn resolve(&mut self, frequency: Option<f32>) -> FrameResolution {
        let Some(frequency) = frequency.filter(|value| value.is_finite() && *value > 0.0) else {
            self.reset();
            return FrameResolution {
                cents: 0.0,
                in_tune: false,
                note: "—".to_string(),
                target: self
                    .context
                    .as_ref()
                    .and_then(|context| context.idle_target.clone()),
            };
        };

        let (fallback_note, fallback_cents) = frequency_to_note(frequency, self.a4);
        let (note, target, cents, enter_cents, exit_cents) = if let Some(context) = &self.context {
            let display_target = sticky_closest_target(
                frequency,
                &context.display_targets,
                &mut self.sticky_display_target,
            );
            let note = display_target
                .as_ref()
                .map(get_note_display)
                .unwrap_or(fallback_note);
            let target = context
                .selected_target
                .clone()
                .or_else(|| {
                    sticky_closest_target(
                        frequency,
                        &context.tuning_targets,
                        &mut self.sticky_tuning_target,
                    )
                })
                .or_else(|| display_target.clone());
            let cents = target.as_ref().map_or(fallback_cents, |target| {
                get_cents(frequency, target.frequency)
            });
            (
                note,
                target,
                cents,
                context.in_tune_enter_cents,
                context.in_tune_exit_cents,
            )
        } else {
            let target = (!self.tuning.strings.is_empty()).then(|| {
                let candidate = find_closest_string(frequency, &self.tuning.strings, self.a4);
                keep_sticky_target(frequency, candidate, &mut self.sticky_tuning_target)
            });
            let cents = target.as_ref().map_or(fallback_cents, |target| {
                get_cents(frequency, target.frequency)
            });
            (
                fallback_note,
                target,
                cents,
                DEFAULT_IN_TUNE_ENTER_CENTS,
                DEFAULT_IN_TUNE_EXIT_CENTS,
            )
        };

        let absolute_cents = cents.abs();
        if absolute_cents < enter_cents {
            self.in_tune_stable = true;
        } else if absolute_cents > exit_cents {
            self.in_tune_stable = false;
        }

        FrameResolution {
            cents,
            in_tune: self.in_tune_stable,
            note,
            target,
        }
    }

    pub fn reset(&mut self) {
        self.in_tune_stable = false;
        self.sticky_display_target = None;
        self.sticky_tuning_target = None;
    }
}

fn closest_target(frequency: f32, targets: &[Note]) -> Option<Note> {
    closest_note_index(frequency, targets, 1.0).map(|index| targets[index].clone())
}

fn sticky_closest_target(
    frequency: f32,
    targets: &[Note],
    previous: &mut Option<Note>,
) -> Option<Note> {
    let Some(candidate) = closest_target(frequency, targets) else {
        *previous = None;
        return None;
    };
    Some(keep_sticky_target(frequency, candidate, previous))
}

fn keep_sticky_target(frequency: f32, candidate: Note, previous: &mut Option<Note>) -> Note {
    let chosen = previous
        .as_ref()
        .filter(|target| valid_target(target))
        .filter(|target| {
            let previous_distance = get_cents(frequency, target.frequency).abs();
            let candidate_distance = get_cents(frequency, candidate.frequency).abs();
            previous_distance - candidate_distance <= TARGET_SWITCH_MARGIN_CENTS
        })
        .cloned()
        .unwrap_or(candidate);
    *previous = Some(chosen.clone());
    chosen
}

fn normalize_a4(a4: f32) -> f32 {
    if a4.is_finite() {
        a4.clamp(400.0, 480.0)
    } else {
        440.0
    }
}

fn valid_target(target: &Note) -> bool {
    target.frequency.is_finite() && target.frequency > 0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(name: &'static str, octave: i32, frequency: f32) -> Note {
        Note {
            name,
            octave,
            frequency,
        }
    }

    fn chromatic_tuning() -> Tuning {
        Tuning {
            name: "Chromatic",
            strings: Vec::new(),
        }
    }

    #[test]
    fn explicit_context_resolves_display_and_selected_targets() {
        let selected = note("A", 4, 442.0);
        let mut resolver = FrameResolver::new(
            440.0,
            chromatic_tuning(),
            Some(FrameContext {
                a4: 442.0,
                display_targets: vec![selected.clone()],
                selected_target: Some(selected.clone()),
                idle_target: Some(selected.clone()),
                ..FrameContext::default()
            }),
        );

        let resolution = resolver.resolve(Some(440.0));
        assert_eq!(resolution.note, "A4");
        assert_eq!(resolution.target, Some(selected.clone()));
        assert!(resolution.cents < -7.0);
        assert!(!resolution.in_tune);

        let idle = resolver.resolve(None);
        assert_eq!(idle.target, Some(selected));
        assert_eq!(idle.note, "—");
    }

    #[test]
    fn in_tune_state_uses_enter_and_exit_hysteresis() {
        let target = note("A", 4, 440.0);
        let mut resolver = FrameResolver::new(
            440.0,
            chromatic_tuning(),
            Some(FrameContext {
                display_targets: vec![target.clone()],
                selected_target: Some(target),
                ..FrameContext::default()
            }),
        );

        assert!(resolver.resolve(Some(cents_above_a4(4.0))).in_tune);
        assert!(resolver.resolve(Some(cents_above_a4(6.0))).in_tune);
        assert!(!resolver.resolve(Some(cents_above_a4(8.0))).in_tune);
        assert!(!resolver.resolve(None).in_tune);
    }

    #[test]
    fn target_selection_is_sticky_around_the_midpoint() {
        let e2 = note("E", 2, 82.4069);
        let a2 = note("A", 2, 110.0);
        let mut resolver = FrameResolver::new(
            440.0,
            chromatic_tuning(),
            Some(FrameContext {
                display_targets: vec![e2.clone(), a2.clone()],
                tuning_targets: vec![e2.clone(), a2.clone()],
                ..FrameContext::default()
            }),
        );

        let below_midpoint = resolver.resolve(Some(95.0));
        assert_eq!(below_midpoint.note, "E2");
        assert_eq!(below_midpoint.target, Some(e2));

        let jitter_above_midpoint = resolver.resolve(Some(95.5));
        assert_eq!(jitter_above_midpoint.note, "E2");
        assert_eq!(
            jitter_above_midpoint.target.as_ref().map(|note| note.name),
            Some("E")
        );

        let decisive_move = resolver.resolve(Some(104.0));
        assert_eq!(decisive_move.note, "A2");
        assert_eq!(decisive_move.target, Some(a2.clone()));

        resolver.resolve(None);
        let fresh_pick = resolver.resolve(Some(95.5));
        assert_eq!(fresh_pick.note, "A2");
        assert_eq!(fresh_pick.target, Some(a2));
    }

    fn cents_above_a4(cents: f32) -> f32 {
        440.0 * 2.0_f32.powf(cents / 1_200.0)
    }
}
