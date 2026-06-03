/**
 * Persistent cache for the most recently opened .pen / .fig document so the
 * web editor survives page reloads without forcing the user to drag the file
 * back in. Stored in IndexedDB because documents can easily exceed the
 * localStorage quota (5MB+) and we want binary-safe storage.
 *
 * Only the latest document is kept (single-slot store) to keep the surface
 * tiny. A future change can promote this to a multi-entry "recent files"
 * panel if needed.
 */

const DB_NAME = 'inkly-document-cache'
const DB_VERSION = 1
const STORE_NAME = 'documents'
const ENTRY_KEY = 'latest'

export interface CachedPenDocument {
  name: string
  mimeType: string
  bytes: Uint8Array
  updatedAt: number
}

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDB()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const store = tx.objectStore(STORE_NAME)
      let settled = false
      fn(store)
        .then((value) => {
          settled = true
          tx.oncomplete = () => resolve(value)
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
        .catch((err) => {
          settled = true
          reject(err)
        })
      tx.onerror = () => {
        if (!settled) reject(tx.error)
      }
    })
  } finally {
    db.close()
  }
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePenToCache(name: string, mimeType: string, bytes: Uint8Array): Promise<void> {
  if (!isIndexedDBAvailable()) return
  try {
    await withStore('readwrite', async (store) => {
      await reqToPromise(
        store.put({ name, mimeType, bytes, updatedAt: Date.now() } satisfies CachedPenDocument, ENTRY_KEY)
      )
    })
  } catch (err) {
    console.warn('[pen-cache] save failed:', err)
  }
}

export async function loadCachedPen(): Promise<CachedPenDocument | null> {
  if (!isIndexedDBAvailable()) return null
  try {
    return await withStore('readonly', async (store) => {
      const value = await reqToPromise(store.get(ENTRY_KEY))
      if (!value || typeof value !== 'object') return null
      const v = value as Partial<CachedPenDocument>
      if (!v.name || !v.bytes || !(v.bytes instanceof Uint8Array)) return null
      return {
        name: v.name,
        mimeType: v.mimeType ?? 'application/octet-stream',
        bytes: v.bytes,
        updatedAt: v.updatedAt ?? 0
      }
    })
  } catch (err) {
    console.warn('[pen-cache] load failed:', err)
    return null
  }
}

export async function clearCachedPen(): Promise<void> {
  if (!isIndexedDBAvailable()) return
  try {
    await withStore('readwrite', async (store) => {
      await reqToPromise(store.delete(ENTRY_KEY))
    })
  } catch (err) {
    console.warn('[pen-cache] clear failed:', err)
  }
}

export function fileFromCachedPen(cached: CachedPenDocument): File {
  return new File([cached.bytes], cached.name, { type: cached.mimeType })
}
