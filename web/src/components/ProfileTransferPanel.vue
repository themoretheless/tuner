<script setup lang="ts">
import { ref } from 'vue';
import { useL10n } from '../stores/l10n';

const props = defineProps<{
  exportProfile: () => string
  importProfile: (payload: string) => Promise<boolean>
}>();

const { t } = useL10n();
const fileInput = ref<HTMLInputElement | null>(null);
const status = ref('');

function exportProfile() {
  const blob = new Blob([props.exportProfile()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tuner-profile-v1.json';
  link.click();
  URL.revokeObjectURL(url);
  status.value = t('profile.exported');
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    status.value = await props.importProfile(await file.text())
      ? t('profile.imported')
      : t('profile.import.failed');
  } catch {
    status.value = t('profile.import.failed');
  } finally {
    input.value = '';
  }
}
</script>

<template>
  <section class="profile-transfer" aria-labelledby="profile-transfer-heading">
    <div>
      <h3 id="profile-transfer-heading">{{ t('profile.backup') }}</h3>
      <p>{{ t('profile.backup.detail') }}</p>
    </div>
    <div class="profile-transfer-actions">
      <button type="button" class="btn btn-ghost" @click="exportProfile">
        {{ t('profile.export') }}
      </button>
      <button type="button" class="btn btn-primary" @click="fileInput?.click()">
        {{ t('profile.import') }}
      </button>
      <span role="status" aria-live="polite">{{ status }}</span>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="importFile"
      />
    </div>
  </section>
</template>
