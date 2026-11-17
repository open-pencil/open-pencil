import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import { forgetCloudAccountCopies } from '@/app/cloud/sessions/forget'
import { signOutOfCloud } from '@/app/cloud/sessions/sign-out'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import { clearRecentFiles, recentFiles, rememberRecentStorageDocument } from '@/app/recent-files'
import {
  createMemoryLocalCanvasStore,
  getLocalCanvasStore,
  resetLocalCanvasStoreForTests,
  type LocalSyncStatus
} from '@/app/storage/local-store'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'

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
afterEach(async () => {
  for (const server of cloudServers.value) removeCloudServer(server.id)
  await clearRecentFiles()
})

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

  test('signs out even when the copies cannot be removed', async () => {
    const server = await addCloudServer({ kind: 'self-hosted', url: 'https://cloud.example.com' })
    rememberRecentStorageDocument(
      { providerId: CLOUD_STORAGE_PROVIDER_ID, profileId: server.id, documentId: 'd1' },
      'Ada',
      'design'
    )
    const store = createMemoryLocalCanvasStore()
    resetLocalCanvasStoreForTests({
      ...store,
      listMetas: () => Promise.reject(new Error('Storage is closed'))
    })
    spyOn(console, 'warn').mockImplementation(() => undefined)

    await signOutOfCloud(server.id, cloudDiscoveryFixture('https://cloud.example.com'), {
      revoke: () => Promise.resolve(),
      clear: () => Promise.resolve()
    })

    expect(recentFiles.value).toEqual([])
    expect(cloudServers.value[0]?.account).toBeNull()
  })
})
