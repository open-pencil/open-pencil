import { createGlobalState } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { CloudSocialProvider } from '@open-pencil/cloud/client'
import type { WorkspaceEntitlements } from '@open-pencil/cloud/contract'

import { readStoragePreferences, writeStoragePreference } from '../preferences'
import { normalizeCloudServerURL, type CloudConnectionSnapshot } from './connection'
import {
  activeCloudConnectionProfile,
  connectCloudProfile,
  disconnectCloudProfile,
  selectCloudConnectionProfile,
  updateCloudConnectionWorkspace,
  useCloudConnectionProfiles,
  type CloudConnectionKind
} from './profiles'
import { cloudConnectionService } from './service'

const PROVIDER_ID = 'openpencil-cloud'
const SERVER_URL_FIELD = 'server-url'

function createCloudStorageSettings() {
  const { profiles, activeProfileId } = useCloudConnectionProfiles()
  const activeProfile = computed(() => activeCloudConnectionProfile())
  const initialProfile = activeCloudConnectionProfile()
  const serverURL = ref(
    initialProfile === null
      ? (readStoragePreferences(PROVIDER_ID)[SERVER_URL_FIELD] ?? '')
      : initialProfile.serverURL
  )
  const state = ref<CloudConnectionSnapshot | null>(null)
  const entitlements = shallowRef<WorkspaceEntitlements | null>(null)
  const entitlementsLoading = ref(false)
  const entitlementsError = ref<string | null>(null)
  const isLoading = computed(() => state.value?.status === 'discovering')
  cloudConnectionService.subscribe((connection) => {
    let currentURL: string
    try {
      currentURL = normalizeCloudServerURL(serverURL.value)
    } catch {
      return
    }
    if (connection.serverURL === currentURL) state.value = connection
  })

  const workspaceOptions = computed(() =>
    (state.value?.workspaces ?? []).map((workspace) => ({
      value: workspace.id,
      label: workspace.name
    }))
  )

  async function addConnection(kind: CloudConnectionKind, customURL?: string): Promise<void> {
    const profile = await connectCloudProfile({ kind, serverURL: customURL })
    serverURL.value = profile.serverURL
    await connect()
  }

  async function selectConnection(id: string): Promise<void> {
    const profile = selectCloudConnectionProfile(id)
    serverURL.value = profile.serverURL
    state.value = cloudConnectionService.get(profile.serverURL)
    if (!state.value) await connect()
    else await refreshEntitlements()
  }

  function disconnectConnection(id: string): void {
    const profile = profiles.value.find((candidate) => candidate.id === id)
    if (profile) cloudConnectionService.disconnect(profile.serverURL)
    disconnectCloudProfile(id)
    const active = activeCloudConnectionProfile()
    serverURL.value = active?.serverURL ?? ''
    state.value = active ? cloudConnectionService.get(active.serverURL) : null
  }

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
    const active = activeCloudConnectionProfile()
    if (active) updateCloudConnectionWorkspace(active.id, workspaceId)
    await refreshEntitlements()
  }

  return {
    profiles,
    activeProfileId,
    activeProfile,
    serverURL,
    state,
    isLoading,
    workspaceOptions,
    entitlements,
    entitlementsLoading,
    entitlementsError,
    addConnection,
    selectConnection,
    disconnectConnection,
    connect,
    signIn,
    signOut,
    selectWorkspace,
    refreshEntitlements
  }
}

export const useCloudStorageSettings = createGlobalState(createCloudStorageSettings)
