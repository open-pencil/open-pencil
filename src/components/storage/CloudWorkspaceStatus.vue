<script setup lang="ts">
import { computed, ref } from 'vue'
import { tv } from 'tailwind-variants'
import { useI18n } from '@open-pencil/vue'

import { activeStorageProviderID, storageProviderRegistry } from '@/app/integrations/storage'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useStorageConfigured } from '@/app/storage/configured'
import { useSyncStatus } from '@/app/storage/sync'
import SyncErrorDialog from '@/components/storage/SyncErrorDialog.vue'
import syncStatusTheme from '@/theme/sync-status'

const { dialogs } = useI18n()
const configured = useStorageConfigured()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const { indicator, label, failure, spinnerVisible, actionable, canConnect } = useSyncStatus({
  configured: () => configured.value,
  providerLabel: () => provider.value.label
})

const detailOpen = ref(false)
const cls = computed(() =>
  tv(syncStatusTheme)({
    indicator: indicator.value,
    actionable: actionable.value || canConnect.value
  })
)

/** Same control, two destinations: a failure to read, or a cloud to set up. */
const hint = computed(() => {
  if (canConnect.value) return dialogs.value.syncStatusSetUpCloud
  return actionable.value ? dialogs.value.syncStatusShowDetails : undefined
})

function activate(): void {
  if (canConnect.value) {
    openSettingsDialog('storage')
    return
  }
  if (actionable.value) detailOpen.value = true
}
</script>

<template>
  <button
    type="button"
    :class="cls.chip()"
    :disabled="!actionable && !canConnect"
    :aria-label="hint"
    :title="hint"
    data-test-id="cloud-workspace-status"
    :data-indicator="indicator"
    @click="activate"
  >
    <span :class="cls.indicator()" aria-hidden="true">
      <icon-lucide-cloud-upload v-if="spinnerVisible" :class="cls.icon()" />
      <icon-lucide-cloud-off v-else-if="indicator === 'local'" :class="cls.icon()" />
      <icon-lucide-cloud-alert
        v-else-if="indicator === 'degraded' || indicator === 'failing'"
        :class="cls.icon()"
      />
      <icon-lucide-cloud-check v-else :class="cls.icon()" />
    </span>
    <span :class="cls.label()">{{ label }}</span>
  </button>

  <SyncErrorDialog v-model:open="detailOpen" :failure="failure" />
</template>
