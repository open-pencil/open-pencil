import { resolveDocumentShareSchema } from '#cloud/contract'
import type { CloudActor, CloudSessionResolver } from '#cloud/server/auth'
import type { CollaborationTicketService } from '#cloud/server/collaboration/service'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents'
import {
  CLOUD_RATE_LIMITS,
  routeParamResource,
  createResourceRateLimiter
} from '#cloud/server/rate-limit'
import { DocumentShareInvalidError, DocumentShareSignInRequiredError } from '#cloud/server/sharing'
import { documentParams, shareParams, validatedJSON } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'
import type { Kysely } from 'kysely'

export type CollaborationRouteEnvironment = { Variables: { actor: CloudActor } }

function notFound(context: Context, error: unknown): Response | null {
  if (error instanceof DocumentNotFoundError || error instanceof DocumentShareInvalidError) {
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
  if (error instanceof DocumentShareSignInRequiredError) {
    return context.json({ error: { code: 'unauthorized' as const } }, 401)
  }
  return null
}

export function createCollaborationRoutes(
  service: CollaborationTicketService,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<CollaborationRouteEnvironment>()
  if (rateLimit) {
    router.use(
      '/documents/:documentId/collaboration-ticket',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.collaborationTicket,
        routeParamResource('documentId')
      )
    )
  }
  return router.post(
    '/documents/:documentId/collaboration-ticket',
    documentParams,
    async (context) => {
      try {
        return context.json({
          ticket: await service.issueUserTicket(
            context.get('actor'),
            context.req.valid('param').documentId
          )
        })
      } catch (error) {
        const response = notFound(context, error)
        if (response) return response
        throw error
      }
    }
  )
}

export function createPublicCollaborationRoutes(
  service: Pick<CollaborationTicketService, 'issueShareTicket'>,
  resolveSession?: CloudSessionResolver
) {
  return new Hono<CollaborationRouteEnvironment>().post(
    '/shares/:shareId/collaboration-ticket',
    shareParams,
    validatedJSON(resolveDocumentShareSchema),
    async (context) => {
      try {
        const actor = resolveSession ? await resolveSession(context.req.raw) : null
        // A signed-in caller is named in error reports, as on the routes that require one.
        if (actor) context.set('actor', actor)
        return context.json({
          ticket: await service.issueShareTicket(
            context.req.valid('param').shareId,
            context.req.valid('json'),
            actor ?? undefined
          )
        })
      } catch (error) {
        const response = notFound(context, error)
        if (response) return response
        throw error
      }
    }
  )
}
