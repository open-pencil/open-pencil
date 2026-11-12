import type { DriftReference } from './schema'

/** How a page stands to the picture kept for it. */
export type DriftState = 'none' | 'same' | 'changed'

/**
 * The digest of a picture's bytes. The comparison needs only this, so the baseline stays one small
 * line per frame and two pictures are never held in memory to be compared.
 */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  // A copy owns a plain buffer, which the digest accepts whatever the caller passed.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const hash = await crypto.subtle.digest('SHA-256', copy)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Whether a page still looks like its baseline: `none` when no picture was kept for it, `same`
 * when the new picture has the same digest, and `changed` when it does not.
 */
export function compareReference(stored: DriftReference | undefined, digest: string): DriftState {
  if (!stored) return 'none'
  return stored.digest === digest ? 'same' : 'changed'
}
