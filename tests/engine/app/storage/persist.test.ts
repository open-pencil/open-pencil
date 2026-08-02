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
