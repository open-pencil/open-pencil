import { beforeEach, describe, expect, test } from 'bun:test'

import {
  createMemoryLocalCanvasStore,
  getLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { markRevisionSynced } from '@/app/storage/sync/engine'

async function seedDocument(id: string) {
  const local = getLocalCanvasStore()
  return local.writeCanvas({
    id,
    providerId: 's3-compatible',
    name: id,
    figBytes: new Uint8Array([1, 2, 3, 4])
  })
}

describe('markRevisionSynced', () => {
  beforeEach(() => {
    resetLocalCanvasStoreForTests(createMemoryLocalCanvasStore())
  })

  test('a body upload marks the document synced', async () => {
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()

    const synced = await markRevisionSynced(local, 'doc', meta.revision, { bodyUploaded: true })

    expect(synced).toBe(true)
    const latest = await local.getMeta('doc')
    expect(latest?.syncStatus).toBe('synced')
    expect(latest?.bodySyncedRevision).toBe(meta.revision)
  })

  test('a metadata-only write does NOT mark an un-uploaded document synced', async () => {
    // The data-loss path: rename a document whose body upload is still pending.
    // Claiming 'synced' here hid the missing upload and let eviction destroy the
    // only copy of a document the remote had never seen.
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()

    const synced = await markRevisionSynced(local, 'doc', meta.revision)

    expect(synced).toBe(false)
    const latest = await local.getMeta('doc')
    expect(latest?.syncStatus).toBe('pending')
    expect(latest?.bodySyncedRevision).toBeUndefined()
  })

  test('a metadata-only write keeps synced when the body is already current', async () => {
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()
    await markRevisionSynced(local, 'doc', meta.revision, { bodyUploaded: true })

    const synced = await markRevisionSynced(local, 'doc', meta.revision)

    expect(synced).toBe(true)
    expect((await local.getMeta('doc'))?.syncStatus).toBe('synced')
  })

  test('a save landing mid-upload is not marked synced', async () => {
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()
    // Upload started at r1; the user saves again before it completes.
    await local.writeCanvas({
      id: 'doc',
      providerId: 's3-compatible',
      name: 'doc',
      figBytes: new Uint8Array([9, 9, 9])
    })

    const synced = await markRevisionSynced(local, 'doc', meta.revision, { bodyUploaded: true })

    expect(synced).toBe(false)
    const latest = await local.getMeta('doc')
    expect(latest?.revision).toBe(meta.revision + 1)
    expect(latest?.syncStatus).toBe('pending')
  })

  test('a tombstoned document is never marked synced', async () => {
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()
    await local.tombstone('doc')

    const synced = await markRevisionSynced(local, 'doc', meta.revision, { bodyUploaded: true })

    expect(synced).toBe(false)
  })
})
