import type { LocalCanvasStore } from '@/app/storage/local-store/store'

/**
 * Designs trashed before the trash synced were marked on this device only. Queue a metadata
 * commit for each, once, so storage and other devices learn they are in the trash. The jobs
 * wait like any other while storage is not set up.
 */
export async function migrateLocalTrashToRemote(
  store: LocalCanvasStore,
  enqueueMetadata: (canvasId: string, revision: number) => Promise<void>
): Promise<number> {
  const trashed = (await store.listMetas()).filter((meta) => meta.trashedAt !== null)
  for (const meta of trashed) await enqueueMetadata(meta.id, meta.revision)
  return trashed.length
}
