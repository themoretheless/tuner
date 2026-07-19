import type { TuningCommandDependencies } from './tuningCommandPorts';
import { createTuningSelectionCommands } from './tuningSelectionCommands';
import { createTuningSettingsCommands } from './tuningSettingsCommands';

export function createTuningCommands(dependencies: TuningCommandDependencies) {
  return {
    ...createTuningSelectionCommands(dependencies),
    ...createTuningSettingsCommands(dependencies),
  };
}

export type {
  TuningCommandDependencies,
  TuningCommandModel,
  TuningCommandSettings,
} from './tuningCommandPorts';
