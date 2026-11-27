/**
 * The shared S3-style object layout for stored component libraries. The remote catalog and
 * the sync engine's probe spell these keys the same way. The layout lives beside
 * `LibraryObjectStore` — the storage domain owns the wire format and the libraries domain
 * consumes it, never the reverse.
 */

export const LIBRARY_PREFIX = 'open-pencil/libraries'

const MANIFEST_SUFFIX = '/manifest.json'
const REVISIONS_MARKER = '/revisions/'
const REVISION_SUFFIX = '.json'

export function latestKey(libraryId: string): string {
  return `${LIBRARY_PREFIX}/${libraryId}${MANIFEST_SUFFIX}`
}

export function revisionKey(libraryId: string, revisionId: string): string {
  return `${LIBRARY_PREFIX}/${libraryId}${REVISIONS_MARKER}${revisionId}${REVISION_SUFFIX}`
}

export type ParsedLibraryKey =
  | { kind: 'latest'; libraryId: string }
  | { kind: 'revision'; libraryId: string; revisionId: string }

/** The library and kind a key under `LIBRARY_PREFIX` names, or `null` for any other key. */
export function parseLibraryKey(key: string): ParsedLibraryKey | null {
  const start = `${LIBRARY_PREFIX}/`
  if (!key.startsWith(start)) return null
  const rest = key.slice(start.length)
  if (rest.endsWith(MANIFEST_SUFFIX)) {
    const libraryId = rest.slice(0, -MANIFEST_SUFFIX.length)
    return libraryId ? { kind: 'latest', libraryId } : null
  }
  const marker = rest.indexOf(REVISIONS_MARKER)
  if (marker <= 0 || !rest.endsWith(REVISION_SUFFIX)) return null
  const revisionId = rest.slice(marker + REVISIONS_MARKER.length, -REVISION_SUFFIX.length)
  return revisionId ? { kind: 'revision', libraryId: rest.slice(0, marker), revisionId } : null
}
