import { extractFigThumbnailFromReader } from '@open-pencil/fig'

import { storageLocationOf } from '@/app/integrations/storage/location'
import type { StorageLocation } from '@/app/integrations/storage/types'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { enqueuePutCanvas } from '@/app/storage/sync/engine'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

export type StoragePersistenceDependencies = {
  store: LocalCanvasStore
  enqueueCanvas(canvasId: string, revision: number): Promise<void>
}

export type PersistStorageCanvasOptions = StorageLocation & {
  canvasId: string
  name: string
  figBytes: Uint8Array
}

/** The preview a `.fig` carries, read in place. */
function figThumbnail(figBytes: Uint8Array): Promise<Uint8Array | null> {
  return extractFigThumbnailFromReader({
    size: figBytes.byteLength,
    async read(start, endExclusive) {
      return figBytes.subarray(start, endExclusive)
    }
  })
}

/** Write locally before scheduling remote synchronization. */
export async function persistStorageCanvasLocally(
  options: PersistStorageCanvasOptions,
  dependencies?: StoragePersistenceDependencies
): Promise<{ revision: number }> {
  const runtime = dependencies ?? {
    store: getLocalCanvasStore(),
    enqueueCanvas: enqueuePutCanvas
  }
  const thumbnailBytes = await figThumbnail(options.figBytes)
  const metadata = await runtime.store.writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    profileId: options.profileId,
    containerId: options.containerId,
    name: options.name,
    figBytes: options.figBytes,
    thumbBytes: thumbnailBytes,
    syncStatus: 'pending'
  })
  await runtime.enqueueCanvas(options.canvasId, metadata.revision)
  emitStorageWorkspaceEvent({
    ...storageLocationOf(options),
    documentId: options.canvasId,
    kind: 'changed'
  })
  return { revision: metadata.revision }
}

export type SeedStorageCanvasOptions = StorageLocation & {
  canvasId: string
  name: string
  updatedAt: string
  figBytes: Uint8Array
  thumbnailBytes?: Uint8Array | null
  markSynced?: boolean
  /** The provider revision the bytes are, so later uploads build on it. */
  remoteRevision?: string | null
}

export async function seedStorageCanvasFromRemote(
  options: SeedStorageCanvasOptions
): Promise<void> {
  await getLocalCanvasStore().writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    profileId: options.profileId,
    containerId: options.containerId,
    name: options.name,
    updatedAt: options.updatedAt,
    remoteRevision: options.remoteRevision ?? null,
    figBytes: options.figBytes,
    // Home shows the preview from the local copy, so a downloaded document brings its own.
    thumbBytes: options.thumbnailBytes ?? (await figThumbnail(options.figBytes)),
    syncStatus: options.markSynced === false ? 'pending' : 'synced'
  })
  if (options.markSynced === false) return
  await getLocalCanvasStore().updateMeta(options.canvasId, {
    lastSyncedAt: options.updatedAt || new Date().toISOString(),
    syncStatus: 'synced',
    lastSyncError: null
  })
  await evictLocalFigCache(new Set([options.canvasId]))
}
