import { inject, provide, type InjectionKey } from 'vue';
import type { AnalysisPort } from './ports/analysis';
import type { LibraryPort } from './ports/library';
import type { LiveTunerPort } from './ports/liveTuner';
import type { PipelinePort } from './ports/pipeline';
import type { PracticePort } from './ports/practice';

export type { AnalysisPort, LibraryPort, LiveTunerPort, PipelinePort, PracticePort };

export interface FeaturePorts {
  analysis: AnalysisPort;
  library: LibraryPort;
  live: LiveTunerPort;
  pipeline: PipelinePort;
  practice: PracticePort;
}

const featurePortKeys = {
  analysis: Symbol('analysis-port') as InjectionKey<AnalysisPort>,
  library: Symbol('library-port') as InjectionKey<LibraryPort>,
  live: Symbol('live-tuner-port') as InjectionKey<LiveTunerPort>,
  pipeline: Symbol('pipeline-port') as InjectionKey<PipelinePort>,
  practice: Symbol('practice-port') as InjectionKey<PracticePort>,
};

export function provideFeaturePorts(ports: FeaturePorts) {
  provide(featurePortKeys.analysis, ports.analysis);
  provide(featurePortKeys.library, ports.library);
  provide(featurePortKeys.live, ports.live);
  provide(featurePortKeys.pipeline, ports.pipeline);
  provide(featurePortKeys.practice, ports.practice);
}

export function useAnalysisPort() {
  return injectRequired(featurePortKeys.analysis, 'analysis');
}

export function useLibraryPort() {
  return injectRequired(featurePortKeys.library, 'library');
}

export function useLiveTunerPort() {
  return injectRequired(featurePortKeys.live, 'live tuner');
}

export function usePipelinePort() {
  return injectRequired(featurePortKeys.pipeline, 'pipeline');
}

export function usePracticePort() {
  return injectRequired(featurePortKeys.practice, 'practice');
}

function injectRequired<T>(key: InjectionKey<T>, name: string) {
  const port = inject(key);
  if (!port) throw new Error(`${name} feature port was not provided`);
  return port;
}
