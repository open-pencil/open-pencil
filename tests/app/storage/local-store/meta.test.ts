import { describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { normalizeLocalCanvasMeta } from '@/app/storage/local-store/meta'

const BYTES = new Uint8Array([1, 2, 3])

describe('local canvas rows', () => {
  test('a row stored before versioned sync reads with unknown identity and no confirmation', () => {
    const row = normalizeLocalCanvasMeta({
      id: 'old',
      providerId: 's3-compatible',
      name: 'Old',
      updatedAt: '2026-01-01T00:00:00.000Z',
      revision: 3,
      syncStatus: 'synced',
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      lastSyncError: null,
      tombstoned: false,
      hasFig: true,
      hasThumb: false
    })

    expect(row).toMatchObject({
      sourceFormat: 'fig',
      trashedAt: null,
      bodyId: null,
      syncedBodyId: null,
      baseStateId: null,
      lastPublishedStateId: null,
      versionedConfirmed: false,
      syncDestination: null
    })
  })

  test('a write for another destination drops the confirmations of the old one', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'doc',
      providerId: 's3-compatible',
      name: 'Doc',
      figBytes: BYTES,
      bodyId: 'body',
      syncedBodyId: 'body',
      baseStateId: 'state',
      versionedConfirmed: true,
      syncDestination: 'bucket-a'
    })
    await store.updateMeta('doc', { lastPublishedStateId: 'state' })

    const same = await store.writeCanvas({
      id: 'doc',
      providerId: 's3-compatible',
      name: 'Doc',
      figBytes: BYTES,
      bodyId: 'body'
    })
    expect(same).toMatchObject({ syncedBodyId: 'body', lastPublishedStateId: 'state' })

    const moved = await store.writeCanvas({
      id: 'doc',
      providerId: 's3-compatible',
      name: 'Doc',
      figBytes: BYTES,
      bodyId: 'body',
      syncDestination: 'bucket-b'
    })
    expect(moved).toMatchObject({
      syncDestination: 'bucket-b',
      syncedBodyId: null,
      baseStateId: null,
      lastPublishedStateId: null,
      versionedConfirmed: false
    })
  })

  test('a write keeps the row’s format and trash state unless it names them', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.upsertIndexMeta({
      id: 'slides',
      providerId: 's3-compatible',
      name: 'Slides',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sourceFormat: 'deck',
      trashedAt: '2026-01-02T00:00:00.000Z',
      syncStatus: 'synced',
      lastSyncedAt: null,
      lastSyncError: null
    })

    const written = await store.writeCanvas({
      id: 'slides',
      providerId: 's3-compatible',
      name: 'Slides',
      figBytes: BYTES
    })

    expect(written).toMatchObject({ sourceFormat: 'deck', trashedAt: '2026-01-02T00:00:00.000Z' })
  })
})
