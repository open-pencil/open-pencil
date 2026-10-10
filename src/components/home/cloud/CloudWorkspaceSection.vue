<script setup lang="ts">
import { useLocalStorage, useOnline } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { useCloudMessages, useDocumentWorkspace, useI18n } from '@open-pencil/vue'

import { createCloudDocument } from '@/app/cloud/documents/create'
import { cloudSyncState } from '@/app/cloud/documents/status'
import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudAPIClient, cloudConnection } from '@/app/cloud/sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import { formatCommentTime, useCommentClock } from '@/app/comments/time'
import {
  sameStorageLocation,
  storageLocationOf,
  type StorageDocument,
  type StorageLocation
} from '@/app/integrations/storage'
import { getLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import { pendingSyncCount, syncUIState, uploadProgressByCanvas } from '@/app/storage/sync'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import { openStorageDocumentInNewTab } from '@/app/tabs'

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
const now = useCommentClock()
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
const metas = shallowRef<ReadonlyMap<string, LocalCanvasMeta>>(new Map())
const usage = shallowRef<{ usedBytes: number; totalBytes: number | null } | null>(null)

async function readLocal() {
  const requested = location.value
  const all = await getLocalCanvasStore().listMetas(true)
  const here = all.filter((meta) => sameStorageLocation(storageLocationOf(meta), requested))
  metas.value = new Map(here.map((meta) => [meta.id, meta]))
}

async function readUsage() {
  const server = findCloudServer(serverId)
  const discovery = cloudConnection(serverId).discovery
  if (!server || !discovery) return
  try {
    const { limits, usage: used } = await cloudAPIClient(
      server,
      discovery
    ).getWorkspaceEntitlements(workspace.id)
    usage.value = { usedBytes: used.committedStorageBytes, totalBytes: limits.maximumStorageBytes }
  } catch {
    // Usage is a detail; the files still list without it.
    usage.value = null
  }
}

watch(location, () => {
  fallback.value = []
  usage.value = null
  void files.refresh()
})
watch([files.documents, syncUIState, pendingSyncCount], () => void readLocal(), { immediate: true })
watch(
  files.documents,
  (documents) => {
    for (const document of documents) void files.loadPreview(document.id)
    void readUsage()
  },
  { immediate: true }
)

const listed = computed(() => (files.error.value ? fallback.value : files.documents.value))
const rows = computed<CloudDocumentRow[]>(() =>
  listed.value.map((document) => ({
    id: document.id,
    name: document.name,
    previewURL: files.previewURL(document.id),
    editedAt: formatCommentTime(document.updatedAt, now.value.getTime(), locale.value),
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

function open(row: CloudDocumentRow) {
  const document = listed.value.find((candidate) => candidate.id === row.id)
  if (document) void openStorageDocumentInNewTab(document, location.value)
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
    @open="open"
    @refresh="files.refresh"
    @new-design="createCloudDocument(location)"
    @review-conflicts="reviewConflicts"
  />
</template>
