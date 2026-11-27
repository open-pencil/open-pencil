import {
  createCommentProcedures,
  createSharedCommentProcedures
} from '#cloud/server/comments/procedures'
import { createCommunityProcedures } from '#cloud/server/community/procedures'
import { createDocumentProcedures } from '#cloud/server/documents/procedures'
import { createDocumentVersionProcedures } from '#cloud/server/documents/versions/procedures'
import {
  createPublicSharingProcedures,
  createSharingProcedures
} from '#cloud/server/sharing/procedures'
import {
  createSessionProcedures,
  createWorkspaceProcedures
} from '#cloud/server/workspaces/procedures'

import type { CloudAPIServices } from './router'

/** The signed-in API's routes that the contract describes (`cloudAPIContract`). */
export function createCloudAPIProcedures(services: CloudAPIServices) {
  return {
    documents: createDocumentProcedures(services.documents),
    versions: createDocumentVersionProcedures(services.versions),
    comments: createCommentProcedures(services.comments),
    sharing: createSharingProcedures(services.sharing, services.collaboration),
    workspaces: createWorkspaceProcedures({
      workspaces: services.workspaces,
      members: services.workspaceMembers,
      entitlements: services.entitlements
    }),
    session: createSessionProcedures(services)
  }
}

/** The public API's routes that the contract describes (`publicCloudAPIContract`). */
export function createPublicCloudAPIProcedures(services: CloudAPIServices) {
  return {
    sharedComments: createSharedCommentProcedures(services.comments, services.resolveSession),
    publicSharing: createPublicSharingProcedures(services),
    community: createCommunityProcedures(services.community)
  }
}
