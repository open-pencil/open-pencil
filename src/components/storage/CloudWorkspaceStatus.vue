<script setup lang="ts">
import { computed, ref } from 'vue'
import { tv } from 'tailwind-variants'
import { useI18n } from '@open-pencil/vue'

import { useStorageConfigured } from '@/app/storage/configured'
import { useSyncStatus } from '@/app/storage/sync'
import SyncErrorDialog from '@/components/storage/SyncErrorDialog.vue'
import syncStatusTheme from '@/theme/sync-status'

const { dialogs } = useI18n()
const configured = useStorageConfigured()
const { indicator, label, failure, spinnerVisible, actionable } = useSyncStatus({
  configured: () => configured.value
})

const detailOpen = ref(false)
const cls = computed(() =>
  tv(syncStatusTheme)({ indicator: indicator.value, actionable: actionable.value })
)

function openDetail(): void {
  if (actionable.value) detailOpen.value = true
}
</script>

<template>
  <button
    type="button"
    :class="cls.chip()"
    :disabled="!actionable"
    :aria-label="actionable ? dialogs.syncStatusShowDetails : undefined"
    data-test-id="cloud-workspace-status"
    :data-indicator="indicator"
    @click="openDetail"
  >
    <span :class="cls.indicator()" aria-hidden="true">
      <icon-lucide-loader-circle v-if="spinnerVisible" :class="cls.spinner()" />
      <span v-else :class="cls.dot()" />
    </span>
    <span :class="cls.label()">{{ label }}</span>
  </button>

  <SyncErrorDialog v-model:open="detailOpen" :failure="failure" />
</template>
