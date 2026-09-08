import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import {
  connectCloudProfile,
  useCloudConnectionProfiles
} from '@/app/cloud/instances/profiles'
import {
  readStoragePreferences,
  writeStoragePreference
} from '@/app/integrations/storage/preferences'
import { storageProviderRegistry } from '@/app/integrations/storage/providers'
import { storageCanvasId } from '@/app/storage/id'
import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { kickSyncEngine } from '@/app/storage/sync/engine'
import { createMemoryOutbox, resetOutboxForTests } from '@/app/storage/sync/outbox'

const profiles = useCloudConnectionProfiles()
const originalProfiles = [...profiles.profiles.value]
const originalActive = profiles.activeProfileId.value
const originalPreferences = { ...readStoragePreferences('openpencil-cloud') }

afterEach(() => {
  profiles.profiles.value = originalProfiles
  profiles.activeProfileId.value = originalActive
  for (const field of ['server-url', 'workspace-id']) {
    writeStoragePreference('openpencil-cloud', field, originalPreferences[field] ?? '')
  }
  resetLocalCanvasStoreForTests()
  resetOutboxForTests()
})

describe('Cloud outbox identity', () => {
  test('reads and updates the local replica while uploading to its remote document ID', async () => {
    const profile = await connectCloudProfile({
      kind: 'self-hosted',
      serverURL: 'https://sync.example.com'
    })
    const documentId = crypto.randomUUID()
    const workspaceId = crypto.randomUUID()
    const canvasId = storageCanvasId({
      providerId: 'openpencil-cloud',
      connectionId: profile.id,
      documentId
    })
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    resetLocalCanvasStoreForTests(store)
    resetOutboxForTests(outbox)
    const bytes = new Uint8Array([1, 2, 3])
    await store.writeCanvas({
      id: canvasId,
      providerId: 'openpencil-cloud',
      connectionId: profile.id,
      workspaceId,
      documentId,
      name: 'Offline design',
      figBytes: bytes,
      revision: 1,
      syncStatus: 'pending'
    })
    await outbox.enqueue({ canvasId, type: 'putCanvas', revision: 1 })
    const uploads: string[] = []
    const factory = spyOn(storageProviderRegistry, 'createAdapter').mockImplementation(
      (providerId, runtime) => {
        expect(providerId).toBe('openpencil-cloud')
        expect(runtime.preferences).toEqual({
          'server-url': profile.serverURL,
          'workspace-id': workspaceId
        })
        return {
          testConnection: async () => ({ ok: true, message: '' }),
          listDocuments: async () => [],
          getDocument: async () => bytes,
          deleteDocument: async () => undefined,
          getUsage: async () => ({
            bytesUsed: 0,
            objectCount: 0,
            documentCount: 0
          }),
          async putDocument(id, uploaded) {
            uploads.push(id)
            expect(uploaded).toEqual(bytes)
            return { remoteRevisionId: 'committed-revision' }
          }
        }
      }
    )
    try {
      await kickSyncEngine()
      expect(uploads).toEqual([documentId])
      expect(await outbox.list()).toEqual([])
      expect(await store.getMeta(canvasId)).toMatchObject({
        syncStatus: 'synced',
        remoteRevisionId: 'committed-revision'
      })
      expect(await store.getMeta(documentId)).toBeNull()
    } finally {
      factory.mockRestore()
    }
  })
})
