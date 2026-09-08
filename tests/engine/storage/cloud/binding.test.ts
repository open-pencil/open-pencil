import { afterEach, expect, test } from 'bun:test'

import { cloudDocumentClient } from '@/app/cloud/documents/client'
import {
  connectCloudProfile,
  updateCloudConnectionWorkspace,
  useCloudConnectionProfiles
} from '@/app/cloud/instances/profiles'
import { cloudConnectionService } from '@/app/cloud/sessions/service'
import {
  createBoundStorageAdapter,
  storagePreferencesForBinding
} from '@/app/integrations/storage/binding'
import {
  readStoragePreferences,
  writeStoragePreference
} from '@/app/integrations/storage/preferences'

const profiles = useCloudConnectionProfiles()
const originalProfiles = [...profiles.profiles.value]
const originalActive = profiles.activeProfileId.value
const preferences = { ...readStoragePreferences('openpencil-cloud') }
afterEach(() => {
  profiles.profiles.value = originalProfiles
  profiles.activeProfileId.value = originalActive
  for (const field of ['server-url', 'workspace-id'])
    writeStoragePreference('openpencil-cloud', field, preferences[field] ?? '')
})

test('bound storage resolves its owner rather than current selection or mirrored preferences', async () => {
  const owner = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://binding-owner.example'
  })
  await connectCloudProfile({ kind: 'self-hosted', serverURL: 'https://binding-selected.example' })
  const binding = {
    providerId: 'openpencil-cloud' as const,
    connectionId: owner.id,
    workspaceId: 'own-workspace',
    documentId: 'document'
  }
  const resolved = storagePreferencesForBinding(binding)
  writeStoragePreference('openpencil-cloud', 'workspace-id', 'another-workspace')
  expect(resolved).toEqual({ 'server-url': owner.serverURL, 'workspace-id': 'own-workspace' })
  expect(storagePreferencesForBinding(binding)).toEqual(resolved)
  expect(() => createBoundStorageAdapter({ ...binding, connectionId: 'missing' })).toThrow(
    'unavailable'
  )
})

test('document access rejects a missing owner rather than using selected instance preferences', async () => {
  await connectCloudProfile({ kind: 'self-hosted', serverURL: 'https://wrong-destination.example' })
  await expect(
    cloudDocumentClient({
      providerId: 'openpencil-cloud',
      connectionId: 'missing-owner',
      workspaceId: 'workspace',
      documentId: 'document'
    })
  ).rejects.toThrow('unavailable')
})

test('connection session initializes workspace from its own persisted profile', async () => {
  const owner = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://profile-owner.example'
  })
  updateCloudConnectionWorkspace(owner.id, 'persisted-workspace')
  await connectCloudProfile({ kind: 'self-hosted', serverURL: 'https://profile-selected.example' })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error('Offline test')
  }) as typeof fetch
  try {
    await expect(cloudConnectionService.connect(owner.serverURL)).rejects.toThrow()
    expect(cloudConnectionService.get(owner.serverURL)?.selectedWorkspaceId).toBe(
      'persisted-workspace'
    )
  } finally {
    globalThis.fetch = originalFetch
    cloudConnectionService.disconnect(owner.serverURL)
  }
})
