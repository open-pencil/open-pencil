import * as v from 'valibot'

import type { StorageDocumentMetadata } from './types'

export type ParsedStorageDocumentMetadata = {
  metadata: StorageDocumentMetadata
  /** Both the name and the timestamp were stored; a fallback never overrides a real write. */
  authoritative: boolean
}

const optionalId = v.fallback(v.optional(v.pipe(v.string(), v.nonEmpty())), undefined)

/** Each field falls back on its own, so one malformed field never discards the rest. */
const MetadataFields = v.object({
  name: v.fallback(
    v.nullable(
      v.pipe(
        v.string(),
        v.check((name) => name.trim() !== '')
      )
    ),
    null
  ),
  updatedAt: v.fallback(v.nullable(v.pipe(v.string(), v.nonEmpty())), null),
  sourceFormat: v.fallback(v.picklist(['fig', 'deck']), 'fig'),
  trashedAt: v.fallback(v.nullable(v.string()), null),
  bodyId: optionalId,
  stateId: optionalId
})

const MetadataJSON = v.pipe(v.string(), v.parseJson(), MetadataFields)

/**
 * What a document is called when its metadata cannot say: the id as a name, the epoch as a
 * timestamp so any real write wins, and no trash state.
 */
export function fallbackDocumentMetadata(id: string): StorageDocumentMetadata {
  return {
    name: id,
    updatedAt: new Date(0).toISOString(),
    sourceFormat: 'fig',
    trashedAt: null
  }
}

type IdentityFields = Pick<StorageDocumentMetadata, 'bodyId' | 'stateId'>

/** Identity fields only when known: absence means unknown, never different. */
function identityFields(bodyId: string | undefined, stateId: string | undefined): IdentityFields {
  const fields: IdentityFields = {}
  if (bodyId) fields.bodyId = bodyId
  if (stateId) fields.stateId = stateId
  return fields
}

function fromFields(
  fields: v.InferOutput<typeof MetadataFields>,
  fallback: StorageDocumentMetadata
): ParsedStorageDocumentMetadata {
  return {
    metadata: {
      name: fields.name ?? fallback.name,
      updatedAt: fields.updatedAt ?? fallback.updatedAt,
      sourceFormat: fields.sourceFormat,
      trashedAt: fields.trashedAt,
      ...identityFields(fields.bodyId, fields.stateId)
    },
    authoritative: fields.name !== null && fields.updatedAt !== null
  }
}

/** A legacy `.meta.json` sidecar, read from storage. */
export function parseStorageDocumentMetadata(
  bytes: Uint8Array | null,
  fallback: StorageDocumentMetadata
): ParsedStorageDocumentMetadata {
  if (!bytes) return { metadata: fallback, authoritative: false }
  const parsed = v.safeParse(MetadataJSON, new TextDecoder().decode(bytes))
  if (!parsed.success) return { metadata: fallback, authoritative: false }
  return fromFields(parsed.output, fallback)
}

/** Metadata embedded in a version manifest, validated by the same rules as a sidecar. */
export function parseStorageDocumentMetadataValue(
  value: unknown,
  fallback: StorageDocumentMetadata
): ParsedStorageDocumentMetadata {
  const parsed = v.safeParse(MetadataFields, value)
  if (!parsed.success) return { metadata: fallback, authoritative: false }
  return fromFields(parsed.output, fallback)
}

export function serializeStorageDocumentMetadata(metadata: StorageDocumentMetadata): string {
  return JSON.stringify(storageDocumentMetadataValue(metadata))
}

/** The stored shape; identity fields are omitted when unknown, so older readers see no change. */
export function storageDocumentMetadataValue(metadata: StorageDocumentMetadata) {
  return {
    name: metadata.name,
    updatedAt: metadata.updatedAt || new Date().toISOString(),
    sourceFormat: metadata.sourceFormat,
    trashedAt: metadata.trashedAt,
    ...identityFields(metadata.bodyId, metadata.stateId)
  }
}
