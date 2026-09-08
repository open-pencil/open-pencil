import { parseCommitUpload, parseCreateDocument, parseCreateUpload } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import type { DocumentService } from '#cloud/server/documents/service'
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
  UploadInvalidError
} from '#cloud/server/documents/service'
import { StorageQuotaExceededError } from '#cloud/server/quota'
import { CLOUD_RATE_LIMITS, createActorRateLimiter } from '#cloud/server/rate-limit'
import { validatedJSON } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'
import type { Kysely } from 'kysely'

export type DocumentRouteEnvironment = {
  Variables: {
    actor: CloudActor
  }
}

function domainError(context: Context, error: unknown): Response | null {
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
  if (error instanceof UploadInvalidError) {
    return context.json({ error: { code: 'invalid_upload' as const } }, 422)
  }
  return null
}

export function createDocumentRoutes(
  service: DocumentService,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<DocumentRouteEnvironment>()
  if (rateLimit) {
    router.use(
      '/workspaces/:workspaceId/documents',
      createActorRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.documentCreation,
        (context) => context.req.method !== 'POST',
        (context) => context.req.param('workspaceId') ?? 'unknown'
      )
    )
    router.use(
      '/documents/:documentId/uploads',
      createActorRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.uploadCreation,
        (context) => context.req.method !== 'POST',
        (context) => context.req.param('documentId') ?? 'unknown'
      )
    )
  }
  return router
    .get('/workspaces/:workspaceId/documents', async (context) => {
      const documents = await service.list(
        context.get('actor').userId,
        context.req.param('workspaceId')
      )
      if (!documents) return context.json({ error: { code: 'not_found' as const } }, 404)
      return context.json({ documents })
    })
    .get('/workspaces/:workspaceId/usage', async (context) => {
      try {
        return context.json({
          usage: await service.usage(context.get('actor').userId, context.req.param('workspaceId'))
        })
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .post(
      '/workspaces/:workspaceId/documents',
      validatedJSON(parseCreateDocument),
      async (context) => {
        try {
          const document = await service.create(
            context.get('actor').userId,
            context.req.param('workspaceId'),
            context.req.valid('json')
          )
          return context.json({ document }, 201)
        } catch (error) {
          const response = domainError(context, error)
          if (response) return response
          throw error
        }
      }
    )
    .delete('/documents/:documentId', async (context) => {
      try {
        await service.remove(context.get('actor').userId, context.req.param('documentId'))
        return context.body(null, 204)
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .get('/documents/:documentId/access', async (context) => {
      try {
        return context.json({
          access: await service.access(context.get('actor').userId, context.req.param('documentId'))
        })
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .get('/documents/:documentId', async (context) => {
      try {
        return context.json({
          document: await service.download(
            context.get('actor').userId,
            context.req.param('documentId')
          )
        })
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .post('/documents/:documentId/uploads', validatedJSON(parseCreateUpload), async (context) => {
      try {
        const result = await service.createUpload(
          context.get('actor').userId,
          context.req.param('documentId'),
          context.req.valid('json')
        )
        return context.json(result, 201)
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .post('/uploads/:uploadId/commit', validatedJSON(parseCommitUpload), async (context) => {
      try {
        const document = await service.commitUpload(
          context.get('actor').userId,
          context.req.param('uploadId'),
          context.req.valid('json')
        )
        return context.json({ document })
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
}
