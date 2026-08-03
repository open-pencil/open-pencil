import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'
import { getOutbox, type Outbox } from '@/app/storage/sync/outbox'
import { enqueuePutCanvas } from '@/app/storage/sync/runtime'
import type { StorageTargetID } from '@/app/storage/target'

export type RetargetDependencies = {
  store: LocalCanvasStore
  outbox: Outbox
  enqueueCanvas: (canvasId: string, revision: number) => Promise<void>
}

export type RetargetResult = {
  meta: LocalCanvasMeta | null
  /** Queued jobs cancelled because they were addressed to the old destination. */
  cancelledJobIds: string[]
  /** Whether a fresh upload was queued for the new destination. */
  queuedUpload: boolean
}

function defaultDependencies(): RetargetDependencies {
  return {
    store: getLocalCanvasStore(),
    outbox: getOutbox(),
    enqueueCanvas: enqueuePutCanvas
  }
}

/**
 * Move a document to a different destination, as one explicit transaction.
 *
 * Retargeting is not a field edit. Three separate pieces of state describe
 * "where this document lives", and changing only the obvious one leaves the
 * other two lying about a bucket that has never seen the document:
 *
 * 1. **Queued work for the old destination is cancelled.** Those jobs were
 *    addressed to a place this document no longer belongs to. They cannot be
 *    redirected — their bytes were promised to the old bucket — so the only
 *    correct outcome is to drop them and queue fresh work for the new one.
 * 2. **`syncedBodyId` is cleared.** It records the body identity CONFIRMED at
 *    the previous target. Carried across, the new destination inherits a claim
 *    that it holds bytes it has never seen, and eviction is then free to delete
 *    the only local copy.
 * 3. **No remote object is deleted.** A document that stops replicating to a
 *    bucket is not a document the user asked to remove from it. Cleanup is a
 *    separate, explicit decision; doing it here would make changing a setting
 *    destroy data.
 *
 * The fourth property lives in `markRevisionSynced`: an upload already in
 * flight when this runs completes against the target it captured, and its
 * completion is refused rather than written against the new one.
 */
export async function retargetStorageDocument(
  canvasId: string,
  nextTargetId: StorageTargetID | null,
  dependencies?: Partial<RetargetDependencies>
): Promise<RetargetResult> {
  const deps = { ...defaultDependencies(), ...dependencies }
  const meta = await deps.store.getMeta(canvasId)
  if (!meta) return { meta: null, cancelledJobIds: [], queuedUpload: false }
  if (meta.syncTargetId === nextTargetId) {
    return { meta, cancelledJobIds: [], queuedUpload: false }
  }

  const queued = await deps.outbox.list()
  const cancelled = queued.filter(
    (job) =>
      job.canvasId === canvasId &&
      // A queued delete is a deletion the USER asked for at the old
      // destination. Cancelling it silently would leave the object behind;
      // it is the one job a retarget must not touch.
      job.type !== 'deleteCanvas'
  )
  for (const job of cancelled) await deps.outbox.remove(job.id)

  // Only a row that actually holds bytes can queue an upload. A bodyless
  // index-only row has nothing to send, and `pending` without a durable job is
  // the unrecoverable state phase 1 removed.
  const canUpload = nextTargetId !== null && meta.bodyId !== null
  const updated = await deps.store.updateMeta(canvasId, {
    syncTargetId: nextTargetId,
    syncedBodyId: null,
    syncStatus: canUpload ? 'pending' : 'synced',
    lastSyncedAt: null,
    lastSyncError: null
  })
  if (canUpload) await deps.enqueueCanvas(canvasId, updated?.revision ?? meta.revision)

  return {
    meta: updated,
    cancelledJobIds: cancelled.map((job) => job.id),
    queuedUpload: canUpload
  }
}
