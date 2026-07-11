import { openIdb, reqToPromise, txDone } from '@/app/cloud/idb-util'
import { buildIndexMeta, buildWriteMeta, sortAndFilterMetas } from '@/app/cloud/local-store/meta'
import type { LocalCanvasStore } from '@/app/cloud/local-store/store'
import type { LocalCanvasMeta, LocalCanvasWriteInput } from '@/app/cloud/local-store/types'

const DB_NAME = 'open-pencil-cloud-local'
const DB_VERSION = 1

const STORE_META = 'meta'
const STORE_FIG = 'fig'
const STORE_THUMB = 'thumb'

function openDb(): Promise<IDBDatabase> {
  return openIdb(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE_META)) {
      db.createObjectStore(STORE_META, { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains(STORE_FIG)) {
      db.createObjectStore(STORE_FIG)
    }
    if (!db.objectStoreNames.contains(STORE_THUMB)) {
      db.createObjectStore(STORE_THUMB)
    }
  })
}

/** Stored rows may be ArrayBuffer, typed array, or Blob depending on writer/browser. */
async function rowToBytes(row: unknown): Promise<Uint8Array | null> {
  if (row == null) return null
  if (row instanceof ArrayBuffer) return new Uint8Array(row)
  if (row instanceof Uint8Array) return new Uint8Array(row)
  if (row instanceof Blob) return new Uint8Array(await row.arrayBuffer())
  return null
}

function bytesToBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** IndexedDB-backed local canvas store (meta + fig/thumb blobs). */
export function createIdbLocalCanvasStore(): LocalCanvasStore {
  let dbPromise: Promise<IDBDatabase> | null = null

  function db() {
    if (!dbPromise) dbPromise = openDb()
    return dbPromise
  }

  async function readBlob(storeName: string, id: string): Promise<Uint8Array | null> {
    const database = await db()
    const tx = database.transaction(storeName, 'readonly')
    const row = await reqToPromise(tx.objectStore(storeName).get(id))
    await txDone(tx)
    return rowToBytes(row)
  }

  return {
    async listMetas(includeTombstones = false) {
      const database = await db()
      const tx = database.transaction(STORE_META, 'readonly')
      const all = (await reqToPromise(tx.objectStore(STORE_META).getAll())) as LocalCanvasMeta[]
      await txDone(tx)
      return sortAndFilterMetas(all, includeTombstones)
    },

    async getMeta(id: string) {
      const database = await db()
      const tx = database.transaction(STORE_META, 'readonly')
      const row = (await reqToPromise(tx.objectStore(STORE_META).get(id))) as
        | LocalCanvasMeta
        | undefined
      await txDone(tx)
      return row ?? null
    },

    async readFig(id: string) {
      return readBlob(STORE_FIG, id)
    },

    async readThumb(id: string) {
      return readBlob(STORE_THUMB, id)
    },

    async writeCanvas(input: LocalCanvasWriteInput) {
      const database = await db()
      const existing = await this.getMeta(input.id)

      let hasThumb = existing?.hasThumb ?? false
      const tx = database.transaction([STORE_META, STORE_FIG, STORE_THUMB], 'readwrite')
      const figStore = tx.objectStore(STORE_FIG)
      const thumbStore = tx.objectStore(STORE_THUMB)
      const metaStore = tx.objectStore(STORE_META)

      figStore.put(bytesToBuffer(input.figBytes), input.id)

      if (input.thumbBytes != null) {
        if (input.thumbBytes.byteLength > 0) {
          thumbStore.put(bytesToBuffer(input.thumbBytes), input.id)
          hasThumb = true
        } else {
          thumbStore.delete(input.id)
          hasThumb = false
        }
      }

      const meta = buildWriteMeta(input, existing, hasThumb)
      metaStore.put(meta)
      await txDone(tx)
      return meta
    },

    async upsertIndexMeta(input) {
      const existing = await this.getMeta(input.id)
      const meta = buildIndexMeta(input, existing)
      const database = await db()
      const tx = database.transaction(STORE_META, 'readwrite')
      tx.objectStore(STORE_META).put(meta)
      await txDone(tx)
      return meta
    },

    async writeThumb(id: string, thumbBytes: Uint8Array) {
      const existing = await this.getMeta(id)
      if (!existing) return null
      const database = await db()
      const tx = database.transaction([STORE_META, STORE_THUMB], 'readwrite')
      tx.objectStore(STORE_THUMB).put(bytesToBuffer(thumbBytes), id)
      // Thumb freshness is tracked by its own outbox job — never demote the
      // document's syncStatus here (it orphaned rows as 'pending' forever).
      const meta: LocalCanvasMeta = {
        ...existing,
        hasThumb: true
      }
      tx.objectStore(STORE_META).put(meta)
      await txDone(tx)
      return meta
    },

    async updateMeta(id: string, patch: Partial<LocalCanvasMeta>) {
      const existing = await this.getMeta(id)
      if (!existing) return null
      const next = { ...existing, ...patch, id: existing.id }
      const database = await db()
      const tx = database.transaction(STORE_META, 'readwrite')
      tx.objectStore(STORE_META).put(next)
      await txDone(tx)
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
      const existing = await this.getMeta(id)
      if (!existing) return null
      const database = await db()
      const tx = database.transaction([STORE_META, STORE_FIG], 'readwrite')
      tx.objectStore(STORE_FIG).delete(id)
      const meta: LocalCanvasMeta = { ...existing, hasFig: false, figSize: 0 }
      tx.objectStore(STORE_META).put(meta)
      await txDone(tx)
      return meta
    },

    async remove(id: string) {
      const database = await db()
      const tx = database.transaction([STORE_META, STORE_FIG, STORE_THUMB], 'readwrite')
      tx.objectStore(STORE_META).delete(id)
      tx.objectStore(STORE_FIG).delete(id)
      tx.objectStore(STORE_THUMB).delete(id)
      await txDone(tx)
    },

    async clearAll() {
      const database = await db()
      const tx = database.transaction([STORE_META, STORE_FIG, STORE_THUMB], 'readwrite')
      tx.objectStore(STORE_META).clear()
      tx.objectStore(STORE_FIG).clear()
      tx.objectStore(STORE_THUMB).clear()
      await txDone(tx)
    }
  }
}
