import { createGlobalState } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { cloudSignInURL } from '@open-pencil/cloud/client'
import type { WorkspaceEntitlements } from '@open-pencil/cloud/contract'
import { IS_TAURI } from '@open-pencil/core/constants'

import {
  activeCloudConnectionProfile,
  connectCloudProfile,
  disconnectCloudProfile,
  selectCloudConnectionProfile,
  updateCloudConnectionWorkspace,
  useCloudConnectionProfiles,
  type CloudConnectionKind
} from '@/app/cloud/instances/profiles'
import {
  normalizeCloudServerURL,
  type CloudConnectionSnapshot
} from '@/app/cloud/sessions/connection'
import { createDeviceAuthorizationSession } from '@/app/cloud/sessions/device-authorization'
import { cloudConnectionService } from '@/app/cloud/sessions/service'
import { signOutCloudSession } from '@/app/cloud/sessions/sign-out'
import {
  readStoragePreferences,
  writeStoragePreference
} from '@/app/integrations/storage/preferences'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'

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
  const deviceAuthorization = createDeviceAuthorizationSession()
  const deviceAuthByConnection = deviceAuthorization.state
  const cancelDeviceAuth = deviceAuthorization.cancel
  let entitlementsGeneration = 0
  const entitlements = shallowRef<WorkspaceEntitlements | null>(null)
  const entitlementsLoading = ref(false)
  const entitlementsError = ref<'unavailable' | null>(null)
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
    entitlementsGeneration++
    entitlements.value = null
    entitlementsLoading.value = false
    entitlementsError.value = null
    const profile = selectCloudConnectionProfile(id)
    serverURL.value = profile.serverURL
    state.value = cloudConnectionService.get(profile.serverURL)
    if (!state.value) await connect()
    else await refreshEntitlements()
  }

  function disconnectConnection(id: string): void {
    entitlementsGeneration++
    entitlements.value = null
    entitlementsLoading.value = false
    entitlementsError.value = null
    cancelDeviceAuth(id)
    const profile = profiles.value.find((candidate) => candidate.id === id)
    if (profile) cloudConnectionService.disconnect(profile.serverURL)
    disconnectCloudProfile(id)
    const active = activeCloudConnectionProfile()
    serverURL.value = active?.serverURL ?? ''
    state.value = active ? cloudConnectionService.get(active.serverURL) : null
  }

  async function startDesktopDeviceAuth(
    discovery: NonNullable<CloudConnectionSnapshot['discovery']>,
    profile: NonNullable<ReturnType<typeof activeCloudConnectionProfile>>
  ) {
    if (!(await deviceAuthorization.authorize(discovery, profile))) return
    const connection = await cloudConnectionService.refresh(profile.serverURL)
    if (activeCloudConnectionProfile()?.id !== profile.id) return
    state.value = connection
    await refreshEntitlements()
  }

  async function refreshEntitlements(): Promise<void> {
    const generation = ++entitlementsGeneration
    const connection = state.value ? cloudConnectionService.get(state.value.serverURL) : null
    const workspaceId = state.value?.selectedWorkspaceId
    const isCurrent = () =>
      generation === entitlementsGeneration &&
      connection?.serverURL === serverURL.value &&
      workspaceId === state.value?.selectedWorkspaceId
    if (!connection?.client || !workspaceId || !state.value?.session) {
      entitlementsLoading.value = false
      entitlements.value = null
      entitlementsError.value = null
      return
    }
    entitlementsLoading.value = true
    entitlementsError.value = null
    try {
      const result = await connection.client.getWorkspaceEntitlements(workspaceId)
      if (isCurrent()) entitlements.value = result
    } catch {
      if (!isCurrent()) return
      entitlements.value = null
      entitlementsError.value = 'unavailable'
    } finally {
      if (isCurrent()) entitlementsLoading.value = false
    }
  }

  async function connect(): Promise<void> {
    const normalized = normalizeCloudServerURL(serverURL.value)
    serverURL.value = normalized
    writeStoragePreference(PROVIDER_ID, SERVER_URL_FIELD, normalized)
    const connection = await cloudConnectionService.refresh(normalized)
    if (serverURL.value !== normalized) return
    state.value = connection
    await refreshEntitlements()
  }

  async function signIn(): Promise<void> {
    const discovery = state.value?.discovery
    const profile = activeCloudConnectionProfile()
    if (!discovery || !profile) throw new Error('Connect to an OpenPencil Cloud server first')
    if (IS_TAURI) {
      await startDesktopDeviceAuth(discovery, profile)
      return
    }
    globalThis.location.assign(cloudSignInURL(discovery, globalThis.location.href))
  }

  async function reauthenticate(): Promise<void> {
    const discovery = state.value?.discovery
    const profile = activeCloudConnectionProfile()
    if (!discovery || !profile) throw new Error('Connect to an OpenPencil Cloud server first')
    await deviceAuthorization.cancelAndWait(profile.id)
    await appCredentialServices.manager.clear(
      credentialRef('openpencil-cloud', 'session', profile.id)
    )
    await signIn()
  }

  async function reconnect(): Promise<void> {
    await connect()
  }

  async function signOut(): Promise<void> {
    const discovery = state.value?.discovery
    const profile = activeCloudConnectionProfile()
    if (!discovery || !profile) return
    const targetURL = profile.serverURL
    await deviceAuthorization.cancelAndWait(profile.id)
    await signOutCloudSession(discovery, profile.id)
    cloudConnectionService.disconnect(targetURL)
    const connection = await cloudConnectionService.refresh(targetURL)
    if (activeCloudConnectionProfile()?.id !== profile.id) return
    state.value = connection
    await refreshEntitlements()
  }

  async function selectWorkspace(workspaceId: string): Promise<void> {
    cloudConnectionService.selectWorkspace(serverURL.value, workspaceId)
    const active = activeCloudConnectionProfile()
    if (active) updateCloudConnectionWorkspace(active.id, workspaceId)
    await refreshEntitlements()
  }

  return {
    deviceAuthByConnection,
    cancelDeviceAuth,
    startDesktopDeviceAuth,
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
    reauthenticate,
    reconnect,
    signOut,
    selectWorkspace,
    refreshEntitlements
  }
}

export const useCloudStorageSettings = createGlobalState(createCloudStorageSettings)
