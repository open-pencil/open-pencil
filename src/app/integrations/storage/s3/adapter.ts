import { extractFigThumbnailFromReader } from '@open-pencil/fig'

import { isTauri } from '@/app/tauri/env'

import {
  NAMESPACE_MARKER_BODY,
  STORAGE_DOCUMENTS_PREFIX,
  STORAGE_NAMESPACE,
  STORAGE_NAMESPACE_MARKER,
  documentFigKey,
  documentIdFromFigKey,
  documentMetaKey,
  documentThumbnailKey
} from '../namespace'
import type {
  StorageAdapter,
  StorageDocument,
  StorageDocumentMetadata,
  StorageProviderRuntime
} from '../types'
import {
  S3HttpError,
  deleteObject,
  getObject,
  getObjectValue,
  getObjectRange,
  headObject,
  headObjectSize,
  listObjects,
  putObject
} from './client'
import { CloudCORSError, formatBrowserCORSHelpMessage, isLikelyCORSOrNetworkError } from './cors'
import type { S3CompatibleConfig, S3ConnectionResult } from './types'

const ENDPOINT_FIELD = 'endpoint'
const BUCKET_FIELD = 'bucket'
const REGION_FIELD = 'region'
const ACCESS_KEY_FIELD = 'access-key-id'
const SECRET_KEY_FIELD = 'secret-access-key'

function requiredPreference(runtime: StorageProviderRuntime, field: string): string {
  const value = runtime.preferences[field]?.trim()
  if (!value) throw new Error(`S3 ${field} is required`)
  return value
}

async function resolveConfig(runtime: StorageProviderRuntime): Promise<S3CompatibleConfig> {
  const [accessKeyId, secretAccessKey] = await Promise.all([
    runtime.resolveCredential(ACCESS_KEY_FIELD),
    runtime.resolveCredential(SECRET_KEY_FIELD)
  ])
  if (!accessKeyId || !secretAccessKey) throw new Error('S3 credentials are required')

  const region = runtime.preferences[REGION_FIELD]?.trim()
  return {
    endpoint: requiredPreference(runtime, ENDPOINT_FIELD),
    bucket: requiredPreference(runtime, BUCKET_FIELD),
    accessKeyId,
    secretAccessKey,
    ...(region ? { region } : {})
  }
}

function parseMetadata(
  bytes: Uint8Array | null,
  fallback: StorageDocumentMetadata
): { metadata: StorageDocumentMetadata; authoritative: boolean } {
  if (!bytes) return { metadata: fallback, authoritative: false }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<StorageDocumentMetadata>
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : null
    const updatedAt =
      typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : null
    return {
      metadata: {
        name: name ?? fallback.name,
        updatedAt: updatedAt ?? fallback.updatedAt
      },
      authoritative: name !== null && updatedAt !== null
    }
  } catch {
    return { metadata: fallback, authoritative: false }
  }
}

function connectionErrorMessage(error: unknown, isCORS: boolean): string {
  if (isCORS) return formatBrowserCORSHelpMessage()
  return error instanceof Error ? error.message : String(error)
}

async function ensureNamespace(config: S3CompatibleConfig): Promise<void> {
  if (await headObject(config, STORAGE_NAMESPACE_MARKER)) return
  try {
    await putObject(config, STORAGE_NAMESPACE_MARKER, NAMESPACE_MARKER_BODY, 'application/json')
  } catch (error) {
    if (error instanceof S3HttpError && (error.status === 403 || error.status === 401)) {
      throw new Error('Cannot write to this bucket. Check access permissions and bucket name.')
    }
    throw error
  }
}

export interface S3StorageAdapter extends StorageAdapter {
  testConnection(): Promise<S3ConnectionResult>
}

export function createS3StorageAdapter(runtime: StorageProviderRuntime): S3StorageAdapter {
  return {
    async testConnection() {
      const config = await resolveConfig(runtime)
      try {
        await ensureNamespace(config)
        await listObjects(config, STORAGE_DOCUMENTS_PREFIX)
      } catch (error) {
        const isCORS =
          error instanceof CloudCORSError || (!isTauri() && isLikelyCORSOrNetworkError(error))
        return {
          ok: false,
          message: connectionErrorMessage(error, isCORS),
          corsApplied: false,
          isCORSFailure: isCORS,
          corsError: null
        }
      }

      return {
        ok: true,
        message: 'Connected. Storage namespace is ready.',
        corsApplied: false,
        isCORSFailure: false,
        corsError: null
      }
    },

    async listDocuments() {
      const config = await resolveConfig(runtime)
      const objects = await listObjects(config, STORAGE_DOCUMENTS_PREFIX)
      const entries = objects
        .map((object) => {
          const id = documentIdFromFigKey(object.key)
          return id ? { id, lastModified: object.lastModified } : null
        })
        .filter((entry): entry is { id: string; lastModified: string | null } => entry !== null)

      const documents: StorageDocument[] = []
      // Bound sidecar reads so large buckets do not open hundreds of requests at once.
      for (let offset = 0; offset < entries.length; offset += 12) {
        const batch = entries.slice(offset, offset + 12)
        documents.push(
          ...(await Promise.all(
            batch.map(async ({ id, lastModified }) => {
              const fallback = {
                name: id,
                updatedAt: lastModified ?? new Date(0).toISOString()
              }
              const metadataBytes = await getObject(config, documentMetaKey(id)).catch(
                (error: unknown) => {
                  console.warn('[Storage] Document metadata fetch failed:', id, error)
                  return null
                }
              )
              const { metadata, authoritative } = parseMetadata(metadataBytes, fallback)
              return {
                id,
                ...metadata,
                metadataAuthoritative: authoritative
              } satisfies StorageDocument
            })
          ))
        )
      }
      return documents.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    },

    async getDocument(id, onProgress) {
      const config = await resolveConfig(runtime)
      const bytes = await getObject(
        config,
        documentFigKey(id),
        onProgress
          ? (progress) =>
              onProgress({
                transferredBytes: progress.receivedBytes,
                totalBytes: progress.totalBytes
              })
          : undefined
      )
      if (!bytes) throw new Error(`Document not found: ${id}`)
      return bytes
    },

    async putDocument(id, bytes, metadata, onProgress) {
      const config = await resolveConfig(runtime)
      await putObject(
        config,
        documentFigKey(id),
        bytes,
        'application/octet-stream',
        onProgress
          ? (progress) =>
              onProgress({
                transferredBytes: progress.sentBytes,
                totalBytes: progress.totalBytes
              })
          : undefined
      )
      await putObject(
        config,
        documentMetaKey(id),
        JSON.stringify({
          name: metadata.name,
          updatedAt: metadata.updatedAt || new Date().toISOString()
        }),
        'application/json'
      )
    },

    async getDocumentMetadata(id) {
      const config = await resolveConfig(runtime)
      const bytes = await getObject(config, documentMetaKey(id))
      if (!bytes) return null
      const parsed = parseMetadata(bytes, {
        name: id,
        updatedAt: new Date(0).toISOString()
      })
      return parsed.authoritative ? parsed.metadata : null
    },

    async deleteDocument(id) {
      const config = await resolveConfig(runtime)
      const results = await Promise.allSettled([
        deleteObject(config, documentFigKey(id)),
        deleteObject(config, documentMetaKey(id)),
        deleteObject(config, documentThumbnailKey(id))
      ])
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      )
      if (failure) throw failure.reason
    },

    async getUsage() {
      const config = await resolveConfig(runtime)
      const objects = await listObjects(config, `${STORAGE_NAMESPACE}/`)
      return {
        bytesUsed: objects.reduce((total, object) => total + (object.size ?? 0), 0),
        objectCount: objects.length,
        documentCount: objects.filter((object) => documentIdFromFigKey(object.key)).length
      }
    },

    async putThumbnail(id, bytes) {
      const config = await resolveConfig(runtime)
      await putObject(config, documentThumbnailKey(id), bytes, 'image/jpeg')
    },

    async getThumbnail(id) {
      const config = await resolveConfig(runtime)
      const figKey = documentFigKey(id)
      const size = await headObjectSize(config, figKey)
      if (size == null) return null
      return extractFigThumbnailFromReader({
        size,
        async read(start: number, endExclusive: number) {
          return (await getObjectRange(config, figKey, start, endExclusive)) ?? new Uint8Array()
        }
      })
    },

    libraryObjects: {
      async getObject(key) {
        return getObject(await resolveConfig(runtime), key)
      },
      async getObjectValue(key) {
        return getObjectValue(await resolveConfig(runtime), key)
      },
      async putObject(key, bytes, contentType, options) {
        try {
          await putObject(await resolveConfig(runtime), key, bytes, contentType, undefined, options)
        } catch (error) {
          if (error instanceof S3HttpError && (error.status === 409 || error.status === 412)) {
            throw new Error('Library revision conflict: latest revision has changed')
          }
          throw error
        }
      },
      async listObjects(prefix) {
        return (await listObjects(await resolveConfig(runtime), prefix)).map((object) => ({
          key: object.key,
          size: object.size,
          etag: null
        }))
      }
    }
  }
}
