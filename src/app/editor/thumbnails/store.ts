import type { RenderedPixels } from '@open-pencil/core/io'

import { openIdb, reqToPromise, txDone } from '@/app/storage/idb-util'

const DB_NAME = 'open-pencil-thumbnails'
// Version 2 drops the oversized 2x raw thumbnails written by the first pixel-cache
// implementation. They are derived data, and cloning them from IndexedDB caused scroll jank.
const DB_VERSION = 2
const STORE = 'slides'
const TOUCHED_INDEX = 'touchedAt'

/**
 * Thumbnails kept across sessions, so reopening a deck shows its filmstrip immediately.
 *
 * New entries store raw RGBA pixels at filmstrip resolution. Blob rows remain supported,
 * while schema upgrades may discard this derived cache so obsolete oversized rows cannot
 * keep hurting interaction performance.
 */
const MAX_ENTRIES = 400

export type StoredSlideThumbnail = Blob | RenderedPixels

type ThumbnailRow = {
  key: string
  image?: StoredSlideThumbnail
  /** Legacy PNG field written before raw-pixel thumbnails. */
  blob?: Blob
  touchedAt: number
}

function db(): Promise<IDBDatabase> {
  return openIdb(DB_NAME, DB_VERSION, (database) => {
    if (database.objectStoreNames.contains(STORE)) database.deleteObjectStore(STORE)
    const store = database.createObjectStore(STORE, { keyPath: 'key' })
    store.createIndex(TOUCHED_INDEX, 'touchedAt')
  })
}

export async function readStoredThumbnail(key: string): Promise<StoredSlideThumbnail | null> {
  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readonly')
    const row = await reqToPromise<ThumbnailRow | undefined>(tx.objectStore(STORE).get(key))
    return row?.image ?? row?.blob ?? null
  } catch (error) {
    console.warn('[thumbnails] could not read the stored thumbnail', error)
    return null
  }
}

export async function writeStoredThumbnail(
  key: string,
  image: StoredSlideThumbnail
): Promise<void> {
  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ key, image, touchedAt: Date.now() } satisfies ThumbnailRow)
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
