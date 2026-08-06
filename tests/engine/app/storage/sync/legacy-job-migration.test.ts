import { describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store/memory'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { SyncFailure } from '@/app/storage/sync/failure'
import { migrateLegacyOutboxJobs } from '@/app/storage/sync/migrate-jobs'
import { createMemoryOutbox, type Outbox } from '@/app/storage/sync/outbox'

import { createHarness, recordingAdapter } from './helpers'

const BODY = new Uint8Array(256).fill(5)
const TARGET_A = 's3-compatible#aaaaaaaa'
const TARGET_B = 's3-compatible#bbbbbbbb'
const PARKED = Number.MAX_SAFE_INTEGER

type Fixture = {
  store: LocalCanvasStore
  outbox: Outbox
  failures: SyncFailure[]
  migrate: () => ReturnType<typeof migrateLegacyOutboxJobs>
}

function fixture(): Fixture {
  const store = createMemoryLocalCanvasStore()
  const outbox = createMemoryOutbox()
  const failures: SyncFailure[] = []
  return {
    store,
    outbox,
    failures,
    migrate: () =>
      migrateLegacyOutboxJobs({
        getStore: () => store,
        getOutbox: () => outbox,
        recordFailure: (failure) => failures.push(failure),
        now: () => '2026-08-03T00:00:00.000Z'
      })
  }
}

async function seedRow(
  store: LocalCanvasStore,
  id: string,
  syncTargetId: string | null
): Promise<number> {
  const meta = await store.writeCanvas({
    id,
    syncTargetId,
    name: id,
    sourceFormat: 'fig',
    figBytes: BODY
  })
  return meta.revision
}

/**
 * Jobs queued before targets existed carry `targetId: null`.
 *
 * The engine used to recover a destination from the row at drain time, which is
 * defensible but implicit — and implicit is how a document's bytes end up in
 * whatever bucket happens to be selected. Resolve it once, explicitly, and
 * refuse to guess when the answer is not there.
 */
describe('legacy queued jobs are pinned or parked, never redirected', () => {
  test('pins a legacy job to the destination its row names', async () => {
    const f = fixture()
    const revision = await seedRow(f.store, 'doc-a', TARGET_A)
    await f.outbox.enqueue({ canvasId: 'doc-a', type: 'putCanvas', revision, targetId: null })

    const result = await f.migrate()

    const [job] = await f.outbox.list()
    expect(job?.targetId).toBe(TARGET_A)
    expect(result).toEqual({ pinned: 1, parked: 0 })
    expect(f.failures).toHaveLength(0)
  })

  test('parks a job whose row names no destination instead of routing it', async () => {
    const f = fixture()
    // A local-only row. There is no honest destination for these bytes, and the
    // currently selected bucket is emphatically not it.
    const revision = await seedRow(f.store, 'doc-b', null)
    await f.outbox.enqueue({ canvasId: 'doc-b', type: 'putCanvas', revision, targetId: null })

    const result = await f.migrate()

    const [job] = await f.outbox.list()
    expect(job?.targetId).toBeNull()
    expect(job?.nextAttemptAt).toBe(PARKED)
    expect(result).toEqual({ pinned: 0, parked: 1 })
  })

  test('a parked job is visible, not silent', async () => {
    const f = fixture()
    const revision = await seedRow(f.store, 'doc-c', null)
    await f.outbox.enqueue({ canvasId: 'doc-c', type: 'putCanvas', revision, targetId: null })

    await f.migrate()

    // Both halves of visibility: the workspace-level failure snapshot the chip
    // and modal read, and the per-document error the card shows.
    expect(f.failures).toHaveLength(1)
    expect(f.failures[0]?.documentIds).toEqual(['doc-c'])
    expect(f.failures[0]?.rawError).toContain('storage destination')
    const meta = await f.store.getMeta('doc-c')
    expect(meta?.syncStatus).toBe('error')
    expect(meta?.lastSyncError).toContain('storage destination')
  })

  test('parks a job whose canvas row is gone entirely', async () => {
    const f = fixture()
    await f.outbox.enqueue({ canvasId: 'ghost', type: 'putMetadata', revision: 1, targetId: null })

    const result = await f.migrate()

    const [job] = await f.outbox.list()
    expect(job?.nextAttemptAt).toBe(PARKED)
    expect(result.parked).toBe(1)
  })

  test('reports one failure for a whole parked set, not one per job', async () => {
    const f = fixture()
    for (const id of ['doc-d', 'doc-e', 'doc-f']) {
      const revision = await seedRow(f.store, id, null)
      await f.outbox.enqueue({ canvasId: id, type: 'putCanvas', revision, targetId: null })
    }

    await f.migrate()

    // `recordSyncFailure` keeps only the latest snapshot, so per-job reporting
    // would show an arbitrary one of three with no sign the others exist.
    expect(f.failures).toHaveLength(1)
    expect(f.failures[0]?.documentIds).toEqual(['doc-d', 'doc-e', 'doc-f'])
  })

  test('leaves a job that already carries a target completely alone', async () => {
    const f = fixture()
    const revision = await seedRow(f.store, 'doc-g', TARGET_A)
    await f.outbox.enqueue({ canvasId: 'doc-g', type: 'putCanvas', revision, targetId: TARGET_B })

    const result = await f.migrate()

    // Even though the row now names A, the job was addressed to B and keeps it.
    const [job] = await f.outbox.list()
    expect(job?.targetId).toBe(TARGET_B)
    expect(result).toEqual({ pinned: 0, parked: 0 })
  })

  test('pinning does not revive a job parked by a permanent failure', async () => {
    const f = fixture()
    const revision = await seedRow(f.store, 'doc-h', TARGET_A)
    await f.outbox.enqueue({
      canvasId: 'doc-h',
      type: 'putCanvas',
      revision,
      targetId: null,
      nextAttemptAt: PARKED,
      attempts: 8
    })

    await f.migrate()

    const [job] = await f.outbox.list()
    expect(job?.targetId).toBe(TARGET_A)
    // Only an explicit resume revives it; the migration decides where, not when.
    expect(job?.nextAttemptAt).toBe(PARKED)
    expect(job?.attempts).toBe(8)
  })

  test('running twice changes nothing', async () => {
    const f = fixture()
    const pinnable = await seedRow(f.store, 'doc-i', TARGET_A)
    const orphan = await seedRow(f.store, 'doc-j', null)
    await f.outbox.enqueue({
      canvasId: 'doc-i',
      type: 'putCanvas',
      revision: pinnable,
      targetId: null
    })
    await f.outbox.enqueue({
      canvasId: 'doc-j',
      type: 'putCanvas',
      revision: orphan,
      targetId: null
    })

    const first = await f.migrate()
    const afterFirst = await f.outbox.list()
    const second = await f.migrate()
    const afterSecond = await f.outbox.list()

    expect(first).toEqual({ pinned: 1, parked: 1 })
    expect(second).toEqual({ pinned: 0, parked: 0 })
    expect(afterSecond).toEqual(afterFirst)
    // A second startup must not re-alarm the user about a decision already made.
    expect(f.failures).toHaveLength(1)
  })
})

describe('the engine drains what the migration decided', () => {
  test('a pinned job uploads to its row target and nowhere else', async () => {
    const byTarget = new Map([
      [TARGET_A, recordingAdapter()],
      [TARGET_B, recordingAdapter()]
    ])
    const h = createHarness({
      resolveTarget: async (targetId) => {
        const adapter = targetId ? byTarget.get(targetId) : undefined
        if (!adapter) throw new Error(`No adapter for target ${String(targetId)}`)
        return adapter
      }
    })
    const revision = await seedRow(h.store, 'doc-k', TARGET_A)
    await h.outbox.enqueue({ canvasId: 'doc-k', type: 'putCanvas', revision, targetId: null })

    await migrateLegacyOutboxJobs({ getStore: () => h.store, getOutbox: () => h.outbox })
    await h.engine.kick()
    await h.drainWakes()

    expect(byTarget.get(TARGET_A)?.count('put')).toBe(1)
    expect(byTarget.get(TARGET_B)?.count('put')).toBe(0)
    h.dispose()
  })

  test('a parked job never reaches an adapter', async () => {
    const h = createHarness()
    const revision = await seedRow(h.store, 'doc-l', null)
    await h.outbox.enqueue({ canvasId: 'doc-l', type: 'putCanvas', revision, targetId: null })

    await migrateLegacyOutboxJobs({ getStore: () => h.store, getOutbox: () => h.outbox })
    await h.engine.kick()
    await h.drainWakes()

    // The whole point of parking: the bytes stay put rather than being published
    // into whichever bucket the user happens to have selected.
    expect(h.adapter.calls).toHaveLength(0)
    expect((await h.outbox.list())[0]?.nextAttemptAt).toBe(PARKED)
    h.dispose()
  })
})
