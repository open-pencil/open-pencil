import {
  parseAcceptDocumentInvitation,
  parseCreateDocumentInvitation,
  parseCreateDocumentShare,
  parsePutDocumentGrant,
  parseResolveDocumentShare,
  parseUpdateDocumentShare
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import { sharingRoute } from '#cloud/server/sharing/http'
import type { DocumentSharingService } from '#cloud/server/sharing/service'
import { validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'

export type SharingRouteEnvironment = {
  Variables: { actor: CloudActor }
}

export function createDocumentSharingRoutes(service: DocumentSharingService) {
  return new Hono<SharingRouteEnvironment>()
    .get('/documents/:documentId/shares', (context) =>
      sharingRoute(context, async () =>
        context.json({
          shares: await service.listShares(
            context.get('actor').userId,
            context.req.param('documentId')
          )
        })
      )
    )
    .post('/documents/:documentId/shares', validatedJSON(parseCreateDocumentShare), (context) =>
      sharingRoute(context, async () =>
        context.json(
          await service.createShare(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.valid('json')
          ),
          201
        )
      )
    )
    .patch(
      '/documents/:documentId/shares/:shareId',
      validatedJSON(parseUpdateDocumentShare),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            share: await service.updateShare(
              context.get('actor').userId,
              context.req.param('documentId'),
              context.req.param('shareId'),
              context.req.valid('json')
            )
          })
        )
    )
    .post('/documents/:documentId/shares/:shareId/rotate', (context) =>
      sharingRoute(context, async () =>
        context.json(
          await service.rotateShare(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.param('shareId')
          )
        )
      )
    )
    .delete('/documents/:documentId/shares/:shareId', (context) =>
      sharingRoute(context, async () => {
        await service.revokeShare(
          context.get('actor').userId,
          context.req.param('documentId'),
          context.req.param('shareId')
        )
        return context.body(null, 204)
      })
    )
    .get('/documents/:documentId/grants', (context) =>
      sharingRoute(context, async () =>
        context.json({
          grants: await service.listGrants(
            context.get('actor').userId,
            context.req.param('documentId')
          )
        })
      )
    )
    .put('/documents/:documentId/grants/:userId', validatedJSON(parsePutDocumentGrant), (context) =>
      sharingRoute(context, async () =>
        context.json({
          grant: await service.putGrant(
            context.get('actor').userId,
            context.req.param('documentId'),
            context.req.param('userId'),
            context.req.valid('json')
          )
        })
      )
    )
    .delete('/documents/:documentId/grants/:userId', (context) =>
      sharingRoute(context, async () => {
        await service.revokeGrant(
          context.get('actor').userId,
          context.req.param('documentId'),
          context.req.param('userId')
        )
        return context.body(null, 204)
      })
    )
    .get('/documents/:documentId/invitations', (context) =>
      sharingRoute(context, async () =>
        context.json({
          invitations: await service.listInvitations(
            context.get('actor').userId,
            context.req.param('documentId')
          )
        })
      )
    )
    .post(
      '/documents/:documentId/invitations',
      validatedJSON(parseCreateDocumentInvitation),
      (context) =>
        sharingRoute(context, async () =>
          context.json(
            await service.createInvitation(
              context.get('actor').userId,
              context.req.param('documentId'),
              context.req.valid('json')
            ),
            201
          )
        )
    )
    .post(
      '/invitations/:invitationId/accept',
      validatedJSON(parseAcceptDocumentInvitation),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            grant: await service.acceptInvitation(
              context.get('actor'),
              context.req.param('invitationId'),
              context.req.valid('json')
            )
          })
        )
    )
    .delete('/documents/:documentId/invitations/:invitationId', (context) =>
      sharingRoute(context, async () => {
        await service.revokeInvitation(
          context.get('actor').userId,
          context.req.param('documentId'),
          context.req.param('invitationId')
        )
        return context.body(null, 204)
      })
    )
}

export function createPublicSharingRoutes(service: DocumentSharingService) {
  return new Hono().post(
    '/shares/:shareId/resolve',
    validatedJSON(parseResolveDocumentShare),
    (context) =>
      sharingRoute(context, async () =>
        context.json({
          resolution: await service.resolveShare(
            context.req.param('shareId'),
            context.req.valid('json')
          )
        })
      )
  )
}
