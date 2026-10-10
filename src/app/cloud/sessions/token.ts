import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'

/** Cloud servers are storage profiles of this provider; their sessions are its credential. */
export const CLOUD_STORAGE_PROVIDER_ID = 'openpencil-cloud'
export const CLOUD_SESSION_FIELD = 'session'

const sessionRef = (serverId: string) =>
  credentialRef(CLOUD_STORAGE_PROVIDER_ID, CLOUD_SESSION_FIELD, serverId)

/**
 * The bearer token from signing in with a device code. Browsers signed in through the server's
 * own pages have none and use its session cookie instead.
 */
export function readCloudSessionToken(serverId: string): Promise<string | null> {
  return appCredentialServices.resolver.resolve(sessionRef(serverId))
}

export function saveCloudSessionToken(serverId: string, token: string): Promise<void> {
  return appCredentialServices.manager.set(sessionRef(serverId), token)
}

export function clearCloudSessionToken(serverId: string): Promise<void> {
  return appCredentialServices.manager.clear(sessionRef(serverId))
}
