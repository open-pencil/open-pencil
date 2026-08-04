import { isTauri } from '@/app/tauri/env'

import { parseStorageDocumentMetadata, serializeStorageDocumentMetadata } from '../metadata'
import {
  NAMESPACE_MARKER_BODY,
  STORAGE_DOCUMENTS_PREFIX,
  STORAGE_NAMESPACE,
  STORAGE_NAMESPACE_MARKER,
  bodyKey,
  documentFigKey,
  documentHeadKey,
  documentIdFromFigKey,
  documentIdFromHeadKey,
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
import { s3CollectGarbage } from '../versioned/gc'
import { s3CommitVersion, s3GetVersionedBody, s3ResolveVersion } from '../versioned/s3'
import {
  S3HttpError,
  deleteObject,
  getObject,
  headObject,
  listObjects,
  putObject,
  putObjectResumable
} from './client'
import { CloudCorsError, formatBrowserCorsHelpMessage, isLikelyCorsOrNetworkError } from './cors'
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

/** Guidance followed by the provider's own words — never instead of them. */
function withProviderDetail(guidance: string, detail: string | null | undefined): string {
  const trimmed = detail?.trim()
  return trimmed ? `${guidance}\n\n${trimmed}` : guidance
}

/** `<Code>` and status parsed from the S3 error body, discarded until now. */
function s3ErrorDetail(error: unknown): string | null {
  if (error instanceof S3HttpError) {
    const code = error.code ? `${error.code}: ` : ''
    return `${code}${error.message} (HTTP ${error.status})`
  }
  return error instanceof Error ? error.message : null
}

function connectionErrorMessage(error: unknown, isCors: boolean): string {
  if (isCors) return withProviderDetail(formatBrowserCorsHelpMessage(), s3ErrorDetail(error))
  return s3ErrorDetail(error) ?? String(error)
}

async function ensureNamespace(config: S3CompatibleConfig): Promise<void> {
  if (await headObject(config, STORAGE_NAMESPACE_MARKER)) return
  try {
    await putObject(config, STORAGE_NAMESPACE_MARKER, NAMESPACE_MARKER_BODY, 'application/json')
  } catch (error) {
    if (error instanceof S3HttpError && (error.status === 403 || error.status === 401)) {
      // Keep the parsed <Code>/<Message>: AccessDenied, SignatureDoesNotMatch,
      // InvalidAccessKeyId and RequestTimeTooSkewed need very different fixes
      // and all collapsed into one indistinguishable sentence.
      throw new Error(
        withProviderDetail(
          'Cannot write to this bucket. Check access permissions and bucket name.',
          s3ErrorDetail(error)
        )
      )
    }
    throw error
  }
}

async function writeDocumentMetadata(
  config: S3CompatibleConfig,
  id: string,
  metadata: StorageDocumentMetadata
): Promise<void> {
  await putObject(
    config,
    documentMetaKey(id),
    serializeStorageDocumentMetadata(metadata),
    'application/json'
  )
}

export interface S3StorageAdapter extends StorageAdapter {
  testConnection(): Promise<S3ConnectionResult>
}

export type S3ConfigResolver = () => Promise<S3CompatibleConfig>

export type S3AdapterOptions = {
  /**
   * Issue conditional (If-Match) head updates, upgrading races to a typed
   * conflict instead of a recoverable fork. Probe-gated per provider: enable
   * only after a live probe returns 412s as documented (AWS S3 does; Bunny
   * documents conditional headers as unsupported; B2 is undocumented).
   */
  conditionalHeadUpdates?: boolean
}

export function createS3StorageAdapterWithConfig(
  resolveConfig: S3ConfigResolver,
  options: S3AdapterOptions = {}
): S3StorageAdapter {
  return {
    async testConnection() {
      const config = await resolveConfig()
      try {
        await ensureNamespace(config)
        await listObjects(config, STORAGE_DOCUMENTS_PREFIX)
      } catch (error) {
        const isCors =
          error instanceof CloudCorsError || (!isTauri() && isLikelyCorsOrNetworkError(error))
        return {
          ok: false,
          message: connectionErrorMessage(error, isCors),
          corsApplied: false,
          isCorsFailure: isCors,
          corsError: null
        }
      }

      return {
        ok: true,
        message: 'Connected. Storage namespace is ready.',
        corsApplied: false,
        isCorsFailure: false,
        corsError: null
      }
    },

    async listDocuments() {
      const config = await resolveConfig()
      const objects = await listObjects(config, STORAGE_DOCUMENTS_PREFIX)
      // One listing of `canvases/` sees both layouts: heads name versioned
      // documents, `.fig` keys name legacy ones. A head wins for its id.
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

      const documents: StorageDocument[] = []
      const ids = [...new Set([...versionedIds, ...legacyLastModified.keys()])]
      // Bound manifest/sidecar reads so large buckets do not open hundreds of
      // requests at once.
      for (let offset = 0; offset < ids.length; offset += 12) {
        const batch = ids.slice(offset, offset + 12)
        const batchDocuments = await Promise.all(
          batch.map(async (id): Promise<StorageDocument | null> => {
            const fallback = {
              name: id,
              updatedAt: legacyLastModified.get(id) ?? new Date(0).toISOString(),
              sourceFormat: 'fig' as const,
              trashedAt: null
            }
            if (versionedIds.has(id)) {
              const version = await s3ResolveVersion(config, id, fallback).catch(
                (error: unknown) => {
                  console.warn('[Storage] Versioned head fetch failed:', id, error)
                  return null
                }
              )
              if (version) {
                return {
                  id,
                  ...version.manifest.metadata,
                  metadataAuthoritative: version.authoritative
                } satisfies StorageDocument
              }
              // A torn head with no legacy body is not a readable document.
              if (!legacyLastModified.has(id)) return null
            }
            const metadataBytes = await getObject(config, documentMetaKey(id)).catch(
              (error: unknown) => {
                console.warn('[Storage] Document metadata fetch failed:', id, error)
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
        )
        documents.push(
          ...batchDocuments.filter((document): document is StorageDocument => document !== null)
        )
      }
      return documents.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    },

    async getDocument(id, onProgress) {
      const config = await resolveConfig()
      const mapProgress = onProgress
        ? (progress: { receivedBytes: number; totalBytes: number | null }) =>
            onProgress({
              transferredBytes: progress.receivedBytes,
              totalBytes: progress.totalBytes
            })
        : undefined
      // Versioned first; a document that only ever wrote the fixed-key layout
      // has no head and reads exactly as before.
      const bytes =
        (await s3GetVersionedBody(config, id, mapProgress)) ??
        (await getObject(config, documentFigKey(id), mapProgress))
      if (!bytes) throw new Error(`Document not found: ${id}`)
      return bytes
    },

    async putDocument(id, bytes, onProgress) {
      const config = await resolveConfig()
      await putObjectResumable(
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
    },

    async putDocumentMetadata(id, metadata) {
      await writeDocumentMetadata(await resolveConfig(), id, metadata)
    },

    async putDocumentVersion(id, bytes, readWritten, onProgress) {
      const config = await resolveConfig()
      return s3CommitVersion(
        config,
        id,
        bytes,
        readWritten,
        onProgress
          ? (progress) =>
              onProgress({ transferredBytes: progress.sentBytes, totalBytes: progress.totalBytes })
          : undefined,
        { conditional: options.conditionalHeadUpdates === true }
      )
    },

    async putMetadataVersion(id, written) {
      return s3CommitVersion(await resolveConfig(), id, null, async () => written, undefined, {
        conditional: options.conditionalHeadUpdates === true
      })
    },

    async hasRemoteBody(bodyId) {
      return headObject(await resolveConfig(), bodyKey(bodyId))
    },

    async collectGarbage(nowMs) {
      return s3CollectGarbage(await resolveConfig(), nowMs)
    },

    async getDocumentMetadata(id) {
      const config = await resolveConfig()
      // The head's manifest is the preflight source once a document is
      // versioned; the sidecar remains the source for legacy documents.
      const version = await s3ResolveVersion(config, id, {
        name: id,
        updatedAt: new Date(0).toISOString(),
        sourceFormat: 'fig',
        trashedAt: null
      })
      if (version?.authoritative) return version.manifest.metadata
      const bytes = await getObject(config, documentMetaKey(id))
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
      const config = await resolveConfig()
      // The head goes with the document; manifests and bodies stay for the
      // retention/GC sweep (phase 2), which reference-counts shared bodies.
      const results = await Promise.allSettled([
        deleteObject(config, documentFigKey(id)),
        deleteObject(config, documentMetaKey(id)),
        deleteObject(config, documentThumbnailKey(id)),
        deleteObject(config, documentHeadKey(id))
      ])
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      )
      if (failure) throw failure.reason
    },

    async getUsage() {
      const config = await resolveConfig()
      const objects = await listObjects(config, `${STORAGE_NAMESPACE}/`)
      // Heads and legacy bodies name the same document exactly once each.
      const documentIds = new Set<string>()
      for (const object of objects) {
        const id = documentIdFromHeadKey(object.key) ?? documentIdFromFigKey(object.key)
        if (id) documentIds.add(id)
      }
      return {
        bytesUsed: objects.reduce((total, object) => total + (object.size ?? 0), 0),
        objectCount: objects.length,
        documentCount: documentIds.size
      }
    },

    async putThumbnail(id, bytes) {
      const config = await resolveConfig()
      await putObject(config, documentThumbnailKey(id), bytes, storageThumbnailMimeType(bytes))
    },

    async getThumbnail(id) {
      const config = await resolveConfig()
      return getObject(config, documentThumbnailKey(id))
    }
  }
}

export function createS3StorageAdapter(
  runtime: StorageProviderRuntime,
  options: S3AdapterOptions = {}
): S3StorageAdapter {
  return createS3StorageAdapterWithConfig(() => resolveConfig(runtime), options)
}
