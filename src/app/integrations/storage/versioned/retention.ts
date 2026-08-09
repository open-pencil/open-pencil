import { HEAD_HISTORY_LIMIT } from './head'

/**
 * The named retention policy, in one place: every delete path and the GC
 * sweep derive from these, never from ad hoc constants.
 *
 * Retained versions per document are exactly the head's history chain; the
 * safety window bounds how long unreferenced objects survive (in-flight
 * commits legitimately create young orphans).
 */
export const RETAINED_VERSIONS_PER_DOCUMENT = HEAD_HISTORY_LIMIT

/** Objects younger than this are never deleted, referenced or not. */
export const GC_SAFETY_WINDOW_MS = 24 * 60 * 60 * 1000

export function isOldEnoughToDelete(lastModified: string | null, nowMs: number): boolean {
  if (!lastModified) return false
  const modified = Date.parse(lastModified)
  if (!Number.isFinite(modified)) return false
  return nowMs - modified >= GC_SAFETY_WINDOW_MS
}
