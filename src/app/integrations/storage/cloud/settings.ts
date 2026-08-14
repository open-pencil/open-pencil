import { useAsyncState } from '@vueuse/core'
import { computed, ref } from 'vue'

import {
  createCloudAPIClient,
  discoverCloud,
  type CloudSocialProvider
} from '@open-pencil/cloud/client'

import { readStoragePreferences, writeStoragePreference } from '../preferences'

const PROVIDER_ID = 'openpencil-cloud'
const SERVER_URL_FIELD = 'server-url'
const WORKSPACE_ID_FIELD = 'workspace-id'

export function useCloudStorageSettings() {
  const serverURL = ref(readStoragePreferences(PROVIDER_ID)[SERVER_URL_FIELD] ?? '')
  const discoveryState = useAsyncState(
    async () => {
      const url = serverURL.value.trim()
      if (!url) return null
      const discovery = await discoverCloud(url)
      const client = createCloudAPIClient(discovery.apiURL)
      const session = await client.getSession()
      const workspaces = session ? (await client.listWorkspaces()).workspaces : []
      return { discovery, session, workspaces }
    },
    null,
    { immediate: false, resetOnExecute: true }
  )

  const workspaceOptions = computed(() =>
    (discoveryState.state.value?.workspaces ?? []).map((workspace) => ({
      value: workspace.id,
      label: workspace.name
    }))
  )

  async function connect(): Promise<void> {
    writeStoragePreference(PROVIDER_ID, SERVER_URL_FIELD, serverURL.value)
    await discoveryState.execute()
    const workspaceId = readStoragePreferences(PROVIDER_ID)[WORKSPACE_ID_FIELD]
    if (
      !workspaceId ||
      !discoveryState.state.value?.workspaces.some((workspace) => workspace.id === workspaceId)
    ) {
      const first = discoveryState.state.value?.workspaces[0]
      if (first) writeStoragePreference(PROVIDER_ID, WORKSPACE_ID_FIELD, first.id)
    }
  }

  async function signIn(provider: CloudSocialProvider): Promise<void> {
    const discovery = discoveryState.state.value?.discovery
    if (!discovery) throw new Error('Connect to an OpenPencil Cloud server first')
    const { signInToCloud } = await import('@open-pencil/cloud/client')
    await signInToCloud(discovery, provider)
  }

  async function signOut(): Promise<void> {
    const discovery = discoveryState.state.value?.discovery
    if (!discovery) return
    const { signOutFromCloud } = await import('@open-pencil/cloud/client')
    await signOutFromCloud(discovery)
    await discoveryState.execute()
  }

  return {
    serverURL,
    state: discoveryState.state,
    isLoading: discoveryState.isLoading,
    workspaceOptions,
    connect,
    signIn,
    signOut
  }
}
