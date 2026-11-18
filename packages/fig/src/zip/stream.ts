import { Zip, ZipDeflate, ZipPassThrough } from 'fflate'

/** A file a streamed archive holds, deflated or stored as given. */
export interface ZipStreamEntry {
  name: string
  data: Uint8Array
  deflate?: boolean
}

/** How much of an entry is handed on at a time, so a large image never moves as one piece. */
const CHUNK_BYTES = 1024 * 1024

function* zipChunks(entries: readonly ZipStreamEntry[]): Generator<Uint8Array> {
  const pending: Uint8Array[] = []
  const zip = new Zip((error, chunk) => {
    if (error) throw error
    pending.push(chunk)
  })
  for (const entry of entries) {
    const file = entry.deflate ? new ZipDeflate(entry.name) : new ZipPassThrough(entry.name)
    zip.add(file)
    let start = 0
    do {
      const end = Math.min(start + CHUNK_BYTES, entry.data.byteLength)
      file.push(entry.data.subarray(start, end), end === entry.data.byteLength)
      yield* pending.splice(0)
      start = end
    } while (start < entry.data.byteLength)
  }
  zip.end()
  yield* pending.splice(0)
}

/** The chunks of `iterator`, each produced only when the stream's reader asks for it. */
export function pullStream(iterator: Iterator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const next = iterator.next()
        if (next.done) controller.close()
        else controller.enqueue(next.value)
      },
      cancel() {
        iterator.return?.()
      }
    },
    { highWaterMark: 0 }
  )
}

/**
 * A ZIP archive of `entries`, written as its reader asks for it. Stored entries pass through as
 * views of the bytes given, with data descriptors after them as Figma's own archives have, so
 * writing one costs the file's bytes once rather than a second copy of them.
 */
export function zipStream(entries: readonly ZipStreamEntry[]): ReadableStream<Uint8Array> {
  return pullStream(zipChunks(entries))
}

function* byteChunks(bytes: Uint8Array): Generator<Uint8Array> {
  for (let start = 0; start < bytes.byteLength; start += CHUNK_BYTES) {
    yield bytes.subarray(start, start + CHUNK_BYTES)
  }
}

/** Bytes already in memory as a stream of views of them. */
export function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return pullStream(byteChunks(bytes))
}

/** A stream's bytes in one buffer, for callers that need the whole file. */
export async function readStreamBytes(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
