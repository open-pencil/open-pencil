import { describe, expect, test } from 'bun:test'

import type { StorageAdapter } from '@/app/integrations/storage'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store/memory'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { retargetStorageDocument } from '@/app/storage/retarget'
import { markRevisionSynced } from '@/app/storage/sync/engine'
import { createMemoryOutbox, type Outbox } from '@/app/storage/sync/outbox'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'

import { createHarness, recordingAdapter, settle } from './helpers'

const BODY = new Uint8Array(384).fill(4)
const TARGET_A = 's3-compatible#aaaaaaaa'
const TARGET_B = 's3-compatible#bbbbbbbb'

async function seedConfirmed(
  store: LocalCanvasStore,
  id: string,
  targetId: string
): Promise<number> {
  const meta = await store.writeCanvas({
    id,
    syncTargetId: targetId,
    name: id,
    sourceFormat: 'fig',
    figBytes: BODY,
    bodyId: 'body-1'
  })
  await store.updateMeta(id, {
    syncStatus: 'synced',
    syncedBodyId: 'body-1',
    lastSyncedAt: '2026-08-01T00:00:00.000Z'
  })
  return meta.revision
}

function stubDeps(store: LocalCanvasStore, outbox: Outbox) {
  const enqueued: { canvasId: string; revision: number }[] = []
  return {
    enqueued,
    deps: {
      store,
      outbox,
      enqueueCanvas: async (canvasId: string, revision: number) => {
        enqueued.push({ canvasId, revision })
      }
    }
  }
}

/**
 * Moving a document to a different destination is a transaction, not a field
 * edit. Three other pieces of state describe where a document lives, and each
 * one left behind lies about a bucket that has never seen the document.
 */
describe('retargeting a document', () => {
  test('cancels queued work addressed to the old destination', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const revision = await seedConfirmed(store, 'doc-a', TARGET_A)
    await outbox.enqueue({ canvasId: 'doc-a', type: 'putCanvas', revision, targetId: TARGET_A })
    await outbox.enqueue({ canvasId: 'doc-a', type: 'putMetadata', revision, targetId: TARGET_A })
    await outbox.enqueue({ canvasId: 'other', type: 'putCanvas', revision: 1, targetId: TARGET_A })
    const { deps, enqueued } = stubDeps(store, outbox)

    const result = await retargetStorageDocument('doc-a', TARGET_B, deps)

    const remaining = await outbox.list()
    // Those jobs' bytes were promised to the old bucket and cannot be
    // readdressed, so the only correct outcome is to drop them and queue fresh
    // work for the new destination.
    expect(remaining.filter((job) => job.canvasId === 'doc-a')).toHaveLength(0)
    expect(result.cancelledJobIds).toHaveLength(2)
    expect(enqueued).toEqual([{ canvasId: 'doc-a', revision }])
    // Another document's queue is none of this transaction's business.
    expect(remaining.some((job) => job.canvasId === 'other')).toBe(true)
  })

  test('the replacement upload is addressed to the new destination', async () => {
    const h = createHarness({
      // Nothing may reach an adapter during this test; only the queue matters.
      resolveTarget: async () => {
        throw new Error('unreachable')
      }
    })
    const revision = await seedConfirmed(h.store, 'doc-a2', TARGET_A)
    await h.outbox.enqueue({ canvasId: 'doc-a2', type: 'putCanvas', revision, targetId: TARGET_A })

    await retargetStorageDocument('doc-a2', TARGET_B, {
      store: h.store,
      outbox: h.outbox,
      enqueueCanvas: h.engine.enqueuePutCanvas
    })
    await settle()

    const queued = (await h.outbox.list()).filter((job) => job.canvasId === 'doc-a2')
    expect(queued).toHaveLength(1)
    expect(queued[0]?.targetId).toBe(TARGET_B)
    h.dispose()
  })

  test('clears the confirmed body so the new destination claims nothing', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    await seedConfirmed(store, 'doc-b', TARGET_A)
    const { deps } = stubDeps(store, outbox)

    await retargetStorageDocument('doc-b', TARGET_B, deps)

    const after = await store.getMeta('doc-b')
    expect(after?.syncTargetId).toBe(TARGET_B)
    // `syncedBodyId` is a confirmation from the target that gave it. Carried
    // across, eviction would treat the new bucket as holding these bytes and
    // delete the only copy that exists.
    expect(after?.syncedBodyId).toBeNull()
    expect(after?.lastSyncedAt).toBeNull()
    expect(after?.syncStatus).toBe('pending')
  })

  test('never deletes anything at the old destination', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const revision = await seedConfirmed(store, 'doc-c', TARGET_A)
    await outbox.enqueue({ canvasId: 'doc-c', type: 'deleteCanvas', revision, targetId: TARGET_A })
    const { deps } = stubDeps(store, outbox)

    await retargetStorageDocument('doc-c', TARGET_B, deps)

    const remaining = await outbox.list()
    // No delete is invented — changing a setting must not destroy data — and the
    // one the USER already asked for keeps its original destination.
    expect(remaining.filter((job) => job.type === 'deleteCanvas')).toHaveLength(1)
    expect(remaining.find((job) => job.type === 'deleteCanvas')?.targetId).toBe(TARGET_A)
    expect((await store.getMeta('doc-c'))?.tombstoned).toBe(false)
  })

  test('a bodyless row is not left pending with nothing queued', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    await store.upsertIndexMeta({
      id: 'doc-d',
      syncTargetId: TARGET_A,
      name: 'Remote only',
      updatedAt: '2026-08-01T00:00:00.000Z',
      syncStatus: 'synced',
      lastSyncedAt: '2026-08-01T00:00:00.000Z',
      lastSyncError: null
    })
    const { deps, enqueued } = stubDeps(store, outbox)

    const result = await retargetStorageDocument('doc-d', TARGET_B, deps)

    expect(enqueued).toHaveLength(0)
    expect(result.queuedUpload).toBe(false)
    expect((await store.getMeta('doc-d'))?.syncStatus).not.toBe('pending')
  })

  test('retargeting to the same destination is a no-op', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    const revision = await seedConfirmed(store, 'doc-e', TARGET_A)
    await outbox.enqueue({ canvasId: 'doc-e', type: 'putCanvas', revision, targetId: TARGET_A })
    const { deps } = stubDeps(store, outbox)

    const result = await retargetStorageDocument('doc-e', TARGET_A, deps)

    expect(result.cancelledJobIds).toHaveLength(0)
    expect((await store.getMeta('doc-e'))?.syncedBodyId).toBe('body-1')
    expect(await outbox.list()).toHaveLength(1)
  })
})

describe('an in-flight completion may only confirm the target it captured', () => {
  test('markRevisionSynced refuses a row that has been retargeted', async () => {
    const store = createMemoryLocalCanvasStore()
    const revision = await seedConfirmed(store, 'doc-f', TARGET_A)
    await store.updateMeta('doc-f', { syncTargetId: TARGET_B, syncedBodyId: null })

    const confirmed = await markRevisionSynced(store, 'doc-f', revision, {
      bodyUploaded: true,
      targetId: TARGET_A
    })

    expect(confirmed).toBe(false)
    expect((await store.getMeta('doc-f'))?.syncedBodyId).toBeNull()
  })

  test('an upload finishing after a retarget does not mark the new target synced', async () => {
    let releaseUpload: () => void = () => undefined
    const inFlight = new Promise<void>((resolve) => {
      releaseUpload = resolve
    })
    const inner = recordingAdapter()
    const adapter: StorageAdapter & { calls: typeof inner.calls } = {
      ...inner,
      putDocument: async (id, bytes, onProgress) => {
        await inFlight
        await inner.putDocument(id, bytes, onProgress)
      }
    }
    const h = createHarness({ resolveTarget: async () => adapter })
    const revision = await seedConfirmed(h.store, 'doc-g', TARGET_A)
    await h.store.updateMeta('doc-g', { syncedBodyId: null, syncStatus: 'pending' })

    await h.engine.enqueuePutCanvas('doc-g', revision)
    await settle()

    // The document is moved off TARGET_A while its bytes are on the wire.
    // Retarget to local-only so no follow-up upload confuses the assertion.
    await retargetStorageDocument('doc-g', null, { store: h.store, outbox: h.outbox })
    releaseUpload()
    await h.drainWakes()

    const after = await h.store.getMeta('doc-g')
    expect(after?.syncTargetId).toBeNull()
    // The upload really did reach TARGET_A — and its success says nothing about
    // anywhere else, so the row must not record a confirmed body.
    expect(inner.count('put')).toBe(1)
    expect(after?.syncedBodyId).toBeNull()
    h.dispose()
  })
})

describe('a save that changes destination re-uploads instead of claiming synced', () => {
  test('identical bytes are still sent to a bucket that has not seen them', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueued: string[] = []
    const dependencies = {
      store,
      enqueueCanvas: async (canvasId: string) => {
        enqueued.push(canvasId)
      }
    }

    await persistStorageCanvasLocally(
      { syncTargetId: TARGET_A, canvasId: 'doc-h', name: 'Deck', figBytes: BODY },
      dependencies
    )
    const first = await store.getMeta('doc-h')
    await store.updateMeta('doc-h', { syncedBodyId: first?.bodyId, syncStatus: 'synced' })

    // Same bytes, different bucket.
    await persistStorageCanvasLocally(
      { syncTargetId: TARGET_B, canvasId: 'doc-h', name: 'Deck', figBytes: BODY },
      dependencies
    )

    const after = await store.getMeta('doc-h')
    expect(enqueued).toEqual(['doc-h', 'doc-h'])
    expect(after?.syncedBodyId).toBeNull()
    expect(after?.syncStatus).toBe('pending')
  })

  test('identical bytes to the same bucket still cost nothing', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueued: string[] = []
    const dependencies = {
      store,
      enqueueCanvas: async (canvasId: string) => {
        enqueued.push(canvasId)
      }
    }

    await persistStorageCanvasLocally(
      { syncTargetId: TARGET_A, canvasId: 'doc-i', name: 'Deck', figBytes: BODY },
      dependencies
    )
    const first = await store.getMeta('doc-i')
    await store.updateMeta('doc-i', { syncedBodyId: first?.bodyId, syncStatus: 'synced' })

    await persistStorageCanvasLocally(
      { syncTargetId: TARGET_A, canvasId: 'doc-i', name: 'Deck', figBytes: BODY },
      dependencies
    )

    expect(enqueued).toEqual(['doc-i'])
    expect((await store.getMeta('doc-i'))?.syncStatus).toBe('synced')
  })
})
