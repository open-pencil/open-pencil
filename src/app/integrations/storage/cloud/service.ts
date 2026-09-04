import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'

import { readStoragePreferences, writeStoragePreferenceUnchecked } from '../preference-store'
import { createCloudConnectionService } from './connection'
import { listCloudConnectionProfiles } from './profiles'

const PROVIDER_ID = 'openpencil-cloud'
const SERVER_URL_FIELD = 'server-url'
const WORKSPACE_ID_FIELD = 'workspace-id'

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
    const preferences = readStoragePreferences(PROVIDER_ID)
    return preferences[SERVER_URL_FIELD] === serverURL
      ? (preferences[WORKSPACE_ID_FIELD] ?? null)
      : null
  },
  writeSelectedWorkspace(serverURL, workspaceId) {
    const preferences = readStoragePreferences(PROVIDER_ID)
    if (preferences[SERVER_URL_FIELD] !== serverURL) return
    writeStoragePreferenceUnchecked(PROVIDER_ID, WORKSPACE_ID_FIELD, workspaceId ?? '')
  }
})
