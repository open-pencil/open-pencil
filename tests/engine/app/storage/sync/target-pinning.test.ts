import { describe, expect, test } from 'bun:test'

import { createHarness, recordingAdapter, seedSyncedDocument } from './helpers'

const BODY = new Uint8Array(512).fill(3)

const TARGET_A = 's3-compatible#aaaaaaaa'
const TARGET_B = 's3-compatible#bbbbbbbb'

/**
 * The failure this phase exists to prevent: a document's bytes reaching the
 * wrong bucket because the destination was resolved when the job RAN rather
 * than when it was queued.
 *
 * `providerId` used to mean "which shelf this document belongs to", so every
 * async path that read the live provider was a latent instance of this.
 */
describe('jobs are pinned to the target captured at enqueue', () => {
  test('a queued job runs against its own target, not the current selection', async () => {
    const byTarget = new Map<string, ReturnType<typeof recordingAdapter>>([
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

    await seedSyncedDocument(h.store, 'doc-a', BODY)
    await h.store.updateMeta('doc-a', { syncTargetId: TARGET_A })

    const meta = await h.store.getMeta('doc-a')
    await h.engine.enqueuePutCanvas('doc-a', meta?.revision ?? 0)

    // The user switches destination while the job is still queued.
    await h.store.updateMeta('doc-a', { syncTargetId: TARGET_B })
    await h.drainWakes()

    expect(byTarget.get(TARGET_A)?.count('put')).toBe(1)
    expect(byTarget.get(TARGET_B)?.count('put')).toBe(0)
    h.dispose()
  })

  test('a job carries the target its row had when it was queued', async () => {
    const h = createHarness()
    await seedSyncedDocument(h.store, 'doc-b', BODY)
    await h.store.updateMeta('doc-b', { syncTargetId: TARGET_A })

    const meta = await h.store.getMeta('doc-b')
    await h.engine.enqueuePutCanvas('doc-b', meta?.revision ?? 0)

    const [job] = await h.outbox.list()
    expect(job?.targetId).toBe(TARGET_A)
    h.dispose()
  })

  test('an unresolvable target fails visibly rather than falling back', async () => {
    // Silently routing to whatever is selected is how bytes land in someone
    // else's bucket. A job that cannot name its destination must stay put.
    const h = createHarness({
      resolveTarget: async () => {
        throw new Error('Storage is not configured')
      }
    })
    await seedSyncedDocument(h.store, 'doc-c', BODY)
    await h.store.updateMeta('doc-c', { syncTargetId: TARGET_A })

    const meta = await h.store.getMeta('doc-c')
    await h.engine.enqueuePutCanvas('doc-c', meta?.revision ?? 0)
    await h.drainWakes(3)

    const queued = await h.outbox.list()
    expect(queued.some((job) => job.canvasId === 'doc-c')).toBe(true)
    expect((await h.store.getMeta('doc-c'))?.syncStatus).not.toBe('synced')
    h.dispose()
  })

  test('a local-only document queues no remote work with a null target', async () => {
    const h = createHarness()
    await seedSyncedDocument(h.store, 'doc-d', BODY)
    await h.store.updateMeta('doc-d', { syncTargetId: null })

    const meta = await h.store.getMeta('doc-d')
    await h.engine.enqueuePutCanvas('doc-d', meta?.revision ?? 0)

    const [job] = await h.outbox.list()
    expect(job?.targetId).toBeNull()
    h.dispose()
  })
})
