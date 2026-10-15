import { chunk, uniq } from 'es-toolkit'

import { fallbackDocumentMetadata, parseStorageDocumentMetadata } from '../metadata'
import {
  STORAGE_DOCUMENTS_PREFIX,
  documentIdFromFigKey,
  documentIdFromHeadKey,
  documentMetaKey
} from '../namespace'
import type { StorageDocument, StorageDocumentMetadata } from '../types'
import { s3ResolveVersion } from '../versioned/s3'
import { getObject, listObjects } from './client'
import type { S3CompatibleConfig } from './types'

/** Bound head and sidecar reads so a large bucket does not open hundreds of requests at once. */
const READ_BATCH = 12

function fallbackFor(id: string, lastModified: string | null | undefined): StorageDocumentMetadata {
  const fallback = fallbackDocumentMetadata(id)
  return lastModified ? { ...fallback, updatedAt: lastModified } : fallback
}

/** A versioned document, or null when its head does not resolve to a manifest. */
export async function readVersionedDocument(
  config: S3CompatibleConfig,
  id: string,
  fallback: StorageDocumentMetadata = fallbackDocumentMetadata(id)
): Promise<StorageDocument | null> {
  const version = await s3ResolveVersion(config, id, fallback)
  if (!version) return null
  return {
    id,
    ...version.manifest.metadata,
    bodyId: version.manifest.bodyId,
    stateId: version.head.stateId,
    metadataAuthoritative: version.authoritative,
    versioned: true,
    history: version.head.history
  }
}

/** A legacy document: one `.fig` and its `.meta.json` sidecar. */
export async function readLegacyDocument(
  config: S3CompatibleConfig,
  id: string,
  fallback: StorageDocumentMetadata = fallbackDocumentMetadata(id)
): Promise<StorageDocument> {
  const bytes = await getObject(config, documentMetaKey(id)).catch((error: unknown) => {
    console.warn('[Storage] Document metadata fetch failed:', id, error)
    return null
  })
  const { metadata, authoritative } = parseStorageDocumentMetadata(bytes, fallback)
  return { id, ...metadata, metadataAuthoritative: authoritative, versioned: false }
}

/**
 * One listing of `canvases/` sees both layouts: heads name versioned documents, `.fig` keys name
 * legacy ones, and a head wins for its id. Legacy objects stay until the document is deleted.
 */
export async function listS3Documents(config: S3CompatibleConfig): Promise<StorageDocument[]> {
  const objects = await listObjects(config, STORAGE_DOCUMENTS_PREFIX)
  const versionedIds = new Set<string>()
  const legacyLastModified = new Map<string, string | null>()
  for (const object of objects) {
    const headId = documentIdFromHeadKey(object.key)
    if (headId) {
      versionedIds.add(headId)
      continue
    }
    const figId = documentIdFromFigKey(object.key)
    if (figId) legacyLastModified.set(figId, object.lastModified)
  }

  const ids = uniq([...versionedIds, ...legacyLastModified.keys()])
  const documents: StorageDocument[] = []
  for (const batch of chunk(ids, READ_BATCH)) {
    const read = await Promise.all(
      batch.map(async (id): Promise<StorageDocument | null> => {
        const fallback = fallbackFor(id, legacyLastModified.get(id))
        if (versionedIds.has(id)) {
          const versioned = await readVersionedDocument(config, id, fallback).catch(
            (error: unknown) => {
              console.warn('[Storage] Versioned head fetch failed:', id, error)
              return null
            }
          )
          if (versioned) return versioned
          // A head that does not resolve, with no legacy body behind it, is no readable document.
          if (!legacyLastModified.has(id)) return null
        }
        return readLegacyDocument(config, id, fallback)
      })
    )
    documents.push(...read.filter((document): document is StorageDocument => document !== null))
  }
  return documents.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}
