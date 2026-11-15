import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import { createIdbLocalCanvasStore } from '@/app/storage/local-store/idb'
import { purgeUnchangedCopies } from '@/app/storage/workspace/source'

function write(store: LocalCanvasStore, id: string, syncStatus: 'synced' | 'pending') {
  return store.writeCanvas({
    id,
    providerId: 's3-compatible',
    name: id,
    figBytes: new Uint8Array([1]),
    syncStatus
  })
}

for (const [kind, create] of [
  ['memory', createMemoryLocalCanvasStore],
  ['IndexedDB', createIdbLocalCanvasStore]
] as const) {
  describe(`purging copies deleted from storage (${kind})`, () => {
    test('removes a copy that stayed as it was read', async () => {
      const store = create()
      const id = crypto.randomUUID()
      await write(store, id, 'synced')
      await purgeUnchangedCopies(store, await store.listMetas(true), [id])
      expect(await store.getMeta(id)).toBeNull()
      expect(await store.readFig(id)).toBeNull()
    })

    test('keeps a copy edited while the provider was listed', async () => {
      const store = create()
      const id = crypto.randomUUID()
      await write(store, id, 'synced')
      const read = await store.listMetas(true)
      await write(store, id, 'pending')
      await purgeUnchangedCopies(store, read, [id])
      expect(await store.getMeta(id)).toMatchObject({ syncStatus: 'pending', revision: 2 })
    })

    test('keeps a copy replaced by a newer synced one while the provider was listed', async () => {
      const store = create()
      const id = crypto.randomUUID()
      await write(store, id, 'synced')
      const read = await store.listMetas(true)
      await write(store, id, 'synced')
      await purgeUnchangedCopies(store, read, [id])
      expect(await store.getMeta(id)).toMatchObject({ syncStatus: 'synced', revision: 2 })
    })
  })
}
