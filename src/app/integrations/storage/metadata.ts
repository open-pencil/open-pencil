import type { StorageDocumentMetadata } from './types'

export type ParsedStorageDocumentMetadata = {
  metadata: StorageDocumentMetadata
  authoritative: boolean
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
    return {
      metadata: {
        name: name ?? fallback.name,
        updatedAt: updatedAt ?? fallback.updatedAt,
        sourceFormat,
        trashedAt
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
    trashedAt: metadata.trashedAt
  })
}
