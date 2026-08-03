import type { StorageDocumentFormat, StorageProviderID } from '@/app/integrations/storage/types'
import { computeBodyIdSafe } from '@/app/storage/body-id'
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
  const format = options.sourceFormat ?? 'fig'
  const bodyId = await computeBodyIdSafe(options.figBytes, format)
  const existing = await runtime.store.getMeta(options.canvasId)

  const metadata = await runtime.store.writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    sourceFormat: options.sourceFormat,
    updatedAt: options.updatedAt,
    trashedAt: options.trashedAt,
    figBytes: options.figBytes,
    thumbBytes: options.thumbnailBytes,
    bodyId,
    syncStatus: 'pending'
  })

  // Identical content: the remote already holds these exact bytes, so there is
  // nothing to upload. Autosave fires on activity that often changes nothing,
  // and uploading unchanged bytes is the single largest source of waste here.
  if (existing?.syncedBodyId === bodyId) {
    await runtime.store.updateMeta(options.canvasId, { syncStatus: 'synced' })
  } else {
    await runtime.enqueueCanvas(options.canvasId, metadata.revision)
  }
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
  const bodyId = await computeBodyIdSafe(options.figBytes, options.sourceFormat ?? 'fig')
  await getLocalCanvasStore().writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    sourceFormat: options.sourceFormat,
    trashedAt: options.trashedAt,
    updatedAt: options.updatedAt,
    figBytes: options.figBytes,
    thumbBytes: options.thumbnailBytes,
    bodyId,
    // These bytes were just downloaded FROM the remote, so the remote provably
    // has them — without this the row would never become evictable.
    syncedBodyId: options.markSynced === false ? undefined : bodyId,
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
