import type { CloudAPIEnvironment } from '#cloud/server/api/types'
import type { CloudSessionResolver } from '#cloud/server/auth'
import { createBillingRateLimits, type BillingTokenService } from '#cloud/server/billing'
import type { CollaborationTicketService } from '#cloud/server/collaboration'
import { createCollaborationRateLimits } from '#cloud/server/collaboration'
import type { CommentService } from '#cloud/server/comments'
import { createCommunityObjectRoutes, type CommunityService } from '#cloud/server/community'
import type { CloudDatabase } from '#cloud/server/db'
import type { DocumentService } from '#cloud/server/documents'
import { createDocumentRateLimits } from '#cloud/server/documents'
import type { DocumentVersionService } from '#cloud/server/documents/versions'
import type { EntitlementService } from '#cloud/server/policy'
import type { DocumentReportService } from '#cloud/server/reports'
import { createServicesRateLimits, type ServicesTokenService } from '#cloud/server/services'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { createSharingRateLimits } from '#cloud/server/sharing'
import type { WorkspaceMemberService, WorkspaceService } from '#cloud/server/workspaces'
import { createWorkspaceRateLimits } from '#cloud/server/workspaces'
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

export function createPublicCloudAPIRouter(services: CloudAPIServices) {
  return (
    new Hono<CloudAPIEnvironment>()
      .route('/', createCommunityObjectRoutes(services.community))
      // The public routes the contract describes, for whoever sent the request.
      .use(
        '*',
        contractRoutes(
          createPublicCloudAPIProcedures(services),
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
      .route('/public', createPublicCloudAPIRouter(services))
      .route(
        '/',
        createServicesRateLimits(
          services.servicesTokens,
          services.database && services.rateLimitSecret
            ? { database: services.database, secret: services.rateLimitSecret }
            : undefined
        )
      )
      .route(
        '/',
        createBillingRateLimits(
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
        createWorkspaceRateLimits(
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
          (context: Context<CloudAPIEnvironment>) => ({
            actor: context.get('actor')
          })
        )
      )
  )
}
