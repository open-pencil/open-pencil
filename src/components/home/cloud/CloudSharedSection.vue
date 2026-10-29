<script setup lang="ts">
import { useAsyncState, useLocalStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

import type { SharedDocument } from '@open-pencil/cloud/contract'
import { useCloudMessages, useI18n } from '@open-pencil/vue/i18n'

import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudAPIClient, cloudConnection } from '@/app/cloud/sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import { useDateFormat } from '@/app/i18n/date'
import { openStorageDocumentInNewTab } from '@/app/tabs'

import CloudWorkspaceView from './CloudWorkspaceView.vue'
import type { CloudDocumentRow } from './types'

/** Documents people on the server Home shows shared with this account directly. */
const { serverId, query = '' } = defineProps<{
  serverId: string
  /** Home's search, already lowercased in the app's locale. */
  query?: string
}>()

const { locale } = useI18n()
const t = useCloudMessages()
const dates = useDateFormat()
const view = useLocalStorage<'grid' | 'list'>('open-pencil:home-files-view', 'grid')
const {
  state: documents,
  isLoading,
  error,
  execute: refresh
} = useAsyncState(
  async (): Promise<SharedDocument[]> => {
    const server = findCloudServer(serverId)
    const discovery = cloudConnection(serverId).discovery
    if (!server || !discovery) return []
    return cloudAPIClient(server, discovery).listSharedDocuments()
  },
  [],
  // Keep the last list on screen while it reloads.
  { resetOnExecute: false }
)
// Home's server can change under this list; another server's documents never stay listed.
watch(
  () => serverId,
  () => {
    documents.value = []
    void refresh()
  }
)
const state = computed(() => {
  if (isLoading.value) return 'loading'
  return error.value ? 'error' : 'ready'
})

const rows = computed<CloudDocumentRow[]>(() =>
  documents.value.map((document) => ({
    id: document.id,
    name: document.name,
    editedAt: dates.relative(document.updatedAt),
    editedBy: document.sharedBy
      ? t.value.homeSharedBy({ name: document.sharedBy.name })
      : undefined,
    sync: 'synced',
    permission: document.permission
  }))
)

const matching = computed(() =>
  query
    ? rows.value.filter((row) => row.name.toLocaleLowerCase(locale.value).includes(query))
    : rows.value
)

function open(row: CloudDocumentRow) {
  const document = documents.value.find((candidate) => candidate.id === row.id)
  if (!document) return
  // A shared document stays in its owner's workspace; the direct grant is what opens it. Opening
  // reports its own failure.
  void openStorageDocumentInNewTab(
    {
      id: document.id,
      name: document.name,
      updatedAt: document.updatedAt,
      revision: document.currentRevisionId
    },
    {
      providerId: CLOUD_STORAGE_PROVIDER_ID,
      profileId: serverId,
      containerId: document.workspaceId
    }
  ).catch(() => undefined)
}
</script>

<template>
  <CloudWorkspaceView
    v-model:view="view"
    :heading="t.homeSharedWithYou"
    :subtitle="t.homeSharedSubtitle"
    :documents="matching"
    :state="state"
    @open="open"
    @refresh="refresh"
  />
</template>
