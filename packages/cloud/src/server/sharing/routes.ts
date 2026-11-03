import {
  parseAcceptDocumentInvitation,
  parseCreateInvitationContinuation,
  parseCreateDocumentInvitation,
  parseLookupCloudUser,
  parseCreateDocumentShare,
  parsePutDocumentGrant,
  parseResolveDocumentShare,
  parseUpdateDocumentShare
} from '#cloud/contract'
import type { CloudActor, CloudSessionResolver } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import {
  CLOUD_RATE_LIMITS,
  routeParamResource,
  createResourceRateLimiter
} from '#cloud/server/rate-limit'
import { sharingRoute } from '#cloud/server/sharing/http'
import type { DocumentSharingService } from '#cloud/server/sharing/service'
import {
  documentInvitationParams,
  documentParams,
  documentShareParams,
  documentUserParams,
  invitationContinuationParams,
  invitationParams,
  shareParams,
  validatedJSON
} from '#cloud/server/validation'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

import { shareActor } from './actor'

export type SharingRouteEnvironment = {
  Variables: { actor: CloudActor }
}

export function createDocumentSharingRoutes(
  service: DocumentSharingService,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<SharingRouteEnvironment>()
  if (rateLimit) {
    router.use(
      '/documents/:documentId/invitations',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.invitationMutation,
        routeParamResource('documentId'),
        (context) => context.req.method !== 'POST'
      )
    )
  }
  return router
    .post(
      '/documents/:documentId/users/lookup',
      documentParams,
      validatedJSON(parseLookupCloudUser),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            user: await service.lookupUser(
              context.get('actor').userId,
              context.req.valid('param').documentId,
              context.req.valid('json')
            )
          })
        )
    )
    .get('/documents/:documentId/users/:userId', documentUserParams, (context) =>
      sharingRoute(context, async () =>
        context.json({
          user: await service.userProfile(
            context.get('actor').userId,
            context.req.valid('param').documentId,
            context.req.valid('param').userId
          )
        })
      )
    )
    .get('/documents/:documentId/shares', documentParams, (context) =>
      sharingRoute(context, async () =>
        context.json({
          shares: await service.listShares(
            context.get('actor').userId,
            context.req.valid('param').documentId
          )
        })
      )
    )
    .post(
      '/documents/:documentId/shares',
      documentParams,
      validatedJSON(parseCreateDocumentShare),
      (context) =>
        sharingRoute(context, async () =>
          context.json(
            await service.createShare(
              context.get('actor').userId,
              context.req.valid('param').documentId,
              context.req.valid('json')
            ),
            201
          )
        )
    )
    .patch(
      '/documents/:documentId/shares/:shareId',
      documentShareParams,
      validatedJSON(parseUpdateDocumentShare),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            share: await service.updateShare(
              context.get('actor').userId,
              context.req.valid('param').documentId,
              context.req.valid('param').shareId,
              context.req.valid('json')
            )
          })
        )
    )
    .post('/documents/:documentId/shares/:shareId/rotate', documentShareParams, (context) =>
      sharingRoute(context, async () =>
        context.json(
          await service.rotateShare(
            context.get('actor').userId,
            context.req.valid('param').documentId,
            context.req.valid('param').shareId
          )
        )
      )
    )
    .delete('/documents/:documentId/shares/:shareId', documentShareParams, (context) =>
      sharingRoute(context, async () => {
        await service.revokeShare(
          context.get('actor').userId,
          context.req.valid('param').documentId,
          context.req.valid('param').shareId
        )
        return context.body(null, 204)
      })
    )
    .get('/documents/:documentId/grants', documentParams, (context) =>
      sharingRoute(context, async () =>
        context.json({
          grants: await service.listGrants(
            context.get('actor').userId,
            context.req.valid('param').documentId
          )
        })
      )
    )
    .put(
      '/documents/:documentId/grants/:userId',
      documentUserParams,
      validatedJSON(parsePutDocumentGrant),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            grant: await service.putGrant(
              context.get('actor').userId,
              context.req.valid('param').documentId,
              context.req.valid('param').userId,
              context.req.valid('json')
            )
          })
        )
    )
    .delete('/documents/:documentId/grants/:userId', documentUserParams, (context) =>
      sharingRoute(context, async () => {
        await service.revokeGrant(
          context.get('actor').userId,
          context.req.valid('param').documentId,
          context.req.valid('param').userId
        )
        return context.body(null, 204)
      })
    )
    .get('/documents/:documentId/invitations', documentParams, (context) =>
      sharingRoute(context, async () =>
        context.json({
          invitations: await service.listInvitations(
            context.get('actor').userId,
            context.req.valid('param').documentId
          )
        })
      )
    )
    .post(
      '/documents/:documentId/invitations',
      documentParams,
      validatedJSON(parseCreateDocumentInvitation),
      (context) =>
        sharingRoute(context, async () =>
          context.json(
            await service.createInvitation(
              context.get('actor').userId,
              context.req.valid('param').documentId,
              context.req.valid('json')
            ),
            201
          )
        )
    )
    .post(
      '/invitations/:invitationId/accept',
      invitationParams,
      validatedJSON(parseAcceptDocumentInvitation),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            accepted: await service.acceptInvitation(
              context.get('actor'),
              context.req.valid('param').invitationId,
              context.req.valid('json')
            )
          })
        )
    )
    .delete(
      '/documents/:documentId/invitations/:invitationId',
      documentInvitationParams,
      (context) =>
        sharingRoute(context, async () => {
          await service.revokeInvitation(
            context.get('actor').userId,
            context.req.valid('param').documentId,
            context.req.valid('param').invitationId
          )
          return context.body(null, 204)
        })
    )
}

export function createPublicSharingRoutes(
  service: DocumentSharingService,
  resolveSession?: CloudSessionResolver
) {
  return new Hono()
    .post(
      '/invitations/continuations',
      validatedJSON(parseCreateInvitationContinuation),
      (context) =>
        sharingRoute(context, async () =>
          context.json(await service.createInvitationContinuation(context.req.valid('json')), 201)
        )
    )
    .post(
      '/invitations/continuations/:continuationId/consume',
      invitationContinuationParams,
      (context) =>
        sharingRoute(context, async () =>
          context.json(
            await service.consumeInvitationContinuation(context.req.valid('param').continuationId)
          )
        )
    )
    .post(
      '/invitations/:invitationId/preview',
      invitationParams,
      validatedJSON(parseAcceptDocumentInvitation),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            invitation: await service.previewInvitation(
              context.req.valid('param').invitationId,
              context.req.valid('json')
            )
          })
        )
    )
    .post(
      '/shares/:shareId/resolve',
      shareParams,
      validatedJSON(parseResolveDocumentShare),
      (context) =>
        sharingRoute(context, async () =>
          context.json({
            resolution: await service.resolveShare(
              context.req.valid('param').shareId,
              context.req.valid('json'),
              await shareActor(context.req.raw, resolveSession)
            )
          })
        )
    )
}
