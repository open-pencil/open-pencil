import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import {
  enqueueDeleteCanvas,
  enqueuePutCanvas,
  enqueuePutMetadata,
  enqueuePutThumb
} from '@/app/storage/sync'
import type { StorageTargetID } from '@/app/storage/target'

export type PromotionResult = {
  promoted: string[]
  /** Rows that already belong somewhere else — never silently moved. */
  skipped: string[]
}

export type PromotionDependencies = {
  store: LocalCanvasStore
  enqueueCanvas(canvasId: string, revision: number): Promise<void>
  enqueueMetadata(canvasId: string, revision: number): Promise<void>
  enqueueThumbnail(canvasId: string, revision: number): Promise<void>
  enqueueDelete(canvasId: string): Promise<void>
}

/**
 * Send documents written before a cloud existed to the cloud that now does.
 *
 * Without this, connecting a bucket only affects documents created afterwards:
 * everything from the offline period stays local forever, which reads as the
 * connection having silently failed.
 *
 * Uses the ordinary outbox rather than a bespoke upload path, so promoted
 * documents take exactly the route a normal edit takes — no second
 * implementation to keep correct, and no duplicate ids, since canvas ids are
 * UUIDv4 and survive the transition unchanged.
 */
export async function promoteLocalDocuments(
  targetId: StorageTargetID,
  dependencies?: PromotionDependencies
): Promise<PromotionResult> {
  const runtime = dependencies ?? {
    store: getLocalCanvasStore(),
    enqueueCanvas: enqueuePutCanvas,
    enqueueMetadata: enqueuePutMetadata,
    enqueueThumbnail: enqueuePutThumb,
    enqueueDelete: enqueueDeleteCanvas
  }

  const promoted: string[] = []
  const skipped: string[] = []

  for (const meta of await runtime.store.listMetas(true)) {
    if (meta.tombstoned) {
      // A delete deferred while disconnected: the replica sits in exactly this
      // bucket, so completing the delete is the user's original decision, not
      // a promotion. Re-attach and let the ordinary delete job finish it.
      if (meta.lastKnownTargetId === targetId && meta.syncedBodyId !== null) {
        await runtime.store.updateMeta(meta.id, { syncTargetId: targetId })
        await runtime.enqueueDelete(meta.id)
      }
      continue
    }
    if (meta.syncTargetId === targetId) continue
    if (meta.syncTargetId !== null) {
      // Belongs to a different bucket. Retargeting it here would upload one
      // user's documents into whichever destination they happened to connect
      // next, which is not a decision this function gets to make.
      skipped.push(meta.id)
      continue
    }
    // Nullish, not `!== null`: rows predating the target model carry neither
    // field, and a strict null test read `undefined` as "left a destination" —
    // skipping documents that have genuinely never had one and are exactly what
    // promotion exists for.
    const lastKnownTargetId = meta.lastKnownTargetId ?? null
    if (lastKnownTargetId !== null && lastKnownTargetId !== targetId) {
      // Deliberately disconnected from somewhere else, not homeless.
      // `syncTargetId: null` means both "never had a destination" and "left the
      // one it had", and promoting on that alone swept documents the user had
      // just detached from one bucket straight into the next — the opposite of
      // what disconnect promises, and it copies them into a second cloud the
      // user never chose. `lastKnownTargetId` is what tells the two apart.
      // Reconnecting to the SAME target still promotes: the check is equality,
      // not presence.
      skipped.push(meta.id)
      continue
    }

    // Assign the target BEFORE enqueueing: the engine captures the row's target
    // at enqueue, so the other order would queue jobs addressed to nowhere.
    await runtime.store.updateMeta(meta.id, { syncTargetId: targetId })

    if (meta.hasFig) await runtime.enqueueCanvas(meta.id, meta.revision)
    else await runtime.enqueueMetadata(meta.id, meta.revision)
    if (meta.hasThumb) await runtime.enqueueThumbnail(meta.id, meta.revision)

    // Only now is `pending` true — it means "a durable job exists", and marking
    // it before the enqueue would strand the row if anything above threw.
    await runtime.store.updateMeta(meta.id, { syncStatus: 'pending' })
    promoted.push(meta.id)
  }

  return { promoted, skipped }
}
