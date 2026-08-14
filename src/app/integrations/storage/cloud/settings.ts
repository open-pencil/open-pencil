import { computed, onScopeDispose, ref } from 'vue'

import type { CloudSocialProvider } from '@open-pencil/cloud/client'

import { readStoragePreferences, writeStoragePreference } from '../preferences'
import { normalizeCloudServerURL, type CloudConnectionSnapshot } from './connection'
import { cloudConnectionService } from './service'

const PROVIDER_ID = 'openpencil-cloud'
const SERVER_URL_FIELD = 'server-url'
const WORKSPACE_ID_FIELD = 'workspace-id'

export function useCloudStorageSettings() {
  const serverURL = ref(readStoragePreferences(PROVIDER_ID)[SERVER_URL_FIELD] ?? '')
  const state = ref<CloudConnectionSnapshot | null>(null)
  const isLoading = computed(() => state.value?.status === 'discovering')
  const unsubscribe = cloudConnectionService.subscribe((connection) => {
    let currentURL: string
    try {
      currentURL = normalizeCloudServerURL(serverURL.value)
    } catch {
      return
    }
    if (connection.serverURL === currentURL) state.value = connection
  })
  onScopeDispose(unsubscribe)

  const workspaceOptions = computed(() =>
    (state.value?.workspaces ?? []).map((workspace) => ({
      value: workspace.id,
      label: workspace.name
    }))
  )

  async function connect(): Promise<void> {
    const normalized = normalizeCloudServerURL(serverURL.value)
    serverURL.value = normalized
    writeStoragePreference(PROVIDER_ID, SERVER_URL_FIELD, normalized)
    state.value = await cloudConnectionService.refresh(normalized)
  }

  async function signIn(provider: CloudSocialProvider): Promise<void> {
    const discovery = state.value?.discovery
    if (!discovery) throw new Error('Connect to an OpenPencil Cloud server first')
    const { signInToCloud } = await import('@open-pencil/cloud/client')
    await signInToCloud(discovery, provider)
  }

  async function signOut(): Promise<void> {
    const discovery = state.value?.discovery
    if (!discovery) return
    const { signOutFromCloud } = await import('@open-pencil/cloud/client')
    await signOutFromCloud(discovery)
    state.value = await cloudConnectionService.refresh(serverURL.value)
  }

  function selectWorkspace(workspaceId: string): void {
    cloudConnectionService.selectWorkspace(serverURL.value, workspaceId)
    writeStoragePreference(PROVIDER_ID, WORKSPACE_ID_FIELD, workspaceId)
  }

  return {
    serverURL,
    state,
    isLoading,
    workspaceOptions,
    connect,
    signIn,
    signOut,
    selectWorkspace
  }
}
