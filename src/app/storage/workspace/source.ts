import type { StorageDocument } from '@/app/integrations/storage'
import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  isStorageConfigured
} from '@/app/integrations/storage'
import { markListingConflicts } from '@/app/storage/conflict'
import { currentStorageDestination } from '@/app/storage/destination'
import { getLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { reconcileStorageDocuments, type StorageReconciliation } from '@/app/storage/reconcile'
import { remoteStateFields } from '@/app/storage/sync/commit'
import { getOutbox } from '@/app/storage/sync/outbox'
import { enqueuePutCanvas } from '@/app/storage/sync/runtime'
import { resolveConflictAutomatically } from '@/app/storage/workspace/conflict'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'

/** A design in the library, with whether it is waiting on a conflict resolution. */
export type LibraryDocument = StorageDocument & { conflicted: boolean }

export type StorageWorkspaceSnapshot = {
  documents: LibraryDocument[]
  configured: boolean
  /** Why storage could not be listed; the designs on this device are listed regardless. */
  syncError?: unknown
  /** Listed from this device alone, so it says nothing new about storage. */
  localOnly?: boolean
}

/**
 * The library follows the active destination: a row synced to another bucket stays on this
 * device but is listed only when storage points there again. A design not synced anywhere yet
 * is listed everywhere, and so is every design while storage is not set up.
 */
export function listedAtDestination(meta: LocalCanvasMeta, destination: string | null): boolean {
  return (
    destination === null || meta.syncDestination === null || meta.syncDestination === destination
  )
}

function localDocument(entry: LocalCanvasMeta): StorageDocument {
  return {
    id: entry.id,
    name: entry.name,
    updatedAt: entry.updatedAt,
    sourceFormat: entry.sourceFormat,
    trashedAt: entry.trashedAt,
    metadataAuthoritative: true
  }
}

/** Designs in the trash stay in storage until they are deleted, but the library hides them. */
function libraryDocuments(
  documents: StorageDocument[],
  local: LocalCanvasMeta[]
): LibraryDocument[] {
  const statusById = new Map(local.map((entry) => [entry.id, entry.syncStatus]))
  return documents
    .filter((document) => document.trashedAt === null)
    .map((document) => ({ ...document, conflicted: statusById.get(document.id) === 'conflict' }))
}

async function seedListedDocuments(
  store: LocalCanvasStore,
  providerId: string,
  documents: StorageDocument[],
  destination: string | null
): Promise<void> {
  for (const document of documents) {
    await store.upsertIndexMeta({
      id: document.id,
      providerId,
      name: document.name,
      updatedAt: document.updatedAt,
      sourceFormat: document.sourceFormat,
      trashedAt: document.trashedAt,
      syncStatus: 'synced',
      lastSyncedAt: document.updatedAt,
      lastSyncError: null,
      syncedBodyId: document.bodyId ?? null,
      baseStateId: document.stateId ?? null,
      versionedConfirmed: document.versioned === true && document.bodyId !== undefined,
      syncDestination: destination
    })
  }
}

/** Clean rows follow what other devices committed; a changed body is downloaded on open. */
async function applyRemoteUpdates(
  store: LocalCanvasStore,
  local: Map<string, LocalCanvasMeta>,
  reconciliation: StorageReconciliation,
  destination: string | null
): Promise<void> {
  for (const { document, dropLocalBody } of reconciliation.remoteUpdates) {
    const row = local.get(document.id)
    if (!row) continue
    if (dropLocalBody) await store.clearFig(document.id)
    await store.updateMeta(
      document.id,
      {
        ...remoteStateFields(document, destination),
        bodyId: dropLocalBody ? null : row.bodyId,
        lastSyncedAt: document.updatedAt,
        lastPublishedStateId: null,
        lastPublishedParentStateId: null
      },
      { expectedRevision: row.revision }
    )
  }
}

/** Rows with bytes the destination has not confirmed in the versioned layout upload once. */
async function queueUnconfirmedBodies(
  store: LocalCanvasStore,
  reconciliation: StorageReconciliation
): Promise<void> {
  const skipped = new Set([
    ...reconciliation.remoteUpdates.map((update) => update.document.id),
    ...reconciliation.forkedIds
  ])
  const queued = new Set((await getOutbox().list()).map((job) => job.canvasId))
  for (const id of reconciliation.bodyUnconfirmedIds) {
    if (skipped.has(id) || queued.has(id)) continue
    const row = await store.getMeta(id)
    if (row) await enqueuePutCanvas(id, row.revision)
  }
}

/** Forks and listing-time conflicts are kept as both versions, like a conflict at commit. */
async function resolveListedConflicts(
  store: LocalCanvasStore,
  local: LocalCanvasMeta[],
  remote: StorageDocument[],
  forkedIds: string[]
): Promise<void> {
  for (const id of forkedIds) {
    const row = await store.getMeta(id)
    if (!row) continue
    await store.updateMeta(id, { syncStatus: 'conflict' }, { expectedRevision: row.revision })
  }
  const conflicts = [...forkedIds, ...(await markListingConflicts(store, local, remote))]
  for (const id of conflicts) await resolveConflictAutomatically(id)
}

/**
 * The library: the designs saved on this device, merged with storage's listing once storage is
 * set up. A storage that cannot be reached never hides the designs on this device.
 */
export function createStorageWorkspaceSource(
  onSnapshot: (snapshot: StorageWorkspaceSnapshot) => void
) {
  // A change on this device (a save, a rename, a commit) relists from this device alone: the
  // listed remote designs are already recorded here, and storage requests are counted, so the
  // bucket is listed on open, on its interval, on focus, and on request instead.
  let localOnlyNext = false
  return {
    subscribe(listener: () => void): () => void {
      return onStorageWorkspaceEvent((event) => {
        if (event.providerId !== activeStorageProviderID.value) return
        localOnlyNext = true
        listener()
      })
    },

    async refresh(): Promise<LibraryDocument[] | null> {
      const localOnly = localOnlyNext
      localOnlyNext = false
      const providerID = activeStorageProviderID.value
      const configured = await isStorageConfigured(providerID)
      const destination = configured ? currentStorageDestination(providerID) : null
      const localStore = getLocalCanvasStore()
      const local = (await localStore.listMetas(true)).filter(
        (metadata) =>
          metadata.providerId === providerID && listedAtDestination(metadata, destination)
      )
      const visible = local.filter((entry) => !entry.tombstoned)
      if (!configured || localOnly) {
        const documents = libraryDocuments(visible.map(localDocument), visible)
        if (activeStorageProviderID.value !== providerID) return null
        onSnapshot({ documents, configured, localOnly: configured })
        return documents
      }

      let remote: StorageDocument[]
      try {
        remote = await createActiveStorageAdapter(providerID).listDocuments()
      } catch (syncError) {
        const documents = libraryDocuments(visible.map(localDocument), visible)
        if (activeStorageProviderID.value !== providerID) return null
        onSnapshot({ documents, configured, syncError })
        return documents
      }
      const reconciliation = reconcileStorageDocuments(local, remote, destination)
      for (const id of reconciliation.localIdsToPurge) await localStore.remove(id)
      await seedListedDocuments(
        localStore,
        providerID,
        reconciliation.remoteDocumentsToSeed,
        destination
      )
      await applyRemoteUpdates(
        localStore,
        new Map(local.map((entry) => [entry.id, entry])),
        reconciliation,
        destination
      )
      await resolveListedConflicts(localStore, local, remote, reconciliation.forkedIds)
      await queueUnconfirmedBodies(localStore, reconciliation)
      if (activeStorageProviderID.value !== providerID) return null
      const documents = libraryDocuments(reconciliation.documents, await localStore.listMetas())
      onSnapshot({ documents, configured })
      return documents
    },

    loadPreview: loadLibraryPreview
  }
}

/** A design's preview: cached on this device, else read from storage and cached. */
export async function loadLibraryPreview(id: string): Promise<Uint8Array | null> {
  const providerID = activeStorageProviderID.value
  const localStore = getLocalCanvasStore()
  const local = await localStore.readThumb(id)
  if (local?.byteLength) return local
  const adapter = createActiveStorageAdapter(providerID)
  if (!adapter.getThumbnail) return null
  const remote = await adapter.getThumbnail(id)
  if (!remote?.byteLength) return null
  if (activeStorageProviderID.value === providerID) await localStore.writeThumb(id, remote)
  return remote
}
