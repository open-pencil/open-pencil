import { commentsContract, sharedCommentsContract } from './comments'
import { documentsContract } from './documents'
import { versionsContract } from './versions'

export { commentsContract, sharedCommentsContract } from './comments'
export { documentsContract } from './documents'
export { versionsContract } from './versions'
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
  versions: versionsContract,
  comments: commentsContract
}

/** The Cloud API that anyone may call, through a share link or the community gallery. */
export const publicCloudAPIContract = { sharedComments: sharedCommentsContract }
