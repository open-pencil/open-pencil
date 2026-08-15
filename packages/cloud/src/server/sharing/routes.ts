import {
  parseAcceptDocumentInvitation,
  parseCreateDocumentInvitation,
  parseCreateDocumentShare,
  parsePutDocumentGrant,
  parseResolveDocumentShare,
  parseUpdateDocumentShare
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents'
import {
  DocumentShareInvalidError,
  type DocumentSharingService
} from '#cloud/server/sharing/service'
import { validatedJSON } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'

export type SharingRouteEnvironment = {
  Variables: { actor: CloudActor }
}

function domainError(context: Context, error: unknown): Response | null {
  if (error instanceof DocumentNotFoundError || error instanceof DocumentShareInvalidError) {
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
  if (error instanceof DocumentForbiddenError) {
    return context.json({ error: { code: 'forbidden' as const } }, 403)
  }
  return null
}

export function createDocumentSharingRoutes(service: DocumentSharingService) {
  return new Hono<SharingRouteEnvironment>()
    .get('/documents/:documentId/shares', async (context) => {
      try {
        return context.json({
          shares: await service.listShares(
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
    .post(
      '/documents/:documentId/shares',
      validatedJSON(parseCreateDocumentShare),
      async (context) => {
        try {
          return context.json(
            await service.createShare(
              context.get('actor').userId,
              context.req.param('documentId'),
              context.req.valid('json')
            ),
            201
          )
        } catch (error) {
          const response = domainError(context, error)
          if (response) return response
          throw error
        }
      }
    )
    .patch(
      '/documents/:documentId/shares/:shareId',
      validatedJSON(parseUpdateDocumentShare),
      async (context) => {
        try {
          return context.json({
            share: await service.updateShare(
              context.get('actor').userId,
              context.req.param('documentId'),
              context.req.param('shareId'),
              context.req.valid('json')
            )
          })
        } catch (error) {
          const response = domainError(context, error)
          if (response) return response
          throw error
        }
      }
    )
    .post('/documents/:documentId/shares/:shareId/rotate', async (context) => {
      try {
        return context.json(
          await service.rotateShare(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.param('shareId')
          )
        )
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .delete('/documents/:documentId/shares/:shareId', async (context) => {
      try {
        await service.revokeShare(
          context.get('actor').userId,
          context.req.param('documentId'),
          context.req.param('shareId')
        )
        return context.body(null, 204)
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .get('/documents/:documentId/grants', async (context) => {
      try {
        return context.json({
          grants: await service.listGrants(
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
    .put(
      '/documents/:documentId/grants/:userId',
      validatedJSON(parsePutDocumentGrant),
      async (context) => {
        try {
          return context.json({
            grant: await service.putGrant(
              context.get('actor').userId,
              context.req.param('documentId'),
              context.req.param('userId'),
              context.req.valid('json')
            )
          })
        } catch (error) {
          const response = domainError(context, error)
          if (response) return response
          throw error
        }
      }
    )
    .delete('/documents/:documentId/grants/:userId', async (context) => {
      try {
        await service.revokeGrant(
          context.get('actor').userId,
          context.req.param('documentId'),
          context.req.param('userId')
        )
        return context.body(null, 204)
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
    .get('/documents/:documentId/invitations', async (context) => {
      try {
        return context.json({
          invitations: await service.listInvitations(
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
    .post(
      '/documents/:documentId/invitations',
      validatedJSON(parseCreateDocumentInvitation),
      async (context) => {
        try {
          return context.json(
            await service.createInvitation(
              context.get('actor').userId,
              context.req.param('documentId'),
              context.req.valid('json')
            ),
            201
          )
        } catch (error) {
          const response = domainError(context, error)
          if (response) return response
          throw error
        }
      }
    )
    .post(
      '/invitations/:invitationId/accept',
      validatedJSON(parseAcceptDocumentInvitation),
      async (context) => {
        try {
          return context.json({
            grant: await service.acceptInvitation(
              context.get('actor'),
              context.req.param('invitationId'),
              context.req.valid('json')
            )
          })
        } catch (error) {
          const response = domainError(context, error)
          if (response) return response
          throw error
        }
      }
    )
    .delete('/documents/:documentId/invitations/:invitationId', async (context) => {
      try {
        await service.revokeInvitation(
          context.get('actor').userId,
          context.req.param('documentId'),
          context.req.param('invitationId')
        )
        return context.body(null, 204)
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    })
}

export function createPublicSharingRoutes(service: DocumentSharingService) {
  return new Hono().post(
    '/shares/:shareId/resolve',
    validatedJSON(parseResolveDocumentShare),
    async (context) => {
      try {
        return context.json({
          resolution: await service.resolveShare(
            context.req.param('shareId'),
            context.req.valid('json')
          )
        })
      } catch (error) {
        const response = domainError(context, error)
        if (response) return response
        throw error
      }
    }
  )
}
