/**
 * A view of the same bytes the DOM and File System Access API accept. A typed array over a
 * `SharedArrayBuffer` is copied; everything an export produces is backed by an `ArrayBuffer` and
 * stays a view, so a save never duplicates a chunk.
 */
export function bufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new Uint8Array(bytes)
}
