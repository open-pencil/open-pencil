import { tryOnScopeDispose, useOnline } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { getLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import { pendingSyncCount, syncUIState, uploadProgressByCanvas } from '@/app/storage/sync'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'

import { cloudServerHost } from '../servers/address'
import { findCloudServer } from '../servers/store'
import { cloudConnection } from '../sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '../sessions/token'

/** Where a Cloud document stands between this device and the server. */
export type CloudSyncState = 'synced' | 'uploading' | 'pending' | 'offline' | 'conflict' | 'error'

/**
 * The state from what this device recorded about the document: a choice to make or a failure
 * first, then an upload in flight, then changes waiting — offline or not — and otherwise saved.
 */
export function cloudSyncState(
  meta: Pick<LocalCanvasMeta, 'syncStatus'> | null,
  uploading: boolean,
  online: boolean
): CloudSyncState {
  if (meta?.syncStatus === 'conflict') return 'conflict'
  if (meta?.syncStatus === 'error') return 'error'
  if (uploading) return 'uploading'
  if (meta?.syncStatus === 'pending') return online ? 'pending' : 'offline'
  return 'synced'
}

export function isCloudBinding(binding: StorageDocumentBinding | null): boolean {
  return binding?.providerId === CLOUD_STORAGE_PROVIDER_ID
}

/** The open document's Cloud status, kept current while the component using it lives. */
export function useCloudDocumentStatus(binding: () => StorageDocumentBinding | null) {
  const meta = shallowRef<LocalCanvasMeta | null>(null)
  const online = useOnline()
  let reading = 0

  async function refresh(): Promise<void> {
    const current = binding()
    const read = ++reading
    const next =
      isCloudBinding(current) && current
        ? await getLocalCanvasStore().getMeta(current.documentId)
        : null
    if (read === reading) meta.value = next
  }

  watch([binding, syncUIState, pendingSyncCount], () => void refresh(), { immediate: true })
  tryOnScopeDispose(
    onStorageWorkspaceEvent((event) => {
      if (event.documentId && event.documentId === binding()?.documentId) void refresh()
    })
  )

  const location = computed(() => {
    const current = binding()
    if (!current || !isCloudBinding(current) || !current.profileId) return null
    const server = findCloudServer(current.profileId)
    if (!server) return null
    const workspace = cloudConnection(server.id).workspaces.find(
      (candidate) => candidate.id === current.containerId
    )
    return { serverId: server.id, host: cloudServerHost(server.url), workspace: workspace?.name }
  })

  const state = computed(() => {
    const current = binding()
    if (!location.value || !current) return null
    return cloudSyncState(
      meta.value,
      uploadProgressByCanvas.value.has(current.documentId),
      online.value
    )
  })

  return { state, location, meta }
}
