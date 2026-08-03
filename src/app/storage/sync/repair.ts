import { backupIsActive } from '@/app/storage/backup'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { LocalCanvasMeta } from '@/app/storage/local-store/types'
import { getOutbox, type Outbox } from '@/app/storage/sync/outbox'
import type { OutboxJobType } from '@/app/storage/sync/types'
import type { StorageTargetID } from '@/app/storage/target'

/**
 * Job types whose completion writes `syncStatus`, and therefore the only ones
 * that can ever clear a `pending` row.
 *
 * `putThumb` is deliberately absent. A thumbnail job succeeds without touching
 * `syncStatus` — that separation is the whole point of `lastThumbSyncError` —
 * so treating one as "work is outstanding" would leave the row pending after it
 * drained, which is the exact state this sweep exists to remove.
 */
const STATUS_RESOLVING_JOBS: ReadonlySet<OutboxJobType> = new Set<OutboxJobType>([
  'putCanvas',
  'putMetadata',
  'deleteCanvas'
])

export type OrphanedPendingRepairDependencies = {
  getStore: () => LocalCanvasStore
  getOutbox: () => Outbox
  /**
   * Whether uploads are permitted at all. Off means PAUSE, so the sweep may
   * still correct a row's status but must never create work for the remote.
   */
  backupActive: () => boolean
}

export type OrphanedPendingRepairResult = {
  /** Rows with genuinely outstanding bytes; a body job was queued for them. */
  requeued: number
  /** Rows with a destination and nothing left to send. */
  markedSynced: number
  /** Rows with no destination, or none while backup is paused. */
  markedLocal: number
}

const defaultDependencies: OrphanedPendingRepairDependencies = {
  getStore: getLocalCanvasStore,
  getOutbox,
  backupActive: backupIsActive
}

/** Destinations that currently have a status-resolving job queued, per canvas. */
async function indexQueuedTargets(
  outbox: Outbox
): Promise<Map<string, Set<StorageTargetID | null>>> {
  const index = new Map<string, Set<StorageTargetID | null>>()
  for (const job of await outbox.list()) {
    if (!STATUS_RESOLVING_JOBS.has(job.type)) continue
    const targets = index.get(job.canvasId) ?? new Set<StorageTargetID | null>()
    targets.add(job.targetId)
    index.set(job.canvasId, targets)
  }
  return index
}

/**
 * Whether a row still owes bytes to its destination.
 *
 * Both halves matter. `bodyId !== syncedBodyId` says the confirmed remote copy
 * is not the current body; `hasFig` says there is something on disk to send.
 * An index-only or evicted row satisfies the first and fails the second, and
 * enqueueing for it would produce a job that fails on missing local bytes and
 * demotes a perfectly healthy document to `error`.
 */
function hasOutstandingBody(meta: LocalCanvasMeta): boolean {
  return meta.hasFig && meta.bodyId !== meta.syncedBodyId
}

/**
 * Clear `pending` rows that no job will ever complete.
 *
 * `pending` is a claim that a durable job exists for the row's current target.
 * Older builds broke that claim: a rename on a bodyless row demoted it to
 * `pending` and then declined to enqueue the repair, leaving a row nothing
 * clears — not the pump, which sees an empty outbox, and not eviction, which
 * skips anything unsynced. The producer is fixed, but rows stranded by it are
 * still on disk, so they need collecting once.
 *
 * Every decision comes from durable facts — local bytes, body identity, the
 * row's target, the queue itself — and never from `syncStatus`, which is the
 * field under suspicion. Status is repaired FROM jobs; jobs are never invented
 * from status.
 *
 * Idempotent by construction: a re-enqueued row now has a job for its current
 * target and is skipped, and a row moved to `synced`/`local` is no longer
 * `pending`. A second boot writes nothing.
 */
export async function repairOrphanedPendingRows(
  dependencies: Partial<OrphanedPendingRepairDependencies> = {}
): Promise<OrphanedPendingRepairResult> {
  const deps = { ...defaultDependencies, ...dependencies }
  const store = deps.getStore()
  const outbox = deps.getOutbox()
  const queued = await indexQueuedTargets(outbox)
  const result: OrphanedPendingRepairResult = { requeued: 0, markedSynced: 0, markedLocal: 0 }

  // Tombstoned rows are excluded by default and stay that way: their `pending`
  // is owned by a delete job and by reconcile, and a deleted document is not
  // something this sweep gets to resurrect as `synced`.
  for (const meta of await store.listMetas(false)) {
    if (meta.syncStatus !== 'pending') continue
    // A job pinned to a target the row no longer names does NOT count. The row
    // owes its current destination bytes that job will never send there.
    if (queued.get(meta.id)?.has(meta.syncTargetId) === true) continue

    if (meta.syncTargetId !== null && hasOutstandingBody(meta) && deps.backupActive()) {
      // Enqueue first, leave the row `pending` exactly as it is. Writing the
      // status before the job is what created these rows in the first place.
      await outbox.enqueue({
        canvasId: meta.id,
        type: 'putCanvas',
        revision: meta.revision,
        targetId: meta.syncTargetId
      })
      result.requeued += 1
      continue
    }

    // No destination, or backup is paused and this row still owes bytes: either
    // way nothing is coming, and `local` is the honest name for "committed here,
    // no upload intended". Pausing must not touch the remote, so a paused row
    // settles rather than queueing work that would fire the moment sync runs.
    const noUploadIntended = meta.syncTargetId === null || hasOutstandingBody(meta)
    await store.updateMeta(
      meta.id,
      {
        syncStatus: noUploadIntended ? 'local' : 'synced',
        // The row is no longer claiming to be mid-transfer, so a leftover error
        // from the attempt that stranded it would render as a live failure.
        lastSyncError: null
        // `lastSyncedAt` is deliberately untouched: no transfer was observed
        // here, and `syncedBodyId` is the field that proves a remote copy.
      },
      // Cheap compare-and-set. Another tab may have written the row between the
      // listing and here, and that write knows more than this sweep does.
      { expectedRevision: meta.revision }
    )
    if (noUploadIntended) result.markedLocal += 1
    else result.markedSynced += 1
  }

  return result
}
