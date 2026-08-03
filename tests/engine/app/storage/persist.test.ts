import { describe, expect, test, vi } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
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
        providerId: 's3-compatible',
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
      providerId: 's3-compatible'
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
    const enqueueCanvas = vi.fn(async () => {})
    const figBytes = new Uint8Array([1, 2, 3])
    const options = {
      providerId: 's3-compatible' as const,
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
    const enqueueCanvas = vi.fn(async () => {})
    const base = {
      providerId: 's3-compatible' as const,
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
