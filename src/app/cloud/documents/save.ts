import { computed, ref, shallowRef, watch } from 'vue'

import type { EditorStore } from '@/app/editor/session'
import { rememberRecentStorageDocument } from '@/app/recent-files'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { getOutbox, syncUIState, uploadProgressByCanvas } from '@/app/storage/sync'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'

import { openCloudConnect } from '../connect/flow'
import { cloudServerHost } from '../servers/address'
import { cloudServers, findCloudServer } from '../servers/store'
import { cloudAPIClient, cloudConnection } from '../sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '../sessions/token'

export type CloudSaveState =
  | { kind: 'ready' }
  | { kind: 'saving'; sentBytes: number; totalBytes: number }
  | { kind: 'error'; reason: 'too-large'; limitBytes: number }
  | { kind: 'error'; reason: 'offline' | 'quota' | 'unavailable' }

export const cloudSaveOpen = ref(false)
export const cloudSaveName = ref('')
/** `serverId/workspaceId` of the chosen workspace. */
export const cloudSaveDestination = ref('')
export const cloudSaveState = shallowRef<CloudSaveState>({ kind: 'ready' })
let target: EditorStore | null = null

/** Workspaces of every signed-in server, grouped by server. */
export const cloudSaveDestinations = computed(() =>
  cloudServers.value.flatMap((server) => {
    const connection = cloudConnection(server.id)
    if (connection.state !== 'signed-in' || !connection.workspaces.length) return []
    return [
      {
        serverId: server.id,
        host: cloudServerHost(server.url),
        workspaces: connection.workspaces.map(({ id, name, role }) => ({ id, name, role }))
      }
    ]
  })
)

/** Opens Save to Cloud for a document, or the connect dialog when no server is signed in. */
export function openCloudSave(store: EditorStore): void {
  const destinations = cloudSaveDestinations.value
  if (!destinations.length) {
    openCloudConnect()
    return
  }
  target = store
  cloudSaveName.value = store.state.documentName || 'Untitled'
  const first = destinations
    .flatMap((server) => server.workspaces.map((workspace) => ({ server, workspace })))
    .find(({ workspace }) => workspace.role !== 'viewer')
  cloudSaveDestination.value = first ? `${first.server.serverId}/${first.workspace.id}` : ''
  cloudSaveState.value = { kind: 'ready' }
  cloudSaveOpen.value = true
}

/**
 * Follows a new document's first upload: true once it is on the server, or when the person
 * closes the dialog and leaves it to finish in the background; false when the upload failed.
 */
function waitForFirstUpload(documentId: string, totalBytes: number): Promise<boolean> {
  return new Promise((resolve) => {
    const stops: (() => void)[] = []
    const finish = (uploaded: boolean) => {
      for (const stop of stops) stop()
      resolve(uploaded)
    }
    async function check() {
      const meta = await getLocalCanvasStore().getMeta(documentId)
      if (meta?.syncStatus === 'synced') return finish(true)
      // The engine parks a job it cannot finish until the person acts, rather than dropping it.
      const jobs = await getOutbox().list()
      const parked = jobs.some(
        (job) => job.canvasId === documentId && job.nextAttemptAt === Number.MAX_SAFE_INTEGER
      )
      if (meta?.syncStatus === 'error' || parked) finish(false)
    }
    stops.push(
      watch(uploadProgressByCanvas, (progress) => {
        const sent = progress.get(documentId)
        if (sent !== undefined) {
          cloudSaveState.value = { kind: 'saving', sentBytes: sent * totalBytes, totalBytes }
        }
      }),
      watch(cloudSaveOpen, (open) => {
        if (!open) finish(true)
      }),
      // Failures move the engine's state without a document event.
      watch(syncUIState, () => void check()),
      onStorageWorkspaceEvent((event) => {
        if (event.documentId === documentId) void check()
      })
    )
  })
}

/**
 * Why the first upload failed, from the workspace's limits: the server refuses a file over its
 * size limit or one that does not fit the remaining storage without saying which.
 */
async function uploadFailure(
  serverId: string,
  workspaceId: string,
  size: number
): Promise<CloudSaveState> {
  const server = findCloudServer(serverId)
  const discovery = server ? cloudConnection(server.id).discovery : null
  if (!server || !discovery) return { kind: 'error', reason: 'unavailable' }
  const entitlements = await cloudAPIClient(server, discovery)
    .getWorkspaceEntitlements(workspaceId)
    .catch(() => null)
  if (!entitlements) return { kind: 'error', reason: 'unavailable' }
  const { limits, usage } = entitlements
  if (size > limits.maximumFileBytes) {
    return { kind: 'error', reason: 'too-large', limitBytes: limits.maximumFileBytes }
  }
  const stored = usage.committedStorageBytes + usage.reservedStorageBytes
  if (limits.maximumStorageBytes !== null && stored + size > limits.maximumStorageBytes) {
    return { kind: 'error', reason: 'quota' }
  }
  return { kind: 'error', reason: 'unavailable' }
}

/**
 * Saves the document to the chosen workspace: it is kept on this device and the tab moves to
 * the Cloud copy at once, then the dialog follows the first upload. The file it came from is left
 * as it was.
 */
export async function saveToCloud(): Promise<boolean> {
  const store = target
  const [serverId, workspaceId] = cloudSaveDestination.value.split('/')
  const name = cloudSaveName.value.trim()
  if (!store || !serverId || !workspaceId || !name) return false
  if (!navigator.onLine) {
    cloudSaveState.value = { kind: 'error', reason: 'offline' }
    return false
  }
  store.state.documentName = name
  cloudSaveState.value = { kind: 'saving', sentBytes: 0, totalBytes: 0 }
  const location = {
    providerId: CLOUD_STORAGE_PROVIDER_ID,
    profileId: serverId,
    containerId: workspaceId
  }
  if (!(await store.saveFigFileToStorage(location))) {
    cloudSaveState.value = { kind: 'error', reason: 'unavailable' }
    return false
  }
  const binding = store.getStorageBinding()
  if (!binding) return false
  rememberRecentStorageDocument(binding, name)
  const meta = await getLocalCanvasStore().getMeta(binding.documentId)
  const size = meta?.figSize ?? 0
  if (!(await waitForFirstUpload(binding.documentId, size))) {
    cloudSaveState.value = await uploadFailure(serverId, workspaceId, size)
    return false
  }
  cloudSaveOpen.value = false
  return true
}
