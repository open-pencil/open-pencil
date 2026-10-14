import { extractFigThumbnailFromReader } from '@open-pencil/fig'

import { isTauri } from '@/app/tauri/env'

import {
  fallbackDocumentMetadata,
  parseStorageDocumentMetadata,
  serializeStorageDocumentMetadata
} from '../metadata'
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
import type {
  StorageAdapter,
  StorageDocumentVersion,
  StorageProviderRuntime,
  StorageTransferProgress,
  VersionCommitOptions
} from '../types'
import { s3CollectGarbage } from '../versioned/gc'
import { s3CommitVersion, s3GetVersionedBody, s3ResolveVersion } from '../versioned/s3'
import {
  S3HttpError,
  deleteObject,
  getObject,
  getObjectValue,
  getObjectRange,
  headObject,
  headObjectSize,
  listObjects,
  putObject,
  type DownloadProgress,
  type UploadProgress
} from './client'
import { CloudCORSError, formatBrowserCORSHelpMessage, isLikelyCORSOrNetworkError } from './cors'
import { listS3Documents, readLegacyDocument, readVersionedDocument } from './listing'
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

function downloadProgress(
  onProgress: ((progress: StorageTransferProgress) => void) | undefined
): ((progress: DownloadProgress) => void) | undefined {
  return onProgress
    ? (progress) =>
        onProgress({ transferredBytes: progress.receivedBytes, totalBytes: progress.totalBytes })
    : undefined
}

function uploadProgress(
  onProgress: ((progress: StorageTransferProgress) => void) | undefined
): ((progress: UploadProgress) => void) | undefined {
  return onProgress
    ? (progress) =>
        onProgress({ transferredBytes: progress.sentBytes, totalBytes: progress.totalBytes })
    : undefined
}

/** The embedded preview of a `.fig`, read through byte ranges; null when the object is absent. */
async function figThumbnail(config: S3CompatibleConfig, key: string): Promise<Uint8Array | null> {
  const size = await headObjectSize(config, key)
  if (size == null) return null
  return extractFigThumbnailFromReader({
    size,
    async read(start: number, endExclusive: number) {
      return (await getObjectRange(config, key, start, endExclusive)) ?? new Uint8Array()
    }
  })
}

export interface S3StorageAdapter extends StorageAdapter {
  testConnection(): Promise<S3ConnectionResult>
}

export type S3ConfigResolver = () => Promise<S3CompatibleConfig>

export type S3AdapterOptions = {
  /**
   * Send `If-Match` on head updates, turning a lost race into a typed conflict instead of a fork.
   * Only for providers verified to enforce it; Backblaze B2 does not, so the generic S3 provider
   * leaves it off and relies on detection.
   */
  conditionalHeadUpdates?: boolean
}

export function createS3StorageAdapterWithConfig(
  resolve: S3ConfigResolver,
  options: S3AdapterOptions = {}
): S3StorageAdapter {
  const commitOptions = (extra: VersionCommitOptions = {}) => ({
    ...extra,
    conditional: options.conditionalHeadUpdates === true
  })

  async function getDocumentVersion(
    id: string,
    onProgress?: (progress: StorageTransferProgress) => void,
    signal?: AbortSignal
  ): Promise<StorageDocumentVersion> {
    signal?.throwIfAborted()
    const config = await resolve()
    signal?.throwIfAborted()
    const progress = downloadProgress(onProgress)
    // Versioned first; a document that only ever wrote the legacy layout reads as before.
    const version = await s3GetVersionedBody(
      config,
      id,
      fallbackDocumentMetadata(id),
      progress,
      signal
    )
    if (version) {
      return {
        bytes: version.bytes,
        metadata: {
          ...version.manifest.metadata,
          bodyId: version.manifest.bodyId,
          stateId: version.head.stateId
        },
        versioned: true,
        history: version.head.history
      }
    }
    const bytes = await getObject(config, documentFigKey(id), progress, signal)
    if (!bytes) throw new Error(`Document not found: ${id}`)
    const legacy = await readLegacyDocument(config, id)
    return { bytes, metadata: legacy, versioned: false, history: [] }
  }

  return {
    async testConnection() {
      const config = await resolve()
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
      return listS3Documents(await resolve())
    },

    getDocumentVersion,

    async getDocument(id, onProgress, signal) {
      return (await getDocumentVersion(id, onProgress, signal)).bytes
    },

    async putDocumentVersion(id, bytes, readWritten, onProgress, extra) {
      return s3CommitVersion(
        await resolve(),
        id,
        bytes,
        readWritten,
        uploadProgress(onProgress),
        commitOptions(extra)
      )
    },

    async putMetadataVersion(id, written, extra) {
      return s3CommitVersion(
        await resolve(),
        id,
        null,
        async () => written,
        undefined,
        commitOptions(extra)
      )
    },

    async putDocumentMetadata(id, metadata) {
      await putObject(
        await resolve(),
        documentMetaKey(id),
        serializeStorageDocumentMetadata(metadata),
        'application/json'
      )
    },

    async collectGarbage(nowMs) {
      return s3CollectGarbage(await resolve(), nowMs)
    },

    async getDocumentMetadata(id) {
      const config = await resolve()
      // The head's manifest describes a versioned document; the sidecar a legacy one.
      const versioned = await readVersionedDocument(config, id)
      if (versioned?.metadataAuthoritative) return versioned
      const bytes = await getObject(config, documentMetaKey(id))
      if (!bytes) return null
      const parsed = parseStorageDocumentMetadata(bytes, fallbackDocumentMetadata(id))
      return parsed.authoritative
        ? { id, ...parsed.metadata, metadataAuthoritative: true, versioned: false }
        : null
    },

    async deleteDocument(id) {
      const config = await resolve()
      // Manifests and bodies stay for the garbage collection sweep, which knows which bodies
      // another document still references.
      const results = await Promise.allSettled([
        deleteObject(config, documentHeadKey(id)),
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
      const config = await resolve()
      const objects = await listObjects(config, `${STORAGE_NAMESPACE}/`)
      // A head and a legacy body of one document count it once.
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
      await putObject(await resolve(), documentThumbnailKey(id), bytes, 'image/jpeg')
    },

    /**
     * The preview, without downloading a document: the embedded thumbnail of the committed
     * `.fig` body, then of a legacy `.fig`, then a stored preview image, which is all a slide
     * deck has.
     */
    async getThumbnail(id) {
      const config = await resolve()
      const version = await s3ResolveVersion(config, id, fallbackDocumentMetadata(id))
      if (version?.manifest.metadata.sourceFormat === 'fig') {
        const embedded = await figThumbnail(config, bodyKey(version.manifest.bodyId))
        if (embedded) return embedded
      }
      if (!version) {
        const legacy = await figThumbnail(config, documentFigKey(id))
        if (legacy) return legacy
      }
      return getObject(config, documentThumbnailKey(id))
    },

    libraryObjects: {
      async getObject(key) {
        return getObject(await resolve(), key)
      },
      async getObjectValue(key) {
        return getObjectValue(await resolve(), key)
      },
      async putObject(key, bytes, contentType, writeOptions) {
        try {
          await putObject(await resolve(), key, bytes, contentType, undefined, writeOptions)
        } catch (error) {
          if (error instanceof S3HttpError && (error.status === 409 || error.status === 412)) {
            throw new Error('Library revision conflict: latest revision has changed')
          }
          throw error
        }
      },
      async listObjects(prefix) {
        return (await listObjects(await resolve(), prefix)).map((object) => ({
          key: object.key,
          size: object.size,
          etag: null
        }))
      }
    }
  }
}

export function createS3StorageAdapter(
  runtime: StorageProviderRuntime,
  options: S3AdapterOptions = {}
): S3StorageAdapter {
  return createS3StorageAdapterWithConfig(() => resolveConfig(runtime), options)
}
