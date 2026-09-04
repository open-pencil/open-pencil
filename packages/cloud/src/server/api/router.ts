import type { CloudAPIEnvironment } from '#cloud/server/api/types'
import type { CloudSessionResolver } from '#cloud/server/auth'
import type { CollaborationTicketService } from '#cloud/server/collaboration'
import {
  createCollaborationRoutes,
  createPublicCollaborationRoutes
} from '#cloud/server/collaboration'
import type { CloudDatabase } from '#cloud/server/db'
import type { DocumentService } from '#cloud/server/documents'
import { createDocumentRoutes } from '#cloud/server/documents'
import type { EntitlementService } from '#cloud/server/policy'
import type { DocumentSharingService } from '#cloud/server/sharing'
import {
  createDocumentSharingRoutes,
  createPublicDocumentRoutes,
  createPublicSharingRoutes
} from '#cloud/server/sharing'
import type { WorkspaceService } from '#cloud/server/workspaces'
import { createWorkspaceRoutes } from '#cloud/server/workspaces'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

export type CloudAPIServices = {
  database?: Kysely<CloudDatabase>
  rateLimitSecret?: string
  collaboration: CollaborationTicketService
  documents: DocumentService
  sharing: DocumentSharingService
  resolveSession?: CloudSessionResolver
  entitlements?: EntitlementService
  workspaces: WorkspaceService
}

export function createPublicCloudAPIRouter(services: CloudAPIServices) {
  return new Hono<CloudAPIEnvironment>()
    .route('/', createPublicSharingRoutes(services.sharing))
    .route('/', createPublicDocumentRoutes(services.sharing, services.documents))
    .route('/', createPublicCollaborationRoutes(services.collaboration, services.resolveSession))
}

export function createCloudAPIRouter(services: CloudAPIServices) {
  return new Hono<CloudAPIEnvironment>()
    .route('/public', createPublicCloudAPIRouter(services))
    .get('/workspaces/:workspaceId/entitlements', async (context) => {
      if (!services.entitlements)
        return context.json({ error: { code: 'not_found' as const } }, 404)
      return context.json({
        entitlements: await services.entitlements.workspace(
          context.get('actor').userId,
          context.req.param('workspaceId')
        )
      })
    })
    .get('/session', (context) => context.json({ user: context.get('actor') }))
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
        services.database && services.rateLimitSecret
          ? { database: services.database, secret: services.rateLimitSecret }
          : undefined
      )
    )
}

export type CloudAPI = ReturnType<typeof createCloudAPIRouter>
export type PublicCloudAPI = ReturnType<typeof createPublicCloudAPIRouter>
