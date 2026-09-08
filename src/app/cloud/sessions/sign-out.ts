import { signOutFromCloud } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'

export type CloudSignOutDependencies = {
  resolve(profileId: string): Promise<string | null>
  revoke: typeof signOutFromCloud
  clear(profileId: string): Promise<void>
}

const defaults: CloudSignOutDependencies = {
  resolve: (id) =>
    appCredentialServices.resolver.resolve(credentialRef('openpencil-cloud', 'session', id)),
  revoke: signOutFromCloud,
  clear: (id) =>
    appCredentialServices.manager.clear(credentialRef('openpencil-cloud', 'session', id))
}

/** Revoke before clearing so failed/offline sign-out can be retried with the same credential. */
export async function signOutCloudSession(
  discovery: CloudDiscovery,
  profileId: string,
  dependencies: CloudSignOutDependencies = defaults
): Promise<void> {
  const token = await dependencies.resolve(profileId)
  await dependencies.revoke(discovery, { accessToken: token ?? undefined })
  await dependencies.clear(profileId)
}
