import { deleteDB, openDB, type IDBPDatabase } from 'idb'

import { APP_DATABASE_NAMES } from './database-names'

/**
 * Binary values as IndexedDB stores them. Neither form fits every engine: Chromium refuses a
 * single value over 127 MiB but keeps a Blob as a file at any size, and WebKit cannot store a
 * Blob in a private context such as Safari Private Browsing. Writes store Blobs where the engine
 * takes them and byte arrays elsewhere. Rows from earlier versions may be either, or an
 * ArrayBuffer.
 */
export type StoredBinary = Blob | Uint8Array | ArrayBuffer

/** Turns bytes into the value a write stores. */
export type StoreBinary = (bytes: Uint8Array) => StoredBinary

/** The bytes as a view IndexedDB can store; bytes over a shared buffer are copied first. */
function plainBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : bytes.slice()
}

const asBlob: StoreBinary = (bytes) => new Blob([plainBytes(bytes)])

/**
 * Whether the engine stores Blobs, found by storing one in a database of its own. WebKit fails a
 * Blob write in a private context with "Error preparing Blob/File data to be stored in object
 * store", and when the transaction holds another pending request it never aborts, blocking
 * every later write to those stores, so an app write cannot try a Blob and fall back. Any failed
 * Blob write means byte arrays; a probe database that cannot open or be removed says nothing
 * about Blobs.
 */
async function probeBlobs(): Promise<boolean> {
  const name = APP_DATABASE_NAMES.blobProbe
  let database: IDBPDatabase
  try {
    database = await openDB(name, 1, {
      upgrade: (upgrading) => upgrading.createObjectStore('probe')
    })
  } catch {
    return true
  }
  try {
    await database.put('probe', new Blob([new Uint8Array(1)]), 'probe')
    return true
  } catch {
    return false
  } finally {
    database.close()
    await deleteDB(name).catch(() => undefined)
  }
}

let blobsStored: Promise<boolean> | undefined

/**
 * The form this engine stores binary values in. Take it before opening the transaction that
 * writes them: waiting on it inside one would let the transaction commit.
 */
export async function binaryStorage(): Promise<StoreBinary> {
  blobsStored ??= probeBlobs()
  return (await blobsStored) ? asBlob : plainBytes
}

/** The bytes of a stored binary value, in any form a version of the app stored. */
export async function readStoredBinary(
  stored: StoredBinary | undefined
): Promise<Uint8Array | null> {
  if (!stored) return null
  if (stored instanceof Blob) return new Uint8Array(await stored.arrayBuffer())
  return stored instanceof ArrayBuffer ? new Uint8Array(stored) : stored
}
