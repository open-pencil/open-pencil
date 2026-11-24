import {
  createCommentProcedures,
  createSharedCommentProcedures
} from '#cloud/server/comments/procedures'
import { createDocumentProcedures } from '#cloud/server/documents/procedures'
import { createDocumentVersionProcedures } from '#cloud/server/documents/versions/procedures'

import type { CloudAPIServices } from './router'

/** The signed-in API's routes that the contract describes (`cloudAPIContract`). */
export function createCloudAPIProcedures(services: CloudAPIServices) {
  return {
    documents: createDocumentProcedures(services.documents),
    versions: createDocumentVersionProcedures(services.versions),
    comments: createCommentProcedures(services.comments)
  }
}

/** The public API's routes that the contract describes (`publicCloudAPIContract`). */
export function createPublicCloudAPIProcedures(services: CloudAPIServices) {
  return {
    sharedComments: createSharedCommentProcedures(services.comments, services.resolveSession)
  }
}
