import { useLocalStorage } from '@vueuse/core'

import { writeStoragePreference } from '../preferences'
import { normalizeCloudServerURL } from './connection'

export const OFFICIAL_OPENPENCIL_CLOUD_URL = 'https://cloud.openpencil.dev'
const PROVIDER_ID = 'openpencil-cloud'

export type CloudConnectionKind = 'official' | 'self-hosted'

export type CloudConnectionProfile = {
  id: string
  kind: CloudConnectionKind
  label: string
  serverURL: string
  selectedWorkspaceId: string | null
}

const profiles = useLocalStorage<CloudConnectionProfile[]>('open-pencil:cloud:connections', [])
const activeProfileId = useLocalStorage<string | null>('open-pencil:cloud:active-connection', null)

function defaultLabel(kind: CloudConnectionKind, serverURL: string): string {
  return kind === 'official' ? 'OpenPencil Cloud' : new URL(serverURL).hostname
}

function activatePreferences(profile: CloudConnectionProfile): void {
  writeStoragePreference(PROVIDER_ID, 'server-url', profile.serverURL)
  writeStoragePreference(PROVIDER_ID, 'workspace-id', profile.selectedWorkspaceId ?? '')
}

export function listCloudConnectionProfiles(): readonly CloudConnectionProfile[] {
  return profiles.value
}

export function activeCloudConnectionProfile(): CloudConnectionProfile | null {
  return profiles.value.find((profile) => profile.id === activeProfileId.value) ?? null
}

export function connectCloudProfile(input: {
  kind: CloudConnectionKind
  serverURL?: string
  label?: string
}): CloudConnectionProfile {
  const serverURL = normalizeCloudServerURL(
    input.kind === 'official' ? OFFICIAL_OPENPENCIL_CLOUD_URL : (input.serverURL ?? '')
  )
  const existing = profiles.value.find((profile) => profile.serverURL === serverURL)
  if (existing) {
    selectCloudConnectionProfile(existing.id)
    return existing
  }
  const profile: CloudConnectionProfile = {
    id: crypto.randomUUID(),
    kind: input.kind,
    label: input.label?.trim() || defaultLabel(input.kind, serverURL),
    serverURL,
    selectedWorkspaceId: null
  }
  profiles.value = [...profiles.value, profile]
  selectCloudConnectionProfile(profile.id)
  return profile
}

export function selectCloudConnectionProfile(id: string): CloudConnectionProfile {
  const profile = profiles.value.find((candidate) => candidate.id === id)
  if (!profile) throw new Error('Cloud connection does not exist')
  activeProfileId.value = profile.id
  activatePreferences(profile)
  return profile
}

export function updateCloudConnectionWorkspace(id: string, workspaceId: string | null): void {
  profiles.value = profiles.value.map((profile) =>
    profile.id === id ? { ...profile, selectedWorkspaceId: workspaceId } : profile
  )
  const active = activeCloudConnectionProfile()
  if (active) activatePreferences(active)
}

export function disconnectCloudProfile(id: string): void {
  profiles.value = profiles.value.filter((profile) => profile.id !== id)
  if (activeProfileId.value !== id) return
  activeProfileId.value = profiles.value[0]?.id ?? null
  const next = activeCloudConnectionProfile()
  if (next) activatePreferences(next)
  else {
    writeStoragePreference(PROVIDER_ID, 'server-url', '')
    writeStoragePreference(PROVIDER_ID, 'workspace-id', '')
  }
}

export function useCloudConnectionProfiles() {
  return { profiles, activeProfileId }
}
