import { describe, expect, test } from 'bun:test'

import { StorageSyncBlockedError } from '@/app/storage/sync/engine'

import { createHarness, seedSyncedDocument } from './helpers'

const BODY = new Uint8Array(512).fill(3)
const TARGET_A = 's3-compatible#aaaaaaaa'

/**
 * A half-configured destination (preferences without credentials) is a
 * configuration state, not a document fault: the workspace footer already
 * reads "No cloud configured · Local storage only" here. Recording it on the
 * row painted a red "Sync failed" badge on an otherwise healthy local
 * document — and the marks were sticky, because nothing clears them while the
 * destination stays unusable.
 */
describe('a job blocked by an unconfigured destination', () => {
  test('parks durably without marking the document as failed', async () => {
    const h = createHarness({
      resolveTarget: async () => {
        throw new StorageSyncBlockedError('Storage credentials are unavailable', {
          unconfigured: true
        })
      }
    })
    await seedSyncedDocument(h.store, 'doc-a', BODY)
    await h.store.updateMeta('doc-a', { syncTargetId: TARGET_A })

    const meta = await h.store.getMeta('doc-a')
    await h.engine.enqueuePutCanvas('doc-a', meta?.revision ?? 0)
    await h.drainWakes()

    // Parked, not discarded: resume() revives the job once settings are repaired.
    const [job] = await h.outbox.list()
    expect(job?.canvasId).toBe('doc-a')
    expect(job?.nextAttemptAt).toBe(Number.MAX_SAFE_INTEGER)

    const row = await h.store.getMeta('doc-a')
    expect(row?.syncStatus).not.toBe('error')
    expect(row?.lastSyncError).toBeNull()
    h.dispose()
  })

  test('a thumbnail job blocked the same way leaves no preview failure either', async () => {
    const h = createHarness({
      resolveTarget: async () => {
        throw new StorageSyncBlockedError('Storage credentials are unavailable', {
          unconfigured: true
        })
      }
    })
    await seedSyncedDocument(h.store, 'doc-b', BODY)
    await h.store.updateMeta('doc-b', { syncTargetId: TARGET_A })

    const meta = await h.store.getMeta('doc-b')
    await h.engine.enqueuePutThumb('doc-b', meta?.revision ?? 0)
    await h.drainWakes()

    expect((await h.store.getMeta('doc-b'))?.lastThumbSyncError).toBeNull()
    h.dispose()
  })

  test('other blocks still record a per-document failure', async () => {
    // A destination that moved out from under the document IS worth a trace:
    // the workspace offers no other way to learn why the queue stopped.
    const h = createHarness({
      resolveTarget: async () => {
        throw new StorageSyncBlockedError(
          'Storage settings no longer point at this document’s bucket'
        )
      }
    })
    await seedSyncedDocument(h.store, 'doc-c', BODY)
    await h.store.updateMeta('doc-c', { syncTargetId: TARGET_A })

    const meta = await h.store.getMeta('doc-c')
    await h.engine.enqueuePutCanvas('doc-c', meta?.revision ?? 0)
    await h.drainWakes()

    const row = await h.store.getMeta('doc-c')
    expect(row?.syncStatus).toBe('error')
    expect(row?.lastSyncError).toContain('no longer point')
    h.dispose()
  })
})
