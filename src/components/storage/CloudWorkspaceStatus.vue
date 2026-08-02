<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  activeStorageProviderID,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry
} from '@/app/integrations/storage'
import { settingsDialogOpen } from '@/app/settings/dialog'
import type { CredentialStatus } from '@/app/settings/credentials/types'

const { dialogs } = useI18n()
const credentialStatuses = ref<Record<string, CredentialStatus>>({})
const statusGeneration = ref(0)

const connected = computed(() => {
  const provider = storageProviderRegistry.get(activeStorageProviderID.value)
  return (
    storagePreferencesComplete(provider.id) &&
    provider.credentialFields.every(
      (field) => !field.required || credentialStatuses.value[field.id] === 'configured'
    )
  )
})

async function refreshStatus(): Promise<void> {
  const generation = ++statusGeneration.value
  const providerId = activeStorageProviderID.value
  const statuses = await storageCredentialStatuses(providerId).catch(() => ({}))
  if (generation === statusGeneration.value && providerId === activeStorageProviderID.value) {
    credentialStatuses.value = statuses
  }
}

watch(activeStorageProviderID, refreshStatus)
watch(settingsDialogOpen, (open, wasOpen) => {
  if (wasOpen && !open) void refreshStatus()
})
onMounted(refreshStatus)
</script>

<template>
  <footer
    v-if="connected"
    class="flex h-5 shrink-0 items-center gap-1.5 border-t border-border bg-panel px-2 text-[10px] text-muted"
    data-test-id="cloud-workspace-status"
  >
    <span class="size-1.5 rounded-full bg-green-500" aria-hidden="true" />
    <span>{{ dialogs.cloudWorkspaceConnected }}</span>
  </footer>
</template>
