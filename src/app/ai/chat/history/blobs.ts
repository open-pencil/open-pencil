import { isPlainObject } from 'es-toolkit/predicate'
import * as v from 'valibot'

/**
 * WebKit's IndexedDB cannot store Blobs in private contexts, such as Safari Private Browsing,
 * and aborts the whole write ("Error preparing Blob/File data to be stored in object store"),
 * so attachment previews and tool change images would stop every later save. Conversations
 * are stored with each Blob as its type and bytes instead, which every engine can store.
 */
const StoredBlob = v.object({
  storedBlob: v.literal(true),
  type: v.string(),
  bytes: v.instance(ArrayBuffer)
})

/** `value` with every Blob in it, at any depth of arrays and plain objects, as its bytes. */
export async function toStorableBlobs(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return { storedBlob: true, type: value.type, bytes: await value.arrayBuffer() }
  }
  if (Array.isArray(value)) return Promise.all(value.map(toStorableBlobs))
  if (!isPlainObject(value)) return value
  const entries = await Promise.all(
    Object.entries(value).map(async ([key, entry]) => [key, await toStorableBlobs(entry)] as const)
  )
  return Object.fromEntries(entries)
}

/** The inverse of `toStorableBlobs`; Blobs stored before it existed are kept as they are. */
export function fromStorableBlobs(value: unknown): unknown {
  if (v.is(StoredBlob, value)) return new Blob([value.bytes], { type: value.type })
  if (Array.isArray(value)) return value.map(fromStorableBlobs)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, fromStorableBlobs(entry)])
  )
}
