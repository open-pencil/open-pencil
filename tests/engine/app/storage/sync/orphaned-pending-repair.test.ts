import { describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store/memory'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { createMemoryOutbox, type Outbox } from '@/app/storage/sync/outbox'
import { repairOrphanedPendingRows } from '@/app/storage/sync/repair'

const BODY = new Uint8Array(128).fill(7)
const TARGET_A = 's3-compatible#aaaaaaaa'
const TARGET_B = 's3-compatible#bbbbbbbb'

type Fixture = {
  store: LocalCanvasStore
  outbox: Outbox
  pauseBackup(): void
  repair: () => ReturnType<typeof repairOrphanedPendingRows>
}

function fixture(): Fixture {
  const store = createMemoryLocalCanvasStore()
  const outbox = createMemoryOutbox()
  let backupOn = true
  return {
    store,
    outbox,
    pauseBackup: () => {
      backupOn = false
    },
    repair: () =>
      repairOrphanedPendingRows({
        getStore: () => store,
        getOutbox: () => outbox,
        backupActive: () => backupOn
      })
  }
}

/** A row with local bytes whose current body has never been confirmed remotely. */
async function seedUnsentBody(
  store: LocalCanvasStore,
  id: string,
  syncTargetId: string | null
): Promise<void> {
  await store.writeCanvas({
    id,
    syncTargetId,
    name: id,
    sourceFormat: 'fig',
    figBytes: BODY,
    bodyId: `${id}-body`,
    syncStatus: 'pending'
  })
}

/** A row whose bytes are on the remote — nothing left to send. */
async function seedConfirmedBody(
  store: LocalCanvasStore,
  id: string,
  syncTargetId: string
): Promise<void> {
  await store.writeCanvas({
    id,
    syncTargetId,
    name: id,
    sourceFormat: 'fig',
    figBytes: BODY,
    bodyId: `${id}-body`,
    syncedBodyId: `${id}-body`,
    syncStatus: 'pending'
  })
}

/** A remote row never downloaded: no bytes, no body identity. */
async function seedIndexOnly(
  store: LocalCanvasStore,
  id: string,
  syncTargetId: string
): Promise<void> {
  await store.upsertIndexMeta({
    id,
    syncTargetId,
    name: id,
    updatedAt: '2026-08-01T00:00:00.000Z',
    syncStatus: 'pending',
    lastSyncedAt: null,
    lastSyncError: null
  })
}

/**
 * `pending` is a claim that a durable job exists for the row's current target.
 *
 * Older builds broke that claim — a rename on a bodyless row demoted the status
 * and then declined to enqueue the repair — and the resulting rows are
 * unrecoverable: the pump sees an empty outbox, eviction skips anything
 * unsynced, and nothing else ever looks. The producer is fixed; these rows are
 * still on disk.
 */
describe('boot sweep repairs pending rows that no job will ever complete', () => {
  test('re-enqueues the body a row still owes its destination', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-a', TARGET_A)

    const result = await f.repair()

    const [job] = await f.outbox.list()
    expect(job?.type).toBe('putCanvas')
    expect(job?.canvasId).toBe('doc-a')
    // Addressed explicitly, never left null: an unrouted job parks on its first
    // run and reports a failure for a document that is merely stranded.
    expect(job?.targetId).toBe(TARGET_A)
    // The row was already pending and stays that way — now truthfully.
    expect((await f.store.getMeta('doc-a'))?.syncStatus).toBe('pending')
    expect(result).toEqual({ requeued: 1, markedSynced: 0, markedLocal: 0 })
  })

  test('settles a targeted row with nothing left to send to synced', async () => {
    const f = fixture()
    await seedConfirmedBody(f.store, 'doc-b', TARGET_A)

    const result = await f.repair()

    const meta = await f.store.getMeta('doc-b')
    expect(meta?.syncStatus).toBe('synced')
    expect(await f.outbox.list()).toHaveLength(0)
    expect(result).toEqual({ requeued: 0, markedSynced: 1, markedLocal: 0 })
  })

  test('settles a row with no destination to local', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-c', null)

    const result = await f.repair()

    // `local` means committed here with no upload intended. Calling it pending
    // implied a job, and there is nowhere for that job to go.
    expect((await f.store.getMeta('doc-c'))?.syncStatus).toBe('local')
    expect(await f.outbox.list()).toHaveLength(0)
    expect(result).toEqual({ requeued: 0, markedSynced: 0, markedLocal: 1 })
  })

  test('never invents a body job for a row with no bytes', async () => {
    const f = fixture()
    // The original defect, verbatim: rename an index-only row, watch it demote
    // to `pending` with an empty outbox and stay there forever.
    await seedIndexOnly(f.store, 'doc-d', TARGET_A)
    // And the evicted variant — bytes gone, body identity still unconfirmed, so
    // `bodyId !== syncedBodyId` is true while there is nothing to upload.
    await seedUnsentBody(f.store, 'doc-e', TARGET_A)
    await f.store.clearFig('doc-e')

    const result = await f.repair()

    expect(await f.outbox.list()).toHaveLength(0)
    expect((await f.store.getMeta('doc-d'))?.syncStatus).toBe('synced')
    expect((await f.store.getMeta('doc-e'))?.syncStatus).toBe('synced')
    expect(result).toEqual({ requeued: 0, markedSynced: 2, markedLocal: 0 })
  })

  test('running twice changes nothing', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-f', TARGET_A)
    await seedConfirmedBody(f.store, 'doc-g', TARGET_A)
    await seedUnsentBody(f.store, 'doc-h', null)

    const first = await f.repair()
    const jobsAfterFirst = await f.outbox.list()
    const metasAfterFirst = await f.store.listMetas()
    const second = await f.repair()

    expect(first).toEqual({ requeued: 1, markedSynced: 1, markedLocal: 1 })
    // The re-enqueued row now HAS a job for its current target, so the second
    // pass sees a consistent row rather than queueing the body a second time.
    expect(second).toEqual({ requeued: 0, markedSynced: 0, markedLocal: 0 })
    expect(await f.outbox.list()).toEqual(jobsAfterFirst)
    expect(await f.store.listMetas()).toEqual(metasAfterFirst)
  })
})

describe('the sweep reads the queue, never the status', () => {
  test('leaves a row whose current-target job is simply still queued', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-i', TARGET_A)
    await f.outbox.enqueue({
      canvasId: 'doc-i',
      type: 'putMetadata',
      revision: 1,
      targetId: TARGET_A
    })

    const result = await f.repair()

    // A rename in flight is not an orphan. Touching it would either duplicate
    // the upload or overwrite a status the drain is about to write correctly.
    expect(await f.outbox.list()).toHaveLength(1)
    expect(result).toEqual({ requeued: 0, markedSynced: 0, markedLocal: 0 })
  })

  test('a job pinned to a target the row no longer names does not count', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-j', TARGET_B)
    // Queued before the retarget: those bytes are owed to A and will go to A,
    // but B has never seen this document and is still owed a copy.
    await f.outbox.enqueue({
      canvasId: 'doc-j',
      type: 'putCanvas',
      revision: 1,
      targetId: TARGET_A
    })

    const result = await f.repair()

    // The sweep's own contract: the row's CURRENT destination gets a job.
    expect(result.requeued).toBe(1)
    expect(await f.outbox.list()).toContainEqual(
      expect.objectContaining({ canvasId: 'doc-j', type: 'putCanvas', targetId: TARGET_B })
    )
    // NOT asserted: that the A job survives. It does not — `supersedePutCanvasJobs`
    // matches on canvas id and revision alone and drops any queued putCanvas at or
    // below the new one, target included. That is the outbox's behaviour, reachable
    // from every enqueue path, and it is reported rather than papered over here.
  })

  test('a queued thumbnail does not hold a row pending', async () => {
    const f = fixture()
    await seedConfirmedBody(f.store, 'doc-k', TARGET_A)
    await f.outbox.enqueue({ canvasId: 'doc-k', type: 'putThumb', revision: 1, targetId: TARGET_A })

    const result = await f.repair()

    // `putThumb` succeeds without ever writing `syncStatus` — that is the point
    // of keeping thumbnail failures in their own field — so counting it as
    // outstanding work would strand the row again the moment it drained.
    expect((await f.store.getMeta('doc-k'))?.syncStatus).toBe('synced')
    expect(result.markedSynced).toBe(1)
  })

  test('leaves rows that are not pending alone', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-l', TARGET_A)
    await f.store.updateMeta('doc-l', { syncStatus: 'error', lastSyncError: 'HTTP 503' })

    const result = await f.repair()

    // An error is a decision already recorded, with a message the user can act
    // on. The sweep repairs a missing claim, it does not launder failures.
    const meta = await f.store.getMeta('doc-l')
    expect(meta?.syncStatus).toBe('error')
    expect(meta?.lastSyncError).toBe('HTTP 503')
    expect(await f.outbox.list()).toHaveLength(0)
    expect(result).toEqual({ requeued: 0, markedSynced: 0, markedLocal: 0 })
  })

  test('leaves a tombstoned row to its delete job', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-m', TARGET_A)
    await f.store.tombstone('doc-m')

    const result = await f.repair()

    // `tombstone()` sets `pending` on purpose, and reconcile owns the row from
    // here. Marking it `synced` would present a deleted document as healthy.
    expect((await f.store.getMeta('doc-m'))?.syncStatus).toBe('pending')
    expect(await f.outbox.list()).toHaveLength(0)
    expect(result).toEqual({ requeued: 0, markedSynced: 0, markedLocal: 0 })
  })

  test('drops a stale error when it settles a row', async () => {
    const f = fixture()
    await seedConfirmedBody(f.store, 'doc-n', TARGET_A)
    await f.store.updateMeta('doc-n', { lastSyncError: 'Failed to fetch' })

    await f.repair()

    // The row is no longer claiming to be mid-transfer, so a leftover message
    // from the attempt that stranded it would render as a live failure.
    const meta = await f.store.getMeta('doc-n')
    expect(meta?.syncStatus).toBe('synced')
    expect(meta?.lastSyncError).toBeNull()
    // No transfer was observed here, so nothing may claim one happened.
    expect(meta?.lastSyncedAt).toBeNull()
    expect(meta?.syncedBodyId).toBe('doc-n-body')
  })
})

describe('pausing backup touches nothing remote', () => {
  test('settles an orphaned row to local instead of queueing an upload', async () => {
    const f = fixture()
    await seedUnsentBody(f.store, 'doc-o', TARGET_A)
    f.pauseBackup()

    const result = await f.repair()

    // Off means PAUSE. A job created here would fire the instant the pump runs,
    // uploading a document the user explicitly chose not to send.
    expect(await f.outbox.list()).toHaveLength(0)
    expect((await f.store.getMeta('doc-o'))?.syncStatus).toBe('local')
    expect(result).toEqual({ requeued: 0, markedSynced: 0, markedLocal: 1 })
  })

  test('still reports an already-uploaded row as synced while paused', async () => {
    const f = fixture()
    await seedConfirmedBody(f.store, 'doc-p', TARGET_A)
    f.pauseBackup()

    const result = await f.repair()

    // Pausing stops new uploads; it does not retract the ones that happened.
    // Calling this row `local` would misreport a document that is on the remote.
    expect((await f.store.getMeta('doc-p'))?.syncStatus).toBe('synced')
    expect(result).toEqual({ requeued: 0, markedSynced: 1, markedLocal: 0 })
  })
})
