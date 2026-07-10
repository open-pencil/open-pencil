import type { LocalCanvasMeta, LocalCanvasWriteInput } from '@/app/cloud/local-store/types'
import type { LocalCanvasStore } from '@/app/cloud/local-store/store'

const DB_NAME = 'open-pencil-cloud-local'
const DB_VERSION = 1

const STORE_META = 'meta'
const STORE_FIG = 'fig'
const STORE_THUMB = 'thumb'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('Failed to open local cloud DB'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_FIG)) {
        db.createObjectStore(STORE_FIG)
      }
      if (!db.objectStoreNames.contains(STORE_THUMB)) {
        db.createObjectStore(STORE_THUMB)
      }
    }
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

/** IndexedDB-backed local canvas store (meta + fig/thumb blobs). */
export function createIdbLocalCanvasStore(): LocalCanvasStore {
  let dbPromise: Promise<IDBDatabase> | null = null

  function db() {
    if (!dbPromise) dbPromise = openDb()
    return dbPromise
  }

  return {
    async listMetas(includeTombstones = false) {
      const database = await db()
      const tx = database.transaction(STORE_META, 'readonly')
      const all = await reqToPromise(tx.objectStore(STORE_META).getAll()) as LocalCanvasMeta[]
      await txDone(tx)
      const filtered = includeTombstones ? all : all.filter((m) => !m.tombstoned)
      return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
      const database = await db()
      const tx = database.transaction(STORE_FIG, 'readonly')
      const row = await reqToPromise(tx.objectStore(STORE_FIG).get(id))
      await txDone(tx)
      if (row == null) return null
      if (row instanceof ArrayBuffer) return new Uint8Array(row)
      if (row instanceof Uint8Array) return new Uint8Array(row)
      if (row instanceof Blob) return new Uint8Array(await row.arrayBuffer())
      return null
    },

    async readThumb(id: string) {
      const database = await db()
      const tx = database.transaction(STORE_THUMB, 'readonly')
      const row = await reqToPromise(tx.objectStore(STORE_THUMB).get(id))
      await txDone(tx)
      if (row == null) return null
      if (row instanceof ArrayBuffer) return new Uint8Array(row)
      if (row instanceof Uint8Array) return new Uint8Array(row)
      if (row instanceof Blob) return new Uint8Array(await row.arrayBuffer())
      return null
    },

    async writeCanvas(input: LocalCanvasWriteInput) {
      const database = await db()
      const existing = await this.getMeta(input.id)
      const revision = input.revision ?? (existing ? existing.revision + 1 : 1)

      let hasThumb = existing?.hasThumb ?? false
      const tx = database.transaction([STORE_META, STORE_FIG, STORE_THUMB], 'readwrite')
      const figStore = tx.objectStore(STORE_FIG)
      const thumbStore = tx.objectStore(STORE_THUMB)
      const metaStore = tx.objectStore(STORE_META)

      figStore.put(input.figBytes.buffer.slice(
        input.figBytes.byteOffset,
        input.figBytes.byteOffset + input.figBytes.byteLength
      ), input.id)

      if (input.thumbBytes != null) {
        if (input.thumbBytes.byteLength > 0) {
          thumbStore.put(
            input.thumbBytes.buffer.slice(
              input.thumbBytes.byteOffset,
              input.thumbBytes.byteOffset + input.thumbBytes.byteLength
            ),
            input.id
          )
          hasThumb = true
        } else {
          thumbStore.delete(input.id)
          hasThumb = false
        }
      }

      const meta: LocalCanvasMeta = {
        id: input.id,
        providerId: input.providerId,
        name: input.name,
        updatedAt: input.updatedAt ?? new Date().toISOString(),
        revision,
        syncStatus: input.syncStatus ?? 'pending',
        lastSyncedAt: existing?.lastSyncedAt ?? null,
        lastSyncError: input.syncStatus === 'synced' ? null : (existing?.lastSyncError ?? null),
        tombstoned: false,
        hasFig: true,
        hasThumb
      }
      metaStore.put(meta)
      await txDone(tx)
      return meta
    },

    async upsertIndexMeta(input) {
      const existing = await this.getMeta(input.id)
      const meta: LocalCanvasMeta = {
        id: input.id,
        providerId: input.providerId,
        name: input.name,
        updatedAt: input.updatedAt,
        revision: input.revision ?? existing?.revision ?? 1,
        syncStatus: input.syncStatus,
        lastSyncedAt: input.lastSyncedAt,
        lastSyncError: input.lastSyncError,
        tombstoned: false,
        hasFig: input.hasFig ?? existing?.hasFig ?? false,
        hasThumb: input.hasThumb ?? existing?.hasThumb ?? false
      }
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
      tx.objectStore(STORE_THUMB).put(
        thumbBytes.buffer.slice(thumbBytes.byteOffset, thumbBytes.byteOffset + thumbBytes.byteLength),
        id
      )
      const meta: LocalCanvasMeta = {
        ...existing,
        hasThumb: true,
        syncStatus: existing.syncStatus === 'synced' ? 'pending' : existing.syncStatus
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
