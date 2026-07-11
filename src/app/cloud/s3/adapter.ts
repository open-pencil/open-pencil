import {
  CLOUD_CANVASES_PREFIX,
  CLOUD_NAMESPACE,
  CLOUD_NAMESPACE_MARKER,
  NAMESPACE_MARKER_BODY,
  canvasFigKey,
  canvasIdFromFigKey,
  canvasMetaKey,
  canvasThumbKey
} from '@/app/cloud/namespace'
import {
  deleteObject,
  getObject,
  headObject,
  listObjects,
  putObject,
  S3HttpError
} from '@/app/cloud/s3/client'
import {
  CloudCorsError,
  ensureWebCorsOnBucket,
  formatBrowserCorsHelpMessage,
  isLikelyCorsOrNetworkError
} from '@/app/cloud/s3/cors'
import type {
  CloudCanvas,
  CloudCanvasMeta,
  CloudConnectionTestResult,
  CloudStorageAdapter,
  S3CompatibleConfig
} from '@/app/cloud/types'
import { isTauri } from '@/app/tauri/env'

function parseMeta(
  bytes: Uint8Array | null,
  fallback: CloudCanvasMeta
): { meta: CloudCanvasMeta; authoritative: boolean } {
  if (!bytes) return { meta: fallback, authoritative: false }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CloudCanvasMeta>
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : null
    const updatedAt =
      typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : null
    return {
      meta: {
        name: name ?? fallback.name,
        updatedAt: updatedAt ?? fallback.updatedAt
      },
      authoritative: name != null && updatedAt != null
    }
  } catch {
    return { meta: fallback, authoritative: false }
  }
}

export function createS3CompatibleAdapter(config: S3CompatibleConfig): CloudStorageAdapter {
  return {
    id: 's3-compatible',

    async ensureNamespace() {
      const exists = await headObject(config, CLOUD_NAMESPACE_MARKER)
      if (exists) return
      try {
        await putObject(config, CLOUD_NAMESPACE_MARKER, NAMESPACE_MARKER_BODY, 'application/json')
      } catch (error) {
        if (error instanceof S3HttpError && (error.status === 403 || error.status === 401)) {
          throw new Error(
            'Cannot write to this bucket. Check access key permissions and bucket name.'
          )
        }
        throw error
      }
    },

    async testConnection(): Promise<CloudConnectionTestResult> {
      // Same automatic step as `aws s3api put-bucket-cors`: configure web origins on the bucket.
      // Desktop: almost always succeeds. Web: succeeds only if the browser is already allowed.
      let cors = await ensureWebCorsOnBucket(config)
      if (!cors.applied) {
        console.warn('[Cloud] Auto PutBucketCors failed:', cors.error)
      }

      try {
        await this.ensureNamespace()
        await listObjects(config, CLOUD_CANVASES_PREFIX)
      } catch (error) {
        const isCors =
          error instanceof CloudCorsError || (!isTauri() && isLikelyCorsOrNetworkError(error))
        let message: string
        if (isCors) {
          message = formatBrowserCorsHelpMessage()
        } else if (error instanceof Error) {
          message = error.message
        } else {
          message = String(error)
        }
        return {
          ok: false,
          message,
          corsApplied: cors.applied,
          isCorsFailure: isCors,
          corsError: cors.error
        }
      }

      // If first CORS attempt failed but storage works (e.g. desktop after partial setup), retry.
      if (!cors.applied) {
        cors = await ensureWebCorsOnBucket(config)
      }

      // If namespace + list succeeded, the browser can already talk to the bucket.
      // PutBucketCors may still fail (permissions / already custom rules) — that is not a CORS block.
      return {
        ok: true,
        message: cors.applied
          ? 'Connected. Bucket CORS was applied automatically for the web app.'
          : 'Connected. Namespace ready — web app can use this bucket.',
        corsApplied: cors.applied,
        isCorsFailure: false,
        corsError: null
      }
    },

    async listCanvases() {
      const objects = await listObjects(config, CLOUD_CANVASES_PREFIX)
      const figEntries = objects
        .map((obj) => {
          const id = canvasIdFromFigKey(obj.key)
          if (!id) return null
          return { id, lastModified: obj.lastModified }
        })
        .filter((entry): entry is { id: string; lastModified: string | null } => entry != null)

      const canvases = await Promise.all(
        figEntries.map(async ({ id, lastModified }) => {
          const fallback: CloudCanvasMeta = {
            name: id,
            updatedAt: lastModified ?? new Date(0).toISOString()
          }
          // One failed meta fetch must not hide the whole workspace — degrade to fallback.
          const metaBytes = await getObject(config, canvasMetaKey(id)).catch((error: unknown) => {
            console.warn('[Cloud] canvas meta fetch failed, using fallback:', id, error)
            return null
          })
          // Server LastModified is not comparable with meta.json timestamps —
          // callers must not use a fallback updatedAt to force re-downloads.
          const { meta, authoritative } = parseMeta(metaBytes, fallback)
          return { id, ...meta, metaAuthoritative: authoritative } satisfies CloudCanvas
        })
      )

      canvases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return canvases
    },

    async getCanvas(id: string, onProgress) {
      const bytes = await getObject(config, canvasFigKey(id), onProgress)
      if (!bytes) throw new Error(`Canvas not found: ${id}`)
      return bytes
    },

    async putCanvas(id: string, bytes: Uint8Array, meta: CloudCanvasMeta, onProgress) {
      await putObject(config, canvasFigKey(id), bytes, 'application/octet-stream', onProgress)
      const body = JSON.stringify({
        name: meta.name,
        updatedAt: meta.updatedAt || new Date().toISOString()
      })
      await putObject(config, canvasMetaKey(id), body, 'application/json')
    },

    async getCanvasMeta(id: string) {
      const metaBytes = await getObject(config, canvasMetaKey(id))
      if (!metaBytes) return null
      const { meta, authoritative } = parseMeta(metaBytes, {
        name: id,
        updatedAt: new Date(0).toISOString()
      })
      return authoritative ? meta : null
    },

    async deleteCanvas(id: string) {
      // Attempt all three so a transient failure can't strand meta/thumb orphans;
      // deletes are idempotent and the outbox retries on the rethrown failure.
      const results = await Promise.allSettled([
        deleteObject(config, canvasFigKey(id)),
        deleteObject(config, canvasMetaKey(id)),
        deleteObject(config, canvasThumbKey(id))
      ])
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failed) throw failed.reason
    },

    async getStorageUsage() {
      const objects = await listObjects(config, `${CLOUD_NAMESPACE}/`)
      let bytesUsed = 0
      let canvasCount = 0
      for (const obj of objects) {
        bytesUsed += obj.size ?? 0
        if (canvasIdFromFigKey(obj.key)) canvasCount += 1
      }
      return {
        bytesUsed,
        objectCount: objects.length,
        canvasCount
      }
    },

    async putThumbnail(id: string, jpegBytes: Uint8Array) {
      await putObject(config, canvasThumbKey(id), jpegBytes, 'image/jpeg')
    },

    async getThumbnail(id: string) {
      return getObject(config, canvasThumbKey(id))
    }
  }
}
