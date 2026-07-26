import type { ShellPort } from '../../../app/ports/shell';
import type { DisplayCapability } from '../capabilities/display';
import type {
  ListeningCapability,
  ReferenceToneCapability,
  SessionCapability,
} from '../capabilities/session';
import type { TuningCapability } from '../capabilities/tuning';

interface Dependencies {
  display: Pick<DisplayCapability, 'layoutMode' | 'leftHanded' | 'setLayoutMode' | 'themeMode'>;
  listening: Pick<ListeningCapability, 'start' | 'stop' | 'toggle'>;
  referenceTone: Pick<ReferenceToneCapability, 'toggleReferenceTone'>;
  session: Pick<SessionCapability, 'detectorBackend' | 'diagnostics' | 'isListening' | 'status'>;
  tuning: Pick<TuningCapability, 'strings' | 'toggleString'>;
}

export function createShellPort(
  { display, listening, referenceTone, session, tuning }: Dependencies,
): ShellPort {
  return {
    detectorBackend: session.detectorBackend,
    diagnostics: session.diagnostics,
    isListening: session.isListening,
    layoutMode: display.layoutMode,
    leftHanded: display.leftHanded,
    sessionStatus: session.status,
    setLayoutMode: display.setLayoutMode,
    start: listening.start,
    stop: listening.stop,
    toggle: listening.toggle,
    strings: tuning.strings,
    themeMode: display.themeMode,
    toggleReferenceTone: referenceTone.toggleReferenceTone,
    toggleString: tuning.toggleString,
  };
}
