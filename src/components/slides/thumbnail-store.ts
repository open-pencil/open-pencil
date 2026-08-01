import { openIdb, reqToPromise, txDone } from '@/app/storage/idb-util'

const DB_NAME = 'open-pencil-thumbnails'
const DB_VERSION = 1
const STORE = 'slides'
const TOUCHED_INDEX = 'touchedAt'

/**
 * Thumbnails kept across sessions, so reopening a deck shows its filmstrip immediately
 * instead of rasterising every slide again.
 *
 * Entries are bounded and evicted oldest-touched-first: a long deck is a few megabytes,
 * and without a cap this would grow by that much for every document ever opened.
 */
const MAX_ENTRIES = 400

type ThumbnailRow = {
  key: string
  blob: Blob
  touchedAt: number
}

function db(): Promise<IDBDatabase> {
  return openIdb(DB_NAME, DB_VERSION, (database) => {
    if (database.objectStoreNames.contains(STORE)) return
    const store = database.createObjectStore(STORE, { keyPath: 'key' })
    store.createIndex(TOUCHED_INDEX, 'touchedAt')
  })
}

export async function readStoredThumbnail(key: string): Promise<Blob | null> {
  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readonly')
    const row = await reqToPromise<ThumbnailRow | undefined>(tx.objectStore(STORE).get(key))
    return row?.blob ?? null
  } catch (error) {
    console.warn('[thumbnails] could not read the stored thumbnail', error)
    return null
  }
}

export async function writeStoredThumbnail(key: string, blob: Blob): Promise<void> {
  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ key, blob, touchedAt: Date.now() } satisfies ThumbnailRow)
    await txDone(tx)
    await evictOldest(database)
  } catch (error) {
    console.warn('[thumbnails] could not store the thumbnail', error)
  }
}

async function evictOldest(database: IDBDatabase): Promise<void> {
  const countTx = database.transaction(STORE, 'readonly')
  const total = await reqToPromise(countTx.objectStore(STORE).count())
  if (total <= MAX_ENTRIES) return

  const tx = database.transaction(STORE, 'readwrite')
  const index = tx.objectStore(STORE).index(TOUCHED_INDEX)
  let remaining = total - MAX_ENTRIES
  await new Promise<void>((resolve, reject) => {
    const cursorReq = index.openCursor()
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (!cursor || remaining <= 0) {
        resolve()
        return
      }
      cursor.delete()
      remaining -= 1
      cursor.continue()
    }
    cursorReq.onerror = () => reject(cursorReq.error ?? new Error('thumbnail eviction failed'))
  })
  await txDone(tx)
}
