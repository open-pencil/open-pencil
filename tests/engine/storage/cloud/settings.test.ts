import { afterEach, expect, spyOn, test } from 'bun:test'

import { createCloudAPIClient } from '@open-pencil/cloud/client'
import type { WorkspaceEntitlements } from '@open-pencil/cloud/contract'

import type { CloudConnection } from '@/app/cloud/sessions/connection'
import {
  connectCloudProfile,
  useCloudConnectionProfiles
} from '@/app/cloud/instances/profiles'
import { cloudConnectionService } from '@/app/cloud/sessions/service'
import { useCloudStorageSettings } from '@/app/cloud/settings/use'
import {
  readStoragePreferences,
  writeStoragePreference
} from '@/app/integrations/storage/preferences'

const profiles = useCloudConnectionProfiles()
const originalProfiles = [...profiles.profiles.value]
const originalActive = profiles.activeProfileId.value
const originalPreferences = { ...readStoragePreferences('openpencil-cloud') }
const settings = useCloudStorageSettings()
const originalURL = settings.serverURL.value
const originalState = settings.state.value

afterEach(() => {
  profiles.profiles.value = originalProfiles
  profiles.activeProfileId.value = originalActive
  settings.serverURL.value = originalURL
  settings.state.value = originalState
  for (const field of ['server-url', 'workspace-id'])
    writeStoragePreference('openpencil-cloud', field, originalPreferences[field] ?? '')
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function connection(serverURL: string): CloudConnection {
  return {
    id: serverURL,
    serverURL,
    status: 'connected',
    discovery: null,
    session: { user: { userId: 'user', email: 'user@example.com', name: 'User' } },
    selectedWorkspaceId: 'workspace',
    workspaces: [],
    lastConnectedAt: null,
    error: null,
    client: createCloudAPIClient(`${serverURL}/api`)
  }
}

const entitlements: WorkspaceEntitlements = {
  features: {
    capabilityLinks: true,
    anonymousView: true,
    anonymousEdit: false,
    guestPresence: true,
    collaboration: true,
    revisionHistory: true
  },
  limits: { maximumFileBytes: 100, maximumStorageBytes: 200, maximumParticipants: 3 },
  usage: { committedStorageBytes: 0, reservedStorageBytes: 0 }
}

test('late entitlement response cannot replace the newly selected instance', async () => {
  const a = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://settings-a.example.com'
  })
  const b = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://settings-b.example.com'
  })
  const connectionA = connection(a.serverURL)
  const connectionB = connection(b.serverURL)
  if (!connectionA.client || !connectionB.client) throw new Error('Test clients missing')
  const response = deferred<WorkspaceEntitlements>()
  const first = spyOn(connectionA.client, 'getWorkspaceEntitlements').mockImplementation(
    () => response.promise
  )
  const second = spyOn(connectionB.client, 'getWorkspaceEntitlements').mockResolvedValue({
    ...entitlements,
    limits: { ...entitlements.limits, maximumStorageBytes: 999 }
  })
  const get = spyOn(cloudConnectionService, 'get').mockImplementation((url) =>
    url === a.serverURL ? connectionA : connectionB
  )
  try {
    const pending = settings.selectConnection(a.id)
    await settings.selectConnection(b.id)
    response.resolve(entitlements)
    await pending
    expect(settings.state.value?.serverURL).toBe(b.serverURL)
    expect(settings.entitlements.value?.limits.maximumStorageBytes).toBe(999)
    expect(settings.entitlementsLoading.value).toBe(false)
  } finally {
    first.mockRestore()
    second.mockRestore()
    get.mockRestore()
  }
})

test('late connection refresh cannot replace a newer selection', async () => {
  const a = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://refresh-a.example.com'
  })
  const b = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://refresh-b.example.com'
  })
  const response = deferred<CloudConnection>()
  const connectionB = { ...connection(b.serverURL), client: null }
  const refresh = spyOn(cloudConnectionService, 'refresh').mockImplementation(
    () => response.promise
  )
  const get = spyOn(cloudConnectionService, 'get').mockImplementation((url) =>
    url === b.serverURL ? connectionB : null
  )
  try {
    const pending = settings.selectConnection(a.id)
    await settings.selectConnection(b.id)
    response.resolve(connection(a.serverURL))
    await pending
    expect(settings.state.value?.serverURL).toBe(b.serverURL)
  } finally {
    refresh.mockRestore()
    get.mockRestore()
  }
})
