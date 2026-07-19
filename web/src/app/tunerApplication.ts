import type { FeaturePorts } from './featurePorts';
import type { ShellPort } from './ports/shell';

export interface TunerApplication {
  featurePorts: FeaturePorts;
  shell: ShellPort;
}
