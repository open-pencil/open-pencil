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
  CloudCorsError,
  ensureWebCorsOnBucket,
  formatBrowserCorsHelpMessage,
  isLikelyCorsOrNetworkError
} from '@/app/cloud/s3/cors'
import {
  deleteObject,
  getObject,
  headObject,
  listObjects,
  putObject,
  S3HttpError
} from '@/app/cloud/s3/client'
import type {
  CloudCanvas,
  CloudCanvasMeta,
  CloudConnectionTestResult,
  CloudStorageAdapter,
  S3CompatibleConfig
} from '@/app/cloud/types'
import { isTauri } from '@/app/tauri/env'

function parseMeta(bytes: Uint8Array | null, fallback: CloudCanvasMeta): CloudCanvasMeta {
  if (!bytes) return fallback
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CloudCanvasMeta>
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : fallback.name,
      updatedAt:
        typeof parsed.updatedAt === 'string' && parsed.updatedAt
          ? parsed.updatedAt
          : fallback.updatedAt
    }
  } catch {
    return fallback
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
          const metaBytes = await getObject(config, canvasMetaKey(id))
          const meta = parseMeta(metaBytes, fallback)
          return { id, ...meta } satisfies CloudCanvas
        })
      )

      canvases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return canvases
    },

    async getCanvas(id: string) {
      const bytes = await getObject(config, canvasFigKey(id))
      if (!bytes) throw new Error(`Canvas not found: ${id}`)
      return bytes
    },

    async putCanvas(id: string, bytes: Uint8Array, meta: CloudCanvasMeta) {
      await putObject(config, canvasFigKey(id), bytes, 'application/octet-stream')
      const body = JSON.stringify({
        name: meta.name,
        updatedAt: meta.updatedAt || new Date().toISOString()
      })
      await putObject(config, canvasMetaKey(id), body, 'application/json')
    },

    async deleteCanvas(id: string) {
      await deleteObject(config, canvasFigKey(id))
      await deleteObject(config, canvasMetaKey(id))
      await deleteObject(config, canvasThumbKey(id))
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
