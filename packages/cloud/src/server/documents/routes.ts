import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
  DocumentPurgeFailedError,
  UploadInvalidError
} from '#cloud/server/documents/errors'
import { StorageQuotaExceededError } from '#cloud/server/quota'
import {
  CLOUD_RATE_LIMITS,
  routeParamResource,
  createResourceRateLimiter
} from '#cloud/server/rate-limit'
import { Hono, type Context } from 'hono'
import type { Kysely } from 'kysely'

export type DocumentRouteEnvironment = {
  Variables: {
    actor: CloudActor
  }
}

/** The response a document domain error stands for, or null for any other error. */
export function documentDomainError(context: Context, error: unknown): Response | null {
  if (error instanceof DocumentNotFoundError) {
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
  if (error instanceof DocumentForbiddenError) {
    return context.json({ error: { code: 'forbidden' as const } }, 403)
  }
  if (error instanceof DocumentConflictError) {
    return context.json({ error: { code: 'revision_conflict' as const } }, 409)
  }
  if (error instanceof StorageQuotaExceededError) {
    return context.json({ error: { code: 'storage_quota_exceeded' as const } }, 409)
  }
  // Reported where cleanup failed, so the request handler doesn't report it again.
  if (error instanceof DocumentPurgeFailedError) {
    return context.json({ error: { code: 'purge_failed' as const } }, 503)
  }
  if (error instanceof UploadInvalidError) {
    return context.json({ error: { code: 'invalid_upload' as const } }, 422)
  }
  return null
}

/**
 * The budgets of the document routes that create things: documents in a workspace, and uploads
 * and image uploads for a document. The routes themselves are the contract's (`documentsContract`).
 */
export function createDocumentRateLimits(rateLimit?: {
  database: Kysely<CloudDatabase>
  secret: string
}) {
  const router = new Hono<DocumentRouteEnvironment>()
  if (rateLimit) {
    router.use(
      '/workspaces/:workspaceId/documents',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.documentCreation,
        routeParamResource('workspaceId'),
        (context) => context.req.method !== 'POST'
      )
    )
    router.use(
      '/documents/:documentId/images',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.uploadCreation,
        routeParamResource('documentId'),
        (context) => context.req.method !== 'POST'
      )
    )
    router.use(
      '/documents/:documentId/uploads',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.uploadCreation,
        routeParamResource('documentId'),
        (context) => context.req.method !== 'POST'
      )
    )
  }
  return router
}
