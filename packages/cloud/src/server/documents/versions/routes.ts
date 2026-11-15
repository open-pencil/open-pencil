import {
  parseDuplicateDocumentVersion,
  parseSaveDocumentVersion,
  parseUpdateDocumentVersion
} from '#cloud/contract'
import { documentDomainError, type DocumentRouteEnvironment } from '#cloud/server/documents/routes'
import {
  documentParams,
  documentVersionParams,
  validatedJSON,
  validatedQuery
} from '#cloud/server/validation'
import { Hono, type Context } from 'hono'
import * as v from 'valibot'

import type { DocumentVersionService } from './service'

const pageSchema = v.object({
  before: v.optional(v.pipe(v.string(), v.uuid())),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)))
})
const parsePage = (input: unknown) => v.parse(pageSchema, input)

async function answer(context: Context, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run()
  } catch (error) {
    const response = documentDomainError(context, error)
    if (response) return response
    throw error
  }
}

/** A document's version history: listing, naming, opening, restoring, and duplicating versions. */
export function createDocumentVersionRoutes(service: DocumentVersionService) {
  return new Hono<DocumentRouteEnvironment>()
    .get('/documents/:documentId/versions', documentParams, validatedQuery(parsePage), (context) =>
      answer(context, async () =>
        context.json(
          await service.list(
            context.get('actor').userId,
            context.req.valid('param').documentId,
            context.req.valid('query')
          )
        )
      )
    )
    .post(
      '/documents/:documentId/versions',
      documentParams,
      validatedJSON(parseSaveDocumentVersion),
      (context) =>
        answer(context, async () =>
          context.json(
            {
              version: await service.save(
                context.get('actor').userId,
                context.req.valid('param').documentId,
                context.req.valid('json')
              )
            },
            201
          )
        )
    )
    .patch(
      '/documents/:documentId/versions/:versionId',
      documentVersionParams,
      validatedJSON(parseUpdateDocumentVersion),
      (context) =>
        answer(context, async () =>
          context.json({
            version: await service.update(
              context.get('actor').userId,
              context.req.valid('param').documentId,
              context.req.valid('param').versionId,
              context.req.valid('json')
            )
          })
        )
    )
    .get('/documents/:documentId/versions/:versionId', documentVersionParams, (context) =>
      answer(context, async () =>
        context.json(
          await service.download(
            context.get('actor').userId,
            context.req.valid('param').documentId,
            context.req.valid('param').versionId
          )
        )
      )
    )
    .post('/documents/:documentId/versions/:versionId/restore', documentVersionParams, (context) =>
      answer(context, async () =>
        context.json(
          await service.restore(
            context.get('actor').userId,
            context.req.valid('param').documentId,
            context.req.valid('param').versionId
          )
        )
      )
    )
    .post(
      '/documents/:documentId/versions/:versionId/duplicate',
      documentVersionParams,
      validatedJSON(parseDuplicateDocumentVersion),
      (context) =>
        answer(context, async () =>
          context.json(
            {
              document: await service.duplicate(
                context.get('actor').userId,
                context.req.valid('param').documentId,
                context.req.valid('param').versionId,
                context.req.valid('json')
              )
            },
            201
          )
        )
    )
}
