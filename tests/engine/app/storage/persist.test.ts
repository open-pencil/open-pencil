import { describe, expect, test, vi } from 'bun:test'

import { backupToCloud } from '@/app/storage/backup'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'

describe('local-first storage persistence', () => {
  test('writes document bytes before enqueueing remote synchronization', async () => {
    const store = createMemoryLocalCanvasStore()
    const observations: string[] = []
    const thumbnailObservations: string[] = []
    const enqueueCanvas = vi.fn(async (canvasId: string, revision: number) => {
      const bytes = await store.readFig(canvasId)
      observations.push(`${revision}:${bytes?.join(',')}`)
    })
    const enqueueThumbnail = vi.fn(async (canvasId: string, revision: number) => {
      const bytes = await store.readThumb(canvasId)
      thumbnailObservations.push(`${revision}:${bytes?.join(',')}`)
    })

    const result = await persistStorageCanvasLocally(
      {
        syncTargetId: 's3-compatible#00000000',
        canvasId: 'canvas-1',
        name: 'Stored design',
        sourceFormat: 'deck',
        figBytes: new Uint8Array([1, 2, 3]),
        thumbnailBytes: new Uint8Array([4, 5])
      },
      { store, enqueueCanvas, enqueueThumbnail }
    )

    expect(result.revision).toBe(1)
    expect(observations).toEqual(['1:1,2,3'])
    expect(thumbnailObservations).toEqual(['1:4,5'])
    expect(await store.getMeta('canvas-1')).toMatchObject({
      name: 'Stored design',
      sourceFormat: 'deck',
      syncStatus: 'pending',
      syncTargetId: 's3-compatible#00000000'
    })
  })
})

describe('unchanged-content saves', () => {
  /**
   * The idle-upload loop, at the point where it costs bandwidth.
   *
   * Autosave keys on `sceneVersion`, which `requestRender()` bumps from ~136
   * call sites — lazy page population and async font resolution among them. A
   * document merely OPEN therefore re-saves repeatedly. Each save produced
   * identical bytes and uploaded them anyway: three objects, DELETE+POST, every
   * few seconds, forever.
   *
   * Body identity ends that. Serializing again is cheap; shipping 40 MB again
   * is not.
   */
  test('do not enqueue an upload when the remote already holds these bytes', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const figBytes = new Uint8Array([1, 2, 3])
    const options = {
      syncTargetId: 's3-compatible#00000000',
      canvasId: 'idle',
      name: 'Idle document',
      figBytes
    }

    await persistStorageCanvasLocally(options, { store, enqueueCanvas })
    expect(enqueueCanvas).toHaveBeenCalledTimes(1)

    // Confirm the upload, as a successful putCanvas would.
    const uploaded = await store.getMeta('idle')
    await store.updateMeta('idle', { syncedBodyId: uploaded?.bodyId, syncStatus: 'synced' })

    // Now the editor re-saves with nothing changed, repeatedly.
    await persistStorageCanvasLocally(options, { store, enqueueCanvas })
    await persistStorageCanvasLocally(options, { store, enqueueCanvas })

    expect(enqueueCanvas).toHaveBeenCalledTimes(1)
    expect((await store.getMeta('idle'))?.syncStatus).toBe('synced')
  })

  test('still enqueue when the content actually changed', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const base = {
      syncTargetId: 's3-compatible#00000000',
      canvasId: 'edited',
      name: 'Edited document'
    }

    await persistStorageCanvasLocally(
      { ...base, figBytes: new Uint8Array([1, 2, 3]) },
      { store, enqueueCanvas }
    )
    const uploaded = await store.getMeta('edited')
    await store.updateMeta('edited', { syncedBodyId: uploaded?.bodyId, syncStatus: 'synced' })

    await persistStorageCanvasLocally(
      { ...base, figBytes: new Uint8Array([1, 2, 3, 4]) },
      { store, enqueueCanvas }
    )

    expect(enqueueCanvas).toHaveBeenCalledTimes(2)
    expect((await store.getMeta('edited'))?.syncStatus).toBe('pending')
  })
})

describe('local-only documents', () => {
  /**
   * First run: no credentials, no bucket, no account. The workspace has to be
   * a working design tool here, not a degraded one — and critically, a document
   * created with no destination must not look broken.
   */
  test('a save with no destination commits locally and queues nothing', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const enqueueThumbnail = vi.fn(async () => undefined)

    await persistStorageCanvasLocally(
      {
        syncTargetId: null,
        canvasId: 'first-run',
        name: 'Untitled',
        figBytes: new Uint8Array([1, 2, 3]),
        thumbnailBytes: new Uint8Array([4, 5])
      },
      { store, enqueueCanvas, enqueueThumbnail }
    )

    // A job with no destination parks on its first run and reports a red
    // failure — for a document that is perfectly safe on disk.
    expect(enqueueCanvas).not.toHaveBeenCalled()
    expect(enqueueThumbnail).not.toHaveBeenCalled()

    const meta = await store.getMeta('first-run')
    expect(meta?.syncStatus).toBe('local')
    expect(meta?.syncTargetId).toBeNull()
    // Durable regardless: the bytes are the point.
    expect(await store.readFig('first-run')).not.toBeNull()
  })

  test('local-only rows are never evictable', async () => {
    // No remote copy exists, so the local blob is the only copy. Eviction must
    // not be able to reach it whatever the cache budget says.
    const store = createMemoryLocalCanvasStore()
    await persistStorageCanvasLocally(
      {
        syncTargetId: null,
        canvasId: 'only-copy',
        name: 'Only copy',
        figBytes: new Uint8Array([7, 7, 7])
      },
      { store, enqueueCanvas: vi.fn(async () => undefined) }
    )

    const meta = await store.getMeta('only-copy')
    expect(bodyIsConfirmed(meta ?? { bodyId: null, syncedBodyId: null })).toBe(false)
  })

  test('connecting a destination later does enqueue the upload', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const options = {
      canvasId: 'promoted',
      name: 'Promoted',
      figBytes: new Uint8Array([1, 2, 3])
    }

    await persistStorageCanvasLocally({ ...options, syncTargetId: null }, { store, enqueueCanvas })
    expect(enqueueCanvas).not.toHaveBeenCalled()

    await persistStorageCanvasLocally(
      { ...options, syncTargetId: 's3-compatible#aaaaaaaa' },
      { store, enqueueCanvas }
    )

    expect(enqueueCanvas).toHaveBeenCalledTimes(1)
    expect((await store.getMeta('promoted'))?.syncStatus).toBe('pending')
  })
})

describe('a destination that cannot be written to', () => {
  /**
   * Preferences without credentials: the provider names a destination, but no
   * upload can succeed. This gates exactly like a pause — the row keeps its
   * destination and stays local — because a job created here can only park
   * and report a failure the user never asked to attempt.
   */
  test('a save against an unusable destination stays local and enqueues nothing', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const enqueueThumbnail = vi.fn(async () => undefined)

    await persistStorageCanvasLocally(
      {
        syncTargetId: 's3-compatible#aaaaaaaa',
        canvasId: 'half-configured',
        name: 'Half configured',
        figBytes: new Uint8Array([1, 2, 3]),
        thumbnailBytes: new Uint8Array([4, 5])
      },
      { store, enqueueCanvas, enqueueThumbnail, destinationUsable: async () => false }
    )

    expect(enqueueCanvas).not.toHaveBeenCalled()
    expect(enqueueThumbnail).not.toHaveBeenCalled()
    const meta = await store.getMeta('half-configured')
    expect(meta?.syncStatus).toBe('local')
    // The document still knows where it belongs — unusable is not disconnected.
    expect(meta?.syncTargetId).toBe('s3-compatible#aaaaaaaa')
  })

  test('a local-write save retires failure marks an earlier attempt recorded', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const figBytes = new Uint8Array([1, 2, 3])
    const options = {
      syncTargetId: 's3-compatible#aaaaaaaa',
      canvasId: 'stale-error',
      name: 'Stale error',
      figBytes
    }

    // An earlier failure, as the pre-fix blocked branch recorded it.
    await persistStorageCanvasLocally(options, { store, enqueueCanvas })
    await store.updateMeta('stale-error', {
      syncStatus: 'error',
      lastSyncError: 'Storage credentials are unavailable',
      lastThumbSyncError: 'Storage credentials are unavailable'
    })

    await persistStorageCanvasLocally(options, {
      store,
      enqueueCanvas,
      destinationUsable: async () => false
    })

    const meta = await store.getMeta('stale-error')
    expect(meta?.syncStatus).toBe('local')
    expect(meta?.lastSyncError).toBeNull()
    expect(meta?.lastThumbSyncError).toBeNull()
  })

  test('repairing the destination re-enables uploads on the next save', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const options = {
      syncTargetId: 's3-compatible#aaaaaaaa',
      canvasId: 'repaired',
      name: 'Repaired',
      figBytes: new Uint8Array([4, 5, 6])
    }

    await persistStorageCanvasLocally(options, {
      store,
      enqueueCanvas,
      destinationUsable: async () => false
    })
    expect(enqueueCanvas).not.toHaveBeenCalled()

    await persistStorageCanvasLocally(options, {
      store,
      enqueueCanvas,
      destinationUsable: async () => true
    })

    expect(enqueueCanvas).toHaveBeenCalledTimes(1)
    expect((await store.getMeta('repaired'))?.syncStatus).toBe('pending')
  })
})

describe('pausing cloud backup', () => {
  /**
   * Pause, not withdraw. Clearing the API key to stop syncing destroys the one
   * setting that is genuinely annoying to recreate, and says nothing about what
   * should happen to documents already in the bucket.
   */
  test('a paused save stays local and enqueues nothing', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    backupToCloud.value = false

    await persistStorageCanvasLocally(
      {
        syncTargetId: 's3-compatible#aaaaaaaa',
        canvasId: 'paused',
        name: 'Paused',
        figBytes: new Uint8Array([1, 2, 3])
      },
      { store, enqueueCanvas }
    )

    expect(enqueueCanvas).not.toHaveBeenCalled()
    const meta = await store.getMeta('paused')
    expect(meta?.syncStatus).toBe('local')
    // The document still knows where it belongs — pausing is not disconnecting.
    expect(meta?.syncTargetId).toBe('s3-compatible#aaaaaaaa')
    backupToCloud.value = true
  })

  test('resuming uploads the work done while paused', async () => {
    const store = createMemoryLocalCanvasStore()
    const enqueueCanvas = vi.fn(async () => undefined)
    const options = {
      syncTargetId: 's3-compatible#aaaaaaaa',
      canvasId: 'resumed',
      name: 'Resumed',
      figBytes: new Uint8Array([4, 5, 6])
    }

    backupToCloud.value = false
    await persistStorageCanvasLocally(options, { store, enqueueCanvas })
    expect(enqueueCanvas).not.toHaveBeenCalled()

    backupToCloud.value = true
    await persistStorageCanvasLocally(options, { store, enqueueCanvas })

    expect(enqueueCanvas).toHaveBeenCalledTimes(1)
    expect((await store.getMeta('resumed'))?.syncStatus).toBe('pending')
  })
})
