import { readStoragePreferences, writeStoragePreferenceUnchecked } from '../preference-store'
import { createCloudConnectionService } from './connection'

const PROVIDER_ID = 'openpencil-cloud'
const SERVER_URL_FIELD = 'server-url'
const WORKSPACE_ID_FIELD = 'workspace-id'

export const cloudConnectionService = createCloudConnectionService({
  fetch: (input, init) => globalThis.fetch(input, init),
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
