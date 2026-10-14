import { describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { DeckWriteRefusedError, persistStorageCanvasLocally } from '@/app/storage/sync/persist'

import { figArchive } from '#tests/helpers/storage/documents'

describe('library persistence', () => {
  test('a new design is written locally before its commit is queued', async () => {
    const store = createMemoryLocalCanvasStore()
    const queued: string[] = []

    await persistStorageCanvasLocally(
      { providerId: 's3-compatible', canvasId: 'doc', name: 'Doc', figBytes: figArchive('v1') },
      {
        store,
        enqueueCanvas: async (id) => {
          queued.push(`canvas:${id}:${(await store.getMeta(id))?.hasFig}`)
        },
        enqueueMetadata: async (id) => {
          queued.push(`metadata:${id}`)
        }
      }
    )

    expect(queued).toEqual(['canvas:doc:true'])
    expect((await store.getMeta('doc'))?.bodyId).toStartWith('sha256:')
  })

  test('refuses to save over a slide deck', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.upsertIndexMeta({
      id: 'slides',
      providerId: 's3-compatible',
      name: 'Slides',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sourceFormat: 'deck',
      syncStatus: 'synced',
      lastSyncedAt: null,
      lastSyncError: null
    })

    await expect(
      persistStorageCanvasLocally(
        { providerId: 's3-compatible', canvasId: 'slides', name: 'x', figBytes: figArchive('x') },
        { store, enqueueCanvas: async () => undefined }
      )
    ).rejects.toBeInstanceOf(DeckWriteRefusedError)
    expect(await store.readFig('slides')).toBeNull()
  })
})
