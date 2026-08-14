import { parseCommitUpload, parseCreateDocument, parseCreateUpload } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { DocumentService } from '#cloud/server/documents/service'
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
  UploadInvalidError
} from '#cloud/server/documents/service'
import { Hono, type Context } from 'hono'
import { ValiError } from 'valibot'

export type DocumentRouteEnvironment = {
  Variables: {
    actor: CloudActor
  }
}

function domainError(context: Context, error: unknown): Response | null {
  if (error instanceof ValiError) {
    return context.json({ error: { code: 'invalid_request' as const } }, 400)
  }
  if (error instanceof DocumentNotFoundError) {
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
  if (error instanceof DocumentForbiddenError) {
    return context.json({ error: { code: 'forbidden' as const } }, 403)
  }
  if (error instanceof DocumentConflictError) {
    return context.json({ error: { code: 'revision_conflict' as const } }, 409)
  }
  if (error instanceof UploadInvalidError) {
    return context.json({ error: { code: 'invalid_upload' as const } }, 422)
  }
  return null
}

export function createDocumentRoutes(service: DocumentService) {
  return new Hono<DocumentRouteEnvironment>()
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
    .post('/workspaces/:workspaceId/documents', async (context) => {
      try {
        const document = await service.create(
          context.get('actor').userId,
          context.req.param('workspaceId'),
          parseCreateDocument(await context.req.json())
        )
        return context.json({ document }, 201)
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
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
    .post('/documents/:documentId/uploads', async (context) => {
      try {
        const result = await service.createUpload(
          context.get('actor').userId,
          context.req.param('documentId'),
          parseCreateUpload(await context.req.json())
        )
        return context.json(result, 201)
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .post('/uploads/:uploadId/commit', async (context) => {
      try {
        const document = await service.commitUpload(
          context.get('actor').userId,
          context.req.param('uploadId'),
          parseCommitUpload(await context.req.json())
        )
        return context.json({ document })
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
}
