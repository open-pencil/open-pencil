import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { createIdbLocalCanvasStore } from '@/app/storage/local-store/idb'

import { expectDefined } from '#tests/helpers/assert'

describe('local canvas store (memory)', () => {
  test('writes and reads fig bytes outside localStorage', async () => {
    const store = createMemoryLocalCanvasStore()
    resetLocalCanvasStoreForTests(store)
    const fig = new Uint8Array([1, 2, 3, 4, 5])
    const meta = await store.writeCanvas({
      id: 'c1',
      providerId: 's3-compatible',
      name: 'Demo',
      figBytes: fig
    })
    expect(meta.revision).toBe(1)
    expect(meta.syncStatus).toBe('pending')
    expect(meta.hasFig).toBe(true)

    const read = expectDefined(await store.readFig('c1'))
    expect([...read]).toEqual([1, 2, 3, 4, 5])

    const list = await store.listMetas()
    expect(list.map((m) => m.id)).toEqual(['c1'])
  })

  test('increments revision and hides tombstones from list', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'c1',
      providerId: 's3-compatible',
      name: 'A',
      figBytes: new Uint8Array([9])
    })
    const second = await store.writeCanvas({
      id: 'c1',
      providerId: 's3-compatible',
      name: 'A2',
      figBytes: new Uint8Array([9, 9])
    })
    expect(second.revision).toBe(2)
    await store.tombstone('c1')
    expect((await store.listMetas(false)).length).toBe(0)
    expect((await store.listMetas(true)).length).toBe(1)
  })

  test('rejects stale revision-conditional metadata updates', async () => {
    const store = createMemoryLocalCanvasStore()
    await store.writeCanvas({
      id: 'conditional',
      providerId: 's3-compatible',
      name: 'Draft',
      figBytes: new Uint8Array([1])
    })

    expect(
      await store.updateMeta('conditional', { syncStatus: 'synced' }, { expectedRevision: 0 })
    ).toBeNull()
    expect((await store.getMeta('conditional'))?.syncStatus).toBe('pending')
  })

  test('upsertIndexMeta does not require fig body', async () => {
    const store = createMemoryLocalCanvasStore()
    const meta = await store.upsertIndexMeta({
      id: 'remote-1',
      providerId: 's3-compatible',
      name: 'From bucket',
      updatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: 'synced',
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      lastSyncError: null,
      hasFig: false
    })
    expect(meta.hasFig).toBe(false)
    expect(await store.readFig('remote-1')).toBeNull()
  })
})

describe('local canvas store (IndexedDB)', () => {
  test('serializes concurrent writes into distinct revisions', async () => {
    const store = createIdbLocalCanvasStore()
    const id = `concurrent-${crypto.randomUUID()}`
    const writes = await Promise.all([
      store.writeCanvas({
        id,
        providerId: 's3-compatible',
        name: 'First',
        figBytes: new Uint8Array([1])
      }),
      store.writeCanvas({
        id,
        providerId: 's3-compatible',
        name: 'Second',
        figBytes: new Uint8Array([2])
      })
    ])

    expect(writes.map((meta) => meta.revision).sort()).toEqual([1, 2])
    expect((await store.getMeta(id))?.revision).toBe(2)
  })
})
