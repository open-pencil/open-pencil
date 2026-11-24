import { documentsContract } from './documents'

export { documentsContract } from './documents'
export { CLOUD_API_ERROR_STATUS, cloudAPIErrorBodySchema, type CloudAPIErrorCode } from './errors'
export {
  documentParamsSchema,
  uploadParamsSchema,
  uuidParamSchema,
  workspaceParamsSchema
} from './params'

/** The Cloud API that signed-in clients call, as far as it is described by contract. */
export const cloudAPIContract = { documents: documentsContract }
