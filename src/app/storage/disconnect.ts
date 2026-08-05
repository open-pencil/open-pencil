import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { getOutbox, type Outbox } from '@/app/storage/sync/outbox'
import type { StorageTargetID } from '@/app/storage/target'

export type DisconnectDependencies = {
  store: LocalCanvasStore
  outbox: Outbox
}

export type DisconnectResult = {
  /** Locally backed rows that kept their bytes and became local-only. */
  localizedIds: string[]
  /** Index-only rows dropped from the visible set — their bytes were only remote. */
  removedIds: string[]
  /** Tombstones deliberately kept, still scoped to the disconnected target. */
  retainedTombstoneIds: string[]
  /** Queued uploads cancelled because their destination is no longer connected. */
  cancelledJobIds: string[]
}

function defaultDependencies(): DisconnectDependencies {
  return { store: getLocalCanvasStore(), outbox: getOutbox() }
}

/**
 * Stop replicating to a destination, without removing anything from it.
 *
 * Disconnect is not withdraw. Nothing here touches the remote — the user is
 * unhooking this device from a bucket, which is a decision about where future
 * writes go, not a request to empty it. A destructive disconnect would make
 * "stop syncing" the most dangerous button in the app.
 *
 * Rows at the disconnected target fall into three kinds and each needs a
 * different answer:
 *
 * 1. **Locally backed** — bytes and metadata stay exactly as they are; the row
 *    clears its destination and becomes `local`. `syncedBodyId` goes with it:
 *    it records a confirmation from a bucket this device no longer talks to,
 *    and left behind it tells eviction the only copy is safe to delete.
 * 2. **Index-only** — the row exists only because a listing named it, and its
 *    bytes live solely in the bucket. Keeping it would leave a card that cannot
 *    be opened, so it leaves the visible set. Nothing is lost: reconnecting
 *    re-seeds it from the same listing.
 * 3. **Tombstoned** — kept, hidden, and still pinned to that target. This is the
 *    one that has to survive: drop it and reconnecting re-seeds every document
 *    the user deleted while paused, because a listing is the only thing the
 *    tombstone was suppressing.
 *
 * Queued uploads for the target are cancelled — after disconnect they can no
 * longer resolve, and a parked upload reports a red failure for work the user
 * cancelled by disconnecting. Queued DELETES are kept for the same reason
 * `retargetStorageDocument` keeps them: a delete is a removal the user asked
 * for at that destination, and silently dropping it leaves the object behind
 * with a local tombstone that will never be reconciled away. It parks visibly
 * while disconnected and completes if the user reconnects.
 */
export async function disconnectStorageTarget(
  targetId: StorageTargetID,
  dependencies?: Partial<DisconnectDependencies>
): Promise<DisconnectResult> {
  const deps = { ...defaultDependencies(), ...dependencies }
  const result: DisconnectResult = {
    localizedIds: [],
    removedIds: [],
    retainedTombstoneIds: [],
    cancelledJobIds: []
  }

  const queued = await deps.outbox.list()
  for (const job of queued) {
    if (job.targetId !== targetId || job.type === 'deleteCanvas') continue
    await deps.outbox.remove(job.id)
    result.cancelledJobIds.push(job.id)
  }

  // Tombstones are invisible by default, and they are precisely what this
  // transition must not lose.
  for (const meta of await deps.store.listMetas(true)) {
    if (meta.syncTargetId !== targetId) continue

    if (meta.tombstoned) {
      result.retainedTombstoneIds.push(meta.id)
      continue
    }

    if (!meta.hasFig) {
      await deps.store.remove(meta.id)
      result.removedIds.push(meta.id)
      continue
    }

    await deps.store.updateMeta(meta.id, {
      syncTargetId: null,
      // Recorded explicitly rather than left to write-time history: this is what
      // separates "left a destination" from "never had one". Both look like
      // `syncTargetId: null`, and `promoteLocalDocuments` used to sweep the
      // first kind into whichever bucket was connected next — copying documents
      // into a cloud the user never chose, moments after a dialog promised they
      // would be kept here as local files.
      lastKnownTargetId: targetId,
      syncedBodyId: null,
      syncStatus: 'local',
      lastSyncedAt: null,
      lastSyncError: null,
      lastThumbSyncError: null
    })
    result.localizedIds.push(meta.id)
  }

  return result
}
