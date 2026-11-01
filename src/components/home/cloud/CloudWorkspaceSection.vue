<script setup lang="ts">
import { computedAsync, useLocalStorage, useOnline } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { useDocumentWorkspace } from '@open-pencil/vue/document/workspace'
import { useCloudMessages, useI18n } from '@open-pencil/vue/i18n'

import { cloudSyncState } from '@/app/cloud/documents/status'
import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudAPIClient, cloudConnection } from '@/app/cloud/sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import { openWorkspaceMembers } from '@/app/cloud/workspaces/manage'
import { useDateFormat } from '@/app/i18n/date'
import {
  sameStorageLocation,
  storageLocationOf,
  type StorageDocument,
  type StorageLocation
} from '@/app/integrations/storage'
import { getLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import { pendingSyncCount, syncUIState, uploadProgressByCanvas } from '@/app/storage/sync'
import { createStoredDocument } from '@/app/storage/workspace/create'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import { openStorageDocumentInNewTab } from '@/app/tabs'
import DocumentDeleteDialog from '@/components/home/document/DocumentDeleteDialog.vue'

import CloudWorkspaceView from './CloudWorkspaceView.vue'
import type { CloudDocumentRow } from './types'

/** One workspace of the server Home shows, listed with this device's copies and their state. */
const {
  serverId,
  workspace,
  query = ''
} = defineProps<{
  serverId: string
  workspace: { id: string; name: string; role: 'viewer' | 'editor' | 'admin' }
  /** Home's search, already lowercased in the app's locale. */
  query?: string
}>()

const { locale } = useI18n()
const t = useCloudMessages()
const dates = useDateFormat()
const online = useOnline()
const view = useLocalStorage<'grid' | 'list'>('open-pencil:home-files-view', 'grid')
const location = computed<StorageLocation>(() => ({
  providerId: CLOUD_STORAGE_PROVIDER_ID,
  profileId: serverId,
  containerId: workspace.id
}))

// What this device holds, shown when the server cannot list the workspace.
const fallback = shallowRef<StorageDocument[]>([])
const files = useDocumentWorkspace<StorageDocument>({
  source: createStorageWorkspaceSource(
    (snapshot) => {
      fallback.value = snapshot.documents
    },
    () => location.value
  ),
  refreshInterval: 60_000,
  previewConcurrency: 6
})
// Both reads re-run when the workspace or its files change; a slower earlier read never
// overwrites a newer one.
const metas = computedAsync<ReadonlyMap<string, LocalCanvasMeta>>(async () => {
  const requested = location.value
  // Read before the await, so the sync engine's progress re-runs this too.
  void [files.documents.value, syncUIState.value, pendingSyncCount.value]
  const all = await getLocalCanvasStore().listMetas(true)
  const here = all.filter((meta) => sameStorageLocation(storageLocationOf(meta), requested))
  return new Map(here.map((meta) => [meta.id, meta]))
}, new Map())

const usage = computedAsync<{ usedBytes: number; totalBytes: number | null } | null>(async () => {
  void files.documents.value
  const workspaceId = workspace.id
  const server = findCloudServer(serverId)
  const discovery = cloudConnection(serverId).discovery
  if (!server || !discovery) return null
  try {
    const { limits, usage: used } = await cloudAPIClient(
      server,
      discovery
    ).getWorkspaceEntitlements(workspaceId)
    return { usedBytes: used.committedStorageBytes, totalBytes: limits.maximumStorageBytes }
  } catch {
    // Usage is a detail; the files still list without it.
    return null
  }
}, null)

watch(location, () => {
  fallback.value = []
  void files.refresh()
})
watch(
  files.documents,
  (documents) => {
    for (const document of documents) void files.loadPreview(document.id)
  },
  { immediate: true }
)

const listed = computed(() => (files.error.value ? fallback.value : files.documents.value))
const rows = computed<CloudDocumentRow[]>(() =>
  listed.value.map((document) => ({
    id: document.id,
    name: document.name,
    previewURL: files.previewURL(document.id),
    editedAt: dates.relative(document.updatedAt),
    sync: cloudSyncState(
      metas.value.get(document.id) ?? null,
      uploadProgressByCanvas.value.has(document.id),
      online.value
    ),
    permission: workspace.role === 'viewer' ? 'view' : 'edit'
  }))
)
const state = computed(() => {
  if (files.error.value) return online.value ? 'error' : 'offline'
  return files.loading.value && !files.documents.value.length ? 'loading' : 'ready'
})
const roles = computed(() => ({
  viewer: t.value.roleViewer,
  editor: t.value.roleEditor,
  admin: t.value.roleAdmin
}))

const matching = computed(() =>
  query
    ? rows.value.filter((row) => row.name.toLocaleLowerCase(locale.value).includes(query))
    : rows.value
)

/** Conflicts are resolved in the document, so Review opens the first one. */
function reviewConflicts() {
  const conflicted = rows.value.find((row) => row.sync === 'conflict')
  if (conflicted) open(conflicted)
}

const deleting = shallowRef<StorageDocument | null>(null)
function requestDelete(row: CloudDocumentRow) {
  deleting.value = listed.value.find((candidate) => candidate.id === row.id) ?? null
}

function open(row: CloudDocumentRow) {
  const document = listed.value.find((candidate) => candidate.id === row.id)
  if (!document) return
  // Opening reports its own failure.
  void openStorageDocumentInNewTab(document, location.value).catch(() => undefined)
}
</script>

<template>
  <CloudWorkspaceView
    v-model:view="view"
    :heading="workspace.name"
    :role="roles[workspace.role]"
    :documents="matching"
    :state="state"
    :usage="usage"
    :can-create="workspace.role !== 'viewer'"
    :can-delete="workspace.role !== 'viewer'"
    @open="open"
    @delete="requestDelete"
    @members="openWorkspaceMembers(serverId, workspace.id)"
    @refresh="files.refresh"
    @new-design="createStoredDocument(location)"
    @review-conflicts="reviewConflicts"
  />
  <DocumentDeleteDialog v-model:document="deleting" :location="location" />
</template>
