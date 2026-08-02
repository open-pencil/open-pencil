import type { StorageDocumentFormat, StorageProviderID } from '@/app/integrations/storage/types'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { enqueuePutCanvas, enqueuePutThumb } from '@/app/storage/sync/engine'

export type StoragePersistenceDependencies = {
  store: LocalCanvasStore
  enqueueCanvas(canvasId: string, revision: number): Promise<void>
  enqueueThumbnail?(canvasId: string, revision: number): Promise<void>
}

export type PersistStorageCanvasOptions = {
  providerId: StorageProviderID
  canvasId: string
  name: string
  sourceFormat?: StorageDocumentFormat
  updatedAt?: string
  trashedAt?: string | null
  figBytes: Uint8Array
  thumbnailBytes?: Uint8Array | null
}

/** Write locally before scheduling remote synchronization. */
export async function persistStorageCanvasLocally(
  options: PersistStorageCanvasOptions,
  dependencies?: StoragePersistenceDependencies
): Promise<{ revision: number }> {
  const runtime = dependencies ?? {
    store: getLocalCanvasStore(),
    enqueueCanvas: enqueuePutCanvas,
    enqueueThumbnail: enqueuePutThumb
  }
  const metadata = await runtime.store.writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    sourceFormat: options.sourceFormat,
    updatedAt: options.updatedAt,
    trashedAt: options.trashedAt,
    figBytes: options.figBytes,
    thumbBytes: options.thumbnailBytes,
    syncStatus: 'pending'
  })
  await runtime.enqueueCanvas(options.canvasId, metadata.revision)
  if (options.thumbnailBytes?.byteLength) {
    if (dependencies?.enqueueThumbnail) {
      await dependencies.enqueueThumbnail(options.canvasId, metadata.revision)
    } else if (!dependencies) {
      await enqueuePutThumb(options.canvasId, metadata.revision)
    }
  }
  return { revision: metadata.revision }
}

export type SeedStorageCanvasOptions = {
  providerId: StorageProviderID
  canvasId: string
  name: string
  sourceFormat?: StorageDocumentFormat
  trashedAt?: string | null
  updatedAt: string
  figBytes: Uint8Array
  thumbnailBytes?: Uint8Array | null
  markSynced?: boolean
}

export async function seedStorageCanvasFromRemote(
  options: SeedStorageCanvasOptions
): Promise<void> {
  const metadata = await getLocalCanvasStore().writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    sourceFormat: options.sourceFormat,
    trashedAt: options.trashedAt,
    updatedAt: options.updatedAt,
    figBytes: options.figBytes,
    thumbBytes: options.thumbnailBytes,
    syncStatus: options.markSynced === false ? 'pending' : 'synced'
  })
  if (options.markSynced === false) return
  await getLocalCanvasStore().updateMeta(options.canvasId, {
    lastSyncedAt: options.updatedAt || new Date().toISOString(),
    syncStatus: 'synced',
    // These bytes were just downloaded FROM the remote, so the remote provably
    // has them — without this the row would never become evictable.
    bodySyncedRevision: metadata.revision,
    lastSyncError: null
  })
  await evictLocalFigCache(new Set([options.canvasId]))
}
