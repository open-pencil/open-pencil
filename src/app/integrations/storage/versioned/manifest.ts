import * as v from 'valibot'

import { parseStorageDocumentMetadataValue, storageDocumentMetadataValue } from '../metadata'
import type { StorageDocumentMetadata } from '../types'

export const VERSION_MANIFEST_SCHEMA = 1

/**
 * Immutable description of one committed document state: which body holds the bytes and the
 * metadata that state represents. It is written before the head, so a head that names a stateId
 * always resolves to a manifest whose body already exists.
 */
export type VersionManifest = {
  schema: typeof VERSION_MANIFEST_SCHEMA
  bodyId: string
  metadata: StorageDocumentMetadata
}

export type ParsedVersionManifest = {
  manifest: VersionManifest
  authoritative: boolean
}

const VersionManifestJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    schema: v.literal(VERSION_MANIFEST_SCHEMA),
    bodyId: v.pipe(v.string(), v.nonEmpty()),
    metadata: v.record(v.string(), v.unknown())
  })
)

export function serializeVersionManifest(manifest: VersionManifest): string {
  return JSON.stringify({
    schema: manifest.schema,
    bodyId: manifest.bodyId,
    metadata: storageDocumentMetadataValue(manifest.metadata)
  })
}

export function parseVersionManifest(
  bytes: Uint8Array | null,
  fallback: StorageDocumentMetadata
): ParsedVersionManifest | null {
  if (!bytes) return null
  const parsed = v.safeParse(VersionManifestJSON, new TextDecoder().decode(bytes))
  if (!parsed.success) return null
  // The sidecar's own rules validate the embedded metadata, so the two readers cannot drift.
  const { metadata, authoritative } = parseStorageDocumentMetadataValue(
    parsed.output.metadata,
    fallback
  )
  return {
    manifest: { schema: VERSION_MANIFEST_SCHEMA, bodyId: parsed.output.bodyId, metadata },
    authoritative
  }
}
