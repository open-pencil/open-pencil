import { parseStorageDocumentMetadata, serializeStorageDocumentMetadata } from '../metadata'
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
import { storageThumbnailMimeType } from '../thumbnail'
import type {
  StorageAdapter,
  StorageDocument,
  StorageDocumentMetadata,
  StorageProviderRuntime
} from '../types'
import {
  AppwriteHttpError,
  createBucket,
  deleteObject,
  getObject,
  headObject,
  listBuckets,
  listObjects,
  putObject,
  withAppwritePlatformBootstrap
} from './client'
import { resolveAppwriteConfig, type AppwriteConfig } from './config'

const DEFAULT_BUCKET_ID = 'openpencil'
const DEFAULT_BUCKET_NAME = 'OpenPencil'

export type AppwriteConfigResolver = () => Promise<AppwriteConfig>

/**
 * Guidance followed by the provider's own words.
 *
 * Substituting a friendly sentence for the raw message used to destroy the only
 * actionable part of it: `missing scopes (["buckets.read"])` names the exact
 * scope, where the guidance can only list all of them. Keep both — the sentence
 * says what to do, the detail says precisely what failed.
 */
function withProviderDetail(guidance: string, detail: string | null | undefined): string {
  const trimmed = detail?.trim()
  return trimmed ? `${guidance}\n\n${trimmed}` : guidance
}

function connectionErrorMessage(error: unknown): string {
  if (error instanceof AppwriteHttpError) {
    const detail = error.type ? `${error.message} (${error.type})` : error.message
    if (error.type === 'storage_bucket_not_found') {
      return withProviderDetail(
        "Bucket not found. Enter the bucket ID from the Appwrite console — that is the generated ID, not the bucket's display name.",
        detail
      )
    }
    if (error.type === 'general_unauthorized_scope') {
      return withProviderDetail(
        'The API key needs platforms, buckets, and files read/write scopes.',
        detail
      )
    }
    return detail
  }
  if (error instanceof TypeError) {
    return withProviderDetail(
      'Could not reach Appwrite. Check the endpoint and platforms.read/write scopes.',
      error.message
    )
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Bucket-management calls (`listBuckets`, `createBucket`) are ADMIN operations.
 * They ignore a bucket's own permission rows and require an API key with admin
 * scope — which a browser origin never gets, because Appwrite resolves such
 * requests to the `guests` role regardless of `X-Appwrite-Key`.
 *
 * File operations are different: they honour the bucket's Read/Write rows, so
 * naming the bucket keeps the whole adapter on paths a browser can actually use.
 *
 * The discovery call used to run BEFORE the `config.bucketId` check, so even a
 * user who supplied their bucket ID hit the admin call and failed with
 * `missing scopes (["buckets.read"])`.
 */
async function selectOrCreateBucket(config: AppwriteConfig): Promise<string> {
  if (config.bucketId) return config.bucketId

  let buckets: Awaited<ReturnType<typeof listBuckets>>
  try {
    buckets = await withAppwritePlatformBootstrap(config, () => listBuckets(config))
  } catch (error) {
    if (error instanceof AppwriteHttpError && error.type === 'general_unauthorized_scope') {
      throw new Error(
        withProviderDetail(
          'Enter your Bucket ID. Discovering or creating a bucket needs admin access, which is not available from a browser — but OpenPencil can use a bucket you name directly.',
          `${error.message} (${error.type})`
        )
      )
    }
    throw error
  }

  const named = buckets.find(
    (bucket) =>
      bucket.$id === DEFAULT_BUCKET_ID ||
      bucket.name.toLowerCase() === DEFAULT_BUCKET_NAME.toLowerCase()
  )
  if (named) return named.$id
  if (buckets.length === 1) return buckets[0]?.$id ?? DEFAULT_BUCKET_ID
  if (buckets.length === 0) {
    return (await createBucket(config, DEFAULT_BUCKET_ID, DEFAULT_BUCKET_NAME)).$id
  }
  throw new Error('Multiple Appwrite buckets found. Enter the bucket ID OpenPencil should use.')
}

async function ensureNamespace(config: AppwriteConfig, bucketId: string): Promise<void> {
  if (await headObject(config, bucketId, STORAGE_NAMESPACE_MARKER)) return
  await putObject(
    config,
    bucketId,
    STORAGE_NAMESPACE_MARKER,
    new TextEncoder().encode(NAMESPACE_MARKER_BODY),
    'application/json'
  )
}

async function writeDocumentMetadata(
  config: AppwriteConfig,
  bucketId: string,
  id: string,
  metadata: StorageDocumentMetadata
): Promise<void> {
  await putObject(
    config,
    bucketId,
    documentMetaKey(id),
    new TextEncoder().encode(serializeStorageDocumentMetadata(metadata)),
    'application/json'
  )
}

export function createAppwriteStorageAdapterWithConfig(
  resolveConfig: AppwriteConfigResolver
): StorageAdapter {
  let selectedBucketId: string | null = null

  async function resolveStorage(): Promise<{ config: AppwriteConfig; bucketId: string }> {
    const config = await resolveConfig()
    selectedBucketId ??= await selectOrCreateBucket(config)
    return { config, bucketId: selectedBucketId }
  }

  return {
    async testConnection() {
      try {
        const { config, bucketId } = await resolveStorage()
        await ensureNamespace(config, bucketId)
        await listObjects(config, bucketId, STORAGE_DOCUMENTS_PREFIX)
        return { ok: true, message: 'Connected. Appwrite storage is ready.' }
      } catch (error) {
        return { ok: false, message: connectionErrorMessage(error) }
      }
    },

    async listDocuments() {
      const { config, bucketId } = await resolveStorage()
      const objects = await listObjects(config, bucketId, STORAGE_DOCUMENTS_PREFIX)
      const entries = objects
        .map((object) => {
          const id = documentIdFromFigKey(object.key)
          return id ? { id, lastModified: object.lastModified } : null
        })
        .filter((entry): entry is { id: string; lastModified: string } => entry !== null)

      const documents: StorageDocument[] = []
      for (let offset = 0; offset < entries.length; offset += 12) {
        documents.push(
          ...(await Promise.all(
            entries.slice(offset, offset + 12).map(async ({ id, lastModified }) => {
              const fallback: StorageDocumentMetadata = {
                name: id,
                updatedAt: lastModified || new Date(0).toISOString(),
                sourceFormat: 'fig',
                trashedAt: null
              }
              const metadataBytes = await getObject(config, bucketId, documentMetaKey(id)).catch(
                (error: unknown) => {
                  console.warn('[Storage] Appwrite metadata fetch failed:', id, error)
                  return null
                }
              )
              const { metadata, authoritative } = parseStorageDocumentMetadata(
                metadataBytes,
                fallback
              )
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
      const { config, bucketId } = await resolveStorage()
      const bytes = await getObject(
        config,
        bucketId,
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
      const { config, bucketId } = await resolveStorage()
      await putObject(
        config,
        bucketId,
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
      await writeDocumentMetadata(config, bucketId, id, metadata)
    },

    async putDocumentMetadata(id, metadata) {
      const { config, bucketId } = await resolveStorage()
      await writeDocumentMetadata(config, bucketId, id, metadata)
    },

    async getDocumentMetadata(id) {
      const { config, bucketId } = await resolveStorage()
      const bytes = await getObject(config, bucketId, documentMetaKey(id))
      if (!bytes) return null
      const parsed = parseStorageDocumentMetadata(bytes, {
        name: id,
        updatedAt: new Date(0).toISOString(),
        sourceFormat: 'fig',
        trashedAt: null
      })
      return parsed.authoritative ? parsed.metadata : null
    },

    async deleteDocument(id) {
      const { config, bucketId } = await resolveStorage()
      const results = await Promise.allSettled([
        deleteObject(config, bucketId, documentFigKey(id)),
        deleteObject(config, bucketId, documentMetaKey(id)),
        deleteObject(config, bucketId, documentThumbnailKey(id))
      ])
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      )
      if (failure) throw failure.reason
    },

    async getUsage() {
      const { config, bucketId } = await resolveStorage()
      const objects = await listObjects(config, bucketId, `${STORAGE_NAMESPACE}/`)
      return {
        bytesUsed: objects.reduce((total, object) => total + object.size, 0),
        objectCount: objects.length,
        documentCount: objects.filter((object) => documentIdFromFigKey(object.key)).length
      }
    },

    async putThumbnail(id, bytes) {
      const { config, bucketId } = await resolveStorage()
      await putObject(
        config,
        bucketId,
        documentThumbnailKey(id),
        bytes,
        storageThumbnailMimeType(bytes)
      )
    },

    async getThumbnail(id) {
      const { config, bucketId } = await resolveStorage()
      return getObject(config, bucketId, documentThumbnailKey(id))
    }
  }
}

export function createAppwriteStorageAdapter(runtime: StorageProviderRuntime): StorageAdapter {
  return createAppwriteStorageAdapterWithConfig(() => resolveAppwriteConfig(runtime))
}
