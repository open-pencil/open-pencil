import {
  parseCommitImageUploads,
  parseCommitUpload,
  parseCreateDocument,
  parseCreateUpload,
  parseRequestImageLinks,
  parseRequestImageUploads
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
  UploadInvalidError
} from '#cloud/server/documents/errors'
import type { DocumentService } from '#cloud/server/documents/service'
import { StorageQuotaExceededError } from '#cloud/server/quota'
import { CLOUD_RATE_LIMITS, createRouteRateLimiter } from '#cloud/server/rate-limit'
import { validatedJSON } from '#cloud/server/validation'
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
  if (error instanceof UploadInvalidError) {
    return context.json({ error: { code: 'invalid_upload' as const } }, 422)
  }
  return null
}

/** Answers with what `respond` gives, or with the response a document domain error stands for. */
async function documentResponse<T extends Response>(
  context: Context,
  respond: () => Promise<T>
): Promise<T | Response> {
  try {
    return await respond()
  } catch (error) {
    const response = documentDomainError(context, error)
    if (response) return response
    throw error
  }
}

export function createDocumentRoutes(
  service: DocumentService,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<DocumentRouteEnvironment>()
  if (rateLimit) {
    router.use(
      '/workspaces/:workspaceId/documents',
      createRouteRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.documentCreation,
        (context) => context.req.method !== 'POST',
        (context) => context.req.param('workspaceId') ?? 'unknown'
      )
    )
    router.use(
      '/documents/:documentId/images',
      createRouteRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.uploadCreation,
        (context) => context.req.method !== 'POST',
        (context) => context.req.param('documentId') ?? 'unknown'
      )
    )
    router.use(
      '/documents/:documentId/uploads',
      createRouteRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.uploadCreation,
        (context) => context.req.method !== 'POST',
        (context) => context.req.param('documentId') ?? 'unknown'
      )
    )
  }
  return router
    .get('/shared-documents', async (context) =>
      context.json({ documents: await service.listShared(context.get('actor').userId) })
    )
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
        const response = documentDomainError(context, error)
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
          const response = documentDomainError(context, error)
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
        const response = documentDomainError(context, error)
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
        const response = documentDomainError(context, error)
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
        const response = documentDomainError(context, error)
        if (response) return response
        throw error
      }
    })
    .post('/documents/:documentId/uploads', validatedJSON(parseCreateUpload), (context) =>
      documentResponse(context, async () =>
        context.json(
          await service.createUpload(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.valid('json')
          ),
          201
        )
      )
    )
    .post(
      '/documents/:documentId/images/commit',
      validatedJSON(parseCommitImageUploads),
      (context) =>
        documentResponse(context, async () => {
          await service.commitImageUploads(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.valid('json').uploads
          )
          return context.body(null, 204)
        })
    )
    .post('/documents/:documentId/images/links', validatedJSON(parseRequestImageLinks), (context) =>
      documentResponse(context, async () =>
        context.json(
          await service.imageLinks(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.valid('json').checksums
          )
        )
      )
    )
    .post('/documents/:documentId/images', validatedJSON(parseRequestImageUploads), (context) =>
      documentResponse(context, async () =>
        context.json(
          await service.requestImageUploads(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.valid('json')
          ),
          201
        )
      )
    )
    .post('/uploads/:uploadId/commit', validatedJSON(parseCommitUpload), async (context) => {
      try {
        const document = await service.commitUpload(
          context.get('actor').userId,
          context.req.param('uploadId'),
          context.req.valid('json')
        )
        return context.json({ document })
      } catch (error) {
        const response = documentDomainError(context, error)
        if (response) return response
        throw error
      }
    })
}
