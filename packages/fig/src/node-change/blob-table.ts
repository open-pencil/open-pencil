import { bytesToHex } from './bytes'

/**
 * Index of blob bytes (hex) to the position that blob already occupies in the
 * exported blob table.
 */
export type BlobIndex = Map<string, number>

/**
 * Append `bytes` to the export blob table, reusing an identical blob when one
 * was already written.
 *
 * Every blob reference in a .fig file is a plain index into `blobs`, so two
 * callers that produce the same bytes are interchangeable and may share a
 * single entry. Routing all pushes through here is what keeps that true: the
 * glyph outlines and the raw Figma payload used to keep *separate* dedupe maps,
 * so every glyph blob was written once per map and each export carried two
 * byte-identical copies of every blob.
 *
 * Callers without an index (tests and one-off serializations) still get correct
 * output, just without dedupe.
 */
export function appendBlob(
  blobs: Uint8Array[],
  blobIndex: BlobIndex | undefined,
  bytes: Uint8Array
): number {
  if (!blobIndex) return blobs.push(bytes) - 1
  const key = bytesToHex(bytes)
  const existing = blobIndex.get(key)
  if (existing !== undefined) return existing
  const index = blobs.push(bytes) - 1
  blobIndex.set(key, index)
  return index
}
