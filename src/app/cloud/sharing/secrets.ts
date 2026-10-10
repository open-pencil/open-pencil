import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'

import { CLOUD_STORAGE_PROVIDER_ID } from '../sessions/token'

/**
 * A share link's secret, kept only on the device that made it: the server stores a hash, so
 * another device has to reset the link before it can copy one.
 */
const secretRef = (serverId: string, shareId: string) =>
  credentialRef(CLOUD_STORAGE_PROVIDER_ID, `share.${shareId}`, serverId)

export function readShareSecret(serverId: string, shareId: string): Promise<string | null> {
  return appCredentialServices.resolver.resolve(secretRef(serverId, shareId))
}

export function saveShareSecret(serverId: string, shareId: string, secret: string) {
  return appCredentialServices.manager.set(secretRef(serverId, shareId), secret)
}

export function clearShareSecret(serverId: string, shareId: string) {
  return appCredentialServices.manager.clear(secretRef(serverId, shareId))
}
