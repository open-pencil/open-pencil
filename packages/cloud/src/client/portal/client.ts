import { createAccountAPI } from './account'
import { createAdministrationAPI } from './administration'
import { createCloudRequest, type CloudPortalClientOptions } from './request'

export { CloudPortalAPIError, type CloudPortalAPIErrorKind } from './request'
export type { CloudPortalClientOptions } from './request'

/** The account and administration routes Cloud's own web pages use, validated against the contract. */
export function createCloudPortalClient(options: CloudPortalClientOptions = {}) {
  const request = createCloudRequest(options)
  return {
    ...createAccountAPI(request),
    ...createAdministrationAPI(request)
  }
}

export type CloudPortalClient = ReturnType<typeof createCloudPortalClient>
