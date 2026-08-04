import type { StorageAdapter, StorageDocument, StorageProviderID } from '@/app/integrations/storage'
import { createActiveStorageAdapter } from '@/app/integrations/storage'
import { backupIsActive } from '@/app/storage/backup'
import { createCanvasId } from '@/app/storage/id'
import { getLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import {
  enqueueDeleteCanvas,
  enqueuePutMetadata,
  persistStorageCanvasLocally
} from '@/app/storage/sync'
import { currentTargetIdFor, type StorageTargetID } from '@/app/storage/target'
import { createStorageThumbnail, isUsableStorageThumbnail } from '@/app/storage/thumbnail'

type StorageDocumentContent = {
  bytes: Uint8Array
  thumbnailBytes: Uint8Array | null
}

export type StorageDocumentMutationDependencies = {
  store: LocalCanvasStore
  adapter: StorageAdapter
  persist: typeof persistStorageCanvasLocally
  enqueueMetadata: typeof enqueuePutMetadata
  enqueueDelete: typeof enqueueDeleteCanvas
  createId: typeof createCanvasId
}

export type StorageDocumentDeletionFailure = {
  document: StorageDocument
  reason: unknown
}

export type StorageDocumentDeletionResult = {
  deleted: StorageDocument[]
  failed: StorageDocumentDeletionFailure[]
}

function dependenciesFor(
  providerId: StorageProviderID,
  dependencies?: StorageDocumentMutationDependencies
): StorageDocumentMutationDependencies {
  return (
    dependencies ?? {
      store: getLocalCanvasStore(),
      adapter: createActiveStorageAdapter(providerId),
      persist: persistStorageCanvasLocally,
      enqueueMetadata: enqueuePutMetadata,
      enqueueDelete: enqueueDeleteCanvas,
      createId: createCanvasId
    }
  )
}

async function readContent(
  document: StorageDocument,
  runtime: StorageDocumentMutationDependencies,
  requireThumbnail: boolean
): Promise<StorageDocumentContent> {
  const metadata = await runtime.store.getMeta(document.id)
  const localBytes = metadata?.hasFig ? await runtime.store.readFig(document.id) : null
  const bytes = localBytes ?? (await runtime.adapter.getDocument(document.id))
  let thumbnailBytes = await runtime.store.readThumb(document.id)
  if (!isUsableStorageThumbnail(thumbnailBytes) && runtime.adapter.getThumbnail) {
    thumbnailBytes = await runtime.adapter.getThumbnail(document.id).catch(() => null)
  }
  if (requireThumbnail && !isUsableStorageThumbnail(thumbnailBytes)) {
    thumbnailBytes = await createStorageThumbnail(bytes, document.sourceFormat).catch(() => null)
  }
  return { bytes, thumbnailBytes }
}

/**
 * Whether a metadata edit on this row owes the remote anything.
 *
 * Two independent reasons for "no": the row names no destination, and backup is
 * deliberately paused. Both gate at ENQUEUE rather than at the adapter — a job
 * created and then refused parks and reports a red failure for a document the
 * user chose not to upload, and the row it left behind is `pending` with no job
 * that can ever clear it.
 */
function uploadsTo(targetId: StorageTargetID | null): boolean {
  return targetId !== null && backupIsActive()
}

async function rewriteStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  patch: Pick<StorageDocument, 'name' | 'trashedAt'>,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  const runtime = dependenciesFor(providerId, dependencies)
  const updatedAt = new Date().toISOString()
  const existing = await runtime.store.getMeta(document.id)
  // An edit never moves a document: an existing row keeps the destination it
  // already has, and only a row this edit creates takes the current one.
  const targetId = existing ? existing.syncTargetId : currentTargetIdFor(providerId)
  const uploads = uploadsTo(targetId)
  const syncStatus = uploads ? 'pending' : 'local'
  const metadata = existing
    ? await runtime.store.updateMeta(document.id, {
        name: patch.name,
        trashedAt: patch.trashedAt,
        updatedAt,
        revision: existing.revision + 1,
        syncStatus,
        lastSyncError: null
      })
    : await runtime.store.upsertIndexMeta({
        id: document.id,
        syncTargetId: targetId,
        name: patch.name,
        sourceFormat: document.sourceFormat,
        trashedAt: patch.trashedAt,
        updatedAt,
        revision: 1,
        syncStatus,
        lastSyncedAt: document.updatedAt,
        lastSyncError: null
      })
  if (!metadata) throw new Error(`Stored document not found: ${document.id}`)
  if (uploads) await runtime.enqueueMetadata(document.id, metadata.revision)
  return {
    ...document,
    ...patch,
    updatedAt,
    metadataAuthoritative: true
  }
}

export function renameStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  name: string,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  return rewriteStorageDocument(
    providerId,
    document,
    { name: name.trim() || 'Untitled', trashedAt: document.trashedAt },
    dependencies
  )
}

export function moveStorageDocumentToTrash(
  providerId: StorageProviderID,
  document: StorageDocument,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  return rewriteStorageDocument(
    providerId,
    document,
    { name: document.name, trashedAt: new Date().toISOString() },
    dependencies
  )
}

export function restoreStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  return rewriteStorageDocument(
    providerId,
    document,
    { name: document.name, trashedAt: null },
    dependencies
  )
}

export async function duplicateStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  name: string,
  dependencies?: StorageDocumentMutationDependencies
): Promise<{ document: StorageDocument; thumbnailBytes: Uint8Array | null }> {
  const runtime = dependenciesFor(providerId, dependencies)
  const { bytes, thumbnailBytes } = await readContent(document, runtime, true)
  const id = runtime.createId()
  const updatedAt = new Date().toISOString()
  await runtime.persist({
    syncTargetId: currentTargetIdFor(providerId),
    canvasId: id,
    name,
    sourceFormat: document.sourceFormat,
    updatedAt,
    trashedAt: null,
    figBytes: bytes,
    thumbnailBytes
  })
  return {
    document: {
      id,
      name,
      sourceFormat: document.sourceFormat,
      trashedAt: null,
      updatedAt,
      metadataAuthoritative: true
    },
    thumbnailBytes
  }
}

/**
 * Remove a document for good.
 *
 * Three different things happen, and collapsing them was the bug. What decides
 * is whether a remote object can exist and whether we are allowed to touch it:
 *
 * 1. **No destination recorded** — nothing was ever replicated, so there is no
 *    remote object and nothing for a tombstone to suppress. The row and its
 *    bytes go now. A tombstone here would be a hidden row no listing ever
 *    purges: `reconcileStorageDocuments` clears tombstones by comparing against
 *    a remote listing, and a workspace with no destination never produces one.
 * 2. **A known replica while backup is PAUSED** — pause means the remote is not
 *    touched, so the object deliberately survives. The local bytes are reclaimed
 *    (the user asked for the document to be gone) but a lightweight tombstone
 *    stays behind, because the object is still in the bucket and the next
 *    listing would otherwise re-seed the document the user just deleted.
 * 3. **A known replica with backup on** — enqueue a delete pinned to the row's
 *    own destination. The tombstone is what keeps the document hidden until
 *    that delete is acknowledged; nothing removes it earlier.
 *
 * Known gap: a row disconnected first (target cleared, bytes kept) and deleted
 * afterwards takes path 1, so reconnecting to the same bucket can re-seed it.
 * Closing it needs a durable "last known destination" on the row, which the
 * schema does not carry.
 */
export async function permanentlyDeleteStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  dependencies?: StorageDocumentMutationDependencies
): Promise<void> {
  const runtime = dependenciesFor(providerId, dependencies)
  const existing = await runtime.store.getMeta(document.id)
  if (!existing) throw new Error(`Stored document not found: ${document.id}`)

  if (existing.syncTargetId === null) {
    await runtime.store.remove(document.id)
    return
  }

  const uploads = uploadsTo(existing.syncTargetId)
  // Hide it before anything else. Enqueueing first would let the pump delete
  // the remote object while the row is still live, and the acknowledgement
  // would then strip the bytes from a document still on screen.
  const tombstoned = await runtime.store.updateMeta(document.id, {
    tombstoned: true,
    syncStatus: uploads ? 'pending' : 'local',
    lastSyncError: null,
    updatedAt: new Date().toISOString()
  })
  if (!tombstoned) throw new Error(`Stored document not found: ${document.id}`)

  if (!uploads) {
    // Nothing is coming to reclaim these bytes later, so reclaim them now. The
    // remote copy is left exactly as it is: this is a pause, not a withdrawal.
    await runtime.store.clearFig(document.id)
    return
  }

  try {
    await runtime.enqueueDelete(document.id)
  } catch (error) {
    // `pending` promises a durable job, and the sweep that repairs broken
    // promises skips tombstoned rows — its `pending` belongs to a delete job.
    // So this one has to repair itself, back to the state a paused delete
    // produces: hidden, reclaimable, and retryable by the user.
    await runtime.store.updateMeta(document.id, { syncStatus: 'local' })
    throw error
  }
}

/** Delete a batch without letting one failed row strand everything after it. */
export async function permanentlyDeleteStorageDocuments(
  providerId: StorageProviderID,
  documents: StorageDocument[],
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocumentDeletionResult> {
  const runtime = dependenciesFor(providerId, dependencies)
  const result: StorageDocumentDeletionResult = { deleted: [], failed: [] }

  for (const document of documents) {
    try {
      await permanentlyDeleteStorageDocument(providerId, document, runtime)
      result.deleted.push(document)
    } catch (reason) {
      result.failed.push({ document, reason })
    }
  }

  return result
}
