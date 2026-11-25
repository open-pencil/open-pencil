import * as v from 'valibot'

import {
  COMPONENT_LIBRARY_SCHEMA_VERSION,
  deserializeLibraryRevision,
  storedLibraryLatestManifestSchema,
  storedLibraryRevisionSchema,
  type ComponentLibraryRevision,
  type StoredLibraryLatestManifest
} from '@open-pencil/core/library'

import { LibraryContentInvalidError } from '@/app/libraries/errors'

const textDecoder = new TextDecoder()

const revisionSchema = v.pipe(v.string(), v.parseJson(), storedLibraryRevisionSchema)

const latestManifestSchema = v.pipe(v.string(), v.parseJson(), storedLibraryLatestManifestSchema)

/** A manifest an earlier version wrote, whose revisions this one cannot read. */
const earlierManifestSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ schemaVersion: v.pipe(v.number(), v.maxValue(COMPONENT_LIBRARY_SCHEMA_VERSION - 1)) })
)

/**
 * The manifest object a remote `manifest.json` carries. One an earlier schema published
 * decodes to `null` — such a library is left out until it is published again, which
 * replaces it; anything else malformed throws.
 */
export function decodeLatestManifest(bytes: Uint8Array): StoredLibraryLatestManifest | null {
  const text = textDecoder.decode(bytes)
  const parsed = v.safeParse(latestManifestSchema, text)
  if (parsed.success) return parsed.output
  if (v.safeParse(earlierManifestSchema, text).success) return null
  throw new LibraryContentInvalidError('Invalid component library manifest')
}

/** A stored revision body. Malformed bytes or schema mismatches throw. */
export function decodeStoredRevision(bytes: Uint8Array): ComponentLibraryRevision {
  const parsed = v.safeParse(revisionSchema, textDecoder.decode(bytes))
  if (!parsed.success) {
    throw new LibraryContentInvalidError(
      `Invalid component library revision: ${v.summarize(parsed.issues)}`
    )
  }
  return deserializeLibraryRevision(parsed.output)
}
