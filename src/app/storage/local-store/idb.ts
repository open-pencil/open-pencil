import type { DBSchema, IDBPDatabase } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'
import { buildIndexMeta, buildWriteMeta, sortAndFilterMetas } from '@/app/storage/local-store/meta'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import type { LocalCanvasMeta, LocalCanvasWriteInput } from '@/app/storage/local-store/types'

const localCanvasDatabase = defineAppDatabase<LocalCanvasDatabase>({
  name: APP_DATABASE_NAMES.localCanvas,
  version: 1,
  callbacks: {
    upgrade(database) {
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('fig')) database.createObjectStore('fig')
      if (!database.objectStoreNames.contains('thumb')) database.createObjectStore('thumb')
    }
  }
})

type StoredBinary = ArrayBuffer | Uint8Array | Blob

interface LocalCanvasDatabase extends DBSchema {
  meta: {
    key: string
    value: LocalCanvasMeta
  }
  fig: {
    key: string
    value: StoredBinary
  }
  thumb: {
    key: string
    value: StoredBinary
  }
}

/** Stored rows may use older ArrayBuffer/Blob representations. */
async function storedBinaryToBytes(row: StoredBinary | undefined): Promise<Uint8Array | null> {
  if (!row) return null
  if (row instanceof ArrayBuffer) return new Uint8Array(row)
  if (row instanceof Uint8Array) return Uint8Array.from(row)
  return new Uint8Array(await row.arrayBuffer())
}

function openDatabase(): Promise<IDBPDatabase<LocalCanvasDatabase>> {
  return openAppDatabase(localCanvasDatabase)
}

/** IndexedDB-backed local canvas store (meta + fig/thumb blobs). */
export function createIdbLocalCanvasStore(): LocalCanvasStore {
  const database = openDatabase()

  async function readBinary(storeName: 'fig' | 'thumb', id: string): Promise<Uint8Array | null> {
    return storedBinaryToBytes(await (await database).get(storeName, id))
  }

  return {
    async listMetas(includeTombstones = false) {
      return sortAndFilterMetas(await (await database).getAll('meta'), includeTombstones)
    },

    async getMeta(id: string) {
      return (await (await database).get('meta', id)) ?? null
    },

    async readFig(id: string) {
      return readBinary('fig', id)
    },

    async readThumb(id: string) {
      return readBinary('thumb', id)
    },

    async writeCanvas(input: LocalCanvasWriteInput) {
      const transaction = (await database).transaction(['meta', 'fig', 'thumb'], 'readwrite')
      const figStore = transaction.objectStore('fig')
      const thumbStore = transaction.objectStore('thumb')
      const metaStore = transaction.objectStore('meta')
      const existing = (await metaStore.get(input.id)) ?? null

      let hasThumb = existing?.hasThumb ?? false
      await figStore.put(Uint8Array.from(input.figBytes), input.id)

      if (input.thumbBytes != null) {
        if (input.thumbBytes.byteLength > 0) {
          await thumbStore.put(Uint8Array.from(input.thumbBytes), input.id)
          hasThumb = true
        } else {
          await thumbStore.delete(input.id)
          hasThumb = false
        }
      }

      const meta = buildWriteMeta(input, existing, hasThumb)
      await metaStore.put(meta)
      await transaction.done
      return meta
    },

    async upsertIndexMeta(input) {
      const transaction = (await database).transaction('meta', 'readwrite')
      const store = transaction.objectStore('meta')
      const existing = (await store.get(input.id)) ?? null
      const meta = buildIndexMeta(input, existing)
      await store.put(meta)
      await transaction.done
      return meta
    },

    async writeThumb(id: string, thumbBytes: Uint8Array) {
      const transaction = (await database).transaction(['meta', 'thumb'], 'readwrite')
      const metaStore = transaction.objectStore('meta')
      const existing = await metaStore.get(id)
      if (!existing) {
        await transaction.done
        return null
      }
      await transaction.objectStore('thumb').put(Uint8Array.from(thumbBytes), id)
      // Thumb freshness is tracked by its own outbox job — never demote the
      // document's syncStatus here (it orphaned rows as 'pending' forever).
      const meta: LocalCanvasMeta = { ...existing, hasThumb: true }
      await metaStore.put(meta)
      await transaction.done
      return meta
    },

    async updateMeta(id: string, patch: Partial<LocalCanvasMeta>, options) {
      const transaction = (await database).transaction('meta', 'readwrite')
      const store = transaction.objectStore('meta')
      const existing = await store.get(id)
      if (
        !existing ||
        (options?.expectedRevision != null && existing.revision !== options.expectedRevision)
      ) {
        await transaction.done
        return null
      }
      const next = { ...existing, ...patch, id: existing.id }
      await store.put(next)
      await transaction.done
      return next
    },

    async tombstone(id: string) {
      return this.updateMeta(id, {
        tombstoned: true,
        syncStatus: 'pending',
        updatedAt: new Date().toISOString()
      })
    },

    async clearFig(id: string) {
      const transaction = (await database).transaction(['meta', 'fig'], 'readwrite')
      const metaStore = transaction.objectStore('meta')
      const existing = await metaStore.get(id)
      if (!existing) {
        await transaction.done
        return null
      }
      await transaction.objectStore('fig').delete(id)
      const meta: LocalCanvasMeta = { ...existing, hasFig: false, figSize: 0 }
      await metaStore.put(meta)
      await transaction.done
      return meta
    },

    async remove(id: string) {
      const transaction = (await database).transaction(['meta', 'fig', 'thumb'], 'readwrite')
      await Promise.all([
        transaction.objectStore('meta').delete(id),
        transaction.objectStore('fig').delete(id),
        transaction.objectStore('thumb').delete(id)
      ])
      await transaction.done
    },

    async clearAll() {
      const transaction = (await database).transaction(['meta', 'fig', 'thumb'], 'readwrite')
      await Promise.all([
        transaction.objectStore('meta').clear(),
        transaction.objectStore('fig').clear(),
        transaction.objectStore('thumb').clear()
      ])
      await transaction.done
    }
  }
}
