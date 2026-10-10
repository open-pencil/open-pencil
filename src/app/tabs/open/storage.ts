import type { EditorPreparationHandle } from '@/app/editor/preparation/types'
import {
  createStorageAdapter,
  storageLocationOf,
  type StorageDocument,
  type StorageDocumentBinding
} from '@/app/integrations/storage'
import { getLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import { seedStorageCanvasFromRemote } from '@/app/storage/sync/persist'

/**
 * Whether this device's copy can open in place of downloading: it has unsent changes or a
 * conflict to resolve, or it is based on the revision the provider lists. Providers without
 * revisions fall back to comparing modification times.
 */
export function localCopyIsCurrent(local: LocalCanvasMeta, document: StorageDocument): boolean {
  if (local.syncStatus !== 'synced') return true
  if (document.revision != null) return local.remoteRevision === document.revision
  return !document.metadataAuthoritative || local.updatedAt >= document.updatedAt
}

/** A stored document's bytes: this device's copy when current, otherwise downloaded and kept. */
export async function readStorageDocument(
  binding: StorageDocumentBinding,
  document: StorageDocument,
  load: EditorPreparationHandle
): Promise<Uint8Array> {
  load.update({ phase: 'reading', detail: document.name })
  const local = getLocalCanvasStore()
  const localMetadata = await local.getMeta(document.id)
  load.signal.throwIfAborted()
  const localBytes = localMetadata?.hasFig ? await local.readFig(document.id) : null
  load.signal.throwIfAborted()
  if (localBytes && localMetadata && localCopyIsCurrent(localMetadata, document)) return localBytes

  const content = await createStorageAdapter(binding).getDocument(
    document.id,
    (progress) =>
      load.update({
        phase: 'reading',
        detail: document.name,
        completed: progress.transferredBytes,
        total: progress.totalBytes,
        unit: 'bytes'
      }),
    load.signal
  )
  await seedStorageCanvasFromRemote({
    ...storageLocationOf(binding),
    canvasId: document.id,
    name: document.name,
    updatedAt: document.updatedAt,
    figBytes: content.bytes,
    remoteRevision: content.revision
  })
  load.signal.throwIfAborted()
  return content.bytes
}
