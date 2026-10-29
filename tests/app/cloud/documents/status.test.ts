import { afterEach, describe, expect, test } from 'bun:test'

import { cloudSyncState, unsentCloudDocumentCount } from '@/app/cloud/documents/status'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'

afterEach(() => resetLocalCanvasStoreForTests())

describe('Cloud document status', () => {
  test('puts a choice to make or a failure ahead of anything in flight', () => {
    expect(cloudSyncState({ syncStatus: 'conflict' }, true, true)).toBe('conflict')
    expect(cloudSyncState({ syncStatus: 'error' }, true, true)).toBe('error')
  })

  test('shows an upload in flight, then waiting changes, offline or not', () => {
    expect(cloudSyncState({ syncStatus: 'pending' }, true, true)).toBe('uploading')
    expect(cloudSyncState({ syncStatus: 'pending' }, false, true)).toBe('pending')
    expect(cloudSyncState({ syncStatus: 'pending' }, false, false)).toBe('offline')
  })

  test('calls everything else saved', () => {
    expect(cloudSyncState({ syncStatus: 'synced' }, false, false)).toBe('synced')
    expect(cloudSyncState(null, false, true)).toBe('synced')
  })
})

describe('Removing a Cloud server', () => {
  test('counts this server’s documents whose changes have not reached it', async () => {
    const store = createMemoryLocalCanvasStore()
    resetLocalCanvasStoreForTests(store)
    const document = (id: string, profileId: string, syncStatus: 'synced' | 'pending' | 'error') =>
      store.writeCanvas({
        id,
        providerId: CLOUD_STORAGE_PROVIDER_ID,
        profileId,
        name: id,
        figBytes: new Uint8Array([1]),
        syncStatus
      })
    await document('saved', 'server-a', 'synced')
    await document('waiting', 'server-a', 'pending')
    await document('failed', 'server-a', 'error')
    await document('elsewhere', 'server-b', 'pending')
    await store.writeCanvas({
      id: 'bucket',
      providerId: 's3-compatible',
      name: 'bucket',
      figBytes: new Uint8Array([1]),
      syncStatus: 'pending'
    })

    expect(await unsentCloudDocumentCount('server-a')).toBe(2)
    expect(await unsentCloudDocumentCount('server-c')).toBe(0)
  })
})
