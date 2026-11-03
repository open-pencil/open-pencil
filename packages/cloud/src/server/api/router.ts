import { createAIRoutes, type AITokenService } from '#cloud/server/ai'
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
import {
  createDocumentVersionRoutes,
  type DocumentVersionService
} from '#cloud/server/documents/versions'
import type { EntitlementService } from '#cloud/server/policy'
import type { DocumentSharingService } from '#cloud/server/sharing'
import {
  createDocumentSharingRoutes,
  createPublicDocumentRoutes,
  createPublicSharingRoutes
} from '#cloud/server/sharing'
import { uuidParameter } from '#cloud/server/validation'
import type { WorkspaceMemberService, WorkspaceService } from '#cloud/server/workspaces'
import { createWorkspaceRoutes } from '#cloud/server/workspaces'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

export type CloudAPIServices = {
  database?: Kysely<CloudDatabase>
  rateLimitSecret?: string
  collaboration: CollaborationTicketService
  documents: DocumentService
  versions: DocumentVersionService
  sharing: DocumentSharingService
  resolveSession?: CloudSessionResolver
  entitlements?: EntitlementService
  /** Signs AI service tokens; without it the deployment has no AI service. */
  aiTokens?: AITokenService
  workspaces: WorkspaceService
  workspaceMembers: WorkspaceMemberService
}

export function createPublicCloudAPIRouter(services: CloudAPIServices) {
  return routerCheckingUUIDs(PUBLIC_UUID_PARAMETER_PATHS)
    .route('/', createPublicSharingRoutes(services.sharing, services.resolveSession))
    .route(
      '/',
      createPublicDocumentRoutes(services.sharing, services.documents, services.resolveSession)
    )
    .route('/', createPublicCollaborationRoutes(services.collaboration, services.resolveSession))
}

/**
 * Routes whose parameters name rows by UUID, each with and without what follows it. Paths are
 * spelled out rather than matched by prefix, since `/invitations/continuations/...` is not an
 * invitation.
 */
type UUIDParameterPaths = Readonly<Record<string, readonly string[]>>

const PUBLIC_UUID_PARAMETER_PATHS: UUIDParameterPaths = {
  shareId: ['/shares/:shareId/*'],
  invitationId: ['/invitations/:invitationId/accept', '/invitations/:invitationId/preview']
}

const UUID_PARAMETER_PATHS: UUIDParameterPaths = {
  documentId: ['/documents/:documentId', '/documents/:documentId/*'],
  versionId: [
    '/documents/:documentId/versions/:versionId',
    '/documents/:documentId/versions/:versionId/*'
  ],
  shareId: ['/documents/:documentId/shares/:shareId', '/documents/:documentId/shares/:shareId/*'],
  invitationId: [
    '/documents/:documentId/invitations/:invitationId',
    '/workspaces/:workspaceId/invitations/:invitationId',
    '/workspaces/:workspaceId/invitations/:invitationId/*'
  ],
  workspaceId: ['/workspaces/:workspaceId', '/workspaces/:workspaceId/*'],
  uploadId: ['/uploads/:uploadId/*']
}

/** A router that answers 404 for a malformed UUID in any of `paths`' parameters. */
function routerCheckingUUIDs(paths: UUIDParameterPaths) {
  const router = new Hono<CloudAPIEnvironment>()
  for (const [name, patterns] of Object.entries(paths)) {
    for (const pattern of patterns) router.use(pattern, uuidParameter(name))
  }
  return router
}

export function createCloudAPIRouter(services: CloudAPIServices) {
  return routerCheckingUUIDs(UUID_PARAMETER_PATHS)
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
      createAIRoutes(
        services.aiTokens,
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
