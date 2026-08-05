import type { RenderedPixels } from '@open-pencil/core/io'

import { openIdb, reqToPromise, txDone } from '@/app/storage/idb-util'

const DB_NAME = 'open-pencil-thumbnails'
// Version 2 drops the oversized 2x raw thumbnails written by the first pixel-cache
// implementation. They are derived data, and cloning them from IndexedDB caused scroll jank.
// Version 3 drops rows keyed by a document's display name: a rename could never match them
// again, so they were unreachable and unprunable, and only the size cap ever removed them.
const DB_VERSION = 3
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

/**
 * Drop a document's rows for pages it no longer has, returning how many went.
 *
 * Restructuring a deck regenerates its page ids, so each pass leaves the previous
 * generation behind — 134 dead rows against 20 live ones for one deck here. They are not
 * wrong, merely unreachable, but they compete for `MAX_ENTRIES`, and evicting a thumbnail
 * still in use to keep one that can never be read again is exactly backwards.
 *
 * `pageIds` must be the document's COMPLETE page list. Pruning against a partial one would
 * delete the thumbnails of pages that simply had not loaded yet, so an empty list prunes
 * nothing rather than everything.
 */
export async function pruneStoredThumbnails(
  documentId: string,
  pageIds: Iterable<string>
): Promise<number> {
  const prefix = `${documentId}:`
  const keep = new Set<string>()
  for (const pageId of pageIds) keep.add(`${prefix}${pageId}`)
  if (keep.size === 0) return 0

  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    // `￿` sorts above every character IndexedDB will have stored, so this range is
    // exactly the rows whose key begins with the prefix.
    const range = IDBKeyRange.bound(prefix, `${prefix}￿`, false, true)
    const keys = await reqToPromise<IDBValidKey[]>(store.getAllKeys(range))
    let removed = 0
    for (const key of keys) {
      if (typeof key !== 'string' || keep.has(key)) continue
      store.delete(key)
      removed += 1
    }
    await txDone(tx)
    return removed
  } catch (error) {
    console.warn('[thumbnails] could not prune stale thumbnails', error)
    return 0
  }
}

/**
 * A workspace document id — the only key prefix this module may decide is obsolete.
 *
 * A thumbnail can also be keyed by a file path or a display name, for documents the
 * workspace does not track. Those are absent from any document list by design, so
 * treating "not listed" as "deleted" would throw them away; the shape test is what keeps
 * the sweep to rows whose absence actually means something.
 */
const WORKSPACE_DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Drop rows belonging to workspace documents that no longer exist, returning how many went.
 *
 * Per-document pruning cannot reach these: it only runs when a document is opened, and a
 * deleted document never is. Until the size cap happened to evict them they sat there,
 * competing with live thumbnails.
 *
 * `liveDocumentIds` must include trashed documents — a trashed document can be restored,
 * and it should come back with its filmstrip rather than a wall of placeholders. An empty
 * list prunes nothing: a document list that failed to load is indistinguishable from an
 * empty workspace, and only one of those readings is recoverable.
 */
export async function pruneThumbnailsForMissingDocuments(
  liveDocumentIds: Iterable<string>
): Promise<number> {
  const live = new Set(liveDocumentIds)
  if (live.size === 0) return 0

  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const keys = await reqToPromise<IDBValidKey[]>(store.getAllKeys())
    let removed = 0
    for (const key of keys) {
      if (typeof key !== 'string') continue
      const separator = key.indexOf(':')
      if (separator <= 0) continue
      const documentId = key.slice(0, separator)
      if (!WORKSPACE_DOCUMENT_ID.test(documentId) || live.has(documentId)) continue
      store.delete(key)
      removed += 1
    }
    await txDone(tx)
    return removed
  } catch (error) {
    console.warn('[thumbnails] could not prune thumbnails of deleted documents', error)
    return 0
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
