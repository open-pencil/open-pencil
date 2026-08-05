import { describe, expect, test, vi } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { promoteLocalDocuments } from '@/app/storage/promote'

const TARGET = 's3-compatible#aaaaaaaa'
const OTHER = 's3-compatible#bbbbbbbb'

function deps(store: LocalCanvasStore) {
  return {
    store,
    enqueueCanvas: vi.fn(async () => {}),
    enqueueMetadata: vi.fn(async () => {}),
    enqueueThumbnail: vi.fn(async () => {}),
    enqueueDelete: vi.fn(async () => undefined)
  }
}

async function seedLocal(store: LocalCanvasStore, id: string, thumb = false) {
  return store.writeCanvas({
    id,
    syncTargetId: null,
    name: id,
    figBytes: new Uint8Array([1, 2, 3]),
    thumbBytes: thumb ? new Uint8Array([9]) : null,
    bodyId: `sha256:${id}`,
    syncStatus: 'local'
  })
}

describe('promoteLocalDocuments', () => {
  test('sends work done offline to the cloud that now exists', async () => {
    // Without this, connecting a bucket only affects documents created
    // afterwards, and the offline ones stay local forever — which reads as the
    // connection having quietly failed.
    const store = createMemoryLocalCanvasStore()
    await seedLocal(store, 'offline-1')
    await seedLocal(store, 'offline-2', true)
    const d = deps(store)

    const result = await promoteLocalDocuments(TARGET, d)

    expect(result.promoted.sort()).toEqual(['offline-1', 'offline-2'])
    expect(d.enqueueCanvas).toHaveBeenCalledTimes(2)
    expect(d.enqueueThumbnail).toHaveBeenCalledTimes(1)
    expect((await store.getMeta('offline-1'))?.syncTargetId).toBe(TARGET)
    expect((await store.getMeta('offline-1'))?.syncStatus).toBe('pending')
  })

  test('never moves a document that belongs to another bucket', async () => {
    // Retargeting here would upload one destination's documents into whichever
    // the user happened to connect next.
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'elsewhere',
      syncTargetId: OTHER,
      name: 'elsewhere',
      figBytes: new Uint8Array([1]),
      bodyId: 'sha256:elsewhere'
    })
    const d = deps(store)

    const result = await promoteLocalDocuments(TARGET, d)

    expect(result.promoted).toEqual([])
    expect(result.skipped).toEqual(['elsewhere'])
    expect((await store.getMeta('elsewhere'))?.syncTargetId).toBe(OTHER)
    expect(d.enqueueCanvas).not.toHaveBeenCalled()
  })

  test('is idempotent — reconnecting does not re-upload', async () => {
    const store = createMemoryLocalCanvasStore()
    await seedLocal(store, 'once')
    const d = deps(store)

    await promoteLocalDocuments(TARGET, d)
    const second = await promoteLocalDocuments(TARGET, d)

    expect(second.promoted).toEqual([])
    expect(d.enqueueCanvas).toHaveBeenCalledTimes(1)
  })

  test('leaves tombstoned rows alone', async () => {
    const store = createMemoryLocalCanvasStore()
    await seedLocal(store, 'deleted')
    await store.tombstone('deleted')
    const d = deps(store)

    const result = await promoteLocalDocuments(TARGET, d)

    expect(result.promoted).toEqual([])
    expect(d.enqueueCanvas).not.toHaveBeenCalled()
  })

  test('completes a delete deferred while disconnected when the replica target reconnects', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'deferred',
      syncTargetId: TARGET,
      name: 'deferred',
      figBytes: new Uint8Array([1]),
      bodyId: 'sha256:deferred'
    })
    await store.updateMeta('deferred', { syncedBodyId: 'sha256:deferred' })
    // Disconnect clears the live target but not the last known destination;
    // the delete afterwards can only tombstone, not enqueue.
    await store.updateMeta('deferred', { syncTargetId: null })
    await store.tombstone('deferred')
    const d = deps(store)

    const result = await promoteLocalDocuments(TARGET, d)

    expect(result.promoted).toEqual([])
    expect(d.enqueueDelete).toHaveBeenCalledTimes(1)
    expect((await store.getMeta('deferred'))?.syncTargetId).toBe(TARGET)
  })

  test('an index-only row queues metadata, not a body it does not have', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.upsertIndexMeta({
      id: 'no-body',
      syncTargetId: null,
      name: 'No body',
      updatedAt: new Date().toISOString(),
      syncStatus: 'local',
      lastSyncedAt: null,
      lastSyncError: null
    })
    const d = deps(store)

    await promoteLocalDocuments(TARGET, d)

    expect(d.enqueueCanvas).not.toHaveBeenCalled()
    expect(d.enqueueMetadata).toHaveBeenCalledTimes(1)
  })

  test('a document disconnected from another bucket is not swept into this one', async () => {
    // `syncTargetId: null` means both "never had a destination" and "left the
    // one it had". Promoting on that alone copied documents the user had just
    // detached from one provider straight into the next — into a second cloud
    // they never chose, and contradicting what the disconnect dialog promises.
    const store = createMemoryLocalCanvasStore()
    // Seeded the way disconnect actually leaves a row: written to a target,
    // then detached with `lastKnownTargetId` recording where it had been.
    await store.writeCanvas({
      id: 'was-on-other',
      syncTargetId: OTHER,
      name: 'was-on-other',
      figBytes: new Uint8Array([1, 2, 3]),
      thumbBytes: null,
      bodyId: 'sha256:was-on-other',
      syncStatus: 'synced'
    })
    await store.updateMeta('was-on-other', {
      syncTargetId: null,
      lastKnownTargetId: OTHER,
      syncStatus: 'local'
    })
    await seedLocal(store, 'never-had-a-home')
    const d = deps(store)

    const result = await promoteLocalDocuments(TARGET, d)

    expect(result.promoted).toEqual(['never-had-a-home'])
    expect(result.skipped).toEqual(['was-on-other'])
    expect(d.enqueueCanvas).toHaveBeenCalledTimes(1)
  })

  test('reconnecting to the same bucket promotes what was disconnected from it', async () => {
    // The guard is equality, not presence: leaving a bucket and coming back is
    // the one case where re-adoption is exactly what the user asked for.
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'came-back',
      syncTargetId: TARGET,
      name: 'came-back',
      figBytes: new Uint8Array([1, 2, 3]),
      thumbBytes: null,
      bodyId: 'sha256:came-back',
      syncStatus: 'synced'
    })
    await store.updateMeta('came-back', {
      syncTargetId: null,
      lastKnownTargetId: TARGET,
      syncStatus: 'local'
    })
    const d = deps(store)

    const result = await promoteLocalDocuments(TARGET, d)

    expect(result.promoted).toEqual(['came-back'])
  })
})
