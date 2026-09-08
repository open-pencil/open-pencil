import {
  listCloudConnectionProfiles,
  updateCloudConnectionWorkspace
} from '@/app/cloud/instances/profiles'
import { createCloudConnectionService } from '@/app/cloud/sessions/connection'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'

export const cloudConnectionService = createCloudConnectionService({
  fetch: (input, init) => globalThis.fetch(input, init),
  async readAccessToken(serverURL) {
    const profile = listCloudConnectionProfiles().find(
      (candidate) => candidate.serverURL === serverURL
    )
    if (!profile) return null
    return appCredentialServices.resolver.resolve(
      credentialRef('openpencil-cloud', 'session', profile.id)
    )
  },
  async clearAccessToken(serverURL) {
    const profile = listCloudConnectionProfiles().find(
      (candidate) => candidate.serverURL === serverURL
    )
    if (!profile) return
    await appCredentialServices.manager.clear(
      credentialRef('openpencil-cloud', 'session', profile.id)
    )
  },
  readSelectedWorkspace(serverURL) {
    return (
      listCloudConnectionProfiles().find((profile) => profile.serverURL === serverURL)
        ?.selectedWorkspaceId ?? null
    )
  },
  writeSelectedWorkspace(serverURL, workspaceId) {
    const profile = listCloudConnectionProfiles().find(
      (candidate) => candidate.serverURL === serverURL
    )
    if (profile) updateCloudConnectionWorkspace(profile.id, workspaceId)
  }
})
