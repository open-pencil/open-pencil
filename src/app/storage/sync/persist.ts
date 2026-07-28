import type { StorageProviderID } from '@/app/integrations/storage/types'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { enqueuePutCanvas } from '@/app/storage/sync/engine'

export type StoragePersistenceDependencies = {
  store: LocalCanvasStore
  enqueueCanvas(canvasId: string, revision: number): Promise<void>
}

export type PersistStorageCanvasOptions = {
  providerId: StorageProviderID
  canvasId: string
  name: string
  figBytes: Uint8Array
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
  const metadata = await runtime.store.writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    figBytes: options.figBytes,
    syncStatus: 'pending'
  })
  await runtime.enqueueCanvas(options.canvasId, metadata.revision)
  return { revision: metadata.revision }
}

export type SeedStorageCanvasOptions = {
  providerId: StorageProviderID
  canvasId: string
  name: string
  updatedAt: string
  figBytes: Uint8Array
  thumbnailBytes?: Uint8Array | null
  markSynced?: boolean
}

export async function seedStorageCanvasFromRemote(
  options: SeedStorageCanvasOptions
): Promise<void> {
  await getLocalCanvasStore().writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    updatedAt: options.updatedAt,
    figBytes: options.figBytes,
    thumbBytes: options.thumbnailBytes,
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
