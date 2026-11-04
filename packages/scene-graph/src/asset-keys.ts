import { sha1 } from '@noble/hashes/legacy.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

/**
 * A key shaped as Figma's asset keys, 40 hex digits, derived from `seed` so the same seed always
 * gives the same key. The Figma clipboard names variables and collections by key; one made in
 * OpenPencil has none, so copying it gives it this one, and copying it again gives the same.
 */
export function derivedAssetKey(seed: string): string {
  return bytesToHex(sha1(utf8ToBytes(seed)))
}

/** Largest part of a Figma GUID, which Figma reads as a signed 32-bit integer. */
const MAX_GUID_PART = 0x7fffffff

/**
 * A version shaped as Figma's asset versions, `session:local`, derived from `content` so that
 * copying an unchanged asset again gives the same version and copying a changed one gives another.
 * Figma keeps the first value it pasted for a key and version, so a version that stayed the same
 * across an edit would bring the old value back.
 */
export function derivedAssetVersion(content: string): string {
  const view = new DataView(sha1(utf8ToBytes(content)).buffer)
  return `${view.getUint32(0) & MAX_GUID_PART}:${view.getUint32(4) & MAX_GUID_PART}`
}
