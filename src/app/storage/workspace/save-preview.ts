import { storageLocationOf } from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { enqueuePutThumb } from '@/app/storage/sync/engine'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

/**
 * Keeps a drawn preview of a storage design, queues it for upload, and tells the workspace it
 * changed. False when the design is not kept locally, so there is nowhere to keep the preview.
 */
export async function saveStoragePreview(documentId: string, bytes: Uint8Array): Promise<boolean> {
  const written = await getLocalCanvasStore().writeThumb(documentId, bytes)
  if (!written) return false
  await enqueuePutThumb(documentId, written.revision)
  emitStorageWorkspaceEvent({ ...storageLocationOf(written), documentId, kind: 'preview' })
  return true
}
