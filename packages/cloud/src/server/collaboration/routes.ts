import { parseResolveDocumentShare } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CollaborationTicketService } from '#cloud/server/collaboration/service'
import { DocumentNotFoundError } from '#cloud/server/documents'
import { DocumentShareInvalidError } from '#cloud/server/sharing'
import { validatedJSON } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'

export type CollaborationRouteEnvironment = { Variables: { actor: CloudActor } }

function notFound(context: Context, error: unknown): Response | null {
  if (error instanceof DocumentNotFoundError || error instanceof DocumentShareInvalidError) {
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
  return null
}

export function createCollaborationRoutes(service: CollaborationTicketService) {
  return new Hono<CollaborationRouteEnvironment>().post(
    '/documents/:documentId/collaboration-ticket',
    async (context) => {
      try {
        return context.json({
          ticket: await service.issueUserTicket(
            context.get('actor'),
            context.req.param('documentId')
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

export function createPublicCollaborationRoutes(service: CollaborationTicketService) {
  return new Hono().post(
    '/shares/:shareId/collaboration-ticket',
    validatedJSON(parseResolveDocumentShare),
    async (context) => {
      try {
        return context.json({
          ticket: await service.issueShareTicket(
            context.req.param('shareId'),
            context.req.valid('json')
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
