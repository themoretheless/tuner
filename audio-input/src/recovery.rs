//! Stream-loss recovery state machine for the native audio input.
//!
//! Pure, allocation-free-after-construction decision logic with no dependency
//! on cpal or real audio devices, so it is fully unit-testable. The supervisor
//! in `lib.rs` drives it from cpal error callbacks and a stall watchdog.
//!
//! Stable telemetry codes are part of the shared cross-platform diagnostics
//! contract (web/src/domain/diagnostics.ts); they travel over the Tauri event
//! wire and are matched by name on every platform.

use std::time::Duration;

pub const BACKEND_STREAM_LOST: &str = "backend-stream-lost";
pub const BACKEND_RECOVERY_ATTEMPTED: &str = "backend-recovery-attempted";
pub const BACKEND_RECOVERY_SUCCEEDED: &str = "backend-recovery-succeeded";
pub const BACKEND_RECOVERY_FAILED: &str = "backend-recovery-failed";

/// Typed recovery telemetry event emitted by the supervised input stream.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RecoveryEvent {
    /// The running stream died (cpal error) or stalled (no data watchdog).
    StreamLost { reason: String },
    /// A stream reopen attempt is about to start (1-based attempt number).
    Attempted { attempt: u32, max_attempts: u32 },
    /// A reopen attempt produced a playing stream again.
    Succeeded { attempt: u32 },
    /// All attempts are exhausted; the session cannot continue.
    Failed { reason: String, attempts: u32 },
}

impl RecoveryEvent {
    /// Stable diagnostic code for the shared contract.
    pub fn code(&self) -> &'static str {
        match self {
            RecoveryEvent::StreamLost { .. } => BACKEND_STREAM_LOST,
            RecoveryEvent::Attempted { .. } => BACKEND_RECOVERY_ATTEMPTED,
            RecoveryEvent::Succeeded { .. } => BACKEND_RECOVERY_SUCCEEDED,
            RecoveryEvent::Failed { .. } => BACKEND_RECOVERY_FAILED,
        }
    }
}

/// What the supervisor should do next for the current outage.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RecoveryStep {
    /// Schedule reopen attempt `attempt` (1-based) after `delay`.
    Retry { attempt: u32, delay: Duration },
    /// No attempts left; surface a fatal typed error.
    GiveUp,
}

/// Recovery policy: how many reopen attempts and with which backoff.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RecoveryPolicy {
    pub max_attempts: u32,
    /// Backoff between attempts; the last value is repeated when there are
    /// more attempts than entries.
    pub backoff: Vec<Duration>,
    /// No audio data for this long while playing counts as a lost stream.
    pub stall_timeout: Duration,
    /// Supervisor watchdog tick.
    pub tick: Duration,
}

impl Default for RecoveryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            backoff: vec![
                Duration::from_millis(250),
                Duration::from_secs(1),
                Duration::from_secs(2),
            ],
            stall_timeout: Duration::from_secs(2),
            tick: Duration::from_millis(100),
        }
    }
}

/// State machine for one supervised stream.
///
/// States: Stable (frames flowing) → Recovering (attempts 1..=max) →
/// Exhausted (fatal, terminal until `recovered` is signalled by real
/// progress). Attempt counters reset only when audio data actually flows
/// again, so a reopened-but-dead stream keeps counting against the budget.
#[derive(Clone, Debug)]
pub struct RecoveryMachine {
    max_attempts: u32,
    backoff: Vec<Duration>,
    /// Reopen attempts already made for the current outage.
    attempts: u32,
    exhausted: bool,
}

impl RecoveryMachine {
    pub fn new(max_attempts: u32, backoff: Vec<Duration>) -> Self {
        Self {
            max_attempts,
            backoff,
            attempts: 0,
            exhausted: false,
        }
    }

    /// The stream was lost (error callback or stall watchdog).
    pub fn stream_lost(&mut self) -> RecoveryStep {
        if self.exhausted {
            return RecoveryStep::GiveUp;
        }
        self.schedule_next()
    }

    /// The current reopen attempt failed (build or play error).
    pub fn attempt_failed(&mut self) -> RecoveryStep {
        self.attempts += 1;
        self.schedule_next()
    }

    /// The current reopen attempt produced a playing stream. The budget
    /// stays consumed until real audio progress is observed (`recovered`),
    /// so a reopened-but-dead stream keeps counting against the attempts.
    pub fn attempt_succeeded(&mut self) {
        self.attempts += 1;
    }

    /// Real audio data is flowing again: the outage is over.
    pub fn recovered(&mut self) {
        self.attempts = 0;
        self.exhausted = false;
    }

    pub fn is_exhausted(&self) -> bool {
        self.exhausted
    }

    pub fn attempts(&self) -> u32 {
        self.attempts
    }

    pub fn max_attempts(&self) -> u32 {
        self.max_attempts
    }

    fn schedule_next(&mut self) -> RecoveryStep {
        let next = self.attempts + 1;
        if next > self.max_attempts {
            self.exhausted = true;
            return RecoveryStep::GiveUp;
        }
        let index = usize::try_from(next - 1).unwrap_or(0);
        let delay = self
            .backoff
            .get(index)
            .or_else(|| self.backoff.last())
            .copied()
            .unwrap_or(Duration::ZERO);
        RecoveryStep::Retry {
            attempt: next,
            delay,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn machine() -> RecoveryMachine {
        RecoveryMachine::new(
            3,
            vec![
                Duration::from_millis(250),
                Duration::from_secs(1),
                Duration::from_secs(2),
            ],
        )
    }

    #[test]
    fn first_loss_schedules_first_attempt_with_initial_backoff() {
        let mut machine = machine();
        assert_eq!(
            machine.stream_lost(),
            RecoveryStep::Retry {
                attempt: 1,
                delay: Duration::from_millis(250),
            }
        );
    }

    #[test]
    fn attempts_walk_the_backoff_and_then_give_up() {
        let mut machine = machine();
        assert!(matches!(
            machine.stream_lost(),
            RecoveryStep::Retry { attempt: 1, .. }
        ));
        assert_eq!(
            machine.attempt_failed(),
            RecoveryStep::Retry {
                attempt: 2,
                delay: Duration::from_secs(1),
            }
        );
        assert_eq!(
            machine.attempt_failed(),
            RecoveryStep::Retry {
                attempt: 3,
                delay: Duration::from_secs(2),
            }
        );
        assert_eq!(machine.attempt_failed(), RecoveryStep::GiveUp);
        assert!(machine.is_exhausted());
        assert_eq!(machine.attempts(), 3);
    }

    #[test]
    fn exhausted_machine_keeps_giving_up_until_progress_resets_it() {
        let mut machine = RecoveryMachine::new(1, vec![Duration::from_millis(10)]);
        assert!(matches!(
            machine.stream_lost(),
            RecoveryStep::Retry { attempt: 1, .. }
        ));
        assert_eq!(machine.attempt_failed(), RecoveryStep::GiveUp);
        assert_eq!(machine.stream_lost(), RecoveryStep::GiveUp);

        machine.recovered();
        assert!(!machine.is_exhausted());
        assert_eq!(machine.attempts(), 0);
        assert!(matches!(
            machine.stream_lost(),
            RecoveryStep::Retry { attempt: 1, .. }
        ));
    }

    #[test]
    fn reopened_but_still_dead_stream_does_not_reset_the_budget() {
        // Reopen "succeeded" at the transport level but no frames arrive:
        // the next stream_lost must continue the same outage, not restart it.
        let mut machine = machine();
        assert!(matches!(
            machine.stream_lost(),
            RecoveryStep::Retry { attempt: 1, .. }
        ));
        machine.attempt_succeeded();
        assert!(matches!(
            machine.stream_lost(),
            RecoveryStep::Retry { attempt: 2, .. }
        ));
        machine.attempt_succeeded();
        assert!(matches!(
            machine.stream_lost(),
            RecoveryStep::Retry { attempt: 3, .. }
        ));
        machine.attempt_succeeded();
        assert_eq!(machine.stream_lost(), RecoveryStep::GiveUp);
    }

    #[test]
    fn zero_attempt_policy_gives_up_immediately() {
        let mut machine = RecoveryMachine::new(0, Vec::new());
        assert_eq!(machine.stream_lost(), RecoveryStep::GiveUp);
        assert!(machine.is_exhausted());
    }

    #[test]
    fn missing_backoff_entries_fall_back_to_last_value() {
        let mut machine = RecoveryMachine::new(3, vec![Duration::from_millis(40)]);
        assert_eq!(
            machine.stream_lost(),
            RecoveryStep::Retry {
                attempt: 1,
                delay: Duration::from_millis(40),
            }
        );
        assert_eq!(
            machine.attempt_failed(),
            RecoveryStep::Retry {
                attempt: 2,
                delay: Duration::from_millis(40),
            }
        );
    }

    #[test]
    fn recovery_events_carry_stable_contract_codes() {
        assert_eq!(
            RecoveryEvent::StreamLost {
                reason: "x".to_string()
            }
            .code(),
            BACKEND_STREAM_LOST
        );
        assert_eq!(
            RecoveryEvent::Attempted {
                attempt: 1,
                max_attempts: 3
            }
            .code(),
            BACKEND_RECOVERY_ATTEMPTED
        );
        assert_eq!(
            RecoveryEvent::Succeeded { attempt: 2 }.code(),
            BACKEND_RECOVERY_SUCCEEDED
        );
        assert_eq!(
            RecoveryEvent::Failed {
                reason: "x".to_string(),
                attempts: 3
            }
            .code(),
            BACKEND_RECOVERY_FAILED
        );
    }
}
