import { createAccountAPI } from './account'
import { createAdministrationAPI } from './administration'
import { createCloudRequest, type CloudAdminAPIClientOptions } from './request'

export { CloudAdminAPIError, type CloudAdminAPIErrorKind } from './request'
export type { CloudAdminAPIClientOptions } from './request'

export function createCloudAdminAPIClient(options: CloudAdminAPIClientOptions = {}) {
  const request = createCloudRequest(options)
  return {
    ...createAccountAPI(request),
    ...createAdministrationAPI(request)
  }
}

export type CloudAdminAPIClient = ReturnType<typeof createCloudAdminAPIClient>
export const cloudAdminAPI = createCloudAdminAPIClient()
