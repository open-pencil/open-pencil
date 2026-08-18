import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import type { CloudSocialProvider } from '@open-pencil/cloud/client'
import type { WorkspaceEntitlements } from '@open-pencil/cloud/contract'

import { readStoragePreferences, writeStoragePreference } from '../preferences'
import { normalizeCloudServerURL, type CloudConnectionSnapshot } from './connection'
import { cloudConnectionService } from './service'

const PROVIDER_ID = 'openpencil-cloud'
const SERVER_URL_FIELD = 'server-url'
const WORKSPACE_ID_FIELD = 'workspace-id'

export function useCloudStorageSettings() {
  const serverURL = ref(readStoragePreferences(PROVIDER_ID)[SERVER_URL_FIELD] ?? '')
  const state = ref<CloudConnectionSnapshot | null>(null)
  const entitlements = shallowRef<WorkspaceEntitlements | null>(null)
  const entitlementsLoading = ref(false)
  const entitlementsError = ref<string | null>(null)
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

  async function refreshEntitlements(): Promise<void> {
    const connection = state.value ? cloudConnectionService.get(state.value.serverURL) : null
    const workspaceId = state.value?.selectedWorkspaceId
    if (!connection?.client || !workspaceId || !state.value?.session) {
      entitlements.value = null
      entitlementsError.value = null
      return
    }
    entitlementsLoading.value = true
    entitlementsError.value = null
    try {
      entitlements.value = await connection.client.getWorkspaceEntitlements(workspaceId)
    } catch (error) {
      entitlements.value = null
      entitlementsError.value = error instanceof Error ? error.message : String(error)
    } finally {
      entitlementsLoading.value = false
    }
  }

  async function connect(): Promise<void> {
    const normalized = normalizeCloudServerURL(serverURL.value)
    serverURL.value = normalized
    writeStoragePreference(PROVIDER_ID, SERVER_URL_FIELD, normalized)
    state.value = await cloudConnectionService.refresh(normalized)
    await refreshEntitlements()
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
    await refreshEntitlements()
  }

  async function selectWorkspace(workspaceId: string): Promise<void> {
    cloudConnectionService.selectWorkspace(serverURL.value, workspaceId)
    writeStoragePreference(PROVIDER_ID, WORKSPACE_ID_FIELD, workspaceId)
    await refreshEntitlements()
  }

  return {
    serverURL,
    state,
    isLoading,
    workspaceOptions,
    entitlements,
    entitlementsLoading,
    entitlementsError,
    connect,
    signIn,
    signOut,
    selectWorkspace,
    refreshEntitlements
  }
}
