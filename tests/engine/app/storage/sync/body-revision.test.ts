import { beforeEach, describe, expect, test } from 'bun:test'

import {
  createMemoryLocalCanvasStore,
  getLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { markRevisionSynced } from '@/app/storage/sync/engine'

async function seedDocument(id: string, bodyId = `sha256:${id}-v1`) {
  const local = getLocalCanvasStore()
  return local.writeCanvas({
    id,
    syncTargetId: 's3-compatible#00000000',
    name: id,
    figBytes: new Uint8Array([1, 2, 3, 4]),
    bodyId
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
    expect(latest?.syncedBodyId).toBe(meta.bodyId)
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
    expect(latest?.syncedBodyId).toBeNull()
  })

  test('a metadata-only write keeps synced when the body is already current', async () => {
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()
    await markRevisionSynced(local, 'doc', meta.revision, { bodyUploaded: true })

    const synced = await markRevisionSynced(local, 'doc', meta.revision)

    expect(synced).toBe(true)
    expect((await local.getMeta('doc'))?.syncStatus).toBe('synced')
  })

  test('a rename does not make a confirmed body look stale', async () => {
    // `revision` advances on rename while the bytes do not. Comparing revisions
    // reported the body as stale, which re-uploaded the whole document.
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()
    await markRevisionSynced(local, 'doc', meta.revision, { bodyUploaded: true })

    const renamed = await local.updateMeta('doc', { name: 'Renamed', revision: meta.revision + 1 })
    const synced = await markRevisionSynced(local, 'doc', renamed?.revision ?? 0)

    expect(synced).toBe(true)
    expect((await local.getMeta('doc'))?.syncStatus).toBe('synced')
  })

  test('a row with no local body is never left pending', async () => {
    // Index-only rows have nothing to upload, so `pending` would be permanent:
    // the repair path cannot enqueue a body job without bytes.
    const local = getLocalCanvasStore()
    const meta = await local.upsertIndexMeta({
      id: 'remote-only',
      syncTargetId: 's3-compatible#00000000',
      name: 'Remote only',
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null
    })

    const synced = await markRevisionSynced(local, 'remote-only', meta.revision)

    expect(synced).toBe(false)
    expect((await local.getMeta('remote-only'))?.syncStatus).toBe('synced')
  })

  test('a save landing mid-upload is not marked synced', async () => {
    const meta = await seedDocument('doc')
    const local = getLocalCanvasStore()
    // Upload started at the first body; the user saves again before it completes.
    await local.writeCanvas({
      id: 'doc',
      syncTargetId: 's3-compatible#00000000',
      name: 'doc',
      figBytes: new Uint8Array([9, 9, 9]),
      bodyId: 'sha256:doc-v2'
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
