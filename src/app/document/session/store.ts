import { openIdb, reqToPromise, txDone } from '@/app/storage/idb-util'

const DB_NAME = 'open-pencil-session'
const DB_VERSION = 1
const STORE = 'last-document'
const KEY = 'active'

/**
 * The document that was open when the tab last closed.
 *
 * `bytes` is the document serialised in its own native format, so a restore is a normal
 * open rather than a special path. The file handle rides along when the browser can store
 * one: it lets a restored document keep saving to the file it came from instead of falling
 * back to Save As. Chrome may still refuse to hand back permission, which is why the bytes
 * are the source of truth and the handle is only an optimisation.
 */
export type SessionSnapshot = {
  name: string
  sourceFormat: string
  bytes: Uint8Array
  handle?: FileSystemFileHandle | null
  savedAt: number
}

function db(): Promise<IDBDatabase> {
  return openIdb(DB_NAME, DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
  })
}

export async function saveSessionSnapshot(snapshot: SessionSnapshot): Promise<void> {
  const database = await db()
  const tx = database.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(snapshot, KEY)
  await txDone(tx)
}

export async function readSessionSnapshot(): Promise<SessionSnapshot | null> {
  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readonly')
    const row = await reqToPromise<SessionSnapshot | undefined>(tx.objectStore(STORE).get(KEY))
    return row ?? null
  } catch (error) {
    // A restore is a convenience; never let it block startup.
    console.warn('[session] could not read the stored document', error)
    return null
  }
}

export async function clearSessionSnapshot(): Promise<void> {
  try {
    const database = await db()
    const tx = database.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    await txDone(tx)
  } catch (error) {
    // A stale snapshot is harmless — the next save replaces it.
    console.warn('[session] could not clear the stored document', error)
  }
}
