import type { StorageDocumentMetadata } from './types'

export type ParsedStorageDocumentMetadata = {
  metadata: StorageDocumentMetadata
  authoritative: boolean
}

/**
 * What a document is called when its sidecar cannot say.
 *
 * Every caller of `parseStorageDocumentMetadata` needs the same floor: the id
 * as a name, the epoch as a timestamp so any real write wins, and no trash
 * state. Spelled out per call site, one of them would eventually disagree and
 * a metadata read would start inventing a different document.
 */
export function fallbackDocumentMetadata(id: string): StorageDocumentMetadata {
  return {
    name: id,
    updatedAt: new Date(0).toISOString(),
    sourceFormat: 'fig',
    trashedAt: null
  }
}

export function parseStorageDocumentMetadata(
  bytes: Uint8Array | null,
  fallback: StorageDocumentMetadata
): ParsedStorageDocumentMetadata {
  if (!bytes) return { metadata: fallback, authoritative: false }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<StorageDocumentMetadata>
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : null
    const updatedAt =
      typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : null
    const sourceFormat = parsed.sourceFormat === 'deck' ? 'deck' : 'fig'
    const trashedAt = typeof parsed.trashedAt === 'string' ? parsed.trashedAt : null
    const bodyId = typeof parsed.bodyId === 'string' && parsed.bodyId ? parsed.bodyId : undefined
    const stateId =
      typeof parsed.stateId === 'string' && parsed.stateId ? parsed.stateId : undefined
    return {
      metadata: {
        name: name ?? fallback.name,
        updatedAt: updatedAt ?? fallback.updatedAt,
        sourceFormat,
        trashedAt,
        bodyId,
        stateId
      },
      authoritative: name !== null && updatedAt !== null
    }
  } catch {
    return { metadata: fallback, authoritative: false }
  }
}

export function serializeStorageDocumentMetadata(metadata: StorageDocumentMetadata): string {
  return JSON.stringify({
    name: metadata.name,
    updatedAt: metadata.updatedAt || new Date().toISOString(),
    sourceFormat: metadata.sourceFormat,
    trashedAt: metadata.trashedAt,
    // Optional identity fields: omitted entirely when unknown, so pre-identity
    // readers see exactly the old shape.
    ...(metadata.bodyId ? { bodyId: metadata.bodyId } : {}),
    ...(metadata.stateId ? { stateId: metadata.stateId } : {})
  })
}
