import type { CloudAPIEnvironment } from '#cloud/server/api/types'
import type { CollaborationTicketService } from '#cloud/server/collaboration'
import { createCollaborationRoutes } from '#cloud/server/collaboration'
import type { DocumentService } from '#cloud/server/documents'
import { createDocumentRoutes } from '#cloud/server/documents'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { createDocumentSharingRoutes } from '#cloud/server/sharing'
import type { WorkspaceService } from '#cloud/server/workspaces'
import { createWorkspaceRoutes } from '#cloud/server/workspaces'
import { Hono } from 'hono'

export type CloudAPIServices = {
  collaboration: CollaborationTicketService
  documents: DocumentService
  sharing: DocumentSharingService
  workspaces: WorkspaceService
}

export function createCloudAPIRouter(services: CloudAPIServices) {
  return new Hono<CloudAPIEnvironment>()
    .get('/session', (context) => context.json({ user: context.get('actor') }))
    .route('/', createCollaborationRoutes(services.collaboration))
    .route('/', createDocumentRoutes(services.documents))
    .route('/', createDocumentSharingRoutes(services.sharing))
    .route('/workspaces', createWorkspaceRoutes(services.workspaces))
}

export type CloudAPI = ReturnType<typeof createCloudAPIRouter>
