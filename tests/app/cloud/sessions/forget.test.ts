import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { forgetCloudAccountCopies } from '@/app/cloud/sessions/forget'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import { clearRecentFiles, recentFiles, rememberRecentStorageDocument } from '@/app/recent-files'
import {
  createMemoryLocalCanvasStore,
  getLocalCanvasStore,
  resetLocalCanvasStoreForTests,
  type LocalSyncStatus
} from '@/app/storage/local-store'

async function keepCopy(id: string, profileId: string, syncStatus: LocalSyncStatus) {
  await getLocalCanvasStore().writeCanvas({
    id,
    providerId: CLOUD_STORAGE_PROVIDER_ID,
    profileId,
    containerId: 'workspace-1',
    name: id,
    figBytes: new Uint8Array(1),
    syncStatus
  })
}

beforeEach(() => resetLocalCanvasStoreForTests(createMemoryLocalCanvasStore()))
afterEach(() => clearRecentFiles())

describe('forgetting a Cloud account on this device', () => {
  test("drops the server's recent documents and keeps everything else", async () => {
    const document = { providerId: CLOUD_STORAGE_PROVIDER_ID, containerId: 'workspace-1' }
    rememberRecentStorageDocument({ ...document, profileId: 'a', documentId: 'd1' }, 'A', 'design')
    rememberRecentStorageDocument({ ...document, profileId: 'b', documentId: 'd2' }, 'B', 'design')
    rememberRecentStorageDocument(
      { providerId: 's3-compatible', documentId: 'd3' },
      'Bucket',
      'design'
    )

    await forgetCloudAccountCopies('a')

    expect(recentFiles.value.map(({ name }) => name)).toEqual(['Bucket', 'B'])
  })

  test('removes uploaded copies and keeps ones with changes still to upload', async () => {
    await keepCopy('uploaded', 'a', 'synced')
    await keepCopy('unsent', 'a', 'pending')
    await keepCopy('other-server', 'b', 'synced')

    await forgetCloudAccountCopies('a')

    const kept = await getLocalCanvasStore().listMetas(true)
    expect(kept.map(({ id }) => id).toSorted()).toEqual(['other-server', 'unsent'])
  })
})
