import { createAccountAPI } from './account'
import { createAdministrationAPI } from './administration'
import { createCloudCall, createPortalRouteClients, type CloudPortalClientOptions } from './request'

export { CloudPortalAPIError, type CloudPortalAPIErrorKind } from './request'
export type { CloudPortalClientOptions } from './request'

/** The account and administration routes Cloud's own web pages use, validated against the contract. */
export function createCloudPortalClient(options: CloudPortalClientOptions = {}) {
  const call = createCloudCall(options)
  const routes = createPortalRouteClients(options)
  return {
    ...createAccountAPI(call, routes),
    ...createAdministrationAPI(call, routes)
  }
}

export type CloudPortalClient = ReturnType<typeof createCloudPortalClient>
