<script setup lang="ts">
import { AlertTriangle, Info, OctagonX } from '@lucide/vue';
import { useL10n } from '../../stores/l10n';
import type { DiagnosticSeverity, TunerDiagnostic } from '../../domain/diagnostics';

defineProps<{ diagnostics: TunerDiagnostic[] }>();

const { t } = useL10n();

const SEVERITY_ICONS = {
  error: OctagonX,
  warning: AlertTriangle,
  info: Info,
} as const satisfies Record<DiagnosticSeverity, unknown>;

const SEVERITY_CLASSES = {
  error: 'diagnostics-item--error',
  warning: 'diagnostics-item--warning',
  info: 'diagnostics-item--info',
} as const satisfies Record<DiagnosticSeverity, string>;

function severityIcon(severity: DiagnosticSeverity) {
  return SEVERITY_ICONS[severity];
}

function hintText(diagnostic: TunerDiagnostic) {
  let text = t(diagnostic.hintKey);
  for (const [key, value] of Object.entries(diagnostic.hintParams ?? {})) {
    text = text.replace(`{${key}}`, String(value));
  }
  return text;
}
</script>

<template>
  <section
    v-if="diagnostics.length"
    class="diagnostics-strip"
    role="status"
    :aria-label="t('diagnostics.title')"
  >
    <ul class="diagnostics-list">
      <li
        v-for="diagnostic in diagnostics"
        :key="`${diagnostic.source}:${diagnostic.code}`"
        class="diagnostics-item"
        :class="SEVERITY_CLASSES[diagnostic.severity]"
        :data-code="diagnostic.code"
        :data-severity="diagnostic.severity"
      >
        <component
          :is="severityIcon(diagnostic.severity)"
          :size="14"
          aria-hidden="true"
          class="diagnostics-icon"
        />
        <span class="diagnostics-text">{{ hintText(diagnostic) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.diagnostics-strip {
  margin-top: 0.5rem;
}

.diagnostics-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.diagnostics-item {
  align-items: center;
  border: 1px solid;
  border-radius: 9999px;
  display: inline-flex;
  font-size: 0.75rem;
  gap: 0.375rem;
  line-height: 1.2;
  padding: 0.25rem 0.625rem;
}

.diagnostics-icon {
  flex-shrink: 0;
}

.diagnostics-item--error {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.45);
  color: #fca5a5;
}

.diagnostics-item--warning {
  background: rgba(234, 179, 8, 0.12);
  border-color: rgba(234, 179, 8, 0.45);
  color: #fde68a;
}

.diagnostics-item--info {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.4);
  color: #cbd5e1;
}
</style>
