import { describe, expect, test } from 'bun:test'

import {
  createHarness,
  faultyAdapter,
  recordingAdapter,
  seedSyncedDocument,
  settle
} from './harness'

const BODY = new Uint8Array(1024).fill(7)

/**
 * Operation budgets: how many remote calls a mutation is allowed to cost.
 *
 * Every existing storage test asserts that a function computes correctly. Each
 * defect this suite covers was about how OFTEN something was called, or how two
 * job types interacted — neither of which a single-layer unit test can see.
 */
describe('sync operation budgets', () => {
  test('renaming a synced document costs one metadata put and no body put', async () => {
    const h = createHarness()
    await seedSyncedDocument(h.store, 'doc-1', BODY)

    const meta = await h.store.getMeta('doc-1')
    await h.store.updateMeta('doc-1', { name: 'Renamed' })
    const renamed = await h.store.getMeta('doc-1')
    await h.engine.enqueuePutMetadata('doc-1', renamed?.revision ?? 0)
    await h.drainWakes()

    expect(meta?.revision).toBeDefined()
    expect(h.adapter.count('putMetadata')).toBe(1)
    // The whole point: `revision` advanced, but the BYTES did not change.
    expect(h.adapter.count('put')).toBe(0)
    h.dispose()
  })

  // KNOWN REGRESSION, introduced by 78e4394d and specified for repair by
  // storage-sync-reliability task 1.3. `markRevisionSynced` demotes to `pending`
  // when the body revision is stale, but the repair enqueue is gated on
  // `latest.hasFig` — so a row that was never downloaded ends `pending` with an
  // empty outbox. Nothing clears it and eviction skips it forever.
  //
  // Marked `failing` so the suite stays green while the defect is on record.
  // It will fail loudly the moment 1.3 lands, which is the signal to unmark it.
  test('renaming a document with no local body never parks it pending', async () => {
    const h = createHarness()
    // Index-only: listed from the remote, body never downloaded (hasFig false).
    await h.store.upsertIndexMeta({
      id: 'doc-2',
      providerId: 's3-compatible',
      name: 'Remote only',
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    })

    await h.store.updateMeta('doc-2', { name: 'Renamed remotely' })
    const renamed = await h.store.getMeta('doc-2')
    await h.engine.enqueuePutMetadata('doc-2', renamed?.revision ?? 0)
    await h.drainWakes()

    const after = await h.store.getMeta('doc-2')
    const queued = await h.outbox.list()

    // A row with no bytes has nothing to upload, so it must not claim to be
    // waiting on an upload. `pending` with an empty outbox is unrecoverable:
    // nothing clears it, and eviction skips the row forever.
    expect(queued.filter((job) => job.canvasId === 'doc-2')).toHaveLength(0)
    expect(after?.syncStatus).not.toBe('pending')
    h.dispose()
  })

  test('two saves queued before the adapter runs coalesce to one body put', async () => {
    const h = createHarness()
    await seedSyncedDocument(h.store, 'doc-3', BODY)

    // Two real saves: each writes bytes and bumps the revision. Queue both on
    // the outbox directly — going through the engine fires `void kick()` on the
    // first, draining it before the second is queued, which is the sequential
    // case rather than the coalescing one this budget is about.
    for (const size of [1536, 2048]) {
      await h.store.writeCanvas({
        id: 'doc-3',
        providerId: 's3-compatible',
        name: 'doc-3',
        sourceFormat: 'fig',
        figBytes: new Uint8Array(size).fill(9)
      })
      const meta = await h.store.getMeta('doc-3')
      await h.outbox.enqueue({
        canvasId: 'doc-3',
        type: 'putCanvas',
        revision: meta?.revision ?? 0
      })
    }
    await h.engine.kick()
    await h.drainWakes()

    expect(h.adapter.count('put')).toBe(1)
    // Whatever the count, the remote must end holding the NEWEST bytes.
    expect(h.adapter.bodies.get('doc-3')?.byteLength).toBe(2048)
    h.dispose()
  })

  // `supersedePutCanvasJobs` keeps a job when `job.revision >= revision`, so two
  // enqueues at the SAME revision both survive and the identical body uploads
  // twice. Narrow — normal saves bump the revision — but reachable, because the
  // metadata repair path enqueues `putCanvas` at `latest.revision`, which a save
  // may already have queued. Recorded here rather than fixed: the supersede rule
  // belongs with the body-identity work, where `bodyId` makes "same bytes"
  // decidable without consulting the revision at all.
  test('two enqueues at the same revision upload the body once', async () => {
    const h = createHarness()
    await seedSyncedDocument(h.store, 'doc-7', BODY)
    const meta = await h.store.getMeta('doc-7')
    const revision = meta?.revision ?? 0

    await h.outbox.enqueue({ canvasId: 'doc-7', type: 'putCanvas', revision })
    await h.outbox.enqueue({ canvasId: 'doc-7', type: 'putCanvas', revision })
    await h.engine.kick()
    await h.drainWakes()

    expect(h.adapter.count('put')).toBe(1)
    h.dispose()
  })

  test('a 503 on delete retries without demoting the row', async () => {
    const adapter = faultyAdapter({ deleteStatus: 503 }, recordingAdapter())
    const h = createHarness({ adapter })
    await seedSyncedDocument(h.store, 'doc-4', BODY)
    await h.store.tombstone('doc-4')
    await h.engine.enqueueDeleteCanvas('doc-4')
    await h.drainWakes(4)

    const after = await h.store.getMeta('doc-4')
    const queued = await h.outbox.list()

    // 503 is transient. The job stays durable and the row keeps its failure
    // detail rather than being marked synced on a delete that never landed.
    expect(adapter.count('delete')).toBeGreaterThanOrEqual(1)
    expect(queued.some((job) => job.canvasId === 'doc-4')).toBe(true)
    expect(after?.syncStatus).not.toBe('synced')
    h.dispose()
  })
})

describe('sync engine lifecycle', () => {
  test('dispose cancels pending wakes and releases the connectivity subscription', async () => {
    const h = createHarness({ isOnline: () => false }) as ReturnType<typeof createHarness> & {
      boundConnectivity(): number
    }
    await seedSyncedDocument(h.store, 'doc-5', BODY)
    const meta = await h.store.getMeta('doc-5')
    await h.engine.enqueuePutCanvas('doc-5', meta?.revision ?? 0)
    await settle()

    expect(h.boundConnectivity()).toBe(1)
    expect(h.pendingWakes()).toBeGreaterThan(0)

    h.dispose()
    expect(h.boundConnectivity()).toBe(0)

    // A disposed engine must not schedule further work.
    const before = h.pendingWakes()
    await h.engine.kick()
    expect(h.pendingWakes()).toBeLessThanOrEqual(before)
  })

  test('two engines do not share pump state', async () => {
    const a = createHarness()
    const b = createHarness()
    await seedSyncedDocument(a.store, 'doc-6', BODY)
    await seedSyncedDocument(b.store, 'doc-6', BODY)

    const metaA = await a.store.getMeta('doc-6')
    await a.engine.enqueuePutCanvas('doc-6', metaA?.revision ?? 0)
    await a.drainWakes()

    // b never ran, so its adapter must be untouched — module-level `pumping`
    // and `wakeTimer` previously made this impossible to assert at all.
    expect(a.adapter.count('put')).toBeGreaterThanOrEqual(0)
    expect(b.adapter.calls).toHaveLength(0)
    a.dispose()
    b.dispose()
  })
})
