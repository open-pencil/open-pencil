import type { CloudAPIEnvironment } from '#cloud/server/api/types'
import type { CloudSessionResolver } from '#cloud/server/auth'
import { createBillingRoutes, type BillingTokenService } from '#cloud/server/billing'
import type { CollaborationTicketService } from '#cloud/server/collaboration'
import { createCollaborationRateLimits } from '#cloud/server/collaboration'
import type { CommentService } from '#cloud/server/comments'
import { createCommunityRoutes, type CommunityService } from '#cloud/server/community'
import type { CloudDatabase } from '#cloud/server/db'
import type { DocumentService } from '#cloud/server/documents'
import { createDocumentRateLimits, DocumentNotFoundError } from '#cloud/server/documents'
import type { DocumentVersionService } from '#cloud/server/documents/versions'
import type { EntitlementService } from '#cloud/server/policy'
import type { DocumentReportService } from '#cloud/server/reports'
import { createServicesRoutes, type ServicesTokenService } from '#cloud/server/services'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { createSharingRateLimits } from '#cloud/server/sharing'
import { workspaceParams } from '#cloud/server/validation'
import type { WorkspaceMemberService, WorkspaceService } from '#cloud/server/workspaces'
import { createWorkspaceRoutes } from '#cloud/server/workspaces'
import { Hono, type Context } from 'hono'
import type { Kysely } from 'kysely'

import { contractRoutes } from './contract'
import { createCloudAPIProcedures, createPublicCloudAPIProcedures } from './procedures'

export type CloudAPIServices = {
  database?: Kysely<CloudDatabase>
  rateLimitSecret?: string
  collaboration: CollaborationTicketService
  documents: DocumentService
  versions: DocumentVersionService
  comments: CommentService
  /** The community gallery, which anyone may read. */
  community: CommunityService
  sharing: DocumentSharingService
  /** Reports about documents shared by link. */
  reports: DocumentReportService
  resolveSession?: CloudSessionResolver
  entitlements?: EntitlementService
  /** Signs service tokens; without it the deployment offers no services. */
  servicesTokens?: ServicesTokenService
  /** Signs billing tokens; without it the deployment sells nothing. */
  billingTokens?: BillingTokenService
  workspaces: WorkspaceService
  workspaceMembers: WorkspaceMemberService
}

/** The routes anyone may call, under `prefix`: `/api`, and `/api/public` inside the signed-in API. */
export function createPublicCloudAPIRouter(
  services: CloudAPIServices,
  prefix: `/${string}` = '/api'
) {
  return (
    new Hono<CloudAPIEnvironment>()
      .route('/', createCommunityRoutes(services.community))
      // The public routes the contract describes, for whoever sent the request.
      .use(
        '*',
        contractRoutes(
          createPublicCloudAPIProcedures(services),
          prefix,
          (context: Context<CloudAPIEnvironment>) => ({
            request: context.req.raw,
            identify: (actor) => context.set('actor', actor)
          })
        )
      )
  )
}

export function createCloudAPIRouter(services: CloudAPIServices) {
  return (
    new Hono<CloudAPIEnvironment>()
      .route('/public', createPublicCloudAPIRouter(services, '/api/public'))
      .get('/account/entitlements', async (context) => {
        if (!services.entitlements)
          return context.json({ error: { code: 'not_found' as const } }, 404)
        return context.json({
          entitlements: await services.entitlements.account(context.get('actor').userId)
        })
      })
      .get('/workspaces/:workspaceId/entitlements', workspaceParams, async (context) => {
        if (!services.entitlements)
          return context.json({ error: { code: 'not_found' as const } }, 404)
        try {
          return context.json({
            entitlements: await services.entitlements.workspace(
              context.get('actor').userId,
              context.req.valid('param').workspaceId
            )
          })
        } catch (error) {
          // A workspace the account left, or one that has gone, since the editor listed it.
          if (error instanceof DocumentNotFoundError)
            return context.json({ error: { code: 'not_found' as const } }, 404)
          throw error
        }
      })
      .get('/session', (context) => context.json({ user: context.get('actor') }))
      .route(
        '/',
        createServicesRoutes(
          services.servicesTokens,
          services.database && services.rateLimitSecret
            ? { database: services.database, secret: services.rateLimitSecret }
            : undefined
        )
      )
      .route(
        '/',
        createBillingRoutes(
          services.billingTokens,
          services.database && services.rateLimitSecret
            ? { database: services.database, secret: services.rateLimitSecret }
            : undefined
        )
      )
      .route(
        '/',
        createCollaborationRateLimits(
          services.database && services.rateLimitSecret
            ? { database: services.database, secret: services.rateLimitSecret }
            : undefined
        )
      )
      .route(
        '/',
        createDocumentRateLimits(
          services.database && services.rateLimitSecret
            ? { database: services.database, secret: services.rateLimitSecret }
            : undefined
        )
      )
      .route(
        '/',
        createSharingRateLimits(
          services.database && services.rateLimitSecret
            ? { database: services.database, secret: services.rateLimitSecret }
            : undefined
        )
      )
      .route(
        '/workspaces',
        createWorkspaceRoutes(
          services.workspaces,
          services.workspaceMembers,
          services.database && services.rateLimitSecret
            ? { database: services.database, secret: services.rateLimitSecret }
            : undefined
        )
      )
      // The routes the contract describes, after the middleware above has run for them.
      .use(
        '*',
        contractRoutes(
          createCloudAPIProcedures(services),
          '/api',
          (context: Context<CloudAPIEnvironment>) => ({
            actor: context.get('actor')
          })
        )
      )
  )
}

export type CloudAPI = ReturnType<typeof createCloudAPIRouter>
export type PublicCloudAPI = ReturnType<typeof createPublicCloudAPIRouter>
