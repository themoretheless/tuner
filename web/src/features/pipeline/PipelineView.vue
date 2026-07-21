<script setup lang="ts">
import { computed } from 'vue';
import { usePipelinePort } from '../../app/featurePorts';
import type { PipelineBlockId, PipelinePresetId } from '../../domain/pipelineConfig';
import { useL10n } from '../../stores/l10n';
import PipelineBlock from './PipelineBlock.vue';
import type { PipelineBlockHelp } from './pipelineBlockHelp';
import PipelineLiveResult from './PipelineLiveResult.vue';
import PipelineDiagnosticsWorkspace from './PipelineDiagnosticsWorkspace.vue';

type PipelineHelpId =
  | 'adaptive'
  | 'arbitration'
  | 'dcRemoval'
  | 'fixedGate'
  | 'frame'
  | 'harmonic'
  | 'hold'
  | 'octave'
  | 'peak'
  | 'power'
  | 'resolver'
  | 'rms'
  | 'secondary'
  | 'tracker'
  | 'yin';

const pipeline = usePipelinePort();
const { t } = useL10n();
const presets: PipelinePresetId[] = ['stable', 'balanced', 'fast', 'raw'];
const config = computed(() => pipeline.config);
const isActiveTypeScriptFallback = computed(() => (
  pipeline.isListening && pipeline.detectorBackend === 'typescript'
));
const backendLabel = computed(() => pipeline.isListening
  ? t(`pipeline.backend.${pipeline.detectorBackend}`)
  : t('pipeline.backend.pending'));
const presetLabel = computed(() => t(`pipeline.preset.${pipeline.preset}`));

function enabled(block: PipelineBlockId) {
  return config.value[block];
}

function toggle(block: PipelineBlockId, value: boolean) {
  pipeline.setBlock(block, value);
}

function providerLocked(block: 'yinEnabled' | 'secondaryDetectorEnabled') {
  const other = block === 'yinEnabled' ? 'secondaryDetectorEnabled' : 'yinEnabled';
  return enabled(block) && !enabled(other);
}

function blockHelp(block: PipelineHelpId): PipelineBlockHelp {
  const prefix = `pipeline.block.${block}.help`;

  return {
    buttonLabel: t('pipeline.info.open'),
    roleLabel: t('pipeline.info.role'),
    role: t(`${prefix}.role`),
    flowLabel: t('pipeline.info.flow'),
    flow: t(`${prefix}.flow`),
    disabledLabel: t('pipeline.info.disabled'),
    disabled: t(`${prefix}.disabled`),
    tradeoffLabel: t('pipeline.info.tradeoff'),
    tradeoff: t(`${prefix}.tradeoff`),
  };
}
</script>

<template>
  <section class="workspace-stack" aria-labelledby="pipeline-heading">
    <header class="workspace-heading workspace-heading-row">
      <div>
        <h2 id="pipeline-heading">{{ t('nav.pipeline') }}</h2>
        <p>{{ t('pipeline.subtitle') }}</p>
      </div>
      <div class="pipeline-runtime" aria-live="polite">
        <span>{{ t('pipeline.backend') }}</span>
        <strong>{{ backendLabel }}</strong>
      </div>
    </header>

    <div class="pipeline-toolbar card">
      <div>
        <span>{{ t('pipeline.preset') }}</span>
        <strong>{{ presetLabel }}</strong>
      </div>
      <div class="segmented pipeline-presets" role="group" :aria-label="t('pipeline.preset')">
        <button
          v-for="preset in presets"
          :key="preset"
          type="button"
          :class="{ active: pipeline.preset === preset }"
          :aria-pressed="pipeline.preset === preset"
          @click="pipeline.applyPreset(preset)"
        >
          {{ t(`pipeline.preset.${preset}`) }}
        </button>
      </div>
      <span class="pipeline-apply-state">
        {{ pipeline.isListening ? t('pipeline.status.live') : t('pipeline.status.idle') }}
      </span>
    </div>

    <p v-if="isActiveTypeScriptFallback" class="pipeline-runtime-note">
      {{ t('pipeline.fallback.limit') }}
    </p>

    <PipelineLiveResult
      :error="pipeline.error"
      :format-freq="pipeline.formatFreq"
      :frame="pipeline.presentationFrame"
      :has-detection="pipeline.presentationHasDetection"
      :is-listening="pipeline.isListening"
      :session-status="pipeline.sessionStatus"
      :target-frequency="pipeline.targetNote.frequency"
      :target-name="pipeline.getNoteDisplay(pipeline.targetNote)"
      @dismiss-error="pipeline.clearError()"
      @toggle-microphone="pipeline.toggle"
    />

    <PipelineDiagnosticsWorkspace
      :backend="pipeline.detectorBackend"
      :config="pipeline.config"
      :format-freq="pipeline.formatFreq"
      :frame="pipeline.detectionFrame"
      :is-listening="pipeline.isListening"
      :input-diagnostics="pipeline.inputDiagnostics"
      :preset="pipeline.preset"
      :target-frequency="pipeline.targetNote.frequency"
    />

    <section class="pipeline-stage pipeline-stage-input" :aria-labelledby="'pipeline-stage-input'">
      <h3 id="pipeline-stage-input">
        <span class="pipeline-stage-index" aria-hidden="true">A</span>
        <span>{{ t('pipeline.stage.input') }}</span>
      </h3>
      <div class="pipeline-flow">
        <PipelineBlock
          node-id="dc-removal"
          :title="t('pipeline.block.dcRemoval')"
          :detail="t('pipeline.block.dcRemoval.detail')"
          :help="blockHelp('dcRemoval')"
          info-placement="start"
          :enabled="enabled('dcRemovalEnabled')"
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
          @toggle="toggle('dcRemovalEnabled', $event)"
        />
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="rms"
          :title="t('pipeline.block.rms')"
          :detail="t('pipeline.block.rms.detail')"
          :help="blockHelp('rms')"
          :enabled="true"
          required
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
        />
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="peak"
          :title="t('pipeline.block.peak')"
          :detail="t('pipeline.block.peak.detail')"
          :help="blockHelp('peak')"
          :enabled="true"
          required
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
        />
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="fixed-gate"
          :title="t('pipeline.block.fixedGate')"
          :detail="t('pipeline.block.fixedGate.detail')"
          :help="blockHelp('fixedGate')"
          info-placement="end"
          :enabled="enabled('fixedGateEnabled')"
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
          @toggle="toggle('fixedGateEnabled', $event)"
        />
      </div>
    </section>

    <section class="pipeline-stage pipeline-stage-candidates" :aria-labelledby="'pipeline-stage-candidates'">
      <h3 id="pipeline-stage-candidates">
        <span class="pipeline-stage-index" aria-hidden="true">B</span>
        <span>{{ t('pipeline.stage.candidates') }}</span>
      </h3>
      <div class="pipeline-flow">
        <div class="pipeline-parallel">
          <PipelineBlock
            node-id="yin"
            :title="t('pipeline.block.yin')"
            :detail="t('pipeline.block.yin.detail')"
            :help="blockHelp('yin')"
            info-placement="start"
            :enabled="enabled('yinEnabled')"
            :disabled="providerLocked('yinEnabled')"
            :disabled-reason="t('pipeline.provider.required')"
            :required-text="t('pipeline.required')"
            :enabled-text="t('pipeline.enabled')"
            :disabled-text="t('pipeline.disabled')"
            :runtime-unavailable-text="t('pipeline.rustOnly')"
            @toggle="toggle('yinEnabled', $event)"
          />
          <PipelineBlock
            node-id="secondary-detector"
            :title="t('pipeline.block.secondary')"
            :detail="t('pipeline.block.secondary.detail')"
            :help="blockHelp('secondary')"
            info-placement="start"
            :enabled="enabled('secondaryDetectorEnabled')"
            :disabled="providerLocked('secondaryDetectorEnabled')"
            :disabled-reason="t('pipeline.provider.required')"
            :required-text="t('pipeline.required')"
            :enabled-text="t('pipeline.enabled')"
            :disabled-text="t('pipeline.disabled')"
            :runtime-unavailable-text="t('pipeline.rustOnly')"
            @toggle="toggle('secondaryDetectorEnabled', $event)"
          />
        </div>
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="arbitration"
          :title="t('pipeline.block.arbitration')"
          :detail="t('pipeline.block.arbitration.detail')"
          :help="blockHelp('arbitration')"
          :enabled="true"
          required
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
        />
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="harmonic"
          :title="t('pipeline.block.harmonic')"
          :detail="t('pipeline.block.harmonic.detail')"
          :help="blockHelp('harmonic')"
          :enabled="enabled('harmonicEnabled')"
          :runtime-unavailable="isActiveTypeScriptFallback"
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
          @toggle="toggle('harmonicEnabled', $event)"
        />
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="octave"
          :title="t('pipeline.block.octave')"
          :detail="t('pipeline.block.octave.detail')"
          :help="blockHelp('octave')"
          info-placement="end"
          :enabled="enabled('octaveEnabled')"
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
          @toggle="toggle('octaveEnabled', $event)"
        />
      </div>
    </section>

    <section class="pipeline-stage pipeline-stage-stability" :aria-labelledby="'pipeline-stage-stability'">
      <h3 id="pipeline-stage-stability">
        <span class="pipeline-stage-index" aria-hidden="true">C</span>
        <span>{{ t('pipeline.stage.stability') }}</span>
      </h3>
      <div class="pipeline-flow">
        <PipelineBlock
          node-id="adaptive-gate"
          :title="t('pipeline.block.adaptive')"
          :detail="t('pipeline.block.adaptive.detail')"
          :help="blockHelp('adaptive')"
          info-placement="start"
          :enabled="enabled('adaptiveGateEnabled')"
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
          @toggle="toggle('adaptiveGateEnabled', $event)"
        />
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="tracker"
          :title="t('pipeline.block.tracker')"
          :detail="t('pipeline.block.tracker.detail')"
          :help="blockHelp('tracker')"
          :enabled="enabled('trackingEnabled')"
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
          @toggle="toggle('trackingEnabled', $event)"
        />
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="hold"
          :title="t('pipeline.block.hold')"
          :detail="t('pipeline.block.hold.detail')"
          :help="blockHelp('hold')"
          info-placement="end"
          :enabled="enabled('holdEnabled')"
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
          @toggle="toggle('holdEnabled', $event)"
        />
      </div>
    </section>

    <section class="pipeline-stage pipeline-stage-output" :aria-labelledby="'pipeline-stage-output'">
      <h3 id="pipeline-stage-output">
        <span class="pipeline-stage-index" aria-hidden="true">D</span>
        <span>{{ t('pipeline.stage.output') }}</span>
      </h3>
      <div class="pipeline-flow">
        <div class="pipeline-parallel">
          <PipelineBlock
            node-id="resolver"
            :title="t('pipeline.block.resolver')"
            :detail="t('pipeline.block.resolver.detail')"
            :help="blockHelp('resolver')"
            info-placement="start"
            :enabled="true"
            required
            :required-text="t('pipeline.required')"
            :enabled-text="t('pipeline.enabled')"
            :disabled-text="t('pipeline.disabled')"
            :runtime-unavailable-text="t('pipeline.rustOnly')"
          />
          <PipelineBlock
            node-id="power-chord"
            :title="t('pipeline.block.power')"
            :detail="t('pipeline.block.power.detail')"
            :help="blockHelp('power')"
            info-placement="start"
            :enabled="enabled('powerChordEnabled')"
            :runtime-unavailable="isActiveTypeScriptFallback"
            :required-text="t('pipeline.required')"
            :enabled-text="t('pipeline.enabled')"
            :disabled-text="t('pipeline.disabled')"
            :runtime-unavailable-text="t('pipeline.rustOnly')"
            @toggle="toggle('powerChordEnabled', $event)"
          />
        </div>
        <span class="pipeline-connector" aria-hidden="true"></span>
        <PipelineBlock
          node-id="detection-frame"
          :title="t('pipeline.block.frame')"
          :detail="t('pipeline.block.frame.detail')"
          :help="blockHelp('frame')"
          info-placement="end"
          :enabled="true"
          required
          :required-text="t('pipeline.required')"
          :enabled-text="t('pipeline.enabled')"
          :disabled-text="t('pipeline.disabled')"
          :runtime-unavailable-text="t('pipeline.rustOnly')"
        />
      </div>
    </section>
  </section>
</template>

<style scoped>
.pipeline-runtime {
  min-width: 170px;
  display: grid;
  justify-items: end;
  gap: 3px;
}

.pipeline-runtime span,
.pipeline-toolbar span {
  color: var(--text-dim);
  font-size: 0.66rem;
  text-transform: uppercase;
}

.pipeline-runtime strong,
.pipeline-toolbar strong {
  font-size: 0.78rem;
  font-weight: 650;
}

.pipeline-toolbar {
  min-height: 66px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 20px;
  padding: 12px 14px;
}

.pipeline-toolbar > div:first-child {
  display: grid;
  gap: 3px;
}

.pipeline-presets {
  grid-auto-columns: minmax(86px, 1fr);
}

.pipeline-apply-state {
  margin-left: auto;
  text-align: right;
}

.pipeline-runtime-note {
  margin: -6px 0 0;
  padding: 9px 12px;
  border-left: 3px solid var(--warning);
  color: var(--text-muted);
  font-size: 0.74rem;
}

.pipeline-stage {
  --pipeline-stage-rail: 38px;
  position: relative;
  display: grid;
  gap: 12px;
  padding: 8px 0 0 var(--pipeline-stage-rail);
}

.pipeline-stage:not(:last-of-type)::before {
  content: '';
  position: absolute;
  z-index: 0;
  top: 20px;
  bottom: -40px;
  left: 11px;
  width: 1px;
  background: color-mix(in srgb, var(--accent) 44%, var(--border-strong));
}

.pipeline-stage:not(:last-of-type)::after {
  content: '';
  position: absolute;
  z-index: 1;
  bottom: -19px;
  left: 8px;
  width: 7px;
  height: 7px;
  border-right: 1px solid var(--accent);
  border-bottom: 1px solid var(--accent);
  transform: rotate(45deg);
}

.pipeline-stage h3 {
  position: relative;
  z-index: 1;
  min-height: 24px;
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 0 calc(var(--pipeline-stage-rail) * -1);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.pipeline-stage-index {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 58%, var(--border-strong));
  border-radius: 50%;
  background: var(--surface);
  color: var(--accent);
  font-family: var(--mono);
  font-size: 0.65rem;
}

.pipeline-flow {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) 24px minmax(150px, 1fr) 24px minmax(150px, 1fr) 24px minmax(150px, 1fr);
  align-items: stretch;
}

.pipeline-flow > .pipeline-node:only-of-type {
  grid-column: auto;
}

.pipeline-stage-output .pipeline-flow {
  grid-template-columns: minmax(180px, 1fr) 24px minmax(180px, 1fr);
  max-width: 620px;
}

.pipeline-stage-stability .pipeline-flow {
  grid-template-columns: minmax(180px, 1fr) 24px minmax(180px, 1fr) 24px minmax(180px, 1fr);
  max-width: 850px;
}

.pipeline-parallel {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.pipeline-connector {
  position: relative;
  min-width: 24px;
}

.pipeline-connector::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 4px;
  right: 7px;
  height: 1px;
  background: var(--border-strong);
}

.pipeline-connector::after {
  content: '';
  position: absolute;
  top: calc(50% - 3px);
  right: 4px;
  width: 6px;
  height: 6px;
  border-top: 1px solid var(--border-strong);
  border-right: 1px solid var(--border-strong);
  transform: rotate(45deg);
}

@media (max-width: 900px) {
  .pipeline-flow,
  .pipeline-stage-input .pipeline-flow,
  .pipeline-stage-stability .pipeline-flow,
  .pipeline-stage-output .pipeline-flow {
    max-width: none;
    grid-template-columns: 1fr;
  }

  .pipeline-connector {
    min-width: 0;
    min-height: 24px;
  }

  .pipeline-connector::before {
    top: 4px;
    bottom: 7px;
    left: 50%;
    right: auto;
    width: 1px;
    height: auto;
  }

  .pipeline-connector::after {
    top: auto;
    right: auto;
    bottom: 4px;
    left: calc(50% - 3px);
    transform: rotate(135deg);
  }
}

@media (max-width: 560px) {
  .pipeline-stage {
    --pipeline-stage-rail: 30px;
  }

  .pipeline-runtime {
    justify-items: start;
  }

  .pipeline-toolbar,
  .pipeline-presets {
    width: 100%;
  }

  .pipeline-presets {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pipeline-presets button:nth-child(2) {
    border-right: 0;
  }

  .pipeline-presets button:nth-child(-n + 2) {
    border-bottom: 1px solid var(--border-strong);
  }

  .pipeline-apply-state {
    width: 100%;
    margin-left: 0;
    text-align: left;
  }
}
</style>
