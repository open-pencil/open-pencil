import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createMemoryLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'
import {
  createMemoryOutbox,
  followUpload,
  getOutbox,
  resetOutboxForTests,
  setUploadProgress
} from '@/app/storage/sync'
import { PARKED_ATTEMPT_AT } from '@/app/storage/sync/types'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

let store: LocalCanvasStore

beforeEach(async () => {
  store = createMemoryLocalCanvasStore()
  resetLocalCanvasStoreForTests(store)
  resetOutboxForTests(createMemoryOutbox())
  await store.writeCanvas({
    id: 'doc',
    providerId: 's3-compatible',
    name: 'Poster',
    figBytes: new Uint8Array([1]),
    syncStatus: 'pending'
  })
})

afterEach(() => {
  resetLocalCanvasStoreForTests()
  resetOutboxForTests()
})

function changed() {
  emitStorageWorkspaceEvent({ providerId: 's3-compatible', documentId: 'doc', kind: 'changed' })
}

describe('following an upload', () => {
  test('ends when the document is on its storage, reporting progress on the way', async () => {
    const sent: number[] = []
    const following = followUpload('doc', { onProgress: (share) => sent.push(share) })
    setUploadProgress('doc', 0.5)
    await store.updateMeta('doc', { syncStatus: 'synced' })
    changed()
    expect(await following).toBe('uploaded')
    expect(sent).toEqual([0.5])
    setUploadProgress('doc', null)
  })

  test('ends at once for a document already uploaded', async () => {
    await store.updateMeta('doc', { syncStatus: 'synced' })
    expect(await followUpload('doc')).toBe('uploaded')
  })

  test('fails when the upload waits for the person', async () => {
    const job = await getOutbox().enqueue({ canvasId: 'doc', type: 'putCanvas', revision: 1 })
    const following = followUpload('doc')
    await getOutbox().update({ ...job, nextAttemptAt: PARKED_ATTEMPT_AT })
    changed()
    expect(await following).toBe('failed')
  })

  test('stops following when asked, leaving the upload be', async () => {
    const stop = new AbortController()
    const following = followUpload('doc', { signal: stop.signal })
    stop.abort()
    expect(await following).toBe('stopped')
  })
})
