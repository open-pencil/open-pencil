import { parseStorageDocumentMetadata } from '../metadata'
import type { StorageDocumentMetadata } from '../types'

export const VERSION_MANIFEST_SCHEMA = 1

/**
 * Immutable description of one committed document state: which body carries
 * the bytes and the full metadata that state represents. Written BEFORE the
 * head update, so a head that names a stateId always resolves to a manifest
 * whose body already exists.
 */
export type VersionManifest = {
  schema: typeof VERSION_MANIFEST_SCHEMA
  bodyId: string
  metadata: StorageDocumentMetadata
}

export function serializeVersionManifest(manifest: VersionManifest): string {
  return JSON.stringify(manifest)
}

export type ParsedVersionManifest = {
  manifest: VersionManifest
  authoritative: boolean
}

export function parseVersionManifest(
  bytes: Uint8Array | null,
  fallback: StorageDocumentMetadata
): ParsedVersionManifest | null {
  if (!bytes) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      schema?: unknown
      bodyId?: unknown
      metadata?: unknown
    }
    if (parsed.schema !== VERSION_MANIFEST_SCHEMA) return null
    if (typeof parsed.bodyId !== 'string' || !parsed.bodyId) return null
    if (typeof parsed.metadata !== 'object' || parsed.metadata === null) return null
    // Validate the embedded metadata with the sidecar parser itself, so the
    // two readers can never drift on what a well-formed metadata object is.
    const { metadata, authoritative } = parseStorageDocumentMetadata(
      new TextEncoder().encode(JSON.stringify(parsed.metadata)),
      fallback
    )
    return {
      manifest: { schema: VERSION_MANIFEST_SCHEMA, bodyId: parsed.bodyId, metadata },
      authoritative
    }
  } catch {
    return null
  }
}
