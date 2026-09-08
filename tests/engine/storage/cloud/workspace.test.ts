import { afterEach, expect, spyOn, test } from 'bun:test'

import {
  connectCloudProfile,
  updateCloudConnectionWorkspace,
  useCloudConnectionProfiles
} from '@/app/cloud/instances/profiles'
import {
  activeStorageProviderID,
  readStoragePreferences,
  writeStoragePreference
} from '@/app/integrations/storage/preferences'
import { storageProviderRegistry } from '@/app/integrations/storage/providers'
import type { StorageDocument } from '@/app/integrations/storage/types'
import { storageCanvasId } from '@/app/storage/id'
import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'

const profiles = useCloudConnectionProfiles()
const originalProfiles = [...profiles.profiles.value]
const originalActive = profiles.activeProfileId.value
const originalProvider = activeStorageProviderID.value
const originalPreferences = { ...readStoragePreferences('openpencil-cloud') }

afterEach(() => {
  profiles.profiles.value = originalProfiles
  profiles.activeProfileId.value = originalActive
  activeStorageProviderID.value = originalProvider
  for (const field of ['server-url', 'workspace-id'])
    writeStoragePreference('openpencil-cloud', field, originalPreferences[field] ?? '')
  resetLocalCanvasStoreForTests()
})

async function setup() {
  const profile = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://workspace.example.com'
  })
  const workspaceId = crypto.randomUUID()
  updateCloudConnectionWorkspace(profile.id, workspaceId)
  activeStorageProviderID.value = 'openpencil-cloud'
  const store = createMemoryLocalCanvasStore()
  resetLocalCanvasStoreForTests(store)
  const documentId = crypto.randomUUID()
  const canvasId = storageCanvasId({
    providerId: 'openpencil-cloud',
    connectionId: profile.id,
    documentId
  })
  await store.writeCanvas({
    id: canvasId,
    providerId: 'openpencil-cloud',
    connectionId: profile.id,
    workspaceId,
    documentId,
    name: 'Design',
    updatedAt: '2026-01-01',
    figBytes: new Uint8Array([1]),
    syncStatus: 'synced'
  })
  return { store, profile, workspaceId, documentId, canvasId }
}

function mockListing(listDocuments: () => Promise<StorageDocument[]>) {
  return spyOn(storageProviderRegistry, 'createAdapter').mockReturnValue({
    testConnection: async () => ({ ok: true, message: '' }),
    listDocuments,
    getDocument: async () => new Uint8Array(),
    putDocument: async () => undefined,
    deleteDocument: async () => undefined,
    getUsage: async () => ({ bytesUsed: 0, objectCount: 0, documentCount: 0 })
  })
}

test('Cloud workspace reconciles remote IDs without duplicating replicas or mixing instances', async () => {
  const { store, documentId, canvasId } = await setup()
  await store.writeCanvas({
    id: 'other-local',
    providerId: 'openpencil-cloud',
    connectionId: 'other-instance',
    workspaceId: 'other-workspace',
    documentId: 'other-document',
    name: 'Private other design',
    figBytes: new Uint8Array([2])
  })
  const remote = { id: documentId, name: 'Design', updatedAt: '2026-01-01' }
  const factory = mockListing(async () => [remote])
  try {
    const source = createStorageWorkspaceSource(() => undefined)
    expect(await source.refresh()).toEqual([remote])
    expect(await store.readFig(canvasId)).toEqual(new Uint8Array([1]))
    expect(await store.listMetas(true)).toHaveLength(2)
  } finally {
    factory.mockRestore()
  }
})

test('Cloud workspace discards a listing when its selected workspace changes in flight', async () => {
  const { store, profile } = await setup()
  let release: ((documents: StorageDocument[]) => void) | undefined
  let started: (() => void) | undefined
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  const response = new Promise<StorageDocument[]>((resolve) => {
    release = resolve
  })
  const factory = mockListing(() => {
    started?.()
    return response
  })
  const snapshots: unknown[] = []
  try {
    const source = createStorageWorkspaceSource((snapshot) => snapshots.push(snapshot))
    const refreshing = source.refresh()
    await requested
    updateCloudConnectionWorkspace(profile.id, crypto.randomUUID())
    release?.([{ id: crypto.randomUUID(), name: 'Stale', updatedAt: '2026-01-01' }])
    expect(await refreshing).toBeNull()
    expect(snapshots).toEqual([])
    expect(await store.listMetas(true)).toHaveLength(1)
  } finally {
    factory.mockRestore()
  }
})
