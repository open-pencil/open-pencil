import type { CloudAPIEnvironment } from '#cloud/server/api/types'
import type { CloudSessionResolver } from '#cloud/server/auth'
import { createBillingRoutes, type BillingTokenService } from '#cloud/server/billing'
import type { CollaborationTicketService } from '#cloud/server/collaboration'
import {
  createCollaborationRoutes,
  createPublicCollaborationRoutes
} from '#cloud/server/collaboration'
import {
  createCommentRoutes,
  createSharedCommentRoutes,
  type CommentService
} from '#cloud/server/comments'
import { createCommunityRoutes, type CommunityService } from '#cloud/server/community'
import type { CloudDatabase } from '#cloud/server/db'
import type { DocumentService } from '#cloud/server/documents'
import { createDocumentRoutes, DocumentNotFoundError } from '#cloud/server/documents'
import { createDocumentToolRoutes, type DocumentToolService } from '#cloud/server/documents/tools'
import {
  createDocumentVersionRoutes,
  type DocumentVersionService
} from '#cloud/server/documents/versions'
import type { EntitlementService } from '#cloud/server/policy'
import { createPublicReportRoutes, type DocumentReportService } from '#cloud/server/reports'
import { createServicesRoutes, type ServicesTokenService } from '#cloud/server/services'
import type { DocumentSharingService } from '#cloud/server/sharing'
import {
  createDocumentSharingRoutes,
  createPublicDocumentRoutes,
  createPublicSharingRoutes
} from '#cloud/server/sharing'
import { tokenRoute } from '#cloud/server/tokens'
import { workspaceParams } from '#cloud/server/validation'
import type { WorkspaceMemberService, WorkspaceService } from '#cloud/server/workspaces'
import { createWorkspaceRoutes } from '#cloud/server/workspaces'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

export type CloudAPIServices = {
  database?: Kysely<CloudDatabase>
  rateLimitSecret?: string
  collaboration: CollaborationTicketService
  documents: DocumentService
  /** Design tools apps run on documents through the editor that has one open. */
  documentTools: DocumentToolService
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
  return new Hono<CloudAPIEnvironment>()
    .route('/', createPublicReportRoutes(services.reports, services.resolveSession))
    .route('/', createPublicSharingRoutes(services.sharing, services.resolveSession))
    .route(
      '/',
      createPublicDocumentRoutes(services.sharing, services.documents, services.resolveSession)
    )
    .route('/', createSharedCommentRoutes(services.comments, services.resolveSession))
    .route('/', createPublicCollaborationRoutes(services.collaboration, services.resolveSession))
    .route('/', createCommunityRoutes(services.community))
}

export function createCloudAPIRouter(services: CloudAPIServices) {
  return new Hono<CloudAPIEnvironment>()
    .route('/public', createPublicCloudAPIRouter(services))
    .get('/account/entitlements', async (context) => {
      if (!services.entitlements)
        return context.json({ error: { code: 'not_found' as const } }, 404)
      return context.json({
        entitlements: await services.entitlements.account(context.get('actor').userId)
      })
    })
    .get(
      '/workspaces/:workspaceId/entitlements',
      workspaceParams,
      tokenRoute.read.workspace,
      async (context) => {
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
      }
    )
    .get('/session', tokenRoute.read.grant, (context) =>
      context.json({ user: context.get('actor') })
    )
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
      createCollaborationRoutes(
        services.collaboration,
        services.database && services.rateLimitSecret
          ? { database: services.database, secret: services.rateLimitSecret }
          : undefined
      )
    )
    .route(
      '/',
      createDocumentRoutes(
        services.documents,
        services.database && services.rateLimitSecret
          ? { database: services.database, secret: services.rateLimitSecret }
          : undefined
      )
    )
    .route('/', createDocumentVersionRoutes(services.versions))
    .route('/', createDocumentToolRoutes(services.documentTools))
    .route('/', createCommentRoutes(services.comments))
    .route(
      '/',
      createDocumentSharingRoutes(
        services.sharing,
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
}

export type CloudAPI = ReturnType<typeof createCloudAPIRouter>
export type PublicCloudAPI = ReturnType<typeof createPublicCloudAPIRouter>
