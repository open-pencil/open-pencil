import { commentsContract, sharedCommentsContract } from './comments'
import { communityContract } from './community'
import { documentsContract } from './documents'
import { publicSharingContract, sharingContract } from './sharing'
import { documentToolsContract } from './tools'
import { versionsContract } from './versions'
import { sessionContract, workspacesContract } from './workspaces'

export {
  adminContract,
  documentTakedownSchema,
  enrollmentReviewSchema,
  signInMethodMutationSchema,
  userMutationSchema,
  userRoleMutationSchema,
  type EnrollmentReview
} from './admin'
export { commentsContract, sharedCommentsContract } from './comments'
export { communityContract } from './community'
export { documentsContract } from './documents'
export { billingContract, servicesContract } from './services'
export { internalContract, setAccountEntitlementsSchema } from './internal'
export { publicSharingContract, sharingContract } from './sharing'
export { documentToolsContract } from './tools'
export { versionsContract } from './versions'
export { sessionContract, workspacesContract } from './workspaces'
export {
  CLOUD_API_ERROR_STATUS,
  DOCUMENT_ERRORS,
  cloudAPIErrorBodySchema,
  type CloudAPIErrorCode
} from './errors'
export {
  documentParamsSchema,
  documentVersionParamsSchema,
  uploadParamsSchema,
  uuidParamSchema,
  workspaceParamsSchema
} from './params'

/** The Cloud API that signed-in clients call, as far as it is described by contract. */
export const cloudAPIContract = {
  documents: documentsContract,
  documentTools: documentToolsContract,
  versions: versionsContract,
  comments: commentsContract,
  sharing: sharingContract,
  workspaces: workspacesContract,
  session: sessionContract
}

/** The Cloud API that anyone may call, through a share link or the community gallery. */
export const publicCloudAPIContract = {
  sharedComments: sharedCommentsContract,
  publicSharing: publicSharingContract,
  community: communityContract
}
