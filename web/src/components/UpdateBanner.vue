<script setup lang="ts">
import { useL10n } from '../stores/l10n';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  update: [];
  dismiss: [];
}>();

const { t } = useL10n();
</script>

<template>
  <div v-if="visible" class="update-banner" role="status">
    <span class="update-banner__text">{{ t('pwa.update.available') }}</span>
    <button type="button" class="update-banner__action" @click="emit('update')">
      {{ t('pwa.update.reload') }}
    </button>
    <button
      type="button"
      class="update-banner__dismiss"
      :aria-label="t('pwa.update.dismiss')"
      @click="emit('dismiss')"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.update-banner {
  position: fixed;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  border-radius: 0.75rem;
  background: rgba(18, 22, 30, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  color: #e2e8f0;
  font-size: 0.85rem;
  max-width: min(92vw, 32rem);
}

.update-banner__action {
  padding: 0.35rem 0.85rem;
  border-radius: 0.5rem;
  border: none;
  background: #22c55e;
  color: #052e16;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.update-banner__dismiss {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem;
}
</style>
