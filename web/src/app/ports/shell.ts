import type { ReadableValue } from '../../application/ports/value';
import type { SessionStatus } from '../../session/sessionLifecycle';
import type { DetectorBackend } from '../../types/detectorBackend';
import type { Note } from '../../utils/notes';
import type { LayoutMode, ThemeMode } from '../../utils/settingsStorage';

export interface ShellPort {
  detectorBackend: ReadableValue<DetectorBackend>;
  isListening: ReadableValue<boolean>;
  layoutMode: ReadableValue<LayoutMode>;
  leftHanded: ReadableValue<boolean>;
  sessionStatus: ReadableValue<SessionStatus>;
  setLayoutMode(value: unknown): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  toggle(): Promise<void>;
  strings: ReadableValue<Note[]>;
  themeMode: ReadableValue<ThemeMode>;
  toggleReferenceTone(): Promise<void>;
  toggleString(note: Note, index?: number): void;
}
