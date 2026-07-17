<script setup lang="ts">
import { Info } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PipelineBlockHelp } from './pipelineBlockHelp';

const props = withDefaults(defineProps<{
  detail: string;
  disabled?: boolean;
  disabledReason?: string;
  disabledText: string;
  enabled: boolean;
  enabledText: string;
  help: PipelineBlockHelp;
  infoPlacement?: 'start' | 'center' | 'end';
  nodeId: string;
  required?: boolean;
  requiredText: string;
  runtimeUnavailable?: boolean;
  runtimeUnavailableText: string;
  title: string;
}>(), {
  disabled: false,
  disabledReason: '',
  infoPlacement: 'center',
  required: false,
  runtimeUnavailable: false,
});

const emit = defineEmits<{
  toggle: [enabled: boolean];
}>();

const infoFocused = ref(false);
const infoHovered = ref(false);
const infoPinned = ref(false);
const infoButton = ref<HTMLButtonElement | null>(null);
const infoPanel = ref<HTMLElement | null>(null);
const infoPanelStyle = ref<Record<string, string>>({});
const infoVisible = computed(() => infoFocused.value || infoHovered.value || infoPinned.value);

function updateInfoPosition() {
  if (!infoVisible.value || !infoButton.value || !infoPanel.value) return;

  const viewportPadding = 16;
  const gap = 8;
  const buttonRect = infoButton.value.getBoundingClientRect();
  const nodeRect = infoButton.value.closest<HTMLElement>('.pipeline-node')?.getBoundingClientRect();
  const panelRect = infoPanel.value.getBoundingClientRect();
  const naturalHeight = infoPanel.value.scrollHeight;
  const availableAbove = Math.max(0, buttonRect.top - viewportPadding - gap);
  const availableBelow = Math.max(0, window.innerHeight - buttonRect.bottom - viewportPadding - gap);
  const placeAbove = availableBelow < naturalHeight && availableAbove > availableBelow;
  const availableHeight = placeAbove ? availableAbove : availableBelow;
  const maxHeight = Math.max(96, Math.floor(availableHeight));
  const renderedHeight = Math.min(naturalHeight, maxHeight);
  const top = placeAbove
    ? buttonRect.top - gap - renderedHeight
    : buttonRect.bottom + gap;

  const panelWidth = panelRect.width;
  const anchorLeft = nodeRect?.left ?? buttonRect.left;
  const anchorRight = nodeRect?.right ?? buttonRect.right;
  const desiredLeft = props.infoPlacement === 'start'
    ? anchorLeft
    : props.infoPlacement === 'end'
      ? anchorRight - panelWidth
      : buttonRect.left + (buttonRect.width - panelWidth) / 2;
  const maxLeft = Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding);
  const left = Math.min(Math.max(desiredLeft, viewportPadding), maxLeft);

  infoPanelStyle.value = {
    left: `${Math.round(left)}px`,
    maxHeight: `${maxHeight}px`,
    top: `${Math.max(viewportPadding, Math.round(top))}px`,
  };
}

function onViewportChange() {
  updateInfoPosition();
}

watch(infoVisible, async (visible) => {
  if (!visible) return;
  await nextTick();
  updateInfoPosition();
}, { flush: 'post' });

onMounted(() => {
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onViewportChange, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});

function onToggle(event: Event) {
  emit('toggle', (event.target as HTMLInputElement).checked);
}

function onInfoFocusOut(event: FocusEvent) {
  const container = event.currentTarget as HTMLElement;
  const nextTarget = event.relatedTarget as Node | null;

  if (!nextTarget || !container.contains(nextTarget)) {
    infoFocused.value = false;
    infoPinned.value = false;
  }
}

function toggleInfo(event: MouseEvent) {
  if (infoPinned.value) {
    infoFocused.value = false;
    infoHovered.value = false;
    infoPinned.value = false;
    (event.currentTarget as HTMLButtonElement).blur();
    return;
  }

  infoPinned.value = true;
}

function closeInfo(event: KeyboardEvent) {
  infoFocused.value = false;
  infoHovered.value = false;
  infoPinned.value = false;
  (event.currentTarget as HTMLButtonElement).blur();
}
</script>

<template>
  <article
    class="pipeline-node"
    :class="{
      'pipeline-node-disabled': !enabled,
      'pipeline-node-unavailable': runtimeUnavailable,
    }"
    :data-node-id="nodeId"
    :data-state="enabled ? 'enabled' : 'disabled'"
    :aria-describedby="`${nodeId}-description`"
    :title="disabled ? disabledReason : undefined"
  >
    <header class="pipeline-node-header">
      <span class="pipeline-node-state" aria-hidden="true"></span>
      <div class="pipeline-node-actions">
        <label
          v-if="!required"
          class="pipeline-node-toggle"
          :class="{ 'pipeline-node-toggle-disabled': disabled }"
        >
          <input
            type="checkbox"
            :checked="enabled"
            :disabled="disabled"
            :aria-label="title"
            :aria-describedby="`${nodeId}-description`"
            @change="onToggle"
          />
        </label>
        <span v-else class="pipeline-node-required">{{ requiredText }}</span>
        <div
          class="pipeline-node-info"
          @mouseenter="infoHovered = true"
          @mouseleave="infoHovered = false"
          @focusin="infoFocused = true"
          @focusout="onInfoFocusOut"
        >
          <button
            ref="infoButton"
            type="button"
            class="pipeline-node-info-button"
            :data-testid="`pipeline-info-${nodeId}`"
            :aria-label="`${help.buttonLabel}: ${title}`"
            :aria-expanded="infoVisible"
            :aria-controls="`${nodeId}-info`"
            :aria-describedby="infoVisible ? `${nodeId}-info` : undefined"
            @click.stop="toggleInfo"
            @keydown.esc.stop.prevent="closeInfo"
          >
            <Info :size="16" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <section
            v-show="infoVisible"
            ref="infoPanel"
            :id="`${nodeId}-info`"
            class="pipeline-node-info-panel"
            :class="`pipeline-node-info-panel-${infoPlacement}`"
            :data-testid="`pipeline-info-panel-${nodeId}`"
            :style="infoPanelStyle"
            role="tooltip"
          >
            <strong>{{ title }}</strong>
            <dl>
              <div>
                <dt>{{ help.roleLabel }}</dt>
                <dd>{{ help.role }}</dd>
              </div>
              <div>
                <dt>{{ help.flowLabel }}</dt>
                <dd>{{ help.flow }}</dd>
              </div>
              <div>
                <dt>{{ help.disabledLabel }}</dt>
                <dd>{{ help.disabled }}</dd>
              </div>
              <div>
                <dt>{{ help.tradeoffLabel }}</dt>
                <dd>{{ help.tradeoff }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </header>
    <strong>{{ title }}</strong>
    <p :id="`${nodeId}-description`">{{ detail }}</p>
    <footer>
      {{ runtimeUnavailable
        ? runtimeUnavailableText
        : required
          ? requiredText
          : enabled
            ? enabledText
            : disabledText }}
    </footer>
  </article>
</template>

<style scoped>
.pipeline-node {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 134px;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 7px;
  padding: 14px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface);
  transition: border-color 140ms ease, background 140ms ease, opacity 140ms ease;
}

.pipeline-node:not(.pipeline-node-disabled):not(.pipeline-node-unavailable) {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--border));
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}

.pipeline-node-disabled {
  border-color: var(--border);
}

.pipeline-node-disabled > strong,
.pipeline-node-disabled > p,
.pipeline-node-disabled > footer,
.pipeline-node-disabled .pipeline-node-state,
.pipeline-node-disabled .pipeline-node-toggle {
  opacity: 0.62;
}

.pipeline-node-unavailable {
  border-color: color-mix(in srgb, var(--warning) 55%, var(--border));
}

.pipeline-node-header {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pipeline-node-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pipeline-node-state {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  background: var(--text-dim);
}

.pipeline-node:not(.pipeline-node-disabled):not(.pipeline-node-unavailable) .pipeline-node-state {
  background: var(--accent);
}

.pipeline-node-unavailable .pipeline-node-state {
  background: var(--warning);
}

.pipeline-node-toggle {
  width: 28px;
  height: 28px;
  margin: -4px -4px -4px 0;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.pipeline-node-info {
  position: static;
  width: 28px;
  height: 28px;
  margin: -4px -4px -4px 0;
}

.pipeline-node-info-button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  color: var(--text-muted);
  background: transparent;
  cursor: help;
}

.pipeline-node-info-button:hover,
.pipeline-node-info-button:focus-visible,
.pipeline-node-info-button[aria-expanded='true'] {
  border-color: var(--border-strong);
  color: var(--text);
  background: var(--surface-raised);
}

.pipeline-node-info-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.pipeline-node-info-panel {
  position: fixed;
  z-index: 30;
  top: 16px;
  left: 16px;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 14px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text);
  background: var(--surface-raised);
  box-shadow: 0 14px 32px rgb(0 0 0 / 35%);
}

.pipeline-node-info-panel > strong {
  display: block;
  margin-bottom: 12px;
  font-size: 0.84rem;
}

.pipeline-node-info-panel dl {
  display: grid;
  gap: 11px;
  margin: 0;
}

.pipeline-node-info-panel dl > div {
  display: grid;
  gap: 3px;
}

.pipeline-node-info-panel dt {
  color: var(--text-dim);
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
}

.pipeline-node-info-panel dd {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.48;
}

.pipeline-node-toggle input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--accent-strong);
}

.pipeline-node-toggle-disabled {
  cursor: not-allowed;
}

.pipeline-node-required {
  color: var(--text-dim);
  font-size: 0.62rem;
  text-transform: uppercase;
}

.pipeline-node strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 650;
}

.pipeline-node p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.pipeline-node footer {
  color: var(--text-dim);
  font-size: 0.62rem;
  text-transform: uppercase;
}

.pipeline-node-unavailable footer {
  color: var(--warning);
}

</style>
